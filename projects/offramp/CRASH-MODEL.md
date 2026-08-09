# OFFRAMP — crash model

A build specification. This replaces the current collision and wreck code in
`src/offramp.js` with one general solver plus three models that sit on top of
it. It is written to be implemented without further design decisions: every
constant, formula, sign convention and verification case is given.

**Read this whole document before writing code.** The parts interlock, and the
most common way to get this wrong is to implement section 4 without section 8,
which produces a model that appears to work and is wrong everywhere.

---

## 0. Why this exists, and the one rule that governs it

The current model is four bespoke tests, each with its own hand-tuned
threshold: `scrapeWall()` for the median, a trip test for soft ground, a fence
test, and a speed check on the gore nose. Each was tuned separately against
feel. They do not agree with each other and they cannot be extended.

Traffic is coming. Traffic is the point of the game; this road is the practice
ground for it. A fifth bespoke test for car-into-car — and then a sixth for
car-into-car-into-barrier — is not a thing anyone can tune. So the crash model
has to become general **before** traffic exists, not after.

All four existing cases are the same event with different numbers:

| what you hit | mass | stiffness | restitution |
|---|---|---|---|
| concrete median | infinite | rigid | ~0.10 |
| impact attenuator | infinite | 6 m of crush stroke | ~0 |
| right-of-way fence | negligible | none | — |
| another car | comparable, and it moves | ~0.5 m of crush | 0.05–0.30 |
| a loaded truck | ~24× yours | rigid in practice | ~0.10 |

One solver handles all of them. The barrier is the case where the other mass
is infinite.

### The governing rule

> **Realism beats interest. If the accurate answer is boring, ship the boring
> answer.**

This is the author's explicit instruction and it overrides any instinct toward
game feel. Concretely, it means:

- The low end of every risk curve goes to **zero**, not to "a small chance."
  Drifting two wheels onto the grass at 40 mph is a non-event. It costs speed
  and dignity and nothing else, because that is what it costs in life.
- Do not add a fudge factor to make something "matter." If the physics says it
  does not matter, it does not matter.
- Do not compress the dynamic range so that everything is exciting. Most
  contact is nothing; a little of it is fatal; there is not much in between,
  and that gap is real.

---

## 1. Scale, units and conventions

Getting this wrong is the single largest risk in the build. The existing
codebase mixes three unit systems and the mixing is deliberate and documented.

### Existing scale (do not change these)

Defined at `src/offramp.js:86-96`:

```js
const M_PER_PX   = 0.179;                      // one world pixel, in metres
const PX_PER_KMH = (1000/3600) / M_PER_PX;     // 1.55183 px/s per km/h
const KMH_PER_MPH = 1.609344;
const V_MAX      = 220 * 1.609344;             // 354.06 km/h
const LAT_MAX    = 124;                        // px/s across the road
```

### The three systems, and where each is used

| system | used for | conversion |
|---|---|---|
| **px, px/s** | everything the game stores: `S.u`, `S.vu`, positions, `LAT_MAX` | — |
| **km/h** | `S.speed` only, and every HUD reading | `px/s = kmh × 1.55183` |
| **SI (m, m/s, kg, N·s)** | **the solver, and only the solver** | `m = px × 0.179` |

**Rule: the solver is pure SI. It never sees a pixel and it never sees km/h.**
Convert on the way in, convert on the way out. This is not stylistic — the
impulse-momentum equations have mass in them, and mass has no meaning in a unit
system where distance is pixels. Every published crash figure this document
cites is SI or km/h, and a solver in SI can be checked directly against them.

Helper functions to add:

```js
const M_PER_S_PER_PX_S = M_PER_PX;             // px/s  -> m/s   (×0.179)
const pxs2ms  = (v) => v * M_PER_PX;
const ms2pxs  = (v) => v / M_PER_PX;
const kmh2ms  = (v) => v / 3.6;
const ms2kmh  = (v) => v * 3.6;
```

### Sign conventions

These already exist in the codebase and must be preserved:

- `S.u` — offset **across the road**. Positive is one side, negative the other.
  The median sits at `u = 0`.
- `S.vu` — lateral velocity **in the car's frame**, px/s.
- `S.fwd` — which way round the road the car points. `dir = S.fwd ? 1 : -1`
  converts car-frame to road-frame. See `src/offramp.js:1031`.
- `S.h` — the **road's** heading. The car does not have its own heading except
  during a wreck, where `S.roll` is the offset from it. See the header comment
  at `src/offramp.js:377-390`.

**In the solver**, use a local frame per collision:

- `n̂` — unit contact normal, pointing **from the struck object toward the
  striking vehicle** (i.e. out of the surface that was hit).
- `t̂` — unit tangent, `t̂ = (-n̂.y, n̂.x)`.
- Approach is `(u_rel · n̂) < 0`. If it is `≥ 0` the bodies are separating and
  **no impulse is applied** — return immediately. Skipping this check causes
  bodies to stick together and is the classic failure mode.

### Vehicle constants

Car dimensions already exist at `src/offramp.js:629`: `PW = 11, PL = 26` px,
which is 1.97 m × 4.65 m. Add:

```js
const CAR_MASS = 1500;                 // kg, mid-size sedan, kerb + driver
const CAR_IZ   = 2200;                 // kg·m², yaw moment of inertia
```

