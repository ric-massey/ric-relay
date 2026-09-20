# SURVEY — the build plan

Survey started as a quiet mode with no enemies and no losing. It is becoming a
**survival exploration game**: you start at a station, you go out, it gets more
dangerous the further you go, and things out there can kill you.

This file is the whole plan, in the order it gets built. One item at a time,
each one finished and tested before the next starts — the mode is already large
enough that half-built systems hide each other's bugs.

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

## What already existed

The state of the mode when this file was written, kept as the baseline every
"what actually landed" section below is measured against:

- Endless chunked space, pure from a seed; a fog chart with pins; a 33-entry
  illustrated almanac.
- Solid bodies (planets, hulks, the Leviathan) with real collision.
- Salvage, a four-track refit at stations, three almanac-unlocked verbs
  (tractor, warp tuning, running dark).
- The yard: six parts, each with a clue, each with generated scenery to match.
- A scan that sweeps a radius and reports what is inside it.
- Guarded caches, sentries, wormhole gates, a parallax starfield.
- Danger scaling with distance from the origin.

## Bugs found and fixed since this file was written

Kept because two of them were the kind that render perfectly and rot silently,
which is the class rule 2 below exists for.

- **The economy read zero everywhere.** The `salvage` → `cash` rename went
  through the store and the interface and stopped on the one line joining them,
  so every readout fell back to zero while the hold behind it filled up and
  quietly stopped taking motes. HOLD FULL could never fire. There is now a test
  that cross-references every field the panel reads against every field the game
  sends.
- **The yard button never drew,** because `atYard` was never sent — so a phone,
  which has no `E` key, had no way into the yard page at all.
- **The light drive did nothing.** Six parts carried home for a reward that was
  wired up in the engine and never reached the interface: `onJump` existed and
  nothing ever called it. It arms from the chart now.
- **The jump coil could not be picked up.** Its gate mouth sat exactly where the
  part lay, and a gate swallows you at 82 units where a part is collected at
  about 60 — so flying to the coil threw you across the sector every time. The
  mouth stands beside the site now, and no gate may take you while you are over
  any uncollected part.
- **The mode's three keys were drawn 12px below the bottom of the canvas** and
  had therefore never once been visible.
- Five overlapping-text and dead-tap-target bugs across the chart, the station,
  the inventory and the objective band.

## What was wrong with it  ·  *all four addressed*

The four complaints this plan was written to answer. Kept because they are the
argument for everything below them, and because a plan that deletes its own
premise is a list of features.

- ~~**No stakes.** Losing your hull costs a trip, not a run.~~ The hull runs to
  zero and stops there, and the next thing that touches you kills you. Phase 2.1.
- ~~**Too many hazards, all the same size.**~~ Wells cut to 0.18 a chunk with
  black holes down to a third of that, sized by band, and every supermassive one
  named and charted. Phase 1.2, and the places pass.
- ~~**Too close in.**~~ Drawn at 0.72 with five steps in Settings, and the ship's
  own size pulls it back further. Phase 1.3 and 3.4.
- ~~**Too much to read.**~~ The objective band is gone, radio and logged cards and
  the objective are one notification stack, the bars are gone from the panel, and
  the opening teaches by arranging for you to want things. The quiet screen, and
  Phase 4.2.

---

## Phase 1 — make the sector legible and lethal  ·  **DONE**

### 1.1 Define deep space  ·  *numbers, not vibes*  ·  done

Distance from the origin is the difficulty dial. It is currently a smooth curve
topping out at 90,000 units, which is too shallow and too short. The bands:

| Band | Units from origin | What it means |
|---|---|---|
| Home | 0 – 6,000 | The starting station. Nothing hostile. Water and fuel are cheap. |
| Open | 6,000 – 25,000 | Light traffic, small wells, the first two yard parts. |
| Unsettled | 25,000 – 60,000 | Sentries in numbers. Asteroid fields. Stations start charging more. |
| Hostile | 60,000 – 140,000 | Large wells. Fields are dense. Salvage is worth double. |
| Deep | 140,000 – 320,000 | Supermassive wells that will kill a stock ship outright. |
| Abyssal | 320,000+ | No stations. Nothing charted. Everything here is the best and the last. |

The curve is smooth *inside* those bands — no seams, nothing switches on — but
the bands are named on the HUD, because "UNSETTLED" is something you can make a
decision about and `0.47` is not.

### 1.2 Fewer hazards, bigger, and they warn you  ·  done

Cut the number of gravity wells hard and make the survivors matter.

- Roughly a third as many per chunk as today.
- Size classes that actually differ: a small well is a nuisance, a supermassive
  one is a region of the map you plan around.
- Size scales with the band. Abyssal space has wells the size of a screen.
- **Proximity warning.** When a well's pull at your position exceeds what your
  drive can escape, the HUD says so — a ring, a bearing, and a word. This is the
  single most important readability fix in the phase: a well that kills you
  without warning is unfair, and a well that warns you is a decision.

### 1.3 Camera  ·  done

- Default zoom out, so a well is visible before it is a problem.
- A zoom control in Settings, persisted, so you can pull it in if you prefer.
- Later, ship size feeds into this (see 3.4).

---

### What Phase 1 actually landed

- Six bands to 320,000 units and past it; the curve keeps climbing into the
  abyss rather than flattening at the edge of the table.
- Wells cut from three chunks in five to about one in five, and given sizes:
  they run near 0.85 at home and past 3 in the abyss, with mass climbing as
  `k^2.6` so a big one pulls harder at its rim rather than merely being wider.
  Measured: average reach 377 units at home against 1,033 deep.
- A warning that compares the pull where you are actually sitting against what
  your own drive can push, in three steps up to CANNOT ESCAPE. A fully refitted
  drive drops the same well from 0.63 to nothing, which is the clearest
  demonstration in the game of what that upgrade bought.
- Survey drawn at 0.72 by default with five steps in Settings, persisted. Other
  modes are untouched at 1:1.
- Salvage pickup widened to thirty units past the hull. Breaking the rock was
  the game; threading the mote afterwards is not.

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

## The places  ·  **DONE**

Everything below came out of playing it. The theme is one thing: the sector is
full of objects you fly past without ever looking at, and a place you do not
look at is scenery. Each item is a way of making one of them worth a second
glance — or of removing it, which is the same fix from the other side.

### A. Planets  ·  *fewer, far bigger, and named*  ·  done

Planets are currently small, numerous, identical and anonymous, which is three
of the four things a landmark must not be.

- **Far fewer.** They are the most common thing in the sector after rocks and
  they are the least interesting. Cut hard.
- **Massive.** A planet should fill a good part of the screen at survey zoom.
  A world you can mistake for a big asteroid is not a world.
- **Sizes that differ by a lot.** Not a 110–200 spread. Something an order of
  magnitude across, so "that one is *enormous*" is a thing you can say.
- **Different colours, and different surface lines.** Banding, terminators,
  ring lines — whatever it takes that two planets never read as the same paint.
- **Names.** Gibberish is fine and probably better; a pure function of position
  so a world keeps its name. Floating in words around the planet, not in a HUD
  label.
- **Inhabited, about one in twenty.** Says so, in those floating words. This is
  also the hook Phase 2.4 needs — an inhabited planet is where water and food
  will be bought — so the flag wants to exist before that phase starts.

### B. Wormholes  ·  *rare enough to be an event*  ·  done

Gates are two-way now, which makes them a route rather than a thing that happens
to you. That makes them much more useful, so there should be far fewer.

- **Way down.** A gate should be novel — not impossible to find, but not
  something you trip over on an ordinary flight.
- **One at the jump coil, guaranteed.** Already true and it should stay true:
  the coil's clue is "a gate", so finding the coil is how most players will meet
  their first one.

### C. The Wall  ·  *give it a reason to exist*  ·  done

The almanac entry is four corner brackets around an empty square. It is the
weakest thing in the book: there is nothing there, so finding it is an
anticlimax and the entry is a lie about there being something to see.

- Make it **a historic attempt at a wormhole that went wrong** — Ric's idea and
  the right one. That gives it wreckage, a reason for the geometry, a reason it
  is enormous and square, and something to read in the almanac note.
- The other landmarks should get the same test applied to them: is there
  anything *there*, or only a marker saying there is.

### D. The tractor beam  ·  *weaker, and shorter*  ·  done

It currently sweeps up a broken rock at full burn, which removes the only
decision salvage ever asked for.

- **Less reach** and **less pull**, so holding a cloud of motes means slowing
  down for it. The trade should be time against cargo.

### E. The chart  ·  *fewer lines*  ·  done

The chart has grid lines, an origin cross, the fog grid, the trail, marks, pins
and a legend, and it has become hard to read.

- **Drop the trail.** Where you have been is already said by the fog you
  revealed walking it; drawing it twice is what tipped the page over.

### What this actually landed

- **Worlds are on their own lattice, one to a five-chunk cell**, and inset from
  the cell's edges by their own radius plus 600 — so two of them are always at
  least `r1 + r2 + 1200` apart and *cannot* overlap. That mattered: per-chunk
  placement had one world in twenty-four intersecting another, worst case one
  wholly inside the other, because a chunk is pure and cannot see its
  neighbours. Measured after: 0 overlaps across 490 worlds and six seeds.
- Density **0.16 → 0.030 a chunk**. Radius **26 to 3,502** — 135× — with the
  curve keeping most near 600 so the giants read as giants. Eight palettes,
  banding from 2 to 7 lines drawn on a per-world tilt, a ring on about one in
  five, gibberish names that are pure functions of position (365 worlds, 363
  distinct names), and **inhabited 1 in 19**, said in words floating at the rim.
- **A world may not stand on anything you have to reach.** It is solid and can
  be 3,600 across, so one rolled onto a manifest part does not obscure it — it
  encloses it, and the run cannot be finished. This bit immediately: the ranging
  lens's own decorative world swallowed the lens the moment planets got bigger.
  Guarded against every part site, every landmark, the yard and the origin.
- **Gates cut from 22 mouths per 625 chunks to 7** — roughly one round trip every
  180 chunks. The coil's gate is still placed by hand, so finding the coil is
  still how most players meet their first one.
- **The Wall** is a wormhole somebody failed to open: the frame's four anchors,
  the construction yards wrecked against them, debris strung along the lines
  between, and a mouth at the middle that never formed. The dead mouth is drawn
  as the same figure as a working gate with the motion taken out and the rings
  broken, and `surveyGates` refuses to transit it — the anticlimax is the entry.
  The almanac picture and note were rewritten to match.
- **Tractor beam 620 → 340 reach, 900 → 380 pull.** It collects up close and
  does nothing at 900 units, so a cloud has to be flown slowly through.
- **The trail is gone from the chart**, and gone from the save with it. It was
  saying what the fog already says — the fog *is* the shape of where you have
  been — and it was the line that tipped the page from a map into a diagram.

---

## Phase 2 — survival  ·  **DONE**

This is the phase that changes what Survey *is*. It reverses the mode's original
promise that nothing ends your run, deliberately.

### 2.1 Hull, and dying  ·  done

- Hull works as now, but at zero it does not reset. **At zero hull the next hit
  kills you.** The HUD has to make "one more hit" unmistakable.

### 2.2 Water and food  ·  done

- Two meters, draining slowly on different clocks. Water faster than food.
- Running either to empty starts a countdown, not an instant death — a warning
  you can still act on.
- Empty for too long kills you.

### 2.3 Death  ·  done

- A **YOU DIED** screen. What killed you, how far out you were, how long you
  lasted, what you were carrying.
- Respawn at the home station. You keep the yard's progress and the almanac.
  You lose the hold, and you lose whatever you were carrying that was not a
  yard part.

### 2.4 Planets you can dock at  ·  done

- Some planets are **inhabited** — you can dock, and buy water and food.
- Uninhabited ones with atmosphere can be **skimmed** for water, slowly and for
  free. That is the poor pilot's option and it costs time instead of metal.
- Inhabited planets are commoner near home and rare in deep space, which is what
  makes range a supply problem rather than only a danger problem.

### What Phase 2 actually landed

- **The hull runs to zero and stops there.** Five points, one a hit, and zero is
  survivable — you can still fly, you can still reach a star and mend, and the
  next thing that touches you kills you. That single point of grace is what makes
  it a decision rather than an ambush. A well does not chip you: being swallowed
  is fatal outright, which is what phase 1.2's warning-with-room-to-act was for.
- **Two clocks, always running.** Twelve minutes of water, twenty-five of food,
  shown as *time* rather than as a percentage — "4:20 of water" is a decision and
  "36%" is a number you have to convert first. Empty starts a countdown (75s for
  thirst, 120s for hunger) and *anything* going back into the tank stops it, which
  matters because skimming trickles and a trickle has to be able to save you.
- **A YOU DIED page** stating what killed you, how far out, how long you lasted,
  and — itemised — what went down with the ship, because "you lost 43 units" is a
  number and "you lost 19 iridium" is a memory. Beside it, deliberately, what did
  *not*: the cash, the almanac, the chart, the pins, the yard and the parts you
  were carrying. A death screen that lists only losses reads as a wipe.
- **Respawn at the home station**, which is now one constant both the generator
  and the respawn read, so they cannot drift. Resupplied on arrival — sending you
  back out on the empty tanks that just killed you is a loop, not a setback.
- **Inhabited worlds sell water and food**, about one in twenty overall but 1 in
  10 near home against 1 in 27 in the deep. They are deliberately *not* stations:
  no cargo bought, no refits, no verbs — a station is a shipyard and this is a
  village with a well, and keeping them apart is what makes a station matter.
- **Any world with air can be skimmed**, at 2.4 seconds of water a second, free,
  water only. 62% of worlds have air. Nothing you scoop out of a sky is food, or
  the inhabited worlds would be pointless.

> **Where supply is pitched, and why it stays there.** Measured from five
> distances out to 300,000 units, the nearest place that sells water is never more
> than a minute of flight away, and near home it is far closer than that. So
> running dry is not something that happens on an ordinary trip.
>
> That is the intended pitch and it is settled: **water and food are a constraint
> on going a long way, not a difficulty everywhere.** Twelve minutes of water is
> about 260,000 units at full burn against a sector that runs past 320,000, so a
> run at the abyss is a run you have to provision for — and a run round the home
> band is not. Something you think about before a long haul and never during a
> short one.
>
> The levers, if it ever wants moving: the station roll (~1 in 20 chunks, plus the
> one given at home), the inhabited-world gradient, and the tank sizes.

---

