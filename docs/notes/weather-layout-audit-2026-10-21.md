# Weather room — layout audit (2026-10-21)

Looked at `weather.html` in the browser at desktop width (800px pane) and at 375px
(a phone), for Knoxville at night, Denver at night, and the no-place US view with a live
severe thunderstorm warning. The yardstick is the plan's own: "simple first",
"see → tap → investigate", and "the map is the primary spatial workspace" (DESIGN.md
§3, §5, §10). The page already holds the site rules: nothing overflows sideways at
375px, no type under 11px, 44px tap targets, every colour that carries words at
4.5:1 or better.

## The order of the page

Today, on a phone: hero → next 3 hours → ride → hourly → 10 days → compare models →
how accurate → **radar (8th)** → the air above → seven detail tiles → sources.

- **The radar is too far down.** On a phone it is about four screens below the top,
  behind two cards most people never open (model comparison, accuracy). Radar is the
  second thing people open a weather app for. **Fix:** radar straight after the 10-day
  forecast; the model comparison and the accuracy record move below "the air above
  you", with the other deep cards.
- The hero, the rain line and the ride card at the top are right: they answer "what do
  I need to know right now" in the first screen and a half.

## The map

- **It is a thumbnail.** 340px tall (300 on a phone) inside an 820px column. On a laptop
  most of the screen is sky gradient beside it. **Fix:** a full-screen button in the
  map's zoom stack (and Esc to leave), which turns the radar card into the whole
  window, with the controls and the time bar kept; and a taller map (420px) on wide
  screens.
- **Five rows of buttons on a phone.** The layer buttons (US mosaic, Reflectivity,
  Velocity, SPC outlook) and the satellite row (Off, Infrared, Visible, Water vapour)
  wrap into five rows above the map, pushing the map below the fold. **Fix:** each row
  stays one line and scrolls sideways on narrow screens, so it is two rows.
- **Tapping the map does nothing.** Dragging pans, double-tap zooms, and a single tap is
  wasted. **Fix:** a single tap opens a point card (see the plan audit).
- **Infrared colours fought the radar** — fixed during the bug check (satellite in grey).
- The sentence under the controls grows long with satellite on (two sentences of
  description). Acceptable; it is the room's provenance rule at work.

## Cards

- **Detail tiles stack one per row on a phone.** Wind, humidity, pressure, visibility,
  UV and sun are six full-width cards of about 110px each — over a screen and a half of
  scrolling for six numbers. **Fix:** keep them two to a row down to phone width, with
  a smaller wind dial.
- **Ride card:** on a phone the hour buttons wrap to their own line, pushed to the
  right. **Fix:** let them sit left under the badge when they wrap.
- **Accuracy card:** the national line is set at the body size (15px) while every other
  footnote in the card is 13px. **Fix:** same footnote style.
- **Hourly strip:** temperature, sky and rain chance only. §9.1 asks for wind and gusts
  in the hourly view. **Fix:** a small wind line under each hour (speed, with the gust
  when it is 10 mph or more above).
- **Next 3 hours:** with the radar line, the model line and two bar strips it is the
  tallest card in the first screen. Fine while the bars carry rain; when everything is
  dry the empty model bars add nothing. Left for now — it is honest, and the bars
  become the point the moment rain is near.
- **The 10-day list** is clean. The confidence dots have no legend on the row itself
  (the explanation is in each day's details). Left: the plan says the daily view stays
  clean (§9.2).
- **The sources card** is long (8–10 rows). It belongs at the bottom, where it is.

## Small things

- The hero says "Wind calm" with no gust line when the station is calm — right.
- The place chip ellipsises long names well at 375px.
- `.card` uses `backdrop-filter`; while scrolling fast, a screenshot can catch cards
  before they paint. Not seen by eye, so not changed.

## Fixed in this pass

Radar moved up · full-screen map with Esc and a taller desktop map · control rows that
scroll instead of wrap · two-up detail tiles on phones · ride buttons that wrap left ·
accuracy footnote size · wind in the hourly strip · tap-a-point card on the map.