`CAR_IZ` for a body of other dimensions: `I ≈ 0.8 × m × (L² + W²) / 12`. The
0.8 accounts for a car's mass being more centrally concentrated than a uniform
rectangle. For the player car this gives 2550; measured values for real sedans
are 2000–2500, so **2200 is used directly** rather than the formula.

---

## 2. Inventory: what exists now and what happens to it

Everything below is in `src/offramp.js` unless stated.

| location | what it is | fate |
|---|---|---|
| `:166` `severity(lat, v)` | the ad-hoc product model | **delete** |
| `:180` `BAR_KILL = 62` | median lethality threshold | **delete** |
| `:181` `BAR_BITE = 0.085` | one-shot speed loss on wall contact | **delete** — solver produces it |
| `:182` `BAR_DRAG`, `BAR_DRAG_V` | sustained grind cost | **keep** — friction during contact, not a collision |
| `:198` `BAR_KICK`, `BAR_KICK_FADE` | the wall's redirect | **delete** — solver produces the exit velocity |
| `:278` `TRIP_KILL`, `V_TRIP`, `TRIP_DIG` | soft-ground trip test | **delete** — replaced by §6 |
| `:282` `V_FENCE = 80` | fence lethality | **delete** — solver, with fence mass |
| `:294` `NOSE_KILL`, `:295` `NOSE_KEEP` | attenuator | **delete** — replaced by §5 |
| `:203-205` `V_DIRT`, `DIRT_DRAG`, `DIRT_PLOUGH`, `DIRT_GRIP`, `GRAVEL_GRIP` | surface drag and grip | **keep** |
| `:221` `DIRT_MAX` | distance to the fence | **keep** |
| `:301` `WRECK_PULL`, `WRECK_TORQUE` | wreck dynamics | **keep** |
| `:839` `scrapeWall(road, dt)` | median contact | **rewrite** — §4.4 |
| `:707` `hitNose(ex, split)` | gore nose | **rewrite** — §5 |
| `:967-993` the `if (dirt)` block | trip and fence tests | **rewrite** — §6 |
| `:1017-1035` steering | commands lateral rate directly | **rewrite** — §8 |
| `:1211` `crash(cause, side)` | starts the wreck sequence | **extend** — §7, takes an outcome |
| `:1740-1790` the wreck update | slides, ignores the world | **extend** — §9 |

New file: **`src/impact.js`**. Pure functions, no DOM, no globals, no
dependency on `Road`, `World`, `Draw` or `S`. It must be testable in isolation
by calling it with numbers. This is a hard requirement — §11 depends on it.

---

## 3. Architecture

```
  src/impact.js          pure SI, no state
    solve(a, b, contact)      → { dv_a, dv_b, impulse, va', vb', wa', wb' }
    restitution(vClosing)     → ε
    injury(dvEff)             → { pFatal, pDisabling }
    effectiveDv(dv, angle)    → dv weighted by impact direction
    rolloverRisk(vLat, soil)  → probability
    crushStop(v, stroke)      → { survivable, gPeak, vOut }

  src/offramp.js         converts units, supplies bodies, applies results
    hitBarrier()  ┐
    hitNose()     ├─ all four build a body pair and call solve()
    hitFence()    │
    hitCar()      ┘   (the last one lands with traffic; write the seam now)

  src/skill.js           the driver-competence score (§8 of the design, here §10)
```

`impact.js` exports one object, `Impact`, matching the file's existing module
style (see the top of `road.js` and `world.js` for the pattern in use).

---

## 4. The collision solver

Planar impulse-momentum with Coulomb friction. This is the standard tool of
crash reconstruction; it is not an approximation invented for this game.

### 4.1 Inputs

A **body** is:

```js
{ m,        // kg. Infinity for a fixed object (barrier, attenuator backing)
  Iz,       // kg·m². Infinity for a fixed object
  v,        // { x, y } velocity of the centre of gravity, m/s, world frame
  w,        // yaw rate, rad/s, positive counter-clockwise
  r }       // { x, y } vector from CG to the contact point, m, world frame
```

A **contact** is:

```js
{ n,        // { x, y } unit normal, from body b toward body a
  mu }      // tangential friction coefficient at the contact patch
```

### 4.2 The equations

2D cross products are scalars: `cross(p, q) = p.x*q.y - p.y*q.x`.

**Step 1 — velocity at the contact point.** For each body:

```
u_i = v_i + ω_i × r_i          which in 2D is:
u_i.x = v_i.x - ω_i * r_i.y
u_i.y = v_i.y + ω_i * r_i.x
```

**Step 2 — relative velocity and the approach test.**

```
u_rel = u_a - u_b
v_n   = u_rel · n̂
if (v_n >= 0) return null      // separating: no impulse, no damage
```

`v_n` is negative when approaching. **`vClosing = -v_n`** and is positive.

**Step 3 — effective masses.**

```
k_n = 1/m_a + 1/m_b + cross(r_a, n̂)² / Iz_a + cross(r_b, n̂)² / Iz_b
k_t = 1/m_a + 1/m_b + cross(r_a, t̂)² / Iz_a + cross(r_b, t̂)² / Iz_b
```

With `m = Infinity` and `Iz = Infinity`, the reciprocals are 0 and this is
correct with no special case. **Do not write a branch for the barrier.**

