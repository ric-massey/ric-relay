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
  night in a bed), `alone` (hours since anybody spoke to them), `fear` (a siege, a war, a blow
  just taken). `urgency(p)` turns them into 0–1.4 wants and is exported, so the person panel shows
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
