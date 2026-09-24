# SURVEY — the build plan

Survey started as a quiet mode with no enemies and no losing. It is becoming a
**survival exploration game**: you start at a station, you go out, it gets more
dangerous the further you go, and things out there can kill you.

This file is the whole plan, in the order it gets built. One item at a time,
each one finished and tested before the next starts — the mode is already large
enough that half-built systems hide each other's bugs.

> **The yard is gone, 19 September 2026.** Everything below that says *the yard*
> or *the jump gate* — a second structure off the origin that the six parts were
> carried to — is history. The six parts repair **your own station** now, one
> room of it each, and the wormhole is what the station becomes when it is
> whole. The reasoning and what shipped are in **`archive/THE-STATION.md`**; this file is
> left as it was written, because it is the record of what was decided when.

> **Only the open work is here now, 24 September 2026.** Every section marked
> DONE moved, word for word, to **`archive/SURVEY-BUILT.md`**, and a one-line
> note stands where each one was. What is left is the direction, the live
> phases and the rules.

---

## The one test that matters

> **Ric's sister sits down, and inside two minutes she knows what she is doing
> and why.**

Not "can read the manual". Sits down cold, and the game tells her. Every item
below is judged against that before it is judged against anything else. If a
feature cannot be understood from the screen in the first two minutes, it is
either explained better or it is cut.

Three things she has to learn in that window, in this order:

1. **I can die, and here is what is trying to kill me.** (hull, thirst, hunger)
2. **Here is where I am going and why.** (the yard, or a station, and a bearing)
3. **Here is how I get better at this.** (salvage → sell → a better ship)

Everything else — the almanac, pins, gates, the Leviathan — is allowed to be
discovered later. Those three are not.

---

## What Survey is for  ·  *the direction, set 17 September 2026*

**Read this before anything below it.** Everything after this section is the
record of how the mode got here. This is where it is going, and it was set by
Ric after a long conversation about what Survey actually wants to be.

The candidates on the table were four different games — rise through the war
(Mount & Blade), build a foothold (Terraria), survive the sector (DayZ, Project
Zomboid), find what is out there (Outer Wilds). Ric's answer:

> *"why not all 4? it sounds awesome to have a game that is dificult. you feel a
> bit scared to adventure. you are scraping by but build out your outpost. and
> you can even go command your own fleet."*

And then the correction that turned it from a ladder into a sandbox:

> *"but i want to make it so you can be whoever you want."*

The reference points are **Kenshi** and **Starsector**: a nobody in a world that
does not care about them, who can become a trader, a thief, a soldier or a power,
and whom the world treats as whatever they have actually done.

### Who you are is a path; how big you are is a scale

Nobody climbs one ladder. You pick what you are climbing, by doing it, and the
same four sizes apply whatever you picked:

| Who you are | Alone | Foothold | Crew | Power |
|---|---|---|---|---|
| **Pirate** | picking off stragglers | a hideout in the Warrens | a raiding pack | a name the lanes fear |
| **Trader** | hauling for a margin | a depot | your own convoys | you move the prices |
| **Explorer** | pushing the edge | a forward base | survey ships | charting what nobody has |
| **Soldier** | picking a side | a post in its territory | a squadron | commanding its Leviathan |
| **Salvager** | stripping wrecks | a scrapyard | tugs and claws | picking over whole battlefields |

You can switch, and you can mix. A trader who starts taking convoys is a pirate
now, and the sector treats them like one. Discovery runs under every path: the
strange things at the edge are always there, and every size lets you reach a
little farther.

**The loop still holds.** *Explore → find stuff → bring it home → improve your
ship → go farther* is what the Alone column plays like on every path. The scale
is what that loop turns into once "home" is a place you built.

### The three rules

1. **You are what you do, not what you picked.** No class screen. 5.1 already
   works this way for piracy — hurting a power is a favour to its enemy — and
   every path extends that rather than adding a choice.
2. **Every path stands on its own.** A pirate earns, progresses, has goals and
   has dangers without needing to trade or explore on the side. This is where
   "be anyone" games fail: ten shallow paths and one that is actually fun. A path
   is not added until it can be played as a life.
3. **The world never tells you who to be.** Same rule as the thirty-minute wall
   (TODO.md, 2026-09-14): *show* the player something they cannot have yet, never
   instruct them.

**Difficult is not the same as confusing.** The two-minute test above still
stands. She understands what is happening inside two minutes, and she is scared
of it by five.

### Where each path really stands

Ric's read from the cockpit, which overrules this file's DONE markers:

- **Salvager, explorer** — *"sure im not sure."* The systems exist; whether they
  play as a way of life is unknown until they are flown as one.
- **Trader** — *"ive thought about it but i havent been able to go as deep as i
  want to go."* Trading with ships is still open (5.8). **Open question:** what
  deep means — contracts, knowing prices across stations, owning haulers,
  working the shortages. Ask before building.
- **Pirate** — *"the world doesnt really react... like it does. but i think its
  because the bots are pretty random you dont really know what the bots mean."*
  Reputation, hunters and 6.1's wants are all real in the code and invisible from
  the cockpit, so it reads as noise. And it does not feel like a way of life.
- **Soldier** — *"i think its a good idea its just hard to do. expecially if you
  dont have a personal bio."* You cannot join a side. **Open question, not
  decided:** the bio can be *your record* (WHO KNOWS YOU grown into a history a
  power reads before it lets you enlist), or *an origin* picked at the start, as
  Kenshi's starts are — a place to begin, never a class.

### The build order

Ric agreed these four, in this order. Each one is finished, flown and fun before
the next begins.

**1 · Bots you can read.** The foundation under every path. A pirate has to spot
the laden hauler, a trader has to tell an escort from a raider, a soldier has to
see who is winning — and today a ship shows its flag as a colour and nothing
else until you scan it or press `E`. At a glance, from the cockpit, without
pressing anything, a ship should answer:

- whose side it is on (done — the colour),
- what it is doing — hauling, escorting, patrolling, raiding, scavenging, fleeing,
- whether it is carrying anything worth taking,
- what it thinks of *you* — ignoring you, warning you off, coming for you.

*The test:* someone watches thirty seconds of traffic and can narrate it. "That
one's loaded, those two are guarding it, and that one's about to jump them." If
they cannot, the bots are still random, however good the code underneath is.

**2 · An early game that scares you.** Deliberately reverses a settled decision:
Phase 2 pitched supply as *"a constraint on going a long way, not a difficulty
everywhere"*, and S17 made the front door quiet. The levers are the ones named
there — the station roll, the inhabited-world gradient, tank sizes, the
front-door bowl, what a respawn gives back. Scraping by has to be real, without
breaking the two-minute test.

**3 · The foothold.** The biggest missing piece, and it is **one system dressed
per path** — a pirate's hideout and a trader's depot are the same outpost. Somewhere
you built, that stores what you are not carrying (5.8's storage is its first
piece), that you come back to, and that can be lost. It has to be something the
sector notices: raiders, shortages and the powers all care where you set up.

**4 · Paths, one at a time.** Each made whole against rule 2 before the next is
started. Which first is Ric's call when 1–3 are done; the two open questions
above get answered before their path is built.

### Step 1, first pass  ·  *19 September 2026*

> *"do a redesign of the ships make sure the look like wha tthey should. so its
> easy to look at them and say what type of ship they are also bots shpould be
> able to choose to go slower than their controls and they just freeze when too
> close to the player"*

**The ships.** All twenty-five were redrawn, and the drawings moved out of the
stat rows into `HULL_ART`. Each category now has one mark nobody else wears:

| Category | The mark |
|---|---|
| Cargo | a small cab on a box, and the box is a grid of containers |
| Commuter | a rounded cabin with a row of windows down each side |
| Courier | a thin nose on a big split engine block |
| Sport | a long needle, swept tail fins, a racing stripe |
| Military | swept wings, gun barrels pointing forward |
| Industrial | an open throat at the bow where the beam comes out, and a truss |
| Utility | a blunt push bar across the bow, jaws in front of it |
| Explorer | a sensor mast off the nose with a crossbar |