**Step 4 — normal impulse.**

```
ε   = restitution(vClosing)
j_n = (1 + ε) * vClosing / k_n
```

**Step 5 — tangential impulse, Coulomb-limited.**

```
v_t      = u_rel · t̂
j_t_full = -v_t / k_t                       // what it would take to stop sliding
j_t      = clamp(j_t_full, -mu * j_n, mu * j_n)
```

The clamp is what makes a shallow barrier hit behave correctly: the tangential
velocity along a wall is enormous (the whole road speed) and can never be
arrested, so `j_t` saturates at the friction limit. This is where the road
speed enters the model — **not** through a multiplication, but because a fast
car drags along the wall under a friction impulse for as long as contact
lasts.

**Step 6 — apply.**

```
J = { x: j_n*n̂.x + j_t*t̂.x,  y: j_n*n̂.y + j_t*t̂.y }

v_a' = v_a + J/m_a          ω_a' = ω_a + cross(r_a, J)/Iz_a
v_b' = v_b - J/m_b          ω_b' = ω_b - cross(r_b, J)/Iz_b
```

**Step 7 — delta-v, the injury currency.**

```
Δv_a = |J| / m_a            // m/s
Δv_b = |J| / m_b
```

This is the magnitude of the change in the centre-of-gravity velocity, which
is exactly what crash reconstruction calls delta-v. It is the number every
injury correlation in section 4.5 is written against.

### 4.3 Restitution

Vehicle restitution is strongly speed-dependent: cars bounce at parking speed
and crush at highway speed.

```js
const restitution = (vClosing) => 0.05 + 0.30 * Math.exp(-vClosing / 8);
```

`vClosing` in m/s. This is an empirical shape, not a law; the constants are
tunable but the behaviour is not:

| closing speed | ε |
|---|---|
| 0 (parking) | 0.35 |
| 11 km/h | 0.26 |
| 36 km/h | 0.14 |
| 100 km/h | 0.06 |

For the **attenuator** override ε to 0, and for **concrete** clamp it to a
maximum of 0.10.

### 4.4 Contact parameters per object

| object | m (kg) | Iz | mu | ε override |
|---|---|---|---|---|
| concrete median | Infinity | Infinity | 0.40 | cap at 0.10 |
| attenuator (within stroke) | Infinity | Infinity | 0.30 | 0 |
| attenuator (past stroke) | Infinity | Infinity | 0.40 | cap at 0.10 |
| right-of-way fence | 40 | 60 | 0.60 | 0.05 |
| passenger car | 1500 | 2200 | 0.55 | formula |
| light truck / SUV | 2270 | 3400 | 0.55 | formula |
| loaded semi | 36000 | 900000 | 0.55 | formula |

`mu = 0.40` for concrete is sheet metal and tyre sidewall against a rough
vertical face. Do not raise it — a higher value makes the wall arrest the car
longitudinally, which is the thing a barrier is specifically designed not to
do.

### 4.5 Impact direction weighting

**The same delta-v is roughly twice as injurious side-on as frontal**, because
there is no crush zone between the door and the occupant. This one fact will
shape the entire traffic game and it must not be omitted.

Compute the angle of the impulse vector `J` in the **car's** frame — 0° is
straight into the nose, 90° is into the driver's side, 180° is into the tail.

```js
function directionFactor(angleDeg) {
  const a = Math.abs(((angleDeg + 180) % 360) - 180);   // 0..180
  if (a <=  30) return 1.00;                            // frontal
  if (a <=  60) return 1.00 + 0.80 * (a - 30) / 30;     // oblique, 1.00 → 1.80
  if (a <= 120) return 1.80;                            // side
  if (a <= 150) return 1.80 - 1.10 * (a - 120) / 30;    // oblique rear, 1.80 → 0.70
  return 0.70;                                          // rear
}
const effectiveDv = (dv, angleDeg) => dv * directionFactor(angleDeg);
```

### 4.6 Delta-v to outcome

Two logistic curves on effective delta-v in **km/h**:

```js
const pFatal     = (d) => 1 / (1 + Math.exp(-0.118 * (d - 65)));
const pDisabling = (d) => 1 / (1 + Math.exp(-0.118 * (d - 45)));
```

These are fitted to the belted-adult-in-a-modern-car anchors: serious injury
risk climbing steeply above ~40 km/h delta-v, roughly 50% fatality at 65.

| Δv_eff (km/h) | P(fatal) | P(disabling) |
|---|---|---|
| 20 | 0.5% | 5.0% |
| 30 | 1.6% | 14.6% |
| 40 | 5.0% | 35.7% |
| 50 | 14.6% | 64.3% |
| 60 | 35.7% | 85.4% |
| 65 | 50.0% | 91.4% |
| 80 | 85.4% | 98.4% |
| 100 | 98.4% | 99.8% |

`pDisabling` is the **cumulative** probability of at least a disabling result,
so it is always ≥ `pFatal`. Resolve with a single uniform roll:

```js
const r = Math.random();
const outcome = r < pFatal(d)     ? "fatal"
              : r < pDisabling(d) ? "disabling"
              : d > 12            ? "damage"
                                  : "superficial";
```