## The quiet screen, and the drive  ·  **DONE**

A second pass over everything the HUD had accumulated, plus two systems that came
out of playing it.

### The screen

- **The objective band is gone.** Three lines painted across the top of the screen
  every frame forever, answering a question nobody asks twice. It is a
  notification now, fired when it changes.
- **One notification stack, top right.** There were three feeds in three corners —
  logged cards top centre, the objective band, radio above the hull bar. All of it
  goes to one right-aligned stack under the chart; a repeat refreshes the line it
  is already on rather than stacking a second copy, and it caps at four.
- **The almanac tally is off the flight HUD.** It is a total that changes once
  every ten minutes and it has a page, which is the definition of something that
  does not belong on a flight readout. **SECTOR** takes the top right, above the
  chart, so the right-hand column reads downward: where you are, the map, the way
  in, then what just happened.
- **Water and food are percentages**, one line each, and **the bars are gone** —
  from those and from storage. A bar is a second drawing of a number already on
  the line beside it, and four of them made a corner you had to read rather than
  glance at. An emptied tank shows its countdown instead, because 0% looks the
  same whether you have a minute or a second.
- **"Hold" is "storage"** everywhere it is the stuff rather than the ship.
- **The inventory leads with two doors** — ALMANAC and MISSIONS — at the top,
  panel-sized and obviously pressable. Missions is the yard page, reachable from
  the inventory as well as by docking, which is what let the objective stop being
  permanent furniture.

### Named places

- **Supermassive wells have names**, in their own register (`TORIS MAW`, not a
  world name), and ordinary ones deliberately do not — a name is for the thing
  you plan a route around. Both they and worlds are **written into the gazetteer
  with their names** and drawn with them on the chart, held back at the two widest
  zooms where a sector of labels would be a block of type rather than a map. The
  gravity warning names the well too.
- **A supermassive well takes everything.** It pulled ships, rocks and bullets and
  left the salvage hanging in it, so the middle of a black hole was a cloud of
  untouched cargo. Motes and sentries are pulled now and consumed at the middle,
  and a supermassive well reaches half again as far as its size alone would give
  it — all of the extra is warning, the killing radius is untouched.

### The wormhole, and the light drive

- **The six parts make a MANMADE WORMHOLE**, not a "light drive". It opens a mouth
  at one end and puts you out of another; it does not drive you anywhere at speed.
  The Wall is a *failed* attempt at exactly this, which is why the jump coil is
  found wound around a gate — naming it correctly makes the two the same story.
- **The light drive is the yard's second project**, and the only one you buy
  rather than fetch (2,400 cash, offered once the wormhole is done). Engage it
  with `R` and you run in one direction at **eight times drive speed** — measured
  2,880/s, 14,341 units in five seconds — with steering cut to a fifth, because
  locking the nose solid would make the impact warning information you could not
  act on.
- **Asteroids are nothing to it.** They neither damage you, slow you, nor cut the
  drive; the ship destroys them going through. The only two things big enough to
  matter are a massive world and a supermassive well, and **the drive warns five
  seconds out**, names the thing, and says what to do. The warning is exact:
  tested against the real rim distance over the real speed, it is true to 0.00s.
- Streaming widens and shifts forward while the drive runs (13×13 chunks, four
  ahead), because the warning horizon is further than the loaded box reaches and
  at that speed you outrun the sector otherwise.

### And a bug that had been there a while

**Sentries reset mid-fight.** `surv.drones` was rebuilt from chunk data every time
the ship crossed a chunk line — every few seconds at 2,600 units to a chunk — so a
sentry that had taken a hit was handed a fresh hull, put back on its post and sent
to sleep, over and over. Guards have stable ids now and a loaded one is carried
across the rebuild as the same object. A guard killed while its post is in range
stays dead; leave and come back and the post is manned again, which was always the
rule.

## Since, from playing it

- **A slingshot is worth taking.** Speed above your own limit is an allowance that
  only gravity grants, decays on its own, and your engine can never add to. It
  used to be confiscated in a single frame the moment a well's pull fell below
  one — momentum arrived and left again at the rim, every time. Two wrong versions
  came before the right one and both are in the comment: one gave the whole mode
  four times its stated top speed (full burn ran to 1,138 against a MAX_SPEED of
  360 and nothing said so), the other latched, because being over the limit was
  what raised the limit.
- **Worlds are drawn to scale on both charts**, and appear on the minimap at all —
  they were filtered off it as "not something you navigate by", which was written
  when a planet was 190 units across. A well is charted at its *reach*, because
  that is the piece of the sector you plan a route around. The gazetteer keeps
  sizes now, and so does the book.
- **Waypoints.** One at a time, armed from the chart and set by a tap, with an
  edge arrow and a range on the flight HUD. Pins are notes — six kinds, two
  hundred of them, none of them pointing anywhere — and a waypoint is the other
  thing entirely.

---

## Phase 3 — the economy and the ships  ·  **DONE**

### 3.1 Metals  ·  **DONE**

Salvage becomes typed. Four or five metals, each worth different money, each
found in different places — so "what is this rock worth" becomes a question.

**What landed.** Four materials — ICE 1, IRON 3, ALLOY 9, IRIDIUM 22 — and the
split the top of this file promised: material is *cargo*, capped by the hold and
spilled when the hull goes; cash is *money*, uncapped, safe from a hull strike,
and the only thing a station takes. Each source has its own table (a rock is ice
and iron, a thing that was built is alloy, a guarded cache is where the iridium
is) and depth leans every table toward the rare end — measured at 2.5× the value
per unit in the abyss against home. Motes carry their own kind and are drawn in
their own colour and size, so a seam of the good stuff is visible before you are
close enough to read a word. Refit prices moved up roughly four-fold to match.

### 3.2 Selling  ·  **DONE**

Stations buy metal. Prices vary by station and by band, so a long haul out can
be worth it. Your home station is never the best price, which is the whole
reason to find another one.

**What landed.** A station's price for each material is a pure function of where
it stands — its own taste, times a depth bonus — so a good buyer stays a good
buyer and is worth writing on the chart. Home sits at the origin with no depth
behind it and is therefore never the best price. The station page leads with what
it pays and what your hold is worth to it, and sells the lot on one button or
`S`. A realistic hold of ordinary rock is worth about 250 near home, which is
about one tier of one refit.

### 3.3 Twenty-five ships  ·  **DONE**

All twenty-five buyable, each with real numbers:

| Metric | What it does |
|---|---|
| Hull | how many hits |
| Firepower | damage and rate |
| Cargo | how much metal you can carry |
| Speed | top speed |
| Turn | how fast you come about |

The spread runs from small, fast and fragile up to things that do not fit on a
screen. They must look as different as they play — a hauler should be
unmistakable from a fighter at a glance, and one of them should read as a
TIE-fighter silhouette without being one.

### 3.4 Ship size and the camera  ·  **DONE**

A bigger ship zooms the camera out. This keeps a capital feeling enormous
without breaking the framing, and it is a real trade: the big ship carries more
and survives more, and it sees less detail and handles like a barge.

> **Open question — still open, and only Ric can close it.** Whether size-driven
> zoom actually works at this scale. It is built the way he asked: a factor *on*
> the Settings zoom rather than instead of it, so both can be felt together and
> this one can be cut without taking the control with it. Measured, a Skiff sits
> at 1:1 and an Ossuary at 0.49.
>
> This is the one item in the whole plan that cannot be settled by measuring
> something. It needs an afternoon in a capital. If it fights the game, delete
> `shipZoomFactor` and its three call sites and nothing else moves.

---

### What 3.3 and 3.4 landed

Twenty-five hulls, each five numbers and a polygon. Spread measured: **hull 12×,
cargo 50×, size 4.5×**, speed 1.8× and turn 3.7×. Twenty-five distinct
silhouettes, drawn in the world from the same outline the hangar draws — a
Louvre is a slab between two flat panels and reads as a TIE without being one; a
Coffer is a safe with a drive on it.

Five classes with different shapes of trade: scouts pay hull and cargo for speed
and turn, fighters buy guns, couriers carry and run, haulers carry and don't, and
capitals do everything slowly. **No ship beats a cheaper ship on all five** —
tested exhaustively over every pair, because one that did would make the cheaper
one unbuyable and the roster that much shorter.

Every number reaches the ship: hull, hold, thrust, turn rate, round damage, fire
rate and radius. The radius matters most and is easiest to forget — collision,
salvage pickup, where a round leaves the nose and how big it draws all read it,
so a Cathedral is a Cathedral to all of them at once. Refits scale what the hull
already has rather than adding a flat bonus, so a tier of drive is worth more on
a fast hull than on a barge and both purchases stay worth making.

Bought at a station, from a **HANGAR** page laid out like the almanac, because
the picture is the point and nobody ever picked a ship off a table of numbers.
The five stats are bars against the best in the roster, which is the only
question a shipyard is ever asked. Ships are **kept, not sold** — trying a hauler
for an afternoon and going back to a fighter costs nothing but the walk. A hold
that will not fit the new hull is left on the dock.

**3.4 — the open question.** Built as Ric asked: a factor *on* the Settings zoom
rather than instead of it, so both can be felt together and this can be cut
without taking the control with it. The curve is deliberately weaker than the
size it answers — a Cathedral is three times a Skiff and gets about half again
the view, because a capital that showed the whole sector would make the small
ships feel blind rather than nimble. Measured: a Skiff sits at 1:1, an Ossuary
at 0.49.

---

## Phase 4 — company, and the first two minutes  ·  **DONE**

### 4.1 Friendly ships  ·  done

Traffic that is not trying to kill you: haulers on a route, patrols near
stations, wrecks-in-progress you can help or rob. The sector should feel
inhabited near home and empty far out — that contrast is most of what makes
distance feel like distance.

### 4.2 The two-minute pass  ·  done

The last item, done once everything else exists, because you cannot teach a game
that is still changing shape. A deliberate opening: you start docked, the first
thing you need is water, the station sells it, and the station points at the
yard. Every mechanic introduced by needing it, none of it by text.

### What Phase 4 landed

**Company.** Three kinds, all flying the same twenty-five hulls you can buy —
which is most of what makes the roster feel like a world rather than a shop:
haulers running a line between two points, patrols holding a circuit near a
station, and distress calls being taken apart by sentries on a clock.

Density measured at **0.32 a chunk near home against 0.020 in the deep** — a
sixteen-fold falloff, squared so it is felt rather than merely present. Near home
you are never alone for long; past the Hostile band you can fly for an hour and
see nobody, and that contrast is most of what makes distance feel like distance.

A patrol shoots at sentries and never at you. That one behaviour is what tells
you these are on your side without a word being said, and it means a guarded
cache near a station is a fight you can arrive in the middle of. A sentry posted
on a distress call shoots at the freighter rather than at you, so the scene can
be watched from a long way off and turned toward or not.

You can rob one — "you can rob it" is half of what makes company mean anything,
and a neutral you are physically unable to harm is scenery with a flight path. It
drops what it was actually carrying rather than a fresh roll, so piracy is a
living rather than a fortune. And you can save one: clear the sentries and it
pays, then becomes an ordinary hauler and gets on with its day, which is a better
ending than a thank-you and a despawn because you can pass it again later.

Like the guards, traffic is carried across a chunk re-stream rather than rebuilt.
A freighter that snapped back to its start line every few seconds would be
scenery, not company.

**The first two minutes.** A new survey now opens *docked at the home station
with the tanks at 30%*. That single arrangement is most of the pass: you did not
choose to be there, you cannot leave without noticing the shop, and the first
thing you want is the first thing it sells — and buying it teaches cash, storage,
the station page and the fact that something is counting down, in one press.

After that, five beats, each fired by an event and each fired once:

| when | what it says |
|---|---|
| docked, tank under 45% | water is low, and you are standing in the shop |
| tank full again | what the yard wants, and the clue for where to look |
| first material aboard | it is worth money, and a station buys it |
| storage 60% full | go and sell |
| 200 cash, docked | you can afford a refit — and it sells ships |

Nothing stops the game, nothing asks for a click, and the whole thing is four
notifications over two minutes that never appear again. They are kept in the
book, so a sector you have played has stopped explaining itself — and a resumed
survey starts at the origin rather than in the shop.

## The pages, on one grid  ·  **DONE**

Six full-screen pages built one at a time over four phases, each of which looked
fine on its own and none of which agreed with any other. Measured before:

| | was |
|---|---|
| content top | 86, 88, 90 or 92 depending which page |
| panel padding | 14, 16, 18, 20 or 34 |
| column gutter | 12, 20 or 50 |
| list row pitch | 26, 30, 32, 34, 38, 46 or 70 |
| "medium" type | 18 *and* 19 — two sizes doing one job, from two files |

None of that reads as a bug on any single page, and all of it reads the moment
you press `I` and the panels land somewhere else than they did a second ago.
That is what "designed" means here: not how one page looks, but whether six of
them are the same object.

So: one grid, six numbers, and every page laid out from it and nothing else —
`EDGE 34 · TOP 92 · GUTTER 22 · PAD 20 · STEP 26 · HEAD 34`. A panel is
`HEAD + n·STEP + PAD`, a list row is one `STEP`, a gap between panels is one
`STEP`, and `COL(n, i)` hands out the i-th of n equal columns so a two-column
page and a four-column page put their edges in the same places.

Measured after, across all six: **content top 92 everywhere; type sizes 16, 23
and 30 and nothing else; panel edges only ever at 34, 273, 352, 511, 670, 750** —
which are exactly the two-, three- and four-column positions and nothing
arbitrary.

Three things changed besides the arithmetic. Panels have a **rule under their
title**, inset to the padding, which is most of why they now read as designed
rather than as boxes with words in. The module draws its **own buttons** rather
than the engine's, which is where the stray 18px came from — one file's idea of
"medium" landing a pixel off every heading in another's. And the almanac and the
chart, which had their own margins because they are grids rather than lists, are
on the same columns as everything else.

---

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

### 5.1 Reputation, in a galaxy already at war  ·  **DONE**

> *"I want it more like real life. There are some people that are defensive and
> pirates. But others that are traveling or escorted. Some don't want you within a
> certain distance others don't care. Some are part of an alliance or faction.
> This should be a galaxy that is actually at war. And you're just a guy exploring
> in the middle of it."*

The first cut of this was one ladder — UNREMARKABLE → WATCHED → WANTED → HUNTED —
and one ladder is wrong, because it makes the whole sector agree about you. It was
replaced.

