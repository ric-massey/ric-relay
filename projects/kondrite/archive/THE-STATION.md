# THE STATION — the parts come home

> *"the wormhole… how we bring parts to it. switch it to the station. the
> station doesnt work untill you get the parts for it. except for selling stuff
> and buying food and water"*

> *"the wormhole connects the station to all the other stations. and you can go
> to the other stations and buy the normal stuff from them you just cant jump.
> and ships can only be switched at your home station anyways....."*
>
> — Ric, 19 September 2026

**Built, 19 September 2026.** Everything below is what shipped, with three
notes at the foot of the file where the build had to decide something the plan
left open.

---

## What changes

Today there are **two** things sitting a few hundred units off the origin, and a
new player meets both in the first minute:

```
HOME_STATION  { x:  620, y:  300 }   index.html:5592   — works perfectly, from the first second
YARD          { x: -280, y: -400 }   index.html:16227  — a jump gate, and it wants six parts
```

The station is finished and the gate is a hole. **They swap places.** There is no
yard. The six parts of `BUILD` (index.html:7677) come to **the station**, and
what they are repairing is the place you live. The wormhole is not a separate
structure any more — it is **what the station becomes** when it is whole.

One landmark instead of two, and a first minute that asks one question instead of
two.

---

## What a dead station does

Three things, and it never does a fourth until you bring it something:

- **It buys what you are carrying.** Salvage still pays from the first rock.
- **It sells water.** `WATER_PRICE` 45 (index.html:6217).
- **It sells food.** `FOOD_PRICE` 95.

Plus the two that were never the station's to give: **your own hold**, which is a
page about your ship and not about the place, and **undocking**.

Everything else is dark.

### Why anyone is still selling you water

A station with no power still has a person in it, and that person has a tank and
no metal. You have metal and no water. That is the whole trade, and it is why
this reads as two people scraping by rather than as a shop with its buttons
greyed out.

It also quietly answers the question the design has never answered: *why is the
first station free?* It is not. It is broken, and you are the one fixing it.

---

## The dark tabs are the motivation

**A missing tab teaches nothing. A dark one teaches everything.**

SURVEY-PLAN.md's standing rule is *show the player something they cannot have
yet, never instruct them* — and the station is the best surface in the game for
it, because it is the one screen a new player is standing in before they have
flown anywhere. Every service is **visible, named, dark, and says what it wants**:

```
   SUPPLIES    ·  open          water, food, and it buys what you are carrying
   DOCK        ·  needs a DRIVE SPAR       — among the dead
   COUNTER     ·  needs a FUSION CORE      — in the light of two suns
   MARKET      ·  needs a RANGING LENS     — a world nobody warms
   SHIPS       ·  needs a JUMP COIL        — wound around a mouth
   STOCK       ·  needs a SIGNAL BEACON    — still calling
   MOUTH       ·  sealed
```

That is the manifest, and it is now **a page you are standing on** rather than a
line of HUD text pointing off-screen. The clue is already written for every one
of them (`BUILD[].clue`); it just moves to where the thing it unlocks is.

**This reverses a decision, and the reversal is the point.** `pageNav`
(survey-hud.js:716) currently hides the WORMHOLE tab entirely until the gate is
built, on the argument that *"a door to a thing you have not made is not
navigation"*. That was right for one tab on a working station. It is wrong for
six, because with six the darkness **is** the objective — take them away and the
station is a shop with two items and no reason to leave.

---

## One part, one service

Six fetches and one payoff is a long way to walk on trust. Six fetches and
**six** payoffs is a station coming alive around you.

The order is fixed by the distances already in `BUILD`, so the only question is
which capability hangs off which rung. A correction from the first draft of this
file: **the bench is not a station service.** `pageNav` (survey-hud.js:735) has
crafting `live: true` everywhere, because the bench is aboard the ship you flew
in — *"your hold, your bench, your jobs and your chart are aboard the thing you
flew there in."* So the six map onto what a station actually has:

| # | Part | Out | Lights | Why it is the obvious one |
|--:|---|--:|---|---|
| 1 | **DRIVE SPAR** | 7,000 | **THE DOCK** — repairs | a spar is structure, and structure is what a dry dock puts back |
| 2 | **FUSION CORE** | 13,000 | **THE COUNTER** — the shop sells parts and modules, not just water and food | nothing is powered without it |
| 3 | **RANGING LENS** | 21,000 | **THE MARKET** — what every station you have charted is paying | a lens is how a station sees past its own dock |
| 4 | **JUMP COIL** | 34,000 | **THE HANGAR** — the berth | the clamps that hold a second hull are a coil |
| 5 | **SIGNAL BEACON** | 52,000 | **STOCK** — the counter can call in what it does not have | a beacon is how a dead place reaches a supplier |
| 6 | **ABLATIVE PLATE** | *inside the Leviathan* | **THE MOUTH** — every charted station, one dock away | **you cannot open a hole in space beside an unshielded station** |

