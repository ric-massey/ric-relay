# Starfield — a faster-than-light explorer built on real relativity

Fly through the **real** solar neighbourhood and out into the galaxy. The stars
around you are the actual stars around the Sun, at their catalogued distances and
directions; the Milky Way's band across your sky is its real disk, seen from
26,670 ly out along the real galactic plane. You fly a ship with a six-gear drive
that holds whatever speed you leave it at — and the physics does the rest.

It is the playable companion to
[The Geometry of Spacetime](../spacetime/index.html): that project *explains*
light cones, time dilation and aberration; this one lets you fly them.

> **The one commitment:** use the actual mathematics. Not "space-looking,"
> *space*. Every number in `SF.K` (`src/constants.js`) is a measured or defined
> physical constant. **The only thing allowed to break real physics is the
> ship's top speed** — and everything we bend lives in `SF.FUDGE` in the same
> file, with its magnitude written down, so the in-game **honesty ledger**
> ("where we cheat") can never drift from the truth.

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

- **From a server** (recommended): from the repo root, `python3 -m http.server`
  and browse to `/projects/starfield/index.html`.
- **From disk**: opening `index.html` directly over `file://` works too; the
  scripts are deliberately classic (not ES modules) so the browser does not
  CORS-block them off the filesystem.

No network, no accounts, no data leaves the page.

---

## Controls

| Input | Action |
|-------|--------|
| **← → ↑ ↓** | turn the ship — you go where the nose points |
| **Q E** | roll left / right |
| **W** | faster — hold to accelerate toward the gear's top speed. **Release and it holds that speed** |
| **S** | slower — hold to decelerate; keep holding past a standstill and you **reverse** |
| **1 … 6** | select a gear directly |
| **[ ]** | shift down / up a gear (shifting down brakes you to the new ceiling) |
| **J** | "punch it" — jump straight to top gear |
| **B** | full stop — brake to a dead standstill from either direction |
| **Shift** | boost — accelerate and brake twice as hard |
| **A D R F** | strafe sideways / up / down for fine aiming |
| **Tab** | star chart · **K** rebind controls · **P** pause · **M** sound · **L** ledger |

The **mouse does nothing** to flight on purpose — steering is the keyboard on
desktop and the joystick on touch.

---

## The gearbox

Space here is drawn at **light-year scale** — even the nearest planet in a system
sits a couple of light-years off — so at honest lightspeed (3.2×10⁻⁸ ly/s) it is
a two-year trip. That is why the drive is faster-than-light *by design*: it is the
one declared cheat, and every readout stays honest about it.

**It behaves like a car, not like a spring.** Speed is *signed* and it
*persists*: **W** climbs toward the gear's ceiling, **release and it stays
there**, **S** walks it back down through zero and on into reverse, **B** is a
full stop. There is no speed lock, because coasting is simply what the drive does
when you are not asking it for anything.

Six gears, each with a **hard top speed it governs to, like a car**. Each one is
a *speed range*: acceleration is the ceiling divided by the ramp time, so **the
gear you are in is the resolution you have** — ask for fine control in a high
gear and you will overshoot. Shifting down brakes you to the new gear's ceiling,
geometrically, so gear 6 → gear 1 settles in the same couple of seconds as 3 → 2.

| Gear | Rôle | Top speed | 0 → top |
|------|------|-----------|---------|
| **1 · Sub-light** | the honest one: real relativity lives here | 3.13×10⁻⁸ ly/s = **99 % of c** | 6 s |
| **2 · Docking** | final approach — a planet is 20 s wide | 10⁻³ ly/s ≈ 30,000 c | 2 s |
| **3 · Orbital** | one system, star to outer planets | 0.05 ly/s | 2.5 s |
| **4 · Interstellar** | **1 ly/s** — the nearest star in 4 s | 1 ly/s | 3 s |
| **5 · Galactic** | the galactic core in half a minute | 10³ ly/s | 4 s |
| **6 · Intergalactic** | Andromeda in five seconds | 5×10⁵ ly/s | 5 s |

Reverse is capped at **40 %** of the gear's forward ceiling, the way a car's is.
Only **gear 1 is inside the speed of light** — and because the drive now coasts,
it is the first version where you can hold any β you like and watch the sky
crush at your leisure.

**Felt g-force** is shown honestly — the proper acceleration an accelerometer
would read, openly in the millions of g when a high gear is spooling. The cheat
is *shown*, not hidden. There is **no speed banner**: how fast you are going is
meant to be read off the sky — the stars crushing forward, the Doppler colour,
the two clocks pulling apart.

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

- **Faster-than-light top speed** — the headline cheat, and the *only* thing
  allowed to break physics. Sub-light everything is honest.
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

## Roadmap

Landed: the six-gear FTL drive — accelerate, **coast**, decelerate, **reverse**,
with governed top speeds and geometric engine-braking on a downshift —
nose-steered flight, the 1:1 honest clock, massive body scale, physical
star-lighting of planets, and the how-to-fly menu.

Next, in dependency order:

1. **Two-scale systems** — a system is a point far off that expands into real,
   light-minute-scale space as you approach. This is the foundation that lets more
   than one honest sub-light gear exist.
2. **More honest sub-light gears** — gear 1 already tops out at 99 % of *c* and
   coasts, so you can hold any β and watch the sky; two-scale systems would let
   gears 2–3 come back inside *c* as well.
3. **Star heat burns the hull** — proximity to a star cooks you.
4. **Main menu & settings** on the how-to-fly page — set home time, tune gears.
5. **Real star-chart map + safe routing** — pan/zoom a real map, pick a
   destination (Earth included), and get a course that threads *between* stars.
   Show a **time-to-location / ETA** for the selected destination at current speed.
6. **Galaxies resolve** into fly-through star fields; real inter-system spacing
   and real positions, so *everything you see is something actually in space.*
7. **Real imagery on close approach** — as you near a real catalogued object
   (star, nebula, galaxy), fade in an actual photograph of it.
