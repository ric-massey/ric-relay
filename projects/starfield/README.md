# Starfield

> **Project status:** two things live here. **[`slice.html`](slice.html)** is the new
> architecture — Slices A and B of the Earth–Moon vertical slice, built to the design
> documents. **[`fly.html`](fly.html)** is the original relativistic-flight prototype,
> still playable and untouched. The prototype is research; the slice is the game.

For the design, begin with the [documentation index](docs/README.md) and the
[Starfield Design Bible](docs/DESIGN_BIBLE.md).

---

## The Earth–Moon slice — `slice.html`

**Slices A and B** ([spec §17](docs/EARTH_MOON_VERTICAL_SLICE.md)). Earth, the Moon
and the Sun at real scale, at the real current date and time — and a ship you fly,
station-keeping 260 m behind a recognisable ISS on a real low orbit.

Slice A proved the frames, the scale and the honesty surfaces before anything was
built on them. Slice B puts a ship in that world: six-degree-of-freedom thrust against
real gravity, assisted flight that closes a loop on velocity in whichever frame you
are actually in, direct inertial flight for anyone who wants it, and a precision mode
that makes centimetres per second reachable. Nothing about the world was softened to
make the flying work.

**Fly it:** `W` and `S` set the speed you want and the ship holds it — let go and it keeps
going, which is the whole point. `A` `D` `Space` `Ctrl` nudge sideways and vertically,
`X` stops dead, `Z` is fine control, `B` matches velocity with your target, `N` swaps
assisted for direct. `1`–`5` pick the travel mode, from Local to Intergalactic. The mouse
or the arrow keys aim; `Tab` opens the map, and `H` lists the rest, generated from the
live key mapping so it cannot go stale.

```bash
node tools/dev-server.mjs . 8642     # then open /projects/starfield/slice.html
```

It needs a server rather than `file://` because it uses ES modules. Nothing is fetched
at runtime: Three.js is vendored in `vendor/`, every texture is in `assets/`, and the
ephemerides are computed in the browser.

**Use that server rather than `python3 -m http.server`, and it matters.** Python's sends
`Last-Modified` and no `Cache-Control`, so the browser applies heuristic freshness — and
for ES modules a stale hit means the page runs *old code* through reloads, through hard
reloads, and through a changed query string on the HTML, because the imports inside it
resolve to the same unchanged URLs either way. It does not present as a caching problem.
It presents as your change not working, with a passing test suite and a browser calmly
demonstrating the old behaviour. `tools/dev-server.mjs` sends `no-store`.

One thing it cannot fix: the browser keeps its cache **per origin**, so a port that was
previously served by the Python server keeps serving poisoned modules until those entries
age out. Move to a fresh port if a change stubbornly refuses to appear.

### What is real in it

| | |
|---|---|
| **Positions** | Sun and Moon from the Meeus analytic series (ELP-2000/82 truncation), matching the published worked examples to the last printed digit. The Moon lands within ~20 km of truth. The eight planets from JPL's approximate Keplerian elements, good to about an arcminute — which is roughly what an eye resolves, and they are unresolved points from here anyway. |
| **Scale** | Earth 6 378 137 m, Moon 1 737 400 m, separation whatever the ephemeris says. Nothing is enlarged; markers are what make small things clickable. |
| **Frames** | Earth-centred inertial, Earth-fixed, Moon-centred, Moon-fixed, Sun-centred, the observation point and the station's local orbital frame, with full position **and velocity** transforms. The ω × r term matters: without it a ship holding station perfectly reads as drifting. |
| **Precision** | A floating render origin, because Three renders in float32 and that resolves to 30 m at the Moon's distance. |
| **Sky** | The Yale Bright Star Catalogue — 9 096 stars, complete to about magnitude 6.5, which is very nearly the exact set a dark-adapted eye can see, plus the planets, which are the brightest things in it after the Sun and Moon. Colour comes from measured B−V, not from a spectral-class guess. The Milky Way is ESO's all-sky panorama, desaturated to the silver-grey an eye actually sees. Brightness is compressed to fit a display's range (ledger SF-L-021) — ordering is exact, spacing is not. |
| **The eye** | Adaptation is a state with memory, driven by what is in view: how much of it, how bright, and *where* — light at the edge of vision counts for less than light you are looking at, and a bright source just outside the frame still scatters inside the eye. Look at a sunlit Earth and the stars go, because that is what happens. The clock is compressed about 4 000× (SF-L-011); the shape and the asymmetry are real. |
| **Light** | Rayleigh single scattering with the real 1/λ⁴ coefficients; Lommel-Seeliger regolith on the Moon; earthshine; a dark-adaptation model with the eye's real asymmetric time constants. |
| **Gravity** | Earth as a point mass plus J₂ oblateness, plus the Moon and the Sun as third bodies with their indirect terms, integrated by RK4. Over a full revolution the semi-major axis holds to two metres, and halving the step changes the answer by under two millimetres. |
| **Flight** | Assisted mode closes a loop on velocity in the frame you are actually in, so holding position next to something in orbit costs real, continuously varying thrust — and the HUD shows it. The throttle is a speed the ship *holds*, and the commanded velocity points where the nose points; direct mode closes no loop at all and is inertial. "Stop" always names what it is stopping relative to, because next to the station that means the station and further out it means Earth's centre, and you will still be doing 7.66 km/s when it finishes. |
| **Honesty** | Every approximation is in the in-game ledger ("where we cheat"), and every source says what it gave us and which instrument measured it. |

