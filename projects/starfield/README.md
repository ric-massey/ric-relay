# Starfield — a relativistic rocket you can fly

Fly a real relativistic rocket through the **real** solar neighbourhood. The
stars around you are the actual stars around the Sun, at their catalogued
distances and directions. Start at rest, build up speed toward light, and the
physics does the rest: the sky crushes into a cone ahead of you, the microwave
background heats up, and your clock falls behind everybody's back home.

It is the playable companion to
[The Geometry of Spacetime](../spacetime/index.html): that project *explains*
light cones, time dilation and expansion; this one lets you fly them.

> **The one commitment:** use the actual mathematics. Not "space-looking,"
> *space*. Every number in `SF.K` (`src/constants.js`) is a measured or defined
> physical constant. Everything we deliberately fake lives in `SF.FUDGE` in the
> same file, with its magnitude written down, and the in-game **honesty ledger**
> ("where we cheat") is generated straight out of it so it can never drift.

---

## Running it

It is plain, dependency-free, deferred classic scripts — no build step, no
bundler, nothing fetched at runtime. Two ways to open it:

- **From a server** (recommended): from the repo root, `python3 -m http.server`
  and browse to `/projects/starfield/index.html`.
- **From disk**: opening `index.html` directly with `file://` works too; the
  scripts are deliberately classic (not ES modules) so the browser does not
  CORS-block them off the filesystem.

No network, no accounts, no data leaves the page.

---

## Controls

| Input | Action |
|-------|--------|
| **← →** | yaw (turn the nose left / right) |
| **↑ ↓** | pitch (nose up / down) |
| **Space** | accelerate (burn forward at 1 g) |
| **Shift** | hold with Space for a 3 g burn |
| **B** | brake — decelerate toward a full stop |
| **J** | lightspeed jump (faster-than-light travel; see below) |
| **M** | sound on / off · **P** pause · **L** honesty ledger |
| touch | on-screen joystick to steer, **accel** / **brake** buttons |

The **mouse does nothing** to flight on purpose — steering is the keyboard on
desktop and the joystick on touch. You can come to a **complete stop** (hold B)
and sit still to watch a system's planets orbit.

---

## "Speed from where?" — the reference frame

There is no absolute velocity in relativity. Speed is only meaningful relative
to a chosen frame, so this game picks one and sticks to it:

> **All velocity is measured relative to the Sun's rest frame** — the frame in
> which the catalogued stars are given their positions. You start **at rest** in
> that frame (β = 0, γ = 1).

That choice is what makes the game feel right. Relativistic effects scale with
speed, so **at everyday speeds nothing looks strange**: moving at Earth's
orbital velocity (~30 km/s ≈ 0.0001 c) your γ is 1.000000005 and the sky sits
still. The aberration crush, the Doppler starbow and the split between your
clock and home's only appear once you have genuinely built up speed toward *c*.
Nothing is "already fast" the moment you launch.

(The closest thing to a cosmic reference is the rest frame of the microwave
background — the Sun drifts ~370 km/s relative to it. The game ignores that and
treats the Sun as zero, because that is the frame you and the star catalogue
share.)

---

## The physics (the math, `src/relativity.js`)

The engine is a **relativistic rocket**. The throttle is *proper acceleration*
`a` in gravities, felt in the ship. Holding it integrates the rapidity
`η = aτ/c` (so a changing throttle just accumulates), and everything falls out:

```
β = tanh(η)          γ = cosh(η)
d = (c²/a)(cosh η − 1)     distance in the home frame
t = (c/a) sinh η           time elapsed at home
dη/dτ = a/c                so η just accumulates under thrust
```

`c/g = 0.9687 years` and `c²/g = 0.9687 light-years` are the natural scales:
at one gravity your rapidity climbs by ~1 per year of ship time.

Everything else is a *consequence* of moving that fast:

- **Aberration** crushes the sky into a cone ahead of you
  (`cos θ′ = (cos θ + β)/(1 + β cos θ)`). Half the sky squeezes into a spot
  ahead: dead abeam at rest appears at `arccos β`. See `src/view.js`.
- **Doppler** `D = 1/(γ(1 − β cos θ′))` shifts each star's blackbody
  temperature — the **starbow** is the ring where `D = 1` and colour is true.
  Beaming multiplies brightness by `D⁴`.
- **Time dilation** is the two clocks in the HUD: ship time `τ` vs home time
  `t = ∫ γ dτ`. Fly far and they come apart hyperbolically. Length contraction
  is its mirror — the road ahead shortens by `1/γ` in your frame.