| outcome | what happens |
|---|---|
| `fatal` | run ends. Full wreck sequence. |
| `disabling` | run ends. Full wreck sequence. Panel says the driver would have survived. |
| `damage` | **run continues** with a defect — see §7. |
| `superficial` | noise, sparks, paint, a speed cost from the impulse. Nothing else. |

**One roll, not two.** Rolling separately for each band produces incoherent
results (fatal but not disabling).

---

## 5. The attenuator is a crush stroke, not a rating

`NOSE_KILL = 110` is a *test speed*, not a survivability limit. What decides
the outcome is deceleration over the device's crush length.

```js
function crushStop(v, stroke) {           // v m/s, stroke m
  const a = (v * v) / (2 * stroke);       // mean deceleration, m/s²
  return { gPeak: a / 9.81 * 1.6, aMean: a };   // peak ≈ 1.6 × mean
}
```

Attenuator stroke: **6.0 m** (a full-size highway unit).

If `v` is fully absorbed within the stroke, delta-v is the whole approach speed
and the direction is frontal (factor 1.00). Feed it to §4.6 as normal.

If the car exhausts the stroke, it hits the rigid backing at the residual
speed, and the residual is:

```
v_out = sqrt( max(0, v² - 2 * a_max * stroke) )      with a_max = 20 g = 196 m/s²
```

Then run the solver again against a rigid infinite mass at `v_out`.

Worked results with `stroke = 6.0`:

| approach | mean g | Δv absorbed | result |
|---|---|---|---|
| 60 km/h | 2.4 g | 60 | superficial to damage |
| 110 km/h | 7.9 g | 110 | disabling likely, fatal ~99% — see note |
| 160 km/h | 16.8 g | 160 | fatal |

**Note on the 110 km/h row.** A frontal Δv of 110 km/h reads as near-certain
fatality on the §4.6 curve, yet a real attenuator is *certified* at that speed
and the occupant walks away. The curve is not wrong and the device is not
wrong — the difference is ride-down. The §4.6 curves are fitted to
car-into-car and car-into-barrier events where crush is short and the
deceleration pulse is brutal. An attenuator's whole purpose is to stretch the
same delta-v over 6 m.

**So the attenuator gets a ride-down credit**, and this is the one place the
model needs it:

```js
// mean deceleration of a hard car-to-car frontal, for reference: ~25 g
const RIDEDOWN_REF_G = 25;
const rideDownFactor = (gMean) => clamp(Math.sqrt(gMean / RIDEDOWN_REF_G), 0.25, 1.0);
dvEff = dv * directionFactor(angle) * rideDownFactor(gMean);
```

At 110 km/h into 6 m the mean is 7.9 g, giving a factor of 0.56, so
`dvEff = 110 × 1.00 × 0.56 = 62 km/h` → 41% fatal, 89% disabling. That is the
right answer: a crash cushion hit at its design speed destroys the car and
usually does not kill you, which is precisely what it is bought for.

Apply `rideDownFactor` to **every** impact, not just the attenuator — a
car-to-car frontal computes to ~25 g and therefore a factor of 1.0, so nothing
else changes, and the model stays general. Compute `gMean` as
`Δv / (contact duration)`, using a contact duration of **0.10 s** for all
vehicle and barrier impacts (a well-established figure for the crush phase)
and `2 × stroke / (v_in + v_out)` for the attenuator.

---

## 6. Soft ground is not a collision

Everything above models an impact. Leaving the road is not one — it is a
friction and moment problem, and it is **genuinely stochastic**. Two identical
cars leaving the road at the same speed and angle do not have the same
outcome, and the difference is whether that particular wheel found a rut, a
drain, a soft patch or a stone. That is unknowable, so a probability is the
honest model and a threshold is not.

### 6.1 The rollover floor is physical and deterministic

To roll, the centre of gravity must be lifted over the outside tyre:

```
t  = half track      = 0.75 m
h  = CG height       = 0.55 m
Δh = √(t² + h²) − h  = 0.380 m
η  = trip efficiency = 0.35        (fraction of lateral KE that goes into roll)

v_crit = √(2 g Δh / η) = 4.62 m/s = 16.6 km/h
```

**Below 16.6 km/h of lateral velocity a car cannot be tripped. Ever. Return
zero.** This is not a tuning choice, it is an energy balance, and it is what
makes a low-speed excursion into the grass a guaranteed non-event.

Store `SSF = t / h = 1.36` — Static Stability Factor — so the number can vary
by vehicle later. A sedan is ~1.4, an SUV ~1.1.

### 6.2 Probability above the floor

```js
const V_CRIT = 16.6;                                   // km/h
function rolloverRisk(vLat, soil = 1.0) {              // vLat km/h
  if (vLat <= V_CRIT) return 0;
  const x = (vLat - V_CRIT) / V_CRIT;
  return Math.min(0.85, 0.538 * x * x * soil);
}
```

Quadratic because the criterion is an energy one. `soil` is the ground factor:

| ground | factor |
|---|---|
| packed, dry, mown | 0.70 |
| ordinary verge | 1.00 |
| soft, ploughed, wet | 1.30 |
| verge with a fill slope | 1.55 |

Resulting curve:

| lateral speed | P(roll) |
|---|---|
| ≤ 16.6 km/h | 0% |
| 20 | 2.2% |
| 25 | 13.7% |
| 29 | 29.9% |
| 35 | 65.9% |
| ≥ 40 | 85% (capped) |