**2 and 5 are both the shop, and that is deliberate rather than a gap.** The core
opens a counter that can sell you something; the beacon stops that counter
selling only whatever washed up. A shop that exists and a shop worth flying to
are two different unlocks, and pretending otherwise would mean inventing a sixth
service the game does not have.

The last row is the one to keep. The plate is already the hardest part in the
game — inside the Leviathan, behind sentries, and SURVEY-PLAN calls it *the best
moment the manifest has* — and *"the station has to survive what you are about to
do to space next to it"* is a better reason to want a slab of armour than any the
game currently gives.

**No part moves and no clue is rewritten.** The distances, the places and the six
clue lines are exactly as they are today. Only what each delivery *does* changes,
which is why this is a smaller change than it reads.

### And the ladder pays in the right order

1. **repairs** — because your hull is the first thing that breaks
2. **the counter** — because sell-then-buy is the loop, and this is where it opens
3. **the market** — because by now you have enough to care what things are worth
4. **ships** — because by now you can afford one, and this is the only berth there is
5. **stock** — because a counter worth visiting is what stops you flying elsewhere
6. **the mouth** — because you have flown far enough to want to stop flying back

Today all six of those are switched on before you have moved.

## Other stations work. Here is why you fix yours anyway

This was an open question in the first draft and Ric closed it: **other stations
are not husks.** You can fly to one and buy the normal things from it. What you
cannot do there is jump, and what you cannot do there is change ship.

That kills the version of this where the sector near the origin is wrecked and
the early game is brutal. It is **inconvenient** instead, which is a gentler
change and a much safer one for the two-minute test: nothing is taken away that
cannot be reached, it is just a trip away rather than a tab away.

Three reasons to fix your own, and they arrive in this order:

1. **It is the nearest.** Every other station is a haul, and early — small hold,
   slow hull, a tank running down — a haul is expensive. Each part you deliver
   deletes a round trip you were making anyway.
2. **It is the only hangar.** `pageNav` already has SHIPS as `live: !!st.atHome`
   (survey-hud.js:719), so a ship can only ever be switched at home. That is not
   a rule this change invents; it is a rule this change finally gives a reason
   for.
3. **It becomes the hub.** The mouth does not make one station work — it puts
   **every station you have charted one dock away**. The six-part walk is not
   buying back a shop. It is turning the place you live into the centre of the
   sector.

So the progression is **nearest → unique → hub**, and only the third one is a
power rather than a convenience. That is the right shape: the convenience is what
carries you through the first five deliveries, and the power is what the sixth is
for.

### One detail the mouth inherits

`lightJump` (index.html:16243) goes to a point on the **chart**, and the WORMHOLE
page offers *"every station you have charted"*. The reason is written down and it
is a good one: *"fast travel across ground you have covered, never a way to skip
covering it."* Keeping that is the recommendation — a hub that reaches places you
have never been would make the ladder of landmarks pointless. If Ric means
literally *all* stations including unvisited ones, that is a different and much
larger decision and it should be taken on its own.

## What this does to the first two minutes

`OPENING` (index.html:16265) is built so that *every mechanic is introduced by
needing it*, and a new survey already starts **docked at the home station with
the tanks low**. That is untouched and it is why this works at all — she is
standing inside the thing this change is about before she has pressed anything.

The beats move:

| today | after |
|---|---|
| WATER LOW · the station sells it | **unchanged** |
| THE JUMP GATE WANTS A DRIVE SPAR | **THIS STATION IS DEAD** · *it buys, and it sells water. Nothing else works.* |
| THAT IS WORTH MONEY | **unchanged** |
| STORAGE FILLING UP | **unchanged** |
| the refit tracks are right there on the same page | **the dark rows are right there on the same page** — each one named, each one priced in a part |

The three things the two-minute test demands survive, and the third gets
*stronger*: **here is how I get better at this** used to be a price list. It is
now a list of things that are switched off with a place attached to each.

The risk is real and it is the opposite one: a station that does almost nothing
is a worse first impression than a station that does everything. Three defences,
and the third is the one that actually settles it:

- it does the two things a first-time player needs in minute one — buy water,
  sell rock
- everything it refuses is labelled with the part it wants and where that part is
- **nothing is actually unavailable.** Other stations work. A player who wants a
  refit in the first ten minutes can go and get one; they will just notice how
  far it is, which is the entire argument for fixing the one at home.