- **The CMB catches fire.** The 2.72548 K background stays a blackbody when you
  boost into it, just a hotter one: `T′ = D·T`, and dead ahead `D ≈ 2γ`. γ ≈
  1,059 makes it as hot as the Sun's surface. That is the difficulty curve, and
  you choose it every time you hold the throttle.
- **The interstellar medium becomes a beam.** Each proton carries
  `(γ − 1)·938.27 MeV` in your frame — at γ = 7,000 that is an LHC beam,
  continuously, hitting the hull.

Because effects scale from β = 0, all of this is invisible at a standstill and
only ramps in as you approach *c* — which is exactly the "real relativity, but
normal when I'm slow" behaviour the game is tuned for.

---

## The lightspeed jump (J) — the one honest fiction

Nothing with mass can reach *c*: under thrust β only ever *asymptotes* to 1.
But the galaxy is 100,000 light-years across and Andromeda is 2.5 million, so a
game that never lets you exceed *c* is a game you can never explore. So:

- **Under thrust**, β is capped below 1 by the real physics. Cross ~0.99 c and a
  red **NEAR LIGHT SPEED** banner warns you your clock is stretching.
- **Press J** to engage a **faster-than-light jump** — framed as an Alcubierre
  warp bubble (a real solution to the field equations, with unphysical energy
  requirements). Inside it the ship is locally at rest, so relativity switches
  off, and a cyan **FASTER THAN LIGHT** banner tells you plainly that real
  physics forbids this and the drive is faking it. Warp speed scales with the
  throttle (hold Space to build it), and **collisions are off** — you pass
  through normal space instead of slamming into the nearest star.

Sub-light flight is the precise tool for hopping to a nearby star and parking;
the jump is for crossing between distant regions and galaxies.

---

## What's out there

- **Real nearby stars** (`data/stars-near.js`, `data/stars-bright.js`) at their
  real 3D positions, all around you — they are permanent furniture, so you can
  fly past one, turn around, and it is exactly where you left it.
- **Real deep-sky objects** (`data/deep-sky.js`): galaxies, nebulae and
  catalogued black holes, including the Milky Way's own disk lined up with the
  real galactic plane and Sgr A\* at the centre.
- **Procedural fly-by systems** fill in between the real ones as you cruise, and
  distant galaxies resolve into procedurally-placed stars when you fly into them
  (we have not measured where every star in Andromeda is, so those are invented
  from the real luminosity function).

---

## Where we cheat (and why)

Space is so empty that an honest simulation is unplayable: flying straight
through the real galaxy you would cover ~24 quadrillion light-years before
hitting a star. Every inflation is listed in one place — `SF.FUDGE` in
`src/constants.js` — and the in-game **honesty ledger** ("where we cheat")
renders straight from it. The big ones:

- **Time compression**, speed-scaled: near a standstill the sim runs at ~8% of
  full rate so a parked planet orbits at a watchable pace; past ~0.1 c it ramps
  to the full 0.4 ship-years per real second, so interstellar cruising stays
  quick. The ship/home clock ratio stays exactly γ — only the wall-clock mapping
  bends.
- **Sizes** (stars, planets, black holes) are drawn enormously larger than real,
  because at any survivable distance they are far smaller than one pixel.
- **Encounter geometry**: the *gap* between systems is real (Poisson, ~4 ly
  mean), but we drop them near your flight path instead of scattered through a
  4.46 ly disk you would otherwise never meet.

---

## File structure

```
index.html          markup, HUD, overlays, script order
starfield.css       the instrument-panel styling
data/               inert catalogues (real stars, deep sky, milestones)
src/
  constants.js      SF.K (real physics) + SF.FUDGE (the cheats)
  relativity.js     the rocket engine and every consequence of it
  color.js          blackbody → RGB, with Doppler shift
  camera.js         orientation, steering, the projection
  view.js           aberration + where/what-colour things appear
  stars.js          stellar population sampling
  systems.js        star systems, planets, layout
  galaxy.js         galaxy shapes and their resolved star fields
  blackhole.js      shadow, photon ring, lensing, D⁴ beaming
  render.js         the draw pipeline
  audio.js          procedural engine / ambience
  hud.js            the two clocks and the honesty ledger
  game.js           state, input, the loop, everything wired together
```

---

## Roadmap

Landed: free-flight from rest, real relativity that scales with speed,
all-around real stars, the lightspeed jump, and stop-and-look exploration.

Next:

- **Destination map** — open a map, pick a catalogued star / galaxy, and
  navigate (or jump) to it.
- **Real exoplanets** — replace guessed planets with measured exoplanet data for
  the systems we actually know, keyed to the same star catalogue.
