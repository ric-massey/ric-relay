# Brief: the wavelength band selector

**For whoever picks this up next.** This is a spec, not a suggestion. Read all of it
before touching a file — about half of it is things that have already gone wrong once.

Also read `/AGENTS.md` at the repo root first. It has hard rules (no dependencies, no
build step, don't push without being asked) that apply here too.

---

## 1. What Ric asked for, in his words

> "can you do that put all of them in. it can be in the hamburger. on phone and on computer."

A control that switches the exhibit's sky between wavelength bands — microwave, far-IR,
mid-IR, near-IR, visible, UV, X-ray, gamma — living in the hamburger menu, working on
phone and desktop.

He also said, unprompted and correctly:

> "technically it doesnt need to be the same place in the sky..... like the trees will
> make it look like its from the ground so for each picture have its own trees. like why
> not do something like that"

**The per-band foreground is part of the job.** See §5. He was right and it is the best
thing in the feature.

**Not in scope:** a neutrino band. It was raised and then explicitly withdrawn
("ignore the nutrino thing thats for another llm srry"). Don't add it.

---

## 2. Why this is worth building (the actual idea)

This is not a gallery of pretty pictures. It is the same lesson the speed rail already
teaches, arrived at from the opposite direction.

Looking ahead at Doppler factor `D`, your eye's fixed 360–830 nm window is fed by the
rest-frame band **`360·D` – `830·D`**. So:

> **The infrared sky at rest and the visible sky at speed are the same picture.**

**Get the direction right — an earlier draft of this section had it inverted** and said
`360/D`, which points the forward view at X-rays. It doesn't. Flying *toward* something
blueshifts its light, so the light that reaches your eye as green left the source with its
crests further apart — it left as *infrared*. Forward slides toward infrared and
microwave; astern slides toward ultraviolet and X-ray. The sanity check is already on the
page: the rung at 0.99998 c is labelled "the sky ahead begins to glow" because the
**microwave** background has been shifted up into the visible. Nothing long-wavelength
would ever arrive if the forward view sampled X-rays.

The renderer is not affected by this — `sky.js` uses `T′ = D·T` with a per-direction `D`,
which has always been right. It was the prose that was backwards.

Which means the band selector and the speed rail are two controls on one axis. Someone
can set the band to near-IR, then drag the rail until the visible view matches it, and
watch the two arrive at the same image from opposite ends. The renderer already computes
`D` every frame; you are exposing a number that is on screen already.

Build toward that. If the feature ends up being a band dropdown that doesn't connect to
the rail, it has missed the point.

### Which plate the rail actually needs

This is the part that changes what the feature *is*. The photographic sky is currently the
visible plate with a gain on it at every speed, which is labelled as an approximation and
is not what a traveller would see. These are the plates that would make it correct:

| β | Ahead, your eye is fed by | Astern |
|---|---|---|
| 0 | 360–830 nm — the ESO plate | the ESO plate |
| 0.5 | 624 nm – 1.4 µm — deep red into near-IR | 208–479 nm — near-UV |
| 0.7771 | 1.0–2.3 µm — **2MASS** | 128–296 nm — far-UV |
| 0.9 | 1.6–3.6 µm — **WISE W1** | 83–190 nm — far-UV |
| 0.99 | 5–12 µm — **WISE W3** | 25–59 nm — EUV |
| 0.999 | 16–37 µm — **IRAS 25 µm** | 8–19 nm — EUV |
| 0.9999 | 51–117 µm — **IRAS 60/100 µm** | 2.6–5.9 nm — **ROSAT** |
| 0.99998 | 114–262 µm — **COBE/DIRBE 240 µm** | 1.1–2.6 nm — **ROSAT** |
| 0.999999 | 0.5–1.2 mm — **Planck** | 0.25–0.6 nm — hard X-ray |

Two things follow. **The infrared and microwave plates are the priority** — they serve the
forward view, which is what the exhibit is mostly about, and they are the best-covered and
most freely available surveys in the table. **The awkward bands only serve the rear view**
(`#look-back`), so the UV gap in §4 is a smaller problem than it first looks: it degrades a
held button, not the main view.

The honest interim position, if the plates never land, is to say on the page that the
photographic sky is shown in visible light at every speed and that a real traveller's
forward view would be the infrared sky. That is a one-paragraph fix and it should probably
go in whether or not the plates ever arrive.

Alignment across bands is *free* — every survey below publishes an all-sky map in
galactic coordinates, and `photo-sky.js` already samples by galactic longitude and
latitude. Keep the same patch of sky across bands. The payoff is that the dark rift
splitting the Milky Way in visible light **is** the brightest thing in the sky in
far-IR — same pixel, same direction, inverted. Show a different patch per band and that
demonstration is gone.

---

## 3. State of the code right now

A revision just landed that you should not undo. Summary:

- **`photo-sky.js` renders ONE photograph**, ESO's all-sky panorama
  (`assets/milky-way-eso.jpg`, 4096×2048, ESO/S. Brunier, CC BY 4.0), sampled by
  galactic longitude/latitude. There is **no rotation, crop, blend, gain or feather**
  left in the file. It used to composite three plates with fitted per-channel gains and
  a speed-dependent feather; all of that is gone. Do not reintroduce it.
- The previous background panorama was **generated, not photographed** — its fine
  structure correlated with a real all-sky plate at r = 0.06, below the floor set by
  comparing a real plate against a *misaligned copy of itself*, and it contained no
  Magellanic Clouds and no star bright enough to show a diffraction spike. It is
  deleted. This is documented on the page under Scope on purpose.
- **The CMB is now rendered** in both skies (`sky.js` diffuse pass, and a 256-texel
  strip texture in `photo-sky.js`), from `HSAT_COLOUR.cmbLuxPerSr()`.
- **Point stars are `D²`, not `D⁴`.** Surface brightness (the Milky Way) is `D⁴`. Both
  are correct and they differ by whether there is a solid angle left to shrink. Do not
  "fix" this back.
- `physics.js` gained `skyFractionInRect()` and `frameHalfWidth()`; the old circular
  `skyFractionInFrame()` is still exported but is only right about cones. The frame
  fraction is now integrated over the **actual 78° × 49° rectangle**, so "half the sky
  in one frame" moved from β = 0.7771 (which was a 78°-wide *circle*) to β = 0.8428, and
  a portrait phone correctly reports far less. Anything you add that quotes a fraction of
  sky must go through the rect version.
- **The aberration sign is fixed.** The equation sheet printed the textbook's
  `cos θ′ = (cos θ − β)/(1 − β cos θ)` under this exhibit's opposite angle convention —
  the supplement, 141° where the answer is 39°. Both the sheet and the `physics.js`
  comment now print the plus form, and a selftest cross-checks the cosine and half-angle
  forms against each other so it cannot drift again. If you write any new aberration
  copy: θ here is measured **toward the source**, not along the photon's travel.

Run `index.html?selftest` and the console prints a table ending in `all checks pass`.
It is **25 checks** at the time of writing — don't trust that number, trust the last
line. If your change breaks one, the check is probably right and you are probably wrong:
three of those checks previously asserted the same wrong values the code produced, which
is worse than having no checks at all.

Current cache-busters, so you know what you are bumping: `colour.js?v=3`,
`physics.js?v=5`, `sky.js?v=11`, `photo-sky.js?v=16`, `glossary.js?v=4`,
`exhibit.js?v=56`.

---

## 4. The survey plates

Ric has approved downloading these. All are public, all are all-sky, all publish in
galactic coordinates. **State filename, source and size before downloading, and record
the credit line in `index.html`'s Sources section as you add each one** — the whole
reason this exhibit got audited was an uncredited image of unknown provenance.

| Band | Survey | Notes |
|---|---|---|
| Microwave (30–857 GHz) | **Planck** (ESA) | This is the CMB *and* galactic dust. Pays off the CMB story directly. |
| Radio (408 MHz) | **Haslam** | Synchrotron. Very different sky. |
| Far-IR (12–100 µm) | **IRAS / IRIS** | ~96% coverage. Dust emission — the inverted Great Rift. |
| Submm (120–240 µm) | **COBE/DIRBE** | All-sky, 1.25–240 µm. Fills the gap between IRAS's 100 µm and Planck's 350 µm, which is exactly the forward view at 0.99998 c. |
| Mid-IR (3–22 µm) | **WISE** | 100%. |
| Near-IR (1–2 µm) | **2MASS** | 100%. The band without the dust lanes. |
| Visible | **ESO/S. Brunier** | Already in the repo. Don't re-source it. |
| UV | **see the warning below** | The one band with no good all-sky plate. |
| X-ray (0.1–2.4 keV) | **ROSAT** | |
| Gamma | **Fermi LAT** | |

Radio is a bonus — it wasn't in Ric's list, but Haslam is free and the synchrotron sky
looks nothing like any of the others, so it earns its place.

**UV is the hard one, and it will eat a day if you don't read this.** The obvious answer
is GALEX, and GALEX is the wrong answer: its All-Sky Imaging Survey deliberately skipped
the Galactic plane and the areas around bright stars, because they would have damaged the
detector. The part of the sky it left out is the *exact* part this exhibit is about. You
would get a beautiful UV sky with the Milky Way cut out of it. The alternatives are
TD-1/S2-68 (genuinely all-sky, 1565–2740 Å, but 1970s resolution — coarse enough that it
may only work as a diffuse layer, not a plate) or shipping the band with an honest hole
in it. **Do not synthesise a UV sky from the star catalogue to fill the gap** — see §6.
If none of those is acceptable, the right call is to leave UV out and say why on the page,
which is a better outcome than the old invented panorama.

NASA's "Multiwavelength Milky Way" (GSFC) is the convenient one-stop set but check the
latitude coverage — the classic version is only ±5° in galactic latitude, which is not
an all-sky map and will look wrong the moment the visitor turns around.

**Constraints on the assets:**

- **4096 px wide maximum per texture.** Desktop reports `MAX_TEXTURE_SIZE` 16384 but
  4096 is the common floor on mobile GPUs, and this has to work on Ric's phone. A
  4096×2048 upload that fails on mobile is a black sky, not a warning.
- Power-of-two dimensions, so `REPEAT` wrapping at the l=180° seam and mipmaps keep
  working. `photo-sky.js` already checks for this and falls back gracefully.
- Watch total page weight. The visible panorama is 2.7 MB at q70. Eight of those is
  22 MB, which is not acceptable. **Load bands lazily** — only fetch a plate when the
  visitor selects it, keep visible as the only preload.

---

## 5. Per-band foreground (Ric's idea — do this properly)

The ground and trees genuinely change with wavelength, and hard. `ground.js` and
`assets/forest-silhouette.png` own this today. Every band in the table, long wavelength
first — which is also the order in which the frame inverts:

- **Radio (408 MHz / 73 cm):** the canopy is largely *transparent* — 73 cm passes through
  foliage, which is why VHF works in a forest. There is barely a silhouette to draw. What
  is left is a warm 290 K floor against a sky whose brightness temperature runs from about
  20 K at the poles to a few hundred in the inner plane, so the ground is comparable to
  the brightest part of the Milky Way and brighter than the rest of the sky.
- **Microwave (Planck, 1 cm – 350 µm):** ground is a 290 K blackbody, the CMB is 2.7 K.
  The forest outshines the entire universe by ~100×. The one band where the trees are the
  brightest object on screen. Foliage is opaque again by the 350 µm end.
- **Far-IR / thermal (10–100 µm):** everything at ~290 K peaks right here. Trees, ground,
  ship, observer — all emitting. The sky is now the *cold* thing. The frame is fully
  inverted: light below, dark above.
- **Mid-IR (3–22 µm):** the inversion happens *inside* this band, which makes it the most
  interesting one to animate. At WISE W1/W2 (3.4 and 4.6 µm) a 290 K surface emits almost
  nothing and the ground is still nearly dark; by W3/W4 (12 and 22 µm) it is blazing.
- **Near-IR (1–2 µm):** healthy foliage reflects ~50% in NIR vs ~5% visible — the "red
  edge." The black silhouette becomes a pale, glowing canopy. This is the Wood effect,
  the reason IR photographs have white trees. The sky does not stay dark either: OH
  airglow dominates the night sky at these wavelengths, so the air itself is luminous.
  `ground.js` already has an `airglow` veil — it is the right layer to lean on.
- **Visible:** the silhouette as it is today. Nothing to make.
- **UV:** foliage goes black again (chlorophyll absorbs hard in the UV), so the silhouette
  returns — but against a black sky, because the atmosphere is opaque below ~300 nm. See
  the altitude note below.
- **X-ray / gamma:** ground is dead black, and so is everything else. **You cannot have
  this view from a forest floor at all.**

Three or four hand-painted variants of the silhouette cover the reflective bands. No
sourcing needed for this layer.

### The opaque bands should be gated on altitude, not hidden

This is the good idea in the feature and it needs no new machinery. UV, X-ray and gamma
are not "unavailable" — they are unavailable *from the ground*, and the exhibit already
flies out of the atmosphere. `ground.js` `veils(altKm)` already fades haze, seeing and
airglow on the way up, and the altimeter already has rungs at 3, 12, 30 and 100 km.

Roughly where each band opens up:

| Band | Clears at |
|---|---|
| Near-UV (~300 nm) | above the ozone layer, ~35 km |
| Far-UV | higher still |
| X-ray / gamma | essentially the top of the climb, ~100 km |

So selecting X-ray on the forest floor should show black, with the sky *arriving* as the
visitor climbs — which is a truthful, physical answer instead of a disabled menu item, and
it gives the climb a second reason to exist. `TOP_KM` is 120, so the whole range fits
inside a trip the exhibit already takes.

---

## 6. Honesty rules — this exhibit's whole pitch is that nothing is fudged

Read the Scope section of `index.html` before you write any copy. The standard is that
**every display choice is named on the page.** There are currently four and they are
listed. If you add a fifth, list it.

Specific traps for this feature:

- **The stars will be predictions, not photometry.** The Yale BSC gives V and B−V only —
  no J/H/K. An IR star colour is "what a blackbody at this temperature would emit in this
  band," which is the same approximation the visible colours already make. Defensible,
  but it must be *labelled*, not assumed.
- **The visible panorama cannot become an IR image by maths.** If a band has no plate,
  say so; do not synthesise one. That is exactly the failure that got the old panorama
  deleted.
- **Don't overclaim the alignment.** The surveys are all galactic all-sky, so they align
  — but say that they're separate instruments with separate calibrations, not one
  measurement.
- Colour in every band is false colour. Say so once, plainly.

---

## 7. Hard-won gotchas — each of these cost real time

1. **The Browser pane reports `document.hidden === true`, so `requestAnimationFrame`
   never fires.** The exhibit will look frozen and it isn't. Verify by driving the
   renderers directly (construct a `HSAT_Sky` or `HSAT_PhotoSky` and call `.render()`),
   or capture the rAF callback and step it by hand.

   The pane does run rAF while you are interacting with it, but throttled to about
   **0.5 Hz** — so any transition shorter than a few seconds renders in one or two frames
   and you cannot see it at all. If you need to *watch* a timed animation rather than
   reason about it, temporarily multiply its duration constant by ~7, drive the trip, and
   sample. The landing was verified this way (`LAND_MS` 3400 → 24000, hooking
   `Ground.prototype.paint` to log altitude and canopy opacity each call, then restoring
   it). A band crossfade will need exactly the same treatment.
2. **`PhotoSky.resize(w, h)` multiplies by `devicePixelRatio`.** The framebuffer is
   `ps.W × ps.H`, not what you passed in. Reading `readPixels(0,0,480,270)` after
   `resize(480,270)` on a retina display silently samples one quarter of the frame and
   gives you a confidently wrong number. Always use `ps.W`/`ps.H`.
3. **Index any Doppler lookup by `log D`, never by `cos θ′`.** At 0.99998 c the entire
   visible sky sits inside `cos θ′ > 0.9999`; 256 uniform texels put the whole forward
   cone between the last two of them and the lookup silently comes back empty at exactly
   the speeds it exists for. This bug shipped once already.
4. **Determine a plate's longitude handedness by measurement, not assumption.** Sample
   at the catalogue positions of the Magellanic Clouds (LMC: l=280.5, b=−32.9;
   SMC: l=302.8, b=−44.3). The correct convention puts the LMC at ~2.7× its surrounding
   annulus; the wrong one gives ~0.97 — nothing there. Correlating against the Galaxy
   model in `galaxy.js` will **not** discriminate, because that model is nearly
   symmetric in longitude.
5. **Control every test before you believe it.** A star-position test that showed
   "no signal" for the suspect panorama showed the same no-signal for a known-real ESO
   plate — the test was broken, not the image. A peak-brightness test ranked a real
   photograph as the least real of four. Both would have produced a confident wrong
   conclusion. If a test says something surprising, run it against a known-good control
   first.
6. Bump the `?v=` query on any `<script>` you touch in `index.html`, or the browser will
   serve you a stale file and you will debug a bug you already fixed.

---

## 8. UI notes

- **`installRoomMenu()` in `/effects.js` (~line 1650) is shared *behaviour*, not shared
  styling.** Per `/AGENTS.md`, every room styles its own nav. Match this exhibit's
  existing glass-panel look; don't import another room's CSS.
- The info sheet (`#info-sheet`) is the existing pattern for opt-in depth and it already
  has a section nav. The band selector is a *control*, not a document, so it likely
  belongs nearer the speed rail's chip row than buried in the sheet — but Ric said
  hamburger, so put it in the hamburger and show him.
- The camera is locked at 49° vertical, horizontal from aspect ratio. **Do not add a
  zoom.** `sky.js` says why: a quiet zoom would make the whole exhibit a lie.
- Everything must still work at every point on the speed rail, in the rear view
  (`#look-back`), and in the magnified inset.

---

## 9. Two open questions Ric hasn't answered

Don't guess these; ask him.

1. **The band angle.** With the panorama now correctly oriented, the Milky Way runs at
   its true ~58.6° through the opening frame, not the ~30° the old (wrong) roll gave.
   If he wants it flatter, the honest lever is the *camera* — setting the camera's up
   vector to the galactic pole puts the band horizontal and is a legitimate physical
   choice ("galactic north is up"). It must be changed in **both** `sky.js` and
   `photo-sky.js` or the stars will rotate away from the photograph.
2. **Forward sharpness.** 4096 wide is 11.4 px/deg; the old front plate was ~21 px/deg
   over the opening view (though its detail was invented). If the resting view reads as
   soft, the fix is a high-res forward crop cut from ESO's 6000×3000 original — same
   source, so no colour mismatch and no gain fitting, just a resolution tier.
