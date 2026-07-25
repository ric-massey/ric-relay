# Starfield — from tech demo to a real flight through real space

Working doc that became `projects/starfield/`. **Implemented.** Kept as the
rationale for what is in there and why — the code comments assume you have
read this. Two things landed differently from the plan below; both are noted
where they come up (§8 on which way the starbow actually goes, §10 on which
distance the galaxy crossfade is keyed to).

## The north star

> You are not dodging shapes on a screen. You are a ship with a real engine,
> burning at real acceleration, through the real solar neighbourhood — and
> physics is the whole game.

Everything below follows from one commitment: **use the actual mathematics.**
Not "space-looking," *space*. The payoff is that real physics is stranger and
more thrilling than anything we'd invent — the sky really does crush into a
cone ahead of you, the microwave background really does catch fire, and you
really can cross the galaxy in twelve years of your own life. We just have to
stop faking it.

This also makes the game the playable companion to
[The Geometry of Spacetime](../projects/spacetime/index.html) already on the
site — that project *explains* light cones, time dilation and expansion;
Starfield lets you fly them.

## This should become a project, not stay a single file

The scope below takes Starfield from 591 lines to something more like
3,000–5,000. That does **not** need to live in one `.html`, and the repo rules
don't ask it to. `AGENTS.md:74-78` and `README.md:60`:

> Sub-projects live in `projects/<name>/` … Each is self-contained and may
> carry its own assets/fonts; the "no dependencies" rule is for the terminal's own
> room pages, **not embedded projects.**

The single-file rule (`AGENTS.md:13`) governs the themed *room* pages, so the
site never flattens into one shared template. Projects are exempt and already
multi-file in practice: `siege-conductor/` ships `index.html` + `sw.js` +
`manifest.json` + four icons; `spacetime/` is five pages;
`the-shape-of-harm/` is 122 files.

### Proposed move: `playground/starfield.html` → `projects/starfield/`

It's outgrown the playground, and `projects/` is where the comparable work
lives (farlight and spacetime are both Exploration-linked projects). Five
references would need updating — all mechanical:

| File | What |
|---|---|
| `exploration.html:161` | the MODULE 001 card `href` |
| `index.html:449` | terminal command `href` |
| `index.html:481` | the ASCII directory tree |
| `latest.js:9` | the "latest addition" banner `href` |
| `README.md:65` | the Playground section |

Three things survive the move untouched, all because they resolve relative to
a *script* rather than the page: `relay-return.js:22` keys the typed easter egg
off `data-egg="starfield"`, not the path; `relay-return.js:11` resolves
`effects.js` from its own `src`; and `effects.js:28` resolves Mochi's sprite
PNGs via `new URL('assets/…', document.currentScript.src)`, so they keep
pointing at root `assets/` no matter how deep the page sits. Moving also fixes
an oddity — the loader becomes the standard `../relay-return.js` with
`data-home="../../index.html"`, matching farlight and the other 18 call sites,
instead of today's one-off `../projects/relay-return.js`.

> ⚠️ **Don't lose `data-mochi-world="space"`.** That attribute on `<html>`
> ([starfield.html:2](starfield.html:2)) is the *only* thing in the repo that
> puts Mochi in his helmeted zero-gravity pose set — `effects.js:102` reads
> `document.documentElement.dataset.mochiWorld` and nothing else sets it.
> Rewriting the shell HTML is exactly when it gets silently dropped, and the
> regression is invisible until someone notices the cat is walking normally in
> deep space. Worth a comment in the new `index.html`.

### The one real technical constraint: `file://`

`AGENTS.md` rule 4 requires everything to work as static files opened
directly, and `relay-return.js:4-6` actively branches on `location.protocol`
to honour that. **So: no ES modules.** `<script type="module">` is CORS-blocked
on `file://` and would silently break direct-open. Use plain classic scripts —
`<script defer src>` executes in document order, so dependency order is just
tag order, with no bundler and no build step.

House style is already set by `relay-return.js`: an IIFE, no globals leaked.
Same pattern here, hanging off one namespace:

```js
(() => {
  const SF = (window.SF ||= {});
  SF.color = { fromTemperature(K) { /* … */ } };
})();
```

### Suggested layout

```
projects/starfield/
  index.html        shell — canvas, HUD markup, <style>, ordered <script> tags
  starfield.css     optional; the CSS is small enough to keep inline
  data/
    stars-near.js       nearest ~100 real systems (§3)
    stars-bright.js     famous distant landmarks (§3)
    deep-sky.js         Messier/NGC objects (§10)
    milestones.js       the distance ladder (§13)
  src/
    constants.js        the constants sheet
    color.js            Planck → CIE → sRGB LUT (§4)
    relativity.js       β, γ, rocket integration, aberration, Doppler (§6–9)
    camera.js           yaw/pitch basis, projection (§1)
    stars.js            IMF sampling, spectral classes (§4)
    systems.js          Kepler orbits, frost line, planet classes (§11)
    galaxy.js           Sérsic profiles, log spirals, resolve staging (§10)
    blackhole.js        Schwarzschild, lensing, beamed disk (§12)
    render.js           draw pipeline, depth sort (§2)
    audio.js            hum tracking γ, ISM hiss (§16)
    hud.js              two clocks, milestone announcements (§7, §13)
    game.js             state, main loop, collision, wiring
```