### 6.3 Forward speed does not decide *whether*, it decides *how bad*

This is the correction to the old model, which scored the trip with the same
speed-weighted product as the barrier. Rollover **initiation** is a lateral
phenomenon and is nearly independent of forward speed. Forward speed decides
how many times the car goes over, and therefore the outcome.

Given a roll has been initiated, the number of quarter-turns scales with the
forward kinetic energy remaining:

```js
const quarterTurns = Math.max(1, Math.round(0.9 * (vFwd / 100) ** 2));  // vFwd km/h
```

| forward speed | quarter turns | outcome |
|---|---|---|
| 60 km/h | 1 | `damage` — onto its side, run ends undramatically |
| 100 | 1 | `disabling` |
| 160 | 2 | `disabling`, `fatal` at 40% |
| 250 | 6 | `fatal` |

Map to the §4.6 bands with an equivalent delta-v of
`dvEff = 28 + 9 * quarterTurns` km/h, then roll once as in §4.6. This keeps a
single outcome pipeline for the whole game.

### 6.4 The fence

Delete `V_FENCE`. The fence is a body with `m = 40 kg` in the §4 solver. It
takes a few km/h off the car and is destroyed. A car does not wreck on a wire
fence — it wrecks on what is *past* the fence, and until there is something
past the fence, going through it should end the run with a plain "the right of
way ended" and no wreck sequence.

### 6.5 Delete the dig timer

`TRIP_DIG` was a 0.07 s window that existed to stop the trip test firing on
tarmac-derived lateral speed on the first frame off the pavement. Once §8 is in
place the lateral speeds are physical and the window is unnecessary. Evaluate
`rolloverRisk` **once**, on the frame the car crosses onto soil, using the
lateral velocity at that instant, and then not again until it returns to
pavement and leaves it a second time.

**Do not evaluate it every frame.** Doing so rolls the dice sixty times a
second and makes any nonzero probability certain within a fifth of a second.
This is the single most likely way to get this section wrong.

---

## 7. Damage is a state, not an event

The `damage` outcome band means the run continues with the car degraded. This
is what makes the model produce degrees rather than a binary, and it is also
the hook the debris and tyre mechanics will hang from later.

Add to `S`:

```js
S.dmg = {
  tyres: [0, 0, 0, 0],   // 0..1 accumulated damage, FL FR RL RR
  pull: 0,               // steering pull, px/s², signed; a bent corner
  dragK: 0,              // extra drag coefficient from lost bodywork
  blown: null,           // which tyre has failed, or null
};
```

Reset in `reset()` alongside the other per-run state at `src/offramp.js:1502`.

On a `damage` outcome, pick effects by where the impulse landed and how big it
was:

| Δv_eff | effect |
|---|---|
| 12–25 km/h | bodywork: `dragK += 0.04`, cosmetic |
| 25–40 | nearest tyre `+0.35`, `pull += ±25 px/s²` |
| 40+ | nearest tyre `+0.7`, `pull += ±60`, top speed capped at 70% |

### Tyre failure is delayed, and that is the accurate part

A tyre damaged by an impact very often does not fail at the moment of impact.
The sidewall breaks internally, the cords go, and it lets go later with no
proximate cause. Model it as a per-second hazard rate rather than a threshold:

```js
// per second, evaluated only while rolling
const blowoutRate = (dmg, v) => dmg < 0.25 ? 0
                              : 0.010 * (dmg - 0.25) ** 2 * (v / 200) ** 2;
```

At `dmg = 1.0` and 200 km/h that is 0.0056/s — a mean time to failure of about
three minutes of driving. Roll it per tyre per frame as
`Math.random() < rate * dt`.

**A blowout is not a crash.** It is a loss of control with a correct response
and a real window:

- **Front** — a hard steering pull toward the failed side: `S.dmg.pull` set to
  ±180 px/s². The driver must hold against it.
- **Rear** — a yaw, not a pull: add ±1.2 rad/s to `S.spin` and let `S.roll`
  become nonzero outside a wreck for the first time.

Correct response in both cases, and this should be what the game rewards
because it is what saves people in life: **do not brake, do not lift hard,
hold it straight, let it slow itself.** Braking during the window should
sharply increase the chance the car departs; holding throttle steady and
steering against it should recover. Give it a window of **1.2 s** before the
car is unrecoverable.

---

## 8. The friction circle — do not skip this

**Everything above is wrong without this section**, because the lateral
velocities the game currently produces are not physically reachable and would
feed absurd numbers into the solver.

### The problem, measured

`src/offramp.js:1027` chases `S.vu` toward the commanded rate with a 77 ms time
constant:

```js
S.vu = lerp(S.vu, want, 1 - Math.exp(-13 * dt));
```

From rest that is an initial lateral acceleration of `13 × 114 px/s²` =
1482 px/s², which at 0.179 m/px is **265 m/s² — 27 g**. A tyre on dry tarmac
gives about 0.9 g. The model is thirty times over.

The steady state is equally unreachable: `LAT_MAX` at 50 mph is 73.8 km/h of
lateral against 80 km/h forward, a 42° slip angle. That is not a swerve, it is
a car already spinning.