Every outline stays inside the box its old one had, so collision barely moved.
`test/hulls.html` draws the whole roster with the game's own drawing code.

- **Each job flies one family.** Freight flies cargo hulls, traders commuters
  and couriers, scavengers utility and industrial, the navy military, and
  pirates sport and courier. Pirates used to fly Jackals and Reprisals, the
  same shape as the patrols hunting them. This changes which hull each passing
  ship flies, so `test/fingerprint.js` hashes moved. Rock and disc counts did
  not, and nothing else in the world changed.
- **Holds show what is in them.** A hull's holds fill with its cargo in that
  material's colour, dearest first, so a hauler with iridium aboard glows
  violet and an empty one is a frame. Yours fill the same way.
- **Markings for the jobs a hull cannot show.** Pirates wear barbs along their
  outline and a ram at the nose. Patrols flash red and blue at the wingtips.
  An escort has a faint dashed line to the ship it is guarding.
- **One drawing for everybody.** Your ship, the sector's and the hangar's use
  one `drawHullArt`. Before, the jaws were only ever drawn on yours, and bot
  exhaust came out of a fixed point that sat inside the bigger hulls.

**The freeze.** A ship within 220 of its goal counted as arriving, and on
arriving it skipped its whole step: no engine, no guns. For a ship chasing you
the goal *is* you, so it flew in and stopped dead. The same happened to a
pirate that caught its hauler and to a ship fleeing you at close range. Only a
place (a station, a wreck, the end of a route) can be arrived at now. An armed
ship that catches what it is chasing circles it at gun range, 360 plus 60 per
size, rather than parking on it.

**The throttle.** Every bot flew flat out at cruise until something stopped it.
Now each one picks a pace for what it is doing: easing into a dock, keeping a
leader's or client's pace (steering a little ahead of its slot so it does not
loop round it), no slower than what it is circling, or cruise otherwise. The
drive still pushes along the nose, because that is what swings the velocity
round a turn, and anything over the pace comes off at the rate the drive
manages in reverse.

**And a bug under it.** The stuck-ship watchdog never recorded where a ship
started, so every ship counted as stuck for its first eight seconds of life.
Each one threw a random swerve and turned its route round, eight seconds after
it was born.

### Bumping, and the map's zoom  ·  *19 September 2026*

> *"can you make it so bots that are friendly with each other can run into each
> other. also look for bugs in zooming in and out for the map please"*

**Hulls are solid to each other now.** Nothing out here could touch anything
else — an escort flew through its own hauler, a wing sat inside itself — because
traffic is not in the `ships` array and only your hull was ever asked. Every
pair is asked now (`trafficBumps`): they are pushed apart by mass, the closing
part of their velocities is traded with a fifth lost, friends only bump,
enemies meeting hard take a point each, and a warlord's ram takes two and costs
it nothing.

**Six bugs in the map's zoom**, all of them found by driving the canvas's own
listeners the way a hand does:

- **A wheel event was a whole step.** A trackpad sends dozens per flick, so one
  flick crossed the whole ladder — measured at 5.2× from thirty small events. It
  is proportional now, and a trackpad pinch (a wheel with ctrl held) is read
  more strongly.
- **A sideways scroll zoomed in.** A horizontal-only wheel has `deltaY` 0, which
  is not "up", and now does nothing.
- **Zoom ignored the pointer.** It zooms about the point under the pointer, or
  between two fingers, which is what every other map does.
- **No pinch.** Two fingers on the map now zoom about the point between them and
  pan as they move, and the first finger's tap is cancelled when the second lands.
- **The station's MAP tab could not be panned**, and its other tabs could not be
  dragged at all — the pointer handler knew every page except that one.
- **Names piled up.** Nothing checked whether a patch name would land on another:
  at one step a frame wrote THE MURK four times. Biggest patch first, and a name
  that would touch one already written waits until you zoom in.

Also: the rail read "2500.0K ACR." because the number crowded out its own word,
and the header read "SECTOR 134 , 17".

**Two more, hunted after Ric asked whether any were left:**

- **The rail lied about how much sky it was showing.** "N ACROSS" and
  `chartSpan` measured the whole screen, and the map is not the whole screen —
  the rail takes a quarter of it. It claimed 8,333 units where it drew 6,433,
  and disagreed with the scale bar drawn beside it.
- **The station's MAP tab ignored the keyboard.** Zoom, pan, recentre and the
  pin palette all work on the full page and none of them reached the tab: the
  arrows were routed to a scroll the map does not have and the rest fell
  through. With the drag fix above, that tab was a picture on a phone *and* on
  a desktop.

Checked and found sound while looking: a tap lands where you press it to within
a pixel at every zoom (`tapHit` now carries its coordinates, so a harness can
ask), the chart clips to its own rectangle, and the fog covers the view at every
screen shape this layout can take.

### The map reads as places  ·  *19 September 2026*

> *"overlapping ones shouldnt have borders with each other. also. the biome
> lines apear from going into it not the faction lines. and there needs to be a
> fronteir that is better connected... also. speed of ships can you make it so
> instead of a random number x it says units per sec."*

- **No seam between two cells of the same space.** The wash was filled cell by
  cell, so every shared edge was painted twice and a power's territory read as
  a honeycomb of little countries. One path per flag, one fill, no seams.
- **Flying charts the flags beside the lane.** Measured over a straight
  800,000-unit flight: fourteen cells charted, and of the twenty-four
  neighbouring pairs among them twenty-one differed in biome and two in owner —
  so the dashed biome edges were everywhere and the solid faction ones never
  appeared. Flying now records the *flag* of the eight cells around the one you
  are in (`markFlag`, an empty biome), which is what a ship can see across a
  sector. Faction borders draw along the whole lane; the biome still needs
  flying through or a scan. Flag records take at most three quarters of the
  chart's cap, so the cells you actually visit always have room.
- **A frontier in fewer, bigger patches.** Ric's call, from four options. It was
  a quarter to a third of the sky in about thirty patches whose *median size
  was one cell*: one real frontier and dozens of specks. Two tidying passes on
  the map — a leftover cell ringed by one power is that power's, a one-cell
  island of a power is not really held, and a cell of nobody's ringed by one
  other kind of nobody's is that kind. Over three seeds: 31→15, 34→22 and 26→17
  patches, median 1→9, 2→3, 3→3, and the share unchanged at 24–35%. A claim is
  never tidied: the war's answer wins, or a cell just taken is handed straight
  back.
- **Ships are measured in units.** SPEED, ACCEL and TURN read 792 u/s, 543 u/s²
  and 126°/s rather than 2.20x, 1.43x and 0.69x. The bars still compare across
  the roster.
- **And the scatter is a distance, not an angle.** Six degrees is a hand's width
  up close and ninety units at nine hundred, a dozen times the width of a
  Needle, so bots could barely hit each other at range. The cone closes as the
  range opens.

**And the lines say what they are.** Ric: *"the dotted lines are weird. and it
need to be easier to understand."* Three things were wrong with the chart's
borders, and all three are the same complaint: at any zoom past the widest you
were looking at unlabelled scratches.

- **The dashes are gone.** A dashed hairline in a biome's own dim colour, along
  a lattice of jittered cells, reads as scratches on the glass. A biome edge is
  a thin solid line now, a little brighter; a flag's edge is twice the weight.
  Which is which is the one thing the map has to get across.