### What is not there yet

The ISS itself (a representative orbit stands in — see ledger SF-L-008), clouds on Earth,
terrain streaming, and lunar landing. Routes to the planets and the stars can be planned
and previewed but not yet *completed* — nothing flies you all the way to Jupiter and stops.

The sky and the eye model are calibrated so that everything emits *physical radiance* and
adaptation is applied exactly once, by the tone mapper, per render pass. Star brightness,
the Sun's disc and its glare all derive from the same numbers the adaptation model uses —
so none of them can disagree about how bright something is.

Of the 9 146 stars in the sky, **100 have a measured distance** and can therefore be flown
to; the rest have a direction and no distance, because the 1991 catalogue this sky is built
from did not carry a parallax for them. That is a gap in the data, and the sky says so
rather than inventing distances to fill it. [Data Sources §3.5](docs/DATA_SOURCES.md)
describes what closing it would take.

### Tests

```bash
node projects/starfield/tests/run.mjs
```

131 assertions: Meeus reference cases, frame round-trips, floating-origin invariance,
orbital mechanics, and the provenance schema. The same suites run in a browser at
[`tests/index.html`](tests/index.html).

---

## The original prototype — `fly.html`

The rest of this README describes **what the legacy prototype currently does**, not the
final specification. It remains the reference implementation for relativistic flight
until that work is migrated; see the
[implementation audit](docs/IMPLEMENTATION_AUDIT.md) for the disposition of each file.

The current prototype lets you fly through the **real catalogued** solar
neighbourhood and out into a partly modeled galaxy. The catalogued stars
around you are the actual stars around the Sun, at their catalogued distances and
directions; the Milky Way's band across your sky is its real disk, seen from
26,670 ly out along the real galactic plane. You fly a ship with real momentum
and a six-gear drive whose first two gears are honest relativity — and the
physics does the rest.

It is the playable companion to
[The Geometry of Spacetime](../spacetime/index.html): that project *explains*
light cones, time dilation and aberration; this one lets you fly them.

> **The prototype's scientific commitment:** use real mathematics where the
> experiment claims to model it, and identify the compromises. `SF.K`
> (`src/constants.js`) contains measured or defined constants; `SF.FUDGE`
> contains many of the prototype's scale, drive, protection, and encounter
> adjustments. The in-game **honesty ledger** ("where we cheat") explains the
> largest of them. The redesign expands that idea into a project-wide
> [Scientific Standard](docs/SCIENTIFIC_STANDARD.md).

---

## Two pages

- **`index.html`** — the *how to fly* page: the opening screen / menu that
  explains the premise, the gears, every control, and what each readout means.
  This is the entry point `/exploration` links to.
- **`fly.html`** — the game itself. Its "← how to fly" link returns to the menu.

---

## Running it

Plain, dependency-free, deferred classic scripts — no build step, no bundler,
nothing fetched at runtime. Two ways to open it:

- **From a server** (recommended): from the repo root, `node tools/dev-server.mjs . 8642`
  and browse to `/projects/starfield/index.html`. The prototype's scripts are classic
  rather than modules, so stale caching is less vicious here than it is for the slice —
  but it is the same server and the same reason.
- **From disk**: opening `index.html` directly over `file://` works too; the
  scripts are deliberately classic (not ES modules) so the browser does not
  CORS-block them off the filesystem.

No network, no accounts, no data leaves the page.

---

## Controls

| Input | Action |
|-------|--------|
| **← → ↑ ↓** | turn the **nose**. Your velocity does not turn with it — that is the flight model |
| **Q E** | roll left / right |
| **W** | thrust — pushes your momentum the way the nose points. **Release and you coast** |
| **S** | retro-thrust — pushes it the other way; hold past a standstill and you back up |
| **1 … 6** | select a gear directly |
| **[ ]** | shift down / up a gear (shifting never changes your speed) |
| **J** | "punch it" — jump straight to top gear |
| **B** | full stop — kills your velocity from any speed, including one this gear could never reach |
| **Shift** | boost — accelerate and brake twice as hard |
| **A D R F** | strafe sideways / up / down for fine aiming |
| **Tab** | star chart · **K** rebind controls · **P** pause · **M** sound · **L** ledger |

