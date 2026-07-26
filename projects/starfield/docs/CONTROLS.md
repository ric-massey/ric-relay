# Starfield — Controls Specification

> **Status:** Target specification; not yet implemented<br>
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

### 2.3 Flight modes

Per the slice (§6.2–§6.4), three modes share one control scheme:

| Mode | Behaviour |
|---|---|
| **Assisted** (default) | Releasing rotation damps to a stop; forward thrust aligns the velocity vector; the ship holds attitude. Newcomer-friendly without lying about physics. |
| **Direct** | Full inertial flight. Nothing damps; rotation and velocity persist exactly as physics dictates. |
| **Precision** | A modifier over either mode: thrust and look sensitivity drop sharply for close work. |

Mode is a **player choice, never an automatic override.** The HUD always shows which is
active (HUD spec §3.1).

### 2.4 Speed control — replacing the gear lever

The prototype's discrete gears are the prime suspect for "the speed was never right,"
because the player picks a bracket instead of flying a speed.

**Recommended model:** a **continuous throttle governing target speed**, with the
regime (local / orbital / interplanetary / relativistic) selected *automatically* from
the speed and displayed rather than chosen. Ric's original design rule still holds and
must not be violated:

> **A gear is an acceleration, not a speed.** Changing regime must never change your
> current velocity, and must never kill you.

- throttle up/down are held keys with a smooth, non-linear response so that low speeds
  get fine resolution and high speeds get reach;
- an explicit **full stop** kills velocity relative to the current reference frame and
  works from any speed — the escape hatch, preserved from the prototype;
- a **match velocity** action zeroes relative motion with a selected target.

**This remains the single biggest feel question in the project** and cannot be settled on
paper. It must be tuned against the running architecture spike. If continuous throttle
proves worse than discrete regimes in play, this section is revised — not the physics.

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
| Precision mode | **Z** *(hold, or toggle in settings)* |
| Full stop / hold position | **X** |
| Match velocity with target | **B** |
| Assisted ↔ Direct flight | **N** |
| Landing / hover mode | **G** |

### 3.2 Targeting, navigation, and view

| Action | Binding |
|---|---|
| Select object under cursor | **Left click** *(objects are picked on the glass — HUD spec §1)* |
| Cycle nearby targets | **T** |
| Map | **Tab** |
| Autopilot engage / disengage | **F** |
| Zoom (optical) | **Mouse wheel**, or **R** held |
| Take photograph | **C** |
| Cycle cockpit preset | **V** |
| Object info / educational panel | **I** |
| Honesty ledger | **L** |
| Help / controls reference | **H** |
| Menu *(pauses — Bible §7.3)* | **Esc** |

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
- **Releasing a control never produces a surprise.** In assisted mode release damps; in
  direct mode release coasts. Neither ever applies unrequested thrust.
- **Changing regime, mode, or preset never changes velocity** and never kills the player.

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

- **Continuous throttle versus discrete regimes** (§2.4) — the biggest feel question,
  resolvable only against the running spike.
- Default pointer sensitivity and throttle response curve — tuning values.
- Whether assisted mode should be the permanent default or only until a player opts out.