---

## What it touches

| Where | What |
|---|---|
| `index.html:16218` | `YARD`, `YARD_R`, `yardDone()`, `nextPart()` — the yard stops being a place and becomes the station's own state |
| `index.html:8664` | the home station gains `broken: true` and the set of parts delivered |
| `index.html:7677` | `BUILD` gains one field per row: which service it lights. No clue, name or distance moves |
| `index.html:16265` | `OPENING`'s second beat |
| `index.html:18017,18040,18263,18719` | every string that says THE JUMP GATE |
| `survey-hud.js:716` | `pageNav` — tabs draw dark with a requirement rather than not drawing |
| `survey-hud.js:4639` | `STATION_PAGES` — the same, one floor down |
| `survey-save.js` | **nothing**, if this is done right — see below |
| `README.md` | the Survey section's "the yard, just off the origin, and it is short of six parts" |

### Saves must survive this

The book already records which of the six are delivered. **If the part list does
not change, neither does the save format**, and a run that is three parts in
comes back three parts in with three services lit. That is free, and it is free
only as long as nobody is tempted to renumber the parts while they are in here.

A save from before this change has `yardDone` in it and no station state; the
station reads the manifest it already has. One derived value, no migration.

---

## How it is checked

- **A fresh survey can still buy water and sell a rock**, and can do nothing
  else. Asserted on the station's own page, not by eye.
- **Every dark row names a part and a place**, for all six, at every screen width
  the layout can take — a row that says a part's name and drops its clue is the
  failure that looks fine in a screenshot.
- **Delivering part *n* lights service *n* and nothing else.** Six assertions,
  and the sixth also opens the mouth and `lightJump`.
- **An old save keeps its parts.** Load a book written before the change with
  three delivered, and three services are live.
- **`test/fingerprint.js` must not move.** The station's position and the parts'
  distances are unchanged, so generation is unchanged — a moved hash means
  something was renumbered that should not have been.

---

## What the build decided

Three things the plan left open, settled in code.

**The mouth is the plate's room, not a count of six.** Every other service is
lit by the one part named against it, so the mouth is too: `wormhole` is
`stationHas("mouth")`, which is `built.has("plate")`. That matters because the
manifest is walked *nearest first* rather than in list order — the arrow has
pointed at the nearest part you have not got since the arrow stopped jumping —
so "the sixth delivery" is not a thing the code can name. The plate is still
last in practice for the reason it always was: it is inside the Leviathan. What
is gone is the possibility of finishing the manifest and finding the mouth shut
because the count disagreed with the list.

`stationWhole()` — all six — is still what the almanac entry, the objective
line and the light drive's second berth ask about. Two questions, because they
were always two questions.

**THE MARKET is a price board on the SELL tab.** The plan said *what every
station you have charted is paying* and did not say where it lives. It is a
panel above the sell list, at home, once the lens is in: one row per material
actually aboard, what the counter in front of you pays, the best standing price
on the chart, and a bearing and a band to it. `stationPrices` grew a `quiet`
flag for it — a station you are not standing in is priced without its shortage,
because asking `shortageOf` by name would write a market entry into the save for
every dot on the chart, and because a station that happens to be short today
pays *more* than the board says, which is the right direction for a board to be
wrong in.

**The ring moved onto the station.** The yard drew itself as a hull under
construction — bare ribs, one segment of plating a part. That drawing is not
deleted; it is drawn around the home station now, outside its own ring, with
`SHORT OF n PARTS` under it, and it goes when the sixth part goes in. A ring
that stays full for the rest of the run is a monument.

### And what it cost

| Where | What happened |
|---|---|
| `index.html` | `YARD`, `YARD_R`, `atYard`, `drawYard`, the `yard` page state and its `E` door are gone. `BUILD` rows gained `opens`; `SERVICES`, `stationHas`, `stationWhole` and `hangarOpen` are new |
| `index.html` | the dock, the counter, the shelf's richness and the berth each ask their part; `payBoard` is new; `rollShelf` thins home's shelf *after* its rolls, so no other station's shelf moves |
| `survey-hud.js` | the dark rooms draw on the shop's BUY tab, the market board on SELL; the WORMHOLE tab draws dim instead of vanishing; `drawYardPage` is `drawMissions` |
| `survey-save.js` | **nothing**, exactly as planned — the six keys did not move, so a part-built save comes back part-built |
| `test/survey.js` | §14 is the station's now: a dead station sells only supplies and mends nothing, every dark room names a part *and* a place, one delivery lights one room, and the mouth waits for the plate |
