# Weather Pro — UI review, round two (2026-10-24)

> Ric (2026-10-24): "presets for more professions i guess lol or looking for
> more ui improvements... ui is how they use this tool and navigate the
> information so it is extremely important it is an enjoyable experience."
> Round one (`UI-REVIEW.md`) is all built. Ric (2026-10-24): "do all 7. then do
> another look for more. then do those." When a
> piece ships, move it into `README.md` → "Built so far" and tick it below.

Method: round one compared Pro's screens with other programs. This round uses
it — first visit, a chaser following a storm, a forecaster's morning, the
phone — and times it (headless Chrome, this Mac, a fast connection, so a
phone on mobile data will feel everything here more).

## What the measurements said

- **First visit:** 1.2 MB over 250 requests; 550 KB of it JavaScript, and
  `app.js` alone 375 KB. Every decoder (radar, Level II, GRIB, satellite,
  lightning, MRMS) loads before the first frame, though a visitor starts on
  the mosaic.
- **Switching kinds:** single radar 1.2 s, velocity 0.3 s, MRMS 0.8 s, models
  0.8 s, mosaic 1.1 s, satellite 4.4 s (with no sign of progress but a hollow
  tick).
- **The first number a visitor reads is an alarm:** the loop starts playing
  on load, so the legend says "observed 11:30 PM · 47 min ago" as the oldest
  frame comes round — a feed that looks stale when it is not.
- **37 buttons** on the first screen, all the same weight.

## Ranked: what would make it most enjoyable

### 1. The map should feel like a map (the big one)
There is **no scroll-wheel, trackpad or pinch zoom.** Zoom is the ± buttons,
a double-click or the keys; each is a whole level at once, around the middle
of the map rather than where you are looking, and it **clears the map and
redraws from blank**, so every zoom flashes. Every map people know — Apple
Maps, Google Maps, RadarScope, Windy — zooms smoothly toward the cursor or
between the fingers and keeps the old picture on screen, scaled, until the
sharper one arrives. (From memory; this is what those apps do, not a source.)
For Pro that means:
- wheel and trackpad zoom toward the cursor, pinch-zoom on touch, double-click
  and double-tap toward the point;
- an animated zoom — the layers scaled with a CSS transform while it moves,
  then redrawn sharp at the new level;
- never a blank frame: the old tiles and paint stay until the new ones land;
- the same in a panel, and the shared place following the gesture, not just
  its end.
This touches the map's core (`R.z` is an integer and every painter assumes
it), so it is the biggest piece here — and the one a visitor feels on every
single interaction.

### 2. Time that does not alarm
- **Open on the newest frame**, the loop starting from there after a pause,
  so the first thing read is "2 min ago".
- **While the loop plays, the legend says the loop, not each frame:** "loop
  11:30 PM–12:15 AM · newest 2 min ago", and the frame's own time rides on the
  timeline's cursor (it already does). Stopped, it says the frame, as now.

### 3. Go straight to the weather — an "Active" list
Chasers and forecasters start from *where is it happening*. Today that is
spread across the warnings card, the watches overlay and storm cells you have
to turn on. One **Active** button (and a key): SPC mesoscale discussions,
watches, warnings and the strongest storm cells in the country, newest first,
each one click from being on screen — zoomed to it, on the nearest radar,
SRV for a tornado warning, reflectivity for a severe one. RadarScope and
RadarOmega lead with exactly this (storm tracks, warnings lists).

### 4. A right-click / long-press menu on the map
Tapping the map gives a pin with "Forecast here" and "Sounding here". Pros
expect the map's own menu (GR and AWIPS are driven by it): **Nearest radar
here** (reflectivity · velocity · SRV), **Sounding here**, **Cross-section
from here**, **Chart here**, **Copy the coordinates**, **Centre here**.

### 5. Presets by task, not by profession
`WORKSTATION.md` said "no more presets until these are tried", and the
advice behind it still holds: don't try to be ForeFlight. But a preset is
cheap, and the useful axis is the *weather*, not the job:
- **Winter storm** — precipitation type, snow totals, 850 mb temperature,
  the sounding;
- **Tropical** — the tropics overlay, GOES water vapour, MSLP and winds, the
  NHC cone;
- **Fire weather** — wind and gusts, dew point, relative humidity, lightning;
- **Flying (general aviation)** — ceilings and visibility from the stations,
  winds aloft, lightning, the radar — labelled plainly as not a briefing;
- **Morning briefing** — the outlook, the discussion, the models compared.
Existing: Default, Forecast Analysis, Severe Weather.

### 6. Load less, sooner
Load each decoder when its kind is first chosen (a script tag added on
demand — no build step), so the first screen needs `app.js`, `wx.js` and the
mosaic, not 550 KB. And show progress on the slow ones: satellite's 4.4 s
should say "decoding GOES · 3 of 6" on its legend line.

### 7. Quieter controls
All 37 buttons look equally important. Give the kinds (the strip) full
weight, the tools (Replay, Overlays, Info, Find) a lighter one, and the page
settings in the bar lighter again; let the colour key, legend and controls
fade a little while the pointer is over the data, the way video players get
out of the way. Hierarchy, not fewer features.

## Suggested order

1 first — it is felt on every gesture and nothing else here makes as much
difference. Then 2 (small), 3 and 4 together (they share "go to a place on
the right radar"), 5, 6, 7.

## Checklist

- [x] 1 the map feels like a map: wheel/pinch zoom to the point, animated, no blank (2026-10-24)
- [x] 2 time that does not alarm: open on newest, the legend says the loop (2026-10-24)
- [x] 3 Active: the country's storms, one click each (2026-10-24)
- [x] 4 the map's own menu (right-click / long-press) (2026-10-24)
- [x] 5 presets by task (2026-10-24)
- [ ] 6 load decoders on demand; progress on slow loads
- [ ] 7 quieter controls