- **Everything on the screen is named — where you have been.** A patch was
  named at its middle, and only if that middle was on the screen, so zoomed in,
  where one patch fills the view, nothing was named at all. The name goes on
  whichever of the patch's own cells sits furthest inside the frame. Two rules
  keep it honest: it is never nudged to fit (a first version clamped it into
  the frame, which moved a flag's name onto sky that was not theirs), and it is
  only written over cells you have actually *been through*. Ric: "they shoouldnt
  show a faction name in extra biomes" — the flags charted from the lane beside
  you are somewhere you have seen the colours of, not somewhere you have been,
  so they are drawn and not named.
- **A key, in the rail.** Two lines in the colours of the sky you are in: the
  heavy one WHO HOLDS IT, the light one WHAT IT IS.

**The fingerprint moves on purpose.** Tidying the map changes which cells a
power holds, so stations, traffic and worlds shift with it. Rock percentage and
disc counts are identical across all three seeds: nothing else about generation
changed.

**Still open for step 1:** what a ship thinks of *you* (ignoring you, warning
you off, coming for you) is not drawn yet. The dogfight test is also still
unflown: can someone watch thirty seconds and narrate it?

### Bugs, pilots and bosses  ·  *19 September 2026*

> *"look into the bots find bugs. make it so the ones with better ships are
> better flyers. also i like the idea of bosses."*

**Found by flying the sector headless** (three seeds, the busiest eight chunks
each, 45 s a place, every ship tracked):

- **Friendly fire started fights.** A stray round from your own side made a
  ship turn on the shooter; 24 of 64 patrols ended up fighting their own wing.
  Only an enemy, or somebody actually coming for it, starts a fight now. After:
  0.
- **Escorts circled their own client.** The guard's cached want handed back
  the client itself, not its shoulder, so the escort chased it like prey. It
  holds its convoy slot now, and prefers the hauler it came out with.
- **Haulers circled stations at 400 and never reloaded.** Any station within
  400 was excluded, including the one it was docking at. It is "not the one
  you just left" now, and an empty hauler that docks loads a fresh hold, with
  its convoy, so the lanes do not go empty over an afternoon.
- **Bot hitboxes were a flat 22 units a size**, three times a Lance's drawn
  hull. `hullR` is the outline's own circle, the same rule your hull has.
- **Rounds aimed at you passed through every other ship.** They hit whatever
  is in the way now.
- **A convoy passing a parked player turned on it** for being in its bubble.
  Only closing on a ship counts as crowding it.

**Pilots.** Skill comes from the hull's price on a log scale (Needle green,
Jackal ace) with a tenth either way per pilot, worked out from the ship's id
so generation is untouched. It buys a steadier hand (everybody leads from the
muzzle now; a novice's round wanders up to six degrees), faster follow-up
shots, pushing the hull in a fight, holding gun range, jinking, and breaking
off earlier. It does not buy handling: a hull turns the same in anyone's
hands. Measured crossing a gunner's nose at 260: a Lance's pilot lands about a
fifth, a Jackal's about two thirds. Pilots at 0.6 and up, and every boss, fly
passes instead of circles: run in, break past and extend, come round, now and
then a short circle, and a sideways break when your nose lines up on them.

**Bosses.** Ric: *"health bar on top", "know when your entering an area with a
boss... and when you leave", "not a perfect circle... a good fighter", "different
bosses. even some for certain teams but if your in good stance they wont
attack".*

| Boss | Sky | Ship | Who it fights |
|---|---|---|---|
| Warlord | lawless, Deep Void | Reprisal ×1.55, pack of 3, calls 2 more at half hull | everybody |
| Corsair | frontier | Vane ×1.6, one wingman | everybody |
| Admiral | a front | Bastion ×1.6, wing of 3 | you, if its power watches you or you stand well with its enemy |
| Warden | deep in a power's territory | Jackal ×1.5, wing of 2 | the same |
| Salvage queen | a power's territory | Tender ×1.2, 2 escorts, 40 units of rare salvage | nobody, unless attacked; she runs |

Each lives in a sky of its own: a disc 7,000 across, placed from the seed in
roughly half the 48,000-unit squares, none near home. The radio says when you
are coming up on one and whether it will come for you. A banner says ENTERING
and LEAVING. The chart marks the disc. While you are inside, a bar across the
top of the screen names the boss, its flag, whether it is hostile, its hull and
its distance. A scan that reaches one charts it. Bosses have at least 160 hull,
a three-round fan, a pilot past any hull's, and never break off (the queen
does). Every one drops a rare part that pirates and scavengers will race you
for. Warlord and corsair pay a bounty and warm every power; admiral and warden
are paid for by their enemy. Killed skies stay empty: `bossesDown` is saved.

**The bar is only for a boss that is after you.** Ric: *"no top bar on ones that
are friendly or neutral. if they are hostile the bar pops up. dont say
hostile."* The ENTERING and LEAVING banners are for every boss; the bar fades in
the moment a boss or its crew would come for you (a pirate's sky at once, a
queen only once you start something), and says nothing about stance.

**Each boss has a power, and drops it.** Ric: *"besides looks and name they
should all have something that makes them powerful and when they die they drop
the thing that make them powerful."* A fourth way to get a part, `get: ["boss"]`:
never sold, built or found in a cache.

| Boss | Its power | The part |
|---|---|---|
| Warlord | five rounds fanned on every volley | WAR FAN (weapon) |
| Corsair | comes in on an afterburner, 2.1× for 0.9 s | CORSAIR BURNER (device, a hard forward shove) |
| Admiral | a 40-point screen, back after 3 quiet seconds | FLAGSHIP SCREEN (takes the next hit, 12 s to recover) |
| Warden | two homing missiles every 4 s | WARDEN'S SWARM (two seekers a volley) |
| Queen | takes ships with her beam and sends them, and her own bugs, to dive into you | BROOD BAY (three bugs of your own that fly into whatever is after you) |

**Each boss is its own ship and its own fight.** Ric: *"the boss ships should
look different then normal ships"*, *"they shouldnt fly like another hull...
better. weirder fighting each should feel like a completely different
experience"*, and of the queen, *"galaga bugs... it just takes ships and has
them suicide bomb you."* Every boss has its own outline (`BOSS_ART`), its own
handling (`BOSS_HANDLING`, its base hull pushed to an extreme), and its own way
of fighting (`bossFight`). `test/hulls.html` shows the five beside the hulls they
started from.

| Boss | Flies | Fights | How you beat it |
|---|---|---|---|
| Warlord | fast in a line, slow to turn, almost no grip | THE BULL: hangs back while its pack goes in, then charges, slides past, comes about. A ram costs 2 hull | sidestep the charge, shoot its back |
| Corsair | fastest out there, glued to its nose | THE PHANTOM: barely visible, sits on your tail, shows itself only to strike, burns out of your line when you turn on it | never fly straight |
| Admiral | slow, stately | THE FORTRESS: holds 950 side on, full broadsides from turrets down both flanks, screen soaks the reply | close through the fire, stay off its flanks |
| Warden | turns on a coin | THE DUELIST: always faces you, strafes like a drone at 560, sidesteps when your nose finds it, missiles | lead it |
| Queen | quick for a barge | THE MOTHER: backs away facing you; rows of bugs (ships she took with her beam, and ones she builds, up to twelve) peel off, swoop, and dive into you | shoot the divers, reach her while the rows are thin |

Found on the way: an escort or any armed ship you shot did not fight back (only
patrols did), and nothing ever ran from your cannon, because only the burst
charge told a ship it was being hurt. `takeHit` is now the one place a ship
takes damage, which is how the admiral's screen works against everything.

---

## Who holds the sky  ·  *territory replaces the danger rings*  ·  **A and C built, B open**

> *"take the danger rings off. it will instead be based by boime and who owns
> that space."*

**Why the rings go.** Danger was one number, `dangerAt`, rising in a straight
line with distance from home, with seven named bands over it (HOME → THE LONG
DARK) shown permanently on the HUD. Three things made the whole sector feel like
a set of rings: the band name was the only place name the player ever saw; the
home override (`HOME_REACH`, 30,000) cut every biome on a perfect circle — sent
out in 120 directions from home on seed 424242, 74 of them met their first biome
at exactly 30,000; and danger scaled rocks, wells, caches and pirates purely by
radius, which swamped anything a biome did.

And a bug the rings were hiding: 6.7 moved `DANGER_FULL` from 320,000 to
1,800,000 and kept the band *edges*, so every near place got about 5.6x safer.
The edge of HOSTILE went from 0.56 to 0.10; ten minutes of throttle went from
the maximum to 0.19. This rebuild makes that moot rather than fixing it.

### Ric's decisions

