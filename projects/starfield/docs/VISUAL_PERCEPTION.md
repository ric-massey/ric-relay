# Starfield — Visual Perception Specification

> **Status:** Target specification; not yet implemented<br>
> **Decided with Ric:** 2026-07-25<br>
> **Governs:** what the sky looks like, how the eye is modeled, star and Sun appearance,
> colour, the Earth limb, and what the renderer is forbidden to do.

---

## 1. The thesis

> **Movies make space black. It isn't. It is blazing with stars.**
> — Ric, 2026-07-25

This is the single most important visual statement in the project. The prototype's
visuals were called "lackluster," and the reason is that it inherited the cinematic
convention: a dark void with some dots in it.

Real space, seen by a dark-adapted human eye, is **overwhelming**. Thousands of hard,
motionless, brilliant points, denser than any sky on Earth, with the Milky Way as a
luminous silver band bright enough to cast a shadow. Astronauts describe it as one of
the most beautiful things a person can see. **The game's job is to deliver that**, and
the only way there is to model the eye rather than to paint a mood.

**Reality is the art direction.** Every rule below exists to get out of reality's way.

---

## 2. The eye is the renderer's model

### 2.1 Dynamic range is sequential, not simultaneous

This is the mechanism that governs everything else, and it is the thing most fiction
gets wrong.

The human eye spans an enormous luminance range — roughly **14 orders of magnitude** —
but **only by adapting.** At any single adaptation state the usable range is roughly
**3–4 orders of magnitude**. You do not see a sunlit hull and faint stars at the same
time. You see one, or the other, depending on what your eye has adapted to.

Consequences the renderer MUST honour:

- **A bright object anywhere in view suppresses the stars.** The Sun, a sunlit Earth, a
  lit hull, a bright instrument panel — any of these pulls adaptation bright and the sky
  goes empty.
- **Shield the bright things and the sky returns**, over time, not instantly.
- **Adaptation takes real time**: partial within seconds, cone adaptation over several
  minutes, near-full rod adaptation over **20–30 minutes**. Bright light resets it
  immediately.
- Full-fidelity 20–30 minute adaptation is unplayable; a **compressed adaptation curve**
  is required and is a declared presentation aid (`A`) that MUST appear in the honesty
  ledger with its compression factor stated.

### 2.2 The HUD is a light source

Because the cockpit overlay sits in the player's field of view, a bright HUD legitimately
dims the sky. This connects directly to
[HUD and Cockpit](HUD_AND_COCKPIT.md):

- overlay brightness SHOULD participate in the adaptation model rather than floating
  above it as unaffected UI;
- the **Clean** preset should visibly reward the player with a darker-adapted, richer
  sky — this is a real effect, not a gimmick;
- the player MUST be able to dim the overlay, and doing so MUST improve the view.

### 2.3 Direction does not determine darkness — content does

"Looking toward the Sun is black, looking away is full of stars" is *nearly* right, but
the actual variable is **what bright sources are in the field of view**, not the compass
heading. The renderer models adaptation from scene luminance, and the directional
behaviour falls out of it automatically.

---

## 3. Stars

### 3.1 Appearance

- **Point sources.** Real angular size is far below one pixel. Stars are rendered as
  points with a physically motivated point-spread, and are **never enlarged** to be
  findable. Labels and sensor overlays make objects usable; geometry does not.
  *(This directly fixes the prototype complaint that "the stars were too big.")*
- **No twinkling, ever.** Scintillation is atmospheric. In vacuum stars are absolutely
  steady — "hard, motionless pinpricks." Any twinkle is a bug.
- **Brilliant, not dim.** Without extinction or airglow, stars are sharper and brighter
  than from any site on Earth.

### 3.2 Colour — the nuance that matters

Scotopic (rod) vision is **achromatic**, so most stars read as white or silver-white.
But the brightest stars exceed the cone threshold and **do** show colour:

- **dim stars → white / grey-white**, regardless of true spectral class;
- **bright stars → subtle, real colour** — Betelgeuse's orange, Rigel's blue-white —
  driven by effective temperature, never exaggerated;
- colour saturation is therefore a **function of apparent brightness**, not a per-star
  constant. This is the correct model and it is what makes a real sky look real.

### 3.3 How many

- From a perfect Earth site the naked eye reaches about **magnitude 6.5**, roughly
  **9,000 stars** over the whole sphere.
- In vacuum, with no extinction and no airglow, the limit improves — plausibly toward
  **magnitude 7–8**, giving several times more stars. Published estimates vary; treat
  this as a **tuning target to be validated against the perception references, not as a
  settled fact**, and record the chosen limit in the honesty ledger.
