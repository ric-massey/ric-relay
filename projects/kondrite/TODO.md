# KONDRITE — the list

Everything Ric has asked for and not yet got. One line an item, checked off only
when it is built, tested and pushed. Nothing leaves this file by being finished —
it gets a tick and a commit hash, so the list is also the record.

**Status key** — `[ ]` not started · `[~]` in progress · `[x]` done · `[?]` needs
an answer before it can be built.

Batch of 2026-09-13, which has been added to since: **30 items, 30 done.**
Counted from the boxes rather than kept by hand — the line that used to live
here said 27 items and 26 done and named A3 as the only one left, which had
stopped being true twice over: C4 and C5 were added to SETTINGS after it was
written, and C6 was added open.

**Current: eight playtest items, all eight done, and two design questions
still open**, recorded below on 2026-11-12 and cleared the same day. N10 came
later that evening and is not from the watched session. **N8 and N9 are what
is left**, and both are Ric's to decide rather than mine to build. The September batch above is complete; these are new reports.
Other open briefs are elsewhere: `PLAYER-HISTORY.md`, and "the Leviathan is a ship you can buy" in
`SURVEY-PLAN.md`. `LIVING-WORLD.md` has its first version and its first
expansion built (2026-09-24, see its status line): §27, §16 and §28 — leaders,
laws, bounties, and the people, whose provinces can add up to a cause and, rarely,
a flag of their own — with the visuals doing the talking on Ric's instruction.
Important NPCs and §29 onward are still brief.

---

## Watching a new player — 2026-11-12

Ric watched someone play after some time away from working on the game. The
player seemed to enjoy it and stopped because they had something else to do;
Ric was unsure whether there was enough to bring them back. These are Ric's
observations and requests, not reproduced diagnoses or completed fixes. This
session is for recording and discussing them only; no gameplay changes yet.

### Bugs, clarity and balance

- [x] **N1 · The opening tutorial needs a persistent objective banner.** For
  the first few parts, put a banner at the top saying to go get a part. Ric:
  "for the first few parts it needs to be a banner on the top saying to go get
  a part." The current tutorial does not give a new player enough guidance.

  *Built 2026-11-12, and the interesting half is that it retires.* There was a
  band across the top of this HUD once and it was taken off for a good reason:
  it answered a question nobody asks twice, every frame, forever, and it was
  the busiest thing on the screen. What replaced it was a notification — right
  for WATER LOW, and no use at all to somebody who looks up thirty seconds
  later having forgotten what they were flying towards, which is the player
  Ric watched. So the band is back as a banner with an end on it: two rows in
  the gap between the cash column and the chart — the objective line, and
  **PART n OF 6** with the kind of place to look in — and it is gone for good
  once three parts are home, which is one fetch, one sale and one return. On
  the way out it says where the manifest went, the way the low-tank warning
  teaches its triangle and then leaves you the triangle. It states
  `st.objective` and nothing of its own, so there is still exactly one thing in
  the mode that knows what you are doing (B4, B8 and A5 were all two lists kept
  in step by hand). `bannerWanted` in `game/factions.js` owns the rule,
  `drawObjectiveBanner` in `survey-hud/panel.js` draws it, `test/survey.js`
  §15b holds both halves — it is there cold, it survives a part coming home,
  it leaves at three, and a save resumed past it is not told it has gone.
- [x] **N2 · Crafting can make finding parts feel pointless.** Certain parts
  are much easier to craft than to find; Ric's example is the **MK2 tractor
  beam**. Review the relative effort and rewards.

  *Reviewed and re-cut 2026-11-12.* The review is a number rather than an
  impression: every material carries a `value`, so a recipe can be priced
  against the shelf price of the thing it makes. Two findings.

  **One.** Exactly two parts in the game are findable *and* craftable — the
  MK1 and MK2 tractor beams. Everything else is buy+craft (16), buy-only (9),
  find-only (2) or off a boss (5). So "crafting makes finding pointless" lands
  on precisely the part Ric named, and on its little brother.

  **Two.** The whole craft table was an arbitrage, not one bad row:

  | part | shelf | to build | |
  |---|---|---|---|
  | GRAPPLE LINE | 1600 | 54 | 29.6x |
  | EMP CHARGE | 9100 | 330 | 27.6x |
  | COOLANT LOOP | 2300 | 87 | 26.4x |
  | TRACTOR BEAM MK1 | 550 | 30 | 18.3x |
  | **TRACTOR BEAM MK2** | **1000** | **111** | **9.0x** |
  | DRIVE SPAR | 650 | 138 | 4.7x |
  | STAR SIPHON | 5200 | 1552 | 3.4x |

  Nothing craftable was ever worth buying either.

  Ric's calls. **Every build costs twice what it did**: "make it a bit more to
  craft like 2x more to craft. because it should be kinda hard to find
  somewhere that sels the exact thing you want" — twice, not parity, because a
  shop with the exact part you want is itself something you have to go and
  find. The doubling is by value rather than by more rock: electronics,
  iridium and cores grew most, since the three you cannot mine are what an
  ingredient list is for. Cores are the one exception and went up by one each
  — a few in a hundred from a cache is rare enough that doubling them makes a
  build a waiting game rather than a journey.

  **And the tractor ladder got one way in per rung.** The first cut had MK2
  find-only and MK3 bought, on the old rule that the best of a category is the
  bought one. Ric flipped it the same evening: *"mk3 should be found and hard
  to find and mk2 should be built or found and mk1 is given at the end of the
  parts thing and mk1 can also be bought."* So:

  | rung | how you get one |
  |---|---|
  | MK1 | given after the gate, and on any shelf |
  | MK2 | built or found |
  | MK3 | found, and hard to find — no shelf, no build, and `rare`, so only deep caches really carry one |

  It is the better shape: the top of the ladder is the one thing in its
  category money cannot answer. **The MK1 is also a bit less powerful** —
  asked whether to leave it craftable at all (P1 says it is, deliberately,
  because the post-gate arrow sends you for one): "leave mk1 but make it a bit
  less powerful." Its reach goes from half the MK2's to about a third, 170 →
  119 units, through one constant `MK1_REACH` read by both the effect and the
  line that describes it. `CRAFTS` and `MODULES`; `test/survey.js` holds the
  one-way-per-rung and a ceiling of 18x on any build.
