# SURVEY — what is left

Survey started as a quiet mode with no enemies and no losing. It is becoming a
**survival exploration game**: you start at a station, you go out, it gets more
dangerous the further you go, and things out there can kill you.

**This file is only the part that is not built yet.** It used to be the plan and
the record together, which ran to 3,500 lines and meant nobody read either. The
record is now [`SURVEY-DONE.md`](SURVEY-DONE.md) — eight finished phases, three
more that are finished but for one item each, and how every one of them actually
landed. Nothing has been deleted; it moved.

Read this file top to bottom. It is short on purpose.

---

## When you finish something, move it

**This is the rule that keeps these two files useful.** The plan is only worth
reading because it is short, and it only stays short if finished work leaves it.

So, when you finish an item:

1. **Build it.** One item at a time — see "Rules for building this".
2. **Test it.** `node projects/crossfire/test/survey.js` end to end, plus
   whichever narrower suite covers what you touched (`fingerprint.js` before and
   after anything in `survey-world.js`, `warrens.js` for the cave, `save.js` for
   the book, `vault.js` for the Vault). A thing with no test is not finished if
   it is a number, a placement, a curve or a state machine.
3. **Only when it is good:** move the item's whole section out of
   `SURVEY-PLAN.md` and into `SURVEY-DONE.md`, at the end of the phase it
   belongs to. Take the reasoning with it — the argument for *why* it is built
   that way is the most valuable thing in it, and the code comments assume you
   have read it.
4. **Write what actually landed** under it, with measurements. Every phase in the
   record has a "what landed" note for a reason: the difference between what was
   planned and what shipped is where the next bug comes from.
5. **Update "Where it stands"** in the plan, and take the item out of "What is
   left". If that empties a phase, the phase is done — say so on its heading.

**Do not delete anything.** The record is append-only; a thing that turned out
to be wrong gets a supersede note, not a deletion. Three passages in the record
carry one already, and they are more useful than a clean file would have been.

**Do not move something because it looks done.** It moves when it is tested and
good, not when it is written. Half-built systems in this mode hide each other's
bugs, which is the whole reason for one item at a time.

---

## The Survey documents

Eight files now, and which one to open is not obvious from any of them. This is
the map.

| File | What it is for | Authority |
|---|---|---|
| **`SURVEY-PLAN.md`** | **What is not built yet**, and the direction it is being built in | **Intent.** What the work is for |
| **`SURVEY-DONE.md`** | **The record**: every finished phase and how it landed | **Status.** What got built, and what it measured |
| `README.md` → "Survey" | What the mode *is*, for somebody who has to read the code | **Behaviour.** Written from the code, so it wins on what the game does today |
| `TODO.md` | Ric's own list, in his words, with ticks | What Ric asked for. A3 lives here |
| `BIOMES.md` | The directive for the biome work, Ric's note kept as written | Biomes. Partly retired 17 September — read its banner |
| `WORLD-IDEAS.md` | A design proposal: politics, biomes, people who explain them | A proposal. The biome third of it is built |
| `LIVING-WORLD.md` | The brief for a world that makes its own history | Unbuilt, except the substrate its own foot records |
| `PLAYER-HISTORY.md` | The brief for the player inside that history | Unbuilt, except §4 and half of §1 |

The four briefs are **not** plan items. They are where the ideas are argued out
before any of them earns a place in the plan; when one does, it gets a section
there, and the brief becomes the reasoning behind it.

**When two of them disagree:** the code settles what the game *does*, and
`README.md` is the written form of that. `SURVEY-PLAN.md` settles what the work
is *for*; `SURVEY-DONE.md` settles what happened. A brief settles nothing — it is
an argument, and the banner at its head says how much of it survived contact.

---

## Where it stands

Eight of the twelve below are finished outright and four have something left;
all of it is recorded in [`SURVEY-DONE.md`](SURVEY-DONE.md), which has the same
table with a line on each:

| | |
|---|---|
| **Phase 1** the sector, legible and lethal | **DONE** |
| **The places** (A–E) | **DONE** |
| **Phase 2** survival | **DONE** |
| **The quiet screen, and the drive** | **DONE** |
| **Phase 3** the economy and the ships | **DONE** |
| **Phase 4** company, and the first two minutes | **DONE** |
| **The pages, on one grid** | **DONE** |
| **Phase 5** consequence | **DONE** except 5.5 and half of 5.8, both below |
| **Phase 7** the interface | **DONE** except one brief, below |
| **Phase 6** possibility multiplication | **6 of 7** — 6.6 is below |
| **Coming back, and an account** | **DONE** |
| **Who holds the sky** territory | **A and C built** — B is below |

What is left is the nine items in the next section. Two of them — 5.5 and the
storage half of 5.8 — are the same job at two sizes: nowhere to put what you are
not carrying, on the ship and at the station.

---

## What is left

Nine things. Each one carries everything needed to build it; where a phase's
reasoning matters, it is named and lives in the record.

### 1 · 6.6 — authored mysteries  ·  **the biggest one**

Nine authored places — eight dealt a rung of the ladder, plus the Leviathan off
it — where the brief asks for dozens. Highest ceiling, least code, and the only
thing standing between the almanac and the twenty hours 6.7 bought room for.
6.7's own note in the record is the concrete plan for it.

#### The brief, as written

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

*Where it stands.* There are **nine** authored places — the graveyard, the rogue
world, the last transmission, the pale dot, the Wall, the supernebula, the Vault
and Node 01 on the ladder, and the Leviathan off it — and they are the best
things in the mode. This paragraph said eight until 17 September 2026, because it
was written before the Vault; nine is not dozens either.

