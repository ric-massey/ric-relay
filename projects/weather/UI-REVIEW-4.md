# Weather Pro — UI review, round four (2026-10-24)

> Ric (2026-10-24): "Can you look at weather pros ui and lmk what else needs
> to be done?", then "When your done…" — the fixes below are built (README.md,
> "Round four"). Rounds one to three are `UI-REVIEW.md`, `-2.md`, `-3.md`.

Method: every kind of map, menu and sheet driven in headless Chrome at
1440×900 and 375×812 (touch), measuring tap targets, overflow and type size.
The session's network blocked the weather hosts, so this round saw the
controls and layout, not the data on the map.

## Found and fixed

- [x] The first-visit hint (round three) broke into columns — one word a line
      on a phone — and sat on the map's notices.
- [x] The top bar's controls were 32px on a touch screen too; the room's rule
      is 44px for a finger.
- [x] On a phone, a lone ← between the place and the workspace said nothing;
      it leads the first row now, beside the wordmark.
- [x] An empty Find looked random (sorted by name length); it opens on recent
      picks, then the index in order.
- [x] Active said "Enter or a click goes there" with nothing to go to.

## Then, the same day (README.md, "Round five")

- [x] Clutter filtering on the single radar's reflectivity.
- [x] Terrain under the map, its height in the readout, the real ground in
      the cross-section.
- [x] Capitals on the map's kinds only; the rooms button as bars; the loop's
      speed and rest behind one button; the legend's map-lines line only when
      they are off.

## Looked at and left

- The ⋯ menu on a phone opens over the map's + button: it is a menu, open
  only while it is being used.
- The Future map's line of prose above the map is Info's, shown only while
  Info is open — not a leftover from round one.
- **US** beside the place is not a duplicate: it fits the map back to the
  country after a pan, with or without a place.
- The readouts drawer stays open by default from 1200 px: the national
  warnings list is in it.
- The zoom ghost stays soft for up to 2.5 s when tiles do not arrive; that is
  its cap, by design (round two).
