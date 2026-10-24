# Weather Pro — UI review, round three (2026-10-24)

> Ric (2026-10-24): "do all 7. then do another look for more. then do those."
> Rounds one and two are built (`UI-REVIEW.md`, `UI-REVIEW-2.md`). This is the
> look after them: the new pieces used together, on a desktop and a phone.
> When a piece ships, tick it below and say it in `README.md`.
>
> **All four are built (2026-10-24)** — README.md, "Round three".

## What the look found

1. **A reload forgets where you were.** Left on Norman at zoom 9, a reload
   came back to the whole country at zoom 5. RadarScope and every map app
   reopen where you left off; a forecaster reloads all day.
2. **Close in, the map is nearly empty.** At zoom 10 around Oklahoma City the
   interstates, Moore, Mustang and Yukon are almost invisible: the base map's
   own labels are sunk so no town is named twice (UI-REVIEW A3), which also
   sinks its roads, and our own place list names only the bigger towns.
   Chasers navigate by roads and small towns, and this is exactly the zoom
   they work at.
3. **Nothing tells a first visitor what the map can do.** The wheel, the
   right-click menu, Active (A) and every key are there, but only the ? sheet
   says so.
4. **The keyboard cannot move the map.** ← → step frames and ± zoom, but
   panning needs a mouse or a finger.

## The fixes

1. **Reopen where you left off** — the main map's view (to 0.1°, kept only in
   this browser, never sent) and its kind of map come back on a reload, unless
   a link, a shared workspace or a newly chosen place says otherwise.
2. **Close in, roads and towns** — from zoom 8 the base map draws with its
   own roads and names at full strength, and our coarser town names step
   aside so nothing is named twice; our state, county and coast lines stay.
3. **A first-visit hint** — one line, once, along the foot of the map: wheel
   or pinch to zoom, right-click or press and hold for the map's menu, A for
   active weather, ? for every key. Dismissed with ×, and gone for good.
4. **Shift + arrows pan the map** by a third of the screen; the arrows alone
   still step frames.

## Checklist

- [x] 1 reopen where you left off (2026-10-24)
- [x] 2 close in, roads and towns (2026-10-24)
- [x] 3 a first-visit hint (2026-10-24)
- [x] 4 shift + arrows pan (2026-10-24)
