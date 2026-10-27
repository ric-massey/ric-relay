# Weather Pro — lag and polish audit, 2026-10-27

Ric asked for a polish audit of `weather-pro.html` and where it might lag.
Measured in Chromium (the desktop app's browser pane, shown, so timings are
real) with the JS Self-Profiling API and long-animation-frame entries, place
set to a large city by name, at 1400×850 and at 375×812. The profiling server
was a scratch file outside the repo; nothing here needed a code change to
measure.

## Status (same day)

Done: radar bzip2 runs in a Web Worker (lag 1; turning Full volume on went
from ~6.6 s of main-thread work to one 73 ms frame, and two side maps from
~5.7 s of blocking to 140 ms); `Wx.clock` keeps one clock per zone (lag 3);
timeline labels that would overlap are dropped (polish 1); on a phone the
credits are one line beside Layers, tap to open (polish 3), and the stamp
hides its "(NOAA open data on AWS)" so the time shows (polish 4).

Not done: side maps still fetch and decode their own copy of everything
(lag 2 — the worker made it cheap, not shared), the sounding timeline and
the hidden-tab age ticker (lag 4), and side maps on a phone (polish 2).

## Short version

The first view is fine: about a third of a second of real work spread over
twenty seconds, no frame over ~215 ms. Panning, zooming and playing the loop
are smooth (worst frame 21 ms while dragging). **The lag is decoding, and it
lands on the main thread:**

1. **Level II full volume** — bzip2 on the main thread, one chunk at a time,
   each chunk one ~120–150 ms freeze. Turning Full volume on the first time
   cost **6.6 s** of main-thread work in one profile.
2. **Extra maps (workstation panels)** multiply it: every panel is a whole
   copy of Pro that fetches and decodes the same files again. Adding a third
   map gave seven back-to-back ~125 ms freezes; two panels at once produced 102
   long frames and ~5.7 s of blocking in 20 s.
3. **`clk()` rebuilds six `Intl.DateTimeFormat`s every call** — 55 call sites.
   During loop playback it was 80 of the 95 ms of script time.

## Lag, worst first

### 1. Level II and Level III are unzipped on the main thread
- `L2.feed()` (`projects/weather/level2.js:127`) calls `Bz.bunzip2()` on every
  record of a chunk synchronously; `volume()` / `loadL2()` in
  `assets/weather/app.js:2254, 2408` call it as each chunk arrives. Profile:
  `bunzip2@bzip2.js:24` self time 6,570 ms of 6,630 ms busy on the first Full
  volume load (six volumes for the loop).
- Level III does the same through `NX.load → parse` (`nexrad.js:490`): ~265 ms
  per switch to Radar.
- **Fix:** a dedicated worker (`projects/weather/decode-worker.js`, plain JS,
  `importScripts` bzip2/level2/nexrad) that takes the `ArrayBuffer`
  (transferred, not copied) and returns the parsed sweep's typed arrays
  (transferred back). No dependency, no build step. The decoders are already
  pure functions held to Python in `test/decoders.test.mjs`, so the worker only
  moves where they run. Keep the main-thread path as the fallback when
  `Worker` is unavailable (a `file://` open).

### 2. Every side map decodes everything again
- A panel is `weather-pro.html?panel=1` in an iframe on the same origin — it
  shares the main thread, so its work is the page's lag. Each one fetches and
  decodes the same Level II volumes, and refreshes on its own 25 s fast-radar
  timer (`app.js:6935`), so with three panels a new scan is decoded four times.
- It also re-asks the same feeds: in one session `/wx/nws/alerts/active` was
  fetched 4×, watches / MDs / MPDs 3× each — once per map.
- **Fix:** with (1) in place, share the decoded file by key (site + volume +
  chunk) through the parent — the workstation already owns the bus between
  maps (`workstation.js` `setBus`). Panels ask the parent before fetching.
  Cheaper first step: let panels skip alerts / watches / MDs entirely and take
  them from the page, since a panel is "only its map".

### 3. `clk()` makes six formatters every call
- `const clk = () => UTC ? Wx.clock("UTC", true) : Wx.clock(tzNow());`
  (`app.js:56`) and `Wx.clock` (`projects/weather/wx.js:1070`) build six
  `Intl.DateTimeFormat`s each time. Called from 55 places, including
  `stampText` / `stamps` (`workstation.js:210, 550`) on every frame step of
  the loop, and `ymd` at `app.js:6994`.
- **Fix:** memoise `Wx.clock` on `(tz, zulu)` — a two-line `Map`. Nothing about
  the result changes, so no test should move.

### 4. Smaller
- **Sounding timeline** (`timeline()` at `app.js:6470`): runs `Snd.analyze` for
  every forecast hour (~48) at once — 110–120 ms, mostly `parcel()`. It is
  cached per column, so it costs once per place. Fine to leave; if it shows,
  analyse lazily or in `requestIdleCallback` batches.
- **Satellite and models** are fine: their decompression goes through
  `DecompressionStream` (off the main thread). The heaviest model step was
  `grib2 unpack` at ~80 ms.
- **The 15 s age ticker** (`app.js:1425`) runs `querySelectorAll("[data-age]")`
  even when the tab is hidden. Cheap, but it could check `document.hidden` like
  the other timers do.

## Polish

1. **Timeline labels overlap on a phone.** At 375 px the scrubber is ~166 px
   wide; `timeline()` asks `WS.timelineMarks(..., Math.floor(W / 110))` = 1
   label, but `timelineMarks` (`workstation.js:258`) floors it at
   `Math.max(2, …)`, so two ~52 px labels ("11:02 PM", "11:16 PM") are drawn
   and overlap by ~22 px. Fix: `Math.max(1, …)` (and keep the test at
   `test/workstation.test.mjs:93–108` passing), or hide the second label when
   the two boxes intersect.
2. **Side maps on a phone squash the main map.** With three extra maps the main
   map was ~60 px tall and the panels stacked below it at ~90 px each —
   against Pro's own rule that the map fills the window. On narrow screens,
   show one map at a time with a switcher, or refuse to add a panel under
   ~700 px wide and say why.
3. **Map credits collide at phone width.** The credit line wraps to two lines,
   runs under the "Radar · VEL" layers button, and its second line ("Natural
   Earth") sits on top of the scrubber's time bubble. Keep it to one line
   (shorten to "© OSM · IEM · NOAA · NE" with the long form behind a tap) or
   lift it above the layers button.
4. **The stamp on the map is long on a phone** ("INX velocity, Level II full
   volume (NOAA open data on AWS) · observed …") — two lines over the top of
   the map, and the observed time is cut off with an ellipsis, which is the
   part that matters. Put the time first.

## Checked and fine
- No console errors besides the expected local 404s (`/wx/*` and `/hit` are
  Worker routes, absent from a static server — AGENTS.md says so).
- No text under 11 px on screen at 375 px; no sideways page scroll.
- Loop playback holds 60 fps; pan and wheel-zoom stay under 21 ms a frame.
