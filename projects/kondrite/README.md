# KONDRITE

KONDRITE is a dependency-free canvas game for one to five ships. Play co-op
against asteroid waves, fight a no-time-limit Battle Royale inside a closing
wall, run the three-mission Campaign — escort a transport, raid an enemy convoy,
and break a mothership in an all-out fleet war — or take a Survey, alone, of the
endless space all of that happened in. It runs as static HTML, CSS and JavaScript with
no build step.

## Run locally

From the repository root:

```sh
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000/projects/kondrite/`.

## The menu

**There is one game, and it is Survey.** The front page says so: the survey's own
picture, and one button under it that reads CONTINUE THE SECTOR — with how much
you have logged — or BEGIN THE SURVEY on a first run.

There is deliberately no *start a new one* beside it. A sector is hours, and the
button that throws one away has no business next to the button that resumes it;
the game already has one place where that happens, the reset in SETTINGS, which
arms on the first press and wipes on the second.

And that is nearly all it does — under the button is SETTINGS, and in the corner
are the two switches nobody came here to press. **Six pieces of text on the whole
page**, which is the second thing Ric asked for (*"less words … look like a real
start up page from a professional gaming company"*): the art went full bleed
behind everything instead of sitting in a bordered box in the middle, and two
sentences came off — one about what a station has in it, one about how many
people can play. A front page is not where a game explains itself.

### The front page is a run

The art behind the wordmark is not a picture of the game. It is the game, being
played, by a pilot who wants things — `attract.js`, and it is the only piece of
art in the project that simulates rather than draws. Ric asked for *"the
starting ship flying around shooting astroids with the ocasional star slingshot
or black hole slingshot … maybe passing a station and a few other ships …
maybe getting into the fight"*, and every noun in that is an **event**. A rock
you shoot has to break. A slingshot is a trajectory bent by a mass, and there is
no faking the moment it lets go. A fight has two sides that both decide
something. None of it can be a sine, which is exactly what `menu.js` is for and
why this lives somewhere else: a card diorama is a closed-form function of one
clock with no state to get wrong, and the front page is the opposite promise.

Every constant in it is copied from the game rather than invented. `TURN` is 3.2
because a Kondrite ship turns at 3.2; gravity is `mass / (d² + soft²)` with the
star's own mass and softening; the speed cap, the thrown-boost allowance and its
slow bleed at `COAST_DRAG` are the survey rules verbatim — which is what makes
the slingshot read. You come out of a black hole at better than twice the speed
you went in at and spend the next ten seconds coasting it off, and that is not a
flourish, that is `THROWN_CEILING`. The hulls are the roster's own, drawn by the
same `drawHullArt` that draws yours: the ship on the front page *is* a Skiff.

What stops a simulation being a screensaver is a director. Set pieces come out
of a shuffled bag — a star to whip round, a black hole to whip round, a station
to call at, a fight to join — with rock-breaking in between and traffic crossing
throughout, so every element Ric asked for is guaranteed inside about two
minutes rather than left to dice that might never roll it.

And because none of that is visible in a screenshot, `test/attract.js` flies it
for an hour and asks the questions a person watching would: how long before each
thing turns up, what is the longest the page goes with nothing happening on it,
does a slingshot actually leave faster than it arrived, does the pilot point at
the thing shooting at it, does anybody change sides, does anything leak. Most of
the tuning in that file came out of those numbers rather than out of looking at
it — the pilot used to fly *into* stars, the gun used to fire eight rounds a
second because a recovery was missing, and the page once went twelve seconds
quiet in the middle of a three-ship dogfight.

It flies at **four fifths** of the sector's own speed. Ric: *"if you could slow
it all down like 20%"* — a page read at a glance, with nobody's hands on it,
comes across as frantic at the pace the same ship is flown at in a match. Only
the moving is slowed: the director still deals a set piece on the same wall
clock, so the page is calmer without being emptier.

There was briefly a quieter **SIMULATORS** line under
it, with a solo/multiplayer lane page behind that; Ric took the door off —
*"simulators tab should be inside of the survey game"* — because a machine is
something a **station has**, and a door to one on the front page made it a second
thing the game offers rather than a thing the world contains. Everything else in
here is a machine: an arcade cabinet in a world that has arcade cabinets, played
for a score that never crosses back into the sector, and you find one the way you
find a shop — by flying somewhere that has one.

The lane page went with the door, and it asked *alone or with other people*.
Standing in a room full of cabinets answers that by being a place rather than by
asking, so both answers live in the room now: the cabinets are the solo one, and
**[P] with other people** is the other. The mode cards are still the page behind
that — a row of cards, and pointing at one opens it. The card takes the room the
others give up, the paragraph fades in, and the picture at the top is the mode
*moving*. Those pictures are drawn, not filmed; see `menu.js`.

Multiplayer stops at the count screen first. Escape steps back to the room you
came from, or to the front page if you got here by `O` — the one shortcut kept
on the title, for playing with somebody without first flying to a station.

## The game, and the simulators

| | Players | Rules |
|---|---:|---|
| **Survey** — *the game* | 1 | No edges and no losing. A station of your own in six pieces, each with a clue, endless procedural space, a chart you pin yourself, a thirty-five entry almanac, salvage, a refit and a derelict you fly inside |

And the machines. They are in one place: **the corner of every station and every
inhabited world** — a SIMULATORS tab beside the shop, a room with three cabinets
in it, the attract loop running on each and your best on that machine printed on
the front of it before you press anything. Beside them is the station's own
board, and under them the two doors that used to be on the front page: the people
to play with, and the real board they are on. Walking up to one is something you do in the middle of a run:
the game saves first, the cabinet takes a moment to boot, you play, and you come
back standing at the same dock with the sector where you left it. The sector
carried on without you while you played, which is correct and is said on the way
back in.

### The board on the wall

Beside the machines is a board, and it is **made up** — which is the honest thing
for it to be, because a solo score has nobody to witness it. A dozen names and
scores, generated from the cabinet's own coordinates and whoever holds the sky
over it, and you inserted at your rank among them in your own colour.

It is the sector's own people, and that is not decoration. A Cordon board is a
duty roster — *WARDEN HAKIM*, *LANE 36 · REYES*. A Hallow board is a list of
people older than the lanes — *AELWYN OF THE THIRD ROAD*, *ELDER VARNE*. Morrow
is a ledger, where the house outsells the person — *HOUSE SABATO*,
*COLQUHOUN & SONS*. Pirates are graffiti, and half of them are a threat rather
than a name — *SPLITTOOTH*, *THE LAST WORD*. Walking into a station in somebody
else's space and finding somebody else's people on the machine is most of what
makes a second cabinet worth looking at.

Nothing about it touches a network. It is a pure function of the cabinet and the
sector seed — the same trick the chunks run on — so the same machine shows the
same twelve people for as long as that sector exists, the one next door shows
twelve different ones, and a station that changes hands in the war gets a
different dozen rather than the same twelve wearing new colours. It is never
empty on a first visit, the bottom rung is always beatable on a first go, and
there is always somebody just above you.

The page says **nobody is watching**, once, because a made-up board that did not
admit it would be the one dishonest thing in the game.

### The real one

The other kind is under **[B]** — in the room with the machines, and on the
multiplayer page — and it is witnessed.

Signing in gives **identity, not authority**. This is a static client with no
game server, so a signed-in player can POST any score they like from the
console; an account stops a board being anonymous, it does not stop it being
wrong. What a multiplayer result has that a solo one never can is that somebody
else was there. So:

> A score is not a claim you make about yourself. Every client posts one row per
> player it saw — who it is about, and who says so — and a score counts only
> when two different reporters agree on the same value for the same player in
> the same match.

The counting is a `having count(distinct reporter) >= 2` in Postgres, because a
check the client performs is not a check. It defeats casual forgery outright:
faking a score stops being a line in the console and becomes two real people
agreeing to lie about a game they played, which is a social problem and not one
worth engineering against.

A local game reports nothing, and neither does an online one with fewer than two
accounts in it — rows nobody can witness would sit in the table forever being
one person's word. A report made with no connection waits in local storage,
survives a closed tab, and goes up on the next one; re-posting is safe by
construction, because the primary key makes a repeat the same row.

One machine is the sector's challenge at a time, the same for everybody, turning
over on the UTC day. A function of the date: no network, nothing to keep in
sync, and a reason to look at a board today rather than remember it from last
week.

None of them keeps anything, and none of them pays anything back into the
sector — the score on the cabinet is the whole of what crosses:

| Simulator | Players | Rules |
|---|---:|---|
| Survival | 1-5 | Co-op asteroid waves, shared lives, optional friendly fire, wrapping arena |
| Battle Royale | 2-5 | Three lives each, two-hit hulls, stationary gravity hazards, closing wall, no time limit |
| Campaign | 1-2 | Three scripted missions, sides instead of a free-for-all, an allied fleet flying with you, a shared reserve of lives |

Battle Royale shows hull strength only for ships controlled on the current device.
First hits stay quiet; losing a life adds a short entry to the feed beneath the
minimap. Battle Royale resolves when one ship remains, no matter how long the
match takes. A winner screen shows kills, deaths, environmental deaths and time
survived for every ship.
Each spawn can take two bullet or asteroid hits before losing a life. The first
hit leaves one hull point and a brief impact shield; suns and black holes remain
immediately lethal.

The shrinking Battle Royale wall deactivates a stationary gravity hazard after
its center is outside the playable arena.

A spawn has three rules and only one of them bends. It is always inside the
current wall, and always outside every live hazard's *pull* — not merely outside
the lethal core, because a ship spawned inside a well is dragged into it while
still invulnerable and dies the moment that runs out. Those two are absolute.
Being clear of asteroids is the third, and when no point satisfies all three the
asteroids are destroyed to make room rather than the ship appearing inside one.
The opening spawn ring is re-checked once hazards and rocks exist, since it is
laid out before there is anything to avoid.

The wall pushes but cannot hold. A bounce returns at least the wall's own
closing speed, so anything the wall overtakes is moved ahead of it instead of
being carried along its face for the rest of the match.
The result screen can immediately replay the same local setup; online, the host
starts the next round for every connected player.

## Campaign

The campaign is three scripted missions, played local — one or two pilots at the
keyboard, no online. It reuses the Battle Royale engine but adds two ideas the
free-for-all modes don't have: a ship has a *side* (yours flies teal, the enemy
red), and a ship has a *kind* — most are fighters, but a transport, a turret and
a mothership are not. Friendly fire is off, so a shot only ever bites the other
side, which is what keeps a crowded battle readable.

