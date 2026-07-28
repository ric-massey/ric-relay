# Starfield — Controls Specification

> **Status:** Implemented in Slice B (2026-07-26). The default desktop and touch
> schemes, the action model, rebinding and the generated help are live in
> [`slice.html`](../slice.html); the gamepad adapter is not yet built.<br>
> **Written:** 2026-07-25, at Ric's direction that **"I want the controls to work well"**<br>
> **Governs:** the flight-control model, the default desktop/gamepad/touch schemes,
> input feel, rebinding, and accessibility.

---

## 1. Why this document exists

Ric's verdict on the prototype was blunt: **"the controls suck."** That is the single
most important usability problem in the project, and until now the documentation
explicitly refused to solve it — the Earth–Moon slice says "the exact mapping is a
usability decision, not a design law," which left the most-complained-about system with
no owner.

This document takes ownership. **Controls are a design law here**, because a flight
simulator whose flying feels bad has failed regardless of how correct its physics are.

### 1.1 Diagnosis — why the prototype feels bad

This is not a vague complaint. The cause is identifiable in the code:

- **Rotation is bound to arrow keys** ([`src/controls.js:51-54`](../src/controls.js) —
  `pitchUp: ArrowUp`, `yawLeft: ArrowLeft`, …). Digital keys give a fixed turn rate with
  no fine control and no fast control. Aiming a ship in 3D this way feels stiff and
  imprecise at every speed.
- **There is no pointer input at all.** The audit confirms it: *"no normalized axes for
  pointer, touch, or gamepad."* Mouse look is the single biggest missing piece.
- **Speed is selected by a gear lever** (`Digit1`–`Digit6`), so the player chooses a
  *regime* rather than flying a *speed*. Combined with real scale, this is why "the speed
  was never right."
- Rotation and translation are split across opposite sides of the keyboard, so precise
  simultaneous manoeuvring requires awkward hand positions.

**What was right and must survive:** input is already **action-based** rather than
scattered key checks, bindings are saved and rebindable, and help text is generated from
the same mapping. The audit says preserve this design; refactor it into device adapters.

---

## 2. Control model

### 2.1 Six degrees of freedom, always

The ship has 6DOF thrust (Design Bible §6.1). The control scheme must expose all of it:
three rotations (pitch, yaw, roll) and three translations (forward/back, left/right,
up/down). No axis may be reachable only through autopilot.

### 2.2 Aim with the pointer, move with the keys

**The mouse aims the ship; the keyboard moves it.** This is the central fix.

- pointer input drives **pitch and yaw** as continuous analog axes via pointer lock;
- the keyboard drives **translation**, which is genuinely discrete (on/off thrust);
- **roll** stays on keys, since it is rarely a fine-aiming axis.

### 2.3 There is one ship

**Revised 2026-07-28.** There used to be two flight modes, assisted and direct, on a
toggle. There is now **one**, and the only "mode" the ship has is the travel mode (§2.4).

| | Behaviour |
|---|---|
| **The ship** | The throttle is a speed the ship holds, and the commanded velocity points where the nose points — turn the ship and you turn where you are going. Releasing rotation damps to a stop and the ship holds attitude. Releasing the throttle keeps your cruise; winding it to zero comes to rest in the current frame. |
| **Precision** | A modifier, not a mode: thrust and look sensitivity drop sharply for close work. |

#### Why direct mode was deleted

It is the clearest case in the project of a feature costing more than it paid. Direct mode
closed no loop, which meant it had no cruise speed, **no drive spool, and no proximity
governor** — every one of those lives in the assisted path. So it was a second and quietly
worse ship wearing the same hull.

Ric found it the hard way. His saved settings had him in direct without his knowing (the
clean HUD preset did not show which mode was active), so selecting Intergalactic and
holding W accelerated him at a flat 10⁶ m/s² toward a top speed 150 million years away at
that rate. His report: *"I went to go speed up on level 5 and it's taking forever to even
reach light speed."* It was. With the same saved settings after this change, that press
reaches top speed in **2.5 seconds**.

The brief it failed is Ric's own, from the same day: the ship should be *"extremely easy to
fly"* and one you *"barely think about"*. A hidden toggle that silently removes the
throttle, the drive and the safety governor is the opposite of that, and fixing direct mode
would still have left two ships to learn instead of one.

**What it cost, stated plainly:** true Newtonian coasting is gone. Wind the throttle to
zero and the ship closes on rest in the current frame rather than drifting on, so there is
no longer any way to fly a pure ballistic arc by hand. Every honest *readout* survives —
felt g, relative velocity and its frame, stopping distance. The ship still tells you the
truth about the physics; it just will not make you fly it.

