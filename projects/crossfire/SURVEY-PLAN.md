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

## What already exists

Done and tested, as of this file being written:

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

## What is wrong with it right now

- **No stakes.** Losing your hull costs a trip, not a run. Survival needs death.
- **Too many hazards, all the same size.** They read as scenery to dodge rather
  than as things that will kill you.
- **Too close in.** The camera sits tight enough that a well fills the screen
  before you can react to it.
- **Too much to read.** The mode explains itself in text, and text is not how
  someone learns a game in two minutes.

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

> **Worth knowing before phase 3.** Measured from five distances out to 300,000
> units, the nearest place that sells water is *never more than a minute of flight
> away* — so supply is not yet the constraint 2.4 describes. The tension that does
> exist is informational rather than physical: you have twelve minutes of water and
> you do not know where the nearest station is until you have charted it. The
> levers, when it wants tightening, are the station roll (currently ~1 in 20
> chunks, plus one given at home) and the tank sizes. Left alone rather than tuned
> blind, because it is a feel decision and 3.3's twenty-five ships will change the
> travel budget it depends on.

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

## Phase 3 — the economy and the ships

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

> **Open question.** Ric flagged this himself: whether size-driven zoom actually
> works at this scale. It will be built behind the Settings zoom control (1.3)
> so both can be felt together, and if it fights the game it gets cut rather
> than tuned forever.

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

---

## Rules for building this

1. **One item at a time.** Finished, tested, committed, before the next starts.
2. **Tests for anything that can rot silently.** Numbers, placement, curves and
   state machines get a test. This mode has already shipped four bugs that
   rendered perfectly — an invisible salvage painter, a cache inside a wall, a
   wall closing to eight per cent, shake that never decayed.
3. **Every system has to be readable from the screen**, before it is clever.
4. **Nothing gets built that the two-minute test cannot survive.**
