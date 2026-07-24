# Starfield — improvement plan

Working doc for making `playground/starfield.html` better. No code changes yet —
this is just ideas to react to. Scope picked so far: **game feel**, **new
content**, **controls & accessibility**. Explicitly *not* pursuing a scoring/
lives/high-score system for now.

Current state, for reference: mouse/touch-steered flight game, cruise at 1c or
hold to warp at 10,000,000c, procedurally spawned star systems (star/black
hole + planets + moons + comets) spaced by simulated light-years
(`systemGap()`, [starfield.html:170](starfield.html:170)), instant-death
collision (`crash()`, [starfield.html:449](starfield.html:449)), single
`game-over` modal, no sound.

**Design bar:** this should read as a high-quality game, not a quick
prototype. That means every background element needs to behave consistently
with the game's physics — if something looks like a real, approachable object,
flying toward it should actually get you there, not quietly swap it out for
scenery. Section 1 below is the clearest current violation of that bar.

## 1. Sense of scale — galaxies need to resolve, not recycle

Right now galaxies are pure background dressing that only *looks* reachable.
In `frame()`, galaxy depth drifts inward at a fifth of normal travel speed
(`galaxy.z -= travel * .2`, [starfield.html:534](starfield.html:534)), and the
moment one gets close (`z <= 65`) it's silently replaced with a brand-new
galaxy spawned far out again (`spawnGalaxy(depth() * (5 + Math.random() * 7))`,
[starfield.html:536](starfield.html:536)). There's a second, separate recycle
path for off-screen staleness too
([starfield.html:545-551](starfield.html:545)). Net effect: you can never
actually arrive at a galaxy — it teleports back out to deep space right as it
would start to matter. That's the "flying past them" problem — it breaks the
illusion of scale the second a player pays close attention.

Galaxies are also rendered through a completely separate path
(`drawGalaxy()`, [starfield.html:348](starfield.html:348): one glow blob +
stroked spiral arms) from the star-system content
(`spawnSystem()`/`drawHazard()`, [starfield.html:185](starfield.html:185)).
Nothing ever bridges the two, so there's no code path where a galaxy's
individual stars become distinguishable, let alone flyable-into.

Fix direction:
- As a galaxy's `z` drops below a "resolving" threshold well before the
  current recycle point (e.g. `z < depth() * 0.9`), start breaking the single
  glow-blob sprite apart into many individually-rendered points scattered
  across its footprint — reusing the existing sky-star point rendering
  (`spawnSkyStar()`/loop in `drawSkyStars()`, [starfield.html:122](starfield.html:122))
  as the basis, so the galaxy visibly resolves into countless stars as you
  close the distance, the way a real galaxy would if you actually got close
  enough to resolve it.
- Once resolved, hand off into the normal system-spawning path so arriving at
  a galaxy means arriving *somewhere* — real systems/hazards drawn from that
  star cluster — instead of the game swapping it for new deep-space scenery.
- Only recycle a galaxy after it's actually been arrived at and left behind,
  never purely because raw distance crossed a threshold. This also gives
  asteroid fields (section 3) a natural place to cluster: right as you arrive
  at a resolved galaxy.

## 2. Game feel

- **Crash impact** — right now `crash()` just freezes and pops a modal
  instantly. Add a screen shake (jitter a canvas translate offset, decaying
  over ~0.4s) and a quick red flash on the moment of impact, before the modal
  appears. Skip/shrink under `prefers-reduced-motion` (already detected at
  [starfield.html:86](starfield.html:86)).
- **Near-miss feedback** — hazards already carry a `z`/screen-radius each
  frame in the collision loop ([starfield.html:572](starfield.html:572)). Add
  a "close call" band just outside the kill radius (e.g. `r+10` to `r+40`)
  that triggers a small camera kick + whoosh, once per hazard, without
  ending the run. Makes near-death moments feel earned instead of invisible.
- **Sound** — no audio at all currently. Farlight
  (`projects/farlight/index.html:240`) already has a pattern for this in the
  same site: lazily-created `AudioContext` on first gesture, a continuous hum
  oscillator whose pitch/gain track speed, plus a mute toggle (`m` key +
  on-screen control, persisted feel optional). Reuse that pattern rather than
  inventing a new one:
  - Continuous low hum that rises with `speedC`.
  - Warp engage/disengage: quick pitch ramp up/down.
  - Crash: short noise burst.
  - Near-miss: short blip.
  - Mute button, same visual language as the existing `.distance` HUD panel.
- **Difficulty ramp** — `systemGap()` ([starfield.html:170](starfield.html:170))
  returns a flat random range for the whole run. Scale it down slowly with
  `distanceLightSeconds` (denser fields the further you travel), floored so
  it never gets unfair — e.g. gap shrinks to ~45% of baseline by ~40ly and
  stays there.

## 3. New content

- **Asteroid fields** — a new hazard type spawned independently of
  `spawnSystem()`/`systemGap()`, as small clusters of irregular rocks that
  appear between systems. Gives constant low-stakes dodging texture instead
  of long empty stretches at cruise speed.
- **Wormhole (rare, *safe* hazard)** — a swirling ring hazard type that,
  instead of ending the run when touched, gives a speed/distance boost and
  a visual burst. Inverts the game's only rule ("everything you touch kills
  you") for one special case — since black holes already exist as the rare
  bad surprise (`.002` chance, [starfield.html:192](starfield.html:192)),
  a wormhole as the rare *good* surprise is a natural complement.
- **Black hole as an event, not just another hazard** — currently a black
  hole is just a hazard with a smaller radius
  ([starfield.html:192](starfield.html:192)). Give it a gravity-well visual
  (screen-space bend/pull on nearby dust or a vignette warp) so encountering
  one reads as a real moment rather than "same as a star, different sprite."

## 4. Controls & accessibility

- **Mobile is currently warp-only** — `touchstart` always calls
  `setWarp(true)` ([starfield.html:261](starfield.html:261)), so touch users
  have no way to fly at cruise speed; every touch is a warp. Needs a real
  fix: separate steering (drag) from warp engagement (dedicated button or a
  second-finger tap), so mobile play matches the mouse/keyboard experience
  (steer freely, choose when to warp).
- **Keyboard steering** — today keyboard only toggles warp (`Space`) and
  restarts (`R`); all steering is mouse/touch-only
  ([starfield.html:255](starfield.html:255)). Add arrow-key/WASD steering as
  an alternative so the game is playable without a mouse.
- **Pause** — no pause exists. Add `Escape`/`P` to pause with an overlay,
  useful on its own and a prerequisite for a mute-settings panel if audio
  lands.

## Suggested order

1. Galaxies resolving into stars — the biggest credibility gap for "high
   quality vs. quickly put together." Worth tackling early since it touches
   the deep-background rendering everything else layers on top of.
2. Controls fix (mobile warp-only bug) — this is closer to a bug than a
   nice-to-have.
3. Screen shake + near-miss feedback — cheap, high perceived impact, no new
   assets.
4. Sound — biggest lift, mirror the farlight pattern.
5. Difficulty ramp — small tweak, do alongside sound/shake tuning so pacing
   is judged with the full feel in place.
6. Asteroid fields + wormhole — new content, do last once the core feel is
   locked so they're tuned against the "final" difficulty curve, and can
   cluster around freshly-arrived galaxies per section 1.
