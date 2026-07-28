# Starfield — State of Play

> **Status:** Living document. Rewritten whenever a gap opens or closes.<br>
> **Last measured:** 2026-07-28, by flying the game and reading the code.<br>
> **Purpose:** the honest distance between what these documents promise and what the
> game does — and the parity list that `OPEN-017` asks for.

## 1. Why this document exists

The other documents describe a **target**. [`IMPLEMENTATION_AUDIT.md`](IMPLEMENTATION_AUDIT.md)
describes the **old prototype**. Neither describes what the game currently *is*, and
without that the honest question — *what needs to be done?* — has no answer you can act on.

Two rules for this file, because a status document that flatters is worse than none:

- **Nothing is listed as done unless it was observed working.** Every "done" below was
  either flown in the browser or is covered by a test that measures behaviour.
- **Where a readout or a document claims something the code does not do, that is a
  defect, not a gap.** It goes in §5 and it outranks new features.

## 2. There are two games, and that is the headline

| | `fly.html` | `slice.html` |
|---|---|---|
| Title | "a relativistic rocket" | "the Earth–Moon slice" |
| Code | flat `src/*.js`, 5 745 lines | `src/simulation`, `src/application`, `src/presentation`, `src/data` — 11 686 lines |
| Speed control | six gears | five travel modes |
| Reach | the whole galaxy | **Earth, Moon and Sun. Nothing else.** |
| Tests | none | 140 |

Ric, 2026-07-28: *"I essentially want both put together… I want there to only be one
game. fly is a better representation of what I want while slice has most of the features I
want. slice is better for close to planets and stars, but fly is better at the entire
galaxy."*

That is the already-written plan, not a new direction — Bible §19 audits the prototype
into *preserve* and *redesign* tables, and the 2026-07-26 decision record says there is to
be exactly one game once the new architecture reaches parity. **`slice.html` is the spine;
`fly.html`'s reach is what gets ported into it.**

## 3. What the game actually does today

Observed working, in `slice.html`:

- **Time and place.** Real UTC, real ephemerides for Earth, Moon and Sun, reference
  frames with ω × r, floating origin, real scale and real lighting.
- **The station.** The ISS at its real orbit; approach, proximity zones, docking-scale
  work, collision and warnings.
- **Flight.** One ship (the assisted/direct split was deleted 2026-07-28). Five travel
  modes named for places, a throttle that is a speed you hold, a 1.2 s drive spool, and a
  proximity governor that measures clearance *forwards*.
- **The sky.** 9 146 naked-eye stars from the Bright Star Catalogue, the Milky Way as a
  calibrated galactic-coordinate panorama, the planets as correctly-placed points of
  light, and near-instant dark adaptation.
- **Surfaces.** Three cockpit presets, a star map as a primary surface, a sources panel
  and the honesty ledger.
- **Navigation.** Route planning and an autopilot that commands acceleration the way the
  player's hands do.

## 4. Parity list — what `fly.html` still has that `slice.html` does not

This is the answer `OPEN-017` was waiting for. **The prototype may not be retired until
every line here is closed.**

| # | Capability | Where it lives now | Blocked on |
|---|---|---|---|
| ~~P1~~ | ~~**Stars as places you can fly to**~~ | **Done 2026-07-28** | — |
| P2 | **The galaxy as a structure** — arms, bulge, and galaxies that resolve into stars as you approach | `galaxy.js` (280 lines) | nothing |
| P3 | **Planetary systems at other stars**, moving on Kepler's third law | `systems.js` (406 lines) | nothing |
| P4 | **Black holes** — Schwarzschild radius, photon sphere, ISCO, the EHT shadow | `blackhole.js` (192 lines) | P2 |
| P5 | **Relativistic visuals** — aberration, Doppler, beaming | `relativity.js` (368 lines) | §5.2 |
| P6 | **A reachable relativistic regime** | gear 2, to 0.99 c | §5.2 |
| P7 | **Procedural audio** | `audio.js` (154 lines) | nothing |
| P8 | **Collision detail and loss reports** | `game.js` | Bible §19.2 wants these rebuilt against real-scale geometry |

Bible §19.2 marks several prototype behaviours **redesign, not port** — enlarged bodies,
systems that spawn near the flight path, and relativity framed as the whole game. Porting
those as-is would carry the conflicts across, which is the second bad outcome the
Implementation Audit was written to prevent.

## 5. Defects — where the game contradicts the documents

These outrank §4. A game that says something untrue is worse than a game that is small.

### 5.1 The sky is a backdrop, and the code says so

`sky-view.js` draws stars **with the camera's rotation only and no translation**, on a
shell at 10⁹ m. Flown to 1.69 Mly from Earth, the sky is pixel-identical to the view from
low orbit. Its own header calls this out: the shell *"goes away in Phase 4, when the stars
get their real distances and become places you can fly to."*