### The fix

Replace the rate-chase with an acceleration limit:

```js
const G = 9.81;
const MU = { lane: 0.90, shoulder: 0.85, gravel: 0.45, grass: 0.50 };

// available lateral acceleration, px/s², after the longitudinal demand
function latLimit(surface, longAccelMs2) {
  const mu = MU[surface] ?? 0.90;
  const total = mu * G;                                   // m/s²
  const lat = Math.sqrt(Math.max(0, total*total - longAccelMs2*longAccelMs2));
  return lat / M_PER_PX;                                  // px/s²
}
```

Then steer by moving `S.vu` toward `want` at no more than that rate:

```js
const lim = latLimit(surfaceOf(what), longAccel) * dt;
const d = clamp(want - S.vu, -lim, lim);
S.vu += d;

// and cap the steady state at a physical slip angle
const slipCap = pxs(S.speed) * Math.tan(12 * Math.PI / 180);
S.vu = clamp(S.vu, -slipCap, slipCap);
```

`longAccel` is the current throttle or braking acceleration in m/s². This is
the friction circle: brake hard and you have less grip to steer with, which is
true and which nothing in the game currently expresses.

### What this changes, and why it is right

At 220 mph, full lock from the inside lane now reaches the median in 0.64 s
having built 20.2 km/h of lateral — not 52.7. Run through the solver that is a
26.0 km/h delta-v, side-weighted to 46.9, giving **11% fatal, 56% disabling**.

The earlier conclusion that "there is no speed at which full lock into the
median is survivable" was true *given the unphysical lateral speeds the game
was producing*. With real ones, the median becomes what it is in life: usually
survivable from the adjacent lane, and lethal if you have three lanes in which
to build up sideways speed first. That is a better answer and it comes out of
the physics rather than a threshold.

**This section changes how the car feels.** Full lock becomes something steered
into over half a second rather than achieved in a frame. It is in tension with
the "the car does not turn, the road does" design in the file header, and the
author has accepted this. Do not soften it to preserve the old feel; the whole
model is calibrated against physical lateral speeds.

---

## 9. The wreck has to live in the world

`src/offramp.js:1765-1790` deliberately makes the wreck update ask nothing
about surfaces, with a single hard-coded exception clamping it out of the
median. That was a defensible simplification for a road with nothing on it. It
stops being defensible the moment traffic exists, because a pileup **is** a
chain of secondary impacts, and the secondary impact is what actually kills
people.

Changes:

1. Delete the bespoke wall clamp at `:1778-1790`. Instead, each wreck frame,
   test the car against the median and call the §4 solver on contact, with the
   wreck's current velocity and yaw rate as the body.
2. Register the wreck as a collidable body in the world so that traffic, when
   it arrives, can strike it. Define the interface now even though nothing
   consumes it yet.
3. A wreck that takes a further impact accumulates delta-v. Sum it, and report
   the total on the panel.

---

## 10. The skill score

A hidden 0–1 measure of demonstrated driver competence, in **`src/skill.js`**,
persisted in `localStorage`.

### 10.1 It is composed of rates, not totals

Totals only ever rise and a long bad run would outrank a short brilliant one.
Every component is a ratio.

```
C = (clean distance / total distance) × speedWeight     clean driving
X = (clean exits / exits attempted)                     exit execution
V = (saves made / savable incidents)                    recovery

speedWeight = clamp(meanSpeedWhileClean / 200, 0, 1)    km/h

E = 0.40 * C + 0.25 * X + 0.35 * V
```

Definitions, to be unambiguous:

- **clean distance** — distance covered with no contact of any kind and no
  wheel off the pavement.
- **exit attempted** — the car entered a deceleration lane. **Clean** — it
  reached the ramp without touching the gore, the nose, or a verge.
- **savable incident** — any frame in which the car was above `V_CRIT` of
  lateral velocity off-pavement, or in contact with the barrier, and did not
  end the run. A **save** is such an incident that ended with the car back on
  pavement under control within 3 s.

### 10.2 The window is distance, not runs

Five runs could be 200 km or five instant deaths. Anchor it to distance:

```js
const SKILL_WINDOW_KM = 100;
```

Keep a ring buffer of per-run records `{ km, cleanKm, meanSpeed, exits,
cleanExits, incidents, saves }` and drop the oldest whenever the total exceeds
100 km. This is a rolling window, and note that **a rolling window is itself
the decay mechanism** — evidence falls out the back rather than bleeding away.
No separate decay term is needed or wanted.

### 10.3 Cold start

With no evidence, `E = 0.5`. Blend evidence in as the window fills:

```js
const fill = clamp(totalKm / SKILL_WINDOW_KM, 0, 1);
const E = 0.5 * (1 - fill) + rawE * fill;
```

A new player starts in the middle. The game must not be hardest the first time
it is played.

### 10.4 Influence fades as severity rises

**This is the most important property in the section.** Skill has far less
purchase on a high-speed excursion than intuition suggests — it is precisely
why experienced and professional drivers die in run-off-road crashes. Once soft
ground has the car, the ground decides.

```js
const SKILL_MAX = 0.35;                    // maximum relative influence

function skillAdjust(p, sevNorm, E) {
  const shift = (E - 0.5) * 2;             // -1 .. +1
  const w = SKILL_MAX * (1 - clamp(sevNorm, 0, 1));
  return clamp(p * (1 - shift * w), 0, 0.95);
}
```

