# CROSSFIRE — the list

Everything Ric has asked for and not yet got. One line an item, checked off only
when it is built, tested and pushed. Nothing leaves this file by being finished —
it gets a tick and a commit hash, so the list is also the record.

**Status key** — `[ ]` not started · `[~]` in progress · `[x]` done · `[?]` needs
an answer before it can be built.

Batch of 2026-09-13. 27 items. **18 done** — B1–B8, S1 · C1–C3 · S2, A1, A2, A5 ·
P2, P3. P1 is most of the way.

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

- [ ] **T1 · Pirates and scavengers should want loot.** They pick parts and
  anything else up off the floor. When you die, they sometimes take your
  things. This is the "what three systems does it touch" test passing on its
  own: it touches death, salvage and why you hurry back.

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
- [ ] **A4 · Planet names should ride the planet.** The name and the word
  INHABITED move around the rim the way a station's words rotate. Bigger
  planets can carry more than one so they are easier to spot.
- [x] **A5 · The wormhole arrow says STATION after the gate is built.**
  *Checked and could not reproduce:* once the gate is built `objectiveTarget`
  returns null, `contacts` empties and no arrow of that kind survives —
  verified in a running game. What Ric actually wants here is the constructive
  half, which is **P1**: after the gate, the arrow should lead to TRACTOR BEAM
  MK1. If a STATION arrow does still turn up, it needs a repro.

## STATION HUD

- [ ] **H1 · A third tab: INVENTORY.** A shrunk inventory page wearing the
  shop's frame — "a browser inside a browser". Specifically:
  - the strip that says SHOP / HANGAR gains INVENTORY
  - where BUY and SELL sit, put the inventory's own tabs — SHIP, CARGO,
    RECORD, CRAFTING, MAP — in the yellow
  - below that, exactly the inventory page as it is now
- [ ] **H2 · Group what a place will not buy.** In SELL, everything marked
  "this place doesn't buy these" moves to the bottom under one heading:
  `NOT PURCHASING TODAY`.
- [ ] **H3 · A WORMHOLE tab.** Appears beside INVENTORY once the manmade
  wormhole is built. It is a map, but *only* for teleporting between stations —
  not the chart page. Free, and any station you have **charted** is a
  destination. You still have to be docked somewhere to make the jump.
- [ ] **H4 · Buying must stop at what you can afford.** The quantity control
  should refuse to climb past your purse. Four cash, the counter stops.

## PARTS

- [~] **P1 · The tractor beam becomes a ladder: MK1 / MK2 / MK3.**
  - [x] MK1 — half the radius of today's base tractor beam (170 units)
  - [x] MK2 — today's tractor beam (340)
  - [x] MK3 — today's HEAVY BEAM, folded into the ladder (544)
  - [x] MK1 is craftable and find-only; MK3 stays bought, as the best of a
        category always is
  - [ ] after the wormhole is built, the arrow that used to say STATION leads
        to TRACTOR BEAM MK1 instead — needs an MK1 *site*, which is the same
        mechanism **P4** wants, so do them together

  *Found while building it:* a category is not exclusive and `mods()` sums
  every effect, so fitting MK1 beside MK3 reached 374 units where MK3 alone
  reaches 544 — the ladder made `reach` the first effect that can be negative.
  Reach is now the best beam fitted rather than the total, and all eight
  combinations are asserted in `test/survey.js`.
- [x] **P2 · Parts spawn too far out.** The manmade-wormhole set — MK1
  included — must all be inside 45,000 units.
- [x] **P3 · A part's hitbox is the outer ring, not the triangle.** Picking one
  up should not require threading the middle of it.
- [ ] **P4 · Scatter the buyable parts too.** The ones you can buy or sell
  should also be findable out there, the way the wormhole parts are — but very
  hard to find.

## SETTINGS

- [x] **C1 · Mouse control.** The ship follows the pointer and click fires. It
  turns at the hull's own rotation rate — no snapping, no free aim.
- [x] **C2 · Pick your input.** Mouse-and-keyboard or touchscreen, chosen
  rather than sniffed, for people on touchscreen laptops.
- [x] **C3 · Rebuild the settings page.** Better looking, better organised.

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

## Notes to self

- Several of these are the same bug class this mode has shipped before: a list
  of names kept in step by hand (B4, B8, A5). Prefer asking the object what it
  is over maintaining a table.
- A3 (the Vault) is the biggest single item here and is really four bugs in a
  trench coat. Break it down before starting.
- H1 is a page inside a page; check how `marketPage` and `drawInventory` can
  share rather than fork.