Ric's framing, and the reason this is first: *"you can fly to the stars that you see so
they don't feel like they were just put on a wallpaper and you can never reach them."*

**Closed 2026-07-28.** Two changes. The catalogue was rebuilt and now carries parallax —
**3 157 of 9 146 stars have real distances**, up from 100. Then `SkyView.setObserver` was
added: it recomputes apparent direction and apparent magnitude from each star's true range
whenever the ship moves, so flying at a star approaches it. Sirius brightens from
magnitude −1.46 to −6.46 across 90% of its 8.6 ly, and a light-year of sideways travel
shifts it 6.4° — thirteen Moon-widths of real parallax.

The shell stays as a *rendering* device rather than a claim: real ranges span 10¹⁶ to
10²⁰ m against a ship at 10⁷, which no float32 depth buffer holds. But a star is an
unresolved point, so direction and brightness are all an eye can extract — and both are
computed exactly from the true range. Measured cost: 0.66 ms/frame while recomputing, and
zero inside the Earth–Moon volume.

**What is still a backdrop:** the 5 989 stars with no measured parallax do not move, and
must not — inventing a distance to make them slide would fabricate an observation. The BSC
is a 1991 catalogue that predates Hipparcos. **Gaia DR3 is the upgrade path** and has not
yet been chosen.

### 5.2 There is no relativity, in a game whose prototype was about relativity

`TimeService.step` has always taken a Lorentz factor. Until 2026-07-28 **nothing ever
passed one**, so the two clocks were identical by construction while the HUD said *"clocks
agree — you are not going fast enough to separate them"* at any speed at all, including
several trillion c. That is a readout asserting a physical reason for something that was
simply unimplemented, and it sat in the one part of the game that is about relativity.

**Fixed:** γ is now computed and applied every sub-step, exactly below light and 1 above it
by declared fiction, and the HUD names the regime instead of inventing a reason. Pinned by
three tests.

**Still open, and this is Ric's *"when moving at speeds it must look like how it would in
real life"*:**

- **No aberration, Doppler or beaming.** The sky looks the same at 0.9 c as at rest.
- **No reachable relativistic regime.** The ladder goes 0.01 c (System) straight to
  superluminal. There is no mode that flies at a good fraction of light, so the visually
  spectacular honest regime — the one Bible §19.1 says to *preserve as the sublight
  relativistic regime* — cannot be entered at all. **The clocks now separate correctly and
  no mode can make them do it.** Fixing P5 without P6 would be building a view nobody can
  reach.

### 5.3 Everything visible is meant to be reachable; most of it is not

The Design Bible's promise is that what you can see, you can go to. Today the only bodies
with real geometry are Earth, the Moon and the Sun. The other seven planets are computed
from JPL elements and drawn as points of light — **you can see Venus and you cannot fly to
it.**

## 6. What to do next, in order

1. ~~**Stars become places**~~ — done 2026-07-28.
2. **Decide the Gaia question.** Whether to lift the remaining 65% from Gaia DR3 changes
   how much of the sky becomes real. Ric's call; not yet asked.
3. **A relativistic regime you can fly** (P6), then the visuals (P5). In that order — the
   view has to be reachable before it is worth rendering.
4. **The galaxy** (P2), then systems (P3), then black holes (P4).
5. **Retire `fly.html`** once §4 is empty, per `OPEN-017`.

## 7. Housekeeping done 2026-07-28

- `projects/starfield-current.zip` (2.6 MB) → `_project-originals/`, which is where this
  repository's own `.gitignore` says source archives go.
- `docs/UI:cockpit visuals /` → `docs/cockpit-reference/`. The old name contained a colon
  and a trailing space: invalid on Windows, awkward in a URL, and requiring quotes in
  every shell command that touched it.
- The raw `bsc5.dat` is kept in `_project-originals/` rather than under `projects/`. That
  tree is the deployed site, and 1.6 MB of fixed-width text nobody fetches would be served
  to every visitor forever. The builder header carries the one-line command that
  regenerates it.
- The catalogue builder **hard-coded its retrieval date** in two places, so every rebuild
  re-asserted a date that was true once. It now stamps the source file's mtime.

## 8. Known and not yet addressed

- The whole new architecture is **untracked in git** — 11 686 lines with no history.
- Console preset on a phone still overlaps the hint line with the corner cluster.
- Ric reports lag that has not been reproduced: measured at 0.14–0.31 ms/frame on the CPU
  and 3.31 ms/frame for 14.75 megapixels on the GPU. Cause unknown; needs a description of
  the symptom.