The **mouse does nothing** to flight on purpose — steering is the keyboard on
desktop and the joystick on touch.

---

## The gearbox

The prototype's world and drive were designed around rapid travel through
light-year coordinates. Several body radii are inflated, generated encounters are
biased toward the flight corridor, and the six-gear ladder is tuned to cross the
resulting distances in playable time. Some later code moved orbital radii and
planet radii toward real scale, so the current model contains known scale conflicts.
The redesign replaces this with hierarchical real-scale coordinate spaces.

**The ship has momentum, and a gear is an acceleration.** You carry a real
velocity vector: **W** pushes it the way the nose is pointing, **S** pushes it
back, and letting go of both leaves you coasting forever. The arrow keys turn
the *nose only* — your velocity does not turn with it, which is why you can look
around at full speed and why the green heading marker and the crosshair come
apart. Changing gear **never changes how fast you are going**; it changes how
hard the engine can push (`top / ramp`) and how fast it may push you to. Drop
into a low gear at speed and you keep all of it — the engine just stops adding.
**B** is the one autopilot and works from any speed.

The implementation does **not** currently contain a distinct FTL regime. Velocity
is stored as **celerity**, home light-years per second of *your own* life, and the
same sublight relationship is applied from gear 1 through gear 6:

```
u = |v| / c          β = u / √(1+u²)  <  1  always          γ = √(1+u²)
```

β never reaches 1 however hard you push, while γ grows without limit — gear 6 is
γ ≈ 1.6×10¹³ at 99.9999999999% of *c*, not one metre per second past it. Every
consequence is real: gear 2 crosses **4.3 light-minutes in 1.1 minutes of ship
time** (measured), and by the top gear the aberration cone has tightened to a
point, the starlight has blueshifted clean out of the visible band, and **the sky
is black except for one point of light dead ahead**. Andromeda in five seconds
costs two and a half million years at home.

The interface and comments also call gears 3–6 “faster-than-light.” That label
conflicts with the celerity model above and is a known prototype design problem.
The target design separates validated sublight relativity from an explicitly
fictional FTL system whose time behavior has not yet been chosen.

The cheat is now two things, both shown on the panel: **the acceleration** (felt
g-force is honest, and openly in the millions) and **the hull**, which above 99%
of light stops caring about the numbers the readouts are still honestly
reporting. That threshold is a property of your *speed*, not your gear lever —
shifting down out of a high gear must never kill you.

| Current gear label | Prototype rôle | Ceiling | 0 → ceiling |
|------|------|---------|-------------|
| **1 · Thrusters** | real spacecraft speed; the only gear fine enough to work near a planet | ~900 km/s | 4 s |
| **2 · Relativistic** | honest relativity — crosses a solar system via length contraction | **99% of light** | 8 s |
| **3 · Interstellar** | where travel starts and the hull stops being real; nearest star ~40 s | 0.1 ly/s · γ≈3×10⁶ | 3 s |
| **4 · Fast transit** | neighbouring stars in seconds | 2 ly/s | 3.5 s |
| **5 · Galactic** | the galactic core in ~13 s | 10³ ly/s | 4 s |
| **6 · Intergalactic** | Andromeda in ~5 s, 2.5 Myr at home | 5×10⁵ ly/s · γ≈1.6×10¹³ | 5 s |

Two things the sky does at speed look like faults and are not, so each gets a
one-per-session explainer card on the left plus a warning lamp: **the sky
draining away** (aberration sweeps starlight forward, Doppler drags the rest into
the infrared) at 0.6*c*, and **the clocks splitting** at 99% of light.

---

## "Speed from where?" — the reference frame

There is no absolute velocity in relativity. Speed is only meaningful relative to
a chosen frame, so the game picks one and sticks to it:

> **All velocity is measured relative to the Sun's rest frame** — the frame in
> which the catalogued stars are given their positions. You start **at rest** in
> that frame. The Speed readout shows metres per second first, and a fraction of
> light beside it.

At everyday speeds nothing looks strange; the aberration crush, the Doppler
starbow and the split between your clock and home's only appear once you have
genuinely built up speed toward *c*.

---

## The physics (the math, `src/relativity.js`)

The engine is a **relativistic rocket**. Proper acceleration `a` integrates the
rapidity `η = aτ/c`, and everything falls out:

```
β = tanh(η)          γ = cosh(η)
d = (c²/a)(cosh η − 1)     distance in the home frame
t = (c/a) sinh η           time elapsed at home
```

Everything the sky does is a *consequence* of moving that fast:

- **Aberration** crushes the sky into a cone ahead of you
  (`cos θ′ = (cos θ + β)/(1 + β cos θ)`). See `src/view.js`.
- **Doppler** `D = 1/(γ(1 − β cos θ′))` shifts each star's blackbody temperature
  — the **starbow** is the ring where `D = 1` and colour is true. Beaming
  multiplies brightness by `D⁴`.
- **The two clocks** in the HUD: ship time `τ` vs home time `t = ∫ γ dτ`. One real
  second is one ship second — **time is 1:1**, no compression — so the clocks
  come apart honestly by γ whenever you are genuinely sub-light.
- **The CMB catches fire** as you boost into it (`T′ = D·T`), and **the
  interstellar medium becomes a beam** — each proton carries `(γ − 1)·938 MeV`.

**Lighting is physical:** stars are the only light sources. Planets and moons make
no light of their own — only the half facing their star is lit, from the *real*
direction of that star, so a world shows a crescent when side-lit and its dark
side is genuinely invisible when it is between you and its sun.

---

## What's out there

- **Real nearby stars** (`data/stars-near.js`, `data/stars-bright.js`) at their
  real 3D positions — permanent furniture, so you can fly past one, turn around,
  and it is exactly where you left it.
- **Real deep-sky objects** (`data/deep-sky.js`): galaxies, nebulae and
  catalogued black holes, including the Milky Way's own disk lined up with the
  real galactic plane and Sgr A\* at the centre. Fly ~50,000 ly and you clear the
  disk and see it as a spiral from outside.
- **Still faked** (and on the list to replace with real data): the between-stars
  fly-by systems, the background sky-field stars, the stars inside distant
  galaxies, and the planets of systems we have not measured. The stated direction
  is *everything you see should be something actually in space.*

---

## Where we cheat (and why)

Space is so empty that an honest simulation is unplayable: flying straight through
the real galaxy you would cover ~24 quadrillion light-years before hitting a star.
Every bend is listed in `SF.FUDGE` (`src/constants.js`) and rendered into the
in-game **honesty ledger**. The big ones now:

- **Extreme drive acceleration and high-speed protection** — the high gears cross
  enormous proper distances quickly and the hull ignores an otherwise lethal
  environment. The current FTL label is not a separate physical model.
- **Sizes** (stars, planets, black holes) are drawn far larger than real so you
  can fly up to a star and feel it loom, instead of hunting for a pixel.
- **Encounter geometry**: today systems are dropped near your flight path rather
  than scattered realistically — **real inter-system spacing is on the roadmap.**

Time is **no longer** compressed — the old 0.4 ship-years-per-second cheat is
gone; one second is one second.

---

## File structure

```
index.html          the how-to-fly menu / opening page
fly.html            the game: markup, HUD, overlays, script order
starfield.css       the instrument-panel styling
data/               inert catalogues (real stars, deep sky, milestones)
docs/               target design, architecture, science, and migration specifications
src/
  constants.js      SF.K (real physics) + SF.FUDGE (the cheats, incl. gears)
  controls.js       the keymap and action list
  controls-ui.js    the rebinding panel and on-screen hint line
  relativity.js     the rocket math and every consequence of it
  color.js          blackbody → RGB, with Doppler shift
  camera.js         orientation, steering, the projection
  view.js           aberration + where/what-colour things appear
  stars.js          stellar population sampling
  systems.js        star systems, planets, orbital layout
  galaxy.js         galaxy shapes and their resolved star fields
  blackhole.js      shadow, photon ring, lensing, D⁴ beaming
  render.js         the draw pipeline (incl. physical planet lighting)
  audio.js          procedural engine / ambience
  hud.js            the two clocks, the gear readouts, the honesty ledger
  game.js           state, input, the gear drive, the loop
```

---

## Target direction

The old prototype roadmap has been superseded. The new roadmap begins with a
real-scale Earth–Moon vertical slice rather than extending the current light-year
game loop.

The documentation set defines that work:

- [Design Bible](docs/DESIGN_BIBLE.md) — product vision and design laws
- [Earth–Moon Vertical Slice](docs/EARTH_MOON_VERTICAL_SLICE.md) — first complete
  playable target
- [Technical Architecture](docs/TECHNICAL_ARCHITECTURE.md) — frames, time,
  simulation, rendering, data, and migration structure
- [Scientific Standard](docs/SCIENTIFIC_STANDARD.md) — provenance, accuracy,
  procedural content, fiction, and the honesty ledger
- [Implementation Audit](docs/IMPLEMENTATION_AUDIT.md) — file-by-file preservation
  and replacement plan

The prototype should remain runnable while its strongest systems are characterized
and migrated. Future code work should follow those documents rather than adding
more features directly to the legacy `game.js` architecture.