The stored `mode` setting is deleted on load rather than migrated, because a stored
`"direct"` is exactly how this happened and leaving the key would preserve the bug in
every browser that already has it saved.

*The nose leads the velocity.* This is the same trade the rotation loop already made,
applied to translation, and it is what §2.4 below means by a throttle.

The HUD's flight row now names the **travel mode** — Local, Orbital, System, Interstellar,
Intergalactic. It used to read "assisted", which named a distinction that no longer exists
and never told you what the next press of W would do.

### 2.4 Speed control — replacing the gear lever

The prototype's discrete gears are the prime suspect for "the speed was never right,"
because the player picks a bracket instead of flying a speed.

**Decided 2026-07-26, in play, against the running slice: five player-selected modes,
each named for where you are flying.**

A pure continuous throttle was adopted provisionally on 2026-07-25 and has now failed
the feel test this section demanded. Ric, flying it: *"the issue with the throttle is it
became very difficult to fly close to planets moons and asteroids… the control needs to
be pretty easy… I don't want to have to think too hard about flying the ships."*

The fix is not to return to the prototype's six abstract gears. It is that **the mode
names the place, not the speed** — *"like if it's like selecting where you're flying, so
you have the ultimate control."* The player picks the situation they are in; the mode
supplies the whole envelope that suits it.

These are the Design Bible §8.2 travel regimes, promoted from a description of what the
ship is doing into the control the player actually holds, with a fifth added above them
for the scale Ric asked for:

| Mode | For | Top speed | Authority |
|---|---|---|---|
| **1 · Local** | station-keeping, close approach, terrain, rings | 300 m/s | 30 m/s² (3 g) |
| **2 · Orbital** | orbits, rendezvous, anywhere around one world | 30 km/s | 300 m/s² |
| **3 · System** | moon to moon, planet to planet | 0.01 c | 10⁴ m/s² |
| **4 · Interstellar** | star to star | 0.1 ly/s | 3.45×10⁵ m/s² |
| **5 · Intergalactic** | between galaxies — and nothing closer | 5×10⁵ ly/s | 10⁶ m/s² |

Modes 1–3 are ordinary Newtonian flight at an extraordinary thrust. Modes 4 and 5 exceed
light and are the declared fictional drive of Bible §8.2D; the HUD says which side of that
line the ship is on, and nothing dresses the fiction up as relativity.

Two anchors set the ladder, both Ric's, given 2026-07-26:

- **Mode 4 crosses Earth–Moon in about two minutes.**
- **Mode 5 is for the gaps between galaxies and nothing closer.**

### The proximity governor

> *"If you get close to it it needs to slow you down intentionally."* — Ric, 2026-07-26

This is the rule that makes a five-decade ladder safe, and it is one line: **you may fly
as fast as you could still stop from, and no faster.** √(2·a·d) over the clearance — the
same arithmetic the autopilot flies and the HUD already prints as stopping distance, so a
player being slowed can see exactly why.

#### The clearance is measured *forwards*

Revised 2026-07-28, ledger `SF-L-025`. A body governs your speed only if it is **ahead of
you** and within ten of its own radii of your track, and the distance that counts is the
distance along your path to its near face.

This started as a feel problem and turned out to be a geometry bug. Ric asked for modes
3–5 to engage *"like going into lightspeed in Star Wars"*; fixing the drive's spool time
fixed mode 3 and did nothing for 4 and 5, because the drive was never what held them back.
The spindown term is linear in clearance, so with clearance measured as a *sphere around
the ship* the permitted speed grew only as fast as the ship was permitted to fly —
dx/dt = 2x/65, an exponential with a 32-second time constant. Flown in the probe, mode 4
took **187 seconds** to reach its top speed from low orbit and mode 5 never reached its at
all. Nothing was unsafe. Earth was simply *behind* the ship and still slowing it down.

A straight line that misses a planet misses it however fast you fly it. The governor was
answering "how close is the nearest world?" when the only question that keeps you alive is
**"what am I about to arrive at?"**

What this buys is the whole of Ric's brief at once. At 420 km over Earth, at full throttle:

| Mode | Throttle asks | Pointed at Earth | Pointed at open sky |
|---|---|---|---|
| 1 · Local | 0.3 km/s | not governed | not governed |
| 2 · Orbital | 30 km/s | 7.9 km/s | 30 km/s |
| 3 · System | 3 000 km/s | 45.8 km/s | 3 000 km/s |
| 4 · Interstellar | 3.2 million c | 269 km/s | top speed in 1.35 s |
| 5 · Intergalactic | 500 000 ly/s | 458 km/s | top speed in 1.35 s |

