# KONDRITE — sound design

**Status:** a design, written 2026-11-13. Nothing in it is built yet; what plays today
is still the README's description. Its first finding is a live bug (§2.1).

**What it is:** the plan for replacing every sound in the game. It lists every action,
animation, place and event that makes a sound or should, says what each one should sound
like and why, and gives the research behind the choices.

**Read first:** the README's sound section, which describes the engine this builds on.

## Contents

1. [The brief](#1-the-brief): what Ric decided
2. [Where the game is now](#2-where-the-game-is-now)
3. [The rules](#3-the-rules)
4. [The mix](#4-the-mix)
5. [Ambience](#5-ambience)
6. [Every event, and what it sounds like](#6-every-event-and-what-it-sounds-like)
7. [Animations that need their sound timed to them](#7-animations-that-need-their-sound-timed-to-them)
8. [Where the sounds come from](#8-where-the-sounds-come-from)
9. [Music](#9-music)
10. [Accessibility](#10-accessibility)
11. [Testing](#11-testing)
12. [Order of work](#12-order-of-work)
13. [Open questions](#13-open-questions)
14. [Research](#14-research)

---

## 1. The brief

All decided by Ric on 2026-11-13:

| Decision | His words |
|---|---|
| Every current sound is replaced | "The sounds that exist now are going to change." |
| Not arcade; ultra realistic | "I don't want the game to sound like an arcade game. I want it to sound like a hyperrealistic game." · "I say ultra realistic." |
| Futuristic | "Think futuristic." |
| Space carries sound | "Sound doesn't travel in a vacuum but imagine it did." |
| A sensor feed brings threats forward | "Sensor feed." |
| No speech anywhere | "Ship doesn't speak." |
| Sound fades with distance, not at the screen edge | "I like the new plan." |
| The simulators stay arcade | "Simulators can be arcade sounding" |
| Free public recordings first | "First try free public ones." |
| Making our own sounds is an option, not a requirement | "Making our own sounds was an idea not necessity" |
| Music later | "I want some but I'm not sure what to do about it yet." |

**In one paragraph:** KONDRITE should sound like a real place full of real machines
that happen not to exist yet. Every sound starts from a real recording. Space carries
sound the way open air does, so things fade, dull, echo and slide in pitch the way they
would outdoors. Your own ship is the closest and loudest thing in your world. A sensor
feed makes sure the thing about to kill you is never lost in the noise. Nothing plays a
tune and nothing speaks, except inside the arcade cabinets, which are allowed to sound
like what they are.

---

## 2. Where the game is now

### 2.1 A live bug: the alarms are silent

`gameSound("alarm")` is called in three places:

- crossing into a boss's sky (`game/bosses.js:271`)
- the warlord calling its pack in at half hull (`game/bosses.js:315`)
- a grudge ship coming back for you (`game/sector-places.js:1059`)

`sfxVoice` in `game/sound.js` has no `alarm` voice, so all three play nothing. They are
three of the most dramatic moments in Survey. `test/sounds.js` did not catch it because
it checks the voices the engine knows, not the names the game asks for (§11, test 1).

### 2.2 The palette, and why it sounds like an arcade

Eighteen voices, all one-shots under 0.4 s, on four volume channels, called from about
190 places through `gameSound(kind, x, y)` (`game/world.js`):

| Channel | Voices |
|---|---|
| WEAPONS | `laser` `beam` `scatter` `seeker` `lance` (five `.wav` files written by `sounds/make-lasers.py`) · `shot` |
| IMPACTS | `hit` `rock` `boom` `tink` `fizz` `explode` |
| SHIP & GADGETS | `warp` `thrust` `pickup` |
| INTERFACE | `start` `win` `lose` |

It sounds like an arcade for four reasons:

- **Oscillators.** Square, saw and triangle waves with pitch sweeps (`soundTone`) are what
  1980s cabinets were made of. Even the gun files are synthesised by a script.
- **Tunes as feedback.** `start`, `win` and `lose` are melodies, and ore pickups are
  notes off a pentatonic scale.
- **One noise for every impact.** Every hit is the same white-noise buffer through a
  low-pass filter, so rock, ice and metal sound alike.
- **No space and no weight.** Every sound is dry, short and the same size. A Skiff and a
  Tender sound alike, and so do near and far.

### 2.3 What is structurally wrong, whatever the sounds become

- **Three voices mean everything.** `win` plays for twelve different events, including a
  sale, an almanac entry and a boss kill. `hit` plays for hull damage and also for every
  refused shop button. `start` plays for the round starting, a purchase, the decoy and
  the cloak.
- **The signature actions borrow voices.** The scan, the verb Survey is named for, plays
  `shot`. The cloak and the decoy play the round-start tune. The EMP plays a hull hit.
  The mine, the Corsair Burner and the Brood Bay play `shot`, and the Burst Charge plays
  the seeker.
- **Nothing continuous makes a sound.** There is no engine, no ambience and no loops at
  all. Thrust, the most-performed action in the game, is silent.
- **Warnings that are only drawn.** The four gravity levels (`surveyWarning`), the hull
  at zero, a sentry waking, a patrol's last warning, a distress call and an enemy ace
  arriving have no sound, or only the generic `hit`.
- **Arrivals are silent.** Docking, landing, coming out of a wormhole, respawning, and a
  station section coming back online.
- **No priority and no distance.** The shot at you is no louder than forty that aren't,
  and a sound is either at full level on screen or cut dead off it.
- **Smaller things.** The mothership finale slows the picture but not the sound. The
  audio keeps running in a hidden tab. There is no mono option and no ambience dial.

### 2.4 What stays

The machinery around the sounds is good and stays: the volume channels, the 35 ms
de-duplication, per-play variation, the compressor, `test/sounds.js` and the listening
booth (`sounds/listen.html`). Today's oscillator voices are not deleted. They move into
the arcade cabinets (§6.11).

---

## 3. The rules

### 3.1 Space carries sound like open air

Every sound in the world has a position, and the ship is the listener. A sound arrives
the way it would across open air:

| Effect | Rule |
|---|---|
| **Level** | falls with distance; big things (explosions, capital ships, stars) carry further |
| **Air absorption** | the further away, the duller: a near cannon cracks, a far one thuds |
| **Direction** | panned by bearing from the ship |
| **Doppler** | anything fast that passes the ship rises in pitch as it comes and drops as it goes |
| **Pass-by** | a round that passes close makes a whizz; the rail lance also cracks |
| **Delay** | big events only (an explosion, a capital ship dying, a wormhole opening): far enough away, you see the flash first and hear the boom after, like thunder. Everything else is instant, because delaying ordinary sounds just reads as lag |
| **Occlusion** | a planet, the Leviathan's plates or a cave wall between you and a source muffles it |
| **Echo** | only where there is something to echo off: the Warrens, the Leviathan, the Vault, a station's interior, close against a big hull |

**The hearing edge is distance, not the screen.** The README's rule ("if you can see it,
you can hear it") becomes *if it is close enough to hear, you hear it*. Something just
off screen is faint, and a battle two screens away is a low rumble. Online, the host
already sends every sound with its position, so each guest can apply its own distance.

### 3.2 Where the listener is

- **On board:** your engine, guns, systems and hull, heard from inside the ship. They are
  full-range, close and heavy, inside a small metal room (a short cockpit reverb).
- **Out there:** everything else, through §3.1.

Your own ship is always the closest and clearest thing you hear.

### 3.3 The sensor feed

After the physics and before the mix, the ship weights what you hear by how much it
matters to you:

| Source | Treatment |
|---|---|
| Aimed at you: a round on a collision course, a seeker locked on, a ship or sentry firing at you | louder (+4 to +6 dB) and kept bright |
| Hostile and near, not aimed at you | as the physics says |
| Not your fight (two powers at war, a raid on someone else) | quieter (−4 dB) and a little duller |
| Your own ship | always full |

It also raises two warnings: a **lock tone** when something targets you, and a
**missile-approach tone** that quickens as a seeker closes. Both are modelled on a real
radar warning receiver.

Because the feed is a ship system, the world can take it away. The Murk jams it, your own
EMP knocks it out for `EMP_STUN`, and Silent Running turns it off. In all three, physics
is all you have left.

### 3.4 How every sound is built

- **A mechanism, then a recipe.** Decide what is physically happening (a capacitor
  discharging, a turbopump spinning), then pick real recordings that would plausibly sound
  like it. That is how Star Wars and Dune made machines that don't exist (§14.2).
- **Layers:** an attack, a body (the material), a tail (the space) and, under about
  100 Hz, a sub you feel. Exaggerate the attack and the sub; that is what makes it "more
  real than real".
- **Several takes, not one file pitched about.** Keep three to six recordings of anything
  that repeats, and rotate them.
- **Mass and material are parameters.** An impact knows what hit what, how hard, and how
  heavy each was. Each hull has its own engine and its own hits.
- **Tails are cut, not stacked.** A gun that fires several times a second cuts its own
  tail short.
- **No tunes.** A success is the physical thing succeeding: a clamp locking, a machine
  starting.
- **No speech.** Nobody talks, on the ship or on the radio. Comms are squelch, carriers
  and data bursts, with the words on screen as now.
- **Tones only where real hardware makes them:** warnings, the scanner, the radio. Model
  them on the real thing.
- **Silence is a material.** The Long Empty, a death, the moment after a wormhole.

### 3.5 The interface

- **Pages that belong to the ship** (the chart, almanac, station, hangar and inventory)
  sound like hardware: a detented switch, a relay, a membrane key, a print head. They
  never beep a note.
- **Pages outside the fiction** (the front page, Settings, the account door) are nearly
  silent, with one tactile click to move and one to choose. The front page plays nothing.

---

## 4. The mix

```
world sound ─► takes ─► distance ─► air absorption ─► occlusion ─► Doppler / delay ─► pan
                                                                               │
                                           sensor feed weighting ◄─────────────┘
                                                                               │
                         echo of the space you are in (open, cave, hull, station) ─► WORLD
your ship ─► takes ─► cockpit reverb ─────────────────────────────────────────────► SHIP
warnings, scanner, radio ─────────────────────────────────────────────────────────► INSTRUMENTS
beds, details, emitters (§5) ─────────────────────────────────────────────────────► AMBIENCE
pages and menus ──────────────────────────────────────────────────────────────────► INTERFACE
                                         all ─► ducking ─► master ─► compressor ─► limiter
```

- **Dials:** WEAPONS, IMPACTS, SHIP, INSTRUMENTS, AMBIENCE and INTERFACE, plus MUSIC when
  §9 is decided. Also a **mono** switch, because pan carries direction.
- **Ducking:** a warning, the scan or a radio burst pulls the world and the ambience down
  while it plays. A discovery (§6.8) pulls everything down for a second so it has room.
- **Loops** have one manager that starts, updates and stops them with ramps, and caps how
  many run.
- **A cap per kind of sound** stops the least important one first.
- **Level targets:** the ambience sits well under the foreground (§5.8). The whole game
  measures near −18 LUFS integrated, the figure reported for portable platforms (§14.6).

---

## 5. Ambience

Ambience is the sound of being somewhere. In KONDRITE it does a job nothing else does.
BIOMES.md says regions are **noticed, never named**: the game never tells you what kind of
space you are in, and you learn it by being there. The sky's tint does this a little. Sound
can do it far better, because you notice a change in what you hear before you could say
what changed.

### 5.1 How an ambience is built: four layers

Game ambience is built from layers, not one long recording, because detail inside a loop
becomes recognisable as it repeats (§14.4):

| Layer | What it is | Example: the Rime |
|---|---|---|
| **Bed** | a continuous, quiet loop that is the character of the place | a far-off, wide crackle of ice in every direction |
| **Detail** | short sounds at random times and positions around you, never inside the bed | an ice body cracking somewhere to the left; a grind of two floes |
| **Rare** | an occasional larger sound that makes a place memorable | a long, singing crack that runs across the whole field |
| **Emitters** | sounds attached to real objects, positioned and faded by distance (§3.1) | the ice bodies you can see, creaking as they turn |

Bed and detail are the place. Emitters are the things in it.

### 5.2 One rule above the rest: ambience never invents an event

KONDRITE has a rule for its living world: *the news reports the record and never creates
an event*. Ambience follows it.

- **Allowed:** ordinary, unseen activity that is simply true of a place. Rocks collide in
  a belt, ice cracks in the Rime, industry hums in the Works, a front rumbles with
  distant war.
- **Never:** a sound that means something in the game, unless a real object made it. No
  boss roar, no distress beacon, no nearby gunfire, no ship passing unless a real ship
  is passing. If it would make a player turn around, it has to be there when they do.

### 5.3 What drives it

All of these are already in the code:

| Input | Where | What it changes |
|---|---|---|
| Region kind | `regionAt(x, y)` (`survey-world.js:265`) | which bed and which details |
| Depth into the region | `regionDepth(x, y)` (`survey-world.js:339`), 0 at a border, 1 at the middle | how loud the bed is, and how often details come. The same value already fades the starfield tint, so sound and sky change together |
| Political band | territory · the front · the frontier · lawless · the deep void (`survey-world.js:422`) | a second, quieter layer on top of the region (§5.5) |
| Nearby objects | stars, black holes, wormholes, stations, worlds, hulks, wrecks, traffic, battles, landmarks | emitters (§5.6) |
| The ship's state | docked, landed, in an atmosphere, cloaked, under EMP, hull at zero, light drive, on a page, dead | how the whole ambience is heard (§5.7) |
| The seed and position | `seeded()`, as the chunks use | which details play and where, so **the same place always sounds the same**, the way the same chunk always holds the same stars |

### 5.4 Every region

The fourteen region kinds in `survey-world.js`. **Level** is the bed's loudness relative
to ordinary space.

| Region (key) | Bed | Details | Rare | Level | Recipe (real recordings) |
|---|---|---|---|---|---|
| **Ordinary space** (`normal`) | almost nothing: the faintest wide hiss | very sparse: a distant clank, something far off moving | — | lowest but one | room tone of a very large empty hall |
| **Settled reach** (`reach`) | a gentle far-off hum of traffic and stations | distant engines passing; a docking clamp somewhere | — | low | distant airport, a harbour at night |
| **The Belt** (`belt`) | slow, heavy grinding of rock on rock, far away | a rockfall; two boulders knocking | a big collision that rolls on for seconds | medium | quarry, rockfalls, boulders rolling |
| **Shard field** (`shards`) | a brittle, glassy shimmer | sharp cracks, splinters | a slab shattering | medium | slate and glass breaking, scree |
| **The Rounds** (`rounds`) | a soft rolling rumble | stones rolling and tapping | — | medium-low | a pebble beach, stones rolling |
| **The Violet Cloud** (`cloud`) | a wide, soft wind that closes in like fog | gusts | a long gust that leaves near-silence behind it | medium | wind over open ground, distant surf |
| **The Murk** (`murk`) | static and crackle, denser toward the middle; it jams the sensor feed (§3.3) | discharges, tearing | a loud discharge, and a flash on screen with it | rises with depth | dry electrical crackle, a thunderstorm's static, a dust storm |
| **The Boneyard** (`bones`) | cold wind through metal | a sheet of wreck knocking; a long groan | a large wreck shifting | medium | scrapyard, ship-breaking yard, wind through a wreck |
| **The Wells** (`maw`) | deep roars beating against each other, felt more than heard | the hull creaking under pull | — | medium, mostly sub | infrasonic thunder, a big furnace far away |
| **The Rime** (`rime`) | a far-off crackle of ice in every direction | ice cracking, floes grinding | a long singing crack across the field | medium | frozen-lake ice singing and cracking, icebergs calving far off |
| **The Warrens** (`warrens`) | close cave air; your own engine echoing off the walls | dust trickling; small rock falls | a passage settling with a long rumble | low, but loud echo | cave and mine tunnels, quarry tunnels, dust |
| **The Lanes** (`lanes`) | steady traffic noise | engines passing with Doppler; beacons | a convoy passing | medium | distant motorway, aircraft overhead |
| **The Works** (`city`), the rare urban region (1.8%) | the roar of a whole world's industry, swelling as you approach | machinery, hammering, cranes | a huge machine starting | highest | steelworks, shipyard, container port, a city from a rooftop |
| **The Long Empty** (`open`) | **nothing** | **nothing** | **nothing** | **silent** | — |

**The Long Empty is the one place where the design is taking sound away.** BIOMES.md asks
for six or seven minutes in which the player wonders whether the generator has broken. So
there is no bed and no detail, and the ship's own idle drops a little. When the single
pixel appears, the only thing that can break that silence is a real object, so the
first sound in minutes is that object, and it means something.

### 5.5 The political layer

Over the region, quieter, and fading in by the same depth:

| Band | What it adds |
|---|---|
| Territory | nothing; ordinary held space |
| The front | a far-off war: booms and gunfire too distant to place, now and then (allowed by §5.2, because a front is at war) |
| The frontier | a little less traffic than the region alone would have |
| Lawless | rougher, scattered engines; no beacons |
| The deep void | the region's bed thinned toward nothing |

### 5.6 Emitters: the things in the world

Each is a loop attached to a real object, faded by distance and muffled behind solid
things (§3.1). The nearest eight play at most.

| Object | What it sounds like | Recipe |
|---|---|---|
| **A star** | the loudest thing in the sector: a vast roar like a furnace heard from far off, rising as you close | blast furnace, gas flare stack, forest fire |
| **A binary pair** | two roars beating against each other | two furnaces |
| **A black hole** | a deep rumble you feel more than hear, falling in pitch as you close | infrasonic thunder, earthquake recordings |
| **A wormhole** | a low, slowly turning rush, like a giant intake | wind tunnel, a turbine intake |
| **A station** | its machinery and traffic: ships docking, cargo moving. Each owner's stations sound different, and yours gets fuller with every part (§6.7) | container port, factory, ventilation plant |
| **An inhabited world** | traffic in its sky; its weather once you are in its air | distant town, wind, rain |
| **A world with air** (`pl.air`) | wind at its edge | wind |
| **A hulk (cache) or a wreck** | slow metal creaks as it turns | ship-hull creaks |
| **Ships** | their engines, by hull, with Doppler | per hull (§6.1) |
| **A battle** | the fight itself, distant | §6.2 |
| **The Leviathan** | a dead giant: deep groans, and old machinery still turning inside | tanker interior, grain silo, empty steel tank |
| **The Vault** | sealed: a still, held hum from whatever keeps it locked | bank vault, bunker |
| **NODE 01** | a machine room, structured and inhuman | server room |
| **LAST TRANSMISSION** | **the one landmark heard before it is seen**: its beacon carries a very long way and gets clearer as you close | lighthouse fog signal, a beacon |
| **Asteroids in view** | their own creaks and knocks, from their material (rock, ice, shard, round) | as the region |

### 5.7 How the ship's state changes what you hear

| State | Ambience |
|---|---|
| **Docked** | space is replaced by the station's interior, heard through the docking collar |
| **Landed / in an atmosphere** | the world's air takes over: wind, buffeting, weather |
| **Silent Running** | everything goes duller and closer, the sensor feed is off, and your own ship is nearly silent |
| **EMP** | the sensor feed drops out; the ambience is unchanged, because it is physics |
| **Hull at zero** | the breach loop sits on top (§6.1); the ambience stays, a little duller |
| **Light drive** | beds cross-fade quickly as regions rush past, under a rush of wind at speed |
| **A full-screen page** (chart, almanac, station) | the world is not drawn, but it still exists: ambience drops to a distant, muffled version |
| **Paused** | everything fades out over half a second, and back in on resume |
| **Dead** | everything gone, held in silence, then the station on respawn |

### 5.8 Transitions, repetition and budget

- **Borders blend.** At a border, `regionDepth` is near 0 on both sides, so both beds are
  quiet and the change happens through a lull. That keeps the BIOMES rule that a region
  arrives over thousands of units and never switches on at a line.
- **No audible loops.** Beds are long (60–90 s), start at a random point, and never hold a
  recognisable detail. Details have random intervals with a minimum gap, random positions
  and pitch, and never play twice in a row.
- **Same place, same sound.** Detail timing and position come from the seed and the
  position, so a place you return to sounds as you remember it.
- **Subtle.** The bed sits roughly 15–20 dB under the foreground in ordinary flight. The
  Works and the Murk are the loud exceptions, on purpose.
- **Budget.** One bed and one political layer at a time, plus the next region's bed while
  crossing; up to eight emitters; up to three details at once. Beds are fetched when a
  region is near, not all at load.

### 5.9 Outside Survey

- **Station interiors** (the shop, the hangar, the cabinet room): their own room tone
  behind the pages, and fuller as your own station is repaired.
- **The simulators:** a station room with the cabinet in it, which is what you are
  hearing the arcade sound through (§6.11).
- **Menus and the front page:** none.

---

## 6. Every event, and what it sounds like

Every row is something the game already does. **Today** is what plays now; — means
silence. **Recipe** names real recordings to start from, judged by ear in the end.
**P** is priority: P0 broken, P1 core, P2 depth, P3 polish.

### 6.1 Your ship

The drive is a fusion torch: plasma through a magnetic nozzle, fed by pumps, with the
whole frame carrying it.

| Event | Code | Today | What it should be | Recipe | P |
|---|---|---|---|---|---|
| Thrust held | ship update | — | **engine loop**: nozzle roar, turbopump whine, magnetic hum; level and brightness follow throttle; a tail on release. Each hull has its own: the Skiff light and rattly, the Tender deep and slow | NASA launch pad microphones, jet turbine run-ups, a large transformer, a sub layer | P1 |
| Engine start / stop | first thrust after rest | — | an ignition thump and pumps spinning up; spin-down and valves closing | turbine starter, heavy solenoid, a pump winding down | P2 |
| Reverse thrust | ship update | — | the forward nozzles: thinner, more hiss | the engine high-passed, compressed air | P2 |
| Turning | ship update | — | **attitude jets**: valve clicks and short pops of gas | solenoid valves, air-brake blow-offs, air tools | P2 |
| Above cruise speed (slingshot, burner) | `me.boost` | — | the engine screaming and the frame straining, bleeding off with the boost | the engine pitched up, wind at speed | P2 |
| Idle | always | — | the ship is never silent: fans, a coolant pump, the odd relay | HVAC fans, a car's cooling fan, pumps, relays | P1 |
| Hull hit | `physics.js:321–340` | `hit` | an impact chosen by **what** hit you and **how hard**: attack, plate ring, sub, panned to where it struck | steel plate, car door, sledgehammer on sheet metal | P1 |
| Hull reaches zero | `physics.js:339` | `hit` | a crack through the frame, then a **breach loop** (venting air, a pressure alarm, creaking) until you mend | metal tearing, an air-line leak, hull creaks | P1 |
| Scrape (no damage) | collision | — | metal on rock or metal at contact speed | metal dragged on stone and concrete | P2 |
| Hard contact | collision | `hit` | a scrape into a heavy clank | car-crash foley, a heavy chain dropped | P2 |
| Death (Survey) | `survival.js:520` | `lose` | the ship going up around you, then **total silence**, held before the death screen | a close explosion, then nothing | P1 |
| Respawn | `survival.js:560` | — | systems starting one by one inside the station | the idle's sources starting in turn | P1 |

### 6.2 Weapons

Every gun has a **report** heard out there, and, when it is yours, a **mechanism** heard
on board.

| Weapon | Code | Today | What it should be | Recipe | P |
|---|---|---|---|---|---|
| Cannon | `physics.js:610` | `laser.wav` | a pulsed beam ionising its path: an electrical snap, a twang along the bolt, a recharge whine; short, cuts its own tail | high-voltage arc snaps, a struck tensioned cable, a camera flash recharging | P1 |
| Industrial beam | `physics.js:610` | `beam.wav` | a hard buzz while it holds; frying and spitting where it bites rock | arc welder, plasma cutter, Tesla coil | P1 |
| Scatter gun | `physics.js:674` | `scatter.wav` | three bolts at once, slightly staggered, heavier than the cannon | three arc snaps over a shotgun body | P1 |
| Seeker rack | `physics.js:674` | `seeker.wav` | a launch-rail clank and a small motor lighting; out there a missile's hiss with Doppler | missile and model-rocket launches, a blowtorch lighting | P1 |
| Burst Charge | `physics.js:674` | `seeker` | a heavier, lobbed launch thump | a mortar or grenade launcher | P2 |
| Burst Charge goes off | `physics.js:731` | `boom` | an explosion, delayed with distance | real explosions, a sub, debris | P1 |
| Rail lance | `physics.js:674` | `lance.wav` | a capacitor charge whine, a huge thump through the frame, the slug's hypersonic crack, the rails ringing | defibrillator charge, a big gun's report, a supersonic crack, a struck steel beam | P1 |
| War Fan / Warden's Swarm | boss parts | scatter / seeker | foreign hardware: rougher rails, a different motor | your recipes from cruder machines | P2 |
| Another ship firing | many | the same files | the same voices through distance and the sensor feed | — | P1 |
| A round passing close | bullet update | — | a whizz with Doppler; the lance also cracks | race-car pass-bys with the engine filtered out, a bullet crack | P1 |
| Targeted / missile closing | sensor feed | — | the lock tone, and the missile-approach tone | modelled on a radar warning receiver | P1 |
| A round hits rock | `update.js:339, 353` | `tink` | the strike at the rock's distance, by material | stone chiselling, ice cracking, struck steel | P1 |
| A round runs out | `update.js:365` | `fizz` | nothing | — | — |

### 6.3 Devices (the four slots)

| Device | Today | What it should be | Recipe | P |
|---|---|---|---|---|
| Decoy | `start` | a pneumatic launch, a hatch cycling, then the decoy's emitter faking your engine as it drifts off | paintball launcher, a hatch, your engine thinned | P1 |
| Mine laid | `shot` | a magazine clunk, a release latch, an arming relay at 1.6 s | heavy latch, ammo can, relay | P2 |
| Near your own armed mine | — | a proximity tone, quickening | tone | P2 |
| A mine goes off | `boom` | an explosion (§6.2) | — | P1 |
| A mine fizzles out | `fizz` | its electronics dying | a valve amp switching off | P3 |
| Cargo eject | `rock` | bay doors, a pressure thump, cargo scraping out | hydraulic doors, crates on a ramp | P1 |
| Emergency jump | `warp` | a rising overload, a structural bang, then arrival in near silence | a transformer failing, a big arc, then nothing | P1 |
| Grapple | `thrust` | harpoon launch, cable paying out, a hard catch, winch strain; a miss is a dry click | speargun, winch, steel cable under load | P1 |
| Silent Running | `start` | the ship powering down system by system until it is nearly silent; firing slams everything back on | the idle's sources stopping in turn, then all at once restarting | P1 |
| EMP | `hit` | a charge whine, a deep electrical *whump*, then your own systems dying and rebooting after `EMP_STUN`; every stunned machine out there falls silent too | defibrillator charge, a transformer blowing, a power cut, a computer booting | P1 |
| Corsair Burner | `shot` | an afterburner lighting into the boost | jet afterburner, dragster launch | P2 |
| Brood Bay | `shot` | three hatches in sequence and a chittering release | hatches, slowed insect wingbeats | P2 |
| Flagship Screen takes a hit | `hit` | a field under load: a deep thrum and an overload crackle, not a hull impact; a rising hum as it recharges | transformer hum, crackle, a large bell's hum | P1 |

### 6.4 The Survey instruments

| Event | Code | Today | What it should be | Recipe | P |
|---|---|---|---|---|---|
| **Scan pulse** | `survey-setup.js:661` | `shot` | an active sensor firing: a transmitter thump and an outgoing ping | active sonar, radar transmitter | P1 |
| **Scan returns** | `surveyScan` | — | one return per contact, **delayed by its distance** and panned by bearing; metal rings, rock is soft, a wormhole bends, a sentry pulses. Closest first, at most about 8 | the ping's echo, filtered by material | P1 |
| Scan finds nothing | `survey-setup.js:782` | — | the ping, then an empty receiver's hiss | receiver hiss | P2 |
| Scan blocked by your EMP | `survey-setup.js:654` | — | a dead transmitter's click | relay | P3 |
| Scan in the Murk | `scanRange()` | — | the ping smeared, returns broken up | the ping through crackle | P2 |
| Tractor beam | tractor | — | an electromagnetic hum while something is in the beam, then a clunk at the intake | maglev hum, magnet on steel | P2 |
| Ore into the hold | `sector.js:730` | `pickup` (25%) | a conveyor, and ore landing, fuller as the hold fills | gravel into a steel bin | P2 |
| A rock breaks | `physics.js:167` and others | `rock` | the rock splitting at its distance, by material | quarry rock, boulders; ice for the Rime | P1 |
| Hold full | `sector.js:171` | — | the intake jamming | a conveyor jamming | P2 |
| Melter | `factions.js:877` | — | hissing, popping boil and a pump | kettle, ice in a hot pan | P3 |
| Skimming an atmosphere | `surv.overAir` | — | the scoop's roar and buffeting, rising with depth | wind at speed, a car window down | P1 |
| A fit completes | `factions.js:651` | `win` | torque tools, a final lock, the part spinning up | impact wrench, latch, motor | P2 |
| Light drive on | `survival.js:51` | `win` | a heavy spool climbing into a sustained resonance for the run | jet engine to full power, turbine | P1 |
| Light drive off / cut | `survival.js:39, 118`, `physics.js:330` | — | spool-down; a cut is an overload bang and a falling whine | turbine winding down, a breaker tripping | P1 |
| "Too deep in a well to run" | `survival.js:46` | `hit` | the drive trying and failing | an engine failing to start | P2 |

### 6.5 Gravity and the places that kill

| Event | Code | Today | What it should be | P |
|---|---|---|---|---|
| GRAVITY AHEAD → CANNOT ESCAPE | `surveyWarning` | — | four tones rising from caution to a continuous master warning, modelled on aircraft caution and warning tones | P1 |
| Inside a well's pull | hazards | — | **hull stress**: creaks, groans and pings, more and deeper as the pull grows | P1 |
| Near a star | hazards | — | its roar (§5.6), the hull ticking with heat, coolant pumps working harder | P1 |
| A star repairing you | star heal | — | servos and welding, a step per hull point | P2 |
| Near a black hole | hazards | — | its rumble (§5.6) and tidal stress on the hull | P1 |
| A slingshot letting go | telemetry | — | the stress releasing at once, then the engine at speed | P2 |
| Burned in a star | death | `lose` | the roar swallowing everything, then silence | P2 |
| Swallowed by a black hole | death | `lose` | the rumble stretching lower until it is below hearing | P2 |
| The Battle Royale wall | BR | — | a moving energy wall you hear before you reach it; a hard bounce | P2 |
| Into a wormhole | `sector-places.js:192` | `warp` | a structural shriek, a huge rushing pull, every system surging | P1 |
| Out the far side | arrival | — | the rush releasing, systems re-latching, a held quiet moment | P2 |

### 6.6 Places

Covered by §5: every region (§5.4), the political bands (§5.5), every object (§5.6) and
every ship state (§5.7).

### 6.7 Stations, money and the ship's pages

| Event | Today | What it should be | P |
|---|---|---|---|
| Docking | — | proximity alarm, clamps driving home, a seal, a pressure hiss, then the station all around | P1 |
| Undocking | — | the seal breaking, clamps releasing, space again | P1 |
| Landing on a world | — | descent through air, landing struts, the engine winding down | P2 |
| News headline on docking | text | a data burst before the line appears | P3 |
| Selling cargo | `win` | the hold unloading on conveyors, then a terminal confirming (a print head, a stamp) | P1 |
| Buying | `start` / `win` | crates coming in and stowed | P1 |
| Refused | `hit` | the terminal's dry refusal: a key that does nothing | P1 |
| A part delivered: a section comes online | `start` | **the station coming alive around you**: that section's machinery starting. Six sections, six machines, and the station's ambience is fuller each time (§5.6) | P1 |
| THE STATION (all six) | `win` | every section running at once, and a long, held moment of it | P1 |
| Ship bought / swapped | `win` | cranes, clamps, the new hull's engine starting in its own voice | P2 |
| Workbench build | `win` | grinder, welder, torque wrench in sequence | P2 |
| Hull repaired at a dock | `win` | the crew's tools on your hull | P2 |
| Water / food bought | `start` | a pump and a hose coupling; crates stowed | P3 |
| A ship page opens or closes | — | a screen waking, a soft relay | P2 |
| Moving through a page | — | a detented switch, quiet | P2 |
| A chart pin dropped / lifted | — | a hard key press | P3 |
| A chart zoom step | — | a rotary detent | P3 |
| Save pressed | — | a short drive spin and a click | P2 |
| Reset survey, first press | — | a master caution for the four seconds | P2 |
| Reset survey, second press | — | everything powering off, then silence | P2 |
| Front page, Settings, account door | — | one tactile click to move, one to choose | P2 |

### 6.8 Discovery

A discovery used to be a tune. Now everything else goes quiet for a moment, and the ship
records what it found.

| Event | Today | What it should be | P |
|---|---|---|---|
| Almanac entry | `win` | the world ducks for a second; the ship's recorder takes it down; a landmark holds longer | P1 |
| A secret entry (NODE 01, THE LEVIATHAN) | `win` | the instruments failing to identify it | P2 |
| An almanac verb unlocked (6 / 12 / 18) | — | the new system starting for the first time | P1 |
| A part picked up | `win` | lifted and secured in a cradle: one heavy lock | P1 |
| One of the six station parts | `win` | the same, heavier, and the part's own hum on board until it is delivered | P1 |
| Your hull recovered | `win` | its engine answering yours, then clamps | P2 |
| A cache opened / the deep hold | `win` | a sealed container venting, locks releasing | P1 |
| A pale dot in the Long Empty | — | nothing; the silence before it is the sound | — |

### 6.9 The living world and traffic

The living world is "shown before it is said". Its sound follows the same rule: heard
through §3.1 when it is near, and nothing for the events written only as texture
(`chatter(…, false)`).

| Event | Today | What it should be | P |
|---|---|---|---|
| Ships passing | — | their engines with distance and Doppler; a hauler slow and deep, a patrol sharp | P1 |
| Patrol: "that is close enough" | — | a comms burst in that faction's own sound | P1 |
| Patrol: "they told you once" | — | the burst cut short, and the lock tone | P1 |
| Distress call | — | an automatic beacon, weak and repeating, from the hauler's direction | P1 |
| A hauler adrift | — | its systems failing: an engine coughing, venting | P2 |
| Hauler saved / water across | `win` | a hose coupling, pumping, its engine relighting | P2 |
| A battle in view | — | the fight itself, with the booms arriving late | P1 |
| A battle ends | — | the noise thinning to nothing | P3 |
| A scavenger takes your part / a pirate your cargo | — | their tractor's hum and your hold's alarm | P2 |
| Bounty paid | `win` | the terminal's transfer | P3 |
| War, ceasefire, a fallen leader, secession | — | silent unless docked; then a data burst before the headline | — |

### 6.10 Bosses and sentries

| Event | Today | What it should be | P |
|---|---|---|---|
| "Coming up on X's sky" | — | the boss heard before it is seen: a capital ship's engines carry far | P1 |
| Crossing into a boss's sky | **`alarm`: silent (bug)** | the hostile-capital warning, and the boss's own sound rising: the warlord's raiders, the admiral's fleet, the queen's salvage tractors | **P0** |
| The warlord calls the pack in | **`alarm`: silent** | a burst on every channel, and three engines appearing in the distance | **P0** |
| The grudge ship returns | **`alarm`: silent** | its engine coming up behind you, and the lock tone | **P0** |
| Leaving the sky | — | the boss's noise falling away behind | P2 |
| A boss hurt (50%, 25%) | hits | heavier strikes; its systems failing audibly | P2 |
| The Admiral's screen | hit | a field under load, as your Flagship Screen | P2 |
| Corsair dash | — | an afterburner roar with Doppler | P2 |
| The queen sends a taken ship | — | the Brood Bay's release, bigger | P2 |
| A boss destroyed | `explode` + `win` | staggered explosions, the last delayed by distance, then debris | P1 |
| A sentry wakes | — | a servo driving up to target, then the lock tone | P1 |
| A sentry loses you | — | the servo settling, the tone dropping | P2 |
| A guarded cache unsealed | — | a lock releasing | P2 |
| Rammed by the warlord | `hit` | the heaviest collision in the game | P2 |

### 6.11 The simulators

The cabinets sound like arcade games, through a small cabinet speaker, in a station room
(§5.9). Today's oscillator voices move here.

| Event | Today | What it should be | P |
|---|---|---|---|
| A cabinet booting | — | a power switch, a CRT's degauss thunk, a rising whine | P2 |
| Everything during a match | the current palette | the current palette, through the cabinet speaker | P2 |
| The mothership finale (Campaign) | `boom` (5% per frame) | slowed with the picture, through the cabinet | P2 |
| Back from the cabinet | — | the room, then the dock | P3 |

### 6.12 Multiplayer and the front page

| Event | Today | What it should be | P |
|---|---|---|---|
| The front page's attract loop | — | silent | — |
| A player joins / leaves | — | a comms carrier on and off | P3 |
| Connection lost | — | dead air and a warning tone | P3 |

---

## 7. Animations that need their sound timed to them

- **The EMP ring** (`EMP_RING_TIME`, 0.55 s): the whump as it leaves, each stunned thing
  falling silent as the ring passes it.
- **The grapple line** (`surv.grappleTo`, 0.45 s): launch, catch and winch on the drawn line.
- **The scan ring** (`surveyHUD.ping`): each return as the ring reaches its echo.
- **Explosions:** the flash on its frame, the boom when the distance delay says, debris after.
- **Shake** (`addShake`): any shake of 5 or more needs sub-bass, or it reads as a camera bug.
- **The Murk's dither:** the static's density follows the same depth as the shader.
- **The engine flame:** the loop's level follows the drawn flame exactly.
- **Docking clamps and the hangar:** timed to their drawn motion.

---

## 8. Where the sounds come from

### 8.1 Free public recordings first

Every sound starts from real recordings that are free to use and credited. Nothing comes
from an AI generator. The weather room's rule for its sky footage applies here: real
material, credited.

| Source | Licence | From a cloud session (tested 2026-11-13) | Good for |
|---|---|---|---|
| **NASA** (`images-api.nasa.gov`) | public domain; credit NASA | **works** | the drive, ignition, roars. The Artemis II launch from Pad Camera Site 6 is 14 min 44 s at 192 kHz, 32-bit, credited NASA/Lorne Mathre. Use pad and camera-site microphones only: commentary tracks carry speech |
| **Freesound** (CC0 filter) | CC0 per file | **refused**: Freesound denies this cloud machine before the key is checked | nearly everything else: impacts, machinery, ice, wind, electrical, ambience beds. Downloads have to be done from Ric's computer, signed in, because original files need a login |
| **Wikimedia Commons** | PD / CC0 / CC BY per file | **rate-limited** on the shared address | ambience and field recordings; try again later, or from Ric's computer |
| **Recorded by Ric** | his own | — | impacts and machinery: metal, tools, doors, the car, a garage |

Rules for using them:

- **Every file has a credit line** in `sounds/SOURCES.md`: what it is, where it came from,
  its licence and its credit. The universe project keeps a `SOURCES.md` the same way.
- **Originals are never committed.** They live in a git-ignored `_sound-originals/`, the
  way photographs use `_photo-originals/`. Only the trimmed, finished sounds are committed.
- **Size.** The site is near GitHub Pages' 1 GB limit, which is why the photographs are
  moving to R2. Short sounds go in the repository. Long ambience beds go to R2 and are
  fetched when their region is near (§5.8). Aim for the committed set to stay under about
  25 MB.
- **Fallbacks stay real.** A sound that fails to load falls back to the nearest real
  sound already loaded, and a bed falls back to silence. Never to an arcade tone. A page
  opened straight off disk cannot fetch at all, so the core set is committed rather
  than fetched.
- **Format:** compressed, decoded once. Check it plays in Safari before choosing it.

### 8.2 Making our own: an option, not a requirement

Building some sounds in code is possible, but it is not part of the plan. Paul Weir, No
Man's Sky's audio director, put the rule well: procedural audio only makes sense when it
solves a problem conventional sound design would struggle with (§14.5). If a problem like
that comes up, these are the likely candidates, with the evidence:

- **Endless impact variations.** Modal synthesis fits a model to one real hit and plays
  new variations of it. A version shipped in *Crackdown 2*.
- **Beds that never loop:** wind, crackle and patter, which procedural models do
  convincingly.
- **Where it falls short:** in a 2022 listening test, the best synthesised thunder was
  still distinguishable from a real recording. Recordings stay the base.

Sources for all three are in §14.5.

---

## 9. Music

**Deferred.** Ric wants some and has not decided what kind. Things to weigh when it
comes back:

- **Music in the world**, such as something playing in a station while you are docked,
  fits the realism with no argument.
- **A score over Survey** competes with the Long Empty, which has to be empty, and with
  the regions doing their job by ear. If there is one, the layered shape (FTL plays two
  layers and adds the second in a fight, §14.7) lets it thin to nothing where it should.
- Either way it gets its own dial, and the mix leaves room for it (§4).

## 10. Accessibility

- The dials in §4 and a mono switch (Xbox guideline XAG 105, §14.6).
- Sound carries information here: distance, threats, regions. Every piece of it is
  already drawn as well, and must stay that way. No cue may be sound-only (XAG 103).
- Reduced motion turns off the Murk's crackle, as it turns off the grain.
- Loops and alarms stop when the page is paused or hidden.

## 11. Testing

`test/sounds.js` was tuned for synthesised voices. Its limits are no more than 20% of
energy in 2–5 kHz, no more than 15% above 5 kHz, and 0.2 s for anything that repeats.
Real recordings will break those for good reasons: air, metal, ice and electrical arcs
live above 5 kHz, and a real gun has a tail. Keep the intent, which is no ear fatigue,
and measure it differently:

1. **Every sound the game asks for exists.** Collect every literal `gameSound("…")` and
   `playSfx("…")`, and fail on any the engine doesn't know. This catches §2.1.
2. **No oscillators outside the cabinets and the warning tones.** That stops the arcade
   coming back through a fallback.
3. **Fatigue by loudness and repetition, not by spectrum.** A repeated sound stays under
   a short-term loudness ceiling, rotates through at least three takes, and cuts its own
   tail.
4. **Distance does what it says.** Further away is always quieter and duller, and behind
   a solid object is duller still.
5. **Ambience.** The Long Empty renders silence; no bed repeats a detail within its
   length; ten minutes of beds sit under the foreground target in §5.8.
6. **Loops** start and stop without clicks, and their number is capped.
7. **A ten-minute scripted Survey session** (thrust, mining, a scan every 12 s, a fight,
   a dock, crossing two regions) measures near −18 LUFS integrated.
8. **Every file credited** in `sounds/SOURCES.md`.
9. **The listening booth** gets a scene per region, per loop, and each weapon at three
   distances. Someone still has to listen; it is the only test of whether something
   sounds real.

## 12. Order of work

1. **P0:** give `alarm` a real sound, and add test 1 from §11.
2. **The foundation:** loading real files, take rotation, the cockpit reverb, the buses in
   §4, a loop manager, and distance (§3.1). Nothing sounds different yet.
3. **The first recordings:** NASA launches from here; a first set of CC0 impacts,
   machinery and ambience from Freesound on Ric's computer. Start `sounds/SOURCES.md`.
4. **Your ship:** idle, engine, attitude jets, hull impacts by material, breach, death.
   The biggest change in feel.
5. **Weapons:** report and mechanism, whizz and crack.
6. **The sensor feed:** weighting, lock and missile tones, and its failures.
7. **Ambience** (§5): beds and details for every region, then emitters, then the ship's
   states, with the AMBIENCE dial.
8. **The instruments:** the scan, gravity stress and warnings, the light drive.
9. **Stars, black holes and wormholes** as places to be heard.
10. **Docking, and the station coming alive.** This replaces every jingle in Survey.
11. **Devices**, Silent Running and the EMP first.
12. **The interface, the cabinets and the finale.**
13. **Retire** `make-lasers.py`, move the oscillator voices into the cabinets, and update
    the README's sound section to say what is then true.

## 13. Open questions

1. **Getting Freesound files.** Freesound refuses this cloud machine. Will Ric download a
   first batch on his computer (a list can be prepared for him), or record some himself?
2. **Music**, when it comes back (§9).

---

## 14. Research

What each choice rests on. Where a source is press coverage of a talk rather than the
talk itself, it says so.

### 14.1 Hyperreal means "more real than real"

A microphone at a real punch records a dull pat. Foley exists because recorded reality
sounds weak; Tomlinson Holman called Foley "hyper-real", natural only in context because
it is exaggerated.
[arXiv 2605.31082](https://arxiv.org/html/2605.31082) ·
[Langkjær (CORE)](https://core.ac.uk/download/233629168.pdf) ·
[Designing Sound](https://designingsound.org/2016/02/28/sunday-sound-thought-9-constructing-which-reality/)

### 14.2 Imaginary machines from real sounds

- **Star Wars:** Ben Burtt's blaster is a radio tower's guy-wire struck with a wrench or
  hammer (accounts differ). The TIE fighter is an altered elephant bellow; the lightsaber
  is a TV set and a projector motor.
  [No Film School](https://nofilmschool.com/star-wars-sound-design) ·
  [Film Sound](https://www.filmsound.org/starwars/) ·
  [CDM](https://cdm.link/star-wars-and-sound-design/)
- **Dune (2021):** of about 3,200 new sounds, three or four began as synthetic. The
  ornithopter came from beetles, a purr and Mangini's Chevy Volt. Mangini: "We can't find
  a worm, a shield, or an ornithopter in a sound library."
  [MPA](https://www.motionpictures.org/2022/03/dune-oscar-nominated-sound-team-on-sandworms-ornithopters-more/) ·
  [Tor](https://tor.com/2021/11/05/dune-ornithopter-sound-design) ·
  [Synthtopia](https://www.synthtopia.com/content/2022/02/01/the-sound-design-of-dune/)
- **The Expanse:** weapons start "with a real sound, like a real gun sound", then are
  altered. [A Sound Effect](https://www.asoundeffect.com/the-expanse-sound)

### 14.3 Sound across open air

- **Distance:** past a certain distance, air absorbs the highs, so far sounds are
  muffled; games use a low-pass filter whose cutoff falls with distance.
  [Audiokinetic](https://audiokinetic.com/a-wwise-approach-to-spatial-audio-part-1) ·
  [Arma 3](https://community.bistudio.com/wiki/Arma_3_Sound:_Filters) ·
  [Unreal](https://dev.epicgames.com/documentation/en-us/unreal-engine/sound-attenuation-in-unreal-engine)
- **Delay:** delaying every sound reads as being out of sync; film keeps the delay for
  huge explosions.
  [Godot forum](https://forum.godotengine.org/t/how-do-i-make-every-single-node-simulate-the-speed-of-sound-with-delays/143645) ·
  [Taylor & Francis](https://www.taylorfrancis.com/books/e/9781351653954/chapters/10.1201%2Fb22247-10)
- **Pass-bys:** a whizz is a round passing; a crack is a supersonic shock wave; both
  together means very close.
  [PC Gamer on PUBG](https://pcgamer.com/how-gunshot-sounds-work-in-playerunknowns-battlegrounds) ·
  [Morphic](https://morphic.com/resources/sounds/bullet-fly-by-sound-effects) ·
  [Zapsplat](https://www.zapsplat.com/?p=42787)
- **In the browser:** `ConvolverNode` places a sound in the space an impulse response was
  recorded in; short ones keep CPU down.
  [MDN](https://developer.mozilla.org/en-US/docs/web/api/convolvernode) ·
  [Abratabia (vendor blog)](https://www.abratabia.com/web-game-audio/spatial-audio-games.php)

### 14.4 Ambience

- **Layers:** a constant bed, an intermittent detail layer and a rare layer. Detail kept
  out of the bed, because it becomes recognisable as the bed repeats. Random timing,
  position and pitch; stereo beds, mono positional emitters; every layer subtle.
  [Bugnet](https://bugnet.io/blog/how-to-design-ambient-sound-layers) ·
  [Criware](https://blog.criware.com/?p=3193) ·
  [Audiokinetic](https://blog.audiokinetic.com/en/designing-ambience-systems-in-wwise/) ·
  [Splice](https://splice.com/blog/audio-soundscape-for-video-games) ·
  [Creator Sounds Pro](https://creatorsoundspro.com/building-immersive-rpg-worlds-layering-ambient-loops-for-maximum-realism) ·
  [Game Developer, Eon Altar](https://www.gamedeveloper.com/audio/video-game-audio---under-the-hood---eon-altar-ambience-system)
- **Zones and state:** ambient zones painted over a world and blended by a game value;
  state changes that fade over seconds rather than switch.
  [Audiokinetic, image-based parameters](https://www.audiokinetic.com/en/blog/open-world-ambient-design-using-image-based-parameters) ·
  [SCIL wiki, states](https://scil-wiki.su.edu/books/audio/page/using-states)
- **The Last of Us:** ambience laid out as regions matching the level, recorded in real
  abandoned places, and reverb used for contrast between dense and open, active and dead.
  [A Sound Effect](https://asoundeffect.com/the-last-of-us-part-ii-sound/) ·
  [Epic Sound](https://epicsound.com/2014/04/great-in-depth-interview-with-the-audio-team-on-the-last-of-us)
- **Ambience carrying a game alone:** Subnautica's original plan was no music on the
  surface, leaving ambience to set the mood (commentary, not an interview).
  [Spin](https://www.spin.com/?p=369687) · [The Geek Wave](https://thegeekwave.com/2020/06/subnautica-and-sound)
- **Quiet:** Alien: Isolation's realism was praised, and criticised because "everything
  makes noise".
  [PC Gamer](https://pcgamer.com/the-audio-of-alien-isolation) ·
  [AV Club](https://avclub.com/alien-isolation-fills-up-the-quiet-space-that-keeps-re-1798273762)

### 14.5 Making sounds in code

- **When it is worth it:** Paul Weir says procedural audio only makes sense if it solves a
  problem otherwise hard to solve with conventional sound design.
  [Audiokinetic Q&A](https://www.audiokinetic.com/en/blog/behind-the-sound-of-no-mans-sky-a-qa-with-paul-weir-on-procedural-audio)
- **What works:** modal synthesis of impacts, fitted to one recording, shipped in
  Crackdown 2. Farnell's *Designing Sound* covers fire, wind, water, gunshots and
  explosions.
  [Microsoft Research](https://microsoft.com/en-us/research/?p=309038) ·
  [Ren, Yeh & Lin](https://typeset.io/pdf/example-guided-physically-based-modal-sound-synthesis-1z2lkvntsi.pdf) ·
  [UNC, sheet metal](https://www.cs.unc.edu/~austonst/tempSupportDamping/data/vrsub.pdf) ·
  [Farnell practicals](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/8375/designing_sound.zip/practical31.html) ·
  [A Sound Effect](https://asoundeffect.com/procedural-game-sound-design)
- **Its limit:** in a listening test of over 50 people, the best synthesised thunder was
  still distinguishable from a recording.
  [Fineberg, Walters & Reiss](https://arxiv.org/pdf/2204.08026.pdf) ·
  [Queen Mary](https://qmul.ac.uk/media/news/2021/se/queen-mary-spinout-nemisindo-launches-online-sound-design-service-based-on-procedural-audio-technology-.html)

### 14.6 Priority, loudness and accessibility

- **Overwatch** remixes live by each enemy's distance and whether it is aiming or
  shooting at you (press coverage of the GDC talk).
  [PC Gamer](https://pcgamer.com/how-overwatch-uses-sound-to-pinpoint-threats-you-cant-see) ·
  [GDC Vault](https://gdcvault.com/play/1023010/Overwatch-The-Elusive-Goal-Play)
- **DICE:** "play the right sounds, not all sounds"; Battlefield 6 lists threat-based mixing.
  [Frostbite](https://frostbite.com/frostbite/news/how-hdr-audio-makes-battlefield-bad-company-go-boom) ·
  [ESA](https://www.theesa.com/behind-the-scenes/an-orchestra-of-the-battlefield-inside-the-audio-design-of-battlefield-6-with-mari-saastamoinen-minto/)
- **Loudness:** Sony's guidance is reported as about −24 LUFS for home platforms and −18
  for portable ones (secondary sources).
  [Designing Sound](https://designingsound.org/2012/07/30/video-games-and-loudness-standards-interview-with-sonys-garry-taylor/) ·
  [Audiokinetic](https://audiokinetic.com/loudness-processing-best-practices-series-chapter1-loudness-measurement-part1)
- **Accessibility:** separate dials (XAG 105) and every cue in more than one sense (XAG 103).
  [XAG 105](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/105) ·
  [XAG 103](https://learn.microsoft.com/en-gb/gaming/accessibility/xbox-accessibility-guidelines/103)
- **Game feel:** good feel needs impactful, non-repetitive sound.
  [Wikipedia](https://www.wikipedia.org/wiki/Game_feel) ·
  [Juice it or lose it](https://gamejuice.pages.dev/articles/juice-it-or-lose-it-lessons)

### 14.7 Music and navigation

- **FTL** adds a percussion layer over a base track when a fight starts.
  [NPR](https://www.npr.org/2013/10/06/229171039/composing-game-soundtracks-that-move-faster-than-light)
- **Layering and resequencing** are the two standard ways music follows play.
  [Game Developer, Winifred Phillips](https://www.gamedeveloper.com/game-platforms/hybrid-horizontal-vertical-structure-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-)
- **Outer Wilds** built its exploration around tracking distant signals by ear, the model
  for LAST TRANSMISSION.
  [Mobius Digital](https://www.mobiusdigitalgames.com/news/separating-the-signal-from-the-noise)

### 14.8 Free sources

[NASA Image and Video Library API](https://images-api.nasa.gov/search?q=launch&media_type=audio) ·
[Freesound API](https://www.freesound.org/docs/api/overview.html) ·
[CDM on NASA's sound library](https://cdm.link/nasa-posts-huge-library-space-sounds-youre-free-use/)

**Nobody has listened to any of this yet.** It is a plan to be built and then judged by
ear in `sounds/listen.html`.
