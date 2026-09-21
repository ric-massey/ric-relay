# KONDRITE — the list

Everything Ric has asked for and not yet got. One line an item, checked off only
when it is built, tested and pushed. Nothing leaves this file by being finished —
it gets a tick and a commit hash, so the list is also the record.

**Status key** — `[ ]` not started · `[~]` in progress · `[x]` done · `[?]` needs
an answer before it can be built.

Batch of 2026-09-13, which has been added to since: **30 items, 28 done.**
Counted from the boxes rather than kept by hand — the line that used to live
here said 27 items and 26 done and named A3 as the only one left, which had
stopped being true twice over: C4 and C5 were added to SETTINGS after it was
written, and C6 was added open.

**Left: A3 (the Vault) and C6 (read a gamepad).**

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
- [ ] **A3 · The Vault is a mess.** Lines, hit markers, bots flying behind the
  walls, bullets passing through them. Everything the Leviathan got right and
  this did not. Use the Leviathan as the reference implementation.
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
- [ ] **C6 · Read a gamepad.** The CONTROLLER tab says COMING SOON because
  nothing in the game reads one. Sticks to turn and thrust, a trigger to fire,
  buttons on the four Survey slots, and the tab naming what is plugged in.

---

## Answered

1. **P1 — MK3 is the HEAVY BEAM.** The tractor category becomes one ladder:
   MK1 at half today's radius, MK2 = today's TRACTOR BEAM, MK3 = today's HEAVY
   BEAM. HEAVY BEAM stops being a separate name.
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