You never fly alone. An allied fleet flies with you, and both sides field more
ships than are ever alive at once: a downed fighter is a slot its side refills
from a reserve, so a fifty-ship roster stays a thirty-ship battle and holds frame
rate on a phone. The pilots draw their respawns from one shared pile, the way
co-op Survival does; when it runs out and the last pilot falls, the mission is
lost.

Each mission is a **run of phases** with a shifting objective, not one long
fight:

| # | Mission | The acts |
|--:|---|---|
| 1 | **Convoy** | A transport crosses from one side of the map to a planet on the far side at a steady, unwavering speed — your job is to keep it alive the ~fifty seconds that takes. Three worsening threats travel with it: three waves, an ambush, then a blockade gunship. Reaching the planet is the win; losing the transport is the loss. |
| 2 | **Raid** | Hunt down three fleeing enemy transports and their guards · then ride out the counterattack they scramble in revenge. Lose if every pilot falls. |
| 3 | **Mothership** | Breach the picket line · knock out the hangar bays that keep launching fighters · destroy the three shield generators sealing the core · kill the exposed core, which comes apart in a slow-motion death sequence. An allied flagship pushes in with you and can be lost. |

Every mission is fought across a real battlefield: drifting **asteroids** for
cover and **suns and black holes** whose gravity bends shots and swallows the
careless — placed clear of the ships' starts, the convoy's lane, and the
mothership itself, so a well never does your job for you. The bots fly around
them; so should you.

In a campaign the pilot picks a **difficulty** on the setup screen that sets both
the trigger and how many hits a ship takes. On **Easy** ships take five hits and
the gun **fires continuously** — hold the trigger for a steady stream. **Hard**
(three hits) and **Impossible** (one hit for *everything that flies*, you and the
enemy both) drop back to the three-round burst the free-for-all modes use, so
harder runs ask you to pick every shot as well as survive on less. Difficulty only
ever touches fighters; the transports, the mothership
and its subsystems always keep their own hulls, so a mission is never decided by a
single lucky shot on the objective. Easy is the default — a gentle way in.

Two things make you a commander, not just a pilot. **Squad command** — `1` focus
fire on your target, `2` defend the objective, `3` regroup on you — orders the
whole allied wing at once. And **salvage**: an enemy that dies sometimes leaves a
canister, an ace always does, and flying through one patches your hull, raises a
shield, or loads rapid or heavy rounds. Named **aces** — tougher, near-perfect,
worth the salvage — drop into the harder fights and show up in the kill feed.

The missions climb: Convoy hands a new player three wingmates that screen the
transport and weak opening waves, and Mothership is deliberately hard — the
allied fleet can crack it on a good run, but it is built to want a person tipping
the balance with orders and salvaged guns. A cleared mission offers the next one
straight away (`N`), a retry, or the mission list.

The three missions are **one war, not three loose fights**. A few of your
wingmates fly with callsigns and a forward chevron; the ones who **live** carry
into the next mission by name as veterans, flying a shade sharper. A strong
showing banks a **fleet-strength** rating and a **reserve of extra lives** that
top up the next mission's reinforcements, and the enemy aces you down are tallied
across the campaign. The debrief spells out exactly what you're carrying forward,
and `NEXT`/`RETRY` continue that war while a fresh pick from the mission list
starts a clean one — so winning matters past the result screen. All of it is
campaign-only; Survival and Battle Royale never build a fleet ledger.

## Survey

Survey is the mode with nothing shooting at you. It borrows Battle Royale's
camera-followed view and its gravity wells and drops the wall, the enemies and
the losing. There is no score, no timer and no result screen. The only thing
that accumulates is the almanac.