Splitting `data/` from `src/` matters more than the exact module boundaries:
the catalogues are inert tables that want to be readable and editable, and
`AGENTS.md` already praises that pattern ("each page has a loudly-commented
editable block"). A real star catalogue is exactly that — data Ric might want
to extend by hand.

Still no build step, no dependencies, no CDN, works from `file://`.

---

## What's already right — don't break it

Genuinely good foundations worth naming, because several of the fixes below
build on them:

- **`project()` ([starfield.html:288](starfield.html:288)) is a correct
  pinhole projection.** `scale = min(W,H)*0.82/z` is real perspective. The
  focal length is even implicitly sane.
- **The distance clock is honest.** `LIGHT_YEAR_SECONDS = 31557600`
  ([starfield.html:87](starfield.html:87)) is exactly the Julian year, and
  `distanceLightSeconds += speedC * dt` ([starfield.html:519](starfield.html:519))
  means 1 second at 1c really is 1 light-second. That's a real unit system,
  already wired up.
- **`systemGap()` of 2.8–8.6 ly ([starfield.html:170](starfield.html:170)) is
  the right order of magnitude.** Real mean nearest-neighbour stellar
  separation locally is ~4 ly (Proxima is 4.24). Someone did the homework.
- **Planets already compute reflected lighting** via `lightAngle`
  ([starfield.html:210](starfield.html:210), used at
  [starfield.html:421-428](starfield.html:421)) — a lit limb and a dark limb,
  no glow. That's the correct instinct, and section 8 extends it.
- **The rare black hole at p = 0.002 ([starfield.html:192](starfield.html:192))**
  is a great idea that's currently under-delivered, not a wrong one.

---

# Part I — Make the space real

## 1. The ship strafes; it never flies

**This is the single biggest reason it doesn't feel like flying.**

Steering translates the camera sideways and nothing rotates:

```js
cameraX += steerX * travel * .62;   // starfield.html:528
cameraY += steerY * travel * .62;
```

and `project()` ([starfield.html:288](starfield.html:288)) only ever subtracts
a position — there is no orientation anywhere in the file. Aiming right
*slides* you right, like a security camera on a rail. Real flight yaws and
pitches, and the entire universe swings around you.

**The math.** Keep a camera basis and rotate world points into camera space
before projecting:

```
yaw ψ, pitch θ  →  forward f = (cosθ sinψ, −sinθ, cosθ cosψ)
p_cam = Rᵀ · (p_world − camPos)
screen = (f_len · p_cam.x / p_cam.z ,  f_len · p_cam.y / p_cam.z)
```

Steering input drives *angular rate* (ψ̇, θ̇) with damping, not position.
Add a little **roll into the turn** (bank ∝ yaw rate, ~15–20° max) — that one
touch is most of what makes flight sims feel airborne.

Bonus: once orientation exists, the sky layer stops being a hack. Right now
`drawSkyStars()` ([starfield.html:319](starfield.html:319)) slides 2D points
around and **wraps them at the screen edge** — stars teleport across the
frame. With a real basis they become direction vectors on a unit sphere,
projected properly, and they simply rotate past. No wrapping, no teleporting.

## 2. Depth sorting is missing (a real bug)

Hazards are drawn in **array order**, not depth order
([starfield.html:572](starfield.html:572)) — the loop walks indices while `z`
varies freely within a system (planets get `z + (Math.random()-.5)*95`,
[starfield.html:209](starfield.html:209)). So a distant moon can paint on top
of a near planet. Sort by descending `z` before drawing. One line, removes a
whole class of "why did that look wrong" moments.

## 3. Real stars, in their real places

Seed the opening of every run with **the actual solar neighbourhood** — real
stars, real distances, real spectral types, real 3-D positions. Embed the
nearest ~100 systems as a literal; convert catalogue coordinates once at load:

```
d[pc] = 1 / parallax[arcsec]
x = d·cos δ·cos α ,  y = d·cos δ·sin α ,  z = d·sin δ
```

The first minutes of flight then take you past things that are *actually
there*:

| Star | Distance (ly) | Type |
|---|---|---|
| Proxima Centauri | 4.246 | M5.5V red dwarf |
| Alpha Centauri A / B | 4.365 | G2V + K1V |
| Barnard's Star | 5.963 | M4V |
| Wolf 359 | 7.86 | M6V |
| Lalande 21185 | 8.307 | M2V |
| Sirius A / B | 8.611 | A1V + white dwarf |
| Epsilon Eridani | 10.475 | K2V |
| Procyon | 11.46 | F5IV-V |
| Tau Ceti | 11.91 | G8V |

Then, further out, the famous ones as landmarks you can steer *toward*:
Altair 16.7 ly · Vega 25.0 · Arcturus 36.7 · Aldebaran 65 · Betelgeuse ~550 ·
Rigel ~863 · Deneb ~2,615.

**The striking part is what this reveals:** of the 30 nearest stars, ~22 are
dim red M dwarfs. The real neighbourhood is a haze of faint red embers with a
handful of brilliant outliers. The current `starColors` palette
([starfield.html:193](starfield.html:193)) picks uniformly from six colours,
so the game shows roughly the *opposite* sky — far too many blue-white stars.
Fixing that is section 4, and it will change the entire mood of the game for
free.

Label them on approach. "PROXIMA CENTAURI — 4.24 ly — M5.5V" sliding past is
worth more than any invented content.

## 4. Star colour from Planck's law, star population from the real IMF

Replace the six-colour array with physics. **Colour** comes from temperature
via blackbody radiation:

```
Planck:  B_λ(T) = (2hc²/λ⁵) / (exp(hc/λkT) − 1)
Wien:    λ_max = 2.898×10⁻³ / T     (Sun: T=5772 K → 502 nm)
```

Integrate `B_λ(T)` against the CIE colour-matching functions → XYZ → sRGB,
**precomputed once at load into a lookup table** from 1,000 K to 40,000 K in
100 K steps. That's ~390 entries, costs nothing, and every star in the game
is then a physically correct colour.

**Which temperatures appear** comes from the real distribution of main
sequence stars — this is the part that transforms the sky:

| Class | Temp (K) | Colour | Real share |
|---|---|---|---|
| O | ≥ 33,000 | blue | 0.00003% |
| B | 10,000–33,000 | blue-white | 0.13% |
| A | 7,300–10,000 | white | 0.61% |
| F | 6,000–7,300 | yellow-white | 3.0% |
| G | 5,300–6,000 | yellow | 7.6% |
| K | 3,900–5,300 | orange | 12.1% |
| M | 2,300–3,900 | red | **76.5%** |

Three quarters of all stars are red dwarfs. Sample from this table and the
sky becomes overwhelmingly deep red and dim — and every blue-white star you
find becomes an *event*, because it genuinely is rare. Free drama from real
statistics.

Physical size follows too, instead of `75 + random*45`
([starfield.html:199](starfield.html:199)):

```
L/L☉ = (M/M☉)^3.5        (0.43 < M < 2 M☉)
R/R☉ = (M/M☉)^0.8        (M < 1 M☉)
lifetime ≈ 10 Gyr × (M/M☉)^−2.5
```

An M6 dwarf is ~0.1 R☉; Betelgeuse is ~900 R☉. That's a factor of ~9,000 in
radius, and right now the game renders every star within a 1.6× range.

## 5. Real spacing: Poisson, not uniform

`systemGap()` returns `2.8 + Math.random() * 5.8`
([starfield.html:170](starfield.html:170)) — uniform. Real stars are a Poisson
point process, so gaps along a flight path are **exponentially** distributed:

```
number density   n ≈ 0.004 stars / ly³   (local)
encounter rate   λ = n · π · R_enc²
gap sample       s = −ln(1 − U) / λ        U ~ uniform(0,1)
mean NN distance = 0.554 · n^(−1/3) ≈ 3.5 ly   ✓ (Proxima: 4.24 ly)
```

One line change, and it's not cosmetic: an exponential distribution naturally
produces **clusters and voids**. You'll hit three systems in quick succession
and then cross a long empty stretch. Uniform sampling can never do that, and
that clumpiness is exactly what makes real space feel real.

---

# Part II — Make the speed real

## 6. Kill fake warp. The engine is a relativistic rocket.

Right now the HUD claims 10,000,000 c while the actual visual travel rate
ramps only 4 → 34 ([starfield.html:251](starfield.html:251)) and the dust
streak is clamped at `Math.min(.045, speed * .0012)`
([starfield.html:568](starfield.html:568)). The number and the feeling are
unrelated, and a million-fold speed change that looks like an 8× change reads
as fake the instant anyone notices.

Also: `CRUISE_C = 1` ([starfield.html:88](starfield.html:88)) is exactly
light speed, which a ship with mass cannot do.

**Replace both with the real relativistic rocket.** The throttle is *proper
acceleration* in g. Hold it and let the actual equations run:

```
β = tanh(aτ/c)        γ = cosh(aτ/c)
d = (c²/a)·(cosh(aτ/c) − 1)          [distance, home frame]
t = (c/a)·sinh(aτ/c)                 [time, home frame]

at a = 1g:   c²/a = 0.969 ly    c/a = 0.969 yr
```

Here is what one sustained 1g burn actually gives you — **this is the game's
entire arc, and we invented none of it:**

| Ship time τ | γ | β | Distance | Home time | You have reached |
|---|---|---|---|---|---|
| 1 yr | 1.58 | 0.776 | 0.57 ly | 1.19 yr | inside the Oort cloud |
| 2 yr | 3.96 | 0.968 | 2.9 ly | 3.7 yr | — |
| 3 yr | 9.6 | 0.995 | 8.3 ly | 8.7 yr | past Sirius |
| 5 yr | 87 | 0.99993 | 84 ly | 85 yr | — |
| 7.4 yr | 1,060 | — | 1,020 ly | 1,020 yr | **the CMB ignites** (§9) |
| 10 yr | 15,200 | — | 14,700 ly | 14,700 yr | past the galactic centre |
| 12.3 yr | 119,000 | — | 116,000 ly | 116,000 yr | **out of the Milky Way** |
| 15.5 yr | 2.6×10⁶ | — | 2.54 Mly | 2.54 Myr | **Andromeda** |
| 24.5 yr | 4.8×10¹⁰ | — | 46.5 Gly | 46.5 Gyr | **the observable edge** |

Twelve years of your life to cross the galaxy. Twenty-four to reach the edge
of everything. That is real, it is the actual published result for a 1g
rocket, and it is a far better game than "hold click for 10,000,000 c."

Keep a warp mode if you like the fiction — but make it explicitly an
**Alcubierre bubble** (a genuine, if exotic, solution to Einstein's field
equations: contract space ahead, expand behind, sit locally at rest). That
justifies switching the relativistic effects *off* inside the bubble, which
is both correct and a great visual contrast.

## 7. Two clocks — the emotional core

Show both, always, side by side in the HUD:

```
SHIP TIME    00:00:15.4
HOME TIME    00:04:12.9        γ = 3.96
```

Same engine, real formula (`t = (c/a)·sinh(aτ/c)`), and the gap widens
hyperbolically as you burn. Fly to Andromeda and it reads **15 years / 2.5
million years**. Nothing else in the game will land as hard as watching those
two numbers come apart. It also ties directly to the site's existing
[time dilation chapter](../projects/spacetime/02-time-dilation.html).

Length contraction is the mirror image and worth showing too: the road ahead
physically shortens by `1/γ` in your frame, so at γ = 87 the 4.24 ly to
Proxima is 0.049 ly of *your* distance.

## 8. Aberration, Doppler, beaming — the starbow

This is the showpiece, and it is all closed-form arithmetic on points we're
already drawing.

**Aberration** — light piles up ahead of you:

```
cos θ' = (cos θ + β) / (1 + β cos θ)
```

A star at 90° (dead abeam, at rest) appears at `θ' = arccos β`:

| β | γ | whole rear+side sky crushed into |
|---|---|---|
| 0.90 | 2.29 | 25.8° cone |
| 0.99 | 7.09 | 8.1° cone |
| 0.999 | 22.4 | 2.6° cone |

At β = 0.999 **half the sky is squeezed into a 2.6° spot ahead of you.** The
stars visibly stampede forward as you accelerate. Real, and unlike anything
currently on screen.

**Doppler** — colour shifts by direction:

```
D = 1 / (γ(1 − β cos θ'))
ahead (θ'=0):   D = γ(1+β) ≈ 2γ        behind:  D = γ(1−β) ≈ 1/2γ
```

Stars ahead blueshift out of the visible into UV and **go dark**. Stars
behind redshift into IR and go dark. What survives is a **ring of true
colour** where `D ≈ 1`:

```
cos θ'_ring = (1 − 1/γ) / β
β = 0.90 → 51°     β = 0.99 → 30°     β = 0.999 → 17°
```

The famous **starbow** — a coloured annulus that tightens toward your flight
path as you accelerate. Implementation: shift each star's blackbody
temperature by `T → D·T` and re-sample the same colour LUT from section 4.
The LUT is already built; this is nearly free.

> **As built — the forward sky does not go dark.** This paragraph repeats the
> popular version of the starbow, and building it from Planck's law rather
> than asserting it showed the popular version is wrong. Bolometric flux is
> beamed by `D⁴`, and above ~10,000 K a blackbody's *visible* fraction falls
> as roughly `T⁻³` (Rayleigh–Jeans), so visible flux ahead goes as `D⁴·D⁻³`
> — it **rises**, near enough linearly in `D`. Stars ahead get brighter and
> bluer, not dark. Behind you it is the Wien tail instead, which collapses
> exponentially, so the rear sky really does go black. This is the same
> conclusion McKinley & Doherty reached in 1979 when they first rendered it
> properly, correcting the Sagan-era pictures. The ring where `D = 1` is
> still there and still tightens exactly as the table above says. `color.js`
> stores a `vis` column per LUT entry and the effect falls out of it for
> free, which is the whole argument for computing rather than asserting.

**Beaming** — brightness scales as `D⁴`. At β = 0.99 the forward sky is
~39,700× brighter and the rear sky ~40,000× dimmer. Multiply into alpha and
clamp.

## 9. The CMB catches fire

The best fact in the whole design, and the natural difficulty curve.

The cosmic microwave background is a 2.72548 K blackbody filling all of
space. Boost into it and, dead ahead, it stays a blackbody at `T' = D·T ≈ 2γT`:

| γ | Forward CMB temp | What you see ahead |
|---|---|---|
| 10 | 55 K | still nothing |
| 100 | 545 K | a dull infrared smudge |
| **1,059** | **5,772 K** | **as hot as the surface of the Sun** |
| 10,000 | 54,500 K | searing blue-white, hotter than an O star |
| 10⁶ | 5.5×10⁶ K | soft X-rays |

At 1g that Sun-temperature threshold arrives at **τ = 7.4 ship-years**. The
entire forward sky slowly heats from black → dull red → orange → blinding
white as you burn. It's a real physical limit on relativistic travel, it is
visually spectacular, and it gives the game an *organic* difficulty ramp —
better than the arbitrary one proposed in the old draft, because the danger
is the speed you chose.

Pair it with the **interstellar medium**, the other real wall:

```
proton impact energy = (γ − 1)·938.272 MeV
γ = 1,000  →  938 GeV per proton
γ = 7,000  →  6.5 TeV — you are flying into an LHC beam, continuously
flux at n = 1 cm⁻³, β≈1:  ~45 MW/m² of hard radiation at γ = 1,000
```

Real density numbers give you free level design: the **Local Bubble** (~300 ly
around the Sun, carved by ancient supernovae) is ~0.05 atoms/cm³, twenty
times thinner than the galactic average of ~1/cm³. So the first 300 ly are
genuinely, physically safer — and crossing out of the Bubble is a real
threshold with real consequences.

**Together these give the game its actual tension**: speed is the reward and
speed is the threat, and both sides of that trade are computed from real
physics rather than tuned by hand.

---

# Part III — Make the objects real

## 10. Galaxies must resolve into stars

Currently galaxies are scenery that only *looks* reachable. Depth drifts in
at a fifth speed (`galaxy.z -= travel * .2`,
[starfield.html:534](starfield.html:534)) and the moment one gets close
(`z <= 65`) it is silently swapped for a fresh one spawned far away
([starfield.html:536](starfield.html:536)), with a second recycle path for
off-screen staleness ([starfield.html:545](starfield.html:545)). You can never
arrive. And `drawGalaxy()` ([starfield.html:348](starfield.html:348)) is a
glow blob with stroked arms — no code path exists where its stars become
individual objects.

**The real math tells us exactly when to switch.** Angular size is `θ ≈ D/d`:

| Object | Diameter | Distance | Angular size |
|---|---|---|---|
| Andromeda from here | 152,000 ly | 2.54 Mly | 3.4° (**seven full moons**) |
| Milky Way from 100,000 ly | 105,700 ly | 100,000 ly | ~60° — half the sky |

And you resolve individual stars when their mean separation `s ≈ 4 ly`
subtends more than a rendered pixel (`θ_res ≈ 10⁻³ rad`):

```
d_resolve = s / θ_res ≈ 4 / 0.001 ≈ 4,000 ly
```

So the handoff is not arbitrary — it's **~4,000 ly to start resolving stars,
filling the view by ~50,000–100,000 ly.** Three staged representations
crossfading by distance:

1. **> 100,000 ly** — Sérsic-profile sprite (what we have, but correct):
   ```
   I(R) = I_e · exp(−b_n[(R/R_e)^(1/n) − 1]),   b_n ≈ 2n − ⅓
   n = 4 → de Vaucouleurs (ellipticals)    n = 1 → exponential disk (spirals)
   ```
2. **100,000 → 4,000 ly** — sprite crossfades into thousands of point stars
   sampled from the real disk profile `I(R) = I₀·e^(−R/h)` (Milky Way scale
   length `h ≈ 8,500 ly`, thin-disk scale height ~1,000 ly), coloured by the
   §4 IMF. It visibly *grains* apart into stars.
3. **< 4,000 ly** — you are inside. Points hand off to the normal
   `spawnSystem()` path, so arriving somewhere means arriving *somewhere*.

Recycle a galaxy only after it has been entered and left behind — never
because a raw distance threshold tripped.

> **As built — the crossfade is keyed to the near edge, not the centre.**
> Keying it to the centre distance, as written above, breaks for exactly the
> galaxy this section is about. Andromeda's radius is 76,000 ly, so by the
> time its *centre* is 63,000 ly away it already subtends more than a
> radian and the renderer calls you "inside" — and the 100,000 → 4,000 ly
> crossfade has only run to 14% of the way. It jumped from a smooth sprite
> straight to nothing. Measuring from `d − radius` fixes it and is also more
> correct: at 90,000 ly from the middle of Andromeda its nearest stars are
> 14,000 ly away and visibly grainy while the far side is still a smooth
> glow, which is what a big galaxy actually looks like from inside its own
> outskirts.

**Also fix the arms:** real spiral arms are **logarithmic** spirals (density
waves, Lin–Shu), not the Archimedean curve currently generated by
`reach = r*.08 + r*.88*(i/34)` ([starfield.html:381](starfield.html:381)):

```
r = r₀ · e^(θ · tan φ)      pitch angle φ:  Sa 5–10° · Sb 10–15° · Sc 15–25°
Milky Way ≈ 12°
```

One expression, and galaxies immediately read as real galaxies. Vary `φ` and
`n` across the Hubble sequence (E0–E7, S0, Sa/Sb/Sc, barred, irregular) for
honest variety. Real galaxy luminosities follow a Schechter function
`φ(L) ∝ (L/L*)^α · e^(−L/L*)` — like stars, **most galaxies are dwarfs**.

## 11. Systems that actually orbit, built around the frost line

Planets are placed once at a fixed angle ([starfield.html:204-222](starfield.html:204))
and never move — loiter near a system and it's a frozen diorama. Worse, every
system shares a **hardcoded inclination**: `planetY = centerY + sin(angle)*orbit*.62`
([starfield.html:208](starfield.html:208)). Every system in the universe is
tilted identically.

**Kepler's third law** makes them live, and costs one line per frame:

```
P[yr] = √(a[AU]³ / M[M☉])        ω = 2π/P  ∝  a^(−3/2)
Mercury a=0.387 → P = 0.241 yr ✓     Jupiter a=5.204 → P = 11.87 yr ✓
```

Inner worlds whip around while outer ones crawl — the differential rotation
alone sells a system as a *system*. Give each system a random orientation
(uniform on the sphere: `cos i` uniform in [−1,1]) but keep planets within it
roughly coplanar (~7° spread, like ours).

**And the frost line decides what kind of planets exist** — replacing the
current fully-random `hue: Math.floor(Math.random() * 360)`
([starfield.html:178](starfield.html:178)), which can produce a neon-magenta
rocky world for no reason:

```
frost line     a_snow ≈ 2.7 · √(L/L☉) AU     → inside: rocky · outside: gas/ice giant
habitable zone r_HZ  ≈ 1.0 · √(L/L☉) AU
```

For the Sun that puts the frost line at 2.7 AU — **exactly the asteroid
belt** — and the habitable zone at 1 AU. The formula validates itself.

The consequence is the best part: for an M5 dwarf (`L ≈ 0.002 L☉`) the frost
line sits at **0.12 AU** and the habitable zone at 0.045 AU. M-dwarf systems
come out tiny and tightly packed — which is precisely what TRAPPIST-1 looks
like in reality (seven planets inside 0.06 AU). Since 76% of stars are M
dwarfs (§4), **most systems in the game become compact red huddles**, with
sprawling Sun-like systems as the rarity. Emergent variety, zero authored
content.

Then colour planets by physical class — rock, iron, ice, water, gas giant —
instead of random hue.

## 12. Black holes with real general relativity

A black hole is currently a hazard with a smaller radius and a **static**
accretion ellipse — `object.phase` is randomized once at spawn and reused
unchanged every frame ([starfield.html:441](starfield.html:441)), so the disk
never turns. The real object is the most spectacular thing in physics:

```
Schwarzschild radius   r_s = 2GM/c² = 2.953 km × (M/M☉)
photon sphere          1.5 r_s
ISCO (last stable orbit) 3 r_s
apparent shadow        (3√3/2)·r_s ≈ 2.598 r_s      ← what the EHT imaged
light deflection       α = 4GM/(c²b) = 2r_s/b       (weak field)
```

**Gravitational lensing is genuinely easy to render** and will be the most
striking thing in the game: for each background star at screen-space impact
parameter `b` from the hole's centre, push it *radially outward* by
`Δθ = 2r_s/b`. Stars smear and swim around the dark disk; near-perfect
alignment produces an **Einstein ring**. Cap the displacement inside the
photon sphere where the weak-field formula diverges.

**Beam the disk properly.** Matter at the ISCO orbits at roughly 0.5c, so the
approaching side is brightened by `D⁴` — one side of the ring blazes, the
other dims. That asymmetry is exactly what the Event Horizon Telescope
photographed and what *Interstellar* rendered. Animate `phase` over time so
it actually spins.

Use **real black holes** as set pieces:

| Object | Mass | r_s | Distance |
|---|---|---|---|
| Gaia BH1 (nearest known) | 9.6 M☉ | 28 km | 1,560 ly |
| Cygnus X-1 | 21 M☉ | 62 km | 7,200 ly |
| Sagittarius A* | 4.3×10⁶ M☉ | 12.7 million km (0.085 AU) | 26,670 ly |
| M87* | 6.5×10⁹ M☉ | 128 AU (bigger than Pluto's orbit) | 55 Mly |

Sgr A* sits at the galactic centre — which the 1g burn table (§6) says you
reach at **τ ≈ 10 ship-years.** The game already has a destination; it just
doesn't know it yet.

---

# Part IV — Make the journey real

## 13. The milestone ladder

The distance counter currently just climbs. Real space has real waypoints, so
announce them — each one earned, each one true:

| Distance | Milestone |
|---|---|
| 1 ly | outer edge of the Oort cloud |
| 4.24 ly | Proxima Centauri — the nearest star |
| ~300 ly | edge of the Local Bubble (ISM density jumps 20×, §9) |
| 444 ly | the Pleiades |
| 1,344 ly | the Orion Nebula |
| ~1,000 ly | you leave the thin disk — the galaxy becomes a *view* |
| 7,000 ly | the Pillars of Creation |
| 26,670 ly | Sagittarius A* — the galactic centre |
| 105,700 ly | the far edge of the Milky Way; turn around and see it whole |
| 163,000 ly | the Large Magellanic Cloud |
| 2.54 Mly | **Andromeda** |
| 53.8 Mly | the Virgo Cluster |
| 250 Mly | the Great Attractor |
| 700 Mly | the Boötes Void — 700 Mly of almost nothing |
| ~16 Gly | **the cosmological event horizon** |
| 46.5 Gly | the edge of the observable universe |

That second-to-last row deserves to be the game's ending. Because of
accelerating expansion (`H₀ ≈ 70 km/s/Mpc`, Hubble length `c/H₀ = 14.0 Gly`),
there is a comoving distance of ~16 Gly beyond which **you can never arrive,
at any speed, ever** — the space in between grows faster than you can cross
it. A wall that no engine can pass, made of geometry. It connects straight to
the site's [expansion chapter](../projects/spacetime/04-expansion.html), and
it is a real, true, quietly devastating place to end a flight.

## 14. The honesty ledger

Keep a page (or an easter egg — the site already has `EASTER_EGGS.md`) stating
exactly where the game cheats, with the arithmetic. It fits the site's voice
and it's a genuinely great fact:

```
stellar cross-section  σ = πR☉² = 1.7×10⁻¹⁴ ly²
number density         n = 0.004 stars/ly³
mean free path         ℓ = 1/(nσ) ≈ 2.4×10¹⁶ ly
```

**Flying in a straight line through the real galaxy, you would cover about
24 quadrillion light-years before hitting a star** — roughly a million times
the width of the observable universe. Space is so empty that the honest
version of this game is unlosable. We inflate collision cross-sections by
~10¹⁵ so there's a game at all. Saying so out loud is more charming than
pretending otherwise, and it's the kind of detail that makes the rest of the
realism credible.

---

# Part V — Feel, sound, controls

Carried over from the first draft, sharpened — but note that several items
are now *obsolete*, because real physics replaced them: the arbitrary
difficulty ramp is now the CMB/ISM curve (§9), and the wormhole boost is now
the relativistic rocket (§6).

## 15. Impact and feedback

- **Crash** — `crash()` ([starfield.html:449](starfield.html:449)) freezes and
  pops a modal instantly. Add decaying screen shake (~0.4 s) and a white-hot
  flash *before* the modal. At relativistic speed the honest version is a
  gamma-ray flash, not a red one. Respect the `reducedMotion` flag already
  read at [starfield.html:86](starfield.html:86).
- **Near-miss** — the collision loop ([starfield.html:578](starfield.html:578))
  already has each hazard's screen radius. Add a band just outside the kill
  radius that fires a camera kick and a whoosh, once per hazard. Near-death
  currently registers as nothing at all.
- **Death message with real numbers.** "Collision with a planet" → "Impact
  with a 1.4 R⊕ rocky world at γ = 87. Ship time 4.2 s. Home time 6 min 4 s."

## 16. Sound

No audio at all today. [farlight](../projects/farlight/index.html) already
solves this pattern in-repo (`projects/farlight/index.html:240`): a lazily
created `AudioContext` on first gesture, a hum oscillator tracking speed, and
an `m`-key mute toggle. Reuse it rather than inventing a second approach.

Then make it physical: pitch the hum to **γ**, not to throttle position, so
you can *hear* the Lorentz factor climb. Layer in ISM impact hiss rising with
density (§9) — silent inside the Local Bubble, a roar outside it.

## 17. Controls & accessibility

- **Mobile is warp-only — a real bug.** `touchstart` unconditionally calls
  `setWarp(true)` ([starfield.html:261](starfield.html:261)), so touch players
  can never cruise. Separate steering (drag) from throttle (dedicated control
  or second finger).
- **No keyboard steering.** Keys only handle warp and restart
  ([starfield.html:276](starfield.html:276)); all aiming is pointer-only. Add
  WASD/arrows — and with §1's angular-rate model, keyboard flight finally
  feels correct rather than like a worse mouse.
- **No pause.** Add `Esc`/`P` with an overlay.
- **Reduced motion** should soften aberration and beaming, not disable the
  physics — cap the visual extremes, keep the simulation honest.

---

## 18. Rendering quality and frame budget

Three things in the current canvas setup that the physics work will make
much more visible:

- **The canvas ignores `devicePixelRatio` — everything is blurry on a retina
  screen.** `resize()` sets `canvas.width = innerWidth`
  ([starfield.html:93](starfield.html:93)) while the CSS stretches it to
  `100vw/100vh` ([starfield.html:10](starfield.html:10)). On a DPR-2 display
  that's a half-resolution backing store scaled up, so every star is a soft
  2×2 smudge instead of a point. For a game whose entire visual identity is
  *pinpoint stars*, this is the highest quality-per-line fix in the document:
  ```js
  const dpr = Math.min(devicePixelRatio || 1, 2);   // cap at 2 for fill-rate
  canvas.width  = innerWidth  * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width  = innerWidth  + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ```
  Keep `W`/`H` in CSS pixels afterwards so none of the projection math
  changes.
- **`drawBackdrop()` rebuilds four full-screen gradients every frame.**
  ([starfield.html:297-317](starfield.html:297)) — one linear plus three
  radial, each followed by a full-viewport `fillRect`, so the whole screen is
  overdrawn four times before anything else is painted. It depends only on
  `W`/`H`. Render it once to an offscreen canvas on resize and blit it. Free
  frame budget, and §10 is about to ask for thousands of additional points.
- **The canvas has no fallback content.** `<canvas id="sky" aria-label="…">`
  ([starfield.html:61](starfield.html:61)) is empty, so anyone who can't run
  it gets nothing at all. A sentence of child markup describing the game
  costs nothing and is what the element is for.

# Build order

Each stage is playable and visibly better than the last.

0. **Restructure first.** Move to `projects/starfield/`, split the existing
   591 lines into the layout above, update the five references, verify it
   still opens from `file://`. Pure refactor — no behaviour change, nothing
   to debug — but doing it *before* the physics lands means every stage below
   has a home to go in, instead of one file growing to 5,000 lines and being
   split under pressure later.
1. **§1 camera + §2 depth sort.** Everything else renders through these. Ship
   this alone and the game already feels different — it becomes flight.
2. **§4 blackbody LUT + IMF, §5 Poisson spacing.** Small, self-contained, and
   the sky's whole mood changes.
3. **§3 real star catalogue.** Now the neighbourhood is *the* neighbourhood.
4. **§6 relativistic rocket + §7 two clocks.** The core mechanic. Delete fake
   warp.
5. **§8 aberration/Doppler/beaming.** The showpiece — and cheap, because the
   colour LUT (§4) and camera basis (§1) already exist.
6. **§9 CMB + ISM.** Difficulty and tension, from physics rather than tuning.
7. **§11 Kepler orbits + frost line.** Systems come alive.
8. **§10 galaxy resolve.** The largest single piece; wants §1 and §4 in place.
9. **§12 black hole GR.** The set piece, aimed at Sgr A*.
10. **§13 milestones, §14 ledger, §15–17 polish.**

**Do §18's DPR fix during step 0.** It's five lines, it changes no maths, and
it sharpens every single thing built afterwards — there's no reason to render
the next ten stages at half resolution while deciding whether they look good.

# Data files

All static, all hand-readable, each its own file under `data/` so the
catalogues stay editable (see layout above). Nothing is fetched at runtime —
they're plain `<script>` tags assigning literal arrays, so `file://` works.

| File | Contents | Source | Size |
|---|---|---|---|
| `stars-near.js` | nearest ~100 systems: name, RA, Dec, parallax, spectral type, magnitude | RECONS / Gliese catalogue | ~4 KB |
| `stars-bright.js` | ~30 famous distant stars as steerable landmarks | Hipparcos / Gaia | ~1 KB |
| `deep-sky.js` | Messier & NGC highlights — nebulae, clusters, galaxies, with real distances and types | Messier catalogue | ~3 KB |
| `milestones.js` | the §13 distance ladder | — | ~1 KB |

The **blackbody colour LUT** isn't a data file — `color.js` computes it at
load from Planck's law + the CIE colour-matching functions, 1,000–40,000 K in
100 K steps (~390 entries). Generating it beats shipping it: the code
documents the physics, and it costs well under a millisecond.

One judgement call worth making early: catalogue coordinates are RA/Dec/
parallax, but the renderer wants Cartesian light-years (§3). Convert **once at
load**, not per frame, and keep the original catalogue values in the data
files so they stay checkable against a real star chart.

# Constants sheet

```
c = 299,792,458 m/s              1 ly = 9.4607×10¹⁵ m
1 pc = 3.2616 ly                 1 AU = 1.496×10¹¹ m = 1.581×10⁻⁵ ly
Julian year = 31,557,600 s       ← already correct at starfield.html:87
g = 9.80665 m/s²                 c²/g = 0.9688 ly    c/g = 0.9688 yr
T_CMB = 2.72548 K                Wien b = 2.898×10⁻³ m·K
R☉ = 6.957×10⁸ m = 7.35×10⁻⁸ ly  r_s = 2.953 km per M☉
local stellar density n ≈ 0.004 /ly³
H₀ ≈ 70 km/s/Mpc                 c/H₀ = 14.0 Gly
```
