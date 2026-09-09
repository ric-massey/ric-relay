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

## Phase 2 — survival

This is the phase that changes what Survey *is*. It reverses the mode's original
promise that nothing ends your run, deliberately.

### 2.1 Hull, and dying

- Hull works as now, but at zero it does not reset. **At zero hull the next hit
  kills you.** The HUD has to make "one more hit" unmistakable.

### 2.2 Water and food

- Two meters, draining slowly on different clocks. Water faster than food.
- Running either to empty starts a countdown, not an instant death — a warning
  you can still act on.
- Empty for too long kills you.

### 2.3 Death

- A **YOU DIED** screen. What killed you, how far out you were, how long you
  lasted, what you were carrying.
- Respawn at the home station. You keep the yard's progress and the almanac.
  You lose the hold, and you lose whatever you were carrying that was not a
  yard part.

### 2.4 Planets you can dock at

- Some planets are **inhabited** — you can dock, and buy water and food.
- Uninhabited ones with atmosphere can be **skimmed** for water, slowly and for
  free. That is the poor pilot's option and it costs time instead of metal.
- Inhabited planets are commoner near home and rare in deep space, which is what
  makes range a supply problem rather than only a danger problem.

---

## Phase 3 — the economy and the ships

### 3.1 Metals

Salvage becomes typed. Four or five metals, each worth different money, each
found in different places — so "what is this rock worth" becomes a question.

### 3.2 Selling

Stations buy metal. Prices vary by station and by band, so a long haul out can
be worth it. Your home station is never the best price, which is the whole
reason to find another one.

### 3.3 Twenty-five ships

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

### 3.4 Ship size and the camera

A bigger ship zooms the camera out. This keeps a capital feeling enormous
without breaking the framing, and it is a real trade: the big ship carries more
and survives more, and it sees less detail and handles like a barge.

> **Open question.** Ric flagged this himself: whether size-driven zoom actually
> works at this scale. It will be built behind the Settings zoom control (1.3)
> so both can be felt together, and if it fights the game it gets cut rather
> than tuned forever.

---

## Phase 4 — company, and the first two minutes

### 4.1 Friendly ships

Traffic that is not trying to kill you: haulers on a route, patrols near
stations, wrecks-in-progress you can help or rob. The sector should feel
inhabited near home and empty far out — that contrast is most of what makes
distance feel like distance.

### 4.2 The two-minute pass

The last item, done once everything else exists, because you cannot teach a game
that is still changing shape. A deliberate opening: you start docked, the first
thing you need is water, the station sells it, and the station points at the
yard. Every mechanic introduced by needing it, none of it by text.

---

## Rules for building this

1. **One item at a time.** Finished, tested, committed, before the next starts.
2. **Tests for anything that can rot silently.** Numbers, placement, curves and
   state machines get a test. This mode has already shipped four bugs that
   rendered perfectly — an invisible salvage painter, a cache inside a wall, a
   wall closing to eight per cent, shake that never decayed.
3. **Every system has to be readable from the screen**, before it is clever.
4. **Nothing gets built that the two-minute test cannot survive.**