### It has no edges

Survey does not have an arena. Space is generated in **chunks** as you reach it
and thrown away behind you: what a chunk contains is a pure function of the seed
and the chunk's coordinates, so flying back to somewhere you left an hour ago
finds the same stars where you left them without any of it having been kept.
Nothing is stored for space you have not visited, which is the only way an
endless map costs less than endless memory.

Two consequences shape everything else. Ships never bounce off anything, because
there is nothing to bounce off — the wall code is **skipped**, not moved far
enough away to be unreachable; a `bounds` big enough to look infinite is still a
box. And "percent charted" is meaningless, since every fraction of an infinite
plane is zero, so the player is given a **count of cells** and the three
CARTOGRAPHER entries are thresholds on that count.

Rocks are deliberately *not* part of a chunk. They drift, so a chunk that
regenerated them would snap them back to where they started every time you flew
away and returned; instead a population is kept around the ship and topped up at
the edge of it, the way Battle Royale tops up its field.

### What you are doing

Survey shipped without a goal. It had an almanac — a record of what you happened
to see — and that is not the same as a reason to go anywhere. You could fly for
an hour without the mode ever asking you for anything.

So **your own station is broken**, and it is short of six parts.

There used to be two things sitting a few hundred units off the origin, and a
new player met both in the first minute: a station that worked perfectly from
the first second, and a yard — later a jump gate — that was a hole and wanted
six parts. They have swapped. There is no yard. The parts come home, and what
they repair is the place you live.

A dead station does three things and never a fourth until you bring it
something: it **buys what you are carrying**, it **sells water**, and it
**sells food**. That is the whole of the first minute, and it is why this reads
as two people scraping by rather than as a shop with its buttons greyed out —
somebody in there has a tank and no metal, and you have metal and no water. It
also answers the question the design never answered: *why is the first station
free?* It is not. It is broken, and you are the one fixing it.

Everything else on it is **visible, named, dark, and says what it wants**:

| Part | Where its clue sends you | What it turns back on |
|---|---|---|
| Drive spar | a wreck field — somewhere a lot of ships stopped at once | the dry dock: hull repairs |
| Fusion core | a binary pair, where nothing is ever dark | the counter: parts over it, at all |
| Ranging lens | a rogue world, with no star to warm it | the market: what the chart is paying |
| Jump coil | wound around a gate | the hangar: the only berth there is |
| Signal beacon | a wreck still calling, long after anyone stopped listening | stock: the counter can call in what it has not got |
| Ablative plate | deep inside the Leviathan, past its sentries | the mouth: every charted station, one dock away |

Six fetches and one payoff is a long way to walk on trust. Six fetches and six
payoffs is a station coming alive around you — and the last row is the one to
keep, because *you cannot open a hole in space beside an unshielded station* is
a better reason to want a slab of armour than the game had before.

**A missing tab teaches nothing; a dark one teaches everything.** Take the dark
rows away and the place is a shop with two items and no reason to leave. And
nothing is actually unavailable: other stations work, and you can fly to one and
buy the normal things. What you cannot do there is jump, and what you cannot do
there is change ship. So the argument for fixing your own is **nearest → unique
→ hub**, in that order, and only the last of the three is a power rather than a
convenience.

Each part is placed the way a landmark is — its own bearing, its own distance —
and **brings its own scenery with it**, so the clue is a promise the generator
keeps rather than flavour text laid over whatever the chunk happened to roll. The
distances interleave with the landmark ladder, so filling the manifest walks you
past most of the almanac on the way out.

Nothing hands you a position. The clue says what kind of place to look for, the
HUD carries a bearing and a range band, and the rest is flying. Parts do not go
in the hold, cannot be sold, and are not dropped when your hull goes — the
manifest is the spine of the mode, and a part lost in deep space would be a run
you could not finish.

### And then the hours after it

The manifest is the tutorial, and for a long time it was also the whole game —
not because there was nothing else, but because everything else was invisible
from the cockpit. Ric watched people spend ten to fifteen minutes working the
mode out, another fifteen finishing the gate, and then stop. They were not bored
of the sector. They had been told there was nothing left in it.

Four surfaces went quiet at the same moment, and all four are the same mistake:

- **The objective line said so out loud.** It had answered *what am I doing* for
  the whole manifest and then read "THE JUMP GATE IS OPEN — the sector is yours
  to wander", which is a curtain line. It never goes blank now: once the station
  is whole it points at the nearest landmark still missing from the book, with the
  almanac's own note as the clue, and only a complete set of landmarks is
  allowed to say you are finished. The four secret entries keep their redaction
  out here too — the arrow says SOMETHING UNLOGGED and nothing more.
- **That arrow states a band, never a range.** A delivery gets a number because
  you are taking something somewhere; a search gets "a very long way out",
  because a bearing plus an exact distance is a position, and no scan in this
  mode has ever handed one over.
- **The opening stopped teaching.** `OPENING` is the one piece of the mode whose
  job is making you want a thing ninety seconds before you would have found it,
  and every beat in it fired inside the first two minutes. It has a second act
  now, on the same terms — fires once, hangs on a pressure you are already
  under, names no destination: a dry tank a long way out introduces the ice
  melter, flying into lawless space for the first time says what it means, half the
  light drive's price mentions your station's second berth, and docking after the
  last part says that some parts are not sold anywhere near here.
- **Eleven parts could not be met.** The shop will not advertise what it does not
  stock, the workbench threw out everything it cannot build, and the almanac is a
  record rather than a shop. All three were right, and the result was that
  nothing picked up the job: the best part in every category, plus the two nobody
  sells at all, existed on no page in the game. `surv.seen` — the set whose
  entire purpose is "a thing you know exists and can plan a trip towards" —
  could never be told about them. They are on the missions page now, under NOT
  FOR SALE HERE, each with an address derived from its own `deep` rather than
  hand-written. It is not a shop: no prices, no buttons, nothing on it can be
  acted on from there. It is what the manifest was — a list of things that are
  somewhere else.

The rule underneath all four: there is a difference between *telling* a player
what to do and *showing* them something they cannot have yet. The first two
minutes never instructed anybody, and nobody felt instructed by a tank running
down in a shop that sells water. The hours after the gate work the same way.

### The scan is a scan now

It used to return a compass bearing to the nearest unlogged almanac entry and
print it in the message feed, which is a fine thing to have and a terrible thing
to press a button for: the answer was a number, and nothing on screen ever said
what it was a number about.

It sweeps a radius now and tells you what is inside it — salvage, caches,
stations, gates, components, sentries — each one a tagged echo that sits on the
world and the chart for twenty seconds and then fades. That is something you can
see the result of, and the scanner refit makes the circle bigger, which is
something you can feel.

Direction to the thing you are looking for is not on that key at all. It lives on
the HUD, permanently, next to the clue. A button you have to press to be told
what you are doing is a button doing the interface's job.

### The chart is yours to mark