- [x] **N3 · Ships feel too cheap.** Ric cited the **Needle at 900 coins** as
  costing almost nothing during the playtest. Review ship prices against how
  quickly money is earned.

  *Re-priced 2026-11-12, and the income side with it.* Ric, after the craft
  re-cut: "was the rest of the economy fixed? including the ships? they are
  all way too cheap." The yardstick is the hold: a full skiff load of 150
  units was worth about 480 as rock, 1,400 as wreck salvage and 2,060 out of a
  cache — so the first four hulls each cost about **one good trip**, and the
  second ship stopped being a goal before anybody had flown far enough to want
  one.

  **The ladder goes up on a curve, not a multiplier**, because the two ends
  had different problems: the cheap end was free and the dear end was already
  eighty holds. `28.9 * cost^0.742`, rounded to figures a shop would print —
  about 5x at the bottom and 1.3x at the top, with the order untouched.

  | | was | now |
  |---|---|---|
  | NEEDLE | 900 | 4,500 |
  | KITE | 1,600 | 6,900 |
  | LANCE | 3,400 | 12,000 |
  | DRAYMAN | 15,000 | 36,500 |
  | GRANARY | 63,000 | 105,000 |
  | TENDER | 168,000 | 218,000 |

  **And what salvage fetches came down about a fifth** — Ric asked for that
  too, so that parts, refits, water and food got dearer and not only hulls.
  iron 3 → 2, alloy 9 → 7, electronics 16 → 13, iridium 22 → 18, core 48 → 38.
  Evenly, so the gap between mining a rock (3.20 → 2.48 a unit) and cracking a
  cache (13.75 → 11.00) is exactly where it was — flying somewhere dangerous
  pays the same multiple it always did. Taken together the early game is about
  six times harder than it was, which is more than either change alone: worth
  flying before deciding it is right.

  One knock-on, caught by the craft ceiling: with materials worth less, the
  grapple line's build came out at 20.5x under its shelf price, the worst in
  the game. Its recipe was not the problem — it was priced at 1,600 for "the
  cheapest verb in the game", above the MK2 beam and the layered plate — so
  the shelf price came down to 1,100. `SHIPS` in `game/ships.js`, `MATERIALS`
  in `game/survey-outfit.js`.

  *Found while pricing, and fixed with it:* the opening's money beat fired at
  **200 coins** and said YOU CAN AFFORD A PART. That figure is left over from
  the refit tracks — three tiers bought with cash, the first of them cheap —
  which were removed when parts became the whole upgrade system. The cheapest
  thing a station sells is the DRIVE SPAR at 650, so the one beat in the
  opening whose job is to say *you can buy something* was telling a new pilot
  so three hundred coins early, and it would have gone further out of step
  with every price moved above. It asks the shelf now — this station, at this
  station's depth, in stock, and nothing at all while the home counter is dark
  for want of a fusion core. `cheapestOnTheShelf` in `game/factions.js`.
- [x] **N4 · The Leviathan's hitbox feels wrong.** Ric observed collision
  behaviour that did not match the visible structure. Reproduce and locate
  the mismatch before deciding on a fix.

  *Reproduced by measurement, 2026-11-12, and it was the drawing rather than
  the hitbox.* A 73,000-point grid over the whole footprint, comparing every
  collision disc against every drawn plate: **not one point was solid without
  a plate on it**, and the worst a plate was hollow by was 20 units — the
  scallop between overlapping discs, a fifth of a hull's own radius. The hull
  is honest.

  The **sponsons** were not, and for the reason this mode keeps rediscovering:
  they were the one part of the ship drawn from numbers of the renderer's own
  instead of from the geometry the builder stamped. One axis-aligned box per
  bay, three faults in it:

  | | |
  |---|---|
  | the leading edges are **raked** and the box was not | a wedge of dark hull stood forward of every leading edge — 146 units on the hangars, 175 on the forward pair |
  | the box stopped at 0.83 of the bay's depth, the outer face is at 1.0 | every wing tip drawn as a hollow ring |
  | the **torn** sponson was drawn whole | a complete wing on a wrecked hull with a stump's worth of wall in it |

  All three are the same thing from the cockpit: solid-looking hull you fly
  straight through. A bay carries its drawn shape as data now (`b.poly`),
  written beside the walls that are stamped from the same corners, and
  `drawLeviathan` fills that and nothing else — the way the hull itself has
  read `lev.outline` since it stopped being a rectangle. `test/survey.js`
  §10c walks every edge of every drawn sponson and fails if any of it is
  outside every plate on the ship.

  *Double-checked on Ric's instruction, and two things he asked about.*

  **"There shouldn't be walls on the black part."** There are not. The fill is
  painted first and the plates are stroked over it, so the black you are left
  looking at is the room — and every room is a room: the biggest circle that
  fits inside the two hangars is **339 and 352 units**, and **99** in each
  forward sponson, against the largest collision circle in the game, the
  TENDER's at 68. So every bay admits every hull. The exception is the torn
  one, which is solid all the way through — correct, because a wing that has
  been torn off is structure rather than a chamber. The test holds both: a
  whole sponson has to admit 70 units, a torn one has to admit none.

  **"I think the broken one is seeded?"** It is not. `wrecked = !LEV_INTACT`
  is a **URL flag** (`?intact`), so she is torn in every real game, and the
  wing that comes off is `bays[3]` every time. The test now runs the drawing
  checks on both — the wrecked hull everybody flies and the intact one nobody
  does — and compares the sponsons across three seeds.

  Something on her *is* seeded, and it is worth writing down: the **breach in
  the flank** sits at `-half * 0.34 + rnd(-260, 260)`, off the sector's own
  generator, so the plate run around the wound differs from seed to seed. The
  roll decides where she was holed, not which wing came off.