**Three powers**, each with its own opinion of you, plus **pirates** (nobody's) and
**independents** (their own). **Two of the three are at war**, rolled per world, so
which pair is fighting is something you learn by flying rather than something you
are told. Hurting one power is a **favour to whoever they are fighting**, which is
what makes piracy a side you take rather than a thing you are punished for. The
third power is a bystander and takes no view.

**Flag and temperament are separate**, which is the point: `faction` is who they
fly for, `role` is what they are doing. A freighter, a trader, an escort, a patrol,
a pirate, a distress call, a hunter. Some are armed and some are not. Some want a
**personal space bubble** kept — rolled per ship, so two escorts of the same flag
are not the same to fly past — and they **warn you once** before they do anything
about it. Unarmed ships that dislike you **run** rather than fight.

Reputation is still a number the player never sees, and still read off the world:
a patrol of a power that wants you does not wait to be shot at; one of a power
that likes you does not care. It is stated as **one word per power** at the foot
of the inventory, under the heading REPUTATION, with who each is at war with under
it — because your standing with one power only means something next to who they
are fighting.

### 5.1a How big the war is  ·  **DONE**

> *"The wars should range from small skirmishes. To massive wars."*

Rolled per world, weighted so the big ones are a seed you remember:

| | |
|---|---|
| **BORDER SKIRMISH** | shots traded over a line neither side can hold |
| **RAIDING WAR** | convoys hunted, lanes unsafe, nothing declared |
| **OPEN WAR** | fleets in the open and no pretence left |
| **TOTAL WAR** | everything either side has, thrown at everything else |

It is a multiplier, not a label. A hot war puts more of the belligerents' hulls in
the lanes, leaves less room for anybody's own business, and throws far more
**battles** into the sector.

### 5.1b Battles, and that they end  ·  **DONE**

> *"Battles can finish so if you find a battle. Going there later it might be over
> and there is no ships. Sometimes remembrance of the battle."*

Two fleets, facing each other, having it out properly — you can fly into the middle
of one. The ships are ordinary traffic, angry at each other, so everything that
already makes two powers shoot at one another works here with no second system for
it. Nobody in a battle minds how close you fly; they have other things on.

A battle you have **never seen is still being fought** — it has been going on for
as long as you were not looking, and finding one is the point. From the moment you
*do* see it, it has a clock, and **the clock runs whether you stay or not**. Fly off
for ten minutes and come back: no ships, and a field of hulks worth stripping. It
also ends early if one side is simply wiped out.

About **one battle in three is remembered**: a name (THE STAND AT ITHTORUX, THE LOSS
AT VERRAK), a stone floating where it happened, and a mark on the chart. The rest
leave their wrecks and nothing else, which is its own kind of true.

*A fight that waited for you would be a set piece. One that finishes without you is
a war.*

### 5.1c The coil goes off in your hands  ·  **DONE**

> *"Make it so when you get the jump drive it teleports you to a random spot."*

The jump coil is wound around a gate, and pulling it off discharges it. You keep
the part; you lose where you were — a random bearing and a distance that can be a
good deal closer to home than you are, or a long way past it. Momentum does not
come with you. The spot is redrawn until it is one you can arrive at alive, and
checked again after the sector around it is built.

It is the one moment in the mode that happens **to** you.

### The old ladder, for the record

Killing an unarmed freighter costs about twice what killing a patrol does, and
one that was already being taken apart costs most of all. Killing a **hunter**
costs nothing either way — otherwise the only way out of being hunted would be to
become worse.

Hunters are *spawned*, not generated. A chunk is a pure function of its
coordinates and may not know how many people you have shot, so they arrive from
off screen, come for you, and are ordinary traffic in every other respect: you can
outrun one, kill it, or lead it into a well. Three at once is a situation; six
would be a firing squad, so three is the cap.

It **cools on its own** — about six minutes to shed one freighter — and a rescue
works off about the same. Being able to work it off is what keeps it a state
rather than a verdict on the save file.

Said out loud only when it *changes*, and phrased as rumour rather than as score:
*"Someone saw that."* → *"Word travels out here."* → *"There are ships out looking
for you now."* Stated as a word in exactly one place, the foot of the inventory,
and nowhere else. Stations never close, prices never move, nothing locks. Piracy
stays playable and gets more expensive, which is a different thing from forbidden.

---

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

### 5.2 Parts, slots, and time to install  ·  **DONE**

**Every ship, no exceptions, gets exactly four attachment slots.**

Not four on the starter and a spread across the rest — **four on all twenty-five**.
This overrides the earlier version of this section, which made the count a
balancing lever and gave a scout two and a hauler eight. It is a flat rule now and
it should stay one.

Why it is better as a flat rule:

- **The hulls are already differentiated.** Twenty-five ships vary by hull, cargo,
  speed, handling and size. Varying the slot count on top of that stacks a second
  balancing axis onto ships that did not need one, and the two axes fight — a
  hauler that is roomier *and* better equipped is not a trade, it is a strictly
  better ship.
- **Four is the same decision on every hull.** You always have exactly four
  choices to make, so the interesting question is never "which hull lets me carry
  more gear", it is "which four do I want *this* trip". That question survives
  the whole game; the other one is answered once.
- **It makes the loadout page one page.** Four boxes, always, on every ship, on a
  phone as well as a desktop. No hull that needs a scrolling equipment list and no
  hull whose page is mostly empty.
- **Swapping hulls stays cheap.** You keep every ship you buy and change them at
  the home station. If slot counts varied, changing hull could strand parts you
  have nowhere to put — and trying a hauler for an afternoon would stop being free.

So: slots are **not** a ship property. Cargo is, speed is, hull is; the four boxes
are the same on all of them.

**Everything you bolt on is a part in a slot.** Not a tier on a list — a thing you
found or built, taking up one of your four. The categories:

- **engines** — how fast
- **thrusters** — how you handle; reverse thrusters are the example worth building first
- **scanners** — how far a pulse reaches
- **armour** — how many hits
- **cargo** — see the flag above
- **weapons** — see 5.3
- **tractor gear** — the beam, and better beams
- **rare weird parts** — the ones that are the reason to go a long way

Some are better in different ways rather than simply better. Some take materials
to build. **Some are only found very far away** — which is the danger curve
finally paying out.

What are currently refit *tiers* and almanac *verbs* both become parts. Hull and
drive staying buyable is fine; what changes is that it reads as buying a part and
having it installed rather than a number going up on a list.

### 5.2a Installing takes time — but you can do it anywhere  ·  **DONE**

This replaces the earlier line, which said you *cannot* swap a part mid-fight.
You can. It just costs you.

**Out in space, a swap takes time, and the slot is out of action while it runs.**
Pull the old part, fit the new one, and that slot does nothing until the install
finishes. So a four-slot ship mid-swap is a three-slot ship, and swapping your
weapon in the middle of a fight means fighting without it for as long as the fit
takes. That is the whole cost, and it is a better rule than a ban: you are allowed
to make the call, and the call can be wrong.

**At a station it is instant.** No timer, no blocked slot. Which is what makes a
station worth flying back to for reasons other than selling — and it means the
timer never punishes ordinary loadout planning, only changing your mind out there.

**Time varies per part, by rarity.** Something common goes on quickly; something
you crossed the sector for takes a while. The ceiling is three minutes and nothing
goes past it:

| | fit time |
|---|---|
| **common** | ~20s |
| **uncommon** | ~45s |
| **rare** | ~90s |
| **exotic / very far out** | up to 180s |

**This only works because the inventory does not pause the world**, which is
already the rule (chart, storage, missions and almanac all keep the clock
running; only a station and the yard stop it). Open the inventory, start a fit,
close it, and keep flying — the fit runs while you fly. Without the live-inventory
rule this would just be a loading screen.

**The details, decided now so they are not argued later:**

- **The slot shows its own progress.** A fitting slot reads as *fitting*, with time
  left, in the loadout page and as something glanceable in the cockpit. A cost you
  cannot see is a bug report.
- **Cancelling loses the progress**, and the part goes back to storage. The old
  part is already off; the slot is simply empty again. No half-credit.
- **Docking mid-fit finishes it**, because a station is instant — arriving at one
  completes whatever was in progress rather than starting again.
- **The clock stops when you die**, the same as everything else on the survey
  clock. Being adrift is not a workbench.
- **One fit at a time**, per slot. Starting a second fit in the same slot cancels
  the first. Different slots can fit at once — nothing about the rule needs them
  to queue.

*The point of all of it: loadout stops being a menu you visit between trips and
becomes a decision you can make badly, at speed, with something shooting at you.*

### What 5.2 actually landed

**Twelve parts** across six categories, spanning the four rarities. Engines
(DRIVE SPAR, OVERBURNER), thrusters (VERNIER SET, REVERSE THRUSTERS), scanners
(PULSE COIL, DEEP EAR), armour (LAYERED PLATE, ABLATIVE SHELL), tractor gear
(TRACTOR RIG, HEAVY RIG) and two odd ones (STAR SIPHON, COLD LARDER). Weapons are
5.3 and are not here yet.

**Rarity does two jobs and only two**: how long a fit takes, and how far out a
station has to be before anybody stocks it. It is not a quality ladder — a common
vernier set is the best thing in the game if what you needed was to turn faster.
Near home a station stocks five of the twelve; a station in the abyss stocks all
of them, which is the danger curve finally paying something back.

**The LOADOUT page**, on the navigation strip and live: four slot boxes, what you
own, and — when docked — a shelf to buy from. A slot mid-fit shows a countdown
that is genuinely counting and a bar; a finished one says WORKING. The foot of the
page totals what you are *actually* flying with, with anything still fitting left
out, because it is not helping you yet. `G` opens it, and it scrolls by wheel and
by thumb like the almanac.

**Reverse thrusters** are a fixed Survey key (`S` / down arrow) rather than a
bindable action, the same as the scan and the light drive — the part gives your
ship a verb it did not have.

And a **pad button**, which is the one control on the pad that comes and goes: it
appears when the part is fitted *and has finished fitting*, and goes when the part
is pulled, letting go of the thumb on its way out. Both control schemes get it —
backing off a rock is as useful with arrows as with a stick. It is an ordinary pad
part in every other respect: draggable, sizeable, and mirrored by SWAP SIDES.

The gating hangs off the fit rather than off the purchase on purpose: a button that
will do nothing for the next forty-five seconds is worse than no button.

**One of a kind on the ship.** Two pulse coils in two slots would be a way to
spend slots rather than to choose between them, and the choosing is the whole of
it.

**Two things the chart gained on the way**, both from playing it:

- The chart was the **only page in the mode without the navigation strip** —
  opening the map and wanting your storage meant closing the map, flying, and
  pressing another key. Its own band moved up a row and the strip took the bottom.
- The strip **computes its widths** now instead of hard-coding them. It grew a
  seventh tab for the loadout, and a fixed width meant every future page was a
  collision waiting to happen.

**Still on the refit page, unchanged:** hull plating, drive and scanner tiers. Per
the note above, hull and drive staying buyable at a station is fine — a station
fits instantly, so those already read as buying a part and having it installed.

### Ships stay at your home station  ·  **DONE**  ·  *and it is now tested*

> *"If you buy a ship it stays at your home station. You can't change ships at any
> stations only at your home one."*

Already the rule, in `buyShip` and in `flyShip`, both gated on `atHomeStation()`.
What was missing was a test for the *swap* — buying was covered and changing was
not — so a refactor could have quietly let you change hulls at any shop. It is
covered now: you cannot swap in open space, you cannot swap at an ordinary
station, and you can swap at home.

The reason it matters: the hull you left home in is the hull you are stuck with
out there, which is most of what makes choosing one a decision rather than a
preference.

### 5.3 Weapons are parts too  ·  **DONE**

Firepower stops being one number. Four weapons, each an actual part in an actual
slot, so arming up costs the room you would have given to a tractor beam or a
bigger scanner. That trade is the point; a weapon that costs only money is a stat.

| | | |
|---|---|---|
| **SCATTER GUN** | common | three rounds in a fan, none of them go far |
| **SEEKER RACK** | uncommon | a missile that turns after whatever is nearest |
| **BURST CHARGE** | rare | goes off where it lands, or where it runs out, and takes the neighbours |
| **RAIL LANCE** | exotic | one heavy slug, straight through three things |

**All of them fire on the trigger you already have.** No second fire button, on a
keyboard or a thumb: hold fire and the cannon runs at the cannon's rate while
whatever is bolted on runs at its own, much slower one. A launcher with its own key
would be a control a phone has nowhere to put and a thing to remember mid-fight; a
launcher that answers the trigger is just your ship hitting harder.

**The cannon never goes away and never needs a slot.** It is how a rock becomes
materials and the whole economy hangs off that — a slot you had to spend before you
could mine would not be a choice, it would be a tax. A launcher's rounds are marked
`alt` and stay out of the cannon's six-in-the-air magazine for the same reason.

Two bugs fell out of building it, both of which had been quietly true for a while:

- **`hitRock` ignored a round's damage.** Every hit took exactly one point, so the
  heavy rounds a pickup gives you never actually punched through anything despite
  the comment saying they did, and a rail lance would have chipped a boulder like a
  pistol. Damage counts against a rock now.
- **A burst charge that ran out of life vanished.** It goes off where it stops now,
  which is what a charge *is* and what makes a round fired at nothing still a round
  you can place.

### The arrows that point off screen  ·  **DONE**

> *"The arrow for the scan. Like for finding things needs to be easier to see. And
> not behind anything on the UI. It should be on the edge of the screen but not on
> top of or behind anything of the UI."*

Three things point off the edge: the objective, the returns from a scan, and a
waypoint. All three picked their own spot and two picked badly — the objective's
arrows rode an ellipse inset by a flat 74 and 62, which put the ones pointing up
and right underneath the panel chart and the ones pointing down through the hull
bar, and the waypoint's clamped its `x` against the panel column while leaving its
`y` to land wherever it liked.

There is one answer now. A **rectangle** inset from the screen, a ray from the
middle, and the point where the ray leaves it — a rectangle rather than an ellipse
because an arrow on a rectangle is genuinely at the edge instead of floating a
third of the way in at the corners. Plus a list of the boxes the interface has
already taken; an arrow that lands in one **walks around the ring** until it is
clear, trying both directions and taking the nearer answer.

Easier to see, too: half again the size, a solid head rather than an outline, a
tail, a pulse, never dimmer than about two thirds, and the range printed *inboard*
so the label cannot fall off the edge the arrow is sitting on.

And a scan's returns get arrows at all now — an off-screen return used to be a dot
on the panel chart and nothing else, which made the scan a thing you read rather
than a thing you fly by. Each one wears its own kind's colour and is smaller than
the objective, because it is a suggestion rather than the plan.

*Tested as geometry rather than as drawing:* every bearing round the compass, 384
placements, checked against the boxes the HUD itself reports. The one thing a
screenshot cannot tell you is whether something is underneath something.

### 5.4 Crafting, kept at Minecraft depth  ·  **DONE**

Flat recipes. Ingredients in, part out, one step:

```
3 alloy + 2 electronics + 1 reactor core  →  Mk II Engine
```

No engineering UI. This implies a couple more material-or-part kinds than the
current four — `electronics` and `reactor core` in Ric's own example. They are
found, not mined.

**Some parts need other parts.** This revises the earlier constraint, which said
no components inside components *unless the game eventually proves it needs that*.
Ric has called it: a recipe may list a **finished part** as an ingredient, and it
is consumed like any other.

```
1 Mk II Engine + 4 alloy + 1 exotic coupling  →  Mk III Engine
```

That is the good version of depth — the better engine is visibly *built out of*
the one you have been flying — and it gives the far-out rare parts something to be
for besides sitting in a slot. What it must not turn into is the research tree
that was already rejected, so it is fenced:

- **Two steps, not a tree.** A part may be made from a part. That part may not
  itself need a third crafted part. If a recipe ever wants three levels, the
  middle one is wrong and should be a material.
- **A crafted ingredient must also be findable or buyable.** Nesting is a
  *shortcut*, never a gate. If the only route to a part is crafting the one below
  it, the chain has become a tech tree with extra steps.
- **The whole chain is on one screen.** A recipe shows what it needs, what you
  have, and — for an ingredient you could make right now — an option to make that
  one too, in the same action. Nobody should have to hold a chain in their head.
- **Still no subcomponents.** Parts are made of materials and, sometimes, one
  finished part. Nothing is made of a thing that only exists to be made of.

### What 5.4 actually landed

**Two new materials, found and never mined.** `ELECTRONICS` and `REACTOR CORE`
appear in hulks, drones, wrecks and caches and are absent from rocks entirely —
which is the whole of "found, not mined", and what makes a hulk worth stopping for
when your hold is already full of ore. A core is rarer than iridium anywhere it
appears, because one recipe wanting one is a reason to go and look.

**Seventeen recipes**, flat, one step, no engineering interface. Five of them eat
a finished part, and the three fences are held by tests rather than by good
intentions: two steps and never three, a crafted ingredient must also be buyable,
and nothing exists only to be an ingredient.

**The WORKBENCH page** (`B`, on the nav strip, live so the world keeps running).
A row per recipe: what it wants, what you have of it in green or red, and one
button that says which of three things it is about to do — BUILD, BUILD BOTH, or
SHORT. **BUILD BOTH is the nesting answered**: if you do not have the ingredient
part but could make it out of what is left over, one tap makes both. Nobody should
have to work a chain out by hand, and two steps is the whole of the depth so it
can never recurse further than once.

**The reverse lookup**, which was the missing half. The hold is listed beside the
recipes and every material says what it is an ingredient *for* — which is what
turns three reactor cores from a curiosity into a lead. Ice is the special case
and the important one: nothing is built out of it, so it says THE MELTER DRINKS IT.

**It works anywhere.** Not at a station — the melter's entire reason to exist is
being the answer when there is no station for two hundred thousand units, and a
workbench you have to dock at cannot be that.

**And an almanac entry**: SHIPWRIGHT, for building a part out of what you found.
The first time the sector's small change becomes something you fly with is a
different feeling from paying for one.

*Still owed:* a recipe page that can **set a waypoint** to where an ingredient
comes from. The reverse lookup answers "what is this for"; "where do I find this"
is still unanswered.

### What 5.6 landed

The **ICE MELTER** is a part like any other — uncommon, buildable from iron, alloy
and electronics — and it turns ICE in the hold into water in the tank. One unit is
about twenty-six seconds of water and it melts slowly on purpose: it is not a tap,
it is the reason a hold full of the cheapest thing in the game is worth keeping
rather than dumping.

It stops at a full tank, so it never quietly eats a hold you were going to sell,
and it says MELTING ICE on the panel where SKIMMING says skimming — two ways water
arrives that are not a shop, in the same place.

Water is answered. **Food still has no equivalent** and stays on the loose-ends
list.

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

### 5.6 An ice melter, and craft as a reason to hold cargo  ·  **DONE**

Water and food are bought at a station, and that is currently the only way.

The **ice melter** is the first craftable: a few parts that melt and purify ICE
into water directly. It makes the cheapest material in the game worth carrying,
answers "what if there is no station for 200,000 units", and is the honest use for
a hold full of the stuff nobody wants to buy.

### 5.7 Repairs  ·  **DONE**

Hull used to come back from exactly two things: sitting in a star's light, and
dying. A station mends it now, on the SUPPLIES panel next to the water and the
food — because it is the same question as filling a tank, not an upgrade.

Priced **per point missing** rather than as a flat fee, the same rule the supplies
follow, so the button can say the number: a shop that makes you press it to find
the price is a shop you do not use when you are one hit from dead. Dearer in the
deep, like everything else a station sells. Read as points rather than a
percentage — "2 / 7" is a number of hits and "29%" is not.

Sitting in a star is still the free answer and still costs you the time.

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

### It has to be a proper mobile game  ·  **DONE**

> *"Make it so mobile when pulled up is full screen. And it tells you to rotate
> your phone. It needs to be a nice mobile game. It needs to fill up the entire
> phone screen."*

Four separate things were wrong and all four are fixed.

**The screen is the shape of the device now.** Crossfire was laid out in a fixed
1000×700 box. A phone held sideways is about 19.5:9, the picture is 10:7, and the
difference came out as a third of the screen in black bars — which reads as the
game not working rather than as a decision. The height is still 700; the width
follows the glass, from 1000 on anything squarer than 10:7 out to a cap of 1680
(about 2.4:1, past which the extra is a strip of sky). A wide screen gets **more
sector**, not a stretched one.

Almost everything already adapted — the menus centre on `SCREEN_W / 2`, the survey
pages sit on a grid measured from the edges — and the dozen or so controls that
carried a literal like `700` (written when 700 *was* 0.7 of the width) now say so:
`COLS(n, i)`, `LEFT`, `RIGHT`. The key grid centres itself. The fixed-camera modes
fit the arena by whichever axis is tighter instead of by width alone, so the whole
map is still on screen. Every tappable rectangle goes through one function, because
a control drawn 260px right with its tap box left behind is unpressable and looks
perfectly fine.

**Fullscreen from the first touch.** It used to be asked for when a match started
— the right gesture, the wrong moment, since the menus are where a phone spends
its first half-minute and it spent it inside a browser with a toolbar top and
bottom. It is asked for on the first touch anywhere now, once, and never again if
refused or dismissed.

**Portrait is answered rather than accommodated.** A 1000×700 picture in a
portrait phone is a slot across the middle of the glass and no amount of scaling
fixes a shape. So: a full-bleed overlay, a turning-phone glyph, one sentence, and
the game waits. It is DOM rather than canvas so it works before the game is
running and dismisses on rotation with no frame in between.

**EXIT GAME, and the pill is gone.**

> *"It needs to say exit game in setting somewhere. And that pushes you back to
> my website. Remove the little button that says Ric's terminal for crossfire."*

Crossfire no longer loads `relay-return.js`. Every other project on the site gets
the floating "Ric's Terminal" pill from it, and a game wants neither that — fixed
bottom-left is exactly where a thumb lives — nor the site's ambient effects layer
painting over a full-screen canvas. The way back is **EXIT GAME**, on both settings
screens, armed before it fires like the survey reset: one stray tap should not end
a run and close the game. It saves the survey book on the way out. It is on the
rail of the settings page — there is only one settings page now; see below.

### Settings, per game mode  ·  **DONE**

> *"If you're on survey. Only the survey settings should pop up. If you're on the
> other game modes only those settings should pop up. Or there should be different
> pages for each game mode in settings."*

The settings page shows **one mode's options at a time**. Opened from a match it is
that match's page, with no tabs to wander off into; opened from the front page the
four tabs are how you reach the others. Survey has zoom, camera and reset; Battle
Royale and Campaign have a camera; Survival has friendly fire. That is the THIS
MODE category of the settings page.

The rotating camera used to be **one flag worn by three modes**. It is now four
separate answers, so turning it on for a duel does not turn it on for a long haul.

### One settings page, with a rail  ·  **DONE**

> *"the settings page needs an overhaul."*

It was a single stacked page and it had run out of room twice over. The line
explaining INPUT was being drawn through the two buttons it explained. The phone
had a **second copy of the whole page** with the live thumbstick sitting on top
of RESET SURVEY, and its own SOUND, its own FULLSCREEN and its own EXIT — each
written twice and each drifting. The code's own comment had given up: *"a fourth
setting here needs the screen rearranged, not another column."*

So: **a rail of categories down the left, one panel to the right of it.**

| | |
|---|---|
| **THIS MODE** | the four tabs and that mode's own answers |
| **FLYING** | what kind of machine this is, and the mouse |
| **KEYS** | the two seats and Survey's four slots |
| **THE PAD** | layout, gas, auto-fire, size — and the door to moving them |
| **THE GAME** | sound, screen, account |

with **EXIT GAME** and **BACK** below a rule at the foot of the rail.

Three things fall out of it:

- **A new setting is a new row.** Nothing below it moves, because nothing below
  it is sharing the space. A new *kind* of setting is a new entry in the rail.
- **One page, whatever you are playing on.** `[C]` means the same page on a desk
  and on a phone. The pad screen still exists, because where a control *sits* is
  the one question that cannot be a list — you drag the real controls at their
  real size — but it is a room off the settings page now, not a rival to it, and
  it holds nothing but a title, a line, and three buttons in the top fifth.
- **The keyboard can reach all of it.** It used to reach the key grid and
  nothing else: sound, fullscreen, the zoom and the camera were mouse-only, on
  the one page whose whole subject is not needing a mouse. Up and down walk a
  list, right steps from the rail into the panel, left comes back out.

The shell is capped at 1180 and centred rather than stretched to the glass: a
settings row a thousand pixels wide is a label and a button at opposite ends of
a desk. The key grid is sized and centred against the **panel** now rather than
the screen, so how wide a column can be is a question about how wide the panel
is.

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

### The jump gate, and what a death does to a part  ·  **DONE**

> *"If you die with an item used to make the yard — which needs to be changed on
> the name, the teleport. But if you die with a part that part needs to be left
> where you died. And you have to go get it."*

**THE YARD is THE JUMP GATE.** The old name said where it was and not what it
was: the six parts build a manmade wormhole — a mouth you open on any station you
have charted, straight from the chart — and calling the place a yard left the
player hauling parts across a sector for a thing with no name. It says what it is
from the first banner now, and finishing it reads *THE JUMP GATE IS OPEN* rather
than *THE YARD IS FINISHED*.

**A part you were carrying stays where you died.** It used to come home with you,
and the reasoning written down at the time was that a part lost in deep space is a
run you cannot finish. That was the wrong conclusion from the right worry: the
answer is not to make a part indestructible, it is to make sure you can always go
back for it.

So it is left exactly where you fell, and everything about it is built around the
trip back:

- **It does not drift and it does not expire.** It is not a mote and not a chunk's
  property; it belongs to the run.
- **It is nudged clear of whatever killed you**, on a spiral outward until it is
  out of every well and every world — a part inside a star is a part nobody is
  ever getting back.
- **It goes on the chart by name**, so "go and get it" is something you can
  navigate rather than something you have to have remembered.
- **The death page says so**, under STILL OUT THERE — a part that vanished from
  your hold with no explanation reads as a bug, and a trip you have to make reads
  as a trip only if something tells you to make it.
- **There is never a second one.** While it is lying where you died, its landmark
  is empty; a death must not duplicate the thing you were carrying.
- **It survives the tab.** A part you have to fetch is worthless if closing the
  tab loses it.

Everything else about dying is unchanged: the hold is gone, the almanac and the
fitted parts and the cash and the chart are all kept.

### A bug this turned up: the book is a whitelist  ·  **FIXED**

`loadSurveyBook` validates the save field by field, which is right — the book is a
file on somebody's disk and a hand-edited one must not be able to hand out a hull
that does not exist. What it also means is that **a field written to the book and
not read back is silently thrown away**, and nothing anywhere says so.

Four things had been landing in exactly that hole and nobody had noticed, because
every test that checked persistence read the raw JSON rather than resuming through
the real path:

- the **four slots** — every fitted part fell off on reload
- the **crate** of parts you own but are not flying
- **which battles are over**, so a finished fight restarted itself
- **which battles are remembered**, so a memorial forgot its own name

All four are in the whitelist now, each validated on the way in, and there is a
test that writes a whole run, closes the tab, opens it again and reads it back —
plus one cheap check that would have caught all four at once: *every key the save
writes must be a key the loader reads.*

---

### A bug hunt over everything Phase 5 added  ·  **DONE**

Four real ones, found by pointing the audits at the new systems rather than by
waiting for them to show up in play.

**A unit of anything is a whole unit.** The ice melter's first cut took a
*fraction* of a unit of ice every frame. That looked like a rounding nicety and
was not: a hold of 9.5875 ice printed itself into the interface as
`ICE x9.58750000000001`, made the cargo count a fraction of a unit, and paid out
19.175 cash when it was sold. One wrong decision leaking into three places that
had every right to assume a material is a whole thing. The clock is on the melter
now — it runs, and every 1.8 seconds it takes exactly one unit and puts exactly
one unit's worth of water in the tank. Selling rounds too, because a fractional
purse is one that can buy something for exactly its own price and fail.

**The jump coil fired every time you picked it up.** It is meant to discharge when
you pull it off the gate and throw you across the sector — once. Dying with it and
going back for it fired it again, which turned "go and get your part back" into a
random throw and, on a bad roll, a chase you could not finish. It is a spent
component after the first time, and the book remembers that.

**Six materials did not fit the station.** The hold went from four kinds to six in
5.4, and the station's buy row divided one line by however many there are — at six
the cells fell to 96px and REACTOR CORE printed straight through its own price.
It is three across and as many rows as that takes.

**And the row that grew pushed the page's bottom through itself.** The hangar door
was placed by flowing down from the panels above it, so a panel gaining a row put
the door's caption on top of the line of keys at the foot of the page. The door is
anchored to the bottom now — growth above must not be able to reach the bottom of
a page — and the caption folded into the button, because the right column is
genuinely out of room and both facts were short enough to live in the label.

Everything else came back clean: a long randomised run in the deep with every part
fitted and the pages opening and closing behind it, weapons fired at full burn and
inside a well's reach and while dead and into the middle of a battle, all three
other game modes at both screen widths, and every page with a full hold of all six
materials.

---

## Phase 7 — the interface, properly

Everything below came from playing it. Phases 1–6 built systems and hung a page
off each one; the result is eight pages that each make sense alone and do not add
up to something you can hold in your head. This phase is about the whole, and the
rule under all of it is Ric's: **simple, and showing exactly what is needed** — on
a phone and on a desktop, both.

### 7.1 Navigation lives at the top  ·  **DONE**

Every button that changes page is at the **top** now. It was along the foot, which
on a phone is where a thumb rests and where the system's own gesture bar lives —
you cannot put the way between pages under the operating system's swipe. Moving it
also handed the whole of the old footer back as content room.

And the pages collapsed from eight tabs to six:

- **STORAGE and LOADOUT are one scrolling page**, called SHIP. They were two pages
  about the same object, and reading one while deciding the other meant leaving
  and coming back. The order on it is the order you ask the questions in: what am
  I flying, what have I got, who am I to them, what have I seen.
- **The ALMANAC is not a tab.** It is a book, at the foot of the ship's page, so
  you reach for it the way you reach for a book on a shelf.
- **The CHART has the strip**, so the map is not a dead end.
- **HANGAR is SHIPS** and **BUILD is CRAFT**.

**One bug this could have shipped with.** A scrolling list clips its *drawing* to
its own window and nothing clipped its *taps* — so a row scrolled up under the
page heading was invisible and still pressable, which is the worst kind of
control, because nothing about the screen says it is there. Every rectangle in the
module goes through one door now, and a page that scrolls sets a window: outside
it a rectangle is dropped, straddling it, trimmed. The workbench and the ships
page had hand-rolled versions of that test; both now use the one door.

### 7.2 The station is a market  ·  **DONE**

> *"There should be a trade thing that takes up most of the room and has
> everything that this station has, and you can buy it. Think of it like a market
> or a website you order from."*

- The **market takes most of the page**: everything this station sells, in one
  list, with prices, and you buy from it.
- It shows **your money, your food, and a way to view your inventory**.
- **The bars beside water and food go**, and you can **buy units** of them rather
  than only filling to the top.
- **"EARNED, NOT BOUGHT" goes entirely.** The almanac's unlocks do not belong on a
  shop page.
- **"HANGAR" becomes "SHIPS"**, and it does not need to name the hull you are in.

**What landed.** It is a list, the way a market or a page you order from is a
list: one row per thing, a swatch saying what kind of thing it is, what it costs,
and a button. Supplies, repairs, parts and refit tiers are all in it, because they
are all the same act — the old page had them in four separate panels and finding
out what a station would do for you meant reading all four.

**Water and food by the quarter, half or the lot.** Filling to the brim was the
only option, which made stopping an all-or-nothing decision priced against a tank
you might not want to fill; five minutes of water to reach the next station is a
perfectly sensible purchase and there was no way to make it. It never offers more
than the tank has room for.

**The bars are gone**, and so is EARNED, NOT BOUGHT — the almanac's unlocks are
the almanac's business and they live with the almanac now. **The shipyard is a row
in the list** rather than a door floating beside the title, because it is a thing
this station offers.

And the shortage from 6.2 shows: a material this station is short of is marked
**WANTED** and priced accordingly, so "why is iron worth more here" has an answer
on the page rather than in the player's memory.

### 7.3 Craft, reworked  ·  **DONE**

- It is called **CRAFT**, not BUILD.
- **Top right: every material you have.** Under it, **every part you have**, at the
  station or aboard.
- **Every craftable thing gets a picture in a box.** Drag and drop is coming, and
  boxes with pictures in them are what you drag.
- **A recipe does not show its ingredients until you click it.** Clicking opens it
  and reveals a **CRAFT** button.
- **Not everything in the game is craftable.** Some parts are found only.

**What landed.** The page is a **grid of boxes with pictures in them**, because a
box with a picture is a thing you can point at — and because drag and drop is
coming, and what you drag is a box with a picture. One picture per *category*
rather than per part: seventeen drawings would be seventeen things to get wrong,
and what the grid has to answer at a glance is *what kind of thing is this*.

**A recipe says nothing until you pick it.** A wall of ingredient lists is a
spreadsheet, and the first question this page answers is "what can I make", not
"what does everything cost". Picking one opens a panel under the grid with what it
wants and a **CRAFT** button — or **CRAFT BOTH**, when the step below it is
something you could make from what is left.

**The right-hand column is what you have**: every material at the top, every part
you own under it. "Can I make this" is answered by looking up, and the answer is
in the same place every time.

**And the rule that decides every part added after this one: if it is the best in
its category, it is not craftable.** The ladder up to it is; the top of it is not.
Seven parts — one per category — are found or bought and never built, which is
what keeps a shelf in the deep worth flying to. A game where everything is
craftable is a game where the sector is a materials pile and going anywhere is
optional; the only question left is how long you are willing to grind.

### 7.4 The chart is too crowded  ·  **DONE**

- **Filters, top right.** Turn off whatever you do not want to see.
- **A PIN button on the right.** Click it, then click the map, and it drops a pin
  you can **name**.
- **A WAYPOINT button that works the same way**, and only ever one waypoint.

**What landed.** The map gave up a **column down the right** rather than a band
along the bottom, and everything that decides what the map *does* lives in it —
the filters, the two things you can place, the zoom. That is the difference
between a map with controls and a map with a control panel underneath that you
have to look away from the map to read. It also makes the map as tall as the page,
which on a phone held sideways is the whole screen.

**Ten filters**, one per kind of mark, each in its own colour with its own glyph
so the list and the map say the same thing.

**PIN and WAYPOINT are armed by their own buttons**, and the next tap places one.
That is one gesture, learned once, and the same for both. It also fixes something
that was quietly wrong: the map used to drop a pin on *any* tap, so panning with a
finger left a trail of them and every press was a decision you had not made.
Arming is spent by the placing. Tapping an existing pin still lifts it, armed or
not, because an eraser mode for one gesture would be a mode too many.

**And a pin can be named.** Endless space has no place names — the only way
anywhere out here gets one is if you say so, and a pin you cannot name is a dot
you will not remember the reason for. Naming uses the one dialogue this game has:
a real input laid over the page, so a phone raises its own keyboard.

### 7.5 Reputation, explained  ·  **DONE**  ·  *the status here was stale*

Its own small box **in loadout**. It explains the factions a little, and it is
easy to understand — at the moment it is three words at the foot of a page and it
assumes you know who these people are.

**Done**, and it had been for a while — this entry simply never got updated. The
REPUTATION panel on the ship's page gives each power its own row: a swatch in the
colour its ships are actually painted, its name, where you stand with it as a
*word* and never a figure, who it is at war with, and a line saying who they are.
Below it, WHO KNOWS YOU carries the two lists of named ships from 6.5.

### 7.6 Smaller things

- **Cash** stays top left and stays small.  ·  **DONE** — it was already there,
  and it is on every page's title line rather than in a panel of its own.
- **Thirst is a 20-minute clock; food is 45 minutes.**  ·  **DONE**
- **A bigger ship carries more food** — the hull decides the pantry, as it decides
  the hold.  ·  **DONE** (37 minutes in a Mote, 260 in an Ossuary; water does not
  scale, because a tank is a tank)
- **The scan button has to look like a button** on a phone.  ·  **DONE**: a box,
  a border, and a ring inside it that fills as the scanner charges, so "charging"
  is the same object rather than a different word. On a keyboard it stays a label,
  because `F` is right there and a button nobody clicks is furniture.

### 7.13 The tanks say when they are low  ·  **DONE**

> *"The first and second time that food and water hits 50%, a WARNING! with a
> warning triangle pops up next to it. The warning disappears after 10 seconds and
> the triangle slides next to the number. After the first two times it's every
> 15%."*

A teaching device that gets out of the way. The first two times a tank falls past
half — on two separate trips, not twice on the same one — the word WARNING appears
beside the readout for ten seconds; then the word goes and the **triangle slides in
next to the number** and stays while the tank is low. The slide is the point: it
shows you the word and the mark together, then leaves you the mark.

After those two there is no word at all, just the triangle at each step down, and
the steps are every fifteen per cent: half, 35%, 20%, 5%. Refilling past half
clears the mark so the next trip warns again; the *lesson count* is kept in the
book, because "the first two times" has to mean the first two times and not the
first two this session.

The triangle is drawn rather than typed — a glyph would be at the mercy of
whatever font the device has, and this is the same hairline vector as everything
else on the screen.

### 7.14 Stations say what they are  ·  **DONE**

> *"I want the word STATION floating in a rotation around the inner loop of all
> the stations. And yours says YOUR STATION."*

Set letter by letter around the inside of the ring and turning with it, a little
slower than the ring itself so it stays readable. Every station says **STATION**;
the one you left home from says **YOUR STATION** — after ten hours out there the
only thing you need to know at a glance is whether this is the one with your
hangar in it.

On the curve rather than written across the middle, because a ring with writing on
it reads as a built thing and a word laid flat over one reads as a label stuck to
the screen.

### 7.15 The arrows, again  ·  **DONE**

> *"When you switch views from fixed to rotating in this mode it messes up the
> waypoints and the purple arrow. Also the purple arrow needs to be a different
> colour, not red — maybe a light blue. And it needs to be more jagged."*

Two bugs under one report, and the second could not have been found without
fixing the first.

**`surveyState()` never sent the camera.** Every arrow that points off the edge
converts a world position into a screen one, and to do that it needs the camera's
rotation and scale. With neither, the module fell back to `rot: 0, scale: 1` — so
in the rotating view every arrow pointed at the wrong sky, and in *both* views the
"is it already on screen" test ran at 1:1 when Survey draws at about 0.72.

**And then the rotation had the wrong sign.** The world is drawn with
`ctx.rotate(cam.rot)`, so a world vector at angle *t* appears on screen at
*t + rot*; the arrows rotated by *−rot*, which is the screen-to-world direction.
That has been wrong since the arrows were written and had never once mattered,
because the module was always being handed `rot: 0`. Fixing the first bug is what
made the second one visible.

**Light blue, and jagged.** The objective arrow was VIOLET, which is the colour of
every panel, every border and half the interface — the one arrow you actually fly
by should not be the colour of the furniture, and should not be a warning colour
either. And the head is barbed now rather than a plain triangle: a smooth
arrowhead on a screen full of smooth circles is one more smooth thing, and a
barbed one reads as a *direction* before it is read at all.

### 7.8 Anything with a name can be asked about  ·  **DONE**

> *"Anything we run into in the world that has words — like THE ACTION AT MULANE —
> needs to be clickable, or go up and press E, and an info thing pops up telling
> you what it is."*

The sector prints names on things now — memorials, worlds, wells, the jump gate —
and a name with no way to ask about it is a tease. Walk up, press **E** (or tap
it), and get a card: what it is, what happened here, what it is worth going near.

**Done.** Seven kinds of card: the eight landmarks (hand-written, three
paragraphs each), a battle either remembered or happening, a named well, a world,
a piece of the drive, and a gate. The generated ones read their own facts — a
world states its diameter, its band, whether anyone lives there and whether there
is air; a well states the reach you have to plan around; a memorial states which
two powers fought and how cold the metal is.

Three decisions worth keeping:

- **It is a card, not a page.** No tabs, no navigation, nothing to do on it.
  You asked a question; anything you press closes the answer.
- **The world keeps running behind it**, at the same 0.88 the other pages use.
  This is the only page you open *at* something, usually while moving and
  sometimes while being pulled, so freezing the clock would make "what is this"
  a way to stop time next to a star.
- **The card is snapshotted on the keypress**, not read live. The world moves
  while you read, and a card that rewrote itself as you drifted would be worse
  than no card.

`E` is the same key as docking and comes last in that chain, so a station, the
yard and a world you can land on all still win it.

### 7.9 The notifications need somewhere to live  ·  **DONE**

> *"I don't know what 'they made it, 260 cash' was. You need to be able to see
> notifications somewhere else too."*

Two problems in one.

- **The messages do not say enough.** *"They made it. 260 cash, and their
  thanks."* assumes you know a distress call was the thing you just cleared. Every
  line of chatter has to make sense to somebody who looked away for ten seconds.
- **They scroll past and are gone.** There is nowhere to read back what happened.
  A log — on a page, scrollable, with the last few dozen lines.  ·  **DONE**:
  WHAT HAPPENED, on the ship's page, forty lines newest-first, with a repeat
  counted rather than repeated.

**And two more things that were wrong with the feed, both from the cockpit.**

*It was saying everything at the same volume from any distance.* A convoy
unloading four sectors away, a battle ending somewhere you have never been, a
scavenger taking a wreck you could not see — all of it arrived as a notification,
so the stack was almost always full and almost never about anything you could act
on. **A feed that is always talking is a feed you stop reading**, which costs you
the three lines a year that actually matter.

One rule now, in one place, replacing six ad-hoc distance checks with three
different radii scattered through the file:

| | |
|---|---|
| `chatter(text, colour)` | about **you** — your ship, your tanks, your money, your parts. Always said. |
| `chatter(text, colour, {x, y})` | about something **out there**. Said only if it happened within earshot. |
| `chatter(text, colour, false)` | **texture**. Written down, never said. |

Everything still reaches the log, so nothing is lost — the lines that did not
interrupt you are in WHAT HAPPENED if you want them.

*And you could not read the long ones.* A notification is a line squeezed into a
column and shrunk until it fits, so `fitText` took it to the 16px floor and then
cut it with an ellipsis — the lines worth reading were exactly the ones you could
not. **Press one and it opens**: wrapped properly, on a ground you can read it
against, with the detail line the collapsed form has to drop. Press it again and
it goes away.

An open one **stops counting down**, and is never the one dropped when the stack
overflows. If you pressed it to read it, having it fade or get shoved off the
bottom mid-sentence is the interface deciding you had finished with it.

*The wording pass is still owed*: "They made it. 260 cash, and their thanks."
assumes you know a distress call was the thing you just cleared. That line is
fixed; the rest of the file has not been read through with that question in mind.

### 7.10 The three powers need three colours  ·  **DONE**

You cannot tell whose ship you are looking at. Each faction gets its own hull
colour, distinct from each other, from the pirates, from the independents and from
your own — so "who is that" is answered by looking.

### 7.11 EREIA V and things flying through things  ·  **DONE**

One report, three faults, all of them "solid to you, not solid to anything else":

- **A named world is not on the chart.** EREIA V is right there in the sector and
  the map has never heard of it.
- **Asteroids sit inside planets, and inside each other.**
- **Traffic and drones fly through worlds**, and through the Leviathan.

**What landed.** The chart bug was the interesting one: the check measured to a
world's *centre* against a sight radius of 980, and a world can be 1,800 in radius
— so the biggest, most unmissable objects in the sector were exactly the ones the
map had never heard of. You could land on one and it still would not be there. It
measures to the surface now.

For the rest, three answers and they are deliberately different. A **world breaks
a rock** — a rock meeting a planet at speed is not a bounce, and the sector already
breaks rocks on stars. **Two rocks part**, each giving way in proportion to how
small it is, so a pebble gets out of a boulder's way. And **a ship is put back on
the surface and turned along it**, which reads as going round rather than as a
reflection, and cannot trap anything.

### 7.12 How it feels to fly  ·  **DONE**

- **An asteroid is solid.** It used to be a hit and a shove, which meant that for
  as long as the impact shield lasted you flew *through* the thing that had just
  hit you — a boulder was a damage event rather than an object, and cover you
  could hide behind was cover you fell into. The collision and the damage are
  separate now: the collision always happens, the damage is what the shield stops.
  Damped, at a restitution of 0.4, because a bounce that adds energy is free speed
  past the drive's own cap — and there is a test that drives into a rock and checks
  the ship comes off slower than it went in.
- **Stations and inhabited worlds deflect.** A perimeter well outside themselves
  turns a rock away rather than letting it arrive and break, which is the
  difference between somewhere lived in and somewhere not — and the reason a
  station is a place you can sit still. An empty world still breaks them.
- **The gravity warning is earlier**, and earlier again on the supermassive ones.
  Four steps rather than three, the first at a fifth of your drive rather than a
  half, and the look-ahead is 3x a well's reach — 4.5x for a supermassive, which
  is the case where arriving late is fatal rather than annoying.
- **Wells vary in size again.** The roll was ±17% around the band's figure, so
  every well in the same stretch of sector came out the same size — and since the
  picture is drawn from `kill`, they all looked identical too. It is nearly a
  factor of two either way now; depth still decides the trend.
- **A live page is very lightly transparent**, with the world drawn behind it. The
  clock running behind those pages was a rule about time and not about sight: a
  rock arriving while your storage was open hit you out of a black screen. The
  chart is the exception — a map you read through an asteroid field is a map you
  squint at — and the station, which stops the clock anyway.
- **15% fewer asteroids**, everywhere: 90 kept around the ship, now 76.

---



### Four things from the cockpit  ·  **DONE**

Reported while Phase 6 was in progress, and all four are the kind of thing only
somebody actually flying it would find.

**A key you were still holding stopped working.** *"I couldn't shoot until I
released W and pressed it again."* The held-key set is emptied wholesale in four
places — losing focus, standing down, pausing, starting a match — and a key you
are physically still holding sends nothing afterwards but auto-repeat events. The
handler returned on `e.repeat` *before* putting the key back, so the only cure was
to let go. Two lines swapped. A repeat still never counts as a second press.

Finding it needed a harness change worth keeping: the test stub threw away every
listener the game registered, and reported the lobby element as *visible* — which
makes the keydown handler bail out on its first line, because while the lobby is up
you are typing a password and a stray space must not fire a gun. So the entire
keyboard path was unreachable from any test, and every test that needed a key wrote
the held set directly and never went near the handler. The stub now keeps the
listeners, reports the lobby hidden as the real markup does, and hands back the
*same* element for the same id twice — it used to mint a fresh one per lookup, so
anything the game set on an element was silently discarded.

**Every menu is see-through now, not only the live ones.** The shop and the
shipyard were solid on the reasoning that a stopped world has nothing to show.
Wrong twice over: you can still see where you are parked and what is around you,
and the rock that was already on its way is still on its way when you close the
page.

**And the clock stops when you are parked.** At a station, at your own yard, or
sitting on somebody's world — all three are places you have *stopped*. Out in space
the chart, the ship page, missions and craft all keep running, which is what 5.2
needs (fitting a part costs real seconds, and a page that froze would turn that
cost into a loading screen) and what a player expects. A station fits parts
instantly anyway, so the two rules never disagree. The info card is the one page
that runs even parked: it is asked *at* something, and stopping time next to a star
would be an exploit rather than an answer.

**Money is marked as money.** There were four conventions — a bare number, a
number with CASH after it, one with "cash" after it, and one with nothing — so you
had to work out from context whether 1,450 was a price, a distance, a count of
rounds or a number of seconds. Everything that takes cash now carries a currency
mark, and the figures are grouped, because 3600 and 36000 are the same shape at a
glance and 3,600 and 36,000 are not.

The mark is **drawn, not typed**: a box with a C in it, struck through. A character
would have to exist in whatever monospace font the browser picked, and the failure
mode when it does not is a hollow box — which is very nearly the mark itself, which
is the worst possible way to be wrong. So money strings carry a sentinel codepoint
that is never rendered as text and the text layer swaps it for a path, at any size,
in any font, including the line of chatter that says what something cost.

**Half and quarter fills.** They always *were* priced pro rata — but every slice is
also clamped to the room in the tank, so on a tank four fifths full all three
bought the same 20% for the same money, and the small ones read as a rip-off. A
slice bigger than the room is simply not offered any more, so what is left is
always cheaper than the next one up, and each row says how much of the tank it
actually buys.

**And the missions page says *parts*.** It listed six names and six clues and never
once said what the six things were or what to do with them, so the manifest read as
a set of riddles rather than a shopping list with a delivery address.

---

### Every trick is a part  ·  **DONE**

Ric's rule, and it turned out to be the biggest single change in the mode:

> *A ship without that stuff is a normal ship. No tricks or anything. All the
> tricks are the parts you attach yourself. So they know what they are.*

**Two whole systems were removed** because they broke it.

*The refit track* — three lines, hull, drive and scanner, three tiers each,
bought with cash at a station — was a second upgrade system saying exactly what
the parts already say. LAYERED PLATE is +2 hull; so was a tier of hull plating.
One of them had to be the answer to "how do I make this ship better", and a part
is the better answer for one reason: **a part is a thing you can point at.** It
sits in a slot, it cost you one of four, you can pull it off and sell it. A tier
was invisible — two identical hulls could fly completely differently with nothing
on either of them to say why.

*The almanac's three verbs* — six entries bought a tractor beam, twelve a warp
tuner, eighteen running dark — were wrong twice. They made the ship do things
nothing on the ship explained, and they made the field guide a shop. What the
almanac is worth now is what it should always have been: the record of what you
have seen.

**Four new parts**, one for each trick the hull used to do for free:

- **SOLAR PANELS** — a star mends your hull. This was true of every ship in the
  game whether you knew it or not, which made the best mechanic in the mode read
  as a property of the universe. Without panels the flight bar says *IN THE LIGHT
  — NO PANELS*, and you carry your damage home.
- **TRACTOR RIG** — found in caches and buildable, never sold. The commonest find
  out there and the one that changes an ordinary flight most.
- **WARP TUNER** and **RUNNING DARK** — find-only, deep caches, nobody sells them
  and nobody knows how to make one.

**Three ways to get a part, and the page says which.** Some you buy, some you
build, some you can only find — and a find-only part has to say *where to look*,
or it is a rumour rather than content. A part with none of the three cannot exist:
the test refuses it.

**Crafting is gated by where you are.** Common parts are scrap and patience and
can be built anywhere. Anything above common wants a berth and somebody else's
tools, so it wants a station. That is what stops the workbench and the shop
competing, and gives the deep a reason to send you home.

**CRAFT became PARTS**, and it lists *every part in the game* rather than only the
ones with a recipe — you cannot plan towards something you have never been told
exists. Each box says what kind of thing it is and whether you own one; picking it
says what it does, how to get one, and **UNCRAFTABLE** when there is no recipe.
Descriptions wrap inside their panel and the ingredient line is measured rather
than guessed at — it used to advance a cursor by `text.length * 9.6` and walk
straight out of the right-hand edge.

**Storage, and the squares.** "The crate" is **STORAGE**; the materials are the
**CARGO HOLD**. The four slots are drawn as four squares — an empty one was the
word EMPTY, which is a label where the interface needed a *place* — and a part
gets there by being **dragged out of storage and dropped into one**. Clicking still
fits it, so nobody has to learn a new gesture to do what they already did.

**Materials have pictures.** Six identical coloured squares is a bad primary key:
two of them are within a hue of each other on a dim phone, colour-blind players
get nothing, and a swatch says *a material* rather than *which* one. Ice is a
crystal, iron is rough ore, alloy is a milled bar, iridium is a cut gem,
electronics is a board with legs, a core is a ring around something lit.

**A bug worth recording.** Removing the refit track left one line in the save
loader naming a variable that no longer existed. The loader is wrapped in a
`try/catch` that turns any failure into a *fresh sector*, which is right for a
hand-edited save and a catastrophe for a typo: **every resume in the game silently
started over**, and the test suite reported it as four unrelated failures about
reputation and parts. The catch now says what went wrong under `?debug=1`.

---

### Pins, arrows and the scan  ·  **DONE**

**A named pin said CASH.** Naming worked the whole time — the dialogue opened, the
name was saved, the book kept it — and the chart drew the name of the pin's *kind*
instead. The first kind in the table is called CASH, so every pin anybody ever
dropped said CASH, including the ones they had carefully typed a name into. It
wears its own name now, cut on a word boundary when it is too long: "THE IRIDIUM
FIELD" becomes "THE IRIDIUM…" rather than "THE IRIDIU…", because a cut on a word
is a name and a cut mid-word is a typo.

**And you choose its colour.** There were six kinds and the only way to change
which one you were placing was a keyboard shortcut nothing mentioned — so on a
phone every pin in the game came out the same colour. Six swatches in the rail;
the colour travels *with* the pin rather than being looked up from its kind later,
so editing the palette one day cannot repaint marks somebody made a month ago.

**The chart is see-through**, like every other page. It was the one exception, on
the reasoning that a map read through an asteroid field is a map you squint at —
true, and beside the point, because the chart is the page people sit in longest.

**The arrows are a pulse.** The blue objective arrow sat on the edge of the screen
permanently, which stops being information and becomes furniture. It comes up when
you scan and goes down with the returns. Exactly two things outlive a scan, and
both are things you *chose*: a **waypoint**, and a **feature you tapped on the
chart** — a station you will need later, the well you are routing around, the
memorial you mean to come back to.

**The arrows you steer by are Vs.** Two strokes meeting at a point, open behind,
with a second smaller chevron trailing it — the shape every heads-up display uses
for "this way". It reads as a direction before it is read at all, and it does not
put a solid blob of colour over the edge of the screen. The barbed solid stays on
the quieter arrows: a scan return is a dot with a direction, and eight solid
chevrons round the ring would shout.

**And the mode says how to scan.** Survey has no tutorial, the scan is the verb
the whole mode is built on, and a player who never presses it flies an empty
sector wondering what the point is. One line, on the band the eye is already on,
that stops the moment you press it.

---

### The Leviathan is a place now, and some battles are fleets  ·  **DONE**

**The Leviathan.** It was a box with one straight corridor: in at the stern, fly
a straight line, take three caches off the spine, turn round at the far wall.
Eight seconds of decisions, in the thing the whole manifest points at.

It is **9,200 units** now — three and a half times longer, about three chunks, and
too long to see both ends of at once, which is the first thing that makes it read
as a place rather than an object. From the stern forwards:

- **the throat** — a wide mouth at the open stern quarter, on one flank
- **five bulkheads** across the spine, each with one doorway, and the doorways
  **alternate port and starboard** — so the way in is a weave and you are always
  looking for the next gap
- **six bays** — side chambers off the spine, alternating sides, each behind its
  own short throat. Three hold a cache and its sentries. The route to the bow goes
  through none of them, so every one is a decision to spend time
- **the hold** — past the last bulkhead, a wide chamber with the richest cache,
  four sentries and the ablative plate

**Every wall is both the drawing and the physics.** The old one hand-drew three
plates and separately hand-placed its collision discs — two descriptions of one
object, which is exactly the arrangement that lets a wall you can see quietly stop
being a wall you hit. A wall is a line in local space now; the discs are stamped
along it and the renderer strokes the same list. They cannot disagree because
there is only one of them.

**And the test is a flood fill.** The old check walked the centreline and asserted
it was clear, which is right for a straight corridor and useless for a place —
the centreline is now *supposed* to be blocked. The question worth asking of
anything you fly into is whether the inside is **reachable**: can a ship of this
size get from the door to the hold at all? It caught the thing a centreline walk
never could have — the first version of the new layout laid the flanks down solid
and put the bays outside them, so all six side chambers drew perfectly, had caches
in them, and had no way in.

Two things keep it cheap: one bounding check before testing 213 discs, and the
spine light, which steps across to each doorway in turn and is the only thing
inside telling you which way is forward. Measured at **3.9 ms a tick** standing in
the middle of it.

**Fleet actions.** Battles were two to twelve hulls a side. Rarely — about one in
thirty near home, up to one in ten in the deep in a bigger war — the two powers
now put **twenty-five to thirty-nine hulls a side** in the same piece of sky: two
lines five thousand units apart, and enough wreckage afterwards to be a landmark.
A fleet action is almost always remembered (85% against 34%), because that is the
sort of thing a sector names. Measured at **2.0 ms a tick** with 67 ships loaded.

---

### A bug sweep from the cockpit  ·  **DONE**

Ten things, most of them mine, several of them the same mistake in different
clothes: *the sector was full of objects that were not quite objects.*

**Far too many ships, and none at home.** The region layer gave settled space
1.9× traffic and home counted as settled — so the busiest place in the sector was
the two chunks around the one station you cannot avoid. Home is ordinary space
now and the few chunks around the start get a quarter of the usual chance:
**one ship at spawn instead of twelve**, and thirteen at the peak of ninety
seconds' flying instead of thirty. Somebody docking and leaving, not a rush hour.

**You could fly through every ship in the sector.** Ships bounce off each other —
that code has been there since the first mode — but traffic is not in the `ships`
array, so nothing ever asked whether your nose was inside a freighter. A neutral
you can occupy the same space as is a painting.

**Other people's bullets went through asteroids.** Every round fired by anything
out here ignored every rock, which is the same mistake again — and it is also
cover: a rock between you and a patrol was worth nothing while their fire ignored
it.

**Ships stopped and did nothing.** The reserve drained whenever a ship was inside
*any* gravity well's reach, which is a large fraction of the sector and most of it
harmless — so ordinary haulers burned their water crossing a star's outskirts and
stopped dead everywhere. Only a well that is actually beating the ship's engine
counts now. Plus a watchdog: anything that has not moved for eight seconds thinks
again, which is cheaper than finding every way a ship can wedge itself.

**Ships left hulks.** They did, for 6.5's sake, and it was wrong in the sky: a
hulk is a big dead hull you strip for salvage, and a fighter you shot turning into
one made the sector read as though hulks came out of ships. They do not. Battles
still lay out their own field of wrecks, which is the version that was always
right — a battle is an event and a single kill is not. The persistent wreck list
that existed to carry them is gone with them.

**Paid for rescues you had nothing to do with.** A distress call paid the moment
its last attacker died, whoever killed it — a patrol clearing the post while you
flew past put 260 in your pocket for watching. It pays for damage *you* dealt now,
and it pays **what that power thinks you are worth**: 1.35× if they trust you,
0.35× if you are wanted. Never nothing — that they pay badly is the information.

**An escort that got there too late to matter.** It reacted to a pirate within
2,200 units of its client, which is after the pirate has already made its
approach; measured, the hauler died before the escort closed. 3,400 now.

**Ships flew at the wrong speed.** A Needle in a pirate's hands did 120–190 and a
Needle in yours does 360 × 1.44. The roster meant one thing when you bought a hull
and something else when you met one, and *"can I outrun that"* had no answer you
could work out from the thing you were looking at. Every ship out there now flies
its own hull's advertised multiplier, cruising rather than flat out.

**Nothing spawns in a wall.** Every system that picks a point in space was written
when the only solid things were a planet and a small derelict. A rock loose in a
corridor can never get out; a hunter in a hull cannot be reached or escaped; a
drive part dropped in a bulkhead is on the chart, named, and gone for good.

**And on a phone:** the station itself is now the door — at one hull point the
prompt line correctly reads THE NEXT HIT KILLS YOU and a phone was left with no
way into the shop at the moment it needed one most. Buttons are a fifth taller
where they have room (dense list rows are left alone: a target that overlaps its
neighbour is worse than a small one). Type is 19px rather than 16. The two dim
violets were about 2:1 against the background — a rumour, not a colour — and are
lifted. And the parts grid is four across rather than three, because a catalogue's
job is to let you see a lot of it at once.

### And the harness stopped being random

The simulation uses `Math.random` for everything that is not world generation, so
the suite was non-deterministic — a check that fails one run in four is worse than
no check, because it trains you to re-run until it passes. One seeded generator
per boot: the same fight every time, and a failure is a fact rather than a mood.

It immediately turned a flake into a finding. "The hauler did not survive being
defended" had been failing intermittently; pinned down, it was a scenario that gave
every ship in it the same speed — so the hauler could not run, the escort could not
catch up, and the pirate sat in firing range forever. That is not a test of
escorting. It is also what turned up the escort's reaction radius above.

---

### A long list from the cockpit  ·  **DONE**

Most of it one complaint wearing different clothes: **the things out there were
not quite real.** You could fly through them, their fire could not touch you, and
they could not hit anything that was moving.

**A hull is solid, and hitting one costs.** Two ships meeting at speed is the
oldest hazard this game has and it was the one thing out here that could touch you
and did not.

**A stray round is a real round.** Somebody else's fire was flagged friendly,
friendly meant "cannot touch the player", and the practical effect was that a
fleet action was a firework display you could park inside. It does not make the
shooter your enemy — nobody aimed at you, you were in the way.

**They aim where you are going to be.** Every ship out here fired at the position
its target occupied at the instant it pulled the trigger, so anything crossing its
nose was never hit by anything, ever. The bots in the other modes have led their
shots since the first version of this game. And they check the line first: a ship
in a firing line used to empty its magazine into the back of its own escort.

**They steer round you** unless they are coming for you — which is also what makes
the ones that do not give way read as a threat.

**Ships stopped evaporating.** Anything spawned *at* you carries no chunk id, and
the streamer only re-adds ships it can find in a chunk — so every time you crossed
a chunk boundary, which is every few seconds of flying, the ship chasing you
silently stopped existing.

**The Vault's lines are walls.** Every one of them was stamped as collision discs
and drawn from the same list, and the Vault was simply missing from the function
that stops the *player* — traffic bounced off it and you did not. Its core post
also sleeps now until you come down a spoke for the middle, and says so once
before it wakes.

**Battles are rare.** One chunk in eighty near home is *constant* at a chunk every
few seconds of flying; the sky was never quiet. A quarter of that — measured, 100
battles in a 61×61 block became 14.

**Stations are places ships pass through**, not places they collect: a chunk with
a station in it is exactly the chunk most likely to have rolled traffic, so every
shop had a permanent crowd outside it. One ship at spawn, twelve at the peak of
ninety seconds' flying.

**The manifest is the tutorial.** It ran to 280,000 units for the fifth part,
which is most of an hour of flying for somebody who has not yet learned why they
would want to. Five of the six are inside 52,000 now — ten minutes end to end —
and the sixth is still the Leviathan, which is supposed to be a long way away.

**Ships look like ships.** Everything else in the sector was a cut-out sliding
across the screen: no engines. Hulls burn now, and one big enough to need more
than one engine has more than one. And sixteen hulls carry **hardpoints and
plating** — a two-gun ship looks like a two-gun ship from across the screen, and a
capital reads as a structure rather than as a very large arrowhead.

**Interface:** the market says **SELL** and **PURCHASE** rather than "IT BUYS" and
"IT SELLS", which described the station's side of the transaction and differed by
one letter in the middle of a word. Parts on the shelves carry their pictures. The
parts grid is five across on a phone. **TRACTOR RIG → TRACTOR BEAM**, **HEAVY RIG →
HEAVY BEAM**.

**The ship page is INVENTORY**, and the cargo hold is the first thing on it — it
used to be third, under two panels a player checks once a trip, below the one
number they check on every dock. Storage is tiles with pictures, counts in the
corner, and **pressing one opens a card** saying what it does, because a picture
can say what kind of thing something is and cannot say "+34% scan range".

**The chart answers a tap.** Selecting something rings it and blooms a flash where
your finger went, and pins can be selected too — they were the one kind of mark on
the chart you could not point the ship at.

**Worlds sell what they dig.** An inhabited world sold water and food and nothing
else, which made every settlement the same settlement. Each has a material it
produces, cheaper than a station, and finite — a place rather than a tap.

**And the static is louder**, on Ric's call.

---

### The waypoint is gone  ·  **DONE**

There were two things you could place on the chart. There is one.

The waypoint went because the thing that replaced it does the same job strictly
better. **Tap anything on the chart and the ship points at it.** A waypoint was a
coordinate dropped by hand at a spot you were trying to hit by eye — you could not
put one *on* a station, or a well, or a memorial, because the gesture had no idea
what was under your finger. Selecting does, so the arrow on the flight screen is
aimed at the thing rather than near it, and it carries the thing's name.

Pins are the other half and do the other job: a waypoint could not be named, kept,
coloured, or have a second one.

What went with it: the yellow arrow, the chart glyph, the panel-chart glyph, the
WAYPOINT / MOVE WAYPOINT / CLEAR WAYPOINT buttons, the arming mode, the state
export, and the field in the save file. The chart's rail is one button and ten
filters.

---

### One hold, and a part weighs something  ·  **DONE**

> *"cargo hold and storage need to be the same thing. if that makes sense all
> that info needs to be in there parts cost weight too."*

There were **two places to put things** — a CARGO HOLD with a cap on it and a
STORAGE crate of spare parts with no cap at all — and the second one made the
first one a lie: you could be full to the brim, unable to pick up one more unit
of ice, and still be carrying six spare engines in a pocket nobody could see.

One panel now, one number, and a part you are not flying **weighs**. The weight
is by **category** rather than by rarity: armour is plate at 10, an engine 8, a
beam or a gun 6, panels 5, a device or an odd one 4, a scanner or a thruster 3.
Rarity already decides how long a fit takes and how far out a part is sold, and
it is deliberately not a quality ladder — making it a weight ladder as well would
turn it into one. Category is the honest axis anyway: the difference between a
plate and a dish is a fact about the thing, not about how hard it was to find.

Measured against the holds they go in, the starting skiff carries 60, so a spare
plate is a sixth of it and four spares is most of a trip's salvage. The big
haulers run past 800 and can carry a workshop.

**A fitted part weighs nothing**, and that is the point rather than an oversight:
it is bolted to the outside of the ship rather than lying in the hold. The four
slots are now the cheapest place to keep a part, which is the right pressure —
*use it or carry it*.

**Every way a part gets aboard respects the cap.** Bought, built, pulled off a
slot, found in a cache. Two of those are worth saying out loud:

- **Pulling a part off a slot can be refused**, because a fitted part weighs
  nothing and a carried one does not. The alternative is a hold reading 64/60,
  which is a cap that is not a cap.
- **A cache does not open onto a full hold.** A cache is the only place the
  find-only parts exist, so opening one, spraying its salvage and dropping the
  one thing worth the flight would be the worst moment in the mode. It checks
  first, says what is inside, and keeps.

**And dying does to a spare what it already did to a manifest part.** The hold is
lost, so the materials are gone — but a part has never simply vanished in this
mode and it does not start now. Every spare is set down where you fell, on the
chart, by name, and the trip back for it is a trip you have to make. Each one
carries an id, so two of the same part on the floor are two objects rather than
one that duplicates itself when you collect it. Downsizing to a smaller hull does
the same thing at the yard: the materials that will not fit are left on the dock,
and the parts are set down outside for you to come back out and collect.

### The arrow rides a ring  ·  **DONE**

> *"that arrow needs to be lined to a circle instead of the outside of the page.
> there are just too many bugs with it."*

Every edge arrow — the objective, the scan's returns, the thing you picked off
the chart — used to sit where a ray from the middle left a **rectangle** inset
from the screen. The argument for that was about where the pixels are: an arrow
on a rectangle is at the edge of the screen, where an ellipse floats a third of
the way in at the corners.

It was the wrong thing to optimise, and the bugs all came out of the same place.
On a rectangle an arrow's distance from the middle **depends on its bearing** — a
corner is 1.6 times further out than straight up — so an arrow slides and jumps
as the ship turns even though the thing it points at has not moved, and it
crowds into the four corners, which is exactly where the HUD lives.

It is a **circle** now, radius set by the shorter half of the screen so it stays a
circle on any window. One radius for every bearing: the arrow moves at a constant
rate as you turn, it is the same distance out wherever it is, and the corners are
left to the interface. The logic that walks an arrow around the ring when it
lands under a panel is unchanged; it now walks around an actual ring.

### The empty room  ·  **DONE**  ·  *a looking tool, not a mode*

> *"make a run of a map that has nothing except the leviathan so i can fly
> around it and see it"*

`index.html?leviathan=1` builds a sector with **nothing in it but the
Leviathan**, and parks you square on to its flank.

The Leviathan is nine thousand units of authored hull and the only way to judge
it — the proportions, how the plates read at distance, whether the corridors are
legible from outside — is to fly around it with nothing else on the screen. In an
ordinary sector it is forty thousand units away with wells, rock, traffic and a
war in between.

Four things it does deliberately:

- **It cannot touch your sector.** It writes to its own key, so an afternoon of
  looking at a hull does not overwrite the run you are half way through.
- **Nothing else is generated.** Not thinned — each chunk rolls normally and is
  then emptied *before* its landmark is built, so the roll stays a pure function
  of its coordinates and the Leviathan keeps its own furniture. Rocks are
  streamed around the ship rather than rolled into chunks, so they are turned off
  separately.
- **Nothing is trying to kill you**, including the clock: no hunters, no
  battles, no grudges, and no sentries. The holds inside it stay — they are part
  of the authored interior and the reason the corridors go where they go — but
  their **guard lists are emptied at generation**, so no sentry is ever posted.
  A cache is structure; a sentry shooting at you from a bulkhead is not looking
  at a hull. The tanks do not drain either.
- **Two extra zoom steps**, FAR and THE WHOLE HULL, which exist only in this
  room. The widest the game allows shows about 2,200 units and the hull is 9,200
  long; a quarter of it at a time is the right amount for flying through and the
  wrong amount for looking at the shape of it. In a real sector a camera that
  wide is a rock you cannot see coming, which is why they are not offered there.

The spawn is in two steps, and the reason is worth keeping: the streamer only
builds chunks near the ship, so the first placement is simply *close enough to
make the Leviathan exist* — three thousand units — and the real one happens after
the sector has streamed, when which way the hull lies is finally a thing that can
be read.

### The Leviathan comes in to 40,000  ·  **DONE**

> *"the last part is wayyyy too far out..... so bring that one in to like 40k"*

The manifest's sixth part is inside the Leviathan, and the Leviathan stood on the
ladder's **last rung** — which 6.7 stretched to 3,400,000 nominal and which a
seed could put past five million. So the one step of the tutorial that asks you to
go *inside* something was the one step nobody ever reached.

It is **not a rung any more**. It stands at a fixed 40,000 in every sector, with a
jitter of about ±15% and no `spread` — measured over forty seeds, 34,600 to
45,600, median 39,000.

Its old rung did **not** leave with it, and that is the part worth writing down.
The ladder is eight landmarks over eight rungs now, and the top rung — 3,400,000 —
stayed where it was, moved down one row onto the entry below. 6.7 stretched the
ladder to buy twenty hours of game, and letting the far end halve because the
Leviathan moved would have spent that on nothing. Measured over forty seeds: the
nearest landmark lands between 7,600 and 28,900, and the furthest between two and
seven million.

The trade, stated: **the Leviathan is no longer the sector's finale.** It is the
end of the tutorial instead, which is what its part being inside it always made
it. The last rung now goes to whichever landmark is dealt it.

---

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
3. **6.5 — consequences that persist.** Three kinds of memory so far. The cheap
   wins are named: a ship you saved keeps its name and comes back, a pirate that
   escaped is respawned rather than re-rolled, a convoy you destroyed leaves a
   wreck field.
4. **6.3's last gap** — NPCs cannot run out of anything and a well does not kill
   them. A hauler dragged into a star in front of you is the accident that rule
   exists for.

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

### What 6.4 landed  ·  **DONE**

**A device is a part you press.** That is the whole of the new machinery and it
is deliberately thin: a part with a `device` effect takes one of the four slots
like anything else, is bought or built or found like anything else, takes its
rarity's fitting time like anything else — and adds two things. A **cooldown**,
which is what makes it a rhythm rather than a switch. And a **button**, which is
per *slot*, because the slot is the thing the player is already pointing at: the
parts page says what is in slot two, so slot two is what the key and the thumb
button are named after.

**CARGO EJECTOR** — the hold over the side, in one press. It is the answer to a
full hold two hundred thousand units from a shop, and it is the answer to a
pirate: *they came for the cargo*, and cargo lying in space is cargo nobody has
to be shot for. Anything hunting you that wants to rob you breaks off and goes
for it — and takes it, which is the transaction actually completing rather than a
distraction that costs them nothing. A **hunter** does not: it came for you.

**DECOY LAUNCHER** — a shell that burns like a hull and lies about being one. It
does **not** attract attention, which is the version that could be used to start
a fight from a safe distance; it *steals what is already pointed at you*.
Sentries that are awake fly at it and shoot at it, an angry ship shoots at it,
and a seeker turns onto it. A decoy dropped over a sleeping post is a flare in an
empty room. It is solid to a round, too, and each hit costs it two of its
fourteen seconds — a decoy in a crossfire does not last its full life.

**MINE LAYER** — something behind you that the thing chasing you hits. Armed a
second and a half after it leaves the rack, and then **it stops knowing whose
side it is on**: fly back over your own and it takes the hull point it would
have taken off anybody else. That is the cost, and it is the only thing stopping
a mine being a free turret towed behind the ship. It ignores *you* until you have
been outside its radius once, though — a mine is laid thirty units off your own
tail, well inside the radius it goes off in, so without that rule one dropped
while you were drifting would arm underneath you and take a hull point for
nothing, which is a gotcha rather than a cost. The ring is drawn from the moment
it lands, so the cost is one you can see coming. Ten live at once; the oldest
fizzles.

**EMERGENCY JUMP** — the panic button, and deliberately not a good one. It throws
you fourteen to thirty-four thousand units down the way you were pointing and
leaves you there: **no speed, no scanner, and a sector you have not charted.** It
is the difference between dying here and being lost somewhere else, which is what
an emergency jump should be worth. The chunks under the destination do not exist
until you arrive, so what is in them cannot be checked beforehand — the sector is
streamed in first and the ship is pushed clear of anything it landed inside
afterwards, out past a well's whole reach rather than out of the radius that
kills.

**The controls screen grew a row.** The four slots are keys, they are `1`–`4` to
begin with, and they are **rebindable like everything else** — a third row on the
key grid, under the two seats and separated from them, because they belong to one
mode and to one seat. Taking a key off a slot and giving it to thrust works in
both directions; boundKeys covers them, so a slot rebound to `/` does not open the
browser's find bar every time you drop a decoy.

**And the phone got four more buttons** — one per slot, appearing with the part
and going with it the way the reverse thruster's does, laid out beside the gun by
default and **draggable anywhere** from the phone-controls screen like the rest of
the pad. Each one carries its own cooldown as a sweep across its face, so "not
yet" is the thing you are pressing rather than a number somewhere else on the
screen. The flight panel mirrors them off the hull bar's left shoulder — a chip
each, the key on a desk and the slot number on a phone — opposite the scan
button, because the two are the same kind of thing: a verb with a wait on it.

**GRAPPLE LINE** — a line and a winch, and the cheapest verb in the game. The
worry when this was listed was that it is 5.5 wearing a different name: a
grapple with nothing to tow is a tractor beam with a longer description. So it
does not tow. **It pulls *you*** — at anything solid inside 1,500 units and
inside a cone off the nose, hard, and the tractor rig keeps its own job of
bringing salvage in. Three systems, and the third is the one that made it worth
building: it is a way to move that is not the engine, it is the first answer to
a gravity well that is not "have a bigger engine", and a Warrens tunnel is a
corridor of anchors. It is not safe, either — it throws you at a solid thing at
620 units a second and the landing is your problem.

**SILENT RUNNING** — ten seconds of not being there. There was already a part
that hid you: RUNNING DARK, which damps the hull when the engine is off and
takes you off a *sentry's* list. That is passive, conditional, and about one
kind of watcher. This is the other shape of the idea: a button, and it works on
everything that is looking for you — the sentry, the pirate that has you, the
patrol shadowing you, the missile already in the air.

Two rules carry it. **Firing ends it**, immediately and always, which is what
keeps it an escape rather than an ambush — a cloak you can shoot out of makes
every fight in the sector yours to start on your terms. And what it takes is
*forgotten, not paused*: a pirate that comes out the other side of ten seconds
still on your tail has not lost you, it has blinked, so the anger goes and has
to be earned again.

**EMP CHARGE** — one burst, and everything electric inside 1,100 units stops.
Sentries go limp, mines fizzle, and every ship in reach loses its engine and its
guns for six seconds — long enough to leave, or to get near something you could
not otherwise have got near. Not damage: a ship you EMP and leave comes round
still angry and remembers it.

**And it takes your own hull with it.** Every device in your four slots goes to
a full cooldown and the scanner goes down for as long as the stun lasts. That is
the decision the part exists to ask: the room is clear and you are holding
nothing. A burst with no cost is a button you press on entering every room,
which is a percentage wearing a verb's clothes.

**Six of the seven are craftable and the best one is not**, which is the rule
from the bottom of the recipe list applying to a new category rather than an
exception being made for it. SILENT RUNNING is exotic, bought and never built.

*The rule from here is unchanged:* **a new part has to add a verb or it does not
get made.** Ric's list is empty.

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

### 6.7 The almanac is a twenty-hour book  ·  **DONE** (the ladder; tier 5 is 6.6)

> *"All the almanac stuff I did too fast — maybe two hours of gameplay and all of
> it is done. Roughly the last 3 should be extremely difficult to find. The last
> 10 should be pretty hard, maybe 20 hours, more maybe. The first 5 should be in
> the first 10 minutes, and the next 5 between half an hour and two hours. Some of
> that stuff should be special — like you've seen everything else in the game and
> then you see that and you think **wtf**."*

**Why it happens, measured rather than guessed.** Ten minutes of holding the
throttle reaches **344,617 units** from home. The furthest landmark in the game —
the Leviathan, which is the finale, the thing the whole manifest is pointing at —
sits at **112,000**. The entire ladder is inside three minutes of flying. Nothing
about the *entries* is wrong; the sector they are hidden in is a thirtieth of the
size it needs to be.

#### The shape it should have

| tier | entries | when | where |
|---|---|---|---|
| **1 — the first sitting** | 5 | first 10 minutes | at home, or inside 5,000 |
| **2 — the first evening** | 5 | 0.5–2 hours | 20,000–120,000 |
| **3 — the long middle** | ~16 | 2–20 hours | 150,000–2,000,000 |
| **4 — the far end** | ~10 | 20 hours plus | 2,000,000–12,000,000 |
| **5 — the ones nobody expects** | 3 | further, and harder than far | 15,000,000+, and gated on more than distance |

**The ladder stretches; the entries mostly stay.** The eight landmarks currently
run 13,000 to 112,000 and should run 13,000 to about 9,000,000 — the near ones
barely move and the far ones move by two orders of magnitude. That alone converts
"two hours" into most of the curve above, because the twenty-two telemetry entries
are already spread across the things you do on the way.

**Water is what makes distance cost something.** Twenty minutes of water and
forty-five of food mean you cannot simply point at the abyss and hold W: at
900,000 units an hour you are four hours from the far tier, and that is a supply
problem. Which is the good news — the **ice melter**, inhabited worlds and cargo
capacity are already the answer, so the far end of the almanac is gated behind the
middle of the crafting tree without a single new lock being invented. A player
reaching tier 4 has *built* their way there.

#### What tier 5 has to be

Not "the same thing, further away". The last three are the payoff for Phase 6.6 —
**authored, rare, and different in kind** — and they only work if the rest of the
game has trained you first:

- It should be **unmistakably not procedural.** Everything out there is generated
  from a seed; these three should read as *placed*, by someone, on purpose.
- It should **break a rule the game has spent twenty hours teaching you.** The
  Wall is the existing example and the weakest one: a wormhole that does nothing.
  The bar is higher than that.
- It should be **findable but not stumbled on** — a rumour, a clue in another
  entry, a signal you can only hear with a deep scanner, a place that is only
  there under some condition.
- And when you find it, the correct reaction is *"what the hell is that"* rather
  than *"ah, number thirty-four"*.

Candidates, none of them committed, all of them the right *shape*: something that
is still transmitting and answers when you talk to it; a structure far larger than
the Leviathan that is clearly still under construction; a sector where the
generation itself is wrong and the rules of flight change; something that is
already charted on your own map before you get there.

**What this is not.** It is not more entries. Thirty-four is a good number and
the book is well made — the pictures are the best thing in the mode. This is
entirely about *where* they sit and how long the sector takes to cross.

#### What landed

**The ladder runs 13,000 to 3,400,000** as a base, and a sector's own `spread`
takes the far rung past five and a half million in a wide seed. Measured against
the game's own top speed that is **sixteen ten-minute flights** to the Leviathan,
where it used to be less than one. The near rungs barely moved, because the first
hour should feel the way it did.

**The danger curve had to stretch with it.** It topped out at 320,000 — which was
past the old last landmark, so it never mattered — and leaving it there would have
put nine tenths of the new sector in one flat band, identically dangerous. Seven
bands now, running to 1,800,000, with a seventh called **THE LONG DARK** past it.
Supermassive wells consequently start around 320,000 rather than 140,000.

**The manifest stretched less**, to 9,000–280,000: the jump gate is the main arc,
a thing you build on the way out, not the last thing you do.

**And the chart can show it.** The widest zoom was 690,000 units across — fine for
a 112,000-unit ladder and useless for a five-million-unit one. Six more steps at
the wide end; the widest now shows about forty million.

**Six tests moved from absolute distances to fractions of the curve.** Every one
of them sampled "near home" against "the deep" using numbers written when the
curve topped out at 320,000, and every one of them was quietly comparing two
points in the same band. They ask the game how big the sector is now. Two of them
were finding *nothing* — no supermassive well exists inside ±70 chunks any more —
and reading that as "gravity grants nothing" rather than "you have not gone far
enough".

One real bug fell out of that: the slingshot test picked the first heavy well it
found, and in one seed the approach ran into a world, so the ship stopped dead on
a surface 2,341 units short and the measurement was of a parked ship. It picks a
well with a clear run-up now.

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

## Coming back to where you were, and an account to come back on

Two things, and only the second one needed a server.

### The place  ·  **DONE**

The book saved everything about a run except the one fact a player would name
first if you asked them what a save is: where they were. `setupSurvey` put every
resumed survey at the origin, with a comment saying that was where a resumed
survey should start.

It was not. It was the cheapest ride home in the game — fly to the abyss with a
full hold, close the tab, reopen it next door to the shop — and it meant the
light drive, the gates and the whole question of *getting back* were optional in
a mode built around distance being expensive. The book carries `at` now: the
position, the heading, and nothing else, because a survey that resumes at the
speed the tab closed at is a survey that resumes in a wall.

Two exemptions, both resuming at the origin the way every book used to:

- **A book written while you were dead.** The death page is a position you must
  never come back into, and a respawn puts you at the station regardless.
- **A book from a different seed.** It describes a place in a world that no
  longer exists.

This makes the mode harder and it is meant to. Every way home is now a way home
you have to have built or found.

### The account  ·  **DONE**  ·  *optional, and it stays optional*

Playing without one saves exactly as it always has, to this browser, which is
more fragile than most people realise — one cleared history and six hours are
gone with no warning. The pause screen now says so in one line rather than
nagging: *kept on this device only — an account keeps it if this browser
forgets.*

Signing in adds a second copy and changes nothing else. The run reads and writes
local storage at full speed and the account is told afterwards; nothing in the
game ever waits for a network. The seam that makes that true is `bookStore` —
the one thing that knows where the book goes — and it is also what the Steam
build will need, because on Steam there is no sign-in at all: the player is
already signed into Steam, and Auto-Cloud syncs a declared folder with no code
from the game. Three destinations, one book:

| | where the book lives | sign-in |
|---|---|---|
| Browser | `localStorage` | none |
| Browser + account | a row in `public.saves` | email and password |
| Steam | a file in the Auto-Cloud folder | Steam already did it |

**Two saves that disagree are never resolved silently.** Last-change-wins is
right for settings and wrong for this: both sides are somebody's hours, and the
newer one is not reliably the one they care about — a run made on a plane with
no signal is older than the one a phone uploaded from the sofa. So the panel
says what each save is, in the terms that identify it — sector, cash, catalogue
size, when, and from what device — and the player picks.

**No SDK.** The whole of what a save needs is four HTTP calls against plain
REST. Pulling in 120 KB of CDN script to make them would cost the game the two
things it actually has — no build step and no third-party script on the page —
and would put loading somebody's save at the mercy of a CDN and of whatever
version that CDN decided `@2` meant this morning.

**Its own Supabase project, not ATLAS's.** ATLAS grants reads with `for select
to authenticated` and no crew check, so its privacy rests entirely on signup
being switched off in its dashboard — and a public game needs signup switched
on. Every policy on `public.saves` names `auth.uid()` instead, so a stranger
with an account sees their own row and nothing else whatever the dashboard says.

**What is still open:** password reset needs SMTP the project does not have yet,
and a player who cannot get back into an account cannot get back to their save —
which is the exact failure the feature exists to prevent. Until that is wired
up, the local copy is the one that matters and the panel is careful never to
suggest otherwise.

---

## Rules for building this

1. **One item at a time.** Finished, tested, committed, before the next starts.
2. **Tests for anything that can rot silently.** Numbers, placement, curves and
   state machines get a test. This mode has already shipped four bugs that
   rendered perfectly — an invisible salvage painter, a cache inside a wall, a
   wall closing to eight per cent, shake that never decayed.
3. **Every system has to be readable from the screen**, before it is clever.
4. **Nothing gets built that the two-minute test cannot survive.**