Endless space has no place names. Nothing out here is called anything and the
chart labels sectors by chunk coordinate, which is not a memory. So you pin it
yourself: six kinds — salvage, cache, station, gate, part, danger — because "I
found something here" and "do not come back here" are different notes, and a
chart covered in identical dots is a chart you stop reading. Pins are drawn on
the flight panel too, and they are kept in the book.

Tapping a pin lifts it. The same gesture marks and unmarks, so there is no eraser
mode to be in.

### It is a world, not a backdrop

Survey shipped as a sector you flew *through*: the only thing that could touch
you was a gravity well, and every planet, wreck and marker was painted on. An
endless sector still felt small, and this is why — nothing in it pushed back.

Everything is solid now. Planets, drifting hulks and the Leviathan's plates all
resolve against one collision, and the rule they are drawn by is that **the shape
you can see is the shape that stops you**: the first time a player clips a hull
they could clearly see, they stop trusting every other edge in the sector. A slow
brush is free and only a real impact costs hull, because a world that charges a
hull point for every graze is a world you fly through the middle of.

Four things were added to have somewhere to go:

- **Wormholes.** Falling into one throws you tens of thousands of units. There is
  nothing to press — the same way there is nothing to press to arrive anywhere
  else out here. A gate's far side is a pure function of the gate, so it is a
  route rather than a random teleport.
- **Guarded caches.** Sealed while anything is standing over them. The guard is
  the point: a cache you can dash past is a pickup with decoration around it.
  Sentries are *posted*, never roaming — Survey's promise was that nothing hunts
  you, and a guard that never leaves its post keeps it.
- **Stations.** Where salvage becomes a better ship. One is planted at the origin
  so the first refit is not a scavenger hunt.
- **The Leviathan.** The eighth landmark, 112,000 units out, and the only one
  with an *inside*. Two flanks of hull discs with the stern quarter left open,
  a bow cap that makes the corridor a dead end rather than a tunnel, and three
  caches down the spine — the deepest worth the other two together.

### Two inversions

**The chart starts blank.** The minimap every other mode hands you complete is,
here, a record of where you have actually been — objects appear on it only in
cells you have charted.

**A gravity well is a tool as much as a hazard.** A star is the one place a hull
repairs, so it is a destination rather than only a way to die, and a black hole
is the fastest way across open space if you are willing to fall into one on
purpose. The cores of both still kill; in Survey that costs the climb back out
rather than the run, so the risk stays real without anything ending.

### The almanac

Twenty-five entries. Seventeen are conditions on telemetry the simulation
already computes every frame, seven are **landmarks** placed out in the dark,
and one is inside a rock. Every entry has a **picture** — a small vector drawing
of the thing it is asking you to find, which is what makes it a field guide
rather than a checklist: a name tells you what you have not got, a picture tells
you what to go and look for. Two entries keep their picture and lose their name
until found.

The seven landmarks sit at increasing distances from the origin — the graveyard
is a short flight, the supernebula is an expedition, and NODE 01 is out past
anywhere you would reach by accident. That ladder is what endless space is
*for*. Each takes one equal slice of the compass with a little play inside it,
so no seed can put the whole ladder down one corridor.

A **scan pulse** returns a bearing to the nearest landmark you have not logged,
at any range — direction only, never a position. In endless space that is the
whole navigation system: there is always somewhere to go, and no scan ever hands
you the way there.

Configurations that used to be placed by hand — a binary pair, two wells whose
pulls overlap — are now rolled per chunk, roughly one in eight. That is the
endless-space answer to a problem the fixed arena solved by hand: an entry that
needs a configuration cannot depend on a single lucky spot when there is no
single sector, so both are always somewhere ahead of you.

### Two kinds of progression

They are deliberately separate, and they pay in different currencies.

**Salvage buys numbers.** Break a rock, strip a hulk, crack a cache, and it goes
in the hold — one number with one cap. Spend it at a station across four tracks
of three tiers: hull plating, drive, cargo hold, scanner. Losing your hull spills
half the hold where you lost it, and it is still lying there when you get back:
Survey has no fail state and inventing one would only punish going and looking,
but a hold you can drop is what gives a long haul home its nerve.

**The almanac buys verbs.** Three things the ship simply could not do, handed
over for looking rather than for money, at six, twelve and eighteen entries:

| Entries | Unlock | What changes |
|---:|---|---|
| 6 | Tractor beam | Salvage comes to you. A pass over a broken rock stops being six manoeuvres |
| 12 | Warp tuning | A gate drops you at the nearest thing you have not logged, which is what puts the far end of the ladder inside an evening |
| 18 | Running dark | Cut the engine and sentries lose you — every cache becomes a choice between shooting in and drifting in cold |

A station shows both tracks side by side even though only one is for sale there.
The player staring at a price list is exactly the player who should be able to
see what *looking* would buy instead.

### The chart and the almanac are pages

Not overlays. They take the whole screen, the world is not drawn behind them,
and they are reached and left the way the title and settings screens are — a map
you read through a half-transparent asteroid field is a map you squint at. The
chart pans and zooms over the infinite lattice, draws the line you actually flew,
labels sectors by chunk coordinate and carries a scale bar; the almanac is a grid
of illustrated cards.

### Starting over

Settings carries **RESET SURVEY**. It wipes the almanac, the chart and the flown
line, the hold, the refit, the station's manifest, every pin, and the record of
which caches and hulks had been worked over — then rolls a new sector and drops
you into it. Preferences are not progress, so the zoom, the keys and the sound
all stay.

It asks twice, with four seconds to answer. This is the only button in the game
that destroys hours of work, there is no undo, and it sits near one that resets
the keyboard — a much smaller thing wearing a much similar word.

The new seed beats a `?seed=` in the address bar as well as the saved one.
Somebody who opened a seeded link and then asked for a new world means it, and
handing back the same sector would look like the button did nothing.

### Seeds and saving

A **seed** makes a sector, so a sector is a place you can go back to and a link
you can send someone: `?seed=1234`. Without one, your sector, the chart you have
made of it and the line you flew are remembered between visits. Both big
structures are run-length encoded and packed rather than written as JSON — a
survey's charted cells are the shape of the path that made them, so long
horizontal runs compress hard — and written both when an entry ticks and every
fifteen seconds of flying.

### Coming back

A survey is kept in one key — the book — and resuming reads it: the sector's
seed, the chart, the almanac, the hold, the refit, the manifest, the pins, and
**where you were**.

That last one is new, and it took something away. Survey used to resume at the
origin whatever you had done, which read as tidy and was in fact the cheapest
ride home in the game: fly to the abyss with a full hold, close the tab, open it
next door to the shop. Coming back where you actually were is what a save is
for, and it makes the light drive and the gates the ways home rather than the
reload. Two places are exempt, and both resume at the origin as every book used
to: a book written while you were dead, and a book from a different seed.

### The door

The game opens on the account question rather than straight into a sector,
because it only has a good answer *beforehand*. Asked after two hours, either
answer is bad news: sign in and there are two surveys to reconcile, stay a guest
and you have already built something one cleared history will take.