`sevNorm` is 0 at the point where the outcome first becomes possible and 1 at
the point where physics has taken over:

- **rollover**: `sevNorm = (vLat - V_CRIT) / (2.5 * V_CRIT)`
- **impact**: `sevNorm = (dvEff - 25) / 55`

Resulting spread on the rollover curve:

| lateral | base | best driver | worst driver |
|---|---|---|---|
| 20 km/h | 2.2% | 1.5% | 2.9% |
| 25 | 13.7% | 9.9% | 17.5% |
| 29 | 29.9% | 22.5% | 37.2% |
| 35 | 65.9% | 53.0% | 78.7% |
| 40+ | 85.0% | 72.0% | 95.0% |

A spread of about 1.3× at the dangerous end and much more at the safe end.
This sounds unsatisfying and it is correct. It also guarantees the skill score
can never trivialise a serious crash, so it cannot quietly become what the game
is about.

**Clamp after applying the modifier, not before** — otherwise the cap flattens
the spread at the top and produces the nonsense of a worse outcome at 40 km/h
than at 50.

### 10.5 Watch the feedback loop

Clean distance raises `E`, `E` improves survival, survival extends distance.
That compounds. The rates and the 0.95 clamp contain it, but the loop is there
and should be checked once the model runs: if mean run length grows without
bound across a session, the ceiling is too high.

---

## 11. Verification

`impact.js` is pure, so these are checkable directly. **Every one of these must
pass before anything is wired into the game.** All figures computed from the
formulas in this document.

### 11.1 Collision solver — central, collinear, no rotation

| case | expected Δv (striker) | Δv (struck) | ε |
|---|---|---|---|
| 1500 kg into rigid barrier at 100 km/h | 105.9 km/h | — | 0.059 |
| 1500 into stationary 1500, 100 km/h | 53.0 km/h | 53.0 km/h | 0.059 |
| 1500 at 100 into 1500 at 90 | 6.3 km/h | 6.3 km/h | 0.262 |
| 1500 into 36000 kg, 100 km/h closing | 101.7 km/h | 4.2 km/h | 0.059 |

Row 3 is the most important number in this document: **at highway speed it is
the differential that matters, not the speed.** A road full of cars all doing
200 km/h is far safer than one car doing 200 past a stopped truck. The current
model, which scores on `S.speed`, cannot express this — and once traffic
exists, `S.speed` is the wrong variable in nearly every test.

Row 2 gives the general equal-mass rule: **Δv ≈ 0.53 × closing speed** at
highway speeds, rising toward 0.65 at parking speeds as ε rises.

### 11.2 Median, oblique with tangential friction

`mu = 0.40`, contact at mid-flank so the rotation terms vanish.

| lateral in | forward | Δv | (normal, tangential) | side-weighted | P(fatal) |
|---|---|---|---|---|---|
| 52.7 km/h | 354 | 62.3 | (57.9, 23.2) | 112.2 | >99% |
| 20.2 | 354 | 26.0 | (24.2, 9.7) | 46.9 | 10.7% |
| 28.8 | 113 | 36.0 | (33.4, 13.4) | 64.8 | 49.8% |
| 15.0 | 113 | 19.9 | (18.4, 7.4) | 35.7 | 2.4% |

Row 1 is what the game produces today. Row 2 is the same input under §8, and
is the correct answer.

### 11.3 Rollover

`Δh = 0.380 m`, `v_crit = 4.62 m/s = 16.6 km/h`. Curve as tabulated in §6.2.
Assert `rolloverRisk(16.6) === 0` exactly.

### 11.4 Behavioural checks, in the game

Run these by hand once wired up. The tab is hidden so `requestAnimationFrame`
is frozen — capture the loop callback and step it manually with a monotonic
clock, as documented for the other projects in this repo.

| scenario | expected |
|---|---|
| two wheels onto grass at 40 mph, straight | nothing. Speed loss, dust, drive back on. |
| same at 70 mph, straight | nothing, more speed loss. |
| hard swerve off at 100 mph | ~30% roll, ~70% a big slide and a damaged tyre |
| hard swerve off at 150 mph | ~66% roll |
| feathered into the median at any speed | scrape, `superficial`, some paint |
| full lock into the median from the inside lane at 220 | ~11% fatal, ~56% disabling |
| gore nose at 60 km/h | survived, car wrecked, run continues degraded |
| gore nose at 160 km/h | fatal |
| the fence at any speed | run ends, no wreck sequence |

---

## 12. Build order

Do not reorder. Each step is verifiable before the next begins.

1. **`src/impact.js`** — the solver, restitution, direction factor, injury
   curves, ride-down, rollover risk, crush stop. Pure functions. Pass §11.1
   through §11.3 before touching anything else.
2. **§8, the friction circle.** Do this before wiring the solver in. It changes
   the lateral velocities that everything else consumes, and tuning against the
   old ones wastes the work.
3. **Wire in the barrier** (`scrapeWall`), then the **gore nose** (`hitNose`),
   then the **fence**. Delete each old threshold as its replacement lands.
4. **§6, the soil trip as a distribution.** Delete `TRIP_KILL`, `V_TRIP`,
   `TRIP_DIG`.