So selecting the largest drive in the ship while parked at the station is *absurd*, not
lethal — which is what Ric's standing rule below requires — and the way to go fast is to
point at nothing, which is the mass-shadow rule the films actually use. It is not a
special case for FTL; it is the same sentence, asked about the right direction.

**What it cost.** Ric's Earth–Moon anchor moved, and this is the only place in the project
where a stated anchor has. The two minutes given on 2026-07-26 was the sum of *two*
braking curves — the governor charged you for leaving Earth as well as for arriving at the
Moon. The departure half is exactly what makes the jump instant, so it cannot be kept and
the crossing is now **79 s**, both flown and re-integrated. The half Ric described in words
— *"if you get close to it it needs to slow you down"* — is untouched. If the two minutes
matters more than the instant jump, this is the decision to reverse.

#### A speed you cannot shed is not a speed you may have

Ledger `SF-L-026`, and it was found by flying rather than by reading. √(2·a·d) assumes you
brake at `a` from the first instant; the assisted controller is proportional, so it lags by
1/gain seconds no matter how much thrust the mode has. Mode 5 pointed straight down from a
420 km orbit reported *"held to 20.5 km/s"* the whole way and hit the ground at **71 km/s**
— legal at every instant, and never achievable. A governor whose arithmetic assumes a
braking law the ship does not fly is not a safety system, it is a caption.

So the permitted speed is also capped at what the loop can bleed off in a quarter of the
room available. It binds only in the last tens of kilometres, so no anchor moves. The same
dive now settles onto the surface at 1.2 m/s.

The governor and the instant stop are not redundant, and it is worth being clear about
which does what: the governor is for **not needing rescue**, the instant stop **is** the
rescue. If the instant stop makes the governor feel unnecessary in play, the governor is
what should be relaxed — the stop is the player's, and it stays.

Superluminal modes need a second stopping model, because no thrust stops something doing
0.1 ly/s: the declared fiction is that the drive lets go over about 65 seconds. That one
number falls out of the Earth–Moon anchor, and it puts the nearest star 42 seconds away —
which is, to the second, what the prototype's own Interstellar gear promised.

Ric's original design rule is unchanged and still governs:

> **A gear is an acceleration, not a speed.** Changing regime must never change your
> current velocity, and must never kill you.

#### The throttle is a speed you set, not a stick you hold

**Decided 2026-07-28**, Ric: *"when you release W it needs to keep going that speed and
only slow down with S. and instantly stop with X."*

Until then, assisted flight read the forward stick deflection directly, so the commanded
velocity was whatever the key was asking for *at that instant* — and letting go commanded
zero, which made the ship brake itself to a halt. That is right for a docking thruster and
wrong for going anywhere. Holding W across a cislunar crossing is not a control scheme.

So the throttle is state, and the controls move it:

| Input | Effect |
|---|---|
| **W** / **S** | Raise / lower the commanded speed. Also **Shift** / **Alt**, which do the same thing. |
| *release* | Nothing. The ship holds the speed it was given. |
| **X** | Commanded speed to zero, and a full stop. |

Three consequences worth stating, because each was a bug before it was a rule:

- **Zero means zero.** The speed curve is exponential and so has no bottom of its own — it
  approaches 1 cm/s and never reaches nothing. Harmless while the throttle only applied
  under a deflected stick; not harmless once it is a speed the ship holds, or "stopped"
  never quite means stopped.
- **Every assist zeroes it.** A stop that leaves the dial reading 40 m/s is undone on the
  next frame by the thing that asked for it.
- **The throttle has exactly one owner**, the flight model. It previously lived on both the
  input layer and the flight model with the app copying one to the other each frame, which
  made "put it back to zero" unimplementable — the input layer rewrote it immediately.

Strafing is unaffected and stays momentary: it is trim against whatever you are flying
beside, and a sideways nudge you have to remember to cancel is one that drifts you into
the truss.

Also unchanged:

- the speed response is smooth and non-linear, so low speeds get fine resolution and high
  speeds get reach *within the selected mode*;
- an explicit **full stop** kills velocity relative to the current reference frame and
  works from any speed — the escape hatch, preserved from the prototype. **In modes 2 and
  above it is instant**, cancelling the ship's momentum outright rather than flying a
  braking burn (Ric, 2026-07-26: *"you should be able to stop instantly if you want"*,
  and *"instant stop should only be a thing on 2-6"*). Mode 1 is deliberately excluded
  and still brakes for real, because Local is where delicate work happens and there the
  braking *is* the flying — it is also the only mode where an honest stop is quick.
  Declared fiction, ledger `SF-L-019`; it stops the ship relative to the **named
  reference frame**, ω × r included, never to zero in some frame nobody asked about;