- Star counts rise steeply per magnitude, so this choice strongly drives how "blazing"
  the sky feels. Tune it deliberately.

### 3.4 Where you are changes the sky

This must emerge from real positions, never from a mood setting:

| Location | What the sky does |
|---|---|
| Near Earth, sunlit | Nearly starless — adaptation is dominated by Earth and Sun. |
| Earth's night side, shielded | Blazing, once adapted. |
| Interplanetary, Sun in view | Sun glare dominates; few stars. |
| Interplanetary, Sun occluded | Full sky; zodiacal light still present near the ecliptic. |
| Interstellar (≳10 ly) | The Sun is an ordinary magnitude-2 star. No glare source at all, zodiacal light gone: the darkest, richest sky. |
| Toward the galactic centre | **Star density climbs sharply** — this is the real "more stars," not mere distance from home. |
| Outside the galaxy | Nearly empty sky, with the Milky Way behind you as a luminous external disc. |

Note the counter-intuitive truth to preserve: **leaving the solar system mainly buys
contrast, not count.** Almost every naked-eye star is hundreds of light-years away, so a
few light-years of travel barely changes their brightness.

---

## 4. The Sun and other stars up close

- A **sharp, piercing white disc** on absolute black — about **0.53°** across at 1 AU,
  the same angular size as from the ground, but with no atmospheric softening,
  reddening, or halo.
- **No sky glow around it.** Vacuum does not scatter; the blackness runs right up to the
  limb. This is one of the most alien and important details.
- Overwhelming glare: with the Sun in view, essentially nothing else is visible.
- The **corona** is not a naked-eye object unless the disc is occluded — then it becomes
  one of the finest sights available, and the game should permit that geometry.
- Colour is real: the Sun is white in space, not yellow. Other stars follow their real
  effective temperature.

---

## 5. Colour of the deep sky

**No psychedelic nebulae.** Hubble and JWST images are long-exposure, often false-colour,
and frequently outside the visible band. The naked eye sees none of that.

- The **Milky Way** is a luminous band in **silver, white, and grey**, with dark dust
  lanes — genuinely bright, genuinely beautiful, and essentially colourless.
- **Nebulae** to the naked eye are faint grey smudges; a few show the barest green-grey.
- Galaxies are dim grey ovals.
- Long-exposure and false-colour views MAY be offered as **explicitly labelled
  instrument views** (§8), never as what the eye sees.

Ambient nebula fog as set dressing is **forbidden** (§9).

---

## 6. Earth and the thin blue line

The Earth limb is a hero visual and must be treated as one.

- A **razor-thin, brilliant arc of electric blue** separating black space from the
  planet — the entire breathable atmosphere seen edge-on.
- Its thinness is the point. It is tied to the **Overview Effect**, and the game should
  let the player notice how fragile it looks without narrating the feeling for them.
- Layered scattering: intense blue at the base fading through violet to black, with the
  gradient driven by the real atmospheric model, not a painted gradient.
- At the terminator, expect deep oranges and reds through the long optical path.
- Required companions: **city lights on the night side**, **aurorae** at high latitudes,
  **earthshine** lighting the Moon's night side, and **specular sun-glint** off oceans.

Because atmospheric drag was removed as a force (Design Bible §10.2), the atmosphere's
entire remaining job is **optical and educational** — which makes getting this right more
important, not less.

---

## 7. Cosmic-ray light flashes

Apollo and ISS crews report **sudden flashes and streaks of light, even with eyes
closed** — high-energy particles interacting with the retina and optic nerve.

This SHOULD be implemented, because it is real, it is eerie, and it serves
**Law 5 (radiation informs more often than it kills)** perfectly:

- flash frequency scales with the **real local radiation environment** — rare in low
  Earth orbit, more frequent in the South Atlantic Anomaly, higher in the belts, higher
  again in deep space and near energetic objects;
- it is **information, not damage** — no hit points, no screen-blocking effect;
- it makes an invisible physical environment perceptible, which is exactly the project's
  educational thesis;
- it MUST be disable-able for photosensitivity (§10).

---

## 8. Eye versus camera — and photo mode

The distinction between what the eye sees and what a camera records is a genuine piece of
science education, and the project already has the feature to carry it.

- The **cockpit view is always the dark-adapted human eye.**
- **Photo mode** (Design Bible §12.4) MAY offer a long-exposure capture that reveals
  colour and faint structure the eye cannot see — **explicitly labelled as a camera
  exposure**, with its exposure time shown.
- The game SHOULD explain, in one sentence at the right moment, why ISS photographs show
  a starless black sky while the astronaut taking them can see thousands of stars. That
  is a genuinely delightful piece of understanding and it costs nothing.