- **Distance no longer drives danger.** The landmark ladder stays spread out by
  distance, so going far still finds new places, but a patch next to home can
  be deadly and one far out can be calm.
- **Danger is personal.** Cordon space is safe if the Cordon likes you and
  dangerous if you are WANTED by it. The same place plays differently for a
  pirate and for a soldier.
- **Borders move from the start.** Who is at war changes, and the land changes
  with it.
- **Five kinds of space**, in Ric's words:

| Kind | What it is |
|---|---|
| **Territory** | Governments that control areas: the Cordon, the Hallow Line, Morrow. |
| **The Frontier** | *"Far away star systems where civilization is just beginning to arrive."* |
| **Lawless Sectors** | *"Regions between rival empires where no single group can enforce rules."* |
| **The Deep Void** | *"Empty areas between galaxies where no stars or stations exist."* |
| *(the front)* | Territory touching an enemy's territory: where the war is actually fought. |

### Two dials, not one

Danger splits in two, and the split is the rule that keeps the world a pure
function of its seed:

- **Nature belongs to the biome.** Rocks, wells, fields, worlds, caches and the
  rarity of what is in them. Every biome gets its own danger (the Wells, the
  Murk, the Warrens and the Boneyard are nasty; the Settled Reach and the Lanes
  are calm). This never moves, because a world is still its seed.
- **People belong to the owner.** Traffic, patrols, pirates, battles, who flies
  a station's flag, prices and repairs. This is what moves when borders move and
  what reads your standing.

Rewards follow danger wherever it is, so risky space still pays better.

### How the map is made

Built on the region lattice the biomes already use, so a border looks like a
biome border and never like a ring. Each power has a low-frequency influence
field over the region cells; a cell is held by the strongest power if that power
is strong enough and clearly ahead. Unheld cells are classified by their
neighbours: touching two or more powers → **Lawless**; near one power →
**Frontier**; near none → **Deep Void**. Prototyped over three seeds, the split
comes out around 60% territory, 25% frontier, 11% lawless and 2–5% void, and
every seed makes irregular empires with no ring anywhere. Still to tune: empires
fragment into too many separate pieces, and the void is too rare to feel like
the space between galaxies.

**Home sits in the Frontier**: nobody's yet, calm biome, one power's territory
within reach. A nobody starting out where civilisation is only just arriving,
and the two-minute test stays safe.

**Moving borders are stored as changes over the seeded map**, never as the map
itself: the book keeps only the cells that have changed hands, so space stays
endless and a save stays small.

### Seeing it  ·  *Ric's call, and it overturns BIOMES.md*

> *"the map needs a way to see all of this so we are going to give them some
> more information."*
>
> *"i think that it should tell you what ones your in on top right and when you
> go into a new sector or biome and scan then the borders of the sectors and
> biomes are up"*

- **Top right names both**, where the band used to be: whose space this is
  (CORDON SPACE, THE FRONTIER, LAWLESS, THE DEEP VOID) and which biome (THE
  MURK, THE BELT). BIOMES.md's rule that a biome is never labelled is
  **retired** by this; the chart's `region: null` and its "draws no regions"
  comment go with it.
- **Borders are learned, not given.** Only where you have been or scanned. Scan
  inside a territory or a biome you have not mapped and its borders go onto the
  chart. The map fills in the way the fog does.
- **A border you mapped can go stale.** When a cell changes hands after you
  scanned it, your chart still shows the old line until you go back and scan
  again. The chart is a record of what you saw, not a live feed.

### Build order

**A · The map.** Territory and the five kinds in `survey-world.js`; `BANDS` and
the distance curve removed; the two dials wired into all ~40 places that read
`dangerAt` today; stations fly their owner's flag (5.8's missing first piece);
traffic drawn from the kind of space it is in; the HUD label. The fingerprint
baseline in `test/fingerprint.js` is re-recorded **on purpose**, once: geography
changes when distance stops shaping it.

**B · Personal.** Your standing with the owner sets how dangerous their space is
for you. `standingOf` already has the five rungs.

**C · Borders move.** A war that ticks over the fronts: battles won and lost
flip cells, what the player does pushes on them, the Frontier gets settled,
Lawless gets claimed, and which powers are at war can change. Every change has a
cause the player could have seen (LIVING-WORLD.md's rule: no border moves without
an event behind it), and a crossing that changed hands says so.

A and C ship to players together; nobody plays a fixed map first.

### What landed  ·  *17 September 2026*

**A · the map, and C · borders moving, are built. B, personal danger, is not.**

- **The rings are gone.** `BANDS`, `bandAt` and `DANGER_FULL` no longer exist.
  `dangerAt` is `natureAt` (the biome's own `danger`) and `peopleAt` (the kind
  of space) averaged, floored and scaled so calm sky is near 0. Measured on seed
  112233: average danger 0.17 on a ring at 400k and 0.19 at 2.4M.
- **Home is four cells, not a circle.** The cells meeting at the origin are
  always ordinary space and always the frontier. Out of 120 bearings from home,
  at most 11 now leave home's biome at the same distance (it was 74).
- **The map**, measured over six seeds: roughly 40–58% territory, 21–34%
  frontier, 4–10% lawless, 2–10% front, 7–20% deep void. A front is either a
  power's cell with its enemy within three cells, or unheld sky between two
  powers at war (no-man's-land). Without the second the front barely existed,
  because the seam between two powers is unheld by construction.
- **Generation reads it.** Wells, rock and fields read `wildAt` (nature). Traffic
  count, pirate share and flags read the space. Battles happen at fronts.
  Stations fly the owner's flag and none are built in the Void. Inhabited
  worlds are 1 in 15 in territory, 1 in 23 on the frontier, none in the Void,
  1 in 19 overall.
- **Parts.** A part's `deep` is now compared with a station's *shelf depth*,
  its sky's danger divided by `SHELF_REACH` (0.8). Read raw, about one station in
  a thousand could stock the three 0.6+ parts, which is lost rather than rare;
  stretched, it is the stations in genuinely bad sky. The long list says where
  as CALM / ROUGH / DANGEROUS SPACE or THE WORST SPACE THERE IS.
- **Loot, guards and prices** read `depthAt`: danger × 1.4, capped at 1.3.
  They were tuned when most of a long game sat at the old depth of 1 or more
  (median 1.12 across the ladder). Read raw, the new median of 0.18 made the
  late game pay and guard like the opening, and rich caches went from 92% of
  the sky to 6%. Salvage richness, cache parts, rich caches, sentry counts,
  hauler cargo, sell prices, repairs and station shortages all use it. Text
  that said "further out" now says "bad sky".
- **Seeing it.** Top right names the space and the biome over a danger bar.
  Flying writes the cell you are in; a scan charts the whole biome patch and
  territory patch you are in, plus the first cell past each edge so both sides
  of a border are known. The chart washes territory, draws its borders solid,
  draws biome borders dashed once zoomed in, and names each patch once.
- **The war moves**, every 45 seconds over the cells within 12 of you. A won
  battle hands its cell to the winner. Fronts grind toward the stronger side;
  frontier and lawless sky get settled from next door, slowly. Strength wears
  down while fighting (and with every ship the player kills) and mends at
  peace. Two sides both under 0.55 declare a ceasefire; after fifteen minutes of
  peace the strongest power at 1.1 or more goes to war with the neighbour it
  touches most. Measured near a front over ninety minutes: an even war moves
  12–17 cells, a two-to-one war 50–65. Home cells never change hands.
- **Ships follow the flags.** Nobody docks at an enemy's station: haulers do
  not deliver there, ships in trouble do not run there, and patrols only keep
  the peace at their own side's docks and unflagged ones. A power's enemies no
  longer turn up as passing traffic inside its territory. A power you have
  angered hunts you at full speed in its own space, at about half elsewhere,
  and hardly at all in the Deep Void or its enemy's space (measured over two
  minutes: 10 hunters in its space, 2 in the Void).