- a **match velocity** action zeroes relative motion with a selected target;
- the current mode is always displayed, and mode is never selected automatically. The
  auto-selection half of the 2026-07-25 model is what made close flight hard: the ship
  changed regime underneath the player while they were trying to hold station.

Modes bind to **Digit1**–**Digit5**. No mode is dangerous to select — the governor sees to
that — so Bible §8.3's "no accidental FTL activation" is satisfied by the governor rather
than by a confirmation the player has to dismiss.

---

## 3. Default desktop scheme

Mouse look via pointer lock. All bindings are rebindable; this is the default only.

### 3.1 Flight

| Action | Binding |
|---|---|
| Pitch / yaw (aim) | **Mouse** |
| Roll left / right | **Q** / **E** |
| Thrust forward / back | **W** / **S** |
| Strafe left / right | **A** / **D** |
| Thrust up / down | **Space** / **Ctrl** |
| Throttle up / down | **Shift** / **Alt** *(held)* |
| Flight mode — Local / Orbital / System / Interstellar / Intergalactic | **1**–**5** |
| Precision mode | **Z** *(hold, or toggle in settings)* |
| Full stop / hold position | **X** |
| Match velocity with target | **B** |
| Landing / hover mode | **G** |

### 3.2 Targeting, navigation, and view

| Action | Binding |
|---|---|
| Select object under cursor | **Left click** *(objects are picked on the glass — HUD spec §1)* |
| Cycle nearby targets | **T** |
| Map | **Tab** |
| Autopilot engage / disengage | **F** |
| Zoom (optical) | **Mouse wheel**, or **R** held; **−** out, **0** reset |
| Take photograph | **C** |
| Cycle cockpit preset | **V** |
| Object info / educational panel | **I** |
| Honesty ledger | **L** |
| Help / controls reference | **H** |
| Menu *(pauses — Bible §7.3)* | **Esc** |

#### Tab, and keyboard focus (built 2026-07-26)

Tab is the map key, and it is also how a keyboard user moves between the overlay's
controls. Binding it outright makes the entire HUD unreachable by keyboard, which
[HUD and Cockpit §10](HUD_AND_COCKPIT.md) does not allow.

The tie-breaker is **where the focus already is**. Once focus is on a control, the
player is navigating the interface and Tab belongs to the browser; with focus on the
sky, Tab opens the map. Click the sky and it flies the ship again.

**Esc means "back", not "close everything".** It dismisses whichever surface is in
front — the map if the map is open, otherwise the information panel — so it can never
dismiss something the player was not looking at.

### 3.3 Rationale

- **Left hand owns movement** (WASD + Space/Ctrl/Q/E/Z/X), **right hand owns aim and
  selection** (mouse). Both hands stay home during precision work — the prototype's
  arrow-key rotation made this impossible.
- **Click-to-select** matches the holographic glass model exactly: you point at a star
  and it becomes your target.
- **Esc pauses**, honouring the decision that menus pause the simulation.
- Frequently-used actions are single keys; nothing routine requires a chord.

---

## 4. Gamepad

| Action | Binding |
|---|---|
| Pitch / yaw | Right stick |
| Strafe / vertical | Left stick |
| Thrust forward / back | Right trigger / Left trigger |
| Roll | Shoulder buttons |
| Full stop | A / Cross |
| Match velocity | B / Circle |
| Precision | Left stick click *(hold)* |
| Target | X / Square |
| Autopilot | Y / Triangle |
| Map / Menu | Select / Start |

Analog sticks need adjustable deadzones and response curves; defaults must not feel
"floaty" near centre.

---

## 5. Mobile

At ~375 CSS px, two-thumb flight must work (slice §12.4):

- **left thumb** — virtual stick for translation;
- **right side** — drag anywhere to look, so aiming is never confined to a small pad;
- **full stop** is a fixed, always-reachable button that does not require moving the
  steering thumb;
- **precision** is a deliberate, always-reachable control;
- **target / map / autopilot / capture** are reachable but guarded against accidental
  activation;
- controls never overlap critical warnings, and respect safe areas and browser UI;
- orientation change never corrupts flight state.

The octagon frame thins to edge struts on mobile (HUD spec §9) specifically so controls
and view are not competing for the same pixels.

---

## 6. Input feel

Feel is where the prototype lost, so these are requirements, not preferences:

- **Pointer input is raw** — no smoothing or acceleration by default, adjustable
  sensitivity, optional smoothing for players who want it.
- **Input is sampled per frame and applied at the fixed simulation step**
  (Technical Architecture §4.4), so control response never depends on frame rate.
