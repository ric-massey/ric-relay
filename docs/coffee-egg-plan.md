# The coffee egg — plan

Written 2026-11-26 from a conversation with Ric.

**Status:** the first part of B is built (2026-11-26, Ric: "first lets do the one
without mochi … filling the page to about 3/4 of the way … as if its coming from like a
kurig, just straight down but a bit off center"). `assets/coffee.js` pours it, always —
Mochi or not, for now. Later that day (Ric: "make it drain after 5 sec and make the coffee
that comes from the top a bit more foamy and a thicker bar it has to seem like it would fill
it in the right amount of time"): the stream is a thick foamy bar whose width × speed is
the flow, so the fill time follows from it (about 5.5 s on a 1440×900 screen, 3.5 on a
phone); five seconds after it is full it drains through the floor (Torricelli, about 4.5 s),
and the canvas goes. Then (Ric: "make it a bit more see through and then make it rotate based on angle of the
phone … for a phone make it so it leaves after 40 min"): it is more transparent, the pool's
surface follows the phone's angle with a slosh, and on a phone it stays forty minutes
before draining. The stream itself still falls straight down the screen whatever the angle.
And (Ric: "if the top left or right it drains from there as if someone is drinking it"):
tipped until the coffee reaches the top edge, it runs out there. After Ric found the first
version stepped ("it needs to be smooth like your dumping it out … use actual math"), it is
exact at any angle: the coffee is the screen below a level line, and each point of the top
edge it covers lets it out at Torricelli's speed — a sip past a corner, a pour on its side,
a dump upside down (about a second). Bubbles and crema ride the coffee's own flow.
Then (Ric: "do it real gravity … use the real wave formula … 2d should make it easier"):
real gravity at the screen's physical size, and the waves are the 2D tank's standing waves
at the dispersion relation's frequencies; a tip is carried to level by those waves.
Then (Ric: "that splash isn't realistic for the width of the screen. Neither is the waves.
The thickness … my gf also said it looks more like soda"): a Keurig's 5 mm stream (a laptop
fills in about 11 s, a phone in 1.5 — about 6 since 2026-11-27, when the stream was scaled to the cup: about 1 mm on a phone), the puddle meets the walls as a reflected bore a few
times its depth, a smaller churn, and the coffee look — Beer–Lambert colour, gloss, steam,
a few bubbles at the rim, no crema band.
Then creamer (Ric: "what about if we were to add creamer and get the swirls", then "little
bit of creamer about a second after full"): a second after it is full a splash of creamer
(2% of the coffee) is poured in by hand, left of centre. It is a few percent denser than
the coffee, so it sinks, and the sinking rolls up into mushroom-headed plumes and curls on
its own — a small 2D fluid solver for the inside of the coffee (Stam's stable fluids on a
staggered grid, buoyancy, friction, a free surface). Rebuilt the same day as plain two-liquid
physics (Ric: "think of it as just a liquid and another liquid mixing … high quality and clean
looking"): a pressure solve that converges, the second liquid on a finer grid, the stream's
real momentum, and none of the first version's patches.
Then the whole thing became one liquid simulation (Ric: "the creamer has like weird lines it
isn't smooth and it also doesn't move when I shake it. Also the waves don't work like liquid
because there is no splashes"): FLIP particles and a pressure solve for the coffee and the
creamer together, so it splashes, sloshes, throws drops, feels the phone's shaking
(devicemotion) and comes to rest; the creamer settles on the bottom. AGENTS.md has the rules it
leaves. What slows it is friction (Ric: "what
slows it is the friction of the creamer on the coffee"): viscosity, and turbulence at Taylor's
measured rate. It goes from pale curls in black coffee to settled layers, heaviest at the
bottom (Ric: "it should settle realistically. Like settle on the bottom"), then the solver
stops so a phone can sleep.
Then the pour itself (2026-11-27, Ric: "make the pour better … pause the pour and you'll see
what I mean"). Frozen, the stream was a stack of short translucent pieces, banded at every
overlap, ending in a rounded tip floating above a gap over the liquid. It is now one smooth
body drawn as nested opaque ribbons (Beer–Lambert across the chord, as before), running just
under the drawn surface at the lowest point across its width, with a small fillet where it goes
in, a rounded front while it falls and a rounded tail when the pour stops.
Then the top and the finger (2026-11-27, Ric: "the top layer, the one that rolls … seems to have
something go behind it and in front of it … more realism without going way off of the style",
and "make it so the finger swishes the coffee around on mobile. so it will mix the creamer").
The first try looked down into the cup with coffee2's geometry, so a strip of the top always
showed above the front edge; Ric: "the coffee can't be sitting behind it the entire time. It
should be level. But when there is a ripple there is coffee back there so it looks like ur head
on". So it is seen head on: a still cup is a level line, and the surface further back shows
only where a wave puts it above the surface at the glass — in troughs, and behind the dip the
jet digs. That far surface is made from the near one (chosen, not measured: a crest crosses the
cup at an angle, so the higher of the surface 15 mm either way, smoothed 4 mm, 0.15 s late) and
shown only past 1 mm of the particles' shimmer, faded in over 1.5 mm. It is lit a little more
at its crest and paler where creamer is up. A finger on a phone is a 12 mm pad
dragged through the liquid: what it passes through takes its speed (capped at 1.5 m/s), and
the solver makes the wake and swirls; the creamer mixes by the eddy diffusion it already had.
The touch is listened to passively, so the page under still scrolls and taps. Measured: two
seconds of circles at the bottom lift settled creamer into the cup that, left alone, stays put
(`.github/test/coffee.mjs`). Not checked on a real phone yet.
Then how a pour goes, where it lands and the stream's light (2026-11-27, Ric: "it should take
like 3 sec to start and it should start by dripping. Slowly going to full fill. Then slowly
stopping with some drips too … the coffee landing in there needs to look pretty realistic … I
want the stream to look better too"). The coffee's flow is a schedule now (`plan`, `flowOf`,
`sentBy` in `coffee.js`): two seconds of drops closing from half a second apart to a tenth, a
stream from 15% of full flow swelling to all of it over a second, the full flow for as long as
the cup needs, the same back down over 1.2 s, then drips further and further apart for about four
seconds. The stream is drawn as wide at each height as the flow was when that water left the
spout, so a swelling travels down it. Then (Ric: "is it really a plunging jet? Normally it's
dropping in lol … the stream itself is stagnant", then "there should be a crater. Just not a
massive one … the liquid at the top shouldn't be really moving and it should be accelerating as it
falls"): the sheet pours about six times a 5 mm round stream's volume per millimetre of a 25 mm
cup, so it lands at 0.6 of its speed with all its volume — chosen by eye between no dent (0.16,
the real stream's push) and a hole half the cup deep (1); the creamer keeps its full push, to
plunge and curl — and takes in only a few fine bubbles that rise straight back. The spout is at
the screen's top edge and the coffee leaves it at a Keurig's 0.27 m/s (237 ml in 45 s through
5 mm), drawn as a round jet narrowing as 1/√speed, so it is slow and wide at the top and a fast
thread where it lands; the sheet keeps the old spout's volume so the fill time is unchanged. On the stream, ripples (9
and 23 a second), a wobble (3 a second), streaks along it (6 a second) and glints are all
functions of when the water left the spout, so they fall with it; before, its ripples crawled
down at 6 cm/s on water falling at 1.5 m/s and the stream looked still. Its light is a narrow
line left of its middle with a sheen and a dim rim on the right. All those numbers are chosen to
look right; the test integrates `flowAt` from outside and holds the fill to it.
What is **not** built yet: drinking it on a computer (where nothing tips), all of A (Mochi), and the edge cases
below except reduced motion, the front door and iPhone tilt permission.

## `coffee2`: the brief, in stages

Ric wrote a build brief on 2026-11-26 ("Interactive Coffee — Build Brief"): real black coffee
in a shallow three-dimensional cup behind the screen, a mostly frontal camera that shows the
top surface, conserved volume, a continuous rendered surface with coffee's optics, then
detail, then the phone's motion. He set the order: "get it to work without my phone and the
rotation stuff. Then add in the rotation sense after the rest is working". It is built as
`coffee2` (`assets/coffee2.js`) beside `coffee` until he says it replaces it.

1. **Computer, plain shading** — done 2026-11-26. The shallow cup in WebGL2 on the existing
   2D FLIP physics; fixed steps; pause when hidden; lost-context recovery; the books
   (`?coffeedebug`). Measured on this desktop: about 3 ms a step and under 2 ms to draw on a
   laptop-sized screen, 1.6 and 0.4 on a phone-sized one.
2. **Computer, the look** — done 2026-11-27. One light for everything: a dim room, brighter
   overhead, and a soft light low behind the cup, which is what the top of the coffee mirrors.
   Water's Fresnel (F0 = 0.02): seen at a glance, the top is mostly a mirror, so its highlights
   move with the waves; its normals are smoothed over the capillary length (2.7 mm), below
   which real coffee has no ripples, and its place is not, so it meets the front edge. The body
   is seen through the cup's whole depth and is nearly black: a deep red-brown from light
   scattered back, warmest just under the surface, and opaque. Pieces in flight (found as the
   liquid not joined to the floor or walls) are as thick as they are wide, so warm light comes
   through them by Beer–Lambert and their rounded faces reflect; the stream the same across its
   chord. No outline round the pool. Refraction is left out: the page cannot be sampled, and
   through coffee this dark it would not show.
3. **Computer, detail** — creamer, bubbles, foam, splash sheets, the wet film, the contact
   edge against the glass; the mouse and a finger stir it like a spoon (Ric: "the mouse and
   your finger is going to act like a spoon and mix the creamer").
4. **Tipping with the mouse or keyboard** — the open top, pouring out, on a computer.
5. **The phone** — the motion sensors (the iPhone sign rule `coffee` learned applies), then
   recordings on Ric's iPhone: filling, slow tilts, fast movement, partial and complete pouring,
   and a long run for heat and throttling.

Open question for stage 2 or 3: in a real 3D cup the volume is area × depth, and a real
Keurig's 5 mm stream would take minutes to fill a screen-sized cup 25 mm deep (about 1.7 l on
a laptop). `coffee2` keeps `coffee`'s fill time for now (the stream behaves as a sheet the
cup's depth wide); whether the stream should look as wide as it pours, or the cup be
shallower, is Ric's call.

## `coffee3`: live 3D, fixed horizontal view

Added 2026-11-27, after Ric linked the iStock "Blue liquid 3D animation" reference and
asked whether its look was possible live, including phone tilt: "a horizontal view ...
so it should be simpler", then "make it as coffee3". This is **a separate command**,
not a replacement for either existing cup or the Blender experiment in `assets/coffee2/`.

`assets/coffee3.js` is a classic, self-contained script, lazy loaded by `terminal.html`
and the front door's embedded-command handler. No build, runtime library, external asset,
video or server is needed. WebGPU requires a capable browser/device and a secure context
(HTTPS, localhost, or a browser that permits it on a local file). If unavailable, it shows
a short notice; it does not silently show `coffee` and call that the new version.

The liquid is a shallow **3D MLS-MPM** volume: particles carry velocity and an affine
velocity matrix; quadratic weights transfer mass/momentum to a stagger-free 3D grid,
pressure and viscosity push it, gravity acts, then particles gather the velocity and move.
Integer atomics store the GPU grid at a fixed-point scale of one million. The top is open;
particles crossing it are lost, and a central floor opening drains them. No lost particle
is recycled. `active.audit()` reads the actual particle buffer back, reporting finite
values, counts, depth, average position, speed and WebGPU validation errors.

The camera is exactly straight on, at zero elevation (Ric, 2026-11-27: "And it should
be straight on. Not at an angle"). The volume rays and droplet projection use the same
camera definition: changing a point's depth never shifts its image height. A filtered 3D density
field is reconstructed from the particles. Cubic B-spline sampling and a short ray march
produce the curved surface, its normal and the liquid's optical thickness. Coffee absorbs
warm light through that thickness (Beer–Lambert); its surface reflects two broad procedural
soft lights with Fresnel reflectance. There is no extruded ribbon or displaced surface wave,
stock texture or prerecorded splash. Cubic reconstruction matters: a trilinear density
field left visibly straight facets, and independently rendered spheres made the first
version look beaded. The grid is 64 cells across on a computer, 44 on a coarse-pointer
device, eight deep with four cells between the walls; height follows the viewport aspect.
Detached particles too small for the density field have their own round, depth-tested
surfaces with the same light and absorption. Sub-grid capillary normals add fine reflected
detail using ω² = gk + (σ/ρ)k³, with σ/ρ approximated by 0.000072 m³/s²; their amplitude
follows measured motion. They move neither the silhouette nor any liquid volume.

Gravity is 9.81 m/s², mapped using 0.2646 mm per desktop CSS pixel or an estimated 68 mm
phone short side. The selected nozzle radius is 6 mm on a computer, 2.5 mm on a phone,
limited to fit the shallow depth. The spout is gravity-fed from a chosen two-cell head,
so its maximum exit speed is √(2gh), rather than an arbitrary pump speed. Its **cylindrical** flow is
πr² × speed; particle count divided by rest density is volume,
so fill duration follows from those quantities, not a hand-set timer. The target is
nominally three quarters of the cup. The pressure law is weakly compressible, so that is
a volume target rather than an exact final surface-height guarantee. Molecular kinematic
viscosity is 0.8 × 10⁻⁶ m²/s (a hot-water approximation, not a coffee measurement), with
Smagorinsky's Cs = 0.17 for unresolved shear. Nozzle size, optical constants and lighting
remain chosen. It does not yet model foam, steam or capillary sheet geometry below the grid's scale.

**Pour, air and cream, 2026-11-27** (Ric: "Wait 3 seconds, then start slowly", "should
accelerate as it falls", "bubbles added", then "when coffee is done some creamer gets
dropped in"). There is no emission for three simulated seconds. The valve then opens
smoothly over three seconds. Its integrated flux sets each parcel's birth time; that
parcel keeps its own starting speed and accelerates at 9.81 m/s². A retarded-time stream
profile draws those same parcels at each height, including the leading dribble and falling
tail. Maximum speed at a given height obeys v² = 2g(head + fall), without slowing gravity.
The selected two-cell head is a modelling choice, not a measured coffee machine.

After all coffee has landed, a 0.65 s pause precedes a smaller creamer pour, at a different
horizontal position. Its dose is 6% of the coffee volume, added to the actual particle
budget. Cream particles retain their material identity while the shared velocity field
advects and stirs them; a second 3D field reconstructs local concentration for warm milk
scattering. Concentration and carrier density share a wider reconstruction kernel, with
cubic sampling at the front surface, so the colour does not show square grid cells.
A Boussinesq-style 3% density excess encourages the plume to sink. These are
chosen cream properties, not measurements; there is no molecular diffusion or separate
decorative plume. The moving particles produce the mixing visible at the grid's scale.

Up to 128 entrained-air tracers are born under the impact. They follow the liquid grid,
rise opposite gravity (a chosen 55 mm/s slip speed), and pop on leaving the liquid or
after four seconds. Small refractive-looking dark centres, bright rims and glints are
shaded through the coffee; they do not displace liquid or enter its volume ledger.

**Correction after Ric's first look, 2026-11-27**: "wow it looks gross and coffee gets
left there ... it looks like sludge". The first version had an overly wide simulated
particle column, globally damped velocity and an overly broad reconstructed surface.
The pour is now exact free fall in air: analytical parcels carry birth times, narrow by
continuity as they accelerate, and become GPU particles only when they reach the measured
surface. A small GPU probe reads that surface, so the stream joins the actual pool.
The accounting is **emitted = in cup + out + in flight**; source and particle counters
are captured together when read back, even if another frame lands more coffee while the
readback is pending. Emission still follows cylindrical flux, so the narrower source
genuinely takes longer rather than filling with unexplained extra volume.

The old permanent centre hole stranded two pools beside it. The floor is now a gate:
it opens at the centre and spans the whole width after 0.4 s of simulated time, allowing
all particles to leave under gravity. No remnant is left active and no particles are
erased by a fade. The overlay is destroyed only when **zero particles** and **zero in
flight** remain. The earlier browser test merely required an 80% reduction; that passed
while the bug was visible. It now waits for the complete lifecycle and another pour.

Drag anywhere to stir; Alt-drag sets desktop gravity for tipping. These listeners never
prevent page interaction. On phones, orientation provides a consistent reference and
acceleration including gravity provides tilt/shakes; the motion sign is checked against
orientation, with the iPhone reversed-sign assumption until calibrated. Sensor permission
is requested in the command's original keypress/submit gesture, before lazy loading.
Permission denial leaves the upright cup usable. The desktop hold is five seconds after
the **last creamer parcel lands**, and the phone hold is forty minutes. The page suspends while hidden;
a quiet cup can stop submitting GPU work and wake for motion or its drain deadline.
Reduced motion uses a static cup without initialising WebGPU. Resizing keeps the particles
and fits their view to the new window; it does not rebuild or refill the simulation.

Simulation steps are fixed and bounded, and GPU submissions are awaited to keep the queue
short. A slow device loses simulated elapsed time. FPS and elapsed simulation time are
different measurements; desktop results do not establish iPhone performance. Real-device
iPhone permission, orientation, shaking, sustained thermal/battery behaviour and rotation
between portrait and landscape still need Ric's phone. Stock-render fidelity is not claimed.

Validation:

- `node .github/test/coffee3.mjs`: physical units, gravity-fed speed, delayed/ramped flux,
  parcel acceleration, stream profile, coffee-plus-cream capacity and both
  command entry points; registered in `.github/checks.mjs`.
- Serve the repo and open `.github/test/coffee3-browser.html?coffeedebug`; **Run GPU checks**
  compiles all actual WGSL, reads actual GPU particles and exercises finite state, emitted
  volume, delayed emission, impact bubbles, coffee-before-cream ordering, cream material,
  depth, changed gravity, open-top spilling, teardown, re-pouring and the floor drain.
  It reports a failure instead of treating missing WebGPU as a pass. This is manual browser
  verification, not a Node mock and not silently included in CI.

Original verification, 2026-11-27: 13 GPU checks passed on the desktop profile and at 375 × 812
with `?phone&coffeedebug` (which selects the actual 44-cell phone profile). Both command
entry points were opened at phone width. CPU checks cover orientation axes in portrait
and landscape, the Apple acceleration sign, reduced-motion teardown/re-pouring, and
unsupported-WebGPU cleanup as well as units and flow. These are desktop browser tests,
not physical iPhone results. A site-wide check run also found 65 failures in unchanged
People Sandbox tests; `ways.test.mjs` was reproduced independently with that folder
identical to HEAD. Garmin and KONDRITE's socket failures passed outside the network
sandbox. The coffee permission-pattern regression found by the old coffee suite was
fixed by keeping its original gesture handler and adding coffee3's alongside it.
The correction above strengthens the GPU suite: it now verifies the in-flight ledger,
complete drainage to zero, overlay removal, another pour, and draining a just-started cup.
The first suite's partial-drain assertion was insufficient even though it passed.
The strengthened suite passed on both desktop and phone profiles on 2026-11-27, including
zero particles after draining and a successful new pour. Phone hardware remains unverified.
The delayed pour, bubbles and cream passed 23 GPU lifecycle checks on 2026-11-27, including
zero particles and zero in flight after both doses drain, on desktop and the 44-cell
phone profile. The final cream/bubble shaders also compiled and passed the lifecycle;
manual checks covered the cream stream, its smoothed concentration and mouse stirring.


The MLS-MPM transfer equations are adapted from **matsuoka-601/Splash**, MIT, which credits
Hu et al. and nialltl. The final density-volume renderer is specific to this shallow view;
it does not use Splash's screen-space renderer. The MIT notice and references are retained
in `assets/coffee3-LICENSE.txt`. B-spline interpolation follows the eight-trilinear-lookup
construction described by Sigg and Hadwiger, *Fast Third-Order Texture Filtering*, GPU Gems 2.

## The idea, in Ric's words

> "the cup is the screen. the website fills with coffee.... also i want it to look like
> coffee.... maybe not do the milk part. … or maybe i have mochi push a mug onto the
> screen and leave with some of it spilling onto the website page."

> "if mochi is enabled it pushes the cup otherwise it is the fill up the screen idea"

So `coffee` does one of two things, and the one check is whether Mochi is awake in this
tab (`window.RELAY_CATS?.active()`, the `sessionStorage` flag `effects.js` already
keeps; the front door already sends `cats` with every command it hands its hidden
terminal).

**Creamer:** dropped from the first version of the idea, then asked for again the same
day (above). Milk "making it a cup" was the worry; it is a splash, poured in, not a mug.

## A. Mochi is awake: he knocks the mug over

1. A mug appears on the page, sitting on a real surface (the top edge of a card or
   section, found the same way Mochi already finds edges to settle on).
2. Mochi walks to it, sits, looks at the visitor (`look` frames), and swats it off
   (`feather-anticipate-1/2` → `feather-swat-1/2` → `swat-recover-1/2`). Those frames
   exist; check that the swat reads against a mug before drawing anything new. If a
   new frame is needed, it needs its row in `CAT_FRAME_X` / `CAT_FRAME_Y` /
   `CAT_FRAME_SCALE` (AGENTS.md, Mochi's worlds).
3. The mug tips and the coffee spills **onto the page itself**: it pools on the top
   edges of real elements and runs off their sides as drips, rather than being a
   picture laid over the page.
4. It ends as a puddle and a **coffee-ring stain that stays until refresh**, which is
   how the trip modes already behave (refresh-to-reset). No reset button and no Escape
   exit (house style).
5. Mochi walks off, or grooms, as he likes.

The mug is drawn in code, not an image file.

## B. Mochi is asleep: the screen is the cup

1. A pour stream comes in from the top of the screen, splashes, and the coffee rises
   until the screen is full.
2. **Phone:** the coffee follows the phone's angle and sloshes as it is tilted
   (`DeviceOrientationEvent` sets the direction of gravity).
3. **Computer:** it drains away in gulps until the page is back. Optionally the mouse
   tilts it.
4. Pointer events pass through to the page once it has drained; while full, nothing on
   the page needs to be clickable.

## How the liquid should work

What was planned here first (a height-field surface with particles only for the stream and
splash) was built, and then replaced, because it could not splash or feel a shake. What is
built is one 2D FLIP simulation for everything, on a 2D canvas, no library: see AGENTS.md
("`coffee` fills the screen with coffee") for how and the rules it leaves.
- For Idea A the spill is mostly particles plus small height-field puddles on each
  surface it lands on; the "surfaces" are the page's own element rectangles.

## Making it look like coffee

This is most of the work and what decides whether the egg lands.

- Darker the deeper it is; amber-brown where it is thin (the pour stream, the edges,
  drips).
- A lighter crema band on the surface with small bubbles that drift and pop.
- A glossy highlight along the surface line that moves when it sloshes.
- The page faintly visible behind it and slightly bent, as if seen through liquid, not
  a flat brown sheet.
- The stain (Idea A) is a dried ring: darker at the rim, pale in the middle.

## Edge cases, and what to do

- **Climbing (`climbing.html`):** Mochi is on the wall there. The mug sits on a ledge
  he climbs past and he swats it on the way up.
- **Space (KONDRITE, Starfield — `data-mochi-world="space"`):** zero gravity. The
  coffee floats out of the mug as wobbling blobs instead of spilling. If that is too
  much, these pages do the screen fill instead; ask Ric which.
- **The front door's prompt:** the terminal runs in a hidden frame
  (`terminal.html?embed=1`), so the effect has to play on the front door, not in the
  frame. Same path as Mochi and the trip modes: the terminal posts a message up and the
  front door runs it (`RELAY_CATS` / `RELAY_EFFECTS` stand-ins; messages checked for
  origin and source both ways).
- **Where the code lives:** sitewide effects belong in `effects.js` (house style), so
  the coffee goes there, or in a file it loads only when `coffee` runs so nobody pays
  for the fluid code on every page.
- **Full-screen canvas games** (KONDRITE, OFFRAMP, FARLIGHT, Starfield's flight page)
  skip the trip modes because a filter over a canvas is a second renderer. A coffee
  overlay is the same problem: decide per page, and keep it off any page that is
  being played.
- **Reduced motion:** a still frame. Idea A: the tipped mug and a puddle. Idea B: the
  screen full of coffee with its crema and highlight, then gone on the next tap.
- **iPhone tilt** needs `DeviceOrientationEvent.requestPermission()` from a user
  gesture. The Enter that ran `coffee` may count; if it does not, show a small "tap to
  tilt" the first time. Android needs nothing. With permission refused, it drains like
  the computer version.
- **Mochi asleep but `data-mochi-only` pages:** nothing special, the check is just
  whether he is awake.

## Rough size

- Idea B, looking really good: about 3–4 days.
- Idea A, with the spill running over real page elements: about 3–5 days.
- Both, sharing one liquid engine: about a week. A rough prototype that already feels
  like liquid: about a day, best done first in a scratch file to see how good it gets.

## When it ships

- Update the `coffee` row in `EASTER_EGGS.md` to say what it does now.
- `effects.js` changes: keep the reduced-motion fallback and room-to-room behaviour.
- Add a test to `.github/checks.mjs` if there is anything testable (the Mochi check,
  the reduced-motion path, the front door message).
- Remove this file's "nothing here is built yet" line, or the file, once it is true.