- [x] **N5 · Enemies can shoot through the Leviathan.** Reported during the
  same playtest. Reproduce projectile passage through its solid structure;
  whether this shares N4's cause is unknown.

  *It does not share N4's cause, and it was worse than the Leviathan.* There
  are **two bullet systems**. Yours are `bullets`, and the main loop sweeps
  every one of them through `solidHit`, which knows about worlds, dead hulls,
  the Leviathan, the Vault and the Warrens. Everybody else's are `surv.shots`,
  and that loop had learned about **rock and nothing else** — so every round
  fired by anything in the sector passed through every structure in it. The
  Leviathan is simply where you notice, because it is the one place you are
  *inside* a structure being shot at.

  It is the same mistake the rock block directly above it records, one object
  later: *"a sector where only your bullets are real is a sector where nothing
  anyone else does is happening in the same world you are in."* Their rounds
  go through `solidHit` now, swept along the round's travel the way yours are,
  since a fast round covers more than a plate is thick in one frame. A dead
  hull only stops them — it is a target for your gun, not for a sentry's.
  `surveyShots` in `game/sector-places.js`; `test/survey.js` §10d fires a
  900u/s round at the thickest plate on the ship and will not let it out the
  other side.
- [x] **N6 · Scanning calls wormholes gates.** Scan returns should call them
  **wormholes**. This is a request about player-facing scan wording, not a
  decision to rename internal identifiers or every use of "gate".

  *Done 2026-11-12.* There turned out to be exactly **four** places the thing
  is named to the player, and they all moved together: the scan return
  (`ECHO_KINDS`), the chart mark (`CHART_MARKS`), your own pin (`PIN_KINDS`),
  and the card you get the first time you fly near one (`gateCard`, which also
  said JUMP GATE). Renaming only the scan would have left a return labelled
  WORMHOLE sitting on a chart labelled GATE, which is the CARGO/STORAGE note
  one object later — two names is how a player ends up believing there are
  two things.

  The key stays `gate` in the code, the save and the tests, as the brief says.
  Nothing else moved: `GATE_R`, the prose about the manmade wormhole, and the
  station's own WORMHOLE page are all untouched — and the mode already called
  the one you *build* a wormhole, so this is the sector agreeing with the
  station rather than a new word. `test/survey.js` §15c scans one and then
  checks nothing left on the screen calls the same thing a gate.
- [x] **N7 · The full map should show visited space like the minimap.** Ric:
  "it needs to look like the mini map in how it shows where they have been."
  Match the minimap's representation of explored space on the full map; the
  request is specifically about showing where the player has travelled.

  *Done 2026-11-12, and it was already drawing it — it gave up.* Both charts
  call the same `paintFog` over the same set. That painter walks the **window**
  in 480-unit cells, so the count grows with the square of the span, and it
  carried a bail-out at 40,000 cells — about **115,000 units across**:

  ```js
  if ((c1 - c0) * (r1 - r0) > 40000) return;   // zoomed out past usefulness
  ```

  The chart's zoom ladder runs to forty million. So **only the closest six of
  its fifteen steps ever painted the wash**, and every zoom wide enough to
  look at a run's worth of travel showed none of it. The minimap never hits
  the ceiling because its span is fixed at 14,000 — which is exactly why it
  looked right there and wrong on the full map.

  Past the ceiling it walks the **record** instead of the window: the charted
  set does not grow when you zoom out, and it is bucketed into blocks of at
  least three pixels, since a cell is far under one out there. A block is
  filled if any cell in it was visited, which reads a little generous at the
  widest steps — the right error for a question that is *where have I been*
  rather than *exactly which cells*. Cached and rebuilt at most four times a
  second. `paintFog` and `coarseFog` in `survey-hud/panel.js`; `test/fog.js`
  holds that the blocks are the same record, cover every cell of it, and get
  coarser rather than emptier as the step grows.

- [x] **N10 · The low-tank word goes on the left of the mark.** Ric,
  2026-11-12: "warning for the water, the words should be on the left of the
  exclamation mark, and then warning disappears when the triangle slides to
  the left, for food and water."

  *Built the same day, and the two halves turned out to be one bug.* With the
  word on the left, the mark slides **through** where the word was — and the
  two were up together, because the fade and the slide were timed
  independently: the word held at full strength for seven of its ten seconds
  while the mark was already most of the way home. The ten seconds are cut in
  two now, in the order the lesson is taught — the word is said with the mark
  parked out past it, the word goes, and only then does the mark ease in
  beside the number. Where it parks is measured rather than guessed (the
  number column at its widest, the word's own width, the same gap either
  side), so the word fits at any reading and on any glass, and both tanks get
  it because they were always one loop. `drawCounters` in
  `survey-hud/panel.js`.

---

## An extraction shooter in space — 2026-11-13

Ric asked what would hold attention for hundreds of hours, was told six
things the plan had missed, and agreed to two of the fixes: *"I like the idea
of 3"*, and of losing a hull, *"those things would need to be communicated
phenomenally clearly and if that's the case the price of things would
probably need to go down more."* Then the sentence that sets the direction:
**"This is seeming somewhat like an extraction shooter in space. And I like
that. So let's keep it like that."**

He did **not** agree to waking the home sky up after three parts: "the first
like 30 min is good of fixing ur station ... things just need to be
communicated clearer." That one is not built.

- [x] **N14 · A range ring, and an arrow that stays inside it.** The landmark
  ladder runs 13k, 30k, 70k, 160k and then 360k, 780k, 1.25M and 3.4M, and a
  starting hull carries twenty minutes of water. Once the light drive stopped
  being pocket money (N13), the one arrow in the mode pointed at places a
  pilot could not practically reach for hours and said nothing about why.

  *Built.* `surveyReach` is out and back on one tank in the hull you are
  flying: half of what the tighter tank lasts, at top speed, less a margin.
  A SKIFF comes out at about 165,000 units and a courier at well over twice
  that, so **range is now the thing the middle of the game grows**. The chart
  draws it as a dashed ring round home, RANGE ON ONE TANK. After the gate the
  arrow picks, in order: the nearest unlogged landmark inside the ring; then
  a boss's sky inside it, still flying; and only then the nearest landmark
  outside it, which the line calls **PAST YOUR RANGE** and says what moves the
  line. It is honest about what it is not — a station on the way refills you
  and a melter makes water — so it is the unsupported round trip, the
  distance you can be wrong about and still come home. `test/survey.js` §15e.

