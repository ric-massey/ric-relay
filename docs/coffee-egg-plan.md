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
fills in about 11 s, a phone in 1.5), the puddle meets the walls as a reflected bore a few
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