- **Ships fly together.** Haulers run in convoys (one or two haulers, one or
  two escorts, more escorts in lawless sky and at the front), patrols fly in
  wings of two or three, pirates hunt in packs, and independents mostly fly
  alone. A follower holds a slot off its leader's quarter, the group cruises at
  its slowest hull's pace, a pirate pack goes for its leader's target, a patrol
  wing turns on whatever its leader is angry at, and convoy haulers unload when
  their leader reaches the station. A group only breaks up when its leader
  dies, runs dry or runs, not when it is just out of range. Measured over three
  worlds: 295 groups to 851 lone ships, about 11% fewer ships overall.
- **Pirates keep to the edges.** None three or more cells into a power's
  territory; 6% odds on its border cells, 1% two cells in. Deep in a territory
  it is the owner's ships and independents only.
- **Distress calls were half the sky in a border skirmish.** The role roll was
  divided by the war's heat (0.45), pushing most rolls past the distress line.
  It bends by a power curve now: 42 of 845 power ships across three worlds.
- **Stale charts.** Flying into a cell whose holder changed since you charted it
  says so: "You charted this as HALLOW SPACE. It is CORDON SPACE now."
- **Saved:** `claims` (only the cells that changed hands), `mapped` and `war`,
  all validated key by key in `survey-save.js`.
- **Deliberately changed geography.** Every existing save's sector is rebuilt
  from its seed with the new rules, so a save made before this sees different
  stations, worlds and wells in the same places. `test/fingerprint.js` will
  not match the old hashes, and is not meant to.

**Still open.** B (danger that depends on your standing with the owner). The
panel minimap draws no borders, only the full chart does.

---

> What already existed, the bugs found early, what was wrong with the first version, and **Phase 1** — built, and moved to [`archive/SURVEY-BUILT.md`](archive/SURVEY-BUILT.md).

## Decisions taken since this file was written

**The currency is cash.** It is what buys ships, food and refits. Right now the
loose pickups *are* cash, capped by the cargo hold. Phase 3 splits that properly:
metals become the cargo you carry, and cash becomes the money you get for
selling them. Doing half of that split early would have left the game with two
half-explained resources, so it waits for 3.1.

**Seeds make different worlds, not different arrangements of one world.** Every
sector used to put its landmarks at the same distances in the same order at the
same densities — only the bearings moved, and it showed. A world now rolls a
*character* before anything is placed: the ladder stretches or compresses, every
kind of thing has its own abundance, and the rungs are dealt in a shuffled order.
Measured across eight seeds, sector size varies 1.9×, four different landmarks
turn up nearest, and every seed names itself something different. The Leviathan
is held to the last rung, because it is the finale and the yard's last part is
inside it.

**The chart remembers.** It used to draw straight from the streamed lists — five
chunks either side of the ship — so it showed what was already on screen and
forgot everything else. Notable places are now written into a gazetteer as you
pass them, kept in the book, and drawn with typed glyphs and a legend built from
the same table as the marks.

**The yard builds a light drive.** A fetch quest with no stated prize is a chore.
Finishing it lets you jump, from the chart, to any station you have already
charted — so the reward for mapping is that the map starts working for you, and
every station stumbled across on the way is worth noting.

**Two new pages.** An inventory on `I` and a button under the panel chart —
cash, what you are carrying, the ship's refit, the manifest with clues, and what
the almanac has bought. And a yard page when you dock at it, saying what is being
built, what it will do, and which parts it is still short of. Food and water go
on the inventory page **when they exist**; a meter that does not move is worse
than an honest gap.

**The bearing readout is gone.** "BEARING 191 · a long way out" sat on the busiest
part of the screen and told you nothing you could act on. Direction lives on the
chart, where directions belong.

---

> **The places, Phase 2, the quiet screen and the drive, what playing it turned up, Phase 3, Phase 4, and the pages on one grid** — built, and moved to [`archive/SURVEY-BUILT.md`](archive/SURVEY-BUILT.md).

## The loop, stated

> **Explore → find stuff → bring it home → improve your ship → go farther.**

Ric's sentence, and it carries the whole game. Everything below is judged against
it: a feature that does not sit on one of those five verbs is a feature that is
making the game bigger rather than better. The five long-term tracks in Phase 5
are the same sentence read as *progression* rather than as a loop.

---

## Phase 5 — consequence, and things worth going out for

The next phase. Everything here came out of playing it, and the shape of it is
that the mode currently rewards going farther but does not yet make going farther
*change* anything about how the sector treats you.

> **5.1, 5.1a–c** and the old ladder — built, and moved to [`archive/SURVEY-BUILT.md`](archive/SURVEY-BUILT.md).

## How the rest of Phase 5 is shaped

Ric's constraint, and it is the most useful thing in this file:

> The ship can stay very simple: **health, cargo, equipment slots, movement.**
> Stations give you **storage, buying/selling, repairs, and maybe
> crafting/installing parts.** That's enough.
>
> Instead of research trees, reverse-engineering systems, component
> subcomponents, multiple currencies, station specializations — **just have parts
> and materials.**

So the whole of the rest of this phase is two nouns. A **part** is a thing you
find or build and fit to a ship. A **material** is a thing you carry and spend.
There is no third noun, and anything that wants to be one has to earn it by the
game demonstrably needing it.

That still holds after 5.4 allowed a recipe to consume a finished part. A part
made from a part is **still two nouns** — no subcomponent was invented, nothing
exists solely to be an ingredient. It is the same part you could have flown.

**Explicitly not building:** research trees. Reverse-engineering. Components
inside components. A second currency. Stations that each do a different subset of
the same jobs. Every one of those is a menu pretending to be depth.

> **Two things this contradicts, flagged rather than quietly resolved.**
>
> *Cargo upgrades.* "Storage bay shouldn't be upgradeable, that only changes with
> the ship" — already done, the refit track is gone. But "cargo upgrades" is in
> the parts list below. The reading that satisfies both: you cannot *buy tiers* of
> cargo, and a **found part** that adds capacity is a different thing and fits the
> parts-and-materials model. Worth confirming before it is built.
>
> *Station specializations.* Ruled out — but stations already pay different
> prices for materials, which is what makes carrying a load somewhere worth
> doing. Reading that as price variation rather than as "this station only does
> shipyards" keeps both. Nothing about what a station *does* should vary.

> **5.2, 5.2a, 5.3 and 5.4**, what each of them landed, ships staying at home, and the off-screen arrows — built, and moved to [`archive/SURVEY-BUILT.md`](archive/SURVEY-BUILT.md).

### 5.5 Cargo crates, and towing

The idea Ric liked best, and the reason is that it is physical rather than
administrative: **your hold fills up, so you either leave things, sell things, or
tow a crate home.**

A crate is an object in the world. You attach to it, it slows you down, and you
drag it back. No new menu, no second inventory — the decision is made by flying,
which is the only place this game should be making decisions.

It is also the honest answer to "more cargo capacity" as a progression track: a
bigger hull carries more, and a tow carries more than any hull, at the cost of
handling and time.

> **5.6 and 5.7** — built, and moved to [`archive/SURVEY-BUILT.md`](archive/SURVEY-BUILT.md).

### 5.8 Loose ends, so they are not lost

- **Better station storage** — somewhere to leave what you are not carrying, so a
  full hold stops being the end of a trip. A ship you are not flying is also
  storage — including the four parts left fitted to it. **Sharper now than when
  it was written**: the crate of spare parts used to be the escape hatch, and
  merging it into the hold closed it. There is nowhere to leave anything.
- **Stranger things farther out** — the danger curve has promised this since Phase
  1 and not paid it. The abyss is *harder* than the home band, not yet *stranger*.
  5.2's "only found very far away" parts are the first instalment.
- **Food from somewhere other than a station** — the ice melter answers water.
  Food has no equivalent yet.