**Two ways through it** — **sign in** and **create account** — and a third that
goes back to the front page having started nothing. There used to be a way past
without an account, and it is closed: the simulators keep leaderboards, a board
needs a name to put on it, and a guest has none. It is asked once, and it stands
in front of the game *and* the machines, which is every way into a match. It is
reversible from SETTINGS, under **ACCOUNT**, where SIGN IN and SIGN OUT sit beside
RESET SURVEY — both answer the same question, which is what the game remembers
about you. Signing out puts the question back, and leaves a survey already
running alone: you meet the door on the way into the next thing, not in the
middle of the sector you are flying.

### A pilot name, and never an email

An account is an email and a password; a **pilot name** is what everybody else
sees. It is asked for once, just after the account exists, and an account made
before names existed is asked on its next visit — the question is driven by not
having a name, not by having just signed up. Three to sixteen characters,
letters or digits at both ends. An email address can never be one, which is the
point: the address is how you sign in and it never reaches a board.

It is also the name the lobby offers when you go online, so nobody is asked what
to call themselves twice.

### An account, which is required — but a connection, never

Signing in is required to play. **Being online is not**, and the difference is
the whole design.

The requirement is having an account and having signed in **on this device**.
The session lives in local storage, so it is read without a network, and a
cached session plays offline indefinitely — on a plane, in a tunnel, on a train.
An expired token that cannot be refreshed because nothing can be reached is
*not* treated as a refusal: the session stays, and it refreshes when there is a
network again. Only the service actually saying no signs anybody out. Getting
that backwards is the one bug that would turn a sign-in wall into a locked game,
and `test/door.js` holds both halves of it.

And a copy of this game with a blank `config.js` has **no account service, and
therefore no door**. That file's promise is that blank means no accounts and
everything still works; a fork of this repo is a whole game, and a sign-in wall
does not get to revoke that.

Survey saves to this browser either way, and that has not changed. What an
account adds is a *second* copy: the same book in a row of a table, so the
sector charted on the laptop is the sector that opens on the phone, and clearing
site data stops meaning an afternoon is gone.

It is a mirror and never the source. The run reads and writes local storage at
full speed; the account is told afterwards, and the game never waits for a
network to draw a frame. Writes are coalesced — Survey saves every fifteen
seconds and at about thirty events besides, and a row written that often would
spend the free tier's budget on a number that changed by one — so the newest
book goes up at most every twenty-five seconds, plus whenever the tab is hidden,
the player signs out, or the SAVE button is pressed.

Two saves that disagree are never resolved silently. Both sides are somebody's
hours, and the panel says what each one is — sector, cash, catalogue, when and
from what — and lets the player pick.

`cloud.js` talks to Supabase over plain HTTP with no SDK: sign in, refresh, read
a row, write a row is the whole of it, and 120 KB of CDN script to make four
fetches would cost the game its two actual properties — no build step and no
third-party script on the page. `config.js` holds the project URL and the
publishable key; blank there means no accounts, no door, no request is ever
made, and everything else works exactly as before. `supabase/schema.sql` is three tables.
`saves` is private and every policy on it names `auth.uid()`; `profiles` and
`scores` are the boards' half, where everybody reads everybody — the two
postures cannot share a table, which is why they do not. `scores` has no update
and no delete policy at all, and with row-level security on, that absence is
what makes a score something that cannot be walked back. **The file has to be
run once in the Supabase SQL editor**; until it is, the real board reads as
unavailable and reports queue up harmlessly.

The save button is not what keeps a run — autosaving already does that. It is
for the two things autosaving cannot do: send it to the account *now* rather
than at the end of the coalescing window, and say out loud that it worked.

### Where it lives

`index.html` was already 8,000 lines when Survey arrived, and a fourth mode's
interface — a fog chart, an illustrated almanac, contact bearings, a station
screen — was not a small tenant. Three pieces of the mode live outside it now,
each loaded the way `net.js` is:

| Module | What it is | What it needs from the game |
|---|---|---|
| `survey-world.js` | Chunk identity, the danger curve, the region lattice, the Warrens, the made-up boards | `seeded`, the chunk size, and calls that read the run's seed and world |
| `survey-save.js` | The book, and everywhere it is kept | Constants, five content tables, an empty hold |
| `survey-hud.js` | The interface | The engine's drawing primitives |

Each is a factory handed exactly what it needs, and the list is the point of the
split as much as the file is. A dependency you can read is a dependency you can
argue with — and one of them was a trap the shared closure had been hiding:
`index.html` declares `FACTIONS` six thousand lines *below* the book, which
never mattered while the validator read it at load time out of a shared scope.
Reading it at construction stopped the game booting. The content tables go in as
getters.

What did **not** move is the runtime: streaming, the ships, the devices, the
flight loop and the state the interface is handed all still live in the inline
script, because they are woven through the shared engine that the other three
modes use too. Pulling them out is a different job from moving a pure function.

`menu.js` is loaded the same way for the same reason.

All of them must be loaded **before** the inline script, which captures each
global once. Loading one late is silent: the mode would play with no chart and
no almanac, and the menu would draw cards with nothing moving inside them. The
ordering is asserted in `test/smoke.js`, and `test/browser.js` checks the real
graph — the one the browser resolved, not the one a test read out of the markup.

## Controls

- Amber: `A` / `D` turn, `W` thrust, `Space` fire.
- Green: arrow keys turn and thrust, `Enter` fire.
- `O`: open the online panel from the title screen.
- `P` or `Escape`: pause locally or open the online game menu.
- `Tab`: watch another active ship in Battle Royale, or your own side in a Campaign.
- `1` / `2` / `3`: in a Campaign, order the allied wing to focus fire, defend, or regroup.
- `N`: on a cleared-mission screen, fly straight into the next mission.
- `C`: open Settings from the title or pause menu. It is one page on every
  machine: a rail of three categories — **CONTROLS** (tabs for MOUSE, KEYS,
  CONTROLLER and TOUCHSCREEN), **GAME** and **ACCOUNT** — with EXIT GAME and
  BACK at its foot, and one panel to the right of it. Arrows walk a list, right
  steps from the rail into the panel, left comes back out, `Enter` presses what
  is under the mark, and `Escape` leaves. Nothing reads a gamepad yet; the
  CONTROLLER tab says so.
- In a Survey: `F` sweeps a scan, `M` opens the sector chart, `L` opens the
  almanac, `E` docks at a station you are sitting in, and `Escape` leaves
  whichever page you are on. On the chart, drag or arrow to pan, `±` zooms, `C`
  recentres, `P` cycles the pin kind and a click drops or lifts one — the wheel
  zooms through nine steps, from 690,000 units across down to 8,300, and the
  widest fits any world the generator can roll; in the
  almanac the wheel and a drag both scroll, and clicking an entry opens it full
  size — arrows then page through entries without closing it. At a station the
  arrows move and `Enter` buys. On a phone every one of those is a tap or a drag,
  and the almanac counter is itself the button.

  The almanac was on `L` from the first day and almost nobody found it. A
  keybinding with nothing on screen pointing at it is a keybinding that does not
  exist, so the counter names its key and is itself the button.

