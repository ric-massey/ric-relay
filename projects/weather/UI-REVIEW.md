# Weather Pro — UI review, 2026-10-23

> Ric (2026-10-23): "analyze the ui and find ways to make it easier and a more
> pleasant experience … make sure it is good for professionals. Research other
> systems and other programs and how they do it." Nothing here is built yet.
> When a piece ships, move it into `README.md` → "Built so far" and tick it off
> at the bottom. `DESIGN.md` stays the source of truth for the room.
>
> **A and B1–B5 are built (2026-10-23)** — see README.md, "The review's small
> fixes", "The legend and the timeline", "Compare and Trend", "The drawer's
> index, and the sounding large" and "The mode's controls in the toolbar".

Method: every mode of `weather-pro.html` driven in headless Chrome at 1440×900,
1280×800 and 800×600, plus the phone at 369–375 px, with no place and with a place
set; then compared with the tools forecasters and chasers actually use —
AWIPS/CAVE (NWS forecast offices), RadarScope, RadarOmega, GR2Analyst, Pivotal
Weather, the Aviation Weather Center's GFA tool and Windy. Sources at the foot.
Where a claim about another program comes from memory rather than a source, it
says so.

## What Pro already does that the pros do

It is further along than most web tools. The cursor readout (RadarScope's
Inspector), a single radar's full product set and tilts, joined panels on one
place and time (AWIPS panes, RadarScope's multi-pane), saved workspaces
(AWIPS procedures), the keyboard, model contours and barbs, soundings and
hodographs, replay of famous days, and every number with its source and age.
So the work below is mostly **organising what is there**, not adding data.

## A. Broken or rough now (small, fix first)

1. **Find's box runs off its sheet.** The search field is wider than the dialog
   and the hint under the list is cut off ("↑ ↓ to choo…").
2. **"After the shared time" with one map.** Alone, the map's stamp says
   "1 h after the shared time" / "47 min after the shared time". There is nothing
   to share with; it should read "observed 10:32 PM · 3 min ago", and talk about
   the shared time only when another map is open (the clock in the bar already
   does this).
3. **Every town is named twice.** The OpenStreetMap tiles carry their own labels
   under the Natural Earth labels drawn on top: "Oklahoma City" over a faint
   "Oklahoma City", "Wichita" twice, "Denton" twice. Pros want the data to win and
   the map to stay quiet. Either dim the tiles much further in Pro or use
   label-free tiles (a new tile host is Ric's call — it's a new external request).
4. **The forecast discussion breaks mid-sentence.** It keeps the NWS's fixed
   line wraps ("today, with a / pronounced long wave trough…"). Join wrapped lines
   inside a paragraph — same words, same order, nothing rewritten — and keep the
   original as the link.
5. **Mesoanalysis opens on "National"** even with a place set. Start it on the
   place's SPC sector.
6. **Satellite infrared is scaled in °F** (−112 to 68). Every satellite tool
   pros use reads brightness temperature in °C; show °C in Pro whatever the
   units button says (or label both).
7. **Two map labels collide**: "SVR 696" and "MPD 1519" draw on top of each
   other where a watch and a discussion share a corner. Nudge the second label
   away.
8. **Phone:** the source line on the map stops before the time ("US mosaic (I…"),
   and the map's control sheet opens at the top rather than rising from the
   bottom as its own comments say it should.
9. **The drawer's warnings heading crowds its source** ("WARNINGS ACROSS THE
   US" wraps into "NWS · tap one to see it on the radar").

## B. The patterns worth taking (ranked by what they'd give a pro)

### 1. One product legend, not three time stamps — from AWIPS
Today the time of what's on the map is said in three places: the stamp at the
top left, an info line in the mode's own row ("HRRR run 01Z … 19 hours out so
far"), and the corner under the clock ("HRRR 01Z +2 h"). In AWIPS D2D the
**product legend** in the lower right lists every product drawn — name and
date/time — and clicking an entry toggles it. Do the same: one legend on the
map, one line per layer (base data, the satellite under it, each overlay),
each with its valid/observed time and age, coloured when stale; click a line to
hide or show it. It replaces the stamp, the info line and Info's band, and it
answers the question pros ask most — *what am I looking at, and how old is it* —
in one place.

### 2. A timeline that tells time — from Windy and the GFA tool
The slider has no ticks and no times on it: "3/19" tells you the frame, not the
moment. Windy's timeline carries the date and time on its draggable cursor, and
AWC's GFA tool runs everything off one "Display Time" slider. So: a tick per
frame, hour labels along the bar (Z or local, following the UTC button), the
time on the cursor itself, frames that have not loaded drawn hollow, and for a
model the forecast hour as `F000 … F048` (Pivotal's hour buttons) with the run
beside it. Loading is shown on the bar, not as the word "loading" in the corner.

### 3. Compare models and model trend — from Pivotal Weather
Pivotal's two most-used modes after the plain loop are **Compare Models** (every
model's latest run at the *same valid time*) and **Model Trend** (successive
runs of one model for one valid time — is it trending wetter, further north?).
Pro already has the machinery: up to four maps beside the main one on one
shared time. Add two buttons in the Models row: **Compare** opens HRRR, NAM 3 km,
GFS and ECMWF on the current field at the current valid time; **Trend** opens the
last four runs of the current model. That turns panels from a layout tool into
an analysis tool, which is the pitch in `WORKSTATION.md`.

### 4. A drawer you can navigate — from AWIPS's tool windows and SHARPpy
With a place set the readouts are one 4,500 px scroll (the sounding block alone
is ~2,000 px). Give the drawer a rail of tabs along its top — NOW · SOUNDING ·
DISCUSSION · MESO · MODELS · RECORD — that jump to (or show only) that card, and
remember the last one. And let the **sounding pop out** to a large panel:
forecasters read skew-Ts full window (NSHARP in AWIPS, SHARPpy); a 440 px column
squeezes the hodograph and the parameter table under each other. (SHARPpy/NSHARP
layout from memory, not a source.)

### 5. The mode's controls in the toolbar, not a bar of their own
Choosing Models, Satellite, MRMS or Replay adds a whole band above the map (model,
field, run, plus an info line), so the map starts 80 px lower in exactly the
modes where you're comparing details. On a wide screen those three selects fit in
the toolbar row after the mode strip; the info line goes to the legend (B1).
Replay's notable days can sit in a menu off its date field.

### 6. Pro units — from every pro tool
Wind barbs are already in knots. Make it a set: a **Pro units** switch (kt,
°C, hPa, Z) separate from the everyday °F / mph, defaulting on in Pro.
Satellite and soundings in °C regardless (A6).

### 7. Colour tables you can pick — from GR2Analyst and RadarScope
Chasers argue about reflectivity and velocity palettes, and GR2Analyst and
RadarScope both let you swap them (from memory; GR's colour-table files are well
known). Offer two or three per product — the NWS standard, a high-contrast one,
a colour-blind-safe one — chosen in the legend's line for that layer.

### 8. Quiet map, loud data
Beyond the doubled labels (A3): a label-density step (none / cities / towns) and
a map-line brightness slider, separate from the data opacity, the way GR lets
each placefile draw above or below the radar. The data opacity slider exists;
the map has no equivalent.

### 9. Pleasantness
- **Empty layers say so.** MRMS rotation tracks on a quiet night is a blank map;
  say "nothing above 0.006 s⁻¹ in the last hour" over it.
- **Hover on everything a pro can click**: legend lines, timeline ticks, warning
  polygons (event, until, and "click for text").
- **Remember the last mode and field per workspace** — it already does for the
  layer; extend it to the model field and the satellite product.

## C. What not to copy

- **3D volume rendering** (GR2Analyst, RadarOmega's 3D): heavy, and no pro
  decision on this page needs it before the items above.
- **More professions' workspaces** — `WORKSTATION.md` already says: no more
  presets until the three are tried with the storm-chaser friend.
- **A verdict.** Everything here informs; nothing says go or no-go (the room's
  rule).

## Suggested order

A1–A9 in one pass (each is small). Then B1 (legend) and B2 (timeline) together —
they share the "what time is this" plumbing. Then B3 (compare/trend), B4 (drawer
rail + sounding pop-out), B5. B6–B9 as they fit.

## Checklist

- [x] A. the nine fixes (2026-10-23)
- [x] B1 product legend (2026-10-23)
- [x] B2 timeline with ticks, times and F-hours (2026-10-23)
- [x] B3 Compare and Trend (2026-10-23)
- [x] B4 drawer rail, sounding pop-out (2026-10-23)
- [x] B5 mode controls into the toolbar (2026-10-23)
- [ ] B6 Pro units
- [ ] B7 colour tables
- [ ] B8 label density, map brightness
- [ ] B9 empty layers, hovers, remembered fields

## Sources

- AWIPS product legend and toggling: NOAA OCLO, [Toggling Product Displays](https://vlab.noaa.gov/web/oclo/-/toggling-product-displays); NWS Raleigh, [AWIPS familiarization handout](https://www.weather.gov/media/rah/NCStateStudents/2019_handout.AWIPS.Familiarization.doc.pdf); OCLO, [Using the Distance Speed Tool](https://vlab.noaa.gov/web/oclo/-/using-the-distance-speed-tool)
- Pivotal Weather modes (Compare Models, Model Trend, hour links): [Map Animations guide](https://home.pivotalweather.com/guides/animations) (last updated 2020)
- RadarScope Inspector, multi-pane, loop lengths: [App Store listing](https://apps.apple.com/gb/app/id288419283)
- RadarOmega storm tracks and ETAs: [user guide](https://www.scribd.com/document/765218050/RadarOmegaUserGuide), [App Store listing](https://apps.apple.com/gb/app/radaromega/id1439881811)
- GR2Analyst overlays and placefiles drawn above or below the radar: [GR2Analyst Version 2](https://www.grlevelx.com/gr2analyst_2/), [Iowa State GR tutorial](https://meteor.geol.iastate.edu/classes/mt432/lectures/GR_Tutorial_KevinSkow.pdf)
- AWC GFA one Display Time slider, layer radio buttons, altitude slider: [GFA help](https://aviationweather.gov/gfa/help)
- Windy timeline cursor with date and time: [Windy Community — how to display the timeline](https://community.windy.com/topic/25149/how-to-display-the-timeline)