- **A price belongs to whoever runs the shop** — *"it should be based off of
  factions eventually. and stuff that isn't in factions is expensive. maybe one
  faction is cheap or something."* Everything a station sells is priced off two
  things today: how far out it is, and what it is short of. Neither of them is
  *who runs it*. The missing piece is small and it is first: **a station has no
  flag at all** — it is an x, a y and a phase — so before any of this there is a
  faction on the station and a colour on the dock.

  After that the ladder is already built. `standingPay` is a five-rung table
  that turns your standing with a power into a multiplier, and it is currently
  read by exactly one thing: what a rescue pays. The same table should decide
  what that power's yards *charge* — TRUSTED mends a hull for less than NEUTRAL
  does, WANTED pays a surcharge for the privilege of being served at all — so
  reputation stops being a thing you read on a page and becomes the number on
  the button. **UNALIGNED is dearer than any of them**, because a place with no
  power behind it has no reason to do anybody a favour, and it is the honest
  cost of a station out where the three of them do not reach. And **one power
  runs cheap**, rolled as a trait of the world the way the war scale and the
  eight abundances already are, so "the Morrow yards are cheap in this sector"
  is a fact about where you have ended up rather than a constant.

  It touches five things at once, which is the Phase 6 test passing: the mend
  price, the water, the food, the parts on the shelf, and the question of which
  station is worth flying to — because the nearer one is no longer automatically
  the cheaper one. It also gives reputation a cost you feel every dock rather
  than only when somebody shoots at you.

- **Trading with ships** — *"You should be able trade with friendly ships as well.
  So get close hit E. Or tap them if on mobile and have a UI for trading goods. Or
  buying goods from them. They may be more pricey then stations."* The `trades`
  flag is on the traders already and the roles that carry cargo carry real cargo;
  what is missing is the approach, the prompt, and the page. **Next up.**

> The proper mobile game, settings per mode (superseded) and the one settings page with a rail — built, and moved to [`archive/SURVEY-BUILT.md`](archive/SURVEY-BUILT.md).

### The five long-term tracks

Ric's list, and the shape of every hour after the first:

1. **Better equipment** — the modules of 5.2, and the ones after those.
2. **More cargo capacity, and towing** — a bigger hold is the simplest reason to
   go farther, and towing is the version of it that changes what you can *do*
   rather than only how much.
3. **Better station storage** — somewhere to keep what you are not carrying, so a
   full hold stops being the end of a trip.
4. **More recipes and craftable parts** — 5.3 is the first one; the track is the
   rest.
5. **Stranger and rarer things farther out** — the payoff the danger curve has
   been promising since Phase 1. The abyss is currently *harder* than the home
   band; it is not yet *stranger*, and it should be.

---

> The jump gate, the book-is-a-whitelist bug, and the Phase 5 bug hunt — built, and moved to [`archive/SURVEY-BUILT.md`](archive/SURVEY-BUILT.md).

## Phase 7 — the interface, properly

Everything below came from playing it. Phases 1–6 built systems and hung a page
off each one; the result is eight pages that each make sense alone and do not add
up to something you can hold in your head. This phase is about the whole, and the
rule under all of it is Ric's: **simple, and showing exactly what is needed** — on
a phone and on a desktop, both.

> **7.1–7.15**, and everything built from the cockpit since, up to the Leviathan coming in to 40,000 — built, and moved to [`archive/SURVEY-BUILT.md`](archive/SURVEY-BUILT.md).

### The Leviathan is a ship you can buy  ·  *the brief, not yet built*

> *"this ship should be flyable. it moves kinda slow. has 4 attatchments. it
> should have like 5 guns on it and the engines need to spout out small pixels
> when being used. these ships need to be collored unless they are distroid like
> the first one you find. but they can also be in wars and battles. so you can
> accidentaly run into actual ones that have even extra turrets. if your really
> on the good side of the team you can fly in it if your nuetral you cant fly in
> it without them shooting you adn if ur wanted they will try to shoot you down.
> i want this ship to be playable by the player as well and purchasable. maybe
> can only be baught at the city biome. also when you controll it you obviosly
> are going to have to zoom out. i want it to turn slow too but its health to be
> enormous. if its in a battle i want you to still be able to destroy it."*

The hull now exists as real geometry rather than as scenery, which is what makes
all of this possible — but everything below is *unbuilt*, and the order matters
because each item is load-bearing for the next.

**What it already has.** The shape, the plates, the interior, the collision, the
two engine throats, and a builder that can produce her whole or wrecked. She is
**5,980 stem to stern** — cut 35% from 9,200 on Ric's call, through a single
scale factor so every proportion held. That is the model. None of the rest
exists, including the ability to move.

**1 · A live Leviathan, flying, in a faction's colours.** **Rare**, and *less
rare in the city* — THE WORKS is where they are built and where a capital ship
is an ordinary sight, so seeing one out in open space should be an event and
seeing one over the city should not. Nothing of this exists yet: the only
Leviathan in the game is the single derelict landmark, and it does not fly, does
not belong to anybody and cannot appear in a battle. The one out at 40,000
is a derelict and stays grey; a *live* one is the same geometry in its owner's
colour, under power, going somewhere. The renderer takes one hardcoded grey today
and needs a colour off the flag, with the wreck keeping the grey it has. This is
the cheapest item and it unlocks the three below, because "a Leviathan" stops
being one object in one place.

**2 · Guns, and turrets on the live ones.** Five, built into the hull rather than
fitted — and that is a *stated exception* to "every trick is a part", because a
capital's main battery is part of the ship the way its engines are. The four
slots still apply and still mean what they mean. A live one carries extra
turrets on top, which is where the campaign's turret code earns a second use.

**3 · Standing decides what happens when you approach.** The ladder exists —
`standingOf` already turns reputation into five rungs — and this is the first
thing in the mode to read it as *permission* rather than as price:

  - **TRUSTED / WELCOME** — you can fly inside. The door is a door.
  - **NEUTRAL** — you cannot, and going in anyway is what starts it.
  - **WANTED / HUNTED** — it comes after you, and it is nine thousand units of
    ship that wants you dead.

**4 · Destroyable.** It has to be able to die in a battle in front of you, which
means hull points on a structure that is currently indestructible scenery, and a
death that is a set-piece rather than a despawn. Enormous health, and enormous is
a number that has to be chosen against how much damage a player can actually put
out in a minute.

**5 · Buyable, and only at the city.** THE WORKS is the biome for it — the one
place in the sector with the industry to sell you a capital ship, which also gives
the city a reason to exist beyond scenery. The price should be the longest
number in the game.

**6 · Flying it — and it has to move at all.** Today she is scenery: a landmark
pinned to a chunk with her collision discs computed once, in world coordinates,
at build time. Nothing about her can move, which is the first thing that has to
change and the one that touches the most — a hull that moves means discs that are
rebuilt or offset every frame, and everything that asks "what is solid here" has
to keep up.

Slow to move, slower to turn, and the camera has to pull back
a long way — the empty room's two extra zoom steps (FAR, THE WHOLE HULL) stop
being a debugging tool and become this ship's ordinary camera. The engines throw
sparks when they burn, which is the one piece of this that is pure drawing.

#### The hard part, stated up front

**Everything in Survey assumes the player's ship is small.** A Leviathan is 9,200
units long; a chunk is 2,600, a station's docking ring is 260, a gate's mouth is
smaller than that, and the streamer keeps a 5×5 block of chunks around you. A ship
four chunks long cannot dock, cannot take a gate, cannot be held by the streamer's
box, and cannot be drawn by a camera that assumes it fits on the screen.

So this is not "add a hull to the list". It is that, plus a pass over docking,
gates, streaming, the chart and the camera to stop them assuming a size. The
honest options are a **scaled-down capital** that plays by the existing rules, or
**the real thing** with those systems taught about size — and the second is the
one worth doing, because the whole feeling being asked for here is the size.

---

## At the end of Phase 7: go back to Phase 6

**Read this before starting anything new.**

Phase 7 is the interface. It was worth doing in one run because the pages only
make sense against each other — moving the strip changed every page, merging two
pages changed what the others had to link to, and the market could not be a market
while the shortage from 6.2 had nowhere to show.

**What is left of 7**, and it is small:

- **7.9's other half** — the *wording*. The log exists; the lines in it still
  assume you were watching. "They made it. 260 cash, and their thanks." is the
  example: it is the only line of Phase 7 still owed, and it is an afternoon of
  rereading every `chatter()` in the file and asking whether somebody who looked
  away for ten seconds could parse it.