Every weapon fires three-round bursts, except the campaign pilot on **Easy**, who
holds the trigger for a continuous stream; Hard and Impossible put the pilot back
on the burst. Keyboard bindings live under CONTROLS · KEYS and the camera under
GAME, and both are saved in local storage. The camera is **one answer for every
mode** — an older save holding three is collapsed on the way in. On a campaign
setup screen `E` / `H` / `I` pick Easy, Hard or Impossible. The mouse operates
menus only.

The menus are not still: asteroids drift behind them and two ships fly around
taking the occasional shot. That field is its own small world in screen
coordinates — it never touches the match's rocks, ships or arena — and it is
drawn only on screens that have no world of their own, so a paused match and a
result screen still sit over the real thing. It is deliberately faint enough for
menu text to read over, and it stops moving under `prefers-reduced-motion`.

Sound effects are synthesized in the browser with Web Audio — all but the guns.
Each kind of gun has its own laser, five small `.wav` files in `sounds/` made by
`sounds/make-lasers.py` (standard library only; run it again to change them, and
it writes the same bytes every time). Cannon, industrial beam, scatter gun and
war fan, seeker rack and swarm, rail lance: you can hear what just fired at you.
Opened straight off disk the page cannot fetch them, so every gun keeps a
synthesized voice underneath and plays that instead.

**If you can see it, you can hear it; if you cannot, you cannot.** A sound with a
place in the world is dropped when that place is off the screen, so a war two
screens away is silent until you fly into it. Sounds with no place — menus,
purchases, the round starting — always play. Online, the host sends every sound
and each guest decides by its own camera.

Sound starts on the first keypress or tap and can be muted
from the title, Settings or pause menu; that preference is saved locally.
Fullscreen is available from those same screens when the browser supports the
Fullscreen API. The whole page enters fullscreen so phone controls remain visible.

Phones support one ship per screen. Players can choose a directional stick or
left, right and acceleration buttons, resize and move every control, and enable
automatic fire — all of it under **CONTROLS · TOUCHSCREEN** in Settings. Whether
they appear at all is TOUCH CONTROLS on that same tab. The arrow layout
always fires automatically. Moving a control is its own screen, reached from
MOVE THEM: the pad floats over it live, at the real size, so you drag the
controls themselves rather than a picture of them, and everything that screen
has to say is kept in the top fifth of it, clear of where thumbs go.

## Online play

Online matches are host-authoritative WebRTC matches, one screen per player.
`net.js` uses one reliable data channel for control messages and one unreliable
channel for current world state.

`ONLINE` on the title screen opens one panel for both sides. It shows the lobbies
open right now — name, mode, host, players, and whether the lobby is open or
locked. Joining an open lobby is a click; joining a locked one is a click and a
password. `host your own lobby` names a lobby, picks the mode, optionally locks
it with a password, and puts it in that same list.

The mode is chosen when the lobby is made, not when it starts, so it travels in
the list and everyone knows what they are joining. Guests ready up and can see
what they are waiting to play; the host's start button appears only once
everyone has, and starting takes the lobby out of the list immediately.

That list is the whole of online play — there are no invite codes to copy or
paste. Session descriptions still cross between browsers, but the room service
carries them, so nobody handles one. Online therefore needs a room service: with
none configured, or none answering, the panel says so instead of offering a list.

The host must keep the Kondrite page open, but it can be in a background tab. An
inline worker keeps the simulation stepping when animation frames are throttled.
Brief connection interruptions get a recovery window; a player who fully leaves
is removed without awarding a kill or environmental death.

`net.js` contacts the configured STUN and TURN servers only while making an
online connection. There is no external request during page load or local play.
The host has a small shooting-latency advantage because guest inputs resolve when
they reach the authoritative simulation.

### When players cannot connect to each other

Most pairs connect directly and never touch a relay. STUN is enough for that: it
tells each end what its own address looks like from outside, and the two then
reach each other. It is not enough for everybody. Carrier-grade NAT on mobile
data, and most office and school networks, refuse inbound connections outright,
and no amount of describing your address helps. Those players can only be
connected by relaying the traffic through a third machine, which is TURN.

The relay is not configured in the page, because its credentials expire. The
room service mints short-lived ones and the lobby collects them from `GET /ice`
when it opens; see "A relay" below. With no relay on offer the game falls back
to its own STUN-only list and plays as it always has — the difference is only
ever visible to the players who could not have connected at all.

A relay is the last resort, not the default: the browser tries every direct
route first and falls back only when they all fail. So the cost is paid for the
minority who need it, and a relayed match still never involves the room service.

Two things in `net.js` exist entirely because of this. Relay addresses are
carried through the compact session-description encoding as their own kind — a
dropped one fails silently, since the browser gathers it, the encoding discards
it, and the pair that needed it simply goes on not connecting. And gathering
waits longer when a relay has been promised but has not yet arrived: a TURN
allocation is an authenticated round trip where a STUN binding is one packet, so
the old three-second cut would have spent the whole cost of a relay and then
left without it. When no relay is configured, that longer wait never applies.

## Room service

The room service is what makes online play work: it holds the list of open lobbies
and hands each guest's offer to the host and the host's answer back. It carries
those descriptions only; gameplay remains peer-to-peer, and it sees no gameplay
at all. All state is held in memory and expires automatically.

It runs in two places from one set of rules. `server/rooms-core.mjs` is the
service itself, written against nothing but `Request`, `Response` and Web
Crypto. `server/worker.mjs` runs it on Cloudflare for everybody;
`server/rooms.js` runs it on a laptop for whoever is working on it. The two
runners hold plumbing only — no limits, no origins, no password rules — so
there is no second copy to fall out of step with the first.

`GET /rooms` returns what the list shows: id, title, mode, host name, player
count and whether a room is locked. The mode is an opaque label here — the game
decides what it means. A room's password never leaves the service — only a
salted hash is kept, comparison is constant-time, and a room stops answering
guesses after eight wrong ones in a minute. A correct password clears that
count, so one person fumbling cannot shut their own friends out. The host takes
its room down with `POST /room/<id>/close` when a match starts, rather than
leaving it in the list until it expires.

Room ids are generated by the host's browser and never typed by anyone. The
room's *name* is display text, and the password is the only secret.

### A relay

`GET /ice` returns the ICE configuration the game should use, and an empty list
is a normal answer meaning "direct connections only". Everything about why a
relay is needed is under "When players cannot connect to each other" above; this
is how to turn one on.

The service holds a Cloudflare TURN key and mints short-lived credentials from
it on demand. The account token stays in the service and never reaches a
browser. Credentials are asked for with a six-hour life and stopped being handed
out after four, so the worst set anybody is given still has two hours on it,
against a match measured in minutes. One set is minted per four hours, not per
lobby.

Two bindings turn it on, both optional:

| Name | What | Secret |
|---|---|---|
| `TURN_KEY_ID` | The TURN key, from the dashboard under Realtime → TURN | no |
| `TURN_TOKEN` | That key's API token | **yes** |

On Cloudflare, put the id in `vars` in `wrangler.jsonc` and the token in with
`npx wrangler@latest secret put TURN_TOKEN`. Locally, both are environment
variables:

```sh
TURN_KEY_ID=… TURN_TOKEN=… node projects/kondrite/server/rooms.js
```

Nothing here is required and nothing fails loudly without it. A missing key, an
unreachable API and a malformed response all return the same empty list, and the
game plays on with direct connections — because a relay that cannot be minted
costs the few players who needed one, not everybody.

Anyone the origin allowlist admits can collect credentials and spend your relay
quota on their own traffic. The short life and the rate limiter bound that; they
do not eliminate it. Relay traffic is billed per gigabyte after a free tier, so
it is worth watching the first time this is switched on.

### Running it locally

No account, no network, nothing installed:

```sh
node projects/kondrite/server/rooms.js
```

Then point the game at it without editing anything — open
`http://localhost:8912/projects/kondrite/?rooms=http://localhost:8787`. Two
browser tabs are enough to test the list, a password, ready-up and a start.

When that process sits behind one trusted reverse proxy, start it with
`TRUST_PROXY=1`. Leave that off when it is exposed directly; otherwise clients
can forge the address used by the request and password throttles. On Cloudflare
none of this applies — the edge sets an address the caller cannot touch.

### Deploying it

The live service is a Cloudflare Worker with one Durable Object. From
`projects/kondrite/server`:

```sh
npx wrangler@latest deploy
```

That prints a `https://kondrite-rooms.<subdomain>.workers.dev` address. Put it
in `ROOM_HOST` in `index.html`, and make sure the site's origin is in `ALLOWED`
in `server/rooms-core.mjs`. Until `ROOM_HOST` is set, the online panel reports
that there is no room service rather than showing a list.

A Worker runs in many isolates in many places and two of them share no memory,
so the room list lives in a single Durable Object named `kondrite` — one list,
one place, everybody looking at the same thing. It never writes to that object's
storage: rooms are worth twenty-five seconds each and the host's next heartbeat
rebuilds them, so persisting them would spend the free plan's daily write
allowance on data that is already stale. Being evicted while idle costs an empty
list, which is what a restart has always cost. The class must still be declared
with `new_sqlite_classes` in `wrangler.jsonc` — that is what makes it free-plan
eligible, and the backend cannot be changed after the namespace is created.

## Files

| File | Responsibility |
|---|---|
| `index.html` | UI, settings, simulation, rendering, bots, campaign, survey and match rules |
| `net.js` | WebRTC links and compact session-description encoding |
| `cloud.js` | The account, and the book kept in it. No SDK, no request until asked |
| `config.js` | The account service's URL and publishable key. Blank means no accounts |
| `supabase/schema.sql` | Three tables: the private save, and the two the boards are made of. Run once in the SQL editor |
| `survey-world.js` | Where you are and what that means: chunk identity, the danger curve, the region lattice and the Warrens' rock. Pure functions of a seed and a pair of coordinates |
| `survey-save.js` | The book: where it is kept, the four pieces a read is made of, and the write |
| `survey-hud.js` | Survey's interface: the flight panel, the chart page, the illustrated almanac, the station |
| `menu.js` | The mode cards' moving pictures — five dioramas, drawn rather than filmed |
| `attract.js` | The front page: a run being flown, on the game's own flight model and gravity |
| `sounds/make-lasers.py` | Writes the five gun sounds beside it, from nothing but the standard library |
| `server/rooms-core.mjs` | The room service: every rule, no plumbing |
| `server/worker.mjs` | Runs it on Cloudflare, in one Durable Object |
| `server/rooms.js` | Runs it on a laptop, with nothing installed |
| `server/wrangler.jsonc` | Deploy configuration |
| `test/page.js` | Not a suite. What the page loads, in the page's order, so a new module reaches every harness without editing one |
| `test/smoke.js` | Dependency-free syntax, transport and service checks |
| `test/campaign.js` | Headless play-through of all three missions to a verdict |
| `test/survey.js` | Headless survey: chunk purity, endless space, almanac reachability, chart persistence, solidity, the economy, the Leviathan's corridor |
| `test/menu.js` | The two lanes, the card row's arithmetic, and that every card starts what it advertises |
| `test/attract.js` | An hour of the front page: what turns up and when, how long it goes quiet, whether a slingshot throws |
| `test/ui.js` | Every control on every page, at four shapes of glass, on a desk and on a phone: on the screen, big enough to press, and not buried under something drawn later |
| `test/biomes.js` | The geography of a sector, measured: how many patches are in reach, how big one is, and what a line out of home crosses. Takes a seed |
| `test/rocks.js` | Which rocks might be touching: the real broad-phase finder lifted out of the game and run against all-pairs on the same fields. Counts, never milliseconds |
| `test/save.js` | The book: parse, migrate, validate and the loader that decides what to do when one says no. An old save lands where a new one does, a future one is refused, a corrupt primary falls back to the backup, and a bug in the reader is not a corrupt save |
| `test/fog.js` | The chart's round trip through storage, on its own and in milliseconds: a refused import may not damage the chart it declined to replace |
| `test/warrens.js` | The cave region: that its rock agrees with itself across a chunk line, that the passages join up, and that nothing — the ship included — is ever left inside solid rock. Takes a seed |
| `test/door.js` | The account layer and the boards, which every other suite stubs off: that a copy with no account service is a whole game, that the guest door is gone from the markup as well as the logic, that signed out neither the game nor the machines open, that a cached session plays with every request failing, that being unreachable does not sign anybody out while a refusal does, and that an email never becomes the public name · and for step 5: that `saves` stayed private while `scores` became public, that no policy lets a score be edited or deleted, that a local game reports nothing, that you can only ever be the reporter, and that a report survives a closed tab |
| `test/browser.js` | The only suite that needs a browser, and it asks only what one can answer: does the page load its own modules, does the canvas draw, does the account panel take typing, does the wheel move a page, does a part drag into a slot, does a run survive a real reload, and does it lay out on a phone. Needs Playwright — see below |

The game intentionally remains self-contained. Do not add a framework, bundler or
runtime dependency for changes that fit the existing static architecture. That
rule is about **the game**: what gets served is still static HTML, CSS and
JavaScript, with no build step and no third-party script on the page.

`test/browser.js` is the one exception and it is not a runtime one. Playwright
is a test-time dependency, installed inside `test/` and ignored by git, and
nothing the browser downloads depends on it. It is skipped with a message
rather than failing when it is not installed, because the fast suites are the
ones that have to run everywhere:

```sh
cd projects/kondrite/test && npm run setup
```

It exists because the ten headless suites share one blind spot. They run the
game inside `vm` with a hand-built window and a canvas context whose every
method is a no-op — which is what makes them fast enough to run on every change,
and it means the thing that is wrong can be the very thing being stubbed. Three
bugs shipped through that gap: a module the page loaded in the wrong order, a
canvas left at its intrinsic 300×150 because `inset: 0` does not stretch a
replaced element, and a keydown handler that took `a`, `w`, space and Tab
straight out of the account panel's email and password fields as they were
typed. All three are invisible to a stub and obvious in a browser.