- Optical zoom and instrument views are legitimate for objects the eye cannot resolve,
  and are always identified as instruments.

### 8.1 Instrument filters (decided Ric, 2026-07-25)

> **"In the settings you should be able to turn on some of the instruments that they
> would have that would create those visuals — that could just be a smart filter over
> the top of the glass."** — Ric

The ship carries **selectable instrument filters** that overlay the canopy, each
corresponding to a real observing band or technique:

- infrared, ultraviolet, X-ray, radio;
- narrowband (e.g. hydrogen-alpha);
- long-exposure accumulation;
- false-colour composites.

This is an elegant fit for the project. It resolves the tension between "the naked eye
sees grey smudges" and "the universe is full of astonishing structure" **without lying
about either** — the eye view stays honest, and the spectacular views become what they
actually are: *instruments*. It is also, straightforwardly, how humanity knows what it
knows about these objects, which makes it the most educational feature in the game.

Rules:

- filters are **off by default**; the naked-eye view is always the baseline;
- a filter is **always visibly labelled** while active — the player can never mistake an
  instrument view for what their eyes see;
- each filter states **which band or technique it represents** and what it reveals;
- filters are toggled in settings and SHOULD have a quick in-flight control;
- filters apply to the view **and** work with photography (§8), so a captured image
  records which filter produced it.

#### The honest technical constraint

A filter **cannot be a colour transform of the visible-light image.** Infrared is not
"visible light tinted red" — it is different data entirely. Faking it would be exactly
the kind of dishonesty this project exists to avoid. Therefore:

- for **catalogued objects with real multi-wavelength survey coverage**, filters use
  **real survey data** for that band (see the [Data Sources](DATA_SOURCES.md) manifest);
- for **generated objects**, band appearance is **calculated** from physical properties —
  temperature, composition, emission mechanism — and classed `C` (calculated), never `M`;
- where neither is possible, the filter reports that it has **no data for this object**
  rather than inventing a plausible image. An honest blank is required;
- every filter carries an honesty-ledger entry describing its data basis.

---

## 9. Forbidden

The renderer MUST NOT:

- enlarge stars, planets, or any object to make it easier to see;
- twinkle stars;
- add ambient nebula fog, coloured space haze, or background glow that has no source;
- add ambient light with no emitter — unlit sides are dark unless something real lights
  them;
- present long-exposure or false-colour imagery as naked-eye appearance;
- render a blue-ish or grey-ish "space" background instead of true black;
- apply decorative lens flare, bloom, or dirt as a substitute for real exposure
  behaviour — physically motivated glare is fine, cinematic garnish is not;
- keep the sky at a fixed brightness regardless of what is in view.

---

## 10. Accessibility and comfort

- Adaptation speed is adjustable, including an instant-adaptation option — dark
  adaptation is a beautiful mechanic and a genuine accessibility barrier.
- Cosmic-ray flashes can be reduced or disabled (photosensitivity).
- A minimum-brightness floor is available for players on poor displays or in bright
  rooms, declared as a presentation aid.
- Overlay brightness is independently adjustable (§2.2).
- Reduced-motion suppresses any drifting or pulsing visual behaviour.

---

## 11. Implementation notes

- Work in **physical luminance** internally and tone-map at the end; do not author in
  display-referred colour.
- Adaptation is a **state that lags scene luminance**, driven by what is actually in the
  field of view, with separate fast and slow components approximating cone and rod
  behaviour.
- Stars: render from real catalogue magnitude and colour index into physical luminance,
  then through the same tone-mapping path as everything else. **The sky must not be a
  separately-tuned layer** — that is precisely how the prototype's sky drifted away from
  the rest of the scene.
- Point-spread and glare should be physically motivated so bright stars read as bright
  without being drawn larger.
- Quality tiers may reduce star count, point-spread quality, and scattering samples, but
  MUST NOT change the adaptation model — degrade fidelity, never rules
  (Technical Architecture §2.5).

---

## 12. Honesty-ledger entries required

- compressed dark-adaptation timing, with the factor stated;
- chosen limiting magnitude and star-count target (§3.3);
- tone-mapping and display-range compromises;
- any minimum-brightness floor;
- point-spread/glare rendering as a presentation aid;
- long-exposure photo mode as a camera simulation rather than eye response.

---

## 13. Still open

- The exact limiting magnitude in vacuum (§3.3) — validate against references and tune.
- Adaptation compression curve — a feel decision requiring the running spike.
- Whether cosmic-ray flashes ship in the Earth–Moon slice or immediately after.