- [x] **N15 · A bought hull stays where you die in it.** The SKIFF always
  comes home: it is free, and a pilot who has bought nothing loses nothing
  they did not lose before. Any other hull stays where you fell with
  everything bolted to it — the hull as one thing to fly back for, each fitted
  part lying beside it the way a spare already does. Nothing is destroyed by
  dying. It is on the chart by name, and the only thing that takes it for good
  is somebody else getting there first, which pirates and scavengers already
  do to anything left on the floor.

  *Said four times, because that was the condition.* **Before the money
  changes hands:** the hangar prints the rule beside the price. **Before it
  can cost anything:** a beat fires the first time you are out of a dock in a
  hull that is not the SKIFF. **When it happens:** the death screen names the
  ship on its own line — YOUR LANCE IS STILL OUT THERE — FLY BACK FOR IT —
  lists the hull and what was bolted to it under STILL OUT THERE, and says you
  wake in the SKIFF. **Afterwards:** the objective reads GO BACK FOR YOUR
  LANCE HULL and the arrow leads to it with a real distance, ahead of
  everything else on the board, until it is recovered or taken.

  **And prices came back down**, as he said they would have to. The hull curve
  is `8.22 * cost^0.825` — about 2.5x the original at the bottom and the
  original figure at the top — where for one day it was 5x and 1.3x. NEEDLE
  2,200, LANCE 6,700, DRAYMAN 23,000, TENDER 168,000. Parts and salvage are
  unchanged. `surveyDie` in `game/survival.js`; `test/survey.js` §8d flies
  the whole thing, through the book and back.

  *Not built, and worth knowing:* there is no insurance, no way to abandon a
  wreck so the arrow lets go of it, and a hull a scavenger takes is gone with
  no way to buy it back except new.

---

## Flying it himself — 2026-11-13

Ric, after the list above was cleared: *"when scanning worlds dont pop up on
the map and you can click e on some planets before you can see them. that
shouldnt be possible."* Two reports, two separate causes, and the second one
turned out to be bigger than the sentence. **Both fixed the same day.**

- [x] **N11 · A scan does not return worlds.** `surveyScan` walks parts,
  caches, stations, gates, hulks, sentries, traffic and loose salvage. It
  never touches `surv.planets`, and there is no `planet` row in `ECHO_KINDS`
  — so the largest objects in the sector are the one kind of thing a scan has
  never reported, and nothing a scan finds puts one on the chart. (A world
  does reach the chart by being *flown near*: `recordSurroundings` writes one
  at `sight + r`. That is why it looks intermittent rather than absent.)

  Worth fixing with the radius in hand: `add` tests a point against the scan
  range, and a world can be 3,210 units in radius, so a world whose surface is
  well inside a scan can have its centre well outside it.

  *Done 2026-11-13.* `ECHO_KINDS` gains a `planet` row named **WORLD** — the
  same word the chart already uses, so a return and the mark it becomes say
  one thing — and `add` takes an optional radius, used by this one kind and
  nothing else. No arrow: three kinds of arrow is the rule (A6), and a world
  is not a decision, it is scenery you can see. `test/survey.js` §15d scans
  one from above its surface, and again from far enough out that its centre
  is past the scan and its surface is not.

- [x] **N12 · A world is an outline, not a body — so up close there is
  nothing to see.** This is the "press E before you can see them" half, and
  the cause is that `drawPlanet` **never fills the disc**. It strokes an
  atmosphere ring, strokes the circle, draws four latitude chords and writes
  the name round the rim. The inside of a world is left as bare starfield.

  That is invisible on a small world, because the whole circle fits on the
  screen and reads as a disc. On a big one it is the whole bug: at 189 units
  above the surface of a 2,601-unit world — the distance that lights the
  prompt — the centre is 2,790 units away and **the only thing on screen is a
  thin stroked arc**. Measured: seven lit pixels across the middle row of the
  canvas. The bands are chords measured from a centre that is far off screen,
  so none of them is drawn either. Everything inside the limb is identical to
  open space, which is exactly why "you can press E on some planets before you
  can see them" — *some* being the big ones.

  The Leviathan learned this already: *"Filled dark first — a hull you can see
  stars through is a fence."* A world is solid (`solidHit` and `solidBounce`
  both stop you at `pl.r`), so the inside of that circle is somewhere you can
  never be, and drawing it as empty space is a straight lie about the one
  object in the sector you cannot miss.

  *Done 2026-11-13.* The disc is filled before anything is stroked over it,
  dark enough that the lit rim is still the edge and the bands still read as
  markings on it, and mixed off the world's own band colour so an ember world
  is not the same body as an ice one. A rogue takes the same mix through its
  own `dim` and comes out nearly black — it has nothing warming it, and it is
  still a place rather than a hole.

  Measured in the running game, parked 189 units above a 2,601-unit ember
  world, sampling the middle row of the canvas:

  | screen x | before | after |
  |---|---|---|
  | 50 · 150 · 250 · 340 (inside the limb) | black | `rgb(54,27,25)` |
  | 380 · 450 (outside it) | black | black |

  The limb lands at x=364, where the geometry says. Before, the whole strip
  was five lit pixels — the stroked arc and nothing else. `test/survey.js`
  §15d draws two frames that differ by exactly one thing, whether the world
  is in the list, and fails if the one with it in paints no more than the one
  without.

- [x] **N13 · The light drive is something you work up to.** Ric,
  2026-11-13: "the warp drive needs to be massive expensive. It needs to be to
  the point that they have to buy new ships and fly around for the first like
  10-20hrs. The warp drive should be something they have to work up towards."

  *Done the same day: 2,400 → 150,000.* At 2,400 it cost less than the
  cheapest hull and it is the most powerful thing a pilot can own — eight
  times the drive turns the far half of the landmark ladder from hours into
  minutes, so buying it first skipped the sky the mode is made of. The figure
  is placed against the hull ladder, not a clock: nothing in the game records
  how fast money is earned, so "ten to twenty hours" is the intent and has not
  been measured. `LIGHT_DRIVE` in `game/survey-sector.js` is the one constant.

### Design questions — still being discussed

