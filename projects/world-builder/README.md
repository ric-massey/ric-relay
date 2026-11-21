# World Builder

One page, two sandboxes. You pick one, set how its world works, and run it.

Ric, 2026-11-12: *"One page. It opens. It gives two options. Physics sandbox. People sandbox. You
choose one. You then can choose options for the worlds. Like how many people. How strong gravity
is how the physics works. How the money works how long the people's lives are. Like tons of
settings. Then you hit run it opens the world."*

It grew out of two things already on the site — KONDRITE's living world and the Universe project —
but it is neither. Ric again: *"this is not going to open Kondrite. Those were just the already
written code that you could look at to get an idea of what I wanted."* So it is its own code, in
this folder, and it imports nothing from either.

Linked from Exploration (MODULE 004) and the terminal (`worlds`). Not on the front door or in
`latest.js` yet; that waits on Ric having looked at it.

## Files

The [People sandbox master vision](PEOPLE-VISION.md) records Ric's 2026-11-12 feedback and the
full direction being refined: individual lives and civilizations, deeper work and relationships,
communication, clarity, selection, following, control and equipment. It separates stated goals
from proposed mechanics; its implementation baseline and next-deliverable proposal distinguish
what has shipped from future direction, including the shared daily clock and remaining long-term balance work.

| File | What it is |
|---|---|
| `index.html` | The page: choose a sandbox → settings → the running world. Styles and page script inline. |
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
| `people.js` | The people sandbox's engine. No DOM; runs the same in node. |
| `people-host.js` | The People engine's keeper (TODO item 3): holds a world, runs its clock and answers the page with only what it draws, so the engine can sit in a worker. No DOM and no timer of its own; the same in a worker, on the page's thread and in node. |
| `PEOPLE-VISION.md` | Living master design for the People sandbox; goals, proposals and open questions. |
| `TODO.md` | The People simulator's work in order, twenty numbered items (and 2b, done, and 3b: what items 2 and 3 measured and left). "Work on N" means item N of this file, done by its "How to do an item" (2026-11-14). |
| `test/bench.mjs` | Not a check — the People engine's speed, measured the same way every time: `node --expose-gc test/bench.mjs`. Its numbers are one machine's and go in `TODO.md`'s speed log. "visited" is the share of person-steps on which anybody was looked at. |
| `test/walking.test.mjs` | Quick check that the walking short cuts only make the engine faster: the same engine with them off (`create(options, { plainWalking: true })`) must give the identical world — packed villages, deaths, people moved or killed from outside, a crowd placed at once. |
| `test/dozing.test.mjs` | Quick check that passing over people with nothing to do (TODO item 2) only makes the engine faster: against the engine run the long way round, hour by hour, with `{ audit: true }` making the short cuts check themselves — an ordinary country, a packed village, war, a hungry winter, a shared store, real-size bodies, nobody talking, people changed from outside, a fight at night, moving house, time handed over in frames (with and without the page's word that it touched nobody), and a dense small country. |
| `test/keeper.test.mjs` | Quick check on the keeper and on people having no top: a world run through the keeper at any speed, read all the while, is the engine's own world; a frame says what the world says; panels, a tap and orders go through; the quiet try-out reports a speed and leaves nothing running; the slider's sweep is what it was and a typed number goes past it; and the two files come out whole when written out again as a worker's text. |
| `test/time-food.test.mjs` | Quick clock/food checks: identical timelines through frames/hours/batches, daily rations, children/parents, crop stocks, reserves, aging, imminent elections and inheritance. |
| `test/travel.test.mjs` | Quick travel checks: a detour out of a U-shaped crowd without teleporting/overlap, real equal-price market visits, conserved coins and closed borders. |
| `test/equipment.test.mjs` | Quick equipment checks: paid materials, repairs, real harvest/cargo/combat effects, wear, stored/broken items and death salvage. |
| `test/conversations.test.mjs` | Quick receipt checks: observed effects, a conserved grain transfer, stable IDs and a held record surviving history eviction. |
| `test/world-builder.test.mjs` | Physics settings/conservation and seven actual days per People preset; `--generations` opts into the retained long-term experiments. These can be very expensive on the real clock; in the slow lane of `.github/checks.mjs` (`--only world-builder --slow`) and in `simulations.yml`. |
| `test/day.mjs` | The one definition of "a different day": tallies adult person-hours per activity and measures what share of them two runs spend differently. Shared by the two below so a measurement and a check cannot disagree. |
| `test/behaviour.mjs` | Not a check — a measurement. Reports what share of an adult's hours each setting actually moves, against rerolling the seed as the null. Run it before and after changing how people decide. A short probe cannot see a slow mechanism; use `--days`. |
| `test/decisions.test.mjs` | Quick decision checks: a day slept, worked and walked in human proportions, and seven settings that must move at least 3–5% of an adult's hours. Guards against the hash check passing while a setting does nothing. |
| `test/traits.test.mjs` | The ten traits (TODO item 10): the first four drawn as before, each slider sets what people are like, each new trait changes a choice, and a raided village ends up quicker to anger, warmer to its own and less patient than the same village not raided. |
| `test/mind.test.mjs` | The mind (TODO item 11): no mind ever holds more than its size, sizes differ a little about 20, what is held reads in plain words, and a grudge from year 1 is acted on in year 3. |

No build step and no dependencies. `python3 -m http.server 8912 --bind 127.0.0.1`, then open
`/projects/world-builder/`.

## The three rules

1. **Every setting does something.** Each engine exports a `SCHEMA` — the groups, the settings,
   their ranges, the words shown beside a slider (`say`), and which other setting switches one off
   (`when`). The page builds its controls from that list and the engine reads the same keys, so a
   control cannot exist without an engine behind it. Physics checks and the optional People
   `--generations` experiments walk every setting; routine People tests check daily mechanisms
   and bounded presets. A short daily run does not prove an annual mechanism has happened. **To add a setting:** add it to `SCHEMA`, read
   `S.<key>` in the engine, run the test. Nothing in `index.html` changes.
2. **Nothing is scripted.** This is KONDRITE's rule (Ric: *"it needs to be able to happen through
   the collectives of the people. Nothing forced or faked"*). No function starts a war, a famine
   or a breakaway on a timer. A leader weighs grievances that real thefts and killings left; a
   village breaks away only when the people living in it have each stopped being loyal. If
   something you want never happens, change a pressure, not the outcome — and don't tune a number
   until the thing appears on cue.
3. **Talk reports, it never causes.** Every line somebody says is a template over what just
   happened between two people: food that changed hands, news passed on, a mind changed. The test
   checks that any news repeated is in the record. **No AI model speaks for them, and none should
   be wired in** — that would cost money per visitor, need a key, and break the site's
   no-dependencies rule; templates are why hundreds can talk at once for nothing.

## The physics sandbox (`physics.js`)

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

`node projects/world-builder/test/breakup.test.mjs`,
`node projects/world-builder/test/shape.test.mjs` and
`node projects/world-builder/test/chemistry.test.mjs` check these accounts quickly on every push;
the longer sandbox suite also checks that each new setting changes a world and each preset runs.
Use `node projects/world-builder/test/world-builder.test.mjs --physics` for just its physics
settings, presets and conservation checks; the default still runs both engines.

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
`lab.html`, linked under the two doors.

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

## The people sandbox (`people.js`)

A map of land that grows food, villages, and a few hundred people who each need to eat. At 1×, one day takes **twenty real minutes**, and 365 days make a year (Ric, 2026-11-12:
"1x should be a 20 minute day" and "the people should move slower"; since 2026-11-14 a day is five minutes — see "A five-minute day and a map with a size" below). The visible clock shows
day, time and year. Pause freezes both activity and calendar; the speed buttons scale both.

### One clock and food measured in days

Reworked 2026-11-12 after Ric asked for food "closer to how food works in real life". The
implementation choices below make daily need and reserves meaningful, but are a simplified
simulation, not medical nutrition or a validated agricultural model.

- One food unit is **one adult-day ration**. Adults consume 1 per day in hourly portions.
  Children's daily need rises linearly from 0.35 at birth to 1 at the adulthood setting. It does
  not depend on lifespan. Newborns do not create starting supplies: they draw on the household.
  Food returned on death is removed from the deceased's pockets to avoid feeding children twice.
  Parents share food while retaining 0.25 ration for themselves; couples
  and village support keep the existing household rules. Food shopping can be retried after two
  simulated hours, rather than the old months-long cooldown.
- A crop tile holds up to **48 rations times its fertility**, replenishing linearly over a
  **60-day** scale at default richness. Harvests still remove actual stock and are bounded by
  carrying capacity. These are stocks of ready food, not seasonal planting/growth stages.
- A person's panel shows daily need and how many days their carried food covers. A village's
  store estimate divides its food by its actual residents' combined daily needs; personal bags,
  future harvests and incoming trade are not part of that store-only estimate. One food-price
  unit now prices one adult-day ration.
- Hungry hours accumulate and affect health; missing a meal does not cause instant death.
  `hunger` still controls deterioration. Age, consumption and recovery update hourly. Spoilage,
  food variety, water and individual health/energy requirements are not modeled yet.
- **The year** (2026-11-14). Until then every day was the same day, so nobody ever had a reason
  to store. Every number in it is a setting or comes from the sky (Ric: *"the variables should
  all be editable"*): **distance from the equator** sets day length from the sunrise equation with
  the almanac's −0.833° (twelve hours on the equator, 15.6 / 8.8 at 45°, 18.7 / 5.9 at 60°), and
  people work in the light; **how cold winter gets** sets growth, which follows a warmth curve
  peaking in mid-July and stops below a frost line, normalised so a year with seasons grows what
  one without does — in one half; **when the world starts**; and **year to year**, which draws
  each year an early or late spring (up to three weeks), a warm or cold year and a good or poor
  yield (±30%) from a hash of the seed and the year, so a seed always gives the same years and
  two seeds give different ones. What happens in a year, all measured on year-long runs:
  - **The harvest.** About two months after the warmest day the grain is ripe and a day's
    reaping brings in up to four times a day's gathering; a late year has a late harvest. Without
    it, nobody's day could bring in more than they ate and a hard-winter world starved to the
    last person by February. With seasons a field holds a season's growth (`FIELD_CAP`), and
    what is still standing when the frost comes is lost. At harvest everybody helps.
  - **Putting by.** A household holds back food for the lean days ahead (`winterAhead`): every
    day that grows less than a year's average, weighted by the shortfall and the cold, plus a
    month for stripped fields to grow back — the hungry gap, without which a world that stored
    for the frozen months still starved in April. A quarter over, for a long winter, for each
    child's real need split between the parents at home (`feeds`). A full larder only stops
    somebody wanting to work once it covers that. People with coins buy ahead.
  - **When it runs short.** With the grain in houses the village store is empty all winter, so
    somebody going hungry goes to a neighbour (`ask`): family first, then friends, then whoever
    has most put by. They buy what that household can spare beyond its own winter, at a price
    that climbs as the seller's store falls; what money cannot buy, kinship or a warm nature may
    give. Orphans are taken in by a grown sibling or whoever has most (`carer`). A whole village
    that runs short moves: the move option judges a place by what its houses hold, and a couple
    goes together. When nobody at home has any, they walk to the next village (within twenty
    tiles, not at war) and buy from a household there — strangers sell, only people who know
    each other give.
  - **Where it stands.** Year-long runs of a 300-person valley, starved out of 300: default mild
    winter 4, 27 and 6 over seeds 11, 108 and 205; hard winter 2 and 4; no winter 0. Seed 108 is
    a valley with villages on thin ground and a poor first year, and it has ranged from 9 to 40
    across small changes — read it as "a bad year on poor land kills one in ten", not as a fixed
    number. Before buying from the next village was added the same seed lost 40 and a hard
    winter up to 63. Grain still does not move by trade (traders read the store, and the store
    is empty in winter); the hungry carry it themselves.
  - **A night lasts until dawn.** A sleep chosen in the dark ends when it gets light (one to ten
    hours); a sleep in daylight is a whole one. While it was always seven hours, somebody who
    woke before a spring dawn at 45° went back to bed until one in the afternoon, and adults
    spent 54% of their hours asleep.
- **How it starts** (2026-11-14). Ric: *"when I change the settings it feels like the people do
  the same thing every time"*. Measured, he was right about the first day: every world began
  with everybody fed, the same food in every house and nothing short, so a setting showed only
  once it bit — on day one most settings moved a day less than changing the seed did (3.5–8%),
  by day thirty a third to nearly half. The starting state is now four settings on the setup
  page, each at a default that makes exactly the world it always did: **food put by** (nothing,
  up to a year — squared, so the low end is days), **crops in the fields**, **how old they are**
  (mostly children to mostly old) and **how settled they are** (how many start in couples and,
  past the middle, how many friends each already has). Over the first two days, against a
  reseed's 3.5%: three months put by moves 47% of an adult's hours (they rest, talk and fit
  tools rather than work), a field ready to reap 15%, mostly children 12%. How settled they are
  shows later, through who they ask and who they follow, not on day one.
- **Sickness is a village fever, not smallpox** (2026-11-14). It lasts seven days and kills about
  3% of fed, rested adults who catch it (`SICK_HAZARD`) — three times that for a child under five,
  for somebody near the end of their life and for anybody hungry, which is how a bad harvest and
  an outbreak become one disaster (`frailty`). A conversation passes it on 15% of the time
  (`CATCH`), and surviving it makes you immune for good. Before that date it killed 22% of
  everybody who caught it, alike, and passed on 35% of the time, so it reached nearly everybody:
  default worlds lost 60–83 of 400 people to it in 240 days and shrank. Measured after, the same
  worlds lose about a dozen and grow. `decisions.test.mjs` gives a whole fed world the fever at
  once and requires a few in a hundred to die. Births were checked at the same time and need no
  change: about 49 a year per thousand people, inside the range of real pre-industrial villages.

`advance(seconds)` advances seconds of playback at 1×. `step(hours)` advances simulated hours by
calling that **same** function. Both run every action: 5 actions per playback second, 250 per
simulated hour, 6,000 per day. `YEAR` is now **8,760 hourly updates**; it is not a number of walking
steps. `days` and exchange timestamps read the completed action clock. Summing frame-sized time
uses compensation so splitting the same elapsed time does not change the world.

Food/aging run hourly; reflection and markets every six hours; village decisions, territorial
updates, faction decisions and population samples daily. Soldiers receive 1 coin per day if their
faction can pay; this matches one ration at the fixed default price, not a guarantee that floating
prices remain affordable. Treasury reserves use a week's wage budget. Fertility probabilities
are expressed per year and scaled to reflection cadence rather than firing the old annual
probability four times daily. Terms, lifespan and political cooldowns retain calendar-year units.

The existing speed controls multiply time handed to the same engine; they never select a cheaper
model or skip consequences. A slow device may run below the requested speed. At 1× a year still
costs 121 hours 40 minutes of playback; even headless generation-scale runs require all those
walking/work steps. Optimization, higher-speed design and persistence remain future work.

### What a person decides to do

Rebuilt 2026-11-13 after Ric: *"what you change doesn't change a lot for the people day to day"*.
He was right, and `test/behaviour.mjs` was written to find out how right. It tallies every adult's
activity every simulated hour, so a run becomes a distribution of person-hours, and compares two
runs by **what share of hours are spent differently** — with *rerolling the seed* as the null,
since a setting you cannot feel more than a reroll is a setting you cannot feel.

**What it found.** Twenty of thirty-one settings moved a day less than half as much as a reroll
did; the median setting moved **0.6%** of an adult's hours, and twelve moved **exactly none**
(`crowd`, `births`, `hunger`, `plague`, `inherit`, `memory`, `rule`, `term`, `rebel`, `war`,
`aggression`, `deadly`). The four-day probe is too short to see the slow ones — elections, war and
plague are not four-day mechanisms — but `hunger`, `rich`, `crowd` and `memory` should move a day
and did not. Three causes, all structural:

1. **A day was five scripts, one per job.** `work` branched on `p.job` and ran a fixed sequence.
   Nothing a setting could change altered the shape of a day, only a number inside one.
2. **Work cost no time and fed everybody.** A day's field work took six *simulated minutes* and
   brought back 3.6 adult-day rations. Adults spent 54% of their hours walking, 0.1% harvesting,
   and were never short of food — so nothing downstream of scarcity could bite.
3. **How much the land grows only changed how fast a field refilled**, never its ceiling or a
   day's yield, so rich and thin ground fed a farmer identically.

**What replaced it.** One place where a person decides, and it is a comparison:

- **Needs.** Besides food: `rest` (rises with the hours awake, faster at real work, cleared by a
  night in a bed), `alone` (hours since anybody spoke to them), `fear` (danger at their own
  village — a siege, enemies at its edge, a raid on it lately — or a blow just taken; a war
  elsewhere is effort, not fear: "Wartime effort", below). `urgency(p)` turns them into 0–1.4 wants and is exported, so the person panel shows
  the same figures the engine decided with.
- **Options.** Sleep, eat, a day in the fields, a day at the bench, a load to carry, standing
  guard, going to find somebody, fitting tools, sitting the day out. Each is scored against what
  the person needs, what the walk and the risk cost, and what they are good at. The best wins,
  with a little noise so neighbours do not move as one.
- **A job is competence, not a script.** It is worth about a third again at the work it names, and
  anybody may do anybody's work when their circumstances call for it. `chooseJob` and the daily
  choice read the *same* figures (`livelihood`), so what somebody is called and how they spend
  their hours cannot drift apart — before this they did: a sixth of a village were called crafters
  while 0.1% of its hours went on making anything.
- **Work costs hours and feeds about one household.** `SPELL` holds the hours: sleep 7, a day at
  the bench 5, a watch 4. A day in the fields brings back 1.8 rations, 2.25 with a tool. **The land
  sets how long that takes, not how much it is** (2026-11-14): five hours on ordinary ground,
  divided by how fast it gives — `rich` across the world, the patch's own fertility locally, so
  `uneven` decides who finishes early — and capped at nine (`FIELD_HOURS`), after which they bring
  back what they managed. Scaling the load instead (the 2026-11-13 version) moved a fed farmer's
  day by 2.7%, because a fixed shift on rich land looks exactly like one on thin land; scaling the
  hours is how farming labour actually differs, and it moves a day 7–9%. Land is the thing there is
  not enough of, which is what gives the settings about land something to bite on.
- **People have houses.** Spread over the village's own ground, shared by a couple and their
  children. Bodies cannot overlap, so when people were first given a reason to all be home at
  night, one point in the middle of a village could not hold them and the village gridlocked;
  the market, the workshops and the fields are places now, not points.

The village store stays a shared pool, so selling into it does not require standing on a
particular tile — fitting tools still does, and the `gear` task still walks to the middle for it.

**Moving house is a choice** (2026-11-14). Before, a person changed village only by accident — two
people of different flags happening to talk, a dice roll on a full village, or hunger. Now
`choose` weighs a `move` option against everything else: how fed and how full somewhere reachable
is against home, against what holds them (a partner, children, the friends they remember living
there, the flag). `switch` is how much a border counts against a place, `crowd` what "full" means,
and `memory` how many ties a person can hold. Somebody who has just moved settles for ninety days
before weighing it again. In a fed, peaceful world almost nobody moves — 1 to 3 people in sixty
days of a default world — and that is correct: these three settings are felt over a season or
under pressure, not on day three. Don't tune the weights until a fed world churns.

**The famine that was a traffic jam** (found 2026-11-14). A default world starved 77 of its 400
people by day 20 and 148 by day 60 — no war, no plague — while its stores held hundreds of
rations at under a coin each and the dead had coins in their pockets. They were stuck: the walk
code counted somebody as stuck only if they got no closer *than the last step*, so a person
sliding to and fro round a neighbour got a hair closer every other tick and was never counted.
One was traced spending seventy hours "Walking" 1.2 tiles from home. The first repair measured stuck
against the closest they had been; after three fresh tries at a spot nearby they did the thing
from where they stood (`act`). The routing update below bounds that nearby-arrival fallback and excludes distant travel tasks.
In the first repair’s measurements, starvation went to zero and walking fell from
about 13% of an adult's hours to 4%, and rerolling the seed now moves 4.9% of a day rather than
13.5% — much of the old "variety between worlds" was which villages happened to jam. **Every
measurement taken before this date includes the jam**, the 2026-11-13 after-numbers above among
them.

**Verification changed with the clock.** The old `step()` experiments allowed only eight actions
per 1/200 year and no longer describe this world. Routine simulations now check seven **actual**
days per preset, money/state invariants and the visible day/spacing contracts. The quick time/food
suite compares the complete same-seed state through batched, hourly and frame calls, isolates a
day's consumption/growth, actual births, and imminent election/death/inheritance boundaries. Original
multi-year setting and century outcome checks are retained behind `--generations`:

```
node projects/world-builder/test/world-builder.test.mjs --generations
```

That is an explicitly expensive experiment, not a CI check that was run for this change. A week
of stability is not evidence of century-scale balance; earlier century measurements are superseded.

42 settings in ten groups: the land, the year (distance from the equator, how cold winter gets,
when the world starts, year to year), how it starts (food put by, crops in the fields, how old
they are, how settled they are), the people, lives (lifespan, childhood, children, hunger,
sickness), money (coins or a shared store, inequality, prices, tax, inheritance), minds (talk,
stubbornness, how divided, memory, changing sides), power (who leads, terms, loyalty, breaking
away), war, and time.

What a person does: farms (walks to a field, brings food home, sells what they do not need),
makes goods, carries goods to wherever they fetch more, or soldiers. They eat, pair up, have
children, remember up to a set number of friends and grudges, and talk to whoever is standing on
the same ground — which is how news, opinions, loyalty and sickness travel.

What adds up from that:

- **Factions** have a leader, a treasury, a tax and an opinion of every other faction. Leaders
  are voted in, inherit, or are simply the richest, by the setting.
- **War** needs a grievance (thefts, killings, a lost village), or hunger and no land left, and a
  leader bold enough who thinks it can be won. Soldiers march on the nearest enemy village; an
  undefended village is taken. Peace comes when a side is tired enough.
- **Breakaways** happen when a village's own people have, on average, stopped being loyal. If the
  leader lives there it is a coup or an early vote instead.
- **People change sides** by marrying across a border, walking to wherever there is food, being
  talked round by somebody doing better, or being conquered.
- **Money** is conserved: every coin is in a pocket, a till or a treasury, and the test adds them
  up every year. With "no money" every village keeps one store everybody eats from.

Things found while tuning it, so nobody undoes them:

- **Children on day one need parents.** Without them a third of the starting population starved
  in three years, because a child eats from a parent's share.
- **A village feeds its own children whatever it does about money**, and a couple eats from one
  pot. Orphans starving beside a full store was not a finding about economics.
- **A treasury must spend.** Tax flowed in and nothing flowed out, so within a decade every coin
  was in a chest and no farmer could be paid. Leaders now push spare coin back into their
  villages' tills.
- **Somebody with an empty bag goes home to eat — once** (`p.ate`), or a village with nothing to
  give holds its farmers at the door forever.
- **Coin worlds are harsher than shared ones, and that is left in.** A broke person can starve
  beside a full store unless the leader believes in sharing or a neighbour is kind. That is what
  the money setting is for.

### Ruling, live rules, graphs and grain trade (2026-11-14)

Ric: *"the person watching can choose the tax and big decisions and stuff for each area"*, and
asked for the graphs and the grain trade the year needed. All of it is on the running page.

- **Ruling a faction.** On the Factions tab, *Rule it yourself* hands that faction's leader
  decisions to the watcher (`rule`, `order`, `orderVillage`, `declare` in `people.js`): the tax on
  every sale, the share of adults under arms (filled in peace too), whether the treasury buys
  bread for the hungry, and war or peace with each neighbour. Each village can be given its own
  tax and its own relief (`taxOf`), which is what "each area" means here. Nothing else changes:
  people still live by their needs, so a heavy tax is felt and resented — `test/rule.test.mjs`
  holds that a sixty per cent tax costs loyalty against the same world left alone. Peace takes
  two: the other side weighs its own dead, years and hungry as its leader would, and nobody makes
  peace the week they were attacked unless badly outmatched. Elections and successions still
  happen; the watcher's decisions outlast leaders until handed back. Your decisions are in the
  news. A world nobody rules is byte for byte the world it was.
- **Live rules.** The World tab's *Change the rules* lists only the settings the engine reads as
  it goes (`LIVE` in `people.js`, marked `live` in the schema): land, the year, crowding,
  children, hunger, sickness, prices, tax, the minds, breaking away and war. The ones that shape
  only the first day — the map, how many people, the seed, how it starts, money, inequality —
  are not offered, because moving them later would change nothing. Step buttons, not sliders:
  the panel redraws several times a second.
- **Graphs.** The World tab draws one point a day (`sample`): people, food on hand in days a head,
  the price of food, the share going hungry, deaths a day, loyalty, and grain carried between
  villages. The last 600 days.
- **The map shows what happened.** Households that moved are drawn as fading arrows from the old
  home to the new (dashed when hunger drove them) for twenty days, and the big news of the last
  fortnight — famine, war, peace, a village taken, founded, abandoned or broken away, sickness —
  as a ring and a word where it happened. Only what the engine recorded (`moves`, `events`).
- **Grain trade.** With seasons the grain is in houses and the store is empty all winter, so the
  old traders, who read only the store, never moved any. A trader now also carries grain: from a
  village whose houses hold more than their winter (`spare`) to one whose houses are short of the
  next fortnight (`short`), a cart of eight packs, bought door to door at each seller's price and
  never into their own winter, sold door to door to the most short at cost plus forty per cent;
  whoever cannot pay does not get it. A trader takes only as much as the short households there
  can pay for (`purse`), never while the harvest is still standing, and only traders cart grain —
  when anybody could, two-fifths of a hard winter's adults chose to carry food to one village,
  jammed at its middle for a week and stopped sleeping. Coins are conserved.
  **What it does not do yet:** with grain carts on and off, same code and seeds, four year-long
  runs lost 50 and 48 — no measurable effect on survival — and with carting left to traders,
  few of whom exist, under a dozen rations a year now move. The mechanism is real; making it
  matter (more traders when grain is dear, granaries, credit) is not done.
- **A jammed journey arrives.** A trip between villages finishes only by physically getting
  there (the crowd routing above) — except when it has stood within 2.5 tiles of its end for most
  of an hour after rerouting, when it counts as arrived. Forty carriers aimed at one village's
  middle otherwise never arrived at all.

### Settings that mean what they say (2026-11-14)

Ric, going through the setup page: *"a full village … there should be an option to say as much as
can sustain it"*, *"kids shouldn't have a bunch of money cuz they can't spend it"*, stubbornness
*"should be passed on genes … set the range but not everyone being the same"*, *"what if a system
of who has the most money gets overthrown by a civil war?"*, and *"soldiers in peacetime … should
be decided by leaders"*. Each is now what the engine does (`test/settings-sense.test.mjs`):

- **A full village** goes to *as many as its land can feed*: the limit is what the fields within
  eight tiles grow on an average day, a ration a head (`crowdOf`, `landFeeds`), worked out daily
  with the territory, so lost land or thin soil makes a village full sooner. The number stays as
  an option, and is still the default.
- **A household is one purse and one pot.** Children may hold coins, from the start or an
  inheritance (an earlier version of this day kept them from children altogether; Ric: *"kids
  should be allowed to hold coins. But their parents can use them"*). Whoever feeds a child can
  spend its coins for the household once their own are gone, and a couple's coins are one purse
  (`funds`, `pay`); a parent with nothing eats from what a child holds beyond its own next three
  days, as already from a partner's plate. The rule behind it, in Ric's words: settings can be
  played with, but the core must never make *"a kid having a bunch of money while his parents
  are starving"*.
- **Natures are personal and inherited.** Stubbornness was one number for the whole world; now each
  person has their own (`stub`), and a conversation moves each by their own openness. Children take
  after their parents. **How much they differ** sets how far one founder's nature — stubbornness,
  boldness, warmth, greed — is from the next and how far a child strays; at its middle the founders
  are spread exactly as before. The inspector shows Stubborn and Greedy bars.
- **Who leads, at first.** Each faction has its own way (`f.rule`), shown on its card. A chief or a
  rule of the rich falls in a civil war (`revolution`) when at least 45% of its grown-ups have
  turned on it and they outnumber the soldiers still loyal two to one: both sides lose people, and
  the winners choose a vote if they lean to sharing, else a chief. Nothing is on a timer; a regime
  its people bear is never touched, and one fallen cannot fall again for three years. Measured: a
  hated rule of the rich (inequality 0.95, loyalty none, tax 50%) fell in both factions inside 120
  days; a borne one (no inequality, full loyalty, no tax) stood.
- **Soldiers at the start**, then the leader's call: in peace each leader moves a little a day
  toward half the biggest neighbouring army's share plus a base, a little more for old wrongs and
  a bold leader, less when the treasury cannot pay — and recruits toward it in peace too. Matching
  a neighbour in full was an arms race to the cap; half settles near eight in a hundred.
- **No longer live:** stubbornness, how much they differ, peacetime soldiers and tax are people's
  natures and leaders' decisions now, so the running World tab no longer offers them; nor are how
  long somebody lasts with no food, how many people a mind holds, or the distance from the
  equator — how bodies, minds and places are is set once, at the start (Ric: *"starvation should
  be decided at the beginning"*). Tax had been
  live and did nothing: moving it shifted only a floor leaders seldom reached, and no faction's
  actual tax changed. It is **Tax at the start**; to set a tax mid-run, rule the faction.

Then a pass over every other setting for the same kind of thing:

- **Starving took ten days.** Somebody with nothing at all to eat lost all their health in ten
  days at "Going hungry" 1 — four times faster than a fed adult with water lasts. It is about six
  weeks now (`STARVE`), and the setting says it in days ("about 42 days with no food at all";
  14 to 208 across its range). Every famine figure before this date was measured at the old rate. Measured after, the same year-long runs of a 300-person valley starved 0, 1, 0 and 0 (mild winter seeds 11 and 108, hard winter 11 and 108), where they had starved 0, 32, 5 and 27: the "famine valley" of seed 108 was mostly people dying before asking a neighbour, buying grain or moving could reach them.
- **"A vote every" hid itself** unless votes were the starting rule, although a revolution can
  bring votes in and they use it. It always shows.
- **"The world starts in"** said "Autumn — the harvest is in the fields" and "Winter — with
  nothing put by", which contradicted Crops in the fields and Food put by when those were set
  otherwise. Plain season names now; what is in the fields and the houses is set under How it
  starts.
- **Settings with no explanation** — who starts rich, inheritance, loyalty, how quick to fight, how
  deadly, villages each — now say what they do.

### A world that does not go still (2026-11-14)

Ric: *"the people stopped doing things — they didn't take more land, they weren't greedy, they
weren't fighting ever, wars are always really fast … the simulation got to a point where no one
was doing anything."* Measured over two years of a 200-person valley, he was right: no war, no new
village, no faction risen or fallen, and adults asleep or sitting at home 50–75% of their hours.
Once a household had its winter put by, nothing in the engine gave anybody a reason to want more.
What was added, each measured over three years on three seeds:

- **Ambition.** A person measures what their household is worth (coins, food, goods) against
  their village's average, and the greedy want to stand above it (`ambition` in `urgency`): they
  keep working, trading and saving after the larder is full. Making goods rose from 4–9% of adult
  hours to 17–29% in a first year.
- **Land hunger.** A village whose fields feed fewer than two a head sends its bolder families
  out to found a new village on good open land (`found`), long before it is "full" by a count.
  Villages now spread in the first months until territories meet; where no land is left, that is
  felt as cramped.
- **Reasons to fight.** Besides old wrongs and hunger: land running short (fields feeding under
  two a head across the faction) and, for a greedy leader, a neighbour richer a head (`covet`).
  Wars may begin from the first half-year, and between the same two eighteen months after a peace
  (they were held off a year and three years, so every war in a world began in its thirteenth
  month and the next years were silent).
- **Wars that last and do not slaughter.** A village defends itself: a quarter of its grown-ups
  stand behind its walls besides any soldiers, besiegers make headway only while they outnumber
  all of that by a fifth, and a bigger place holds out longer. A fight is skirmishing: about one
  blow in four hours of close contact, and a blow wounds more than it kills; the wounded go home
  and are let go rather than cut down as they leave — chased down, they had been most of a war's
  dead, a quarter of a world in eleven days. War-weariness builds with the dead, the years and the
  hungry, so wars between equals run through campaigns and winters.

**What a three-year run looks like now:** wars from the seventh month that run one to two years
with a fifth of adults under arms, famine in the war winters because soldiers do not farm (the
heavier cost of war, as it was), villages taken late, one faction swallowing another, peace, and
new villages founded throughout. Battle deaths are about five in a hundred over a war. Wars and
famine are not scripted: each comes from people's land, wealth, grievances and leaders.

### A five-minute day and a map with a size (2026-11-14)

Ric: *"generations take hours even at 1500x speed … what if instead of 20 minute day it was a 5
minute day"*, and then *"I don't want the people moving faster … maybe we need to define how big
the map is"*. A day at 1× is five minutes. The engine's cost is the number of small steps a game
day holds, so it now takes 60 a game hour instead of 250 (`ACTIONS_PER_HOUR`): everything measured
in hours — sleep, shifts, seasons, rations — is as it was, and everything that was counted in
steps (how long a conversation stands, cooldowns, when somebody counts as stuck) is converted by
`TK` to last the same game time. Measured headless: 200 people run a year in about 3 minutes, 400
in about 8 (a little over three times faster than the twenty-minute day). A world plays out the
same at any viewing speed; it is only coarser in its steps than it was.

The map has a scale: **a square is 250 metres**, so a village's fields, about eight squares out,
reach two kilometres, as farming villages' did. **How much land** is a slider in kilometres east
to west, 5 to 40 (north to south is 0.62 of it); the old valley, district and region are 11, 17
and 25 on it, and a link or preset that names one still opens it (Ric: *"we should be able to
choose how big the land is"*). Below 5 km the default eight villages do not fit.

**Up to the size of a state, on a computer that can carry it** (Ric: *"largest should be the size
of like a state … Idaho or Utah or Tennessee"*, and *"a big computer could run bigger worlds with
options to turn parts of tracking off"*). Land goes to 500 × 310 km — about 155,000 km², between
Tennessee and Utah — and people to 20,000. Three things make that possible, measured:

- **Detail**, a settings group: **Bodies** "as drawn" (the default; everybody keeps a drawn box's
  width apart, so nobody overlaps on screen) or "real size" (half a metre on 250-metre squares:
  nobody is ever in the way, the bookkeeping of who stands where is skipped, and a world runs
  about 3½ times faster — 400 people, a year in 1.8 minutes instead of 6.3 — but boxes drawn
  larger than life can overlap); **Conversations** "every one written down" or "only what
  happens" (they still pass on news, friendship and sickness; little faster on its own).
- **Land over 40 km is mostly wild** (`WILD`, `worked`): crops are worked out only within four
  kilometres of a village, and a square first reached is a full stand of virgin growth. Every
  map up to 40 km is exactly as it was. Borders are worked out around each village rather than
  by asking every square about every village, and the lists of who stands on each square exist
  only where somebody stands — both give the identical world, checked on three seeds.
- **The page paints a big land a pixel a square**, its soil worked out once, and repaints it at
  most every two seconds; eight pixels a square would have been a canvas larger than a browser
  allows.

Measured headless with real-size bodies: 500 km and 2,000 people, a year in about 9 minutes; in a
browser at Max about 5. **Many thousands of people are still slow** — 8,000 on 500 km took an hour
a year — because some of what a person does still looks through everybody (who to ask for food,
who to buy grain from); that is the next thing to make fast. Tests move "how many people" and
"how much land" to twice and ten kilometres more, not half way to their ends, which test the
computer rather than the world. People
**walk 4.5 km an hour**, 18 squares (`TILE_METRES`, `WALK_KMH`); until this they covered about
37 squares an hour, nine kilometres, on a map with no size. A stride longer than a fifth of a
square is taken in checked pieces, so nobody walks through anybody. Tests step the world by
`People.STEP` (one step) or by game hours, never by seconds, which mean a different amount of the
world at a different day length.

### How fast a world can run (2026-11-14)

Ric: *"16x is pretty slow ... a year every minute should be the fastest probably"*. The clock now
goes to 50×, 100×, 250× and **Max**. Above 16× the page runs as much simulation as fits in 40 ms a
frame (since 2026-11-15 the keeper does, on its own thread, ten milliseconds at a time: see "Off the page's thread") and drops the rest — the world goes slower than asked, never differently — and says what it
reached: *"Running at 900× — a year every 8 minutes"*. **Max has no ceiling** (Ric: *"someone with a better computer can run faster"*): it asks for as much as fits in each 40 ms, so a faster machine simply goes faster. Ric chose to keep the engine exact at about a year every 8 minutes rather than coarsen it for speed.

A year a minute is about 7,300×, and the engine does not reach it. Everybody acts 250 times a game
hour, so walking, crowding and who meets whom are exact; measured without drawing, 200 people ran
at 670×, 400 at 400× and 900 at 100× (cost grows faster than the head count). The tables of who
stands where were a Map of Sets rebuilt from nothing every tick — 43% of the time; they are now
reused arrays with only the used cells cleared, which gives the identical world (same seed, same
state, checked) about 1.3× faster in Node and around 900× in a browser at 400 people. The next
exact saving — letting somebody asleep or mid-shift skip the ticks in which nothing about them
changes — is perhaps another 2×. Reaching a year a minute would need people to move in coarser
jumps at high speed, which would make a world play out differently depending on how fast it is
watched; that breaks a rule this engine was built on and has not been done.

### A crowd that costs what it should (2026-11-15)

`TODO.md` item 1. Ric: *"efficiency is importnat for the program"*, and *"i feel like right now im
running it inefficiantly"*. He was right, and the waste was in one place.

**What was measured.** On a 5,000-person world, 87% of everybody's steps were an attempt to walk
that got nowhere. A village that size is packed as tight as bodies allow, so a person aiming at
their bed or bench tries the heading and four ways round it, and ends the step where they began —
most often by stepping aside and straight back. That was 6.25 million such attempts a day, three
quarters of the engine's time, spent on people who never moved. The search for a way round a crowd
ran 892,000 times a day and found a way 123 times.

**What changed.** Nothing about what happens; only what is worked out twice.

- **A blocked step is remembered** (`move`, `quiet`). It can only come out differently if room has
  been made near the walker: somebody stepped away or died. Each square keeps the count at which
  room was last made on it; a person who stands where they stood, wants the same step and has had
  no room made on the nine squares round them is blocked again without looking. An arrival can
  only block, so arrivals are not counted. A step aside-and-back counts as blocked: nobody else
  acts in between, so nothing saw it.
- **A way round that could not be found is remembered** the same way (`noWay`, `stillNoWay`), over
  the squares the search actually looked at.
- **"Is anybody in the way" reads one, two or four squares, not always nine** (`free`): only the
  squares a body's width from the spot can touch.
- **A crowd is placed with a finer map** (`markTaken`, `takenAt`; `ringTaken` until item 3b): sixteen small
  squares to a square's side, each marked when it lies wholly inside one body's reach. A spot on a
  marked square is taken without looking; a ring crossing only fully marked squares is skipped.
- **Who takes an orphan in** is found in one pass over the population (`findCarers` in `census`),
  not one pass per orphan.
- Smaller things: no list built per person per step to ask "is this a local task", number keys
  in the route search, no search of a square's list before adding somebody to it.

**The world is the same world**, step for step. The idea is the sleeping body of a physics engine
(a thing that cannot change is not worked on until a neighbour moves), and the danger with it is
well known: a sleeper that never hears it should wake. So every way room can be made is counted —
a step, a death (`die`), and a person moved or marked dead from outside the engine, which the
tests and the page are allowed to do — and `test/walking.test.mjs` runs the engine both ways and
holds them equal, hour by hour. It was checked by breaking each short cut on purpose (eight ways);
the test caught every one. The old engine and the new were also run side by side from the same
seed: a year of the default world, six days of 3,000 people at war with sickness, a day of 20,000.
Identical every time.

Because a sine differs by a hair between an Apple and an Intel chip, the test compares two runs on
the machine it is on rather than against a stored answer.

**What it bought** (Apple M1, 8 GB, `test/bench.mjs`, bodies as drawn):

| People | Land | Start, before → after | A day takes, before → after | Top speed, before → after |
|---|---|---|---|---|
| 400 | 17 km | 0.02 → 0.02 s | 0.78 → 0.52 s | 382× → 577× |
| 2,000 | 17 km | 0.12 → 0.05 s | 11.9 → 4.4 s | 25× → 68× |
| 5,000 | 40 km | 0.90 → 0.15 s | 23.8 → 4.4 s | 13× → 68× |
| 20,000 | 80 km | 25.7 → 2.6 s | 132 → 21 s | 2× → 14× |
| 400 | 500 km | 0.17 → 0.19 s | 0.47 → 0.37 s | 644× → 813× |

**What it costs.** Eight bytes a square of land for the room counts, only with bodies as drawn:
about 14 MB more on the 500 km map (56 → 69 MB at the start). Nine small fields on a person. The
finer map exists only while a crowd is being placed.

**What it did not fix, and should not hide.** The crowd itself. With the default eight villages a
world of thousands is eight solid discs of people who mostly cannot get to where they are going;
that is now cheap, and it is still what happens. It is the same world as before on purpose (this
item was not allowed to change it). Giving houses and fields real ground of their own is `TODO.md`
item 7. And every person is still visited every step whether or not they have anything to do:
after this change that visiting, not walking, is the largest cost, and it is item 2.

Sources read for this: on grid cell size against query radius, the
[rustsim-crowd broadphase notes](https://docs.rs/crate/rustsim-crowd/0.0.1/source/src/broadphase.rs)
and [Fixed-radius near neighbours for agent simulations](https://eprints.whiterose.ac.uk/153625/7/1-s2.0-S0743731519301340-main.pdf);
on sleeping and waking, [Roblox's sleep system](https://create.roblox.com/docs/physics/sleep-system.md)
and its account of [a sleeper that was never woken](https://corp.roblox.com/newsroom/2020/07/roblox-physics-building-better-sleep-system);
on placing points that keep their distance with a background grid,
[Bridson's Fast Poisson Disk Sampling](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf).
None of their code is used.

### Only people with something to do (2026-11-15)

`TODO.md` item 2. After item 1 the largest cost was no longer walking: it was that every person,
and every list of who stands where, was gone through on every step — 1,440 times a day — whether
or not anything about them could change.

**What was measured first**, because the guess was wrong. The plan was to stop visiting people who
are asleep or at work. Measured on this machine at 20,000 people:

- **A third of all the time was the computer not knowing what a person is.** Eight fields were
  added to a person the first time they were used (`stuck`, `lastDistance`, `markets`, …), in
  whatever order a life happened to use them, so there were 21 different layouts of "a person" in
  memory. A JavaScript engine keeps a short cut for reading a field off objects it has seen laid
  out the same way; past a few layouts it gives up and looks the field up by name every time. That
  was 35% of the time with bodies as drawn and 50% at real size.
- **Most people who looked asleep were not.** With bodies as drawn, 74% of all person-steps were
  somebody standing jammed in a packed village more than 2.5 squares from the bed, field or bench
  they were walking to (the crowding item 1 found; item 7 is its cure). They are "walking", so a
  rule for sleepers never reaches them.
- **With bodies at real size, half the time was `choose` looking through everybody alive** to find
  the people of one village: 43 million neighbours a day looked through to find somebody to ask
  for food.

**What changed.** Nothing about what happens.

- **Every person has every field from birth** (`newPerson`), empty until used: one layout. This
  alone halved a day at 5,000 and 20,000 people. **Add any new field of a person there**, not
  where it is first used.
- **Somebody with nothing to do but wait is passed over** (`wake`, at `act`): asleep, in the middle
  of a day's field work or a batch at the bench — standing where they mean to be, with a wait
  running, nothing said or struck still showing, and in a task in which nobody starts a
  conversation. The loop does not look at them until the step their wait runs out.
- **Somebody jammed is passed over until room is made near them** (`jammed`, `watchFor`, `tell`).
  Item 1 already remembers their blocked step and the failed search for a way round; while both
  stand, a step changes two counts and nothing else. They are put on a list for the ground those
  memories read, in blocks of four squares; `madeRoom` — a step taken, a death — tells the block.
- **Whoever dozes is woken before anybody else changes them** (`wakeUp`): spoken to, asked for
  food, widowed, taken along to another village. Everybody is woken on the hour, when anything may
  touch anybody (one visit in sixty). Their counts are put right as they wake, and before `advance`
  returns (`settle`), so nothing outside the engine ever reads a stale one.
- **The lists of who is on each square are kept up, not emptied and refilled** (`rebucket`,
  `shifted`, `gone`; `put`/`unput`): only somebody who crossed onto another square is moved, into
  the same place in the order.
- **Who lives in each village is a list** (`residents`), made again only after a birth, a move, a
  village changing hands, the dead leaving, or the hour — so asking a neighbour, selling a cartload
  door to door, an army's rations and what a village eats in a day no longer go through the world.
- **Asking for food looks at what a neighbour has first**, and passes by anybody who could not beat
  the best so far even as kin and a friend.
- **Two things about item 1's memory of a failed way round.** It is kept only when the search was
  *walled in* — ran out of places to look. A search that ran out of *tries* is not kept: somebody
  arriving can shut off a dead end it was wasting its 800 looks in, and the same search then gets
  through, so "nobody new can open a way" is not true of it. (None had been small enough to be
  kept under the old limit in anything measured; no world changed.) And what is kept is the ground
  the search looked at, not that ground stretched to where the walker was going: in a 2,000-person
  country on 17 km, 96,000 searches a day were run again because somebody moved between a walker
  and a bed twenty squares off, for 1,355 ways found. Now 33,000. *(A search out of tries is
  remembered after all since later the same day, until anybody there moves: below.)*

**Why some people were still visited every step.** Somebody idle and due a word with a neighbour
rolled the dice on every step to see whether they started talking. The dice are one stream;
drawing them in another order is another world. So they were visited — about one person-step in
six at 20,000. *Changed later the same day, on Ric's word: "When somebody next speaks", below.*

**The world is the same world**, step for step. `create(options, { plainWalking: true })` runs the
engine the long way round — everybody, every step, every list refilled — and
`test/dozing.test.mjs` holds the two equal hour by hour over ten kinds of world, with
`{ audit: true }` making the short cuts check themselves on every step: nobody passed over may
have been changed, every kept list must be what making it again would give. It was checked by
breaking each short cut on purpose, 22 ways: the test catches 20. The other two cannot show —
not waking the dead (they do nothing either way), and keeping a search that ran out of tries
(the case it guards is too rare to stage). The engine as it was before this item and the engine
now were also run side by side from the same seed: **a year of the default world, identical on
every one of 365 days**; a day and more of 20,000 people, a day and a half of 5,000 with bodies as drawn and at real size, and two
and a half days of 2,000 on 17 km, all with the audit on, identical every hour.

**What it bought** (Intel Xeon 2.1 GHz cloud machine, 16 GB, `test/bench.mjs`, bodies as drawn — not the M1 of the table
above: this was built in a cloud session, and its numbers are about 2.2 times the M1's):

| People | Land | A day takes, before → after | Top speed, before → after | Steps on which a person is looked at |
|---|---|---|---|---|
| 400 | 17 km | 0.92 → 0.60 s | 327× → 499× | 45% |
| 2,000 | 17 km | 8.5 → 5.6 s | 35× → 54× | 68% |
| 5,000 | 40 km | 9.1 → 3.5 s | 33× → 86× | 52% |
| 20,000 | 80 km | 46.4 → 15.5 s | 6× → 19× | 30% |
| 400 | 500 km | 0.61 → 0.28 s | 489× → 1,084× | 39% |

With bodies at real size: 5,000 people 10.9 → 3.4 s a day, 20,000 people 70 → 17 s. A year of the
default world: 368 → 173 s. Starting a world is unchanged (20,000: 4.4 → 4.3 s). Per person-step,
5,000 and 20,000 people now cost about the same (0.49 and 0.54 millionths of a second; before,
1.26 and 1.61). **On the M1 the 20,000 row should come out near 7 s a day, about 43× — worked out
from the ratio between the two machines, not measured: run `node --expose-gc test/bench.mjs` there
and put the row in `TODO.md`'s speed log.**

**What it costs.** Four small fields on a person, twenty bytes a person of tables, and a list of
watchers per block of ground while people are jammed. When time is handed over in small pieces
(the page, a frame at a time) everybody is looked at once per piece for anything done to them
from outside: at 20,000 people a day's working-out goes from about 12 to 15 seconds
when a piece is two steps, and 22 when every step is its own piece — still under the
46 it took before.

**What it did not fix, and should not hide.** Per person, a dense small land is still four times
dearer than a big one (the 2,000-on-17-km row): there the search for a way round a crowd is half
the time. People who may start a conversation are still visited every step. Asking a neighbour
for food still reads through the village, so it grows with the village, not the world. All three
are `TODO.md` 2b — done the same day, next section.

**Rules this leaves** (also in `/AGENTS.md`): anything new that changes *another* person in the
middle of a step calls `wakeUp(them)` first; anything that changes where somebody lives calls
`changedHomes()`; anything that makes room calls `madeRoom` (item 1); a new field of a person goes
in `newPerson`. Run `test/dozing.test.mjs` — the audit names what was missed.

Sources. The method — keep, for each part, the time of the next thing it will do, and go straight
to it — is next-event time advance, the ordinary way of running a discrete-event simulation
([course notes after Leemis & Park](https://huichen-cs.github.io/course/CSCI570/notes/lecture10_nes.pdf);
[Discrete-event simulation](https://en.wikipedia.org/wiki/Discrete-event_simulation)), and its use
for agents is argued in [Event-driven agent-based simulation](https://www.doi.org/10.1186/2194-3206-1-3)
("regards only those points in time when changes actually occur"). Timing wheels
([Varghese & Lauck, 1987](https://blog.acolyer.org/2015/11/23/hashed-and-hierarchical-timing-wheels/))
were looked at for holding the wake times and not used: a plain table read in the order of the
people array keeps the dice in order, which a wheel does not. Being woken by a change in somebody
else is Repast's "watcher" ([Repast4Py guide](https://jozik.github.io/goes_bing/guide/user_guide.html)).
Same result however the time is handed over: [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/).
Object layouts and why one is fast and many are slow:
[Hidden classes and inline caches in V8](https://dev.to/omriluz1/hidden-classes-and-inline-caches-in-v8-36fp).
These were found and read as search summaries; the session's network did not allow the pages
themselves to be opened, so the figures in this section are the ones measured here, not theirs.
None of their code is used.

### When somebody next speaks, and the rest of what item 2 left (2026-11-15)

`TODO.md` 2b. Ric: *"do 2b finish 2 all the way"*. Four things item 2 had measured and left.

**1. When somebody next speaks — the one change that makes a different world.** On every step on
which somebody could speak, they rolled the dice for whether they tried to, at the same odds each
step (30% at the default). So the step on which they next try is a number that can be drawn once:
how many rolls until the first that comes up (`nextTry`, kept as `tryIn` on the person and counted
down only on steps they could have spoken). Every wait is exactly as likely as it was. What
changes is which numbers come off the dice, so **a seed gives a different world from the one it
gave before this date** — the same country, another history. Nothing else about talking changed:
who can be spoken to, what is said, what it does.

Measured, because "the same in law" should be shown and not only argued: a year of the default
world, twelve seeds, under the old rule and the new. The last column is how far apart the two
are, in units of how much one seed differs from the next; with twelve seeds, anything under about
0.8 is what chance alone gives.

| A year of the default world | Old rule, mean ± one seed's spread | New rule | Apart by |
|---|---|---|---|
| People alive at the end | 379 ± 16 | 373 ± 24 | 0.3 |
| Births | 13.5 ± 3.2 | 16.1 ± 5.2 | 0.6 |
| Starved | 8.6 ± 11.8 | 14.8 ± 19.8 | 0.4 |
| Died of sickness | 14.2 ± 4.9 | 16.0 ± 4.0 | 0.4 |
| Died in battle | 10.6 ± 7.0 | 11.3 ± 9.0 | 0.1 |
| Conversations a person a day | 9.3 ± 1.1 | 9.9 ± 1.1 | 0.6 |
| Moves of house | 368 ± 104 | 327 ± 117 | 0.4 |
| Changes of flag | 109 ± 73 | 114 ± 72 | 0.1 |
| Wars | 4.5 ± 1.8 | 4.5 ± 2.0 | 0.0 |
| Share of coins held by the top tenth | 0.56 ± 0.05 | 0.55 ± 0.04 | 0.2 |
| People remembered, a person | 8.95 ± 0.20 | 8.92 ± 0.23 | 0.2 |
| Mood | 0.72 ± 0.02 | 0.71 ± 0.03 | 0.6 |
| Grown-ups' hours: asleep | 40.8% ± 2.1 | 40.0% ± 2.1 | 0.4 |
| … at a bench | 16.2% ± 3.8 | 14.3% ± 3.0 | 0.6 |
| … in the fields | 8.2% ± 0.4 | 8.5% ± 0.7 | 0.4 |
| … in conversation | 8.8% ± 1.3 | 9.6% ± 1.3 | 0.6 |

Conversation was the nearest to the line, so it was measured alone over a month in **200 seeds
each way: 8.909 conversations a person a day under the old rule, 8.914 under the new** (give or
take 0.1 either way; the middle seed 8.75 and 8.70; one seed in ten under 7.8 or over 10 in
both). Under either rule about one world in fifty goes into a trading rush in which half of
everybody is on the road with a load and talks twice as much (2 of 200 old, 4 of 200 new).

What it buys: between tries there is nothing for somebody idle to do, so they are passed over
like anybody asleep, and so is somebody jammed in a crowd who is idle. Two people in conversation
are passed over too until the first of them has finished (`untilHeard`): once the idle were, that
was one person-step in ten.

**2. A search that ran out of tries is remembered, until anybody there moves.** Item 2 stopped
remembering these, rightly: an arrival can make such a search succeed. But they were 60% of a
dense small land's time — 3,325 searches a day at 730 millionths of a second each in the
2,000-on-17-km world, run again every seven steps by somebody who had not moved, in a crowd that
had not moved either. With every body where it was, a search is the same search. So each square
also keeps the count at which somebody last *came* to stand on it (`cameAt`, `came`, beside
`roomAt`), and this kind of memory (`rm.any`) is dropped when anybody on the ground it looked at
comes, goes or dies. The search itself also stopped working out the same two square roots at
every look. Its answers are the same: 720,000 searches were run both ways side by side.

**3. The page says it has touched nobody.** `advance(seconds, true)` leaves out the look at
everybody for what was done to them from outside, and the putting-right of passed-over people's
counts afterwards. The page gives its word because it only draws people; a test or a console
leaves it off and gets both. The engine's own doors (`rule`, `order`, `orderVillage`, `declare`,
`set`) say for themselves that something was done. **After `advance(…, true)`, call
`world.settle()` before reading anybody's `wait`, `stuck`, `routeRetry`, `talk`, `tryIn` or
`sayT`.**

**4. Asking a neighbour for food** still reads through the village. No way was found to find the
best giver without reading everybody's larder that gives the same giver, short of following every
change to anybody's food. The honest fix is that nobody knows the larder of two and a half
thousand neighbours: it belongs with what a person holds in mind, and it is now part of `TODO.md`
item 11.

**The world is the same world** for 2, 3 and 4, and for 1 it is the world the new rule makes run
the long way round: `test/dozing.test.mjs`, twelve kinds of world now. The audit was made to
check what each memory actually claims — that every body on that ground is where it was, and for
a search out of tries that nobody else has come — and to search again whatever is remembered and
see that there is still no way. Broken on purpose 31 ways; it catches all 31. (It caught two real
mistakes while this was being built: a listener reading what a passed-over speaker still had to
say from a count that was behind, and a false alarm of its own.) Before the talking rule
changed, the engine with 2, 3 and the faster search was run against the engine as item 2 left it:
identical over the thirteen kinds of world, and hour by hour for 60 hours at 2,000 people, 36 at
5,000 and 26 at 20,000.

**What it bought** (Intel Xeon 2.3 GHz cloud machine, 16 GB — a different, faster cloud machine from the one in the table
above, so both columns were measured again on it; bodies as drawn, seed 7):

| People | Land | A day takes, item 2 → 2b | Top speed | Steps on which a person is looked at |
|---|---|---|---|---|
| 400 | 17 km | 0.39 → 0.32 s | 767× → 938× | 45% → 27% |
| 2,000 | 17 km | 3.8 → 3.4 s | 80× → 89× | 68% → 48% |
| 5,000 | 40 km | 2.4 → 2.6 s | 127× → 117× | 52% → 22% |
| 20,000 | 80 km | 8.6 → 5.7 s | 35× → 52× | 30% → 9% |
| 400 | 500 km | 0.19 → 0.19 s | 1,559× → 1,566× | 39% → 24% |

Handed over in pieces, at 20,000 people: before, a stretch that took 8.1 s in one piece took
8.7 s two steps at a time and 12.6 s a step at a time. Now, with the page's word, pieces of any
size cost what one piece costs (9.7, 9.7 and 9.7 s for the same stretch of the new world);
without it, 12.5 and 16.8.

**What it did not fix, and should not hide.** A dense small land is still dearer per person than
a big one. With the talking rule changed, one seed is no longer the same world before and after,
so a single row is one world against another: the 5,000 row above is slower by that and nothing else — over five seeds a day at 5,000
people took 3.4 s under either talking rule. What is left there is the search for a
way round in a crowd that is always moving, and that is the crowding itself — `TODO.md` item 7.
With bodies at real size the cost is still asking a neighbour (item 11).

Sources. Drawing the number of rolls until the first success in one go is the inverse-transform
way of sampling a geometric distribution, `1 + floor(ln U / ln(1 − p))` with U never zero
([randlib's igngeom](https://git.fossee.in/scilab_for_xcos_on_cloud/.git/tree/modules/randlib/src/c/igngeom.c);
[a worked answer](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/23517138/random-number-generator-using-geometric-distribution)).
Giving talking a dice stream of its own
([L'Ecuyer et al., streams and substreams](https://econpapers.repec.org/RePEc:inm:oropre:v:50:y:2002:i:6:p:1073-1075))
was looked at and not used: it keeps other things' dice still when talking changes, but somebody
would still have to roll every step. Read as search summaries, as above. None of their code is
used.

### Off the page's thread, no top on people, and what this computer can run (2026-11-15)

`TODO.md` item 3. Ric: *"the number of people should be infinite just based on can your computer
run it"*, and *"i want there to be a way that i can see what my limit will be because of my
computer. but if a friend has a better one i want them to be able to push those limits."*

**1. The engine has a keeper, and the keeper has its own thread.** Until now the engine ran inside
the page's drawing loop: forty milliseconds of world, then a frame. With 20,000 people that was
seven frames a second, and pressing Run froze the page for four seconds while the world was made.
`people-host.js` now holds the world, runs its clock and answers the page, and the page never
touches a person. It asks for four things and gets back plain numbers and words:

| The page asks for | and is sent |
|---|---|
| a frame — where it is looking, how closely, which colouring | who is in view (and half a screen round it): where, what colour, a byte of marks (child, hurt, sick, leader, speaking, reaping), what they carry; the lines between people talking; the few labels and sentences that are drawn; villages and factions, only when what the map shows of them has changed; the fields, every few steps and at most five times a second |
| the panel it is showing | what that tab needs: sixty rows of the People list already searched and sorted, one person, one village, the factions, the news, the talk, the world's counts |
| who is under a tap | a person or a village |
| a decision — rule, tax, arms, relief, war, peace, a live setting | that it was done, and what the other side answered |

The keeper is written with no timer and no thread of its own: it has two doors, `receive(message)`
and `run(seconds, budget)`. In a worker a small loop feeds them; where a worker cannot be had the
page keeps the very same keeper and calls `run` once a frame, in at most 40 ms, exactly as the
engine was always run; the tests call both by hand. One code path in three places. `?nothread` on
the address asks for the page's own thread, to compare.

*The same world.* The keeper hands time to the engine as `advance(seconds, true)`, in pieces of a
quarter of a second, and only reads. `test/keeper.test.mjs` runs a world through it at 1×, 16×,
250× and flat out, reading frames, every panel and a tap all the while, and holds it equal to the
engine walked to the same step alone. That test found one thing the page had always done wrong:
how much a village still has to put by for winter is worked out once an hour from its store *at
the moment it is first asked*, and the Person panel asks several times a second — so a watched
world could differ from an unwatched one. The engine's `urgency` door now puts the figure back.

*Opened as a file.* A page opened from a folder may not start a worker from a file beside it. So
the worker is started from text: `people.js` and `people-host.js` each keep the function they were
built from (`factory`), and the page writes both out again and hands that to the worker
(`keeperText` in `index.html`). Nothing is fetched, so it is the same whether the page is served
or opened from a folder; it was tried from a `file:` address in a real browser rather than assumed.
If a worker never answers, everything it was sent is given to a keeper on the page's thread.

*What it costs.* Reading 5,000 people for a frame takes the worker 0.7 ms; reading 20,000 takes
10.6 ms — most of it waiting on memory, a person being a large object. So every frame says what it
cost and the page leaves six times that before asking again (about a seventh of the worker's time
at most), and a frame asked for with nothing changed — the same view, the world on the same step,
which at 1× is every frame but five a second — is answered "same". The page draws at its own rate
whatever the world is doing: moving and zooming use the last frame with the view as it is now.

*A world never ran behind a hidden tab, and still does not:* the keeper is told to wait while the
page is hidden or paused. Leaving a world ends its thread.

**2. The land is painted a pixel a square.** With the engine gone, the page was still held up, by
its own painting: a land under about 500 squares across was drawn a square at a time, eight pixels
each, a colour spelled out as words for every one — 60 to 280 ms for an 80 km land, on every frame
at speed. It is now one small picture written straight into its pixels (about 1 ms) and stretched
onto the map as it is drawn, with the line where two factions' land meets kept as a list of edges
and drawn over it, a quarter of a square wide as it was. People are drawn a path a colour, not two
calls a person, with the dark line round each box a dark box a pixel bigger laid under it. Far
out, where a box is two or three pixels, there is no dark line: it used to swallow the colour, and
a full village showed as a black disc.

Measured in a real browser (headless Edge) on an AMD Ryzen 5 3600, 20,000 people on 80 km, clock
at Max, over the same eight seconds of each:

| | Before | After |
|---|---|---|
| Pressing Run holds the page for | 4.4 s | 14 ms (the world is there 5.4 s later; the page answers meanwhile and says "Making the world…") |
| Frames drawn a second | 7 | every one the browser offers (150 with nothing capping it) |
| Longest wait between frames | 229 ms | 25 ms |
| The world's clock moved | 0.41 of a day, about 15× | 0.99 of a day, about 37× |
| The page said it was running at | 22× | 54× at the end, having averaged 37× |

The last row is its own correction. The page used to work out "Running at N×" from what it asked
for in a frame, counting at most a tenth of a second per frame, so a world too big to keep up was
overstated. The keeper counts the time that really passed.

**3. No top on people.** The slider still sweeps to 20,000 — a convenient sweep, as the physics
sliders are — and beside it is a box where any whole number of 20 or more can be typed; a link
carries one too. `clean()` reads the top from `inputMax` (for people, none) and every other range
keeps its ends. Which village holds each square was a sixteen-bit table and is a thirty-two-bit
one, because with no top on people there is none on villages, and the old table would have run
out, silently, at the 32,768th. A world past what the computer can hold fails in its worker and
the page says so; it does not take the page with it.

What is *not* true yet: a big world is slow to start. Finding everybody a place to stand grows
with the square of the head count — 10,000 people 0.9 s, 20,000 3.7 s, 40,000 16 s — and it cannot
be done another way without people standing somewhere else, which is a different world. The page
no longer freezes while it happens, counts the seconds, and ← Settings gets out at once. `TODO.md`
item 3b.

**4. What this computer can run.** Not a table of machines, and not a guess from how many cores a
browser admits to (it caps the number, and it says nothing of how fast one is). When the settings
have been left alone for a moment, the world they describe is made on a thread of its own, out of
sight, and run for up to three seconds, and how fast it went is written under "How many people":

> On this computer: about 210× at first with these 5,000 people (a year every 9 minutes). It
> should stay above 16× up to roughly 65,000 people.

Ric chose that — a line under the slider — over a mark on the slider and a small table. It is the
same engine, seed and first hours the real world will have, so the first figure is that world's
own on this computer. Whole days are measured where there is time, because a night costs far less
than a day; and a first day that is over in under a second is not counted, because a browser runs
fresh code slowly for its first moments (before that rule, 400 people were said to run at 820× and
ran at 1,100× and more). The second sentence is plain proportion from the first. It is advice: the
box takes any number. A world not even made in twelve seconds is given up as "more than this page
can try out in a few seconds". Without a worker only worlds up to 2,000 people are tried, since
the try-out would hold the page up.

Why it could not be a rule of thumb, measured on 34 worlds of one seed: a day costs from 0.5 to
2.8 ms a person, and not more for more people — 2,000 people in eight villages cost more *each*
than 20,000, most of whom stand jammed and are passed over — and one world's second and third days
differ by up to three times.

How good it is:

| World | The line said | It ran, first days | Later |
|---|---|---|---|
| 400 people, 17 km | 1,200× | 1,600× | 2,300–2,900× from day 30 |
| 2,000 people, 17 km | 89× | 92×, 83×, 75× | 120–200× from day 4 |
| 5,000 people, 40 km | 230× | 340× | 100× from day 4, 65–75× by day 9 |
| 20,000 people, 80 km | 38× | between 18× and 49×, about 30× on the whole | |

Within about a third at the start, and out by two or three times once a world has settled or
jammed — which is the world changing, and nothing three seconds can know. So the line says "at
first", and the running world says what it is doing now. The second sentence means 16×, the
fastest clock that runs exactly as asked: Ric's choice ("Keep 16×"), over a year an hour and over
keeping up at 1× (`TODO.md`, item 3). It is one constant, `STEADY` in `index.html`.

### A big world starts in time, and the readout learns from the world (2026-11-15)

TODO item 3b. Two things: making a big world took a time that grew with the square of the crowd,
and the setup page's line only knew a world's first days.

**Making a world.** Nearly all of a big start is placing people who arrive where somebody already
stands: each searches rings outward from their spot (`actionTick`, "Initial residents") until a
point is free. Everybody must stand exactly where they stood before, so the search itself is kept,
point for point, and only work that could not change an answer is cut:

- **Only the points of a ring that could be free** (`overGround`, `lookShell`, `ringsOver`).
  The ground round a newcomer is looked over once, a shell of squares at a time as the rings reach
  it. Each piece not wholly taken (a square with few marks, or a small gap in one nearly full) is
  filed once under the first ring that reaches it and kept on a running list until the rings pass
  it. A ring with nothing on the list is passed without a look; on the others only the points
  over a listed piece are tried, in their old order.
- **Gaps that two bodies cover between them are marked** (`coveredGap`). The finer map marks a
  small square only when one body covers it all. A gap covered by two or three bodies together
  was looked over again by every newcomer near it. Each square now keeps the bodies that reach
  it, and a gap whose sixteen pieces are each within a body's width of one of them is marked:
  `free` would have turned down every point in it.
- **Full blocks are passed in one look** (`blockFull`, `lookRow`, `lookColumn`): squares
  full all over are counted by blocks of 8 × 8, and a block all full is skipped.
- **Parents for the first children** (`settle`): each child chose among the couples old enough,
  a list made afresh per child (children × couples). The couples are now sorted by the younger
  partner, so how many qualify is a binary search. The random draws are made in the same order,
  and the couple a draw names is read off a Fenwick tree (binary indexed tree, the "find the
  k-th" descent: [Grey_Matter's tutorial](https://codeforces.com/blog/entry/77616)).

Considered and not used: an exact distance transform of the free ground (Felzenszwalb and
Huttenlocher, [Distance Transforms of Sampled Functions](https://cs.brown.edu/people/pfelzens/papers/dt.pdf),
linear in the grid) gives the *nearest* free spot, but the world has always put a newcomer at the
first free point of its own rings of points, which is not always the nearest one, so a transform
would make a different world. Remembering, for each starting square, how far round it is all full
was tried and did nothing: packed ground keeps slivers between bodies, so few rings are wholly full.

Same world: whole starting worlds (every person, the villages, the stats) compared against the
engine before this change on eleven settings from 400 to 100,000 people (including one village,
three, and "settled" at 0, 0.9 and 1), all identical; and `test/walking.test.mjs` still holds a
crowd's places against the plain search. Measured with `test/bench.mjs --start` (Ryzen 5 3600):

| People, land | Before | After |
|---|---|---|
| 10,000, 56 km | 0.86 s | 0.56 s |
| 20,000, 80 km | 3.55 s | 1.52 s |
| 40,000, 113 km | 14.1 s | 3.4–3.8 s |
| 100,000, 179 km | 102.6 s | 13.3–14.9 s |

Still more than twice the time for twice the people: a newcomer starts inside the packed crowd and
the real holes between bodies have to be tried to keep the same world. A million is still a long
wait.

**What a world really did.** While a world runs on Max, the keeper (`people-host.js`) adds up the
world's time and the real time (the time owed, at most a tenth of a second a turn, so a back tab
asleep does not count as slowness; nothing while paused). After ten seconds on Max the page keeps
that speed in this browser, with the day it reached and how long the world took to start, against
the world's settings (`localStorage`, `wb-people-held`, the newest twenty). The next time those
settings are chosen the setup page says that instead of trying the world out: "Last time on this
computer, these 400 people ran at about 2,100× on Max, to day 70 …", with the 16× head count
worked from it. In a headless Edge the default world's try-out said 1,100×; on Max it held
2,100× to day 70, and the setup page then said so. With nothing kept, the try-out speaks as before.

### Land from the seed (2026-11-15)

TODO item 4a. Until now each square had two numbers from smooth noise, fertility and ore. Now the
seed makes the land the way land is made, and fertility and ore follow from it (`land()` in
`people.js`). It has its own random draws, so the same seed gives the same land whatever the
other settings.

1. **Height**, in metres: smooth noise in lumps from 300 km down to 1 km across, each as tall as
   its size (1,400 m for the biggest, 18 m for the smallest), the same method as Red Blob Games'
   [terrain from noise](https://www.redblobgames.com/maps/terrain-from-noise/). A lump wider than
   the land is only a tilt, so a 17 km land is a valley with hills, and only a land hundreds of
   kilometres across has ranges and snow. "How hilly" makes the middle sizes taller. The ground
   drops toward the edges, so a sea is a coast.
2. **Water runs downhill.** Priority-Flood (Barnes, Lehman and Mulla 2014,
   [arXiv 1511.04463](https://arxiv.org/pdf/1511.04463)) floods in from the edges, lowest first,
   with a queue of 65,536 height buckets so it takes time in step with the land. The square that
   reaches another first is where that one drains, so water always has a way out and never runs
   uphill. The **sea** is the ground a rising sea would reach from the edge, its level chosen so
   "How much sea" of the map is sea. A hollow filled more than 15 m deep (more on a land with
   thousands of metres of height in it) is a **lake**; a shallower one drains over its lip.
   **Rivers**: rain on every square, added up downstream, and a square is river where the
   ground draining through it passes an area (O'Callaghan and Mark 1984, as in
   [SAGA's flow accumulation](https://saga-gis.sourceforge.io/saga_tool_doc/9.4.1/ta_hydrology_0.html)):
   about 5 km² at the usual setting, from about 60 km² at the fewest to half a square kilometre
   at the most.
3. **Kinds of ground**, eleven, as Ric chose ("Ten plus snow and ice"): sea, lake, river,
   beach (a strip by the sea), marsh (wet, flat, low, by water), grassland, forest (wet ground,
   more with "How much forest"), hills (rising 40 m or more a kilometre), mountain (90 m a
   kilometre and high, or anything just under the snow line), dry land, and snow and ice above a
   snow line that comes down with "Distance from the equator" and "How cold winter gets": about
   2,400 m at 45° with a real winter, 900 m at 70° with a hard one (the Alps' is near 2,800 m,
   Norway's 900 to 1,500 m). Warmth and wetness stand in for Whittaker's temperature and rain;
   his biome lines are drawn by hand and differ book to book, so the kinds are set by these few
   plain rules instead.
4. **Fertility and ore from the kind**: grassland 0.8, forest 0.55, hills 0.42, dry land 0.22,
   beach 0.18, nothing on water, marsh, mountain or snow, all times 1.15; ground within a
   kilometre of a river or lake grows up to 0.2 better, most at the bank (river flats are laid
   down by floods, which is why villages sit by rivers); "How uneven it is" still spreads each
   kind's fertility either way. The 1.15 is measured, not felt: with it the ground within 2 km
   of a village grows what it did on the old land, 0.568 against 0.566 over ten seeds (0.49
   without it and the flats). Ore: mountains 0.8, hills 0.45, little elsewhere.

What people do with it, for now: villages start only on ground that can be lived on (beach,
grassland, forest, hills, dry land), spaced by that ground and not by the whole map; nobody is
placed standing in the sea or a lake (the crowd placing of item 3b treats them as full ground);
fields are only where something grows. Walking still goes straight, so people can wade a lake
on the way somewhere: going round water, and slower ground, is item 4b.

Measured: a year of the default world on seeds 11, 3, 5 and 7: 25 starved in all against 86 on
the old land, and more people alive on every seed (384, 388, 388, 403 against 383, 329, 353,
382). What the new settings move (`test/behaviour.mjs`, four days, three seeds; short and noisy,
the same settings read 3 to 10% from one run to the next): "How hilly" 7.6% of adults' hours,
"How much sea" 4.6%, "How much forest" 3.2%, "How many rivers" 2.7%.

The largest land is now 1,000 km across ("a state", Ric's choice), 4,000 squares by 2,480,
about ten million. A world on it starts in 4.5 s with 2,000 people
and 5.7 s with 20,000, and holds 640 to 750 MB. A day there costs what it does on a smaller land
(2,000 people: 2.9 s at 1,000 km, 2.4 s at 500): nothing is done for squares nobody uses.

Speed, per person, is unchanged: 2,000 people on 17 km take 3.87 s a day on the old land and
3.76 s on the new with no sea (five seeds each). With the usual 15% sea it is 4.37 s, because
the same people stand on less land and crowds cost more to walk through.

### Crossing the land (2026-11-16)

TODO item 4b. Until now people walked straight at where they were going, through lakes and the
sea and over mountains.

- **Nobody walks into the sea or a lake.** `free`, the one test of whether somebody may stand
  somewhere, says no to deep water, so walking, the crowd search and placing all keep off it.
  Somebody put in the water from outside may still walk out.
- **Rough ground is slower**, as a share of the pace on open ground (`PACE`): forest 0.6 (three
  fifths off a path: Tobler's hiking function, from Imhof's data,
  [Wikipedia](https://en.wikipedia.org/wiki/Tobler%27s_hiking_function)), hills 0.7 (Tobler at a
  10% slope), marsh 0.5 (bog is worse than brush: Soule and Goldman 1972, J. Appl. Physiol.), a
  river 0.4 (wading a ford), mountain 0.25 (Tobler at 25%, off a path), snow and ice 0.3;
  grassland, dry land and beach 1. **Except on ground a village holds**, which has paths: with a
  whole village walking its own streets at the pace of open hills, crowds round its middle
  jammed for hours (43 people stuck over 200 steps against 1, measured on the default world).
- **The way round water** (`landWay`). When the next square ahead is water, the walker plans a
  way over the 250 m squares: A* with each square costing its length over its pace, so it also
  goes round a mountain where that is quicker. The answer is kept for that pair of squares (the
  land never changes, so it is never stale), and its corners are cut where a straight line stays
  dry. This is the coarse level of hierarchical path-finding (HPA*, Botea, Müller and Schaeffer
  2004, [paper](https://webdocs.cs.ualberta.ca/%7emmueller/ps/hpastar.pdf)); the crowd search
  still does the last few metres.
- **Which ground joins which** (`landPiece`): one flood a world numbers every piece of land.
  A journey to another piece, an island or over the sea, is refused when it is set (`go`): the
  walker stays and idles instead of searching a whole land for a way that is not there. So
  villages that cannot reach each other by land neither trade nor fight by land; boats are later
  (PEOPLE-VISION, "Water as road and wall").

Measured. A year of the default world on seeds 11, 3, 5 and 7: 10 starved in all, 376 to 399
alive. Two days of 600 people on a land 60% sea: nobody in the water (on 4a's land 85 of them
were standing in it); 34 stood jammed for over 200 steps, crowds pressed against the shore, the
cost of water taking room. The quick bench against 4a: 400 people 0.30 → 0.33 s a day, 2,000
3.68 → 3.30 s, 5,000 2.62 → 2.45 s. The 1,000 km land starts in 4.3 s and holds 785 MB after a
day (the way-finding arrays are made when first needed). `test/land.test.mjs` walks somebody to
the far shore of a lake and sees them go round and arrive.

### Drawing the land (2026-11-16)

TODO item 5. Ric: "i can barely tell whats livable whats a forrest. what is a beach." The land
is now drawn so each kind of ground reads without a key (Ric named all eleven on a land he had
not seen, seed 26, without one), in the look he chose, "Map colours", over a darker, earthier
one.

- **Colour and marks.** Each kind has its own colour (`LOOKS` in `index.html`), and nearer in its
  own marks drawn from the seed, the same square the same every time: waves on water, rivers as
  lines along the way the water runs (`riverTo`, one byte a river square from the engine's
  drainage), sand grains on beaches, pools and reeds in marsh, tufts on grass, tree crowns lit on
  the sunny side in forest, curves on hills, peaks of different sizes on mountains, pebbles and
  cracks on dry land, drifts on snow. Eleven kinds is too many for colour alone, and colour-blind
  readers need more than colour (ColorBrewer's colour-blind-safe qualitative sets stop at four:
  [ColorBrewer](https://en.wikipedia.org/wiki/ColorBrewer)), so the marks carry it as well.
- **Relief.** Each square is lit by a sun in the north-west, 45° up, from the slope round it:
  Horn's gradient and the hillshade formula as ArcGIS and GDAL use them
  ([ArcGIS](https://pro.arcgis.com/en/pro-app/2.7/tool-reference/3d-analyst/how-hillshade-works.htm)),
  heights exaggerated three times; worked out once a world by the keeper (`hillShade`). Shading
  lit from the upper left is Imhof's "Swiss manner"
  ([terrain cartography](https://www.wikipedia.com/wiki/Hillshade)).
- **Three ranges of zoom.** Far out (under 3 pixels a square): the whole land as one picture,
  smoothed, with halved copies so a big land is cheap to shrink; villages and their names (a name
  that would cover another is left out); no people, who would be under a pixel. Nearer: the land
  in blocks with its marks, the faction colour and harvest as a see-through wash on top, houses
  round each village (one for about four people), and from 20 pixels a square furrows on the
  fields. Close (up to 128 pixels a square, twice the old limit): the same marks larger, and
  people. Houses are drawn, not yet things in the world: TODO item 7.
- **Only what is on screen.** A block (512 pixels, or the whole land when it fits in 2,048) is
  drawn once at the zoom's size and kept, 80 at most; at most one new block a frame, the rest of
  the view showing the plain picture for a frame or two. Houses are drawn into the blocks, and
  only the blocks round houses that changed are drawn again. Fields are kept as paths in land
  units, made again when ownership is sent. A big land's picture is repainted 600,000 squares a
  frame instead of all at once.

Measured in headless Edge, frame drawing time (script, not GPU). The default world: 0.37–0.40 ms
against 0.32–0.34 before, three runs each way, so **0.03 to 0.06 ms over** the item's budget of
"no longer than now": the wash for harvest and faction colour is now its own picture over the
land, and folding it back in would mean redrawing every mark at each repaint. A 1,000 km land:
every zoom and panning at 275 to 300 frames in three seconds (the browser's limit); the slowest
frame fell from about 150 ms (the repaint every two seconds, 119 ms before this item) to about
20 ms; a jump to a new zoom on a 200 km land holds at most 30 ms for a frame or three, instead of
570 ms.

### Houses, and people at their real size (2026-11-16)

TODO item 7a. Ric wanted to zoom in and pick out a family's house. A house was a point people
slept near, and a person kept about a hundred metres of room round them, so a person was bigger
than any house could be.

- **People are half a metre wide by default** (Ric: "Real size by default"): the "Bodies" setting
  now starts at "Real size", and the old spacing is "Spaced out". Nobody is in anybody's way.
- **A house is a building** (`homes`, `newHome`): a place, a length and width in metres and a
  facing. A village is laid out in plots spiralling out from its middle about 19 m apart, never
  on water. A house is 12 to 24 m long and 4.5 to 7 m wide, after excavated medieval peasant
  houses (Houndtor, Dartmoor: 14.2 by 4.3 m; England, France and Germany: about 15 to 23 by 4 to
  6 m); the richest household of a world gets the biggest, by rank of what it owns at the start
  (Ric: "different size of houses depending on how rich they are"). A couple shares a house and
  children live with a parent; a partner who marries in moves in. 400 people make about 275
  houses.
- **Asleep inside.** Going to bed means into the house: the last stretch inside is walked at the
  usual pace, where before anybody within 125 m of their bed had arrived.
- **Zoom down to a house**, to 4,096 pixels a square (a 15 m house about 245 pixels long). Past
  128 pixels a square the ground is drawn smooth with marks a few metres across worked out from
  the seed for the screen only (tree crowns, tufts, pebbles, reeds, ripples), rivers as a line
  15 m wide, and the houses at their true size: a roof in the faction's colour over thatch, its
  ridge along its length. From 20 pixels a square a person shrinks toward their real size, never
  under three pixels. The village's marker goes once its houses can be seen.
- **Soldiers from crafters too.** With real-size bodies farmers no longer queue in crowds, a
  field is worked faster, and fewer people farm; an army raised from farmers alone stalled short
  of what its leader asked (4 of 23 wanted 6). A leader now raises farmers first, then crafters.

Measured. A year of the default world, seeds 11, 3, 5 and 7: 16 starved in all against 10 before,
alive 376 to 392 against 376 to 399, village stores lower at the year's end (fewer farm); and a
year takes about 40 s instead of 115. `test/bench.mjs`: 400 people 0.34 → 0.12 s a day, 2,000 on
17 km 3.23 → 0.55 s (item 7's target, no dearer a person than 5,000 on 40 km, is met: 0.19 against
0.26 µs a person-step), 5,000 2.37 → 1.89 s, 400 on 500 km 0.15 → 0.05 s; **20,000 on 80 km 7.40 →
10.78 s, slower**: with nobody jammed twice as many people are doing something each step (27%
against 14%), and when a village store is empty every hungry person looks through all their
neighbours for one with grain to spare (`choose`, a quarter of the time).

### Acting on more of what is heard (2026-11-19)

TODO item 12b. Until now people acted on only two kinds of news: wars and villages taken (a
grievance) and who had food to spare. Where to move, where to go when hungry and where a trader
carried a load were chosen from every village's true store and prices, heard or not. Ric chose
which news people act on: **"Sickness", "Famine", "Prices and harvests"**; traders **"Keep it, news
adds a pull"**; a sickness at home sends **"A few, to family"**. Everything is read from the telling
a person holds, so a telling that names the wrong village sends them the wrong way.

- **Sickness.** Somebody who holds "A sickness has started in V" from the last 30 days does not move
  there, go there hungry, take food to its market, carry a load to it or look for a market there. Somebody who hears it of
  their own village, and has close family (a family tie above 0.4) in another village of their own
  side, takes their household to them one time in five, and comes back a week after the last case
  there. Early modern Italian cities turned away people and goods from places reported infected,
  checked by health passes (Bamji 2019), and Venice had its travellers report any news of
  contagion; those who could left London in 1665, and some carried it with them.
- **Famine.** "V is starving" keeps people from moving there. Somebody with food beyond their
  winter's keep and family in V takes them up to a load (`grainLoad`), given to them, or to the
  store if they have gone. Help in a famine runs along family ties (the Somali famine of 2011,
  Maxwell et al. 2016; migrants in Kagera, Tanzania, cutting their own eating for relatives at
  home; Dinka chiefs calling on a starving family's relatives first).
- **Prices and harvests.** A new piece of news, "Food is dear in V": one household in seven there
  going hungry with money to pay, not in the first month, not while it is starving, at most one a
  side every four months. A trader still sees every price within reach, but food and grain go half
  as willingly again to where they have heard food is dear, a famine, or a dry year for that side.
  Where traders cannot know prices elsewhere, prices stay far apart and food is wasted (Jensen 2007,
  Kerala's fishermen and their phones); Datini's factors at Caffa wanted to sail for Tuscany on news
  that grain had risen there.

Measured: everybody outside the biggest village (seed 13, day 60) told of a sickness there: trips
set out for it by outsiders over 30 days (to sell, trade or look for a market) 11 with no report,
1 told it is there, 9 told it is at the next village instead; trips to that next one 99, 206 and
10 (`test/heard.test.mjs`, the item's "done when"). Everybody with family in another village
(seed 11, day 200) told it is starving: 431 days of food carried there in ten days. A default year, eight seeds, before → after: starved 12 → 16 (the usual spread), died of the
sickness 115 → 109, left home for a sickness 0 → 18, food carried to family 0 → 106 days, grain
carted by traders 72 → 504 days, market food 10,766 → 12,880. Few have family in another village
in a world's first years (11 grown-ups of about 270 after a year, seed 11), so flight and help
are rare until families spread by marriage.

**Chosen, and its cost.** The news a person holds is read at most once an hour when they decide
(`rumours`, cached until anything is held or forgotten), only while some report of these kinds
is under 30 days old (120 for a dry year); which village a telling names is worked out once per
telling and kept by the engine, not on the event. Under half a percent of a mid-year day (a
profile); the bench unchanged. "Food is dear" first read households short of a fortnight's food:
that is every village at the start, and at one a village every two months it was as much news as
everything else together, crowding the rest out (the newest is what is told).

### Why wars start and end (2026-11-19)

TODO item 14c. Ric: "why a war starts and ends comes from what people and leaders hold in mind …
a new leader can end a war their predecessor began." Before this, a leader went to war on
grievance, land, hunger, greed and what they held against the other side (item 13), and made peace
when weariness (the dead a head, the years, the hungry) passed a mark set by their boldness and
temper. Who had begun the war played no part, and nor did what the people held. A place that was
taken was easily taken back the next week, because every soldier who took it marched on.

Now:

- **Who is to blame.** Each side of a war remembers whose leader it was when it began
  (`rel.began`). A leader who began it, or whose parent, child or partner did, keeps the old mark
  for peace. Any other leader's mark is 0.3 lower, and on the other side the mark for accepting is
  0.1 lower (`culpable`). This follows Croco's "culpable leader": one in office when the war began,
  or tied to the one who was, fears punishment for a bad end and fights on, while one who is not
  can accept the compromise ([APSR 2011](https://www.cambridge.org/core/journals/american-political-science-review/article/deciders-dilemma-leader-culpability-war-outcomes-and-domestic-punishment/509114969EBDD6FAC6DA9323744CDFB4)).
  A change of leader made the end of interstate wars more likely, 1816–2006
  ([Quiroz Flores et al.](https://lup.lub.lu.se/search/files/37690562/2017_11_Quiroz_Flores_Ba_ck_von_Hagen_Jamar_Teorell.pdf)).
  No rule says a new leader ends a war: a leader is replaced by death, a vote or a revolt as before,
  and only the blame differs.
- **What they hold.** The leader's own grudges and the news they hold against the other side
  (`heldAgainst`, item 13) raise the mark for peace by up to 0.15. What their people hold raises it
  too: thirty grown-ups read evenly through the list (`folk`), at 0.05, or 0.1 under a leader they
  can vote out. Never more than a leader's temper moves it: at three times that, and with the
  people's grudges adding to the wish to start a war as well, an old feud everybody held kept
  patient leaders at war as long as hot-tempered ones (`test/dealings.test.mjs`, 1,194 days against
  1,787). So what the people hold weighs on how a war ends, not on whether it starts. The dead a head were
  already in the weariness; casualties are what turn people against a war, through the news of them
  ([Fetzer et al., AJPS 2025](https://repec.cepr.org/repec/cpr/ceprdp/DP16102.pdf)).
- **Holding what was taken.** Half of the soldiers who took a place stay as its garrison for a year
  (`v.heldTo`), as the English held Normandy town by town
  ([Curry](https://eprints.soton.ac.uk/388591/1/Curry_1906.indd.pdf)).

Measured. Two years each, eight default worlds and six forced wars (600 people, 40 km, three
factions), before → after:

| | Default worlds | Forced wars |
|---|---|---|
| Wars ended | 14 → 26 | 4 → 3 |
| Places changing hands | 59 → 35 | 131 → 65 |
| — taken back within 90 days | 23 → 9 | 57 → 20 |
| Starved | 123 → 89 | 125 → 90 |
| Killed in battle | 193 → 170 | 101 → 94 |
| Houses burned | 547 → 469 | 1,334 → 780 |

How often a war ended, per thousand days of it, all fourteen worlds together: under the leaders on
both sides who began it 0.12 → 0.22; once either side had a new leader 2.2 → 4.9. Wars mostly last
over a year, so even before this most ended under somebody new (16 of 18); now a new leader ends
one over twenty times as readily as the one who began it. Cost: thirty minds read once a day for
each pair of neighbouring factions; the bench is unchanged. Test: `test/war.test.mjs`, "Why wars end".

### Peace by marriage, trade deals and tribute (2026-11-19)

TODO item 14d, item 13's leftovers. Before this, peace came from weariness or a new leader and never
from a marriage; a trade deal formed between nearly any two neighbours at peace who liked each other
(in force for 93% of neighbouring pairs at peace, six default worlds, a year); and tribute was a
flat 0.3% of the stores and 1% of the treasury a day, about two thirds of the stores a year,
whoever paid whom.

- **Peace by marriage.** On the day a leader would choose war, one more patient and warm than
  hot-tempered may offer a marriage instead (never a leader of middling nature, up to six times in
  ten the most patient and warmest); and a leader whose war is nearly weary enough for peace may end
  it with one. The other side's leader takes it as they are warm and the bad blood is less. Who
  marries: the leader's youngest free grown child, else a brother or sister, else the leader, else
  the richest free grown-up of the faction, "one of its great families" (Ric: leaders are well off,
  and people married within their standing). The one who is not a leader goes to live on the other
  side. The tie holds while the two are alive and together; while it holds, a leader's wish for war
  against the other side counts half, not nothing; a death or a parting ends it, and it is told. A
  war begun while it holds is a marriage that failed. Kinship between rulers made wars rarer and
  shorter, and the death of the relative who tied them made them likelier again (Benzell and Cooke,
  "A Network of Thrones", AEJ: Applied 2021, https://www.aeaweb.org/research/familial-ties-network-thrones );
  Erasmus: a marriage can make a peace but not make it last. The Treaty of Perpetual Peace (1502)
  married James IV to Margaret Tudor and did not prevent Flodden (1513).
- **Trade deals need trade, both ways.** Every sale by one faction's people in another's village
  (food sold door to door or to the store, goods, wood, stone) adds to a running sum that falls by
  1% a day (about the last hundred days). A deal needs each side's people to have sold half a day's
  food for each of the smaller side's people in the other's villages, and lapses below half that,
  unless the two are old friends. The Hanse's treaties mostly confirmed privileges its merchants
  already used (https://www.historytoday.com/archive/feature/hanseatic-league-europes-first-common-market).
- **Tribute is an agreed amount.** The side taking it is r times as strong (its soldiers and a
  share of its grown-ups, and half its allies'; after a war, times the square root of how many more
  the payer lost). It would win a war with chance r / (1 + r) (a Tullock contest), and the two agree
  on that less an even half, as a share of a year's stores between 5% and 45%: twice as strong, a
  sixth; three times, a quarter. It is paid a little each day, from that day's stores, and from the
  treasury at the same rate as before against the stores. A settlement both sides prefer to the cost
  of a war: Fearon, "Rationalist Explanations for War" (1995), https://www.doi.org/10.1017/S0020818300033324 .

Measured: trade deals in force for 92 of 273 neighbouring pair-months at peace in six default
worlds over a year (34%, from 93%); in twelve worlds of two old enemies over two years, three
marriages: one ended a year's war, one kept two peoples from war for the two years, and one
failed within four months. Leaders have no grown children at the start, so the first marriages
come from the great families. Cost: a sum per sale; a search through the people only on the day a
marriage is made. Not done: everyday marriages still ignore wealth (TODO 15b). (The page's button
for a marriage came with TODO 15.5h: "Wartime gear, and a marriage of your choosing".)

### Treasuries that can pay: the harvest tax (2026-11-21)

TODO item 15.5t, found by 15.5b2. A ledger of every coin in and out of the treasuries (default world,
seed 11, 120 days) showed why every treasury was empty: the only tax was on sales through a village
store, and most food never passes through one — a farming household eats what it grows. Even at its
top of 60%, reached by day 90 of peace, it brought in about half the soldiers' wages. Ric: leaders
"can tax what they want lol just like real life", the share moved "By the leader's traits".

- **A tax on the harvest** ("Tax on the harvest at the start", default a tenth; none means none,
  ever, and then the world is the one before). A share of everything reaped goes into the village
  store as **the faction's grain** (`v.levy`, days of food). States of the past took most of what they
  took from the land, in kind where little money ran: the tithe was the tenth sheaf, lamb and cheese
  ([*Leges Edwardis Confessoris*](https://sourcebooks.web.fordham.edu/source/1115Ledwtith.html);
  [Tax in kind](https://en.wikipedia.org/wiki/Tax_in_kind)), the land tax the "backbone" of Byzantine
  revenue, and in kind because coin was scarce ([Slantchev, "Revenue"](https://pages.ucsd.edu/~bslantchev/courses/ps143a/05%20Revenue.pdf)).
- **What it pays for.** The faction's grain sold from the store pays the treasury, not the till (its
  share of every sale of food, in proportion); a soldier the treasury cannot pay in coin is paid a
  day's food from it; soldiers going on campaign are fed from it first, for nothing; and so is
  relief for those who cannot pay (added after the measurements below, found reading the diff:
  the treasury had been paying the till for its own grain). Its grain
  is never more than the store holds. (Owed to the treasury as coin instead, it was never paid: by
  day 300 every till was empty, all 4,200 coins in the world were in people's purses, and the stores
  held 18,700 days of food nobody needed to buy. Measured.)
- **The leader decides it once a year, as the reaping begins**: a chest (`f.chest`) of a year's
  soldiers' wages, more by as much as they are greedier than warm (up to a year and a half), less
  what is in hand — coins, and the faction's grain at what the store pays for it — over what the
  fields gave since the last reaping; at most half. (Moved a point a day, it rose to half the harvest
  in winter, with nothing to reap; a warm leader content with a quarter of a year's wages could not
  pay their own army by spring; and grain counted at a coin a day, when year-old grain sold at a
  third of that, made leaders think themselves rich. All measured.) The coins in that chest are not
  "spare" for the daily rule that sends a treasury's spare coins back to the tills.
- **Felt by those who pay it**: a farmer's loyalty falls with the share as everybody's does with the
  tax on sales. A leader may take half the harvest; their people answer as they would.
- **A faction you rule** has "Tax on every harvest" beside "Tax on every sale"; the faction list
  shows both.

**Measured, a year each, six seeds, against the engine before (15.5b2).** The default world: tax on
sales, the year's mean, 0.49–0.55 → 0.14–0.33; days a treasury held less than a coin 61–85% →
14–34%; loyalty 0.62–0.66 → 0.76–0.89; soldiers kept 6–8 → 8.5–9.5; starved 0 in five seeds either
way, 9 → 10 in the sixth. **The price of it: the leaders took 26–38% of the harvest**, to keep
eight in every hundred under arms. Rome kept about one in a hundred and took perhaps a twentieth of
output (Duncan-Jones: the army 60–80% of the empire's spending; pre-modern states commonly 5–7% of
output, Song China 12–15%, [Economics of the Roman army](https://en.wikipedia.org/wiki/Economics_of_the_Roman_army);
[Warwick CAGE](https://warwick.ac.uk/fac/soc/economics/research/centres/cage/news/podcasts/ma-east.pdf)).
So the share is what that army costs, not a number tuned; the start's 8% under arms is a setting.
The treasuries still run short before the harvest in some years, when the fighting season (14e)
nearly doubles the army each autumn. A starting city (as 15.5b2): it ended with 140–305 people
against 172–404, starved 2 against 10 in all six, tax 0.17–0.29 against 0.50–0.56, grain carted in
103–1,826 days against 0–388; it empties by people moving out, and few stay hungry long enough for
a public order (0–475 days bought). `test/treasury.test.mjs`; with no harvest tax, `rivers` and
`wartime` hold the world as it was.

### The government's grain (2026-11-21)

TODO item 15.5b2, the second of four parts of 15.5b. Before this a leader's only help to the hungry
was relief bought from their own village's store, which did nothing once that store was empty; and
a carrier took grain only where the households going short could pay for it. So a poor city was
never sent grain, however full its leader's treasury. Ric: the way it reaches people should have
"options based on the type of ruler there is"; hard leaders force hoarders to sell; laying grain in
ahead "Both, by traits".

- **A public order for grain.** Once a day a leader may set coins from the treasury aside in a
  village of theirs going short — as many hungry as the engine already calls "food is dear", a
  sixth of its people. (Households short of a fortnight's food are most of any village most of
  the year; an order on that tied every treasury up in every village, measured.) The coins stay on
  the village, so none is made or lost. A carrier of any people, by cart or boat, sees them as
  buyers there, as it sees the households' purses; after selling door to door, what is left goes
  into the store, paid from them. Florence did this in the famine of 1328–30: grain fetched from
  Sicily, 60,000 florins from the city's purse, sold at what the poor could pay
  ([Giovanni Villani](https://en.wikipedia.org/wiki/Giovanni_Villani);
  [Nanni 2019](https://flore.unifi.it/retrieve/e398c37f-4b86-179a-e053-3705fe0a4cff/Nanni%202019_Facing%20the%20Crisis%20in%20Medieval%20Florence.pdf)).
- **How much, from the leader's stats** (`ruling`, so an elected leader leans to the people): of
  what the treasury holds beyond three weeks' soldiers' wages, a share of warmth times
  (1 − greed). Spending into the wages made the tax rule raise the tax to its top in a hungry city
  within two months, measured, so the wages come first.
- **How it reaches people.** In a village under an order, a household's next days of food from the
  store are a ration: the treasury pays as much of the price as the leader is warmer than greedy —
  nothing (the greedy sell at the store's price), cheaper, or all of it, a dole like Rome's
  ([Cura annonae](https://en.wikipedia.org/wiki/Cura_annonae)). Only the next days, not a
  winter's laying-in. Relief for those who cannot pay is as it was.
- **Hoarders made to sell.** A bold leader (over the middle) makes households holding more than
  their winter's store, in a village going short, sell the rest to the store at a fair price —
  what each would ask a neighbour, not the store's price in a dearth, which is pinned at its top
  and emptied the treasury in a month, measured — paid from the till, then the treasury. England's
  Books of Orders (1587, reissued in every dearth to the 1640s) had juries count each holder's grain
  and justices send it to market ([Slack](https://core-prod.cambridgecore.org/core/journals/transactions-of-the-royal-historical-society/article/books-of-orders-the-making-of-english-social-policy-15771631/77CAFBCE3647464DE4F0BD606B14B0CD)).
  The engine's `hard` trait is hard-working, so "hard" here is `bold`. Those made to sell hold it
  against the leader as a tax on that grain would weigh (`p.forced`, half forgotten in a season).
- **Laying in.** A patient leader (over the middle) also orders grain into the store in the three
  months after the reaping, up to 60 days a head for the most patient — the hungry months before
  the next harvest — as China's "ever-normal" granaries did
  ([Britannica](https://www.britannica.com/topic/ever-normal-granary)). It comes only from what
  households hold above their own winter, as any trader's does.

Nothing makes a city that cannot be fed live: where nobody within reach has grain to spare, no
order is filled. `test/grain.test.mjs` holds the order and that no coin is made or lost, the
greedy leader who makes none, the bold leader's forced sale (and the timid one's none), the
ration's share, and laying in by a patient leader only.

**Measured, a year each, old against new, six seeds each.** A starting city (2,000 people on
30 km, half of them in one city): the city ended with 172–404 people against 178–315 before (mean
246 against 258), starved 10 against 23 in all six; grain bought on public orders 0–89 days' food
in a year; hoarders made to sell 37–1,332. The default world: starved 0 in five seeds either way,
9 in one new; forced sales 0–170, public grain 0–19. Bench (`--quick`, two runs each way): within
this machine's drift (400 people 0.15 against 0.17 s a day; 5,000 2.12–2.33 against 2.12–2.13).

**So the city still fails, and not because of the land.** The public order is almost never
funded: in every world measured, old and new, the tax rises to its top of 0.6 within about three
months of peace and the treasury still sits near nothing, because the taxed trade does not cover
the soldiers' wages (default world, seed 11: four factions of about 100, 4 to 9 soldiers, tax 0.60
and treasury 0 to 95 by day 90). The city empties as before, its people moving out rather than
starving. That is its own piece of work, written into the TODO as 15.5t; with money in the
treasury the order works (the test).

### Rivers that run one way, and grain by boat (2026-11-21)

TODO item 15.5b1, the first of four parts of 15.5b. Ric: "Boats should be pretty important for
travel because it makes it easy but then the question goes of which way the rivers travel".

- **A river runs one way.** The way each river square drains was already worked out when the land
  is made (`riverTo`); a boat now uses it. With the current a boat goes at its full pace, across it
  at two thirds, and against it at a third. Upstream, boats were towed from the bank by people or
  horses, about 15 to 20 km a day (Neckar: about 20 km in five hours of hauling,
  [Wikipedia](https://en.wikipedia.org/wiki/Chain_boat_navigation_on_the_Neckar); Roman Rhine and
  Tiber about 15 to 20, [Viabundus](https://www.landesgeschichte.uni-goettingen.de/roads/viabundus/?p=939)),
  and downstream they drifted or sailed, two or three times as fast — a thin source for the downstream
  figure, said here so it is not mistaken for a measured one. A way over water is now the quickest,
  not the fewest squares, so the way down a river is not the way back.
- **Boats follow a river round its corners and past its fords and bridges.** Until then a boat moved
  only side to side between squares, so a river that ran corner to corner, as half of them do, had
  no way along it; and a ford or a bridge cut a river into pieces no boat could pass.
- **A landing can be on a big river**, not only a lake or the sea. Until then no river village could
  ever have a boat.
- **Grain by the boatload.** A village's boat carries ten carts of grain. A cart took half a tonne
  to a tonne (Langdon: "a ton was a very respectable load for horse-hauled transport"); boats on the
  Thames carried 60 to 200 quarters, about 13 to 45 tonnes ([London and Thames estuary
  study](https://archaeologydataservice.ac.uk/catalogue/adsdata/arch-3427-1/dissemination/pdf/general_guide.pdf));
  a village's own boat, fifteen person-days to build, is the small end. A grain trader at home whose
  village has a boat loads a boatload where the boat takes less time a ration than a cart — so a
  slow pull upriver can still lose to the road — and a village that would send grain better by water
  wants a boat, as people who want to cross water do (6d). River carriage cost about half what
  carting did in medieval England (Masschaele, *EcHR* 1993); here that saving is the time a ration takes.

Measured: the default world, which has no big river, is the same world (`test/rivers.test.mjs`).
On the longest big river of a 60 km land, a boat takes 1.9 hours down and 5.3 back up. **In a year
of three river worlds (60 km, 1,500 people, 16 villages) no village built a boat**, before or after:
few villages stand on water a boat can use (two to five of sixteen), and grain moved between
villages only 0 to 101 days' food in a year, and no village came to want a boat the three times it
takes to build one (how often it came close was not counted). So this part
changes nothing yet in an ordinary world. It is the transport the next parts stand on: a leader
buying grain from far off (15.5b2), and villages that grow where water is (the vision's "Water as
the reason places are where they are"). `test/rivers.test.mjs` holds the way down and up, the
corners and fords, and that a trader takes a boatload only with their village's boat.

### Wartime gear, and a marriage of your choosing (2026-11-21)

TODO item 15.5h, two things items 13 and 14 left out.

**Gear for a war is paid for or given.** Ric: it "must be payed for or donated. Nothings free".
In history the English crown bought arms in bulk — about 1.23 million arrows 1341–59 — by orders
spread over ordinary fletchers and outside suppliers, and paid for them (Richardson's thesis on the
Tower's armouries, [White Rose eTheses](https://etheses.whiterose.ac.uk/3919/1/Thom_Richardson_thesis_final.pdf);
[De Re Militari](https://deremilitari.org/?p=2105)). So:

- A soldier at war who needs a weapon or a shield mended or made takes it first from what the
  people have **given** for the war, then has the **treasury buy** it from the village store, as
  rations are already bought (`provision`). What the store has not got is left as an order (15.5a),
  and crafters make it as they make anything asked for. At peace a soldier still pays from their
  own wages, as before.
- At war, a **loyal** grown-up (loyalty over 0.6) who has more goods than the one they keep gives
  the rest, when they next shop, to their village for the soldiers' gear.
- A world with wars off is exactly the world it was (`test/wartime.test.mjs`).

Measured, four wars of 300 people, 120 days each, old against new: soldiers with a weapon and a
shield 90–97% against 92–97% (they were already armed out of their wages); the treasury bought 11
to 24 goods' worth of gear in each, the people gave 10 to 23 and 7 or 8 of it was used; battle
deaths 0–1 against 0–4. Treasuries in a long war end empty either way: wages drain them.

**A marriage of your choosing.** Ric: "The marriage button is for me so I should have ultimate
power." On the Factions tab, for a people you rule, each neighbour has **Arrange a marriage**: type
or pick any grown-up of yours and any of theirs (the leader and their family listed first, then the
unmarried), and they are married — 14d's marriage as it is, binding the two peoples, without the
other side's leave. Somebody already married leaves their partner on their own. Family cannot marry,
and a child cannot be chosen. At war, the marriage ends the war, as 14d's marriages to end a war do.
The news says it was on your word; it does not call a farmer "of one of the great families", which
is 14d's wording for its own choice, the richest.

### Made to order (2026-11-20)

TODO item 15.5a. A village store held hundreds of goods that nobody ever used: a crafter sold
everything past one good to the store, the store's price sat at its floor, and the bench still
paid, so crafters kept working. Measured on the default world over a year before the change: seed 1
made 30,103 goods and took 2,723 out of the store, seed 2 made 38,461 and took 1,217; the stores
ended the year at 38 and 54 goods a head, with about 15,000 more in crafters' own hands, unsold
because the till could not pay for them.

Ric's answers: households using goods up, **no** ("adding that will have little return for how
much that cost to track"); crafters make to order, **yes**; and when nobody wants what crafters
make, "What do people do in real life?" They took other work: one trade often did not feed a
family, and people combined trades, took day labour and went where work was (the TODO's research
notes, with sources). `choose` already weighs every living for everybody, so nothing new was
needed for that half.

- **An order** is left by somebody who wants goods the store cannot supply: a household with less
  than a sixth of a good and the coins for one, a worker whose tool, pack, weapon, shield or cart
  needs fitting or mending, and a house waiting on goods (with "One kind of goods"). Each person
  holds one order at a time, the largest they have wanted, at one village; it is filled when they
  buy, dropped when they die, and given up after sixty days. A village's `wanted` is the sum of
  its people's orders (`test/orders.test.mjs` adds them up).
- **A season's stock.** The store also keeps about what was taken from it lately: `used`, a running
  sum of goods taken out that falls by e⁻¹ in ninety days. That is the shop keeping what it sells
  in a season, not a cap: nothing is thrown away, and salvage from the dead can still put more on
  the shelf.
- **What a crafter can sell** is the orders plus that stock, less what is on the shelf, and no more
  than the till can pay for. A batch is made only up to that, plus one in hand; the bench is worth
  only the part of a batch that is asked for, shared between the village's crafters, so with
  nothing asked for it is worth nothing and people do something else. A house a household pays a
  builder for is an order too: a builder's wage keeps a crafter while there is one to build.
- **The price of goods** is dear while orders wait and cheap while the shelf holds more than a
  season's use: 2 at a full season's stock, between 0.6 and 9 as before.
- **Goods are carried only where they are asked for** and can be paid for. Without that, a village
  with orders waiting looked dear, and carriers took packs there that its empty till could not
  buy, and kept them: 20 to 37 goods each by autumn.
- **Households start owning goods**, of every age (a sixth to one good each, spread by id, so the
  world's dice fall as before). Everybody starting with nothing sent every household to the store in
  the first hours, and the orders it left set a season's stock several times what a village used.
- **A levy calls up any trade**, farmers and crafters first. It took only those two, and once
  crafters were few the faction in `test/rule.test.mjs` had taken to mining to a man and its army
  stalled at 3 of 25.
- **A rumour of sickness keeps people from going to load there**, not only from carrying there
  (12b's gap, found by `test/heard.test.mjs` once trade moved: hunters of other peoples kept going
  to the village named to pick up a load for somewhere else).
- The village panel shows **On order** beside Goods.

Measured, the default world over a year, after: seed 1 made 496 and took out 165, seed 2 made 577
and took out 177 (the rest is in households' hands, about 0.7 a head); the stores ended the year at
0.14 and 0.16 goods a head, about a season and a half of what was taken. Making goods fell from 4–7%
of grown-ups' hours to about 1%, and hardly anybody keeps "crafter" as a trade in an ordinary year:
the goods are made in spare hours by people who farm, herd and hunt, as Ric's answer expected. The
hours went to herding, hunting and rest. Over four seeds, a year each, old against new: 1,556 →
1,601 alive, 88 → 98 born, 7 → 3 starved, 37 → 0 dead of cold (crafters had been burning the wood
the fires needed: a batch takes wood), 8 → 15 in battle, 7 → 12 houses built, and the richest
tenth's share of the money 0.82–0.90 → 0.61–0.73. A winter with little put by (`stored` 0.2, five
seeds, thirty days) had a twentieth of the hungry hours.

Found on the way: the engine already had a function named `askFor` (asking a neighbour for food),
and the first version of this one had the same name; the later declaration won, and every order
asked a village for food instead. It was renamed `placeOrder` before anything was measured for
this section.

Cost: a few sums per purchase and per sale, and one pass over the houses being built per village
an hour, which was already made for materials. `test/bench.mjs --quick`, two runs each, old then
new: 2,000 people 0.89/0.85 → 0.84/0.84 s a day, 5,000 2.63/2.53 → 2.51/2.65; the 400-person row
read 0.16/0.13 → 0.18/0.19, but ten days of that world timed alone read 0.170/0.163 → 0.159/0.150
s a day, and none of the new code is in its profile — the row is noise at 0.03 s.

### Faster, the same world; and children past 3,000 people (2026-11-20)

TODO item 15.25. Ric asked for the performance audit's five passes and, separately, for births
past 3,000 ("Idk why births stop they shouldn't"). Every speed pass had to give the identical
world: each was checked by hashing the whole world (every person, every mind, villages,
factions, events with who told whom, conversations with their receipts, stores and holders)
after every day, old engine against new, in nine worlds: an ordinary country with orders given
from the page (ruling, war, tax, peace), 2,000 on 17 km, a town, two old enemies at war for 40
days, 150 days through winter, 400 on 500 km, 5,000 on 40 km, 20,000 on 80 km, and
conversations kept light. All nine were the same, hash for hash, before the births change.

**Measured first** (CPU profiles, seed 7): at 5,000 people the step itself (`act`) is a fifth of
the time and conversations another fifth, half of that the receipts; at 20,000 the land search
(`landWay`) is 15% and the crowd search (`routeAround`) 9%.

1. **Conversation receipts** (`converse`). What each of the two was before is kept as numbers in
   two rows used again and again, made into the receipt only once something has been said, and
   what each is after is read off them and compared directly instead of building a second
   receipt. The receipts and effects are field for field what they were. The rolling list of 160
   exchanges drops its oldest with `shift` rather than cutting a new array.
2. **The two searches.** The land search keeps its queue in typed arrays between searches; the
   crowd search keeps its places, costs, "does a body fit here" answers and nodes in fixed
   arrays (a table of 16,384 rows emptied by moving on a round number; an 800-look search reaches
   at most 6,401 places), in place of two new `Map`s and an object a place. Same order, same
   ties, same ways. A 20,000-person day: the crowd search 2.9 → 1.6 s, the land search
   0.99 → 0.90 s (timed by wrapping them). `Math.hypot` is kept: it is not the same number as
   `Math.sqrt(x² + y²)` (35% of whole-number pairs differ in the last place), and a different
   estimate breaks ties differently.
3. **Only waking whoever is due.** Measured, not built: passing over the sleepers is one look at a
   number each; an extra empty pass over 5,000 people cost about 5% of a day, a tighter loop
   gave no measurable change over three alternated runs, and an ordered list of who wakes when
   would have to be kept in the person order the engine depends on. Left as it is.
4. **The land sent to the page** (`people-host.js`, `index.html`). The keeper remembers what it
   last sent, and once the page holds a whole land it sends only the 64-square blocks whose
   crops or holders have changed; a square's crop is only worked out again when the engine's
   number for it has changed. The page writes them into its copy and paints only those blocks
   (and the halved copies round them); it paints the whole land again only when the colours
   change (a village changing sides, a faction's colour), not every time the villages are sent,
   as it did. An update the page did not take is answered at the next ask with the whole land.
   400 people on 500 km: 21 → 11 ms to prepare, 12.4 MB → a few KB sent. In the browser (headless
   Edge, a small land, a big one and a phone-width window), the picture painted block by block
   was checked against the same land painted whole every five seconds of Max: the same, value
   for value, including the halved copies. (Before the canvas is first read back, a few
   see-through wash pixels differ by one: the browser keeps a canvas premultiplied by its
   alpha, and the specification warns that reading it back is lossy; once read, never again.)
5. **Searches of everybody.** None was hot except: every search of a village's houses went
   through every house in the land (now each village keeps its own, in the same order); a
   village founding a new one looked through everybody for each family's children (now once);
   the census read the ten traits through a list of names (now by name: 0.15 → 0.11 s a day at
   20,000).

**Births past 3,000.** `reflect` had `people.length < 3000` among the conditions for a child: a
world started bigger never had one. Gone; age, a partner at home, food, crowding and the
Children setting still decide, and Children at nought still means none
(`test/births.test.mjs`). This changes every world that reaches 3,000, and its cost is the extra
people, not the engine (speed log).

**A bug the audit found.** With births at 3,300 people the engine's own audit stopped: somebody
passed over as listening was left standing after the one speaking to them had been drawn into
talk with somebody else. The old engine did it too, with no births (two seeds in five at 3,300,
and two old enemies of 300 on their sixth day): passing people over was not, there, the same
world as visiting everybody. `said` now wakes whoever either speaker was talking to before. Worlds
where it happened differ from before from that hour on, and are now the same as with everybody
visited every step (`test/dozing.test.mjs`, "left listening").

Sources: Brown, R. (1988), "Calendar queues: a fast O(1) priority queue implementation for the
simulation event set problem", *CACM* 31(10) ([abstract](https://www.maths.tcd.ie/~eoin/index/brown_calendar88.html))
— the event-scheduling idea weighed and not needed for pass 3; Amit Patel's
[A* implementation notes](https://theory.stanford.edu/~amitp/GameProgramming/ImplementationNotes.html)
(an array heap, inserting again rather than changing a priority, as both searches already did);
MDN, [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
(a buffer handed over belongs to the other side, so the keeper keeps its own copy of what it
sent) and [`putImageData`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData)
(painting a dirty rectangle of a kept image); on premultiplied alpha,
[Mozilla bug 389366](https://bugzilla.mozilla.org/show_bug.cgi?id=389366).

### Each people's ways, by its own nature (2026-11-20)

TODO item 15a, the groundwork for government (15c), faith (15g) and marriage (15b). Ric: "the
most influential people what morals and stats they have should decide … sometimes those
decisions change their stats if their young enough or the thing that happened was a big enough
deal." Before this every faction began from the same ten sliders, every event moved everybody by
the same amount whatever their age, and an elected leader's nature was simply pulled toward the
middle.

- **A faction's own nature.** Under Their nature the setup page has a tab for All and one a
  faction. All is the ten sliders as before. A faction's tab shows the same ten, starting from
  All; moving one sets that faction apart, and moving it back drops it. The link carries it as
  `own=2.temper=0.9,…` (the faction, the slider, the value). "How much they differ" stays one for
  the world. A world nobody sets apart starts person for person as it did
  (`test/ways.test.mjs` keeps the old engine's fingerprint), and setting one faction apart
  leaves every other faction's people exactly as they were.
- **Customs come from the stats of whoever has the say.** Nothing new is tuned. What a faction
  does was already decided from its leader's nature: a chief or the richest by their own, which
  is how a grasping people's chief comes to keep the land for themselves (five of six seeds, none
  for a content people). A leader the people can vote out was half their own nature and half
  "ordinary"; the other half is now **the people's own**: their grown-ups' average, counted
  with the census every six hours. So a hot-tempered people's elected leader acts
  hot-tempered (Ric: "Lean to the people"). Every trait a leader's decision reads (bold, warm,
  greedy, honest, patient, hot-tempered) goes through this. People copy those they admire and
  follow ([Henrich and Gil-White 2001](https://pubmed.ncbi.nlm.nih.gov/11384884/)), but a people's
  values change mostly as one generation replaces another (Inglehart): here a people's customs
  move only as its people move or are replaced — events, deaths, a new leader, a revolution,
  children who take after their parents. 15c adds the council and great families who share the say.
- **An event moves the young more, and a bigger one more.** How much a hard event moves somebody
  is one minus how stable personality is at their age: 0.31 in childhood, 0.54 at college age,
  0.64 at thirty, 0.74 from fifty ([Roberts and DelVecchio 2000](https://stafforini.com/works/roberts-2000-rankorder-consistency-personality/)),
  over its value at thirty, so a thirty-year-old moves as everybody did before. Nothing before
  six: war left no measurable mark on children younger than that, and only a muted one on older
  adults ([Bauer, Cassar, Chytilová and Henrich 2014](https://coevolution.fas.harvard.edu/publications/wars-enduring-effects-development-egalitarian-motivations)).
  So a six-year-old moves 1.9 times as much as before, a twelve-year-old 1.6, a sixty-year-old
  0.72: a child two to two and a half times as much as the old. *Size* is plain proportion, since
  no study found gives a dose curve (the meta-analysis of life events,
  [Bühler et al. 2023](https://boris.unibe.ch/185539), tested none): a parent lost counts twice
  any other death; a house burned in a raid is a raid of its own for the household; every week
  without food after the third day is another famine; a war lost is felt by the whole people.
- **A war lost** (Ric: "A war lost"). At a peace, the side that lost more places than it took, or
  that pays for it, is shaken as a raid, all of it, times one plus the share of its places it
  lost; a faction that falls has lost everything (twice). No study found separates losing from
  living through a war, so the raid's own changes are used. Counted in `stats().warsLost`.

**Measured.** A year of the default world, eight seeds (1–7, 11), before and after: 11 starved
both times; people 3,143 → 3,151; wars 28 → 29; raids 86 → 79; quarrels 1,087 → 882 and fights
632 → 497; killed in battle 7 → 22 (a handful a world, so noisy). Average traits at the year's end
moved by no more than a few hundredths. Checked on the page: the tabs, a link that carries one
faction's nature, moving a slider back to All, fewer factions than an open tab, a phone-width
window, and a world started from such a link.

### Walls, sieges, raids and the fighting season (2026-11-20)

TODO item 14e. Before this a side at war tripled its soldiers in three months, to about a quarter
of its people, and kept them under arms the whole year; an army went for one place of each enemy at
a time and nothing else; no village had a wall; and weariness grew with the dead, the years and the
hungry, never with who was winning.

- **The fighting season.** Soldiers were farmers: feudal service ran forty days a year, and a
  campaign was fought between sowing and harvest. At war, in spring and summer before the crop is
  ripe, a side calls up to a fifth of its grown-ups (`WAR_ERA.campaign`), at about 2% a day; from
  harvest to the end of winter it keeps only a few (`WAR_ERA.standing`, 4%) and the rest go home.
  The army marches only in season; garrisons in places taken stay all year.
- **Raids.** Besides the army, every fifteen days a side picks the open enemy village within thirty
  squares that has the most food and people for the fewest defenders (never the army's own target)
  and sends a band of one soldier in five at it for five days. A band burns houses (a third of a
  house for each raider, against a tenth for an army), spoils crops and carries off stores, and wins
  against a village's grown-ups alone if it outnumbers its soldiers and the place has under half a
  wall. It does not take the place. Raiding the countryside, not besieging it, was most of medieval
  war: the chevauchée (https://en.wikipedia.org/wiki/John_of_Gaunt%27s_chevauch%C3%A9e_of_1373 ),
  the Border reivers (https://www.historic-uk.com/HistoryUK/HistoryofScotland/The-Border-Reivers/ ),
  the people of France in the Hundred Years War
  (https://www.medievalists.net/2009/12/the-experience-of-civilian-populations-during-the-hundred-years-war-in-france-1330-1440/ ).
- **Walls.** A village raises a wall in wartime when danger has come near (enemies at its edge in
  the last sixty days, or a raid on it in the last year) and nobody is attacking it that day, as
  towns raised murage to build theirs (https://gatehouse-gazetteer.info/murage/mur/441.html ). It
  takes about thirty days and its stone (else spare wood, else goods): ten and half a unit for each
  person. A full wall doubles a village's defence (`WAR_ERA.wallWorth`) and adds twenty days to a
  siege (`WAR_ERA.wallHold`); a place taken keeps half its wall; at peace a wall falls back over
  four years. A siege could take months (Kenilworth, 1266, about six;
  https://www.english-heritage.org.uk/learn/story-of-england/medieval/siege-warfare/ ); these are a
  village's walls, not a castle's, and set higher they stopped every place being taken at all.
- **Who is winning.** Each side counts the places it has lost and taken and the crop spoiled on its
  land in this war. Places lost add to its weariness (more for a small people), places taken take a
  little off, and spoiled fields add as much as a fifth of a year's food would. A side that has lost
  places to an enemy that has lost none, and is a little past its mark, yields: peace, with tribute
  more often than not. Between equals it comes to nothing, so even wars still run long, as they do
  (Bennett and Stam, "The Duration of Interstate Wars", APSR 1996).

All of these are numbers in `WAR_ERA` at the top of `people.js`, so item 15 can set them for each
age (all year, no season and walls worth little for a modern army). The page draws a grey ring round
a village with at least a quarter of a wall.

Measured. Forced wars (600 people, three tribes, one declares on another, thirteen seeds, two
years), the 14d engine against this one: soldiers 30–46 all year → about 25–30 in season and about
10 out of it; places taken 50 → 7; starved 304 → 88; raids burned houses without any siege in 9 of
13 worlds; wars ended within two years 13 → 11. Wars where one side took places ended on days 368,
420 and 499; even ones mostly on days 600–708, and two not in two years. A default year, eight
worlds: starved 48 → 21, alive 2,997 → 3,139, killed in battle 109 → 8, places taken 16 → 2,
houses burned 244 → 50 (36 of them by bands), 54 walls raised, peace made 4 → 0 times within the
year (wars are fought less hard, so they tire later). Not done: a wall costs materials, not
people's hours; bands carry off stores only where there are any, and in these runs there were none
to take. Test: `test/walls.test.mjs` (slow, about eight minutes).

### What a war leaves (2026-11-19)

TODO item 14b. Ric: "i want the aftermath of war to be accurate too." Before this the dead already
left heirs, grief and orphans who were taken in (`die`, the census), a widowed partner grieved, and
a place taken changed hands with some of its people fleeing for good (`capture`). But an army did
nothing to the land it stood on, and nobody ran from one until the moment a place fell.

Now, once a day, for each village with enemy soldiers at its edge (counted already for the siege,
in `villageTurn`):

- **Crops spoiled** (`ravage`). Each enemy soldier spoils a share of the standing crop on its
  square and the eight round it: 10% a day while it is green (trampled and cut, slowly), up to 60%
  when it stands ripe (burned). Grain burns only in a short window, ripe and dry (Thorne, on
  Hanson's *Warfare and Agriculture in Classical Greece*:
  [GRBS](https://grbs.library.duke.edu/index.php/grbs/article/download/1861/3491/0)).
- **Houses burned** (`burnHouse`). While the enemy has the upper hand there by the siege's own
  measure (more of them than its soldiers and the quarter of its grown-ups who take up arms), a
  house burns for about every ten of them a day, the outermost first. Its household loses half the
  food it had in it, which goes into the soldiers' packs, as raiders fed themselves on what they
  took ([the chevauchée](https://historyskills.com/classroom/year-8/chevauchee)). They sleep in the
  ruin and build it again by item 7b's building, from nothing. The page draws it as a charred floor
  until somebody starts on it.
- **A place taken is sacked** (`sack`): half its store taken or spoiled, a quarter of its houses burned.
- **Running, and coming home** (`flee`, `comeHome`). While a place is under siege, households run,
  the frightened and the less bold first, about a quarter a day, to the nearest village of their own
  faction with no enemy at it; soldiers and the leader stay. A week after the last enemy left its
  edge they come home, if it is still their own side's. A village everybody fled stands empty for
  them rather than dying out. People fled to walls and towns
  ([Jean de Venette, and the civilians of the Hundred Years War](https://www.medievalists.net/2009/12/the-experience-of-civilian-populations-during-the-hundred-years-war-in-france-1330-1440/)).

No deaths are added by rule. Most of a war's dead were of hunger and disease, not battle (the
Thirty Years' War: [germanhistorydocs.org](https://germanhistorydocs.org/en/from-the-reformations-to-the-thirty-years-war-1500-1648/estimated-casualties-during-the-thirty-years-war),
[Outram](https://eprints.whiterose.ac.uk/id/eprint/385/1/outramq1.pdf)). Here they come from the
spoiled crop, the store taken and the crowding of refugees. How long the land takes to recover is
not a number either: the Harrying of the North left about 60% of Yorkshire waste in Domesday twenty
years on ([Wikipedia](https://EN.wikipedia.com/wiki/Harrying_of_the_North)); here recovery is
houses rebuilt by their households and fields that grow back as they always do.

Tried first, and changed: houses burned and households ran whenever more enemy soldiers than the
place's own stood at its edge. In a default year (eight seeds) that starved 89 against 47 and let
households leave at the first raider. Now it is the siege's measure for both.

Measured. Forced wars (600 people, 40 km, three factions, 0 and 1 at war from day 1; wars on
everywhere, so the third may fight too), six seeds, two years:

| | Wars off | War, before | War, now |
|---|---|---|---|
| Harvest in year two (days of food, a world) | 212,000 | 170,000 | 167,000 |
| Births in year two (six worlds) | 175 | 113 | 111 |
| Children under two in factions 0 and 1 at the end | 235 | 117 | 139 |
| Starved (six worlds, two years) | 3 | 61 | 125 |
| Villages taken | 0 | 222 | 131 |
| Houses burned | 0 | 0 | 1,334 |

A war thinned the next harvest by about a fifth and the next year's births by over a third before
this item too, from the dead and the hands taken; now it also burns, spoils and empties places.
A default year (eight seeds, at war about half of it), before → now: starved 47 → 72, villages taken
11 → 25, killed in battle 113 → 122, births 147 → 151, harvest the same (919,000 → 924,000 days of
food); 395 houses burned, 391 people fled and 38 came home within the year (most wars there do not
end inside a year). Villages are taken twice as often because a place whose crop is spoiled goes
hungry and its people leave for food, so it falls: switching off each part in turn (fleeing, the
sack, the plunder, the spoiling) left 22–31 taken in every case, and switching all off gave the old
worlds exactly. Cost: only villages with enemies at them do any work; the bench is unchanged.
Test: `test/war.test.mjs`, "What a war leaves".

### Wartime effort, not only fear (2026-11-19)

TODO item 14a. Ric: "wartime fear should be bad but that should also make people do stuff as well
like try harder for more supplies and stuff". Until now a war anywhere raised `p.fear` for everybody
in the faction, however far off, until it was full; fear only ever counted against work, so a
faction at war sat at home and grew poorer. Measured on forced wars (600 people, 40 km, three
factions, two at war for 60 days, six seeds): grown-ups of the two sides at war who were nowhere
near the fighting were afraid 96% of their hours and at work 23% of them, against 51% in the
faction at peace.

Now the two are apart:

- **Danger near is fear** (`live`). A siege on the village they live in; enemy soldiers at its
  edge (`v.foes`, counted each day with the siege); a raid on it in the last three days; a blow
  just taken. It empties the fields, closes the market and keeps people in, as before, but only
  there.
- **A war on is effort** (`urgency`). Everybody grown in a faction at war wants to provide up to a
  fifth more (the loyal most: `0.6 + 0.4 × loyal` of it), wants rest up to 12% less, and their
  village aims for a store a quarter bigger than the winter alone asks — a store against a siege.
  The army raised, the levy taken from the farms and the leader's tax to pay it already grow in a
  war (items before), so its cost is hands away and what is taken, not idleness.

Why: a medieval war burned a band 20–40 km wide along an army's march, and people in its path fled
to walls while those away from it saw little ([John of Gaunt's chevauchée of 1373](https://EN.wikipedia.com/wiki/John_of_Gaunt%27s_chevauch%C3%A9e_of_1373);
[the chevauchée](https://historyskills.com/classroom/year-8/chevauchee)); towns asked for murage to
mend walls when the enemy was near ([murage](https://www.wikipedia.org/wiki/Murage)); and a nation
at war grew more at home — Britain 1939–45, vegetables up about 55%, potatoes about 80%
([history.co.uk](https://www.history.co.uk/article/how-brits-utilised-allotments-during-two-world-wars-the-era-of-growing-your-own)).
Walls raised in wartime are item 14c.

Measured, the same forced wars, old engine and new:

| | Old | New |
|---|---|---|
| At war, away from the fighting: hours at work | 23% | 51% |
| — afraid | 96% | 5% |
| Enemies at the door: hours at work | 28% | 28% |
| — afraid | 86% | 92% |
| The faction at peace: hours at work | 51% | 51% |
| Food held by the two sides at war after 60 days (six worlds) | 28,700 | 39,100 |

So a faction at war, away from the fighting, now works as hard as one at peace while it also fields
a bigger army, and stores a third more than it did; a place with enemies at its door still works
about half as much. A default world is at war about half its first year, so this reaches it too: a
year, eight seeds, old → new, starved 116 → 47, alive at the end 2,822 → 3,017, killed in battle
176 → 113, villages taken 19 → 11, births 122 → 147. Cost: whether a faction is at war is worked out once an hour (`atWarAnywhere`, kept off the faction so reading it changes nothing visible) instead
of looked up through every faction at every choice; nothing per person.
Test: `test/war.test.mjs`, "Fear where the danger is".

### Leaders and factions that deal with each other (2026-11-18)

TODO item 13. Ric decided nothing up front. Until now factions either left each other alone or
went to war, and a leader was the boldest person with the most friends.

- **How the factions start** (a new setting under War: old friends, strangers, old enemies).
  Old friends start allied, and trading free of tax if there is money. Old enemies start with a
  feud: an old wrong (a village burned, fields taken, herds stolen) that every grown-up "grew up
  knowing", held as long as a grudge (half gone in five years) and passed to their children.
  Between the factions there is now an old **bond** as well as today's opinion: the opinion
  drifts toward it, and it fades by half in about ten years. A war's dead deepen it.
- **A new preset, "Two old enemies"**: two factions, old enemies, a coin a head. Ric's "two
  tribes that hate each other with almost no money", from the setup page alone.
- **Short of war.** A leader who wants something of a weaker neighbour may demand tribute
  instead of fighting: the more patient the leader, the likelier. The other side pays if it is
  outmatched and its leader is neither bold nor hot-tempered enough to refuse. Tribute is a
  share of its stores and treasury each day, carried to the nearest village of the other side,
  and resented; it stops when the payer feels strong enough. A refusal is an insult, and the
  threatened side keeps more soldiers. A war lost can end in tribute.
  **Alliances** form against a common enemy or between old friends; warm leaders make them.
  When an ally is attacked, its allies are called: each comes as its leader is bold and as it
  likes the attacked, or the alliance is over. **Trade deals**: no tax on each other's people,
  between neighbours who think well enough of each other; honest leaders make them.
- **What a leader does depends on who they are.** A hot temper makes a leader quicker to war and
  slower to make peace, a patient one the opposite and readier to demand tribute instead, and
  what the leader holds in mind counts: grudges against the other side's people (less any close
  friend there), and news of wars, villages taken and old feuds between the two sides, as the
  leader holds it. A leader who can be voted out shows half their own nature, a chief or the
  richest all of it. At the middle of both traits it is what it was before.
- **Who becomes leader.** The bold and the well supported as before, and now also those known
  for being generous, honest and hardworking. In a vote, people want somebody bold in a war or
  under threat, and somebody honest otherwise. A people who vote and have mostly turned on their
  leader (loyalty under 30%) call a vote early, at most once a year.
- **On the page.** The faction list says who is allied, friendly, wary or hostile, who trades
  free of tax and who pays tribute. Ruling a faction, you can offer an alliance or a trade deal,
  demand tribute and stop paying it; the other side answers as its own leader would. A feud on
  the person panel reads "Grew up knowing", and its trail ends "grew up knowing it".
- **Fixed on the way.** A feud did not last: the thousands of sales and friendly words between
  two neighbouring factions every day lifted what they thought of each other from −0.6 to +1
  within a year, and old enemies became allies. Now an old feud is all but deaf to everyday
  goodwill, an old friendship to everyday ill will, and traders do not carry goods to a people
  theirs is hostile to. And liking alone no longer makes an alliance: everyday talk leaves most
  neighbours liking each other, and with that every faction in a default world was allied to
  every other within a year and nobody fought.

Sources.
- Who leads in small societies: dominance and prestige both: physical strength and kin support,
  and generosity, skill and trustworthiness (von Rueden et al. 2008, 2014, the Tsimane of
  Bolivia; [2014 paper](https://www.gurven.anth.ucsb.edu/sites/secure.lsit.ucsb.edu.anth.d7_gurven/files/sitefiles/papers/vonruedenetal2014hn.pdf)).
- How they are removed: ridicule, disobedience, desertion and in the end the end of their
  leadership (Boehm 1993, "reverse dominance hierarchy";
  [paper](https://www.Gwern.net/doc/sociology/intrasexual-aggression/1993-boehm.pdf)).
- Why neighbours keep the peace: trade, intermarriage and shared ceremonies (the Upper Xingu
  peace system; Fry and others, [review](https://pmc.ncbi.nlm.nih.gov/articles/PMC4250129));
  tribute as a cost weighed against the cost of war.
- A leader's own nature in war: measurable traits of leaders predict how warlike their states
  are, more so where nobody can check them (Horowitz, Stam and Ellis, *Why Leaders Fight*, 2015;
  [summary](https://cambridgeblog.org/2016/03/what-motivates-leaders-to-go-to-war/)).

Measured.
- *Hot-tempered against patient* (two old-enemy factions of 150, chiefs, a year and a half, six
  seeds each, every leader of both factions set the same): hot-tempered, 5 wars, 1,790 days at
  war, 32 killed in battle, no tribute demanded; patient, 2 wars, 426 days, 8 killed, 2 demands,
  one paid.
- *Old enemies* (the preset): after 150 days every grown-up still held the feud and the factions
  still thought −0.63 of each other.
- *Old friends* (three factions, a year): allied and trading free of tax throughout, no war.
- *A default world* (sixteen seeds, a year, against the world just before): 364 alive against
  359, 10 starved against 12, 20 killed in battle against 22, 4.4 wars against 5.3; and now each
  world-year 1.6 alliances, 6 trade deals, 2.4 demands for tribute, 0.7 paid.
- *Speed* (`test/bench.mjs`, alternated twice): the same, every row (5,000 people 3.10 and 3.06
  s a day before, 3.16 and 3.09 after; the machine was loaded throughout, so slower than item
  12's figures).

### Talking as passing what you hold (2026-11-18)

TODO item 12. Until now news was an event's number: everybody on its side, or within 6 km, knew
it within hours, and chats passed on the newest. Now talking passes what people hold, and what
they hold can be wrong. Ric chose: a tale changes in the telling **"1 in 20"** times; gossip **"Yes,
cools only"**; children start with **"a mix of both"** (decided earlier).

- **Seeing and hearing.** Only those within 3 km of where something happened see it. Everybody
  else hears it from somebody: in a chat, whoever holds the newer news tells it, and the hearer
  believes it as far as they trust the teller (60% for a stranger, more for a friend or family,
  as little as 30% for somebody they dislike). What is said is what the hearer then holds, word
  for word.
- **Changed in the telling.** Each time it is passed on, there is a 1 in 20 chance (the "How often
  a tale changes in the telling" slider, never to 1 in 3) that it comes out changed: a number
  grows, or a harvest's share shrinks (sharpening), or a village or a side is swapped for another
  (assimilation; Allport and Postman 1947). The changed telling then travels as the true one did,
  so two villages can believe different things about the same event.
- **Acting on it, right or wrong.** News of a war or a village taken that names your side and
  another is a grievance against the other side as told: a wrong telling blames the wrong side.
  Somebody turned away when hungry is told where there is food ("Try Hesk, they had plenty") and
  goes to ask, whether or not Hesk still has it.
- **Gossip** (one chat in four between grown-ups, when nothing else came up). The teller says what
  they think of somebody they feel strongly about; the hearer moves toward it as far as they
  trust the teller. Bad words cool, but hearsay never makes an enemy (no lower than the snub of
  being turned away); good words warm a little and never talk anybody out of a grudge of their
  own.
- **Children** start with a weaker copy of up to four of each parent's strongest things: the
  parent's news, a larder they know of, and their feelings about others (a fifth to a third as
  strong; a parent's grudge no deeper than a snub).
- **Following it.** Every hearing is kept on the event, who told whom and when, for a year (up to
  400 an event). The person panel lists each piece of news with who told them, and opens to the
  whole trail back to whoever saw it, marking any telling where it changed. In a default world,
  news of a famine reached a village three away in four days, through nine people.
- **Also fixed on the way:** a full mind could forget the news it had heard a moment before, when
  the hearer then greeted the teller; what was taken in this hour is now never the first to go.

Sources.
- How rumours change as they are retold: leveling, sharpening and assimilation (Allport and
  Postman, *The Psychology of Rumor*, 1947; summary at
  [Wikipedia, Rumor](https://en.wikipedia.org/wiki/Rumor)). Field studies find much less
  distortion than the laboratory chains, and rumours in organisations mostly accurate (DiFonzo
  and Bordia, *Rumor Psychology*, 2007; [RIT summary](https://www.rit.edu/news/truth-about-rumors-and-why-we-believe-them)),
  hence 1 in 20.
- Spreading between people: the Daley–Kendall model of ignorants, spreaders and stiflers (1965;
  [overview](https://www.emergentmind.com/topics/daley-kendall-rumor-model)). Here a person
  passes the newest thing they hold to whoever they meet who has not heard it, and stops when
  they forget it.
- Gossip is what people pass on best (Mesoudi, Whiten and Dunbar 2006,
  [abstract](https://research-portal.st-andrews.ac.uk/en/publications/a-bias-for-social-information-in-human-cultural-transmission/)).
- Children taking on their parents' conflicts: beliefs about conflict correlate strongly between
  parents and children ([Psihologija 2021](https://doaj.org/article/6f74e2ee67174a7e8b9d2729a97ae7af)).

Measured.
- *A year, twenty-four worlds, against the world just before item 12*: 362 alive a world
  against 355, 11 starved against 13: being told where food is fed people no worse. Grudges 1.6
  an adult against 1.2, and fights 66 a world-year against 55, from children taking on their
  parents' (no deeper than a snub, but a fight deepens them).
- *News over distance* (four seeds, 120 days): the farthest village each event reached was 36 to
  54 km away, 1.5 to 4 days after it happened; in three of the four worlds two villages believed
  different tellings of the same event.
- *Speed* (`test/bench.mjs`, two runs each, against the world before item 12): 400 people 0.15 →
  0.15 s a day, 2,000 0.70 → 0.71, 5,000 2.09 → 2.28, 20,000 16.4 → 15.1, 400 on 500 km 0.20 →
  0.16. The 5,000 row, alternated four more times alone: 1.92 → 1.84 (the bench drifts 10%).
- *Memory*: 0.15 KB a person more right after a world is made (who told them, and which telling,
  for every slot); 0.27 KB more by day 120 (5,000 people: 4.42 against 4.15 KB), the record of
  who told whom.
- *Settings felt*: the decisions check now reads six seeds, not four; with four, "How much it
  grows" read 2.8% where ten other seeds read 4.1%.

### The mind: a fixed number of things a person holds (2026-11-17)

TODO item 11. A person had a list of up to ten friends and grudges, one piece of news and one
number for what they think about sharing. Ric: "a person can hold a certain number of bits of
information". He chose **20** things by default; people differing **"A little"**; and **"Grudges
last longest"**.

- **Slots.** Each person holds a fixed number of things (the "How much a person can hold" slider,
  6 to 60, 20 by default; it was "How many people they remember", 10). Each is one of: a feeling
  about somebody (a friend, or below nothing a grudge), the same about family, a piece of news, a
  larder they have seen with food to spare, a debt for food given them, and what they think about
  sharing (always held: what was `views`). A slot is a kind, who or what it is about, how strong,
  and when it was last refreshed. A full mind forgets its weakest thing to make room; a grudge or
  a family tie counts double there, so a soldier who calls twenty people close friends does not
  forget first the one man he hates.
- **People differ a little.** Each holds the number set, a quarter either way, taken after the
  parents (`p.mcap`), drawn from a random stream of its own.
- **Fading.** Nothing is worked out as time passes: how much is left of a thing is read off its
  age whenever it is read, halving over its kind's half-life. A friendship not kept up, a year;
  family and grudges, five years; a debt, five; news, a season; a larder seen, a month.
- **Decisions read the mind.**
  - *Asking for food* goes to somebody they know of: a larder they have seen with food to spare,
    by how much, or family and friends whose larders they have not seen, as worth a try; another
    village only for coin and only somebody seen to have plenty. Before, it was whoever in the
    village had most put by, read off every neighbour's larder, which nobody could know. Larders
    are seen by talking with somebody and by asking at the door.
  - *A debt is paid back*: somebody who owes the asker for food gives more readily, and the debt
    is then gone. Food given, in a hungry chat or at the door, is owed.
  - *A grudge* turns a chat cold: a cold word, and nothing warms between them. Until now every
    chat warmed any two people, and a grudge in a village of sixty was gone in a year of passing
    the time of day. The hot-tempered still go to have it out, now at most once a month at an
    ordinary patience (weekly, while grudges did not last, made a feud of every grudge: ten times
    the fights); half the quarrels that stay words leave things better.
  - Friends, family, news and belief are read from the mind wherever they were read before:
    visiting, moving house, voting, leaders, the friends of the battle dead, mood.
- **Storage.** Every mind is a block in four flat arrays shared by the world (kind, about,
  strength, when), not an object of its own; the dead give their block to the next born.
- **The person panel** lists what somebody holds, strongest first, in plain words, with how long
  ago: "Holds a grudge against Corl — 2 years ago", "Hesk had food to spare", "Heard: …".

Sources.
- How many people a person keeps track of, and in layers: about 5 closest, 15, 50 and 150
  (Dunbar 1993; Zhou et al. 2005). Twenty slots hold the inner two layers and a few things known.
- How ties fade: emotional closeness falls without contact, friendships much faster than family
  (Roberts and Dunbar 2011). Forgetting follows a falling curve with age (Ebbinghaus; Wixted
  2004); halving at a fixed rate is the simplest such curve.
- Bad things weigh more and are remembered longer than good ones (Baumeister et al. 2001), hence
  a grudge counting double when something must be forgotten.
- Fixed-size storage: struct of arrays, as data-oriented engines lay out many small records, so
  nothing is allocated per person and nothing need be copied or scanned beyond one person's block.

- **Five close at most** (2026-11-18). Ric, on friendships piling up: "do 5". Nobody is close
  (above half) to more than five people, family and partner among them, the closest layer in the
  studies. One more, and whoever of them is least close drops back to an ordinary friend.
  Twelve worlds a year, against the mind without it: 358 alive a world against 356, 15 starved
  against 18; close ties 3.1 an adult on average against 5.0, the most anybody had 5 against
  16 to 18. Fights rose, 313 a world-year against 220: the slots friends gave up hold grudges a
  little longer (5.1 an adult against 4.6). It saves no memory: minds stay full (20.4 slots used
  of 21), with grudges, news, larders seen and debts in the room. A smaller mind does not help
  either: at 12 things, people keep under two close ties, crowded out by the rest.
- **Turned away is not an enemy** (2026-11-18). Ric, on five grudges an adult: "fix the
  grudges". Nearly all of them came from being refused food: some 100,000 refusals a world-year,
  each a little bad feeling kept as long as a grudge. A refusal still cools things, so the
  hungry try somebody else next time, but on its own never below −0.3, short of the −0.35 at
  which people have it out or turn a chat cold. Enemies come from fights, theft, killing and
  bitter argument. Twelve worlds a year, against five-close alone: 357 alive against 358, 14
  starved against 15; grudges 1.1 an adult against 5.1 (half of adults hold none; 5% hold five
  or more, against 50%); 83 quarrels and 51 fights a world-year against 536 and 313. The chance
  a fight kills set again from the medieval rate (one in about 600 fights; about one killing in
  4,000 people a year). Tried and dropped: cooling only when the other had food to spare (42
  starved), and remembering who had none so as not to ask again (40): the hungry did worse
  without being pushed on to somebody new.

Measured.
- *A year, twelve worlds* (the same twelve seeds as item 10), against item 10: 356 alive a world
  against 359, 18 starved against 19: asking only those one knows of fed people no worse. People
  move house more, 248 moves a world against 168, with friendships fading when not kept up. With
  grudges lasting, about 360 quarrels and 220 fights a world-year (140 and 87 before), and the
  chance a fight kills set again from the medieval rate: one killing in about 4,400 people a year.
- *First tries, and what they taught*: with every chat warming any two people, a grudge of −0.9
  was a friendship of +1 two years later; then a soldier with twenty-two "close" friends forgot
  the one man he hated first, as the weakest thing he held; then, with grudges kept for years and
  the hot-tempered having it out weekly, ten times item 10's quarrels.
- *Hours* (`test/behaviour.mjs`, "How much a person can hold" 20 against 40): 2.0% of an adult's
  hours over four days, 2.8% over sixty.
- *Speed* (`test/bench.mjs`, two runs each, against item 10): 400 people 0.13 → 0.13 s a day,
  2,000 0.67 → 0.68, 5,000 2.08 → 1.92 (asking no longer reads every neighbour's larder), 20,000
  16.2 → 16.3, 400 on 500 km 0.14 → 0.14.
- *Memory*: in a world that has run a few days, less than before (5,000 people, the whole world:
  3.42 against 4.13 KB a person on day 3, 4.00 against 4.69 on day 30), the friends lists having
  grown and the minds not. Right after a world is made, which is what the bench's column reads,
  more: 0.80 → 1.29 KB a person by the bench (2.61 against 2.44 KB for the whole world), since the
  minds are there from the start.

### The ten traits, and what happens moving them (2026-11-17)

TODO item 10. People had five traits (bold, warm, greedy, stubborn, loyal), set at birth and never
moved by anything. Ric chose: a hard event changes a person **"A little"**; what people are like at
the start is **"Ten sliders"**; and a fight between neighbours kills **"Rarely, as in history"**.

- **Five more traits**: patient, hot-tempered, hardworking, curious and honest, each 0 to 1, drawn
  like the first five about the slider's middle by "How much they differ", and taken after the
  parents with the same stray. They are drawn from a random stream of their own, so each person's
  bold, warm, greedy and stubborn come out exactly as before (`test/traits.test.mjs` holds them).
- **What each changes**, every one a choice in `choose` and at its middle the old choice:
  - *Hardworking*: the wish to earn when nothing forces it is ×0.7 to ×1.3, and resting and
    visiting weigh 0.1 more for the idle and 0.1 less for the keen.
  - *Curious*: work outside their trade counts ×0.6 to ×0.84 against ×1.35 at their own (0.72 for
    everybody before); moving to another village and scouting a market weigh up to 0.15 more.
  - *Patient*: a household keeps back for the winter ×0.6 to ×1.4 of what it did (so sells less
    to the store and at market), and while the larder is short of the winter the patient weigh
    the fields, fishing, herding and hunting up to 0.25 higher and the impatient lower. They wait
    longer before having it out with somebody.
  - *Hot-tempered*: somebody who cannot stand a neighbour (feeling below −0.35) goes to have it
    out with them, at most once a week at an ordinary patience (once a month since item 11). Words, or between two tempers
    blows (a chance of 1.2 × their mean temper squared): bruises, both thinking worse of each
    other, and one fight in a thousand kills (one in 2,500 since item 11, when grudges began to
    last and fights grew to some 220 a world-year). The family of somebody killed holds it against the
    killer. Hot temper also counts toward soldiering and patrolling.
  - *Honest*: somebody hungry with nothing to pay with may steal from a neighbour's house with a
    fortnight put by, best by night, a third of what is over ten days (at most three days' food),
    at most every three days; weighed at (1 − honest)² × 2 of asking, and not at all above 0.7.
    Seen (most likely if they are home and awake), it is held against the thief. The old theft of
    another faction's grain by the starving and bold is now 0.6 × (1 − honest), 0.3 as before at
    the middle.
- **What happens moves them** (`shaken`), each a few hundredths of the range; half of it wears off,
  half again every two years (`settle`, every six hours), and half stays. Children start from what
  their parents have become.
  - *A raid* (enemies striking in the village, after a month without; a siege is one raid):
    temper +0.04, warm +0.02, patient −0.02, bold +0.01.
  - *Three days without food*: greedy +0.03, patient +0.03, honest −0.02, warm −0.02.
  - *A death in the family* (not of old age): bold −0.02, temper +0.02; a killing in battle or a
    fight, temper +0.03 more.
  - *Robbed and seeing it*: warm −0.02.
  - *A year without want or raids*: warm +0.01, temper −0.01, greedy −0.01, curious +0.01.
  Loyalty is not moved this way: it already follows how life goes, every six hours.
- **Settings.** A new group, "Their nature", with a slider for each of the ten (the stubborn and
  loyal sliders moved there, unchanged) and "How much they differ". The person panel shows all ten.

Sources.
- How much is inherited: about 40% of the differences between people in personality (Vukasović
  and Bratko 2015, a meta-analysis of twin studies; Polderman et al. 2015 find about half for
  human traits in general). The engine keeps its old rule, the parents' mean and a stray.
- Which traits decide which choices: honesty-humility predicts cheating and stealing when it
  pays (Hilbig and Zettler 2009; Ashton and Lee's HEXACO); conscientiousness effort at work;
  openness moving away (Jokela 2009) and changing work; trait anger aggression when provoked
  (Bettencourt et al. 2006).
- How events change people: small changes, partly lasting (Bleidorn, Hopwood and Lucas 2018;
  Jeronimus et al. 2014 on bad events and neuroticism). War: people exposed to violence cooperate
  more within their own group (Bauer et al. 2016) and in Burundi became more impatient and more
  ready to take risks (Voors et al. 2012). Hard times make people more careful for life
  (Malmendier and Nagel 2011).
- Killing: about 20 to 25 a year in 100,000 in 13th- and 14th-century England, one in about
  4,000 (Given 1977; Eisner 2003). Measured over twelve world-years at ordinary tempers, about 83
  fights a year among some 350 people, which with one fight in a thousand killing is one in about
  4,200.

Measured.
- *A year, twelve worlds* (seeds 11, 3, 5, 4, 2, 7, 13, 17, 19, 23, 29, 31), against the engine
  before item 10: 359 alive a world against 352, 19 starved against 15 (a single world swings by
  more than that from run to run), 16 dead in battle against 24. Each world-year about 140
  quarrels, 87 fights, 11 raids and 340 larders robbed; no killing in the twelve (about one was
  to be expected). Tempers rise over a year of war, to about 0.56 on average from 0.5.
- *First tries, and what they taught*: counting every day of fighting at a village as a raid
  pushed tempers to 0.97 in a year; letting the hungry steal from anybody with a day's food over,
  and as readily as they asked, took 13,000 larders a world-year and spread hunger from house to
  house (39 starved a world); patience first raised the wish to earn in general, which sent the
  patient to the bench instead of the fields.
- *Hours* (`test/behaviour.mjs`, four days, three seeds, each slider at 0.25 against 0.5): greedy
  7.7%, curious 7.3%, hardworking 6.7%, bold 6.1%, warm 5.7%, hot-tempered 5.3%, stubborn 4.6%,
  loyal 4.5%, patient 4.4%, a reseed 12.6%. Honest 0.0% in four spring days, since nobody is
  hungry; over 200 days 0.8%, and in a hungry winter 26 larders robbed in two worlds against 2
  (`test/traits.test.mjs`).
- *A raid* (`test/traits.test.mjs`): the same village a month on, raided against not, is quicker
  to anger by about 0.04, warmer to its own by 0.02 and less patient by 0.02, half of it set to
  wear off.
- *Speed* (`test/bench.mjs`, two runs each, against before): 400 people 0.13 → 0.13 s a day,
  2,000 0.66 → 0.66, 5,000 1.98 → 2.06 (+4%), 400 on 500 km 0.19 → 0.14; **20,000 on 80 km 14.6 →
  16.0 (+9%), over the 5% budget**: the time is the old search for a neighbour with food to spare
  (`choose`, "ask"), with more people short at that moment in that world, not the new code; item 11
  replaces that search. Calling `settle` for everybody every six hours had cost 8% at 5,000 by
  itself, though hardly anybody had anything to wear off; it is now called only for those who do. Memory at 5,000 people 3.4 → 4.1 MB, 0.67 → 0.80 KB a person: five
  traits, and what of the last hard times is still to wear off, when to look for a quarrel, when last
  stolen, the last lean year.

### Wood, stone, ore, herds and game (2026-11-17)

TODO item 9. There was farming, fishing, one kind of "goods" and a figure for the ore under a
village. Ric chose materials "Few and clear", and firewood "Yes, as a setting".

- **Wood, stone and ore** (9a). Cutting wood in a forest, quarrying in hills or mountains and mining
  where the ground has ore, within 4 km, are ways to spend a day weighed beside the fields and the
  bench. A day at good ground is a load: about a cord of wood (a woodcutter cut and split a cord a
  day), a cubic metre or so of rough stone, some hundreds of kilograms of ore, less where the ore is
  poor. A forest square holds sixty loads and grows twenty back a year (managed woodland, 3 to 5 m³ a
  hectare a year); stone and ore do not run out. The load is sold to the village store at what the
  store pays, which is dear when the village wants more than it holds: houses being built, what
  crafters work, gear. Houses take loads of wood or stone where they took goods; a crafter's batch is
  bigger with wood and ore in the store, and uses them; a tool or a weapon takes ore, a cart wood.
  Traders carry each from where it is cheap to where it is dear. Woodcutter and miner are trades
  people take up as they take up any other.
- **Herds and game** (9b). Herding on grassland, dry land and hills that no household holds: about
  forty days of food a square a year in milk, cheese and meat (herders lived some 2 to 10 to the km²
  where farmers lived 20 to 60), a day with the herd up to two days' food, with wool and a hide now
  and then. Hunting in the forest: about eight days of meat a square a year (a tenth of a person to
  the km² for hunters alone), a good day two and a half days' food and a hide, and hunted hard the
  game is gone for years. Both less in the cold. Wool goes into what crafters make and into packs,
  hides into shields where wood is short.
- **Firewood** (9c, a setting). In the cold a village burns wood from its store, about
  three-quarters of a load a person over a winter, more in a hard one; the store wants a winter's
  worth before the cold, so wood is dear in autumn. A village with none is cold, and the very young
  and the old die of it first: over a hard winter unwarmed about one grown-up in twenty, more of
  them. On treeless land people burned dung, turf and peat: a village with no forest within reach
  burns no wood.
- **"Materials"** (a setting): "Wood, stone, ore, herds and game", or "One kind of goods (as
  before)", which leaves a world exactly as it was. Firewood needs materials on.
- **The village panel** shows wood, stone, ore, wool and hides in the store; woodcutter, miner,
  herder and hunter are in the occupation filter.

Measured: the default world, six seeds, a year: 356 alive a world and 12 starved, against 367 and 16 before item 9; about 7 a world died of cold, which is what Firewood is for, and 137 died in battle in all six against 124. Over twenty days a forest village (282 forest squares within 4 km) spent its hours cutting wood and hunting where one with hardly any forest did not; villages by water fish and those without do not; wood cost up to 6 in villages with no forest near, about 1 in those with it. Over sixty days grown-ups' hours went field 10.7%, the bench 9.5%, cutting wood 7.9%, mining 5.9%, fishing 4.3%, herding 4.2%, hunting 3.2% (with one kind of goods: field 12.7%, the bench 16.7%, fishing 9.8%). `test/behaviour.mjs`: Materials moves 24.9% of an adult's hours, nearly twice what rerolling the world does (13.0%); Firewood 2.4% in a short spring probe, since nothing burns until the cold. Found on the way: seed 4's land has no forest at all, and with wood only within 2 km, and shields only of wood, its soldiers went without and died five times as often in battle: now wood, stone and ore within 4 km, shields of hide where wood is short, hides from herds as well as game, and turf and dung on treeless land. Speed (`test/bench.mjs`, against the engine before item 9, two runs each): 2,000 people 0.60 → 0.68 s a day, 5,000 1.80 → 1.96, 20,000 14.95 → 14.55 (within noise), 400 on 500 km 0.13 → 0.19: people walk out to forests, hills and grazing up to 4 km and back, and moving people is the cost (the step that moves people went from 13% to 23% of that world's time).

### Villages, towns and cities (2026-11-17)

TODO item 8. A village was a village for ever, split when it passed "A full village".

- **A size, not a type.** A place is a town from 400 people (England's small medieval towns held
  about 300 to 2,000, Dyer) and a city from 5,000; it falls back below four-fifths of that. Each change
  is in the news.
- **A place lives on what is brought into it.** Beside what its rule for a full village allows, a
  place has room for as many as the food brought into it feeds, a running average over about half a
  year (a town lives on a whole harvest). Food comes in by the carrying already in the world, from
  a store where it is cheap to one where it is dear, by grain traders, and on market day:
  households with more than their winter's food take it to the biggest place within 10 km that is
  short of it. So a place grows where the land round it has a surplus, and stays a village where it
  has not. Pre-industrial towns rarely held more than a tenth to a fifth of a people (Bairoch; de
  Vries), and a capital drew its grain from far round (London about 1300 from some 60 km by land and
  further by water, Campbell and others, 1993).
- **Crowded places were graveyards.** About one more death a hundred a year in a town than in the
  country and a little over two in a city: London's burials outran its baptisms for two centuries
  and it grew only by those who came in (Wrigley, 1967).
- **Where they live at first** (a setting; Ric: "all of this being choices"): hamlets of about
  fifteen, villages as before, villages and a market town with two-fifths of each faction, or a city
  with half of everybody. A town or city made at the start is trusted to be fed by its villages for
  those its own rule would not hold; if the food does not come, the trust runs out and it shrinks,
  or starves.
- **Drawn** (Ric: "Houses, then a block"): every house close in; further out, where houses are too
  small to tell apart, a town or city is one block, the outline round its houses, edged in its
  faction's colour, with a bigger marker and "town" or "city" by its name.

Measured: a year of 5,000 people on 40 km, from villages: on rich land ("How much it grows" 1.7) the biggest place reached 444 people by the year's end and was a town, 21 starved; on poor land (0.7) the biggest held 53 and the world starved by more than half; with a city of 2,500 at the start on rich land, its villages could not feed it, it shrank to 416 and 532 starved. Almost no food was carried into any place in these runs: after the harvest every place has food and prices barely differ, and households keep their harvest at home; towns grew by keeping their people, not by imports. The default world, six seeds, a year: 372 alive on average and 101 starved in all six (17 a world), against 364 and 138 (23) at item 7. Speed (`test/bench.mjs`, against item 7): 400 people 0.12 → 0.12 s a day, 2,000 0.62 → 0.57, 5,000 2.12 → 1.72, 20,000 15.1 → 14.2, 400 on 500 km 0.10 → 0.12. A crafter looking for a paid building job had looked through every house in the world at each decision, a tenth of a 20,000-person world's time since 7b; now only the open sites.

**Feeding a town (2026-11-17, Ric: "Fix food supply").** Measured first, on a city of 2,500 at the
start on rich land: after the harvest the villages round it held about 36,000 days of food beyond
their own winter, while the city's households were 10,000 days short with 7,000 to 12,000 coins to
pay. Yet over 300 days no grain was carried in and three households went to market. Three things
stopped it, and are changed:

- **Every price was the same.** A price reads a village's store, and every store was empty, so
  every price sat at its top (7) and the city looked no dearer than home. Market day now goes by
  how short the town's households are, and only to a town whose households are going short.
- **Nobody to sell to.** A load brought to market could only be sold to the town's store, whose
  till was empty. It is now sold door to door to the households going short, at 1.2 coins a day's
  food, the most short first; what nobody buys goes to the store if it can pay, and the rest home.
- **Too small, and too frightened.** A household carried five days in a pack; now a handcart or
  packhorse load, as a grain trader carries (fifteen days). And a war anywhere frightens a whole
  faction, which stopped every market day from the harvest to spring though the fighting was
  nowhere near; on the road to one's own town, not under siege, fear now counts half. (Since
  2026-11-19 a war elsewhere does not frighten anybody at all: "Wartime effort".)

This world had no grain traders at all, so market day is the town's supply. Measured, a year each
way, 5,000 people on 40 km, rich land: with a city at the start, 15,000 days of food were sold into
places (none before), 363 starved against 511, and the city held 524 against 479. From villages, 12,200
days were sold, 57 starved against 122, and the biggest place was a town of 415 at the year's end
against a village of 251 (the same seed under item 8 had once grown a town of 444; one run each
way). The default world, six seeds: 367 alive and 16 starved a world, against 372 and 17. **Still
open:** a city of half the people cannot be fed. After keeping their own winter the villages
round it had about 40,000 days to spare and the city needed about 150,000, and at a coin a day its
households' money would buy about 10,000. Historically a town of that share of a people lived on
grain from far away by water.

### Building houses (2026-11-16)

TODO item 7b. A house stood from the start or appeared at once for somebody who moved. Now:

- **Who needs one.** A married couple living with other grown-ups sets up a house of its own, as
  north-west European couples did at marriage (Hajnal's household pattern); so does a household
  too many for its house (about 10 m² a person). The youngest couple goes. An empty house in the
  village is taken first, one whose household died out or moved away.
- **What it takes.** About two hours' work a square metre of floor (a 54 m² cottage 14
  person-days, a 168 m² house 42), and goods for timber and thatch, one for every 20 m² and six
  besides, bought from the village; where there are none, or no coin for them, gathered by hand,
  eight hours each, as most peasants did. No clean medieval figure for the work was found (Dyer's
  peasant buildings were put up by carpenters in weeks); these are said as a guess.
- **Who builds.** The family itself, five hours at a time, or a builder they pay, a crafter of the
  village, at a wage and a half (Ric: "Sometimes a family sometimes a builder"). A household pays
  for a builder or goods only out of what is left after a winter's bread. Building gives way to
  hunger, the harvest and an empty larder, as building waited for the slack of the year.
- **Newcomers** take an empty house, or put up a hut at once, the smallest house there is.
  (Lodging them with a neighbour while they built was tried: hungry newcomers built instead of
  farming and a year starved half as many again.) A child that moves goes with its parent; until
  now each had been given a house of its own.
- **Drawn** as a timber frame, its roof thatched by quarters as the work goes on.
- In a first year few couples marry into a crowded house, so few houses are built; they come
  with the generations.

### Who holds the land (2026-11-16)

TODO item 7c. Ric: "It should be a setting for each tribe. And the leader decides that or
sometimes the people. Like different governments". Every faction has a land rule:

- **Families**: every household that farms holds fields of its own near its house, a square
  (6.25 ha) for every two or three of them, so a family of five about a virgate (nominally 30
  acres, 12 ha). It works its own first, unless picked so bare that other land would give it much
  more; anybody may work another household's field for half of what it gives, the other half going
  to that household, as harvest work was paid in sheaves. A household that has not farmed for three
  months running gives its fields back.
- **The village**: the fields are common; anybody of the village works any (as before).
- **The leader**: everybody works the leader's land and a third of every harvest goes to the
  leader's barn, the village store.
- **Who chooses.** A chief or the richest by their own leanings (who believes in sharing chooses
  common fields, a greedy one their own land, anybody else families); a faction that votes by what
  most of its grown-ups lean to, changing only when 55% want it; you, for a faction you rule (the
  ruling panel has a button for it); or the world setting "Who holds the land" fixes one rule for
  everybody. A change is in the news.
- **Drawn**: hedges round each household's fields from 20 pixels a square.
- Measured, a year on six seeds: families' holdings starve as many as common fields (124 against
  119). The first tries starved twice as many: holdings nobody else could touch, holdings for
  households that did not farm, and families going back every day to a bare field of their own.

### Paths and roads, carts and boats (2026-11-16)

TODO item 7d, with what Ric added to it ("Write them in"): carts and better boats come with roads;
cars wait for eras (item 15).

- **Paths are worn in, not laid down.** Every time somebody walks onto a square it is trodden once
  more; under 1% of that wears off a day, so a path outlasts a winter. A square trodden about 25
  times a day for weeks becomes a path, about 95 a road; one nobody uses goes back to grass. This
  is the active walker model (Helbing, Keltsch and Molnár, 1997): walkers wear the ground, worn
  ground is easier and draws them, wear fades. A path is walked at least at the pace of open
  ground, a road 15% faster, and the way-finding prefers them. In a default world about 150 squares
  of path and 30 of road wear in over a year, mostly the lanes of villages, as trips between
  villages are few on a 17 km land. Drawn as lines from square to square, roads wider and paler.
- **Carts** are owned: a trader starts with one, and buys or mends one (three goods) out of what is
  left after a winter's bread. Grain goes eight packs to a cartload, five by handcart and packhorse
  without. Laden, a cart goes at a walk on a road, 85% on a path or a village's lanes, 60% over
  open ground. Drawn behind a laden trader. (Farmers' carts for the harvest were tried: dragged
  home over the fields they starved more than twice as many in a year; not kept.)
- **Boats carry goods**: a load for a village along the same coast or a big river goes by boat
  when that is at least a tenth quicker than the road, at about 6 km an hour under sail and oar.
- **Boats are lost**: about one crossing hour in 500 at sea and one in 1,500 on a lake or river;
  the load goes down with it and half of those aboard drown; the village is without a boat until
  it builds another. Built, lost and afloat are counted (`boatsBuilt`, `boatsLost`, `boats`).

### Asking a neighbour, made cheap (2026-11-16)

Left by 7a: when a village store was empty every hungry person looked through all their neighbours
for grain, a fifth of a 20,000-person world's time. Now they run down a list, made once an hour,
of who in the village has grain, most first, and stop where nobody further down could do better;
grain somebody brought home within the hour is known of the next hour. The same world plain or
fast (`test/walking.test.mjs`, `dozing.test.mjs`). 20,000 people 13.4 → 10.8 s a day.

Measured, item 7 as a whole (six seeds, a year each, against item 6): 364.5 alive on average against 365.5, 138 dead of hunger in all against 110 (within what six seeds vary by run to run: 119 to 138 between runs of the same engine with small changes), and about 150 squares of path and 30 of road a world by the year's end. Speed
(`test/bench.mjs`, against item 6): 400 people 0.125 → 0.125 s a day, 2,000 0.62 → 0.62, 5,000 1.96 → 2.05 (5% slower), 20,000 on 80 km 14.3 → 14.9 (4% slower), 400 on 500 km 0.145 → 0.10 (31% faster); the cheaper neighbour search pays for most of what houses, land and paths cost.

### Rain and dry years (2026-11-16)

TODO item 6b. Every year grew the same everywhere but for one number for the whole land. With
"Rain" on (the default):

- **A year's rain differs by place.** Each square's usual rain is how wet its place is (the same
  map that makes forest or dry land); a year's rain there is that times 1 + cv·z, with z drawn
  from the seed and the year for the whole land and for regions about 100 km across (not the
  world's dice, so asking about a year changes nothing). cv is how much one year differs from the
  next: larger on dry ground than wet, as in life (yearly rain varies by about 15 to 20% in wet
  country, 30% and more in dry), and scaled by "Year to year"; at "every year the same" there are
  no dry years.
- **A dry year thins the crop** by about as much as the rain fell short (FAO's yield response
  factor for wheat, about 1.05; FAO Irrigation and Drainage Paper 66), and a wet year adds a
  little. Divided by its own average, so a run of years grows what it did without rain: 100% on
  average over thirty years, with a land-wide dry year (under 85%) about one year in five at the
  usual setting.
- **River flats are spared**: ground beside a river or lake loses nothing in a dry year, ground
  500 m off a quarter of what it would, a kilometre off three quarters, which is why villages sat
  there.
- **Word of a dry year** comes in the news when a faction's villages get under 80% of a usual
  crop.
- **Rain fills the pots**: with thirst on, on a rainy day every house of a village catches about
  40 litres off its roof; a wet place has rain on about half its days, a dry one on a sixth, a dry
  year fewer.

### Fishing (2026-11-16)

TODO item 6c. With "Fishing" on (the default), a village within 2 km of a river, lake or the sea
fishes the water nearest its middle and every water square within 750 m of it. A square of water
(6.25 ha) gives what natural waters give, 30 kg a hectare a year in the sea, 40 in a lake, 60 in a
river (FAO puts natural waters at about 20 to 50), a kilogram being about a third of a day's food;
it holds at most a year of that, fished down it comes back at that rate. A day's fishing brings
in up to about 6 kg, under half that in the cold. A fisher is a living like a farmer, chosen the
same way: by what a day there would bring. Measured: over a year on six seeds a 400-person world caught about 6,800 days of food, roughly 6% of what it ate.

### Fords, bridges and boats (2026-11-16)

TODO item 6d. Every river could be waded, and nobody could cross the sea or a lake at all. With
"Crossing water" at "real" (the default):

- **Big rivers** (draining over about 300 km², tens of metres wide) cannot be waded, except at a
  **ford**, about every 2.5 km (every 7.5 km on the biggest), from the seed. Nobody steps from
  corner to corner across one either. A default 17 km land has none; 100 km lands have a few, 200
  km lands hundreds of squares of them.
- **A bridge**: a village within 2 km of a big river with no ford within 1.5 km builds one, about
  75 person-days of timber work, four hours at a time; it is walked at full pace, and land it
  joins is one. On a 200 km land the first took about three weeks.
- **A boat**: a village within 2 km of a lake or the sea whose people keep wanting to cross it
  builds one, about 15 person-days; then its people walk to its landing, are rowed over at 4 km an
  hour to the nearest shore of the land they are going to, and walk on.
- **An army does not go by boat**: soldiers sent over water they cannot walk round stay where
  they are, and the news says so.
- **Drawn** from close enough to see houses: a big river wider, a ford as a pale shallow with
  stepping stones, a bridge as timber across, a boat at its landing.

Each part has its own setting, and with each off ("off", "off", "wade") the world is exactly as
before: checked against the engine before that part on three seeds after eight days, identical.

Measured, the three together (six seeds, a year each, against 6a): 365 alive on average against 352, 110 dead of hunger in all against 162, 4 of thirst against 26 (rain fills the pots); seed 3 had a dry year, its villages' crops at 63% of usual, and 15 starved there against 1. Speed
(`test/bench.mjs`, against 6a): 400 people 0.14 → 0.13 s a day, 2,000 0.62 → 0.60, 5,000 1.80 → 1.75, 20,000 on 80 km 12.6 → 13.5 (**7% slower**: walking round a big river to its ford), 400 on 500 km 0.09 → 0.16 (**slower**: a land that size has hundreds of squares of big river, and a walker at a bend in one still sometimes falls back on the slow search for a way round). Part of what made 6a slow was found on the way: fields first set during a life (hours without water, what is carried home) gave people different shapes in memory, which the engine's notes already warned of; declared at birth, 20,000 people with all three parts off run 11.2 s a day against 6a's 12.6.

### Water to drink (2026-11-16)

TODO item 6a. People needed only food. Now, with "Thirst" on (the default, Ric: "Real, on by
default"):

- **A household keeps water at home**, up to 300 litres in a few large pots, and every one of them
  uses 20 litres a day from it (about WHO's basic access). Anybody at a river or a lake shore
  drinks there instead. (160 litres was tried first: a big family ran dry every night, 13,000
  dry person-hours a year in one world.)
- **Without water** a person weakens and does not heal, and dies in about three days, up to half
  as fast again on the warmest days (three to five days is the usual range, one to two in heat);
  "Gentler" is about two weeks.
- **Fetching.** With about two days left, somebody goes to the nearest river or lake shore (the
  sea is salt; `freshNear`, a map made once a world) and carries 40 litres home. Children from
  six fetch too, as children did: measured, every early death of thirst was a child alone in a
  house; and a younger child whose house is dry is given water from the village's fullest house,
  as it is fed from the village's store.
- **Wells.** A village whose fresh water is more than a kilometre off (WHO's line) digs a well in
  its middle, about thirty person-days of work, four hours at a time; then its houses fetch from
  it where it is nearer. Wells are drawn as a ring of stone with water in it.
- **Where villages are.** At the start villages are put within 2 km of fresh water where the land
  allows, and people founding a new village weigh how far the water is.
- **Off is off**: nothing of it runs and nothing is drawn from the dice; checked against the
  engine before this item on three worlds after eight days, identical.

Measured. Six seeds, a year each, water on against off: 372 alive on average against 382, 82 dead
of hunger in all against 25, 14 of thirst; wells dug in 8 to 12 villages of every world. Villages
start 1.2 km from fresh water on average against 2.2 km with it off; villages founded during the
year 2.1 km against 2.3, a weak pull once a world runs. Fetching takes under 1% of grown-ups'
hours. Speed (`test/bench.mjs`, against 7a): 400 people 0.12 → 0.14 s a day, 2,000 0.55 → 0.62,
5,000 1.72 → 1.77, 20,000 10.5 → 12.6 s: **over the 5% budget** on three rows, the cost of a new
daily task (counting who lives where at every decision had made it 28 s; that is now done once an
hour). **Not explained yet:** with water on, no trader went prospecting in sixteen seeds in the
travel test, against two of sixteen with it off; the cause was not found.

### War has to be fed (2026-11-14)

Ric: military reach should depend on *"food carried and access to resupply, distance from
friendly settlements, equipment replacement, agricultural labor lost to recruitment, recovery
after losses"*. Before this an army was raised whole the day a war began, marched on nothing and
could sit under a village's walls through a hard winter. At this map's scale a walk between
villages takes hours, so reach here is **how long an army can stay in the field**, not how far it
can walk — and a village falls only to four unbroken days of besiegers with no defenders.

- **Rations.** Before marching a soldier draws `CAMPAIGN_DAYS` (ten) of rations at a village of
  their own, paid by the treasury: from the store, then from houses with more than their winter,
  at each house's price (`provision`). Coins are conserved; no house is stripped below its winter.
  Under three days in the pack, they do not march.
- **Resupply only at home.** In the field they eat what they carry; under a day left, they walk to
  the nearest village of their own (`nearestOwn`), and the siege loses them.
- **Equipment.** A soldier refits before marching (`outfit`, which costs goods), and without a
  working weapon does not march.
- **Labour.** Every soldier is a field hand lost; the Factions tab says so beside the count.
- **Recovery.** The badly wounded (health under 0.45) go home to heal rather than fight, and an
  army is raised — or rebuilt — at about two in a hundred adults a week, not all at once.

Measured on wars forced on day one between two factions (`declare`), 240 people, forty days,
three seeds: in spring, battle deaths 22–26 and 0–1 villages taken (before: 26–32, 0–2); in a hard
winter, battle deaths 6–10 and no village taken (before: 26–53 dead and villages taken as readily
as in spring). The winter worlds starved heavily either way — a hard winter started with nothing
put by starves 52–199 of 240 with no war at all, old code and new alike; in the old code war only
looked kinder because battle left fewer mouths. `test/war.test.mjs` checks the pieces.

### Equipment: a first connected set

Added 2026-11-12 as the next readability milestone in the People vision. Items are in each
person's `gear`, with condition from 0 to 1. Nobody starts with free gear. At a village, an adult
with at least 0.6 food fits the equipment for their occupation using owned goods or goods bought
through the existing market. Children do not outfit themselves. Coins transfer through the same
till/tax paths as any purchase; shared stores supply actual goods without coins.

| Item | Goods for a new item | Use | Condition used per completed use |
|---|---:|---|---:|
| Work tool | 0.6 | Farmers take up to 2.25 food rather than 1.8 from a day in the fields, deducted from actual fields; crafters make 20% more goods per batch. | 0.003 |
| Trade pack | 0.8 | Traders can buy/carry up to 5 rather than 3 units, still limited by stock and money. | 0.004 per delivered load |
| Weapon | 1 | Soldiers deal 25% more damage on a successful hit. | 0.01 per successful hit |
| Shield | 1 | Soldiers take 25% less damage on a successful hit. | 0.01 per hit received |

These costs and effects are implementation choices for this first set, not requirements Ric
specified. Generic goods already produced by crafters provide the material; there are no new
metal, textile or recipe chains yet. The weapon and shield are generic equipment, not a chosen
historical technology progression.

At 25% condition or below, a person seeks repair when next shopping. Repair consumes the item's
cost times its worn fraction and restores condition to 1; no material means no repair. Working
condition gives the listed benefit until it reaches zero. Gear stays owned when a person changes
occupation but is stored and inactive if unsuitable. On death, remaining usable material returns
to the home village's goods; worn material does not. This is salvage, not inherited named items.

At close zoom the renderer reads equipped items to draw the work tool, pack, weapon and shield;
an actual trade load adds a crate. People-list rows name gear in use. Person inspection distinguishes
Equipped, Stored and Broken, reports condition and the active benefit, and shows loose goods and
trade cargo. Selecting someone now zooms to 48 pixels per tile to make equipment readable. This
is a first inventory/work connection. Following someone limits labels and speech to that person
and their conversation partner so text does not hide carried gear; bubbles sit above the items.
Individual item provenance, specialist equipment makers,
player equipment choices and the larger production system remain future work.

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
- **Three screens in one file.** The address carries the sandbox and only the settings that differ
  from the defaults (`#people?people=900&rich=0.5`), so a link stays short and still opens after a
  setting is added. `&run` goes straight to the world; "Copy link" makes one.
- **The two doors run their own engines** in miniature rather than showing a picture. With reduced
  motion they draw one still frame.
- **Settings that another setting switches off are greyed**, not hidden, so the list never jumps.
- **"Surprise me" draws every setting from its own range.** Most of those are bad worlds. That is
  the point.
- **A frame advances at most a tenth of a second of real time** rather than owing a growing
  backlog, so a slow phone runs slower instead of freezing; a note says when it is behind. For
  People that is the keeper's rule now (`people-host.js`, `run`), and "behind" means the world is
  getting less than nine tenths of the time that passed.
- **The People world is not on the page** (2026-11-15, `TODO.md` item 3; "Off the page's thread"
  above). The page holds the land as it was made, the last frame, the villages and factions as
  last sent and what the open panel needs; it asks for one frame and one panel at a time. A panel's
  answer for a tab, person or search that has since been left is not drawn, and the routine
  refresh is not drawn over a finger that has come down on the panel. Tapping a name takes the view
  to them when the next frame says where they are.
- **"How many people" has a box as well as a slider**, and under it one line saying how fast this
  computer runs the world as set ("What this computer can run" above).
- **People opens on a searchable population list** (2026-11-12, Ric: "Build the next features
  from the vision"). Name search combines with settlement, faction and occupation filters.
  Each row shows age, job, settlement, faction and current activity; selecting it locates and
  follows that person. Back to People preserves filters, page and scroll position; a new world
  resets them. Results are alphabetical, sixty per page, with live counts and an empty state.
  Search/filter controls stay outside the live result redraw so typing and focus survive updates;
  filters collapse to leave room for results on a phone. Living parents, children, partners and
  the current conversation partner are linked in inspection. Either name in Talk can be selected;
  people who have died are labelled rather than linked. A selected person's death has a way back
  to the living population. There is still no archive of the dead or saved bookmarks.
- **People are boxes, with smaller children and a white ring on leaders.** Ric, 2026-11-13:
  "people can be boxes". The square diagonal fits the body clearance; equipment still reads
  actual ownership. The miniature uses boxes too. Roles are
  written beside them at close zoom, rather than encoded as triangles or dots. Tapping a person
  zooms in and follows them; the Person tab states their current activity. A map key explains this
  on the running screen; it folds back to its one-line clock when it is in the way, and the `?`
  opens it again.
- **Harvesting takes five seconds at 1×**, on the field where food is actually collected; a crop
  outline and stalks mark it. Walking to a field, bringing food home, making goods, trading and
  guarding have separate activity labels.
- **Read exchange holds one conversation still while the world continues** (2026-11-12,
  next milestone from the People vision). Talk lists the latest forty exchanges; selecting one
  keeps its transcript, participants, time, original circumstances and before/after effects.
  Inspect either participant and return to the selected exchange, return to the live recent list,
  or locate where it happened. Gold rings identify the living participants on the map while
  reading. This does not pause the world; Pause remains explicit.
- **Conversation effects are receipts, not interpretations of the dialogue.** `converse()`
  snapshots both people before calling the unchanged interaction logic and attaches actual
  changes after it returns, including changes made after `said()`. Food, possessions, beliefs,
  loyalty, the relationship toward the other participant, home, faction, occupation, partner,
  learned news, sickness and faction relations can be recorded. The observer makes no RNG calls
  and writes no model state. The rolling history remains capped at 160, with monotonic exchange
  IDs; the page holds just one selected record outside it until cleared or a new world starts.
  These are facts from that exchange, not current beliefs, a saved world or a full life history.
- **Conversations stop both people for six seconds at 1×.** A gold line joins the actual pair,
  and speech bubbles name speaker and listener. Work is not interrupted by a new conversation
  while harvesting or making goods.
- **People occupy space.** Bodies stay at least 0.42 tiles apart, including starting crowds and
  newborns. Each movement checks a spatial hash and tries to slide round a blocked neighbour;
  if no step fits, the person waits. Destinations choose a free nearby spot, and a person who
  stops getting closer than they have already been tries a bounded half-tile A* route around
  the crowd, including paths that first move away from the destination. Every route edge and
  footstep checks body spacing. The search stops after 800 expansions and retries at most
  every thirty activity ticks. Starting residents wait where they fit instead of all heading
  for the village centre. Markets and fields accept arrival within half a tile so a shared
  destination does not require sharing a position. Local tasks within 2.5 tiles retain the daily engine’s existing nearby-arrival rule:
  after twenty-five stalled ticks they retry a free nearby spot, up to three retries, then
  work from the nearby spot they occupy. Eating/outfitting also require proximity to home. Inter-village scouting, loading and
  delivery never use that shortcut; an enclosed courier still needs a real opening.
- **Traders may prospect for a market when prices are equal.** Ric, 2026-11-13: "people dont
  travel to other places much seems like they get stuck at vilages". This is a choice in
  `choose()`, competing with feeding, rest, safety and useful work. Fed traders can visit the
  least recently checked safe market within the existing 34-tile reach, preferring closer
  places on ties. Shared-store carriers stay within their faction. Arrivals are remembered;
  prospecting creates no cargo or profit. All purchases still need real stock and coins;
  a person away from the source walks back to load rather than buying from a distant store.
  Hostile and abandoned markets are excluded. Activities name the destination; `test/day.mjs`
  groups names back into stable activity categories for the existing day-shape measurements.
  Other occupations retain the newer engine's work, family and migration choices.
- **Speech is drawn as words only when zoomed in**; farther out a small mark shows somebody is
  talking. The Talk tab has the last forty exchanges either way.
- "← Settings" is the way out of a running world; the site's "← Ric's Terminal" control is on the
  other two screens and hidden while a world runs, because it would sit on the map. On the
  settings screen it sits in the bar along the bottom, in a slot kept clear for it — floating
  above the bar it covered whichever panel of settings happened to be there. On a phone there is
  no room beside the buttons, so that bar grows a second storey and the control sits in it.
- Typed egg: `genesis` (in `relay-return.js` and `EASTER_EGGS.md`). Space pauses a world, so the
  word has no space in it.

## Not done

- The front door and `latest.js`, as above.
- A share card. `assets/og/build-og.py` draws them with Windows' own fonts, and this page was
  built in a cloud session that has none, so a card drawn there would not match the others. Add
  a row to that script's manifest and run it with `--tags` from the Windows machine.
- Physics: bonds have no direction (see above), and a hand-built world is not saved or shared.
- People: nobody remembers a dead friend, there is no trade in more than two goods, and soldiers
  never attack anyone but soldiers.
- Neither world has sound.

## 2026-11-14 — boxes and journeys around crowds

Ric asked for boxes and found people staying around villages. This update preserves the newer
need-based decisions, homes, work durations and migration from `76c68dcd`; it adds route finding
and a scored prospecting choice rather than restoring the older fixed job loops. The existing
wrapping toolbar, folding key, camera fix and physics work are retained.

Before/after check of the new decision baseline (`behaviour.mjs --days=1 --seeds=2
--only=rich,talk`, 220 people, small map, seeds 11 and 108): identical seeds stayed identical.
Sleep occupied 36.7% → 36.8% of adult hours, making goods 20.7% → 20.5%, harvesting
13.7% → 13.3%, and talking 9.6% → 9.9%. Changing richness moved 9.3% → 9.2% of a day;
changing talk moved 3.8% → 6.2%; reseeding moved 7.5% → 8.2%. These are short daily
measurements, not seasonal or generation-scale validation. Targeted travel fixtures separately
check physical market arrivals, distant deliveries and a crowd detour that must first retreat.