- **No perceptible input lag.** Any added latency is a bug, not a tuning value.
- **Analog where the physical quantity is analog.** Aim and throttle are continuous;
  thrust on/off is not.
- **Symmetrical, predictable response** — the same input produces the same result
  regardless of speed, except where precision mode deliberately changes it.
- **Releasing a control never produces a surprise.** Release rotation and it damps to a
  stop where it is; release the throttle and you keep your cruise. Neither ever applies
  unrequested thrust.
- **Changing travel mode or preset never changes velocity** and never kills the player.

---

## 7. Rebinding and persistence

Preserved from the prototype, which got this right:

- every action is rebindable, with **two binding slots** each;
- bindings persist locally and can be reset to defaults;
- help and the controls reference are **generated from the live mapping**, so they can
  never drift out of date;
- binding storage is **explicitly versioned** with migrations — the audit notes the
  current schema is only implicit;
- key handling is layout-aware (physical `code`, not character), and swallows browser
  keys only where genuinely necessary.

---

## 8. Accessibility

- Every modifier (**precision**, **throttle**, **zoom**) offers hold *or* toggle.
- No required simultaneous chords for any routine action.
- Full remapping makes one-handed and alternative-device layouts possible.
- Independent sensitivity for pointer, stick, and touch.
- Autopilot is a genuine accessibility path: a player who cannot fly precisely can still
  reach everything in the game (Design Bible Law 3).
- Reduced-motion settings must not disable control feedback the player needs.

---

## 9. Testing requirements

Before the control scheme is considered done:

- station-keeping within metres of the ISS using precision mode;
- a full Earth-to-Moon journey flown manually, without autopilot;
- a lunar hover-landing on sloped terrain;
- the same three on a phone at ~375 px, and on a gamepad;
- rebinding, persistence across reload, and reset verified;
- no input-lag regression at the lowest supported quality tier.

---

## 10. Still open

- **Continuous throttle versus discrete regimes** (§2.4) — **resolved for now** by the
  continuous throttle, implemented in Slice B: an exponential curve from 1 cm/s to
  300 m/s, so equal turns of the dial are equal *ratios* of speed. Amended 2026-07-28 so
  that the curve is a speed the ship *holds* rather than one it asks for while a key is
  down. It has not yet been flown far enough to call the question closed, and §2.4's rule
  still stands — if it proves worse than discrete regimes in play, this section is
  revised, not the physics.
- Default pointer sensitivity and throttle response curve — tuning values.
- ~~Whether assisted mode should be the permanent default or only until a player opts out.~~
  **Closed 2026-07-28: there is no opt-out, because there is only one ship (§2.3).**
- **Gamepad** (§4) is specified and not yet built. The action layer is device-agnostic,
  so it is an adapter rather than a redesign.

### 10.1 Settled by flying it (2026-07-26)

Ric flew the first build of Slice B and it was wrong in three specific ways. All three
are fixed, and all three are now regression tests, because each was invisible to every
test that checked magnitudes rather than directions:

- **"Left and right are backwards."** They were. The pointer accumulated yaw with the
  wrong sign and the arrow keys had their axis reversed.
- **"When I turn right it pulls back the other way."** Attitude hold captured its target
  on the first frame after release, while the ship still had a radian a second on it, so
  the controller had to overshoot and come back. It now stops the turn *where it is* and
  only engages the hold once the ship has settled.
- **"Too floaty."** The stick was commanding *torque*, so the spin kept building while the
  mouse moved and kept going after it stopped. It now commands a **rate** — push and it
  turns, release and it stops — which is what §2.3 meant and is how a ship in a film
  behaves. (Direct mode kept the torque version, and went with the mode on 2026-07-28.)

### 10.2 Settled by flying it (2026-07-28)

Two more, from the same source and in the same shape — things no test could have caught
because every test was checking that the numbers were right rather than that the ship was
nice to fly:

- **"When you release W it needs to keep going that speed."** The throttle was a stick
  position, not a speed. Now it is a speed the ship holds; W and S move it and X zeroes
  it. Full reasoning in §2.4.
- **"In manual when I release the up arrow I need it to stop rotating as well."** Direct
  mode let the spin persist, which is the honest physics and the wrong game. It now damps
  to a stop on release while still building rather than snapping, and still never rewinds
  the attitude. §2.3.

The pattern across both dates is worth naming, because it will recur: **every one of these
five faults was a case where the simulation was correct and the control was not.** None of
them were physics bugs. A test suite that checks the world is right will pass every one of
them, which is why §9's testing requirements ask for a person flying it and why these get
written down when they are found.