Everything else in 7 is done: the pages, the market, the chart's rail, the four
slots, the scan button, the log, the info card, and the touch control for the
reverse thrusters.

**Then go back to 6, and in this order:**

1. **6.6 — authored mysteries.** Eight places where the brief asks for dozens, and
   it is the track with the highest ceiling and the least code: a name, a shape, an
   almanac entry and a reason. It is also where 6.7's **tier five** lives — the
   three entries that should make somebody say *what the hell is that* — so the
   almanac's far end is blocked on this and nothing else.
2. ~~**6.4 — verbs, not percentages.**~~ **Done**, all seven: the cargo ejector,
   the decoy launcher, the mine layer, the emergency jump, the grapple line,
   silent running and the EMP charge — on a device layer with a cooldown, a
   rebindable key per slot and a thumb button per slot. See *What 6.4 landed*.
   Nothing left on the list.
3. ~~**6.5 — consequences that persist.**~~ **Done.** The three cheap wins named
   here were built: a ship you saved keeps its name and comes back, a pirate
   that escaped is respawned as itself with the damage you did, and anything
   that dies in front of you leaves a hull to strip. See *Where Phase 6 actually
   stands*.
4. ~~**6.3's last gap**~~ **Done.** NPCs run out of water, and a well kills
   them — traffic carries a drift, loses its dodge while chased, and is
   swallowed if it loses. The hauler dragged into a star is in the game.

So of the four things this list queued, **only 6.6 is still open.** It was
written when 6.3 and 6.5 were, and they closed underneath it.

The filter still applies to all of it: *what three other systems does this touch?*

---

## Phase 6 — possibility multiplication

Ric's brief, and it is a different *kind* of instruction from everything above.
Phases 1–5 are lists of things to build. This one is a rule about how the things
already built should relate to each other:

> **Almost every important system should be capable of affecting at least three
> other systems.** That's how you get possibility multiplication rather than
> feature addition.

The rest of this section is that brief, kept close to how it was given, with an
honest note under each on where Survey actually stands.

### 6.1 NPC ships need simple wants, not complicated AI

> A trader wants to reach another station with cargo. A pirate wants valuable
> cargo. An escort wants its client alive. A patrol responds to threats. A damaged
> ship wants safety. A scavenger wants wreckage. A faction wants to protect routes.
> Nothing needs ChatGPT-level intelligence; they just need **goals that can
> collide**.

*Where it stands.* Half done and the wrong half. 5.1 gave every ship a `role` and
a `faction`, and roles already differ in temperament — armed or not, a personal
space bubble or not, flees or fights. What they do **not** have is a *want*. A
freighter walks a line between two points it was born with; it is not going
anywhere in particular and nothing it is carrying matters to it. A pirate is
hostile rather than *acquisitive* — it does not prefer the loaded hauler to the
empty one.

The work: give each role a want that references the world rather than a route.
A trader wants **that station**. A pirate wants **that cargo**. An escort wants
**that ship** alive. Then stop writing behaviour and let the wants meet.

### 6.2 The economy should respond to events a little

> A station needs water. Convoys supply it. Pirates destroy several convoys. Water
> becomes scarce there temporarily. Patrol activity increases. Traders reroute
> because the price is attractive. Pirates follow those traders. Suddenly the
> player's boring "take water somewhere" trip intersects with an actual situation.

Ric's own caveat, and it is the right one: *"The current plan deliberately keeps
station functionality simple, which I agree with, but completely static economics
would leave a lot of emergent potential unused."*

*Where it stands.* Prices already vary **by place** — the deep pays more for
iridium, a deep station stocks the strange parts, repairs cost more a long way
out. Nothing varies **by event**. Nothing that happens near a station changes
anything about it.

The smallest version that would earn its keep: a station holds a short list of
what it is short of; a convoy destroyed near it deepens that shortage; the
shortage moves its prices and pulls patrols in. Three systems touching, no new
interface.

### 6.3 World objects should obey universal rules

> Gravity affects everyone. Cargo can be stolen, abandoned, destroyed or towed by
> anyone. Weapons can hit things other than their intended target. Ships can run
> out of something. Wreckage remains useful. Environmental effects should affect
> NPCs too. **This produces accidents and opportunities instead of scripted
> events.**

*Where it stands.* The best-covered of the six, and worth protecting. Gravity is
already universal. A friendly round already destroys other traffic — that is how
the war is fought in front of you. Wreckage is already useful: a battle leaves
hulks you can strip. A burst charge already takes whatever is standing near what
you aimed at.

The gaps: **NPCs cannot run out of anything** — no fuel, no water, no ammunition —
and a well does not kill them the way it kills you. A hauler dragged into a star
in front of you would be exactly the accident this rule is for.

**Both closed.**

*Gravity was universal in the code and not in the sky.* It applied to everything
with a velocity — you, rocks, bullets, salvage, the debris falling into a well —
and traffic was the one class that flies on a heading and a speed instead. So a
hauler crossed a black hole's reach dead straight while you fought the same well
two hundred units away. Traffic carries a **drift** now: a velocity nothing but
gravity ever writes, added to wherever its engine was taking it, bled off once it
is clear. A ship under power out-flies a shallow pull and cannot out-fly a deep
one — the same arithmetic the warning already does for you, and the same answer.

And they **steer round** what they can see, which is what makes the deaths mean
something. Three states get no dodge: angry, running from you, and being hunted by
somebody else. So a lane bends politely around a star, and a chase goes straight
through it. **The accident is now the consequence of the chase**, not of a die
roll — and a ship swallowed leaves nothing, because it is inside a black hole.

*Running out.* The interesting question was never the clock, it was **why** a
hauler runs dry. A background timer would put dead ships all over the sector and
mean nothing. So the reserve only burns while the ship is in trouble — chased,
running, being shot at, fighting a well — and refills while it is getting on with
its day. **Three systems can strand a ship: pirates, gravity, and you.** A
drifting hauler is therefore evidence that something happened here.

What you can do about it is the part that touches three more. **Hand water
across** — two hundred seconds out of your own tank, which is a sixth of how long
you can stay out. They pay, their flag warms to you, and they finish their run.
Refuse and it dies in about four minutes, leaves a hull you can strip, and the
station it was carrying to goes short — which moves the price, which is 6.2
answering. You cannot give away water you need yourself, and the prompt says so
rather than going quiet.

*And the spine underneath both:* a **persistent wreck list**. `surv.hulks` is
emptied and rebuilt from the seed every time you cross a chunk boundary, so
anything that died because of something that *happened* had nowhere to live. It
lives in `surv.wrecked` now, is written into the book, survives the tab, and is
forgotten when stripped. Sixty of them, oldest dropped — which is also the first
half of 6.5.

### 6.4 Parts should create verbs rather than percentages

> A **+12% engine** eventually becomes boring. A decoy, grapple, mine layer,
> emergency jump module, cloak, tractor modification, EMP, cargo ejector or weird
> alien drive changes what you can *do*. Noita's possibility space comes largely
> from **recombining capabilities**, not from increasing damage numbers.

*Where it stands.* **Four of the seven built.** What was here before was the
honest admission that 5.2 had partly gone the wrong way: most of the parts were
numbers — +14% speed, +2 hull, +70% scan — and the handful that were verbs were
the good ones.

> **What 6.4 landed** — built, and moved to [`archive/SURVEY-BUILT.md`](archive/SURVEY-BUILT.md).

### 6.5 Consequences should persist enough for the player to remember them

> Save a particular captain and maybe you encounter that ship again. Destroy a
> convoy and later encounter the wreck. A battle creates a memorial. A pirate you
> failed to kill shows up somewhere else. A station temporarily suffers because
> something happened nearby.

*Where it stands.* Started, in exactly one place: **battles end and about one in
three leaves a named memorial on the chart**, which is the shape this rule wants.
Reputation persists per power. Everything else is forgotten — a rescued distress
call becomes an anonymous freighter, a pirate that got away is gone for good, a
station never suffers.