5. **§7, damage state and delayed tyre failure.**
6. **§9, the wreck in the world.**
7. **§10, the skill score.** Last, and deliberately so — traffic will thicken
   the control scheme enormously (gaps, timing, lane choice, closing speeds),
   and there may be nothing left for a competence proxy to proxy. Build it,
   then reassess whether it is still wanted.
8. **Report the numbers on the wreck panel.** `S.why` already carries a
   sentence; add the arithmetic beneath it — *"78 mph into soft ground, still
   crossed up — about one in three."* Seeing the odds after the fact is how the
   player learns the curve, and it is what keeps a probabilistic model from
   reading as arbitrary.

Only then, traffic.

---

## 13. Traps

Collected failure modes, in rough order of likelihood.

1. **Units.** The solver is SI. `S.vu` is px/s, `S.speed` is km/h. Convert at
   the boundary, never inside.
2. **Rolling the dice every frame.** §6.5. Evaluate rollover risk once per
   excursion, not per frame. At 60 fps any nonzero probability becomes a
   certainty in 200 ms.
3. **Skipping the separation test.** §4.2 step 2. If `v_n >= 0`, return with no
   impulse. Without it bodies stick.
4. **Special-casing infinite mass.** Do not. `1/Infinity === 0` in JavaScript
   and the equations are already correct.
5. **Two dice rolls for the outcome bands.** §4.6. One uniform, compared
   against cumulative thresholds.
6. **Implementing §4 without §8.** The solver will be fed 27 g lateral
   velocities and every result will be lethal. This will look like a bug in the
   solver and will not be one.
7. **Applying `rideDownFactor` only to the attenuator.** Apply it everywhere;
   it is 1.0 for ordinary impacts and the model stays general.
8. **Clamping before the skill modifier.** §10.4.
9. **Charging contact costs per frame instead of per second.** The existing
   code has extensive comments on this at `:1772-1777` and at `:173-179`,
   because it has bitten this codebase twice. Sustained contact is a rate.
   Arrival is an event, charged once per contact, tracked by `S.scrapeT` /
   `S.scrapeOff`.
10. **Making the saves quiet.** If 70% of a hard off-road excursion is
    "nothing," it must not be *undramatic* — big slide, dust, half the speed
    gone, the car light and squirming coming back on. If the good outcome is
    calm and the bad one ends the run, the model reads as the game picking on
    the player. If both are violent and only one ends it, it reads as luck,
    which is what it is.
11. **Softening the low end to make the grass "matter."** It does not matter at
    40 mph. That is the point, it is accurate, and the author has explicitly
    accepted the boredom.

---

## 14. Sources for the figures

So a future reader can check rather than trust.

- **MASH TL-3** — 2270 kg pickup at 100 km/h and 25°. The lateral component is
  42.3 km/h; impact severity ½mv² ≈ 155 kJ. This is the certification case the
  median barrier is designed against.
- **Flail space / OIV / ORA** (Michie, 1981) — occupant modelled as a free mass
  in a 0.6 m lateral, 2.0 m longitudinal box. MASH limits: OIV 9.1 m/s
  preferred and 12.2 m/s maximum; ORA 15.0 g preferred and 20.49 g maximum.
  This model uses delta-v rather than OIV directly, because delta-v is defined
  for vehicle-to-vehicle collisions and OIV is not, and traffic is the target.
- **Delta-v injury correlation** — for belted adults in modern cars, serious
  (MAIS3+) injury risk climbs steeply above roughly 40 km/h delta-v, with
  approximately 50% fatality in the 60–70 km/h range for frontal impacts. Near-
  side lateral impacts reach comparable risk at roughly half the delta-v, which
  is the basis of the 1.8 direction factor.
- **Restitution** — vehicle coefficient of restitution falls from roughly
  0.3–0.4 at parking speeds to under 0.1 at highway closing speeds. The
  exponential in §4.3 is a fit to that behaviour, not a published law.
- **Rollover** — approximately 95% of single-vehicle rollovers are *tripped*
  rather than caused by cornering alone. Static Stability Factor = track ÷
  (2 × CG height): ~1.4 for a passenger car, ~1.1 for an SUV. The energy
  balance in §6.1 is standard; the 0.35 trip efficiency is the tunable term and
  is at the conservative end of the 0.15–0.40 range reported for furrow trips.
- **Run-off-road** — the great majority of roadway departures end with the
  driver simply recovering; this is the basis of roadside clear-zone design.
  The crashes are the tail of the distribution, not the centre of it. §6.2
  reproduces this: zero risk below 16.6 km/h lateral, and most excursions never
  reach it.
- **Attenuator** — a full-size highway crash cushion has roughly 6 m of crush
  stroke, giving about 7.9 g mean deceleration at its 110 km/h design speed.
- **Sight distance** — the camera shows about 320 px of road ahead of the car
  (`PY = 320` in a 416-tall buffer, `src/draw.js:53`), which is 57 m. At 220 mph
  that is 0.58 s of warning against a 1.5 s perception-reaction time. **Any
  future hazard the player is expected to avoid must therefore be signalled by
  its approach — skid marks, a gouge in the verge, the wreck itself — and not
  by the hazard alone.** This constrains the debris mechanic that follows this
  work.