The other half of the gap is **dispatch**. A headless check reaches for the
interface's own methods — `grabAt`, `recordScrollBy` — and so proves the
interface works while saying nothing about whether any gesture reaches it. Both
of the bugs found the day this suite was written were of that shape: splitting
Survey's pages left the wheel and the drag routed to a page name that no longer
existed, so the record page could not be scrolled and nothing could be dragged
into a slot, and every headless suite passed throughout. What is checked here is
always the gesture, never the method.

## Verification

```sh
node projects/kondrite/test/smoke.js
node projects/kondrite/test/campaign.js
node projects/kondrite/test/survey.js
node projects/kondrite/test/menu.js
node projects/kondrite/test/attract.js
node projects/kondrite/test/ui.js
node projects/kondrite/test/biomes.js
node projects/kondrite/test/rocks.js
node projects/kondrite/test/save.js
node projects/kondrite/test/fog.js
node projects/kondrite/test/warrens.js
node projects/kondrite/test/door.js
node projects/kondrite/test/browser.js   # needs Playwright; skips without it
```

The closing wall and the spawn rules cannot be checked by looking at them. With
`?debug=1`, `window.__cf.step()` advances one frame and `window.__cf.live()`
returns the live `ships`, `rocks`, `hazards`, `bounds` and `clock`. Overriding
`performance.now` with a clock you control turns that into a harness: a whole
match runs in a few thousand calls instead of a minute, and every frame can be
checked for a ship outside the wall, inside a rock, inside a gravity well, or
held against the wall. That is how the wall and spawn bugs were found and how
the fixes were confirmed — ten matches, ~22,000 frames, 96 respawns, no
violations. Do not debug these by watching them.

The campaign is checked the same way. `?debug=1` also exposes
`window.__cf.start(levelKey, pilots)` to begin a mission without the menus,
`window.__cf.campaign()` to read the mission controller, `window.__cf.squad()` to
issue a wing order, and `window.__cf.draw()` to force a frame.
`test/campaign.js` uses them to play all three missions to a win or a loss with
the pilots on autopilot — cycling squad orders, drawing every screen and capital
ship, and watching the phases advance. It asserts every frame that no ship leaves
the arena and no position goes non-finite; that salvage drops and radio chatter
fire; that every mission seeds asteroids and gravity wells; that the convoy has a
destination planet and crosses to it at a genuinely constant speed; and that the
hard mission stays winnable — the allied fleet, unaided, has to carve real
subsystems off the mothership. Because a real pilot only ever helps
— defending the objective, spending salvaged guns, commanding the wing — a
mission the autopilot can nearly finish is one a person certainly can. Convoy is
an escort, so its bar is that a passive run still carries the transport most of
the way home. Do not debug these by watching them either.

Survey is checked the same way, and for the same reason: a mode with no opponent
has no "did you win" to assert on. An endless sector cannot be checked by
enumerating it either, so what is checked instead is that generation is **pure**
— the same chunk built twice is identical, neighbouring chunks are not, and the
chunk you start in never holds a hazard — and that space really is endless: six
minutes of full burn must simply keep going, with rocks still around the ship
and hazards still being made 130,000 units out.

`?debug=1` exposes `window.__cf.survey()` (the controller), `.catalogue()`,
`.chunk(cx, cy)`, `.scan()`, `.find(key)`, `.hud()`, `.leave()`,
`.key(code)` and `.hold(code, on)` — which presses a key the way a player does,
because `readLocalInput` rebuilds every ship's input from the held-key set each
frame and Survey has no bot to fly itself.

Two things about that harness are worth knowing before writing another test with
it. **A ship that turns continuously orbits**: the turn radius at full burn is
about 110 units, so a "fly around and see" loop charts a smudge. **A ship that
turns by the same angle every leg closes a polygon** and comes back to where it
started. Both were written, both passed a `charted > 0` bar, and both were
measuring nothing; only a walk that does not close actually crosses a sector.

### Changing the generator: fingerprint it

`survey-world.js` is where the sector comes from, and its cave code is the
hottest thing in the game — a CPU profile of chunk generation put 84% of it
inside three functions (`caveHash`, `segDist2`, `tunnelNear`). It is worth
making fast, and it is also the one file where "it still passes" is not enough:
a saved survey stores a *seed*, so the worlds it names have to still be there.
Change what a seed generates and every chart, pin, almanac entry and part site
in every save points at terrain that no longer exists.

So the bar for touching it is not the suite. It is a **fingerprint**, taken
before and after, which has to come back byte-identical:

- 4,000 chunks hashed whole — planets, hulks, caches, stations, wells, fields
  — minus one field. A chunk carries the traffic that starts in it, and a
  traffic entry's `speed` comes off its hull's row in the ship table, so
  re-balancing the roster moved 153 of 4,000 chunk hashes while every scrap of
  terrain stood still. That is tuning, not terrain: the ship is gone the moment
  you leave and is rebuilt from the table next time, and nothing in a save
  depends on it. Where a ship *is* still counts; how fast it cruises does not.
  A gate that cries wolf over balance changes is a gate people learn to ignore
- per Warrens region, 360,000 `caveSolid` samples on the cave lattice itself,
  20,000 samples of the continuous `caveFill` / `caveEdge` fields, and every
  streamed disc in the 7x7 chunks around it
- all of that across several seeds

That is what made the current speed-up safe. `tunnelNode` and a cell's segment
list are memoised, `segDist2` writes into one scratch object instead of
allocating per segment, and `Math.sqrt` comes out of the segment loop because
`d < bd` and `d² < bd²` choose the same segment. Chunk generation went from
1.861 ms to 0.922 ms, `test/warrens.js` from 182s to 52s, and every hash above
was unchanged on every seed. All four caches are pure functions of a cell and
the sector seed, so they empty in `clearCaches` — a cache that outlived a reset
would lay the old sector over the new one.

Two traps, both of which caught this work:

- **Take the fingerprint through the debug hooks, not the module.**
  `window.KondriteSurveyWorld` is the *factory*. Reading `caveSolidAt` off it
  gives `undefined`, and a `typeof` guard around that turns the whole check into
  a silent no-op that reports success. Use `cf.caveSolid`, `cf.caveFill`,
  `cf.caveEdge`, `cf.chunk().caveSegs`.
- **Measure with the machine to yourself.** A suite run against three other node
  processes reported 2,469 seconds of wall clock for 348 seconds of CPU. Compare
  `real` against `user`; if they disagree, the number is about the machine.

`test/survey.js` also proves all seventeen telemetry conditions can fire and
that none fire on an empty block, that every almanac entry has its own picture,
that all seven landmarks are placed at distinct bearings, and that the chart and
the flight path round-trip through local storage — including that a new seed
does not inherit the old sector's almanac.

For visual changes, also test the title, Settings, each mode, the pause menu and a
375px-wide phone layout. For online changes, run the room service locally and
point the game at it with `?rooms=http://localhost:8787`; two browser tabs are
enough to test the list, a password, ready-up and a start. Add `?debug=1` locally to expose `window.__cf` for browser
test harnesses; normal production loads do not expose mutable game state.