The expanded ideas from this conversation are in
[`WORLD-IDEAS.md`, Playtest discussion](WORLD-IDEAS.md#playtest-discussion--12-november-2026).
They remain proposals; recording them is not a request to implement them.

- [?] **N8 · What pulls the player onward after the opening?** Ric felt that
  after finishing the tutorial there was no clear next thing to do. Revisit
  the experience despite the September changes recorded under "The
  thirty-minute wall" below. Quests were discussed, but no quest system,
  objective chain or implementation has been chosen.
- [?] **N9 · Give the player a reason to return to this world.** Ric wants a
  sense of "that's mine", then clarified: "maybe not my station maybe the
  world." The desired attachment is to the world and the player's experience
  of it; a station-building direction has not been agreed. Space feeling empty
  and uncertainty about how quests should work remain open questions.
  Familiar people, remembered encounters and continuing threads were assistant
  suggestions in the discussion, not approved features.

---

## BUGS

- [x] **B1 · Hulks are unbreakable.** They should be *harder* than they were —
  Ric likes that part — but they are currently not breakable at all. Fix the
  bug, then give them modestly more hull than the old value, not less.
- [x] **B2 · Ships vanish mid-chase.** Something disappears while chasing, or
  while being chased. Suspect the streamer culling traffic by distance without
  asking whether it is currently engaged. Needs reproducing before fixing.
- [x] **B3 · Some wrecks drop nothing.** A broken ship should almost always
  leave cargo or cash. Empty should be a low percentage, not a coin flip.
- [x] **B4 · Arrow glyphs should match what they point at.** A ship-shaped
  arrow means a ship. A hulk gets a single V. One glyph per kind of thing.
- [x] **B5 · Bot bullets are too slow.** The player can outrun them in a
  straight line. Raise the round speed so running away in a straight line is
  not an answer.
- [x] **B6 · One more hit on the base ship.** Starting hull 5 → 6.
- [x] **B7 · Too many raiders, and they only want you.** Three parts:
  - cut the raider population by about 10%
  - they must react to being attacked by *anybody*, not only by the player
  - they must value their own life (break off, run when losing)
  - and confirm other bots can actually damage them
- [x] **B8 · Bot ships fly the wrong colours.** A ship should be drawn in its
  faction's colour. (`trafficColour` already does this — so the bug is
  somewhere specific: find which ships are exempt and why.)

## BOTS

- [x] **T1 · Pirates and scavengers should want loot.** They pick parts and
  anything else up off the floor. When you die, they sometimes take your
  things. This is the "what three systems does it touch" test passing on its
  own: it touches death, salvage and why you hurry back. *One `lootNear` feeds
  both roles' wants; a laden hauler still beats cargo on the floor and a live
  target beats both, so "sometimes" is emergent rather than a dice roll.*

## SCANNING

- [x] **S1 · Scanned minerals are all called "cash".** *(done early — it
  was one word in the same table B8 lives in; splitting it across two pushes
  would have been ceremony.)* A scan return should say
  what the thing actually is — ICE, IRON, ALLOY — not the currency it becomes.
- [x] **S2 · Ships need names on a scan.** Generated per ship, stable for that
  ship. Format Ric gave: `CARGO SHIP-114 (faction)`.

## ARROWS

- [x] **A1 · The manifest arrow should point at the *nearest* part.** Order does
  not matter. This is what fixes the arrow bugging out when you die carrying
  one.
- [x] **A2 · That arrow must be a single arrow, not a double.**
- [x] **A3 · The Vault is a mess.** Lines, hit markers, bots flying behind the
  walls, bullets passing through them. Everything the Leviathan got right and
  this did not. Use the Leviathan as the reference implementation.
  *Two causes, neither visible from outside (2026-09-24).* The walls were
  drawn as two-pixel lines down the middle of 300-unit disc rows, so a round
  stopped and sparked 150 units short of anything you could see and a ship
  bounced off nothing — that is "lines", "hit markers" and "bullets passing
  through" in one. They are plates now, as wide as their discs, through the
  same chained-run stroke the Leviathan uses (`strokePlates`). And both built
  things were painted *after* the traffic, so their dark fill covered every
  ship inside them — "bots flying behind the walls". They are drawn first now.
  Found on the way, and worse than any of those: the inner shell's gaps were
  centred on the spokes instead of between them, so every spoke was sealed at
  its mouth and the core was unreachable on every seed; and the core's own
  mouth was 27 units wide once the discs were counted. The same flood fill
  that keeps the Leviathan honest now runs on the Vault in `test/survey.js`:
  a route to the core, all three caches reachable, every spoke enterable, and
  bricking up the real spoke seals the core.
- [x] **A4 · Planet names should ride the planet.** The name and the word
  INHABITED move around the rim the way a station's words rotate. Bigger
  planets can carry more than one so they are easier to spot. *One `rimWord`
  now sets a word on a circle and the station uses it too; a world over 700
  units wears its name twice and over 1300 three times.*
- [x] **A5 · The wormhole arrow says STATION after the gate is built.**
  *Checked and could not reproduce:* once the gate is built `objectiveTarget`
  returns null, `contacts` empties and no arrow of that kind survives —
  verified in a running game. What Ric actually wants here is the constructive
  half, which is **P1**: after the gate, the arrow should lead to TRACTOR BEAM
  MK1. If a STATION arrow does still turn up, it needs a repro.