The cheap wins, in order: a ship you saved or spared **keeps its name and comes
back**; a pirate that escaped is re-spawned rather than re-rolled; a convoy you
destroyed leaves a wreck field where it died.

**All three done**, on one rule: *a consequence you can name is a consequence you
remember.* If you can say which ship it was, it happened; if you cannot, it was
weather. So almost nothing out here is named — a sector where every freighter
introduces itself is a cast rather than a place — and a name is what a ship earns
by being part of something.

**A ship you saved keeps its name.** It gets one the moment you save it, whether
you cleared the sentries off a distress call or handed water to a hauler that had
run dry. It goes in the book. Later, a freighter of the same flag can *be* it —
tagged as it streams in rather than spawned, because a chunk is a pure function of
its coordinates and has no business knowing whose distress call you answered. One
in four of the matching ones, at most one on screen at a time: the point is a face
you recognise, not a cast of characters.

And it pays the favour back **in water** — the only repayment that means anything
in a mode where water is what limits how far you can go. Once per ship, and only
when you are under a quarter of a tank, so it cannot be farmed.

**A pirate that got away comes back for you.** Hurt one and it is marked as yours
and given a handle on the spot. If it leaves the loaded window alive, that moment —
the only moment at which "it got away" is a fact rather than a guess — writes it
down with the hull points you left it. It returns as a hunter: not a fresh pirate
of the same class, *that one*, with its hull and its damage. You are favoured to
win the rematch; it knows that and comes anyway.

**A convoy you destroyed leaves a wreck field**, via the persistent wreck list
built for 6.3. And all three are readable on one panel on the ship's page — **WHO
KNOWS YOU** — which is two short lists of names and never a count of anything. A
tally would turn both of them into scores.

They are also askable: stand next to one and press `E`, and 7.8's card tells you
what you did and what is still owed.

### 6.6 Handcrafted mysteries should sit on top of the simulation

> **This is important.** Pure procedural generation eventually shows its seams.
> Caves of Qud combines handwritten story and worldbuilding with physical,
> factional and procedural simulation, which is part of why its world can surprise
> players for so long. Survey should probably have **dozens** of extremely rare
> *authored* weird things — the Leviathan is already an example — embedded in an
> otherwise systemic universe.
>
> **That last one is crucial.**
>
> Don't try to procedurally generate everything. Use procedural systems to create
> the journey. Use handcrafted things to occasionally make the player say:
> *"What the FUCK is that?"*

*Where it stands.* There are **eight** authored places — the Leviathan, the Wall,
Node 01, the supernebula, the graveyard, the rogue world, the pale dot, the last
transmission — and they are the best things in the mode. Eight is not dozens.

This is the track with the highest ceiling and the least code: an authored thing
is a name, a shape, an almanac entry and a reason. No system needs building. The
one rule it must keep is the one it already keeps — an authored thing sits *in*
the procedural sector rather than replacing a piece of it, so finding one is an
accident of where you flew.

> **6.7**, the almanac's ladder (its tier 5 is 6.6, still open above) — built, and moved to [`archive/SURVEY-BUILT.md`](archive/SURVEY-BUILT.md).

### Where Phase 6 actually stands

Nothing in it has been *built as Phase 6* — it is a filter, not a queue — but four
of the seven have moved, some of them a long way, as a side effect of the work
since. Measured rather than remembered:

| | | |
|---|---|---|
| **6.1** NPC wants | **DONE** | Every role has a want and none of them is longer than a few lines. A trader wants a station that is short of what it carries. A pirate wants the *laden* one. An escort wants its client alive. A patrol wants whatever is causing trouble. A scavenger — a new role — wants wreckage, including the wreckage you were going to strip. Put three in one piece of sky and the pirate closes, the escort breaks off, the patrol answers, and you arrive in the middle of something nobody scripted. |
| **6.2** a reacting economy | **DONE** | A station is short of one or two things, rolled from where it is and then moved by what happens. A convoy through eases it; a convoy destroyed near it deepens it; time drifts it back. A shortage is a price and a price is a reason to fly somewhere — measured, killing an iridium convoy at the door took iridium from 23 to 44, and one getting through brought it back. **Pirates make prices.** |
| **6.3** universal rules | **DONE** | Rocks break on worlds and part from each other; traffic and sentries go round worlds and round the Leviathan; stations and inhabited worlds deflect; an asteroid is a solid object rather than a damage event; friendly fire destroys other traffic. And now: **gravity is universal in the sky as well as in the code** — traffic carries a drift, steers round wells when it has the attention to spare, gets no dodge while it is being chased, and is swallowed if it loses. **Ships run out of water** when something goes wrong for them, and a drifting hauler is a situation you can spend your own tank on or strip four minutes later. |
| **6.4** verbs not percentages | **DONE** · fifteen of twenty-eight | Eight were verbs — three weapons, two tractor rigs, reverse thrusters, the ice melter. Seven more are the device layer, each with a cooldown, a rebindable key on its slot and a thumb button on its slot: **cargo ejector, decoy launcher, mine layer, emergency jump**, and now the last three off Ric's own list — **grapple line, silent running, EMP charge**. Every one is a verb by the three-systems test. The ejector moves pirates, the decoy moves sentries and seekers, the mine moves collision, the jump moves the danger curve. The **line** moves *you*: it hooks anything solid in front of the nose and hauls, which is a way out of a well that is not a bigger engine and the fastest way down a Warrens tunnel. The **cloak** is ten seconds of not being there — a sentry loses you, whoever is chasing you *forgets* rather than pausing, and firing ends it, which is what keeps it an escape rather than an ambush. The **burst** stops everything electric inside 1,100 units — sentries, mines, and every engine and gun in reach — **including your own four slots and your scanner**, which is the cost that makes pressing it a decision. |
| **6.5** consequences persist | **DONE** | Battles end and one in three leaves a named memorial. Reputation persists per power. A part you die carrying stays where you fell. Anything that dies in front of you leaves a hull you can come back and strip, written into the book rather than into a chunk. **A ship you saved keeps its name, comes back, and repays you in water once.** **A pirate you hurt and let go is remembered with the damage you did and returns as itself.** All of it readable on WHO KNOWS YOU, and all of it askable with `E`. |
| **6.6** authored mysteries | **eight places** | Where the brief asks for dozens. Highest ceiling, least code, and 6.7 below is now the concrete plan for it. |
| **6.7** the almanac's curve | **diagnosed, not fixed** | Ten minutes of throttle reaches 344,617 units and the finale sits at 112,000. The ladder is a thirtieth of the size it needs to be. |

The honest summary: **6.1 through 6.5 have happened.** 6.4 was the last of them
to close and it closed on the three parts Ric named at the start of the phase —
a grapple, a cloak and an EMP — so the list the filter was written from is now
empty.

What is left is **6.6**, the authored mysteries: eight places where the brief
asks for dozens. It is still the one with the highest ceiling and the least
code, and still the only thing blocking the almanac's far end.

### How to read Phase 6

It is a **filter**, not a queue. Nothing in it is next; everything in it is a
question to ask of whatever *is* next:

> *What three other systems does this touch?*

A part that only changes a number, a station that only sells, an NPC that only
flies its line — each of those is a feature added. The rule says to keep looking
until it is a system multiplied.

---

> **Coming back to where you were, the account, and the simulators and their two boards** — built, and moved to [`archive/SURVEY-BUILT.md`](archive/SURVEY-BUILT.md). One thing is still owed there, and it is not code: `supabase/schema.sql` has to be run once before the witnessed board reads anything.

## Rules for building this

1. **One item at a time.** Finished, tested, committed, before the next starts.
2. **Tests for anything that can rot silently.** Numbers, placement, curves and
   state machines get a test. This mode has already shipped four bugs that
   rendered perfectly — an invisible salvage painter, a cache inside a wall, a
   wall closing to eight per cent, shake that never decayed.
3. **Every system has to be readable from the screen**, before it is clever.
4. **Nothing gets built that the two-minute test cannot survive.**