This is the track with the highest ceiling and the least code: an authored thing
is a name, a shape, an almanac entry and a reason. No system needs building. The
one rule it must keep is the one it already keeps — an authored thing sits *in*
the procedural sector rather than replacing a piece of it, so finding one is an
accident of where you flew.

### 2 · B — danger that depends on your standing

The third of "Who holds the sky", and the one piece of it that did not land. A
and C — the territory map, and a war that moves the borders — are in the record.

> *"take the danger rings off. it will instead be based by boime and who owns
> that space."*

**What B is.** Your standing with the power that holds a piece of sky should
decide how dangerous that sky is *for you*. TRUSTED space is a road; WANTED space
is a problem. Today danger is the same number for everybody.

**What exists already.** `standingOf` has the five rungs, and standing already
decides who hunts you and what a rescue pays. `dangerAt` in `survey-world.js` is
`natureAt` and `peopleAt` averaged and floored — **no standing term in it** — and
about forty places read it, plus `depthAt` and `shelfDepth` on top. So the change
is one function and a decision about what it may not affect: loot richness and
shelf depth should almost certainly stay impersonal, or being liked makes the
game poorer.

**Why it was left.** A and C ship to players together and nobody plays a fixed
map first; B is the one that can follow without anybody noticing it was missing.

### 3 · 5.5 — cargo crates, and towing

The idea Ric liked best, and the reason is that it is physical rather than
administrative: **your hold fills up, so you either leave things, sell things, or
tow a crate home.**

A crate is an object in the world. You attach to it, it slows you down, and you
drag it back. No new menu, no second inventory — the decision is made by flying,
which is the only place this game should be making decisions.

It is also the honest answer to "more cargo capacity" as a progression track: a
bigger hull carries more, and a tow carries more than any hull, at the cost of
handling and time.

### 4 · A3 — the Vault

The one open item on [`TODO.md`](TODO.md), and it is measured rather than guessed
at now: the collisions are sound on five seeds with the Leviathan as the control,
and what is wrong is the *drawing* — one filled square and ninety stroked lines
where the Leviathan has an outline, plating, bays and bulkheads. There is also a
dead hit-marker path to wire up or delete, and a draw-order bug that paints
traffic under both structures. The measurements and what they mean are in the A3
note in `TODO.md`; the probe is `test/vault.js`.

### 5 · 5.8 — the loose ends

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
  *who runs it*. The missing piece was small and it was first: a station used to
  have **no flag at all** — an x, a y and a phase — so before any of this there
  had to be a faction on the station and a colour on the dock.

  **That piece landed with "Who holds the sky" on 17 September** (see its build
  order, where it is named as 5.8's missing first piece): a station carries
  `faction: space.owner || "free"`, flies it on the dock, and nobody docks at an
  enemy's. So this item is unblocked and what is left of it is the ladder below,
  not the flag. `standingPay` is still read by exactly one thing — checked
  2026-09-17.

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

### 6 · The Leviathan as a ship you can buy

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

### 7 · The panel minimap draws no borders

Only the full chart does. Small, and the one piece of "Who holds the sky" that
did not land with the rest of A and C.

### 8 and 9 · The long-term tracks, and stranger things

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

**Stranger things farther out** (track 5) is the one that is not a task: the
danger curve has promised it since Phase 1 and the abyss is still only *harder*,
not *stranger*. 6.6 above is how it gets paid.

---

## The one test that matters

> **Ric's sister sits down, and inside two minutes she knows what she is doing
> and why.**

Not "can read the manual". Sits down cold, and the game tells her. Every item
in "What is left" is judged against that before it is judged against anything
else, and so was every item in the record. If a
feature cannot be understood from the screen in the first two minutes, it is
either explained better or it is cut.

Three things she has to learn in that window, in this order:

1. **I can die, and here is what is trying to kill me.** (hull, thirst, hunger)
2. **Here is where I am going and why.** (the yard, or a station, and a bearing)
3. **Here is how I get better at this.** (salvage → sell → a better ship)

Everything else — the almanac, pins, gates, the Leviathan — is allowed to be
discovered later. Those three are not.

---

## The loop, stated

> **Explore → find stuff → bring it home → improve your ship → go farther.**

Ric's sentence, and it carries the whole game. Every item is judged against it:
a feature that does not sit on one of those five verbs is a feature that is
making the game bigger rather than better. The five long-term tracks — item 8
and 9 above — are the same sentence read as *progression* rather than as a
loop.

---

## What Survey is for  ·  *the direction, set 17 September 2026*

**Read this before deciding what to build.** It overrides anything in the record
that disagrees with it, and it is what "What is left" above was sorted by. This
is where the mode is going, and it was set by Ric after a long conversation about
what Survey actually wants to be.

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

---

## The Phase 6 filter

It is a **filter**, not a queue. Nothing in it is next; everything in it is a
question to ask of whatever *is* next:

> *What three other systems does this touch?*

A part that only changes a number, a station that only sells, an NPC that only
flies its line — each of those is a feature added. The rule says to keep looking
until it is a system multiplied.

---

## Rules for building this

1. **One item at a time.** Finished, tested, committed, before the next starts.
2. **Tests for anything that can rot silently.** Numbers, placement, curves and
   state machines get a test. This mode has already shipped four bugs that
   rendered perfectly — an invisible salvage painter, a cache inside a wall, a
   wall closing to eight per cent, shake that never decayed.
3. **Every system has to be readable from the screen**, before it is clever.
4. **Nothing gets built that the two-minute test cannot survive.**