- [x] **A6 · Three kinds of arrow, dialled down.** Ric, 2026-09-25: "there
  should only be 3 different types of arrows" — and then chose them. There
  were three draw paths but about a dozen looks, and three near-identical
  blues. Now, in `panel-strip.js`:
  - **GO HERE** — blue `#5fd8ff`, big pulsing V with a label: the objective,
    the chart pick, and the nearest three of your pins ("the go here needs to
    include pings"). Only the chart pick outlasts a scan.
  - **GOOD** — green `#6dffbf`, small V: parts, caches (both kinds), stations,
    gates, distress calls.
  - **DANGER** — red `#ff5a5a`, solid barbed dart: sentries, guarded caches,
    hunters, and any ship the scan caught making trouble.
  - Ore, quiet traffic and patrols get **no arrow** — minimap and world ring
    only. Danger is drawn first and nearest first (4 max), then good (5 max).
  Also fixed: a return for something picked up, opened or stripped kept its
  arrow for 20s (`dropEchoAt`); a return under a GO HERE arrow drew a second
  one on top; scan arrows last 5s (`SCAN_ARROWS`), returns still 20s.

## STATION HUD

- [x] **H1 · A third tab: INVENTORY.** A shrunk inventory page wearing the
  shop's frame — "a browser inside a browser". Specifically:
  - the strip that says SHOP / HANGAR gains INVENTORY
  - where BUY and SELL sit, put the inventory's own tabs — SHIP, CARGO,
    RECORD, CRAFTING, MAP — in the yellow
  - below that, exactly the inventory page as it is now

  *Built as a page inside a page rather than a fork.* The five inventory pages
  each draw themselves whole — ground, title, rule, strip, close — so the
  station raises a counter that makes `pageFrame`, `pageNav` and `closeButton`
  do nothing, pushes `PAGE.TOP` down by its extra row, and calls the ordinary
  draw function. There is still exactly one cargo page and one copy of every
  rule in it, which is the "share rather than fork" the note asked for. The test
  counts the words the page paints: two navigation strips would mean it had
  forked.
- [x] **H2 · Group what a place will not buy.** In SELL, everything marked
  "this place doesn't buy these" moves to the bottom under one heading:
  `NOT PURCHASING TODAY`.
- [x] **H3 · A WORMHOLE tab.** Appears beside INVENTORY once the manmade
  wormhole is built. It is a map, but *only* for teleporting between stations —
  not the chart page. Free, and any station you have **charted** is a
  destination. You still have to be docked somewhere to make the jump.

  *Deliberately not the chart.* The chart is where you read the sector — it
  pans, zooms, carries pins and hazards, and a tap there can mean several
  things. This answers one question and has one gesture: every mooring you have
  charted, where it is, how far, and a line back to where you are standing. It
  fits itself to what you know rather than panning, because a map you have to
  navigate in order to navigate is a map with a map inside it.
- [x] **H4 · Buying must stop at what you can afford.** The quantity control
  should refuse to climb past your purse. Four cash, the counter stops.

## PARTS

- [x] **P1 · The tractor beam becomes a ladder: MK1 / MK2 / MK3.**
  - [x] MK1 — half the radius of today's base tractor beam (170 units)
  - [x] MK2 — today's tractor beam (340)
  - [x] MK3 — today's HEAVY BEAM, folded into the ladder (544)
  - [x] MK1 is craftable and find-only; MK3 stays bought, as the best of a
        category always is
  - [x] after the wormhole is built, the arrow that used to say STATION leads
        to TRACTOR BEAM MK1 instead — placed like a landmark about 33k out, and
        it is a *spare*, so it goes into the hold rather than onto the gate

  *Two rungs moved on 2026-11-12, under **N2** above.* The MK2's
  build is gone (it is found and nothing else now), and the MK1 dropped from
  half the MK2's reach to about a third, 170 → 119 units. The rest of P1 stands:
  MK1 is still craftable and still find-only, MK3 is still bought, and the
  post-gate arrow still leads to an MK1.

  *Found while building it:* a category is not exclusive and `mods()` sums
  every effect, so fitting MK1 beside MK3 reached 374 units where MK3 alone
  reaches 544 — the ladder made `reach` the first effect that can be negative.
  Reach is now the best beam fitted rather than the total, and all eight
  combinations are asserted in `test/survey.js`.
- [x] **P2 · Parts spawn too far out.** The manmade-wormhole set — MK1
  included — must all be inside 45,000 units.
- [x] **P3 · A part's hitbox is the outer ring, not the triangle.** Picking one
  up should not require threading the middle of it.
- [x] **P4 · Scatter the buyable parts too.** The ones you can buy or sell
  should also be findable out there, the way the wormhole parts are — but very
  hard to find. *One chunk in ~430, fifteen different kinds, rolled off its own
  stream so no existing sector's terrain moved. A part taken is remembered in
  the save (`lifted`) or it grows back every time its chunk reloads.*

## SETTINGS

- [x] **C1 · Mouse control.** The ship follows the pointer and click fires. It
  turns at the hull's own rotation rate — no snapping, no free aim.
- [x] **C2 · Pick your input.** Mouse-and-keyboard or touchscreen, chosen
  rather than sniffed, for people on touchscreen laptops.
- [x] **C3 · Rebuild the settings page.** Better looking, better organised.
- [x] **C4 · Overhaul it again, properly.** C3 tidied a stack that was already
  out of room: the line under INPUT was drawn through the buttons it explained,
  and the phone had a second copy of the whole page with the live thumbstick on
  top of RESET SURVEY. It is a **rail of categories and one panel** now, with
  EXIT GAME and BACK at the rail's foot. One page on every machine; the pad's
  drag screen is a room off it rather than a rival to it, and holds nothing but
  a title, a line and three buttons. Every control is reachable from the
  keyboard, which only the key grid used to be. *A new setting is a new row and
  nothing below it moves.*
- [x] **C5 · Three rooms, the way games do it.** The usual five — gameplay,
  controls, video, audio, account — collapse to **CONTROLS · GAME · ACCOUNT** at
  this size. CONTROLS carries four tabs: **MOUSE, KEYS, CONTROLLER,
  TOUCHSCREEN**. The per-mode tabs are gone and the camera is one answer for
  every mode (an old three-answer save collapses into it); the zoom stays
  Survey's and friendly fire stays Survival's, both on the page wherever you
  are, with the mode named beside them. `INPUT` became TOUCH CONTROLS on the
  touchscreen tab, because what it decides is whether the pad turns up. And most
  rows lost their explanatory line — `SOUND: ON` does not need telling you the
  sound is on.
- [x] **C6 · Read a gamepad.** The CONTROLLER tab says COMING SOON because
  nothing in the game reads one. Sticks to turn and thrust, a trigger to fire,
  buttons on the four Survey slots, and the tab naming what is plugged in.
  *Built 2026-09-24, in the standard layout.* Polled once a frame (`gpad` in
  `game/input.js`): the held things — turn, thrust, reverse, fire — are OR-ed
  into the local ship's input beside touch and the mouse; the pressed things —
  a menu move, a choice, a slot — go through `menuKey` with the key code a
  keyboard would have sent, so a pad presses the same menus and there is no
  second copy. Fixed mapping, no binding screen; the tab names the pad, lists
  the layout and shows what is being pressed. `test/gamepad.js` drives a fake
  one through the title, the cockpit and an unplug.

---

## Answered

1. **P1 — MK3 is the HEAVY BEAM.** The tractor category becomes one ladder:
   MK1 at half today's radius, MK2 = today's TRACTOR BEAM, MK3 = today's HEAVY
   BEAM. HEAVY BEAM stops being a separate name. *(MK1 is about a third rather
   than half since 2026-11-12, and the MK2 has no build any more — N2.)*
2. **H3 — a jump is free, to any *charted* station.** Seeing one on the chart
   is enough; you do not have to have docked there. You still have to be docked
   *somewhere* to make the jump.
3. **B7 — "raider":** the code's role is `pirate`. Taking those to be the same
   thing unless told otherwise.

## The order Ric set

1. **BUGS, B1–B8** — then push.
2. **Controls, C1–C3** — then push.
3. **Everything else** — BOTS, SCANNING, ARROWS, STATION HUD, PARTS.

## Done alongside

- **The twenty-five hulls fly differently now.** Ric flew the roster and said
  they all felt the same. He was right, and the numbers hid it: every hull's
  `accel` and `drag` did reach the ship, but the two were tuned in the same
  direction and cancelled, so *time to reach your own top speed* came out
  between 1.00s and 1.75s for all twenty-five — and inverted, with the GRANARY
  quicker off the mark than the NEEDLE. Re-cut against what each category is
  for, and a round's speed is the hull's now rather than one constant, so a
  fast ship outruns a freighter's return fire and not a gunship's.

  | | was | now |
  |---|---|---|
  | top speed | 2.21x | **4.72x** (130 → 612 u/s) |
  | off the mark | 1.75x | **13.84x** (0.42 → 5.77s) |
  | turn rate | 3.95x | **8.68x** (0.70 → 6.11 rad/s) |
  | stopping | 5.69x | **10.38x** (2.0 → 20.9s) |
  | bot round speed | flat 520 | **3.10x** (260 → 806 u/s) |

- **The generator is twice as fast and makes the same worlds.** 84% of chunk
  generation was cave noise; `tunnelNode` and a cell's segments are memoised
  now, `segDist2` stopped allocating, and the square root came out of the
  segment loop. 1.861ms → 0.922ms a chunk, `test/warrens.js` 182s → 52s.
  `test/fingerprint.js` is the gate that says a seed still makes the same
  sector — run it before and after anything in `survey-world.js`.

## The thirty-minute wall — 2026-09-14

Not from the list. Ric: *"you spawn in and the first 10-15 min is you figuring
the game out. then 15-30 min is you bored because you got the wormhole and now
you don't know what to do."* And the constraint: he does not want to tell people
what to do.

It was not a content problem — there is a ladder out to 3,400,000 units past the
gate. Four surfaces went quiet at the same moment, and all four are now fixed.
See README, "And then the hours after it".

- [x] **W1 · The objective line told them it was over.** "the sector is yours to
  wander", at the exact moment the sector opens up. It now points at the nearest
  landmark still missing from the book, with the almanac's note as its clue, for
  as long as the book has a hole in it. Secret entries stay secret — the line
  reads SOMETHING UNLOGGED.
- [x] **W2 · That arrow said a range.** A bearing plus an exact distance is a
  position. A delivery keeps its number; a search gets a band. `vague` on the
  target, read by the ring rather than guessed at.
- [x] **W3 · The opening stopped teaching after two minutes.** `OPENING` gained a
  second act on the same terms — fires once, waits for a pressure you are already
  under, names no destination. Four beats: the tank as a leash, the Hostile band,
  the yard's second berth at half the price, and the shelf you cannot reach.
- [x] **W4 · Eleven parts could not be met anywhere.** The shop, the workbench and
  the almanac each correctly refused the job and nobody picked it up, so the best
  part in every category was something you could only own by accident. They are
  on the missions page as NOT FOR SALE HERE, addressed off their own `deep`.
- [x] **W5 · The gate read as a finish line.** The banner said "it was never about
  the parts"; it says "now go somewhere you have not been". The finished manifest
  collapses from six rows of "fitted" to one line, and the room goes to W4.

*Found while building it:* `cf.objectiveTarget` was never exposed, so the check
in `test/survey.js` that guards on it with `cf.objectiveTarget ? … : null` had
never once run. It is exposed now and the check is live.

*Fixed in passing:* the yard's BUILD IT button was 200 wide for "BUILD IT
¤2,400" and cut the price — the one number on it anybody needs.

## The ships, re-cut twice — 2026-09-15

Ric flew the roster again: *"the ships need to be crazy. the jackal should not
have momentum — you go right and it goes right almost instantly."* Then, on the
first cut: *"way closer but turning is way too fast."*

- [x] **S1 · Handling was one ladder.** `drag` had seven values across
  twenty-five hulls, one per category, and `accel` tracked it almost exactly —
  so faster always meant twitchier and there was no third thing a hull could be.
  Two axes now: `speed` is how fast you can eventually go, `drag` is **grip**,
  how hard you are glued to where you point. They are deliberately uncorrelated,
  so there are four corners instead of one line.
- [x] **S2 · `accel` stopped being a column.** It is derived from speed and grip.
  Headroom rises as grip falls — a flat headroom tied engine size to shortness
  of drift, which gave every floaty hull a feeble engine and quietly stopped a
  Drayman climbing out of a gravity well. A barge has a big engine *and*
  enormous inertia.
- [x] **S3 · Turn was overcooked.** The first cut ran to 10.88 rad/s. Ric flew
  the Jackal at 8.32 and called it way too fast, so the whole roster came back
  down — top is 6.11 rad/s again, the value it had before any of this, and the
  Jackal sits at 4.42 against the 4.16 it used to have. **Turn is ergonomic; the
  military feel comes from grip, not from turn.**
- [x] **S4 · The military ladder Ric set.** LANCE is the intro, SPUR the step up,
  BASTION a bit better than SPUR, REPRISAL the strongest, and the JACKAL off to
  one side as the fastest and hardest-hitting. All five are glued — every
  military hull forgets a heading inside a third of a second, and nothing
  outside the category comes close.
- [x] **S5 · A four-round burst on the Bastion and the Jackal.** `BURST_SIZE` was
  a global 3 — the one thing about a gun every hull in the game agreed on. It is
  a hull's number now, defaulting to three.
- [x] **S6 · The hangar said DRAG and drew the bar backwards.** It says GRIP and
  fills the way the other eight do, and there is a BURST bar beside it.

*Consequence worth knowing:* a hauler caught inside a supermassive well's reach
is now in real trouble — the inward pull accumulates across all twenty-three
seconds of a Drayman's drift. `test/survey.js` flies the dodge check on a Lance
now, because "the dodge runs" and "a barge can win" are two different claims.

| | before | after |
|---|---|---|
| Jackal, heading half-life | 1.73s | **0.06s** |
| Jackal, 0 → top | 1.51s | **0.08s** |
| roster, off the mark | 13.8x | **73x** |
| roster, coasting | 10.4x | **267x** |
| Jackal coasts to a stop in | 990u | **33u** |

## The seven other categories — 2026-09-15

Ric's spec, category by category, after the military ladder landed.

- [x] **C1 · EXPLORER.** Skiff untouched — "the skiff is perfect". Carrack and
  Longview keep its handling *exactly* (same grip, same turn) and climb on cargo
  and top speed only: 150 → 600 → 900, 324 → 360 → 414. One feel, three sizes.
- [x] **C2 · CARGO.** Back with the explorers on feel — grip 0.46–0.50 against
  the explorers' 0.55 — slower than them, and far more of everything else: up to
  2,400 hold and 55 hull.
- [x] **C3 · COURIER.** Nothing in the hold (22–44), the hardest acceleration in
  the game, top speeds behind only the sport hulls, and grip well above the
  commuters. The Runner gained hull because a Vane otherwise beat it on every
  single number for less money.
- [x] **C4 · COMMUTER.** Pannier inverted to be the fastest and best-turning of
  the three. Slow to wind up, barely any slide, and a **shielded prow** that
  pushes the drifting field aside instead of being stopped by it. Rocks only —
  worlds, hulks and the Leviathan stay solid.
- [x] **C5 · SPORT.** The sliders. Quickest to their own top speed of anything
  that is not military, and then seven to nine seconds of drift. **One big
  round** — burst of 1 on the ordinary trigger rhythm, and damage raised so the
  single shot is worth firing.
- [x] **C6 · INDUSTRIAL.** Tanks: 60–80 hull, 750–1,300 hold, and slow. One
  **beam** at a time, drawn much wider with a head on it, that takes a rock of
  any size apart in a single hit.
- [x] **C7 · UTILITY.** Stays UTILITY. Industrial-shaped stats, and a **claw**
  instead of a gun — no round leaves the ship, it is a reach in front of the
  nose that crushes whatever is in it. Jaws drawn on the hull, closed at rest.

**Two new axes, and why they had to exist.** Ric asked commuters to "accelerate
extremely slow" *and* have "little sliding", and sport hulls to be "easy to get
to speed" *and* "really slide". Both pairs are the same number — grip decides
how fast you arrive at your top speed and how long you keep it, together — so
neither was expressible. `spool` is how long the drive takes to wind up, and
`punch` is how hard the engine pushes past its own ceiling. A commuter is a bus:
slow pull-away, good brakes. A sport hull is a big engine on a slick floor.

`bite` is the third: how much of the turn survives at full speed. One on
everything but the commuters, who turn well at a dock and badly at a run.

*Found while building it:* the Jackal was still carrying a comment saying its
handling was "the old Louvre handling, kept exactly" — two re-cuts after it
stopped being true.

## The ships, and what flying them turned up — 2026-09-15

Three more rounds with Ric at the stick. The numbers are in the sections above;
these are the things the flying found that the tables could not.

- [x] **S8 · Turn was overcooked, twice.** Ended at 6.11 rad/s across the roster —
  exactly where it was before any of this. **Turn is ergonomic. The feel comes
  from grip.**
- [x] **S9 · Couriers and commuters own the top end** and pay for it in wind-up
  (2.5s–4.0s to speed). Sport is the drift class, not the speed class: quickest
  off the line and then eight to ten seconds of carrying it.
- [x] **S10 · Bots were only half flying your stats.** Speed, accel, drag, turn
  and firepower came off the hull; `spool`, `bite`, `burst`, `weapon` and `ram`
  were player-only, so a bot Windlass fired a pea-shooter. All plumbed.
- [x] **S11 · A shove ignored mass.** Bounces handed back a fixed multiple of the
  closing speed, which was survivable until grip spanned 267x — a courier
  clipping a Gantry put it at top speed for forty-five seconds. Ric found it:
  *"the courier ships make the gantry go faster."* Shared by mass now.
- [x] **S12 · Bots stopped dead.** Three `solidBounce` callers multiplied the
  whole velocity by 0.2–0.25 — an annihilation, identical for every hull. They
  reflect along the surface normal now.
- [x] **S13 · `shipR` never knew what you were flying.** `SHIP_R * U`, flat, for
  every hull — harmless with one triangle, wrong from the moment Survey drew
  twenty-five. **Two bugs, one cause:** the exhaust came out a quarter of the way
  back from the nose on big hulls, and the collision circle was a third of the
  ship, so rocks passed through the visible hull. Both read the hull now.
- [x] **S14 · The collision circle comes off the outline.** Mean corner distance
  x 0.8, which leaves the stock hull exactly where it was (9) and stops the
  Tender being stopped by a Skiff's circle (32 → 68).
- [x] **S15 · Tanks are stopped by rock, not hurt by it.** Deliberately not the
  commuters' prow: a commuter passes *through* the field, a working hull is
  stopped and shrugs. Both exist; nothing may have both.
- [x] **S16 · Nothing outruns its own hitbox.** Rounds and hulls are swept
  against rocks, and a tripwire checks one frame of travel against the smallest
  thing it must hit — it will fail the moment anything gets fast enough for this
  to come back.
- [x] **S17 · The front door is quiet.** A smooth bowl to ~10,000 units with a
  floor, a live cap of two, and raiders scaled by the same bowl. Measured across
  six sectors: 0.107 ships a chunk at the door against 0.365 in the open.

*Found while fixing it:* `test/survey.js` asserted the traffic wants four
seconds in. Real bot turn rates resolve that whole fight in under four, so the
check was reading a later — and perfectly correct — state. It watches for the
wants as they happen now rather than sampling once after the fact.

## Notes to self

- Several of these are the same bug class this mode has shipped before: a list
  of names kept in step by hand (B4, B8, A5). Prefer asking the object what it
  is over maintaining a table.
- A3 (the Vault) is the biggest single item here and is really four bugs in a
  trench coat. Break it down before starting.
- H1 is a page inside a page; check how `marketPage` and `drawInventory` can
  share rather than fork.
