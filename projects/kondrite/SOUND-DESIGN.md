# KONDRITE — sound design

**Status:** a design, written 2026-11-13. Nothing in it is built yet; what plays today
is still the README's description. Its first finding is a live bug (§2.1).

**What it is:** the plan for replacing every sound in the game. It covers every action,
animation, place, warning and event that makes a sound or should, what each one should
sound like, and the idea behind it.

**How it was checked:** every `gameSound` call, every on-screen message (`chatter`, 126
of them), every notification, banner and HUD warning, every page and every device in the
code was read and given a home here. Appendix A lists them so a missing one can be seen.

**Read first:** the README's sound section, which describes the engine this builds on.

## Contents

1. [The brief](#1-the-brief): what Ric decided
2. [Where the game is now](#2-where-the-game-is-now)
3. [The rules](#3-the-rules)
4. [The ideas behind it](#4-the-ideas-behind-it)
5. [Warnings: one ladder](#5-warnings-one-ladder)
6. [The mix](#6-the-mix)
7. [Ambience](#7-ambience)
8. [Every event, and what it sounds like](#8-every-event-and-what-it-sounds-like)
9. [Animations that need their sound timed to them](#9-animations-that-need-their-sound-timed-to-them)
10. [Where the sounds come from](#10-where-the-sounds-come-from)
11. [Music](#11-music)
12. [Accessibility](#12-accessibility)
13. [Testing](#13-testing)
14. [Order of work](#14-order-of-work)
15. [Open questions](#15-open-questions)
16. [Research](#16-research)
- [Appendix A: every message, and where its sound is](#appendix-a-every-message-and-where-its-sound-is)

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
| Top tier, with an idea behind every choice | "We need the sound quality and sound design to be top tier design. With good ideas behind all of it" |

**In one paragraph:** KONDRITE should sound like a real place full of real machines that
happen not to exist yet. Every sound starts from a real recording. Space carries sound
the way open air does. Your own ship is the closest and loudest thing in your world, and
it tells you how it is doing without you looking at the HUD. A sensor feed makes sure the
thing about to kill you is never lost in the noise. Warnings follow one ladder, the way a
real cockpit's do. Nothing plays a tune and nothing speaks, except inside the arcade
cabinets, which are allowed to sound like what they are.

---

## 2. Where the game is now

### 2.1 A live bug: the alarms are silent

`gameSound("alarm")` is called in three places:

- crossing into a boss's sky (`game/bosses.js:271`)
- the warlord calling its pack in at half hull (`game/bosses.js:315`)
- a grudge ship coming back for you (`game/sector-places.js:1059`)

`sfxVoice` in `game/sound.js` has no `alarm` voice, so all three play nothing.
`test/sounds.js` did not catch it because it checks the voices the engine knows, not the
names the game asks for (§13, test 1).

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
- **Tunes as feedback.** `start`, `win` and `lose` are melodies, and ore pickups are notes
  off a pentatonic scale.
- **One noise for every impact.** Every hit is the same white-noise buffer through a
  low-pass filter, so rock, ice and metal sound alike.
- **No space and no weight.** Every sound is dry, short and the same size.

### 2.3 What is structurally wrong, whatever the sounds become

- **Three voices mean everything.** `win` plays for over a dozen events, from a sale to an
  almanac entry to a boss kill. `hit` plays for hull damage and for every refused shop
  button. `start` plays for the round starting, a purchase, the decoy and the cloak.
- **The signature actions borrow voices.** The scan plays `shot`. The cloak and the decoy
  play the round-start tune. The EMP plays a hull hit. The coil firing and throwing you
  across the sector plays `lose`.
- **Nothing continuous makes a sound.** No engine, no ambience, no loops at all.
- **Warnings that are only drawn.** The gravity levels, the light drive's five-second
  collision countdown, the hull at zero, the tank steps, the thirst and hunger clocks, a
  sentry waking and a faction sending a hunter have no sound, or only the generic `hit`.
- **Arrivals are silent.** Docking, landing, coming out of a wormhole, respawning.
- **No priority and no distance.** The shot at you is no louder than forty that aren't,
  and a sound is either at full level on screen or cut dead off it.
- **Smaller things.** The mothership finale slows the picture but not the sound. The
  audio runs on in a hidden tab. There is no mono option and no ambience dial.

### 2.4 What stays

The machinery around the sounds stays: the volume channels, the 35 ms de-duplication,
per-play variation, the compressor, `test/sounds.js` and the listening booth
(`sounds/listen.html`). Today's oscillator voices are not deleted; they move into the
arcade cabinets (§8.15).

---

## 3. The rules

### 3.1 Space carries sound like open air

Every sound in the world has a position, and the ship is the listener:

| Effect | Rule |
|---|---|
| **Level** | falls with distance; big things (explosions, capital ships, stars) carry further |
| **Air absorption** | the further away, the duller: a near cannon cracks, a far one thuds |
| **Direction** | panned by bearing from the ship |
| **Doppler** | anything fast that passes rises in pitch as it comes and drops as it goes |
| **Pass-by** | a round that passes close makes a whizz; the rail lance also cracks |
| **Delay** | big events only (an explosion, a capital ship dying, a wormhole opening): far enough away, the flash comes first and the boom after, like thunder. Everything else is instant, because delaying ordinary sounds reads as lag |
| **Occlusion** | a planet, the Leviathan's plates or a cave wall between you and a source muffles it |
| **Echo** | only where there is something to echo off: the Warrens, the Leviathan, the Vault, a station's interior, close against a big hull |

**The hearing edge is distance, not the screen.** The README's rule ("if you can see it,
you can hear it") becomes *if it is close enough to hear, you hear it*. Online, the host
already sends every sound with its position, so each guest applies its own distance.

### 3.2 Where the listener is

- **On board:** your engine, guns, systems and hull, heard from inside the ship. They are
  full-range, close and heavy, in a small metal room (a short cockpit reverb).
- **Out there:** everything else, through §3.1.

### 3.3 The sensor feed

After the physics and before the mix, the ship weights what you hear by how much it
matters to you:

| Source | Treatment |
|---|---|
| Aimed at you: a round on a collision course, a seeker locked on, a ship or sentry firing at you | louder (+4 to +6 dB) and kept bright |
| Hostile and near, not aimed at you | as the physics says |
| Not your fight (two powers at war, a raid on someone else) | quieter (−4 dB) and a little duller |
| Your own ship | always full |

It raises the **lock** and **missile-approach** warnings (§5). Because it is a ship
system, the world can take it away: the Murk jams it, your own EMP knocks it out for
`EMP_STUN`, and Silent Running turns it off.

### 3.4 How every sound is built

- **A mechanism, then a recipe.** Decide what is physically happening, then pick real
  recordings that would plausibly sound like it. That is how Star Wars and Dune made
  machines that don't exist (§16.2).
- **Layers:** an attack, a body (the material), a tail (the space) and a sub under about
  100 Hz. Exaggerate the attack and the sub; that is "more real than real".
- **Several takes, not one file pitched about:** three to six of anything that repeats.
- **Mass and material are parameters.** An impact knows what hit what, how hard, and how
  heavy each was.
- **Tails are cut, not stacked.**
- **No tunes.** A success is the physical thing succeeding.
- **No speech.** Comms are squelch, carriers and data bursts, with the words on screen.
- **Tones only where real hardware makes them:** warnings, the scanner, the radio.
- **Silence is a material.**

### 3.5 The interface

- **Pages that belong to the ship** (chart, almanac, station, hangar, inventory,
  workbench) sound like hardware: a detented switch, a relay, a membrane key, a print
  head. They never beep a note.
- **Pages outside the fiction** (front page, Settings, the account door) are nearly
  silent: one tactile click to move and one to choose. The front page plays nothing.

---

## 4. The ideas behind it

The rules say what is allowed. These say what the sound is *for*. Each one is a reason
to design a sound a particular way, and each is used throughout §8.

### 4.1 One sound, one meaning

A player learns a sound only if it always means the same thing. Today `win` means a sale,
a discovery and a kill, so it teaches nothing. Every event in §8 gets a sound of its own
kind, and a family of related events shares a material, not a file. Selling and buying
are both the hold and the terminal, but they are never the same sound.

### 4.2 The ship tells you its state, so you can keep your eyes on it

The README's warnings exist because the player is looking at the ship, not the HUD. So
the ship's own sound carries its condition, all the time, without a warning:

| State | How it sounds |
|---|---|
| **Hull** | at full, solid. Each point lost adds something: a loose panel rattling under thrust, then a thin whistle of a leak, then at zero the breach (§8.1). You can hear how hurt you are |
| **Water** | the coolant and water pumps run smoothly; as the tank drops, the pump note thins; near empty it starts to cavitate, sucking air |
| **Hold** | ore lands in an empty hold with a hollow ring and in a full one with a packed crunch |
| **Speed** | wind and frame strain rise above cruise and bleed off with the boost |
| **Heat** | near a star the hull ticks as it expands and the coolant pumps work harder |
| **Gravity** | the frame creaks and groans in proportion to the pull |

None of these replace the warnings in §5. They are what makes a warning feel like it
was coming.

### 4.3 Progress you can hear

The station is broken and you fix it, one part at a time. **Each part delivered starts
that section's machinery, and the station's sound gets fuller**, until all six run
together (§8.10). The same goes for your ship: a better drive part runs smoother and
stronger, and each almanac verb arrives as a new machine starting for the first time. You
hear the game getting bigger.

### 4.4 Rarity has weight, not pitch

Games usually mark rare loot with a brighter musical sting. That is the arcade. Here
rarity is **physical weight** (§8.6). The rarity tiers (`common`, `uncommon`, `rare`,
`exotic`) are the same ones that set fitting time (`FIT_TIME`):

| Tier | What you hear when it is secured |
|---|---|
| Common | a light crate, clipped in |
| Uncommon | a solid case and a firm latch |
| Rare | a heavy cradle closing, and the ship settling under the weight |
| Exotic | the cradle, and then the part's own faint hum aboard for as long as you carry it |

### 4.5 Every power sounds like itself

The README gives each power a character through its leaderboard names: the Cordon's duty
roster, the Hallow Line's elders, Morrow's trading houses, the pirates' graffiti. Their
ships and comms should match, so you can tell who is near by ear before you see a colour:

| Power | Character | Engines and comms |
|---|---|---|
| **The Cordon** | military, disciplined | tight, well-tuned engines; clean, crisp transponder bursts |
| **The Hallow Line** | old, keeps old ways | older drives with a warm, slightly uneven hum; analogue-sounding comms |
| **Morrow Compact** | commercial, polished | smooth, quiet, efficient engines; polished digital bursts |
| **Unaligned** | civilian, mixed | a mix of everything, nothing matched |
| **No Colours (pirates)** | jury-rigged | rough, misfiring drives; distorted, clipped bursts |

### 4.6 Every kind of hull has a voice

The eight hull categories (`SHIP_CATEGORIES`) set the engine's character; the hull's size
sets its weight and depth:

| Category | Engine character |
|---|---|
| Military | aggressive, tight, fast to respond |
| Explorer | an efficient long-haul hum |
| Commuter | soft and civilian |
| Sport | high-revving and loud |
| Industrial | heavy, grinding |
| Cargo | deep and slow |
| Utility | workmanlike, with tools and pumps audible |
| Courier | light and quick |

Buying a new hull should feel like a new vehicle, not a new number.

### 4.7 Bosses are learned by ear

Each of the five bosses has a signature you hear before you see it, and learn to dread:

| Boss | Signature |
|---|---|
| Warlord | a ragged pirate capital ship and its pack; broadcasts on every channel |
| Admiral | a flagship's deep drone and disciplined wing; its shield's field under load |
| Queen | salvage tractors and the chitter of the bugs she sends |
| Corsair | afterburner dashes ripping past with Doppler |
| Warden | the double launch of its homing missiles, twice |

### 4.8 Warnings teach, then step back

Hospitals found that most alarms are false or not acted on, and that staff stop responding
to them. The fix the research favours is fewer alarms that each mean more (§16.6).
KONDRITE's HUD already does this: the tank warning gets the word WARNING the first two
times (`WARN_LOUD`), and after that only a quiet triangle. **The sound follows the same
rule**: full the first times, quiet once learned, loud again only when it is about to kill
you. The whole ladder is in §5.

### 4.9 Tell the player when something is ready, not just when it is used

The scan takes 12 seconds to recharge, each device has a cooldown, and the Flagship Screen
comes back after 12 seconds. Today you have to look at a bar to know. A small, physical
**ready** sound (a capacitor topping off, a breech closing, a field humming up) lets you
keep flying and act the moment it is back. It is quiet, and it only plays for things you
used.

### 4.10 Contrast: quiet makes loud matter

A game that is loud all the time has no loud. The Long Empty is silent, a death is
silent, the moment after a wormhole is silent, and docking replaces open space with a
room. Those silences are what make the next sound land.

### 4.11 The same place always sounds the same

Space is generated from the seed, so the same chunk always holds the same stars. Ambience
details come from the seed and the position too, so a place you return to sounds as you
remember it. A sector becomes somewhere you know by ear.

### 4.12 Sound keeps the game's honesty rules

Two rules already govern KONDRITE: the news reports the record and never creates an event,
and nothing in the living world is scripted or faked. Sound obeys both. Ambience never
invents a meaningful event (§7.2), and events written only as texture (`chatter(…, false)`)
make no sound unless you are docked and hearing the headline.

---

## 5. Warnings: one ladder

Real aircraft rank every alert on one ladder, and the rules for it are useful here
(§16.6):

- **Warning:** needs immediate awareness and immediate response.
- **Caution:** needs immediate awareness and a response soon.
- **Advisory:** needs awareness and may need a response later.
- Warning and caution each have **one unique master tone**.
- A lower-urgency alert **waits** until a higher one finishes.
- Every warning and caution reaches **at least two senses**: here, sound and the HUD.

KONDRITE gets the same ladder, plus a countdown form for timed danger:

| Level | Sound | Repeats |
|---|---|---|
| **Advisory** | one soft, low tone | once |
| **Caution** | the caution tone: two notes, mid-urgency | once each time it steps, while it matters |
| **Warning** | the master warning: fast, sharp, continuous | until the danger passes |
| **Countdown** | the warning tone, speeding up as time runs out | until it resolves or hits zero |

Every warning in the game, on that ladder:

| Situation | Code | Level | Behaviour |
|---|---|---|---|
| Water or food at half (first two trips) | `lifeWarnings` | Caution | with the word WARNING on the HUD |
| Each further step (35%, 20%, 5%), or any step once learned | `lifeWarnings` | Advisory | with the quiet triangle |
| Water out ("You have minutes, not hours.") | `surveyLifeSupport` | Countdown | over the 75 s of `THIRST_GRACE` |
| Food out | `surveyLifeSupport` | Countdown | over the 120 s of `HUNGER_GRACE` |
| GRAVITY AHEAD | `surveyWarning` | Advisory | |
| HEAVY PULL | `surveyWarning` | Caution | |
| PULL EXCEEDS DRIVE | `surveyWarning` | Warning | |
| CANNOT ESCAPE | `surveyWarning` | Warning | faster beat, as the HUD's |
| Light drive: something ahead (five-second warning) | `L.hit.eta` | Countdown | caution pace above 2 s, warning pace below, as the HUD's colours |
| Hull at zero ("the next one kills you") | `physics.js:339` | Warning | slow, until mended; at a star it turns to a resolving tone while you mend |
| Locked on (sensor feed) | §3.3 | Warning | |
| Missile closing | §3.3 | Countdown | |
| A sentry wakes | `sector-places.js:546` | Caution | |
| A patrol: "that is close enough" | `pilots.js:246` | Advisory | |
| A patrol: "they told you once" | `pilots.js:250` | Warning | with the lock |
| A faction sends a hunter ("sent somebody") | `war.js:324` | Caution | |
| Coming up on a boss's sky | `bosses.js:262` | Advisory | |
| Inside a boss's sky | `bosses.js:271` | Caution | today's silent `alarm` |
| The warlord calls the pack in / the grudge ship returns | `bosses.js:315`, `sector-places.js:1059` | Warning | today's silent `alarm` |
| Near your own armed mine | `surv.mines` | Caution | quickening as you close |
| First time out in a hull that will not come home (`atrisk`) | `OPENING` | Advisory | once |
| Hold full | `sector.js:171` | Advisory | |
| Reset survey armed | Settings | Caution | for its four seconds |

Two rules make it work:

- **Only one warning sounds at a time, the highest.** Two warnings at once are noise.
- **The ship's own state (§4.2) does the early work.** The ladder is for when it matters.

---

## 6. The mix

```
world sound ─► takes ─► distance ─► air absorption ─► occlusion ─► Doppler / delay ─► pan
                                                                               │
                                           sensor feed weighting ◄─────────────┘
                                                                               │
                         echo of the space you are in (open, cave, hull, station) ─► WORLD
your ship ─► takes ─► cockpit reverb ─────────────────────────────────────────────► SHIP
warnings (§5), scanner, radio ────────────────────────────────────────────────────► INSTRUMENTS
beds, details, emitters (§7) ─────────────────────────────────────────────────────► AMBIENCE
pages and menus ──────────────────────────────────────────────────────────────────► INTERFACE
                                         all ─► ducking ─► master ─► compressor ─► limiter
```

### 6.1 Snapshots: the mix follows the situation

A snapshot is a stored balance of the buses that the game moves between as things change
(§16.6). Moves are fades of a second or two, never cuts.

| Snapshot | When | Balance |
|---|---|---|
| **Flight** | the default | ambience present, ship forward, world by distance |
| **Combat** | something hostile is aimed at you | sensor feed active, ambience down, weapons and threats forward |
| **Critical** | hull at zero, or a tank out | world a little duller, ship and warnings forward |
| **Light drive** | on a run | ambience rushing, engine and resonance forward |
| **Silent Running** | cloaked | everything duller and closer, your own ship nearly silent |
| **Docked** | at a station | the station's interior replaces space |
| **Page** | the chart, almanac or a station page is open | the world distant and muffled; the page's hardware forward |
| **Dead** | after death | silence, then the station |

### 6.2 Ducking

When a warning, the scan or a radio burst plays, it makes room for itself. Pure volume
ducking can make a busy mix pump; Baldur's Gate 3's team moved to frequency-based ducking
for that reason (§16.6). So a warning carves out its own band from the world rather than
turning the whole world down. A discovery (§8.10) is the exception: it pulls everything
down for a second, on purpose.

### 6.3 Dials, caps and levels

- **Dials:** WEAPONS, IMPACTS, SHIP, INSTRUMENTS, AMBIENCE and INTERFACE, plus MUSIC when
  §11 is decided. Also a **mono** switch, because pan carries direction.
- **Loops** have one manager that starts, updates and stops them with ramps, and caps them.
- **A cap per kind of sound** stops the least important one first.
- **Levels:** ambience sits well under the foreground (§7.8). The whole game measures near
  −18 LUFS integrated, the figure reported for portable platforms (§16.6).

---

## 7. Ambience

Ambience is the sound of being somewhere. BIOMES.md says regions are **noticed, never
named**: the game never tells you what kind of space you are in, and you learn it by
being there. Sound can do that better than anything else, because you notice a change in
what you hear before you can say what changed.

### 7.1 Four layers

| Layer | What it is | Example: the Rime |
|---|---|---|
| **Bed** | a continuous, quiet loop that is the character of the place | a far-off, wide crackle of ice in every direction |
| **Detail** | short sounds at random times and positions, never inside the bed | an ice body cracking to the left; two floes grinding |
| **Rare** | an occasional larger sound that makes a place memorable | a long, singing crack across the whole field |
| **Emitters** | sounds attached to real objects, faded by distance (§3.1) | the ice bodies you can see, creaking as they turn |

Detail is kept out of the bed because it becomes recognisable as the bed repeats (§16.4).

### 7.2 Ambience never invents an event

- **Allowed:** ordinary, unseen activity that is simply true of a place. Rocks collide in
  a belt, ice cracks in the Rime, industry hums in the Works, a front rumbles with
  distant war.
- **Never:** a sound that means something in the game unless a real object made it. No
  boss roar, distress beacon, nearby gunfire or passing ship unless one is really there.
  If it would make a player turn around, it has to be there when they do.

### 7.3 What drives it

| Input | Where | What it changes |
|---|---|---|
| Region kind | `regionAt(x, y)` (`survey-world.js:265`) | which bed and which details |
| Depth into the region | `regionDepth(x, y)` (`survey-world.js:339`), 0 at a border, 1 at the middle | bed level and how often details come. The same value fades the starfield tint, so sound and sky change together |
| Political band | territory · the front · the frontier · lawless · the deep void (`survey-world.js:422`) | a quieter second layer (§7.5) |
| Nearby objects | stars, black holes, wormholes, stations, worlds, hulks, wrecks, traffic, battles, landmarks | emitters (§7.6) |
| The ship's state | docked, landed, in an atmosphere, cloaked, under EMP, hull at zero, light drive, on a page, dead | how the whole ambience is heard (§7.7) |
| The seed and position | `seeded()`, as the chunks use | which details play and where: the same place always sounds the same (§4.11) |

### 7.4 Every region

The fourteen region kinds in `survey-world.js`. **Level** is the bed relative to ordinary
space.

| Region (key) | Bed | Details | Rare | Level | Recipe (real recordings) |
|---|---|---|---|---|---|
| **Ordinary space** (`normal`) | the faintest wide hiss | very sparse: a distant clank, something far off moving | — | lowest but one | room tone of a very large empty hall |
| **Settled reach** (`reach`) | a gentle far-off hum of traffic and stations | distant engines; a docking clamp somewhere | — | low | distant airport, a harbour at night |
| **The Belt** (`belt`) | slow, heavy grinding of rock on rock, far away | a rockfall; boulders knocking | a big collision that rolls on for seconds | medium | quarry, rockfalls, boulders rolling |
| **Shard field** (`shards`) | a brittle, glassy shimmer | sharp cracks, splinters | a slab shattering | medium | slate and glass breaking, scree |
| **The Rounds** (`rounds`) | a soft rolling rumble | stones rolling and tapping | — | medium-low | a pebble beach, stones rolling |
| **The Violet Cloud** (`cloud`) | a wide, soft wind that closes in like fog | gusts | a long gust that leaves near-silence behind it | medium | wind over open ground, distant surf |
| **The Murk** (`murk`) | static and crackle, denser toward the middle; jams the sensor feed | discharges, tearing | a loud discharge, with a flash on screen | rises with depth | dry electrical crackle, a thunderstorm's static, a dust storm |
| **The Boneyard** (`bones`) | cold wind through metal | a sheet of wreck knocking; a long groan | a large wreck shifting | medium | scrapyard, ship-breaking yard |
| **The Wells** (`maw`) | deep roars beating against each other | the hull creaking under pull | — | medium, mostly sub | infrasonic thunder, a furnace far away |
| **The Rime** (`rime`) | a far-off crackle of ice in every direction | ice cracking, floes grinding | a long singing crack across the field | medium | frozen-lake ice singing and cracking, icebergs calving |
| **The Warrens** (`warrens`) | close cave air; your own engine echoing off the walls | dust trickling; small rock falls | a passage settling with a long rumble | low, loud echo | cave and mine tunnels, dust |
| **The Lanes** (`lanes`) | steady traffic noise | engines passing with Doppler; beacons | a convoy passing | medium | distant motorway, aircraft overhead |
| **The Works** (`city`), the rare urban region (1.8%) | a whole world's industry, swelling as you approach | machinery, hammering, cranes | a huge machine starting | highest | steelworks, shipyard, container port, a city from a rooftop |
| **The Long Empty** (`open`) | **nothing** | **nothing** | **nothing** | **silent** | — |

**The Long Empty is the one place where the design is taking sound away.** BIOMES.md asks
for minutes in which the player wonders whether the generator has broken. There is no bed
and no detail, and the ship's own idle drops a little. When the single pixel appears, the
first sound in minutes is a real object, and it means something.

### 7.5 The political layer

| Band | What it adds |
|---|---|
| Territory | nothing; ordinary held space |
| The front | a far-off war: booms and gunfire too distant to place (allowed by §7.2: a front is at war) |
| The frontier | a little less traffic than the region alone |
| Lawless | rougher, scattered engines; no beacons |
| The deep void | the region's bed thinned toward nothing |

### 7.6 Emitters: the things in the world

Loops attached to real objects, faded by distance and muffled behind solid things. The
nearest eight play at most.

| Object | What it sounds like | Recipe |
|---|---|---|
| **A star** | the loudest thing in the sector: a vast roar like a furnace far off, rising as you close | blast furnace, gas flare stack, forest fire |
| **A binary pair** | two roars beating against each other | two furnaces |
| **A black hole** | a deep rumble felt more than heard, falling in pitch as you close | infrasonic thunder, earthquake recordings |
| **A wormhole** | a low, slowly turning rush, like a giant intake | wind tunnel, turbine intake |
| **A station** | machinery and traffic; each owner's stations sound like their power (§4.5); yours gets fuller with every part (§4.3) | container port, factory, ventilation plant |
| **An inhabited world** | traffic in its sky; its weather once you are in its air | distant town, wind, rain |
| **A world with air** (`pl.air`) | wind at its edge | wind |
| **A cache (hulk) or a wreck** | slow metal creaks as it turns | ship-hull creaks |
| **Ships** | engines by power and hull (§4.5, §4.6), with Doppler | per hull |
| **A battle** | the fight itself, distant | §8.2 |
| **The Leviathan** | a dead giant: deep groans, and old machinery still turning inside | tanker interior, grain silo |
| **The Vault** | sealed: a still, held hum from whatever keeps it locked | bank vault, bunker |
| **NODE 01** | a machine room, structured and inhuman | server room |
| **LAST TRANSMISSION** | **the one landmark heard before it is seen**: its beacon carries far and clears as you close | lighthouse fog signal, beacon |
| **Asteroids in view** | their own creaks and knocks, by material | as the region |

### 7.7 How the ship's state changes what you hear

The snapshots in §6.1 carry most of this:

| State | Ambience |
|---|---|
| Docked | the station's interior, heard through the docking collar |
| Landed / in an atmosphere | the world's air: wind, buffeting, weather |
| Silent Running | duller and closer; your own ship nearly silent |
| EMP | the sensor feed drops out; the ambience is physics and stays |
| Hull at zero | the breach sits on top; the ambience a little duller |
| Light drive | beds cross-fade quickly as regions rush past, under a rush of wind |
| A full-screen page | the world distant and muffled, because it still exists |
| Paused | everything fades out over half a second, and back in on resume |
| Dead | silence, then the station on respawn |

### 7.8 Transitions, repetition and budget

- **Borders blend.** At a border `regionDepth` is near 0 on both sides, so both beds are
  quiet and the change happens through a lull, never at a line.
- **No audible loops.** Beds are 60–90 s, start at random points and hold no recognisable
  detail. Details have random intervals with a minimum gap and never repeat back to back.
- **Subtle.** The bed sits roughly 15–20 dB under the foreground. The Works and the Murk
  are the loud exceptions, on purpose.
- **Budget.** One bed and one political layer, plus the next region's bed while crossing;
  up to eight emitters and three details at once. Beds load when a region is near.

### 7.9 Outside Survey

- **Station interiors** (the shop, hangar, cabinet room): their own room tone behind the
  pages, fuller as your station is repaired.
- **The simulators:** the cabinet room, which you hear the arcade sound through (§8.15).
- **Menus and the front page:** none.

---

## 8. Every event, and what it sounds like

Every row is something the game already does. **Today** is what plays now; — means
silence. **P** is priority: P0 broken, P1 core, P2 depth, P3 polish. Recipes name real
recordings to start from; the ear decides in the end. Warnings are in §5 and are not
repeated here unless a sound beyond the warning tone is needed.

### 8.1 Your ship

The drive is a fusion torch: plasma through a magnetic nozzle, fed by pumps, with the
whole frame carrying it. Its character comes from the hull's category and size (§4.6).

| Event | Code | Today | What it should be | Recipe | P |
|---|---|---|---|---|---|
| Thrust held | ship update | — | **engine loop**: nozzle roar, turbopump whine, magnetic hum; level and brightness follow throttle; a tail on release | NASA launch pad microphones, jet turbine run-ups, a transformer, a sub | P1 |
| Engine start / stop | first thrust after rest | — | ignition thump, pumps spinning up; spin-down and valves closing | turbine starter, solenoid, pump winding down | P2 |
| Reverse thrust | ship update | — | forward nozzles: thinner, more hiss | the engine high-passed, compressed air | P2 |
| Turning | ship update | — | **attitude jets**: valve clicks and short pops of gas | solenoid valves, air-brake blow-offs | P2 |
| Above cruise speed (slingshot, burner) | `me.boost` | — | wind and frame strain, bleeding off with the boost | the engine pitched up, wind at speed | P2 |
| Idle | always | — | never silent: fans, a coolant pump, the odd relay | HVAC fans, a car's cooling fan, pumps, relays | P1 |
| Hull damage state | `ship.hull` | — | §4.2: a loose rattle, then a leak's whistle, rising as hull falls | loose sheet metal, an air leak | P1 |
| Hull hit | `physics.js:321–340` | `hit` | an impact by **what** hit you and **how hard**: attack, plate ring, sub, panned to where it struck | steel plate, car door, sledgehammer on sheet metal | P1 |
| Hull reaches zero | `physics.js:339` | `hit` | a crack through the frame, then the **breach loop** (venting air, creaking) under the warning (§5) until you mend | metal tearing, an air-line leak | P1 |
| Scrape, no damage | collision | — | metal on rock or metal at contact speed | metal dragged on stone and concrete | P2 |
| Hard contact ("space turned out to be solid") | collision | `hit` | a scrape into a heavy clank | car-crash foley, a heavy chain dropped | P2 |
| Death (Survey) | `survival.js:520` | `lose` | the ship going up around you, then **total silence** before the death page | a close explosion, then nothing | P1 |
| Respawn ("Back at the station, in the SKIFF") | `survival.js:560` | — | systems starting one by one inside the station | the idle's sources starting in turn | P1 |
| A part finished fitting improves the ship | `applyRefit` | — | the engine's character changes with the drive parts: smoother, stronger (§4.3) | — | P2 |

### 8.2 Weapons

Every gun has a **report** heard out there and, when it is yours, a **mechanism** heard on
board.

| Weapon | Code | Today | What it should be | Recipe | P |
|---|---|---|---|---|---|
| Cannon | `physics.js:610` | `laser.wav` | a pulsed beam ionising its path: an electrical snap, a twang along the bolt, a recharge whine; cuts its own tail | high-voltage arc snaps, a struck tensioned cable, a camera flash recharging | P1 |
| Industrial beam | `physics.js:610` | `beam.wav` | a hard buzz while it holds; frying and spitting where it bites rock | arc welder, plasma cutter, Tesla coil | P1 |
| **Claw** (the utility hulls' tool instead of a gun; Ric: "a claw that comes out and crushes the asteroids") | `swingClaw`, `physics.js:505` | `rock` on a bite, `shot` on a miss | hydraulic jaws: a pump's whine, the ram driving out, then rock **crushed** in the jaws, or a ship's hull buckling, since it bites ships too. A miss is the jaws snapping shut on nothing. Timed to its 0.22 s swing (§9) | hydraulic press, excavator and demolition shears, a car crusher, rock crushed under load | P1 |
| Scatter gun | `physics.js:674` | `scatter.wav` | three bolts at once, slightly staggered | three arc snaps over a shotgun body | P1 |
| Seeker rack | `physics.js:674` | `seeker.wav` | a launch-rail clank and a small motor lighting; out there a missile's hiss with Doppler | missile and model-rocket launches, a blowtorch | P1 |
| Burst Charge | `physics.js:674` | `seeker` | a heavier, lobbed launch thump | mortar, grenade launcher | P2 |
| Burst Charge goes off | `physics.js:731` | `boom` | an explosion, delayed with distance | real explosions, a sub, debris | P1 |
| Rail lance | `physics.js:674` | `lance.wav` | a capacitor charge whine, a huge thump through the frame, the slug's hypersonic crack, the rails ringing | defibrillator charge, a big gun's report, a supersonic crack, a struck steel beam | P1 |
| War Fan / Warden's Swarm | boss parts | scatter / seeker | foreign hardware: rougher rails, a different motor | your recipes from cruder machines | P2 |
| Another ship or sentry firing | many | the same files | the same voices through distance, by power (§4.5), and the sensor feed | — | P1 |
| A round passing close | bullet update | — | a whizz with Doppler; the lance also cracks | race-car pass-bys, engine filtered out; a bullet crack | P1 |
| A round hits rock | `update.js:339, 353` | `tink` | the strike at the rock's distance, by material | stone chiselling, ice cracking, struck steel | P1 |
| A round runs out | `update.js:365` | `fizz` | nothing | — | — |

### 8.3 Devices, refusals and readiness

| Event | Today | What it should be | Recipe | P |
|---|---|---|---|---|
| Decoy | `start` | a pneumatic launch, a hatch cycling, then the decoy's emitter faking your engine as it drifts off | paintball launcher, hatch, your engine thinned | P1 |
| Decoy runs out | `fizz` | its emitter dying | a valve amp switching off | P3 |
| Mine laid | `shot` | a magazine clunk, a release latch, an arming relay at 1.6 s | latch, ammo can, relay | P2 |
| A mine goes off | `boom` | an explosion (§8.2) | — | P1 |
| The oldest mine fizzles (over ten) | `fizz` | its electronics dying | valve amp off | P3 |
| Cargo eject | `rock` | bay doors, a pressure thump, cargo scraping out | hydraulic doors, crates on a ramp | P1 |
| Emergency jump | `warp` | a rising overload, a structural bang, then arrival in near silence | a transformer failing, a big arc | P1 |
| Grapple | `thrust` | harpoon launch, cable paying out, a hard catch, winch strain on the drawn line | speargun, winch, steel cable under load | P1 |
| Silent Running on | `start` | the ship powering down system by system until it is nearly silent | the idle's sources stopping in turn | P1 |
| Silent Running ends ("Back on somebody's screen") | — | systems coming back up together | the same, restarting | P1 |
| Silent Running broken by firing ("You fired. They can see you.") | — | everything slammed back on at once, under the shot | — | P1 |
| EMP | `hit` | a charge whine, a deep electrical *whump*, then your own systems dying and rebooting after `EMP_STUN`; every stunned machine out there falls silent too | defibrillator charge, a transformer blowing, a power cut, a computer booting | P1 |
| Corsair Burner | `shot` | an afterburner lighting into the boost | jet afterburner, dragster launch | P2 |
| Brood Bay | `shot` | three hatches in sequence and a chittering release | hatches, slowed insect wingbeats | P2 |
| Flagship Screen takes a hit | `hit` | a field under load: deep thrum and overload crackle, **not** a hull impact | transformer hum, crackle, a large bell's hum | P1 |
| **Ready:** scan recharged, a device's cooldown over, the Screen back up | cooldowns | §4.9: a quiet, physical ready sound per system (a capacitor topping off, a breech closing, a field humming up) | relays, a breech, a hum | P2 |
| **Refused:** "Nothing to hook", "The hold is already empty", "still fitting", pressed on cooldown | `sector-places.js:257, 263` | the device's dry click, nothing behind it | a dead trigger | P2 |

### 8.4 The Survey instruments

| Event | Code | Today | What it should be | Recipe | P |
|---|---|---|---|---|---|
| **Scan pulse** | `survey-setup.js:661` | `shot` | an active sensor firing: a transmitter thump and an outgoing ping | active sonar, radar transmitter | P1 |
| **Scan returns** | `surveyScan` | — | one return per contact, **delayed by its distance** and panned by bearing; metal rings, rock is soft, a wormhole bends, a sentry pulses. Closest first, at most about 8 | the ping's echo, filtered by material | P1 |
| Scan finds nothing ("Nothing within …") | `survey-setup.js:782` | — | the ping, then an empty receiver's hiss | receiver hiss | P2 |
| Scan finds a boss's sky | `survey-setup.js:824` | — | among the returns, the boss's signature return (§4.7) | — | P2 |
| Scan charts a region's edges | `survey-setup.js:829` | — | a long, faint sweep return | — | P3 |
| Scan blocked by your EMP | `survey-setup.js:654` | — | a dead transmitter's click | relay | P3 |
| Scan in the Murk | `scanRange()` | — | the ping smeared, returns broken up | the ping through crackle | P2 |
| Tractor beam | tractor | — | an electromagnetic hum while something is in the beam, then a clunk at the intake | maglev hum, magnet on steel | P2 |
| Melter running / out of ice | `factions.js:877, 897` | — | hissing, popping boil and a pump; it runs dry with a gurgle | kettle, ice in a hot pan | P3 |
| A fit begins / completes | `factions.js:651, 969` | `start` / `win` | torque tools, a final lock, the part spinning up | impact wrench, latch, motor | P2 |
| A fit abandoned / a part removed | `factions.js:942` | — | the lock released, the part unbolted | wrench, latch | P3 |

### 8.5 Life support

Water lasts twenty minutes and food forty-five. Empty starts a clock, not a death.

| Event | Code | Today | What it should be | P |
|---|---|---|---|---|
| Tanks draining | always | — | the pump note thins as water drops, and cavitates near empty (§4.2) | P2 |
| Half, and each step after | `lifeWarnings` | `hit` (first two) | the ladder (§5): caution with the WARNING word, then advisories | P1 |
| Water out / food out | `survival.js:199, 209` | `lose` | the countdown (§5) over the grace period, and the pump running dry | P1 |
| Died of thirst / starved | `surveyDie` | `lose` | the countdown reaching zero, systems failing, then silence | P2 |
| Water bought / food bought | `survival.js:277` | `start` | water pumped into the tank through a hose coupling; crates stowed | P2 |
| "They have no … to sell" | `survival.js:263` | `hit` | the terminal's refusal (§8.9) | P2 |
| Skimming an atmosphere for water | `surv.overAir` | — | the scoop roaring, buffeting rising with depth, and the tank filling | P1 |
| A friend hands water across ("they saw your tank") | `sector-places.js:1022` | `win` | their hose coupling and pumping | P2 |
| You hand water across to a ship in need | `bosses.js:784` | `win` | your hose coupling and pumping out | P2 |
| "Not with what is in your own tank" | `bosses.js:768` | — | the pump refusing: a valve that won't open | P3 |

### 8.6 Pickups and salvage

Everything that goes into the ship. Rarity is weight, not pitch (§4.4), and each material
has its own sound landing in the hold.

| Event | Code | Today | What it should be | P |
|---|---|---|---|---|
| A rock breaks | `physics.js:167` and others | `rock` | the rock splitting at its distance, by material (rock, ice, shard, round) | P1 |
| A material mote into the hold | `sector.js:730` | `pickup` (25%) | the intake, then the material landing: **ice** a cold crunch, **iron** gravel, **alloy** a clank of bars, **electronics** a light rattle of parts, **iridium** a dense, heavy thud, **reactor core** a sealed canister seated, humming. Hollow when the hold is empty, packed when full | P1 |
| Shooting a cache (hulk) open | `bosses.js:1133` (`hitHulk`) | `hit` / `boom` | a heavy hull taking hits, then breaking apart | P1 |
| A wreck's salvage | `sector-places.js` | — | debris pulled in by the tractor | P2 |
| A cache opened / the deep hold | `sector-places.js:875` | `win` | a sealed container venting, locks releasing; the deep hold bigger and older | P1 |
| A guarded cache unsealed | `sector-places.js` | — | its lock releasing as the guard goes | P2 |
| A part in a cache, no room in the hold | `sector-places.js:848` | — | the cradle refusing: a latch that won't close | P2 |
| **A spare part picked up** | `survey-bearings.js:517` | `win` | lifted and secured, by rarity tier (§4.4) | P1 |
| **One of the six station parts** | `survey-bearings.js:517` | `win` | the heaviest secure in the game, then the part's own hum aboard until it is delivered | P1 |
| **Your own hull, where you died in it** | `survey-bearings.js:472` | `win` | its systems answering yours, then docking clamps: it is going home | P1 |
| Parts you dropped when you died, picked back up | `survey-bearings.js` | `win` | as a spare, by rarity | P2 |
| Hold full ("LADEN") | `sector.js:171` | — | the intake jamming, and the advisory (§5) | P2 |
| A scavenger gets there first / a pirate takes your part | `pilots.js:1010, 1031` | — | their tractor's hum, distant, and your hold's alarm if it was yours | P2 |
| Pirates turn to your ejected cargo | `sector-places.js:321, 340` | — | their tractors on the spilled cargo | P2 |

### 8.7 Gravity and the places that kill

| Event | Code | Today | What it should be | P |
|---|---|---|---|---|
| Inside a well's pull | hazards | — | **hull stress**: creaks, groans and pings, deeper as the pull grows | P1 |
| Near a star | hazards | — | its roar (§7.6), the hull ticking with heat, coolant pumps working harder | P1 |
| A star repairing you | star heal | — | servos and welding, one step per hull point | P2 |
| Near a black hole | hazards | — | its rumble (§7.6) and tidal stress on the hull | P1 |
| A slingshot letting go | telemetry | — | the stress releasing at once, then the engine at speed | P2 |
| Burned in a star | death | `lose` | the roar swallowing everything, then silence | P2 |
| Swallowed by a black hole | death | `lose` | the rumble stretching lower until it is below hearing | P2 |
| A ship swallowed by a star or well | `traffic.js:31` | — | its engine straining, cut off | P2 |
| A drifting rock smashes into a world | `survey-streaming.js:701` | `rock` | a heavy impact on the surface and the rock shattering, by distance | P2 |
| The Battle Royale wall | BR | — | a moving energy wall heard before you reach it; a hard bounce | P2 |

### 8.8 Travel

| Event | Code | Today | What it should be | P |
|---|---|---|---|---|
| Into a wormhole | `sector-places.js:192` | `warp` | a structural shriek, a rushing pull, every system surging | P1 |
| Out the far side | arrival | — | the rush releasing, systems re-latching, a held quiet moment | P2 |
| A tuned gate ("somewhere you have not been") | `sector-places.js:194` | `warp` | the same, with a cleaner, steadier pull | P3 |
| Light drive on ("hold your heading") | `survival.js:51` | `win` | a heavy spool climbing into a resonance the frame carries for the run | P1 |
| Light drive running | `surv.lightRun` | — | the resonance, and beds rushing past (§7.7) | P1 |
| Light drive: something ahead | `L.hit` | — | the countdown (§5) | P1 |
| Light drive off / cut | `survival.js:39, 118`, `physics.js:330` | — | spool-down; a cut is an overload bang and a falling whine | P1 |
| "Too deep in a well to run" | `survival.js:46` | `hit` | the drive trying and failing | P2 |
| Your station's mouth: a jump ("Light drive — arrived.") | `factions.js:56` | `warp` + `win` | departure as the wormhole; arrival as systems re-latching, no jingle | P1 |
| **The coil fires** (pulled off its gate: "THE COIL FIRED") | `survey-bearings.js:417` | `lose` | the coil discharging in your hold: a violent electrical tear, the sector folding, then arrival somewhere you did not choose, in silence | P1 |
| Emergency jump | §8.3 | | | |

### 8.9 Stations, money and pages

| Event | Today | What it should be | P |
|---|---|---|---|
| Docking | — | proximity alarm, clamps driving home, a seal, a pressure hiss, then the station around you | P1 |
| Undocking | — | the seal breaking, clamps releasing, space again | P1 |
| Landing on an inhabited world | — | descent through air, landing struts, the engine winding down | P2 |
| News headline on docking | text | a data burst before the line | P3 |
| Selling cargo | `win` | the hold unloading on conveyors, then a terminal confirming (a print head, a stamp) | P1 |
| Buying a part | `start` / `win` | a crate brought in and stowed, by rarity (§4.4) | P1 |
| **Refused** (can't afford, not stocked, no slot, already fitted, "needs a station", "No power to the counter") | `hit` | the terminal's dry refusal: a key that does nothing. Never a hull sound | P1 |
| Hull repaired at a dock ("Hull made good") | `win` | the crew's tools on your hull | P2 |
| Ship bought / swapped | `win` | cranes, clamps, the new hull's engine starting in its own voice (§4.6) | P2 |
| Light drive bought and fitted | `win` | heavy installation, then the drive's first idle | P2 |
| Workbench build | `win` | grinder, welder, torque wrench in sequence | P2 |
| Pages open / close: chart, almanac, inventory, cargo, workbench, refit, station, hangar, record, sector, missions, lore cards, landed, wormhole, death, the cabinet room and its boards | — | a screen waking, a soft relay; each page its own hardware. The death page opens into silence | P2 |
| Moving through a page | — | a detented switch, quiet | P2 |
| An almanac entry opened full size, paging through | — | a soft page turn | P3 |
| Choosing something on the chart to watch ("Watching …", `survey-state.js:594`) | `start` | a target lock on the chart's hardware: a firm detent; unwatching a softer one | P3 |
| A chart pin dropped / lifted, pin kind cycled (`onPin`) | — | a hard key press; lifting a softer one; a rotary click for the kind | P3 |
| Chart zoom step / recentre | — | a rotary detent | P3 |
| Save pressed | — | a short drive spin and a click: "say out loud that it worked" | P2 |
| Two saves disagree | — | the caution tone, once | P3 |
| Reset survey, second press | — | everything powering off, then silence | P2 |
| Exit game, first press ("SURE? LEAVE GAME", `input.js:72`) | `hit` | the caution tone, once, for its three seconds | P3 |
| Front page, Settings, account door | — | one tactile click to move, one to choose | P2 |
| Settings volume step | preview | keep: plays a sound from the channel changed | — |

### 8.10 Discovery and progress

Everything else goes quiet for a moment, and the ship records what it found. No tunes.

| Event | Code | Today | What it should be | P |
|---|---|---|---|---|
| An almanac entry | `surveyFind` | `win` | the world ducks for a second; the ship's recorder takes it down; a landmark holds longer | P1 |
| A secret entry (NODE 01, THE LEVIATHAN) | `surveyFind` | `win` | the instruments failing to identify it | P2 |
| An almanac verb unlocked (tractor, warp tuning, running dark) | 6 / 12 / 18 entries | — | the new system starting for the first time (§4.3) | P1 |
| A part delivered: a section comes online | `survey-bearings.js:563` | `win` | **that section's machinery starting up**, heard around you; the station's ambience fuller from then on (§4.3) | P1 |
| THE STATION IS WHOLE | `survey-bearings.js:576` | `win` | every section running together, and a long, held moment of it | P1 |
| The objective changes | `surveyObjectiveNote` | — | a soft advisory tone, the same as every notice | P3 |
| A teaching beat (WATER LOW, THAT IS WORTH MONEY, YOU CAN AFFORD A PART, …) | `surveyOpening` | — | the same soft advisory; THIS HULL DOES NOT COME HOME is the advisory in §5 | P3 |
| The objective banner retires | `bannerWanted` | — | nothing | — |
| A pale dot in the Long Empty | — | — | nothing; the silence before it is the sound | — |

### 8.11 The living world and traffic

Heard through §3.1 when near; nothing for texture (`chatter(…, false)`).

| Event | Code | Today | What it should be | P |
|---|---|---|---|---|
| Ships passing | traffic | — | engines by power and hull, with Doppler (§4.5, §4.6) | P1 |
| A patrol's warnings | `pilots.js:246, 250` | — | a comms burst in that power's sound, then the ladder (§5) | P1 |
| An escort breaks off for a pirate | `pilots.js:217` | — | its engine opening up, a burst | P2 |
| A distress call | `traffic.js:89` | — | an automatic beacon, weak and repeating, from the hauler's direction | P1 |
| A hauler adrift, out of water | `traffic.js:60` | — | its systems failing: an engine coughing, venting | P2 |
| "That hauler is not answering any more" | `traffic.js:64` | — | its beacon stopping mid-cycle | P2 |
| A hauler saved, or under way again | `traffic.js:123, 128` | `win` | its engine relighting | P2 |
| A faction sends a hunter | `war.js:324` | — | the caution (§5), then its engine closing from behind | P1 |
| Killing an unarmed ship ("They were not armed.") | `pilots.js:1167` | — | nothing extra: the kill, then silence where its engine was. The quiet is the comment | P3 |
| Ships that know you ("they know you") | `sector-places.js:1014` | — | a friendly comms burst in their power's sound | P3 |
| Territory you charted has changed hands | `survey-bearings.js:710` | — | a soft advisory; the region's political layer now sounds like its new owner (§7.5) | P3 |
| A battle in view | `war.js:207` | — | the fight itself, with booms arriving late | P1 |
| A battle ends / a memorial | `war.js:261, 263` | — | the noise thinning to nothing | P3 |
| Bounty paid | `living.js:1077` | `win` | the terminal's transfer | P3 |
| War, ceasefire, a fallen leader, a law, secession | `living.js` | — | silent unless docked; then a data burst before the headline (§4.12) | — |

### 8.12 Bosses and sentries

| Event | Code | Today | What it should be | P |
|---|---|---|---|---|
| Coming up on a boss's sky | `bosses.js:262` | — | its signature heard before it is seen (§4.7), and the advisory | P1 |
| **Inside a boss's sky** | `bosses.js:271` | **`alarm`: silent (bug)** | the caution (§5) and the boss's sound rising | **P0** |
| **The warlord calls the pack in** | `bosses.js:315` | **`alarm`: silent** | the warning, a burst on every channel, three engines appearing far off | **P0** |
| **The grudge ship returns** | `sector-places.js:1059` | **`alarm`: silent** | the warning, and its engine coming up behind you | **P0** |
| Leaving the sky | `bosses.js:274` | — | the boss's noise falling away behind | P2 |
| A boss hurt (50%, 25%) | hits | `hit` | heavier strikes; its systems failing audibly | P2 |
| The Admiral's screen / Corsair dash / Warden's missiles | boss powers | — | per §4.7 | P2 |
| The queen takes a ship | `bosses.js:639` | `boom` | her tractors seizing it, its engine dying | P2 |
| A boss destroyed | `bosses.js:712, 742` | `explode` + `win` | staggered explosions, the last delayed by distance, then debris; its signature gone | P1 |
| A boss destroyed by someone else | `bosses.js:724` | — | the same death, distant | P2 |
| A sentry wakes | `sector-places.js:546` | — | a servo driving up to target, and the caution | P1 |
| A sentry fires | `sector-places.js:616` | `laser` | sentry hardware, through the sensor feed | P1 |
| A sentry destroyed | `bosses.js:1141` | `hit` / `boom` | a small hard explosion, servos dying | P1 |
| A sentry loses you | — | — | the servo settling | P2 |
| Rammed by the warlord | `traffic.js:181` | `hit` | the heaviest collision in the game | P2 |

### 8.13 Inside places

| Place | What changes | P |
|---|---|---|
| The Warrens | echo on everything you do; scrapes on the walls; the proximity of rock | P2 |
| The Leviathan | her hollow reverb; her plates groaning where you touch; her sentries waking; the three caches down her spine, the deepest the oldest-sounding | P2 |
| The Vault | a sealed room: still, pressurised, the lock's hum | P2 |

### 8.14 Multiplayer and the front page

| Event | Today | What it should be | P |
|---|---|---|---|
| The front page's attract loop | — | silent | — |
| A player joins / leaves; connected to the host (`lobby.js`) | — | a comms carrier on and off | P3 |
| Connection lost | — | dead air and the caution tone | P3 |

### 8.15 The simulators

The cabinets sound like arcade games, through a small cabinet speaker, in a station room
(§7.9). Today's oscillator voices live here.

| Event | Today | What it should be | P |
|---|---|---|---|
| Walking up to a cabinet, booting it (`machines.js:176`) | `start` | a power switch, a CRT's degauss thunk, a rising whine | P2 |
| A cabinet or the multiplayer door refusing because the game cannot save (`machines.js:161–163, 452`) | `hit` | the cabinet's dead power switch | P3 |
| A match starting (`world.js:683`, `multiplayer.js:435`) | `start` | the cabinet's start jingle: it stays an arcade sound | — |
| Everything during a match: Survival, Battle Royale, the Campaign's orders, salvage, aces, hangar bays, shield generators, the flagship, wingmen | the current palette | the current palette, through the cabinet speaker | P2 |
| The mothership finale | `boom` (5% per frame) | slowed with the picture | P2 |
| A score on the board | — | the cabinet's own jingle | P3 |
| Back to the dock | — | the room, then the station | P3 |

---

## 9. Animations that need their sound timed to them

- **The EMP ring** (`EMP_RING_TIME`, 0.55 s): the whump as it leaves, each stunned thing
  falling silent as the ring passes it.
- **The grapple line** (`surv.grappleTo`, 0.45 s): launch, catch and winch on the drawn line.
- **The claw** (`ship.clawT`, 0.22 s): the ram driving out, the jaws closing at the end of
  the drawn swing, the crush on the frame the jaws meet something.
- **The scan ring** (`surveyHUD.ping`): each return as the ring reaches its echo.
- **Explosions:** the flash on its frame, the boom when the distance delay says, debris after.
- **Shake** (`addShake`): any shake of 5 or more needs sub-bass, or it reads as a camera bug.
- **The warning band and the critical edge** (`drawWarnBand`, `drawCriticalEdge`): the
  warning tone's beat matches their pulse, 160 ms or 280 ms for gravity, 300 ms for the
  hull, 520 ms while mending.
- **The light drive's countdown:** its beat matches the HUD's (130 ms under 2 s, 260 ms above).
- **The tank warning's slide** (the word WARNING, then the triangle): the caution plays as
  the word appears.
- **The Murk's dither:** the static's density follows the same depth as the shader.
- **The engine flame:** the loop's level follows the drawn flame exactly.
- **Docking clamps and the hangar:** timed to their drawn motion.

---

## 10. Where the sounds come from

### 10.1 Free public recordings first

Every sound starts from real recordings that are free to use and credited. Nothing comes
from an AI generator. The weather room's rule for its sky footage applies: real material,
credited.

| Source | Licence | From a cloud session (tested 2026-11-13) | Good for |
|---|---|---|---|
| **NASA** (`images-api.nasa.gov`) | public domain; credit NASA | **works** | the drive, ignition, roars. The Artemis II launch from Pad Camera Site 6 is 14 min 44 s at 192 kHz, 32-bit, credited NASA/Lorne Mathre. Pad and camera-site microphones only: commentary tracks carry speech |
| **Freesound** (CC0 filter) | CC0 per file | **refused**: Freesound denies this cloud machine before the key is checked | nearly everything else. Downloads have to be done from Ric's computer, signed in |
| **Wikimedia Commons** | PD / CC0 / CC BY per file | **rate-limited** on the shared address | ambience and field recordings; later, or from Ric's computer |
| **Recorded by Ric** | his own | — | impacts and machinery: metal, tools, doors, the car, a garage |

- **Every file has a credit line** in `sounds/SOURCES.md`.
- **Originals are never committed.** They live in a git-ignored `_sound-originals/`, the
  way photographs use `_photo-originals/`. Only trimmed, finished sounds are committed.
- **Size.** Short sounds in the repository, long beds on R2 fetched when their region is
  near; the committed set under about 25 MB.
- **Fallbacks stay real.** A sound that fails to load falls back to the nearest real sound
  already loaded, and a bed to silence. Never an arcade tone. The core set is committed,
  so the game still sounds right opened straight off disk.
- **Format:** compressed, decoded once; checked in Safari before choosing.

### 10.2 Making our own: an option, not a requirement

Paul Weir, No Man's Sky's audio director: procedural audio only makes sense when it solves
a problem conventional sound design would struggle with (§16.5). If one comes up, the
likely candidates are endless impact variations by modal synthesis (shipped in
*Crackdown 2*), and beds that never loop, such as wind and crackle. The limit is real: in
a listening test, the best synthesised thunder was still told apart from a recording.
Recordings stay the base.

---

## 11. Music

**Deferred.** Ric wants some and has not decided what kind. When it comes back:

- **Music in the world**, such as something playing in a station while docked, fits the
  realism with no argument.
- **A score over Survey** competes with the Long Empty and with the regions doing their
  job by ear. If there is one, layering (FTL adds a second layer in a fight, §16.7) lets it
  thin to nothing where it should.
- It gets its own dial and its own place in the snapshots (§6.1).

## 12. Accessibility

- The dials and a mono switch (§6.3; XAG 105).
- Every warning reaches two senses, as the cockpit rule requires (§5); no cue may be
  sound-only (XAG 103). The game already draws all of them.
- Reduced motion turns off the Murk's crackle, as it turns off the grain.
- Loops and alarms stop when the page is paused or hidden.

## 13. Testing

`test/sounds.js` was tuned for synthesised voices: no more than 20% of energy in 2–5 kHz,
no more than 15% above 5 kHz, and 0.2 s for anything that repeats. Real recordings break
those for good reasons. Keep the intent, no ear fatigue, and measure it differently:

1. **Every sound the game asks for exists.** Collect every literal `gameSound("…")` and
   `playSfx("…")`, and fail on any the engine doesn't know. This catches §2.1.
2. **Every message has a decision.** Every `chatter`, `notify` and `banner` call site
   appears in Appendix A, or the test fails. A new message without a sound decision is a
   gap in this file.
3. **No oscillators outside the cabinets and the warning tones.**
4. **One warning at a time:** when two warnings are due, only the higher sounds (§5).
5. **Fatigue by loudness and repetition, not spectrum:** a repeated sound stays under a
   short-term loudness ceiling, rotates through at least three takes, and cuts its tail.
6. **Distance does what it says:** further is always quieter and duller; behind a solid
   object is duller still.
7. **Ambience:** the Long Empty renders silence; no bed repeats a detail within its length.
8. **Loops** start and stop without clicks, and their number is capped.
9. **A ten-minute scripted Survey session** (thrust, mining, a scan every 12 s, a fight, a
   dock, two regions) measures near −18 LUFS integrated.
10. **Every file credited** in `sounds/SOURCES.md`.
11. **The listening booth** gets a scene per region, per loop, per warning level, and each
    weapon at three distances. Someone still has to listen.

## 14. Order of work

1. **P0:** give `alarm` a real sound; add tests 1 and 2 (§13).
2. **The foundation:** loading real files, take rotation, the cockpit reverb, the buses
   and snapshots (§6), a loop manager, and distance (§3.1). Nothing sounds different yet.
3. **The first recordings:** NASA launches from here; a first CC0 set from Freesound on
   Ric's computer. Start `sounds/SOURCES.md`.
4. **The warning ladder** (§5). It is small, it covers every danger in the game at once,
   and it fixes the silent alarms properly.
5. **Your ship:** idle, engine by hull category, attitude jets, impacts by material, the
   damage state, breach, death.
6. **Weapons:** report and mechanism, whizz and crack; the sensor feed.
7. **Pickups and salvage** (§8.6): materials, rarity weight, station parts.
8. **Ambience** (§7): beds and details per region, then emitters, then states.
9. **Instruments and travel:** the scan, life support, the light drive, wormholes, the coil.
10. **Docking, and the station coming alive.**
11. **Devices,** Silent Running and the EMP first; readiness and refusals.
12. **Powers, hulls and bosses** by ear (§4.5–4.7).
13. **The pages, the cabinets and the finale.**
14. **Retire** `make-lasers.py`, move the oscillator voices into the cabinets, and update
    the README's sound section to say what is then true.

## 15. Open questions

1. **Getting Freesound files.** Freesound refuses this cloud machine. Will Ric download a
   first batch on his computer (a list can be prepared), or record some himself?
2. **Music**, when it comes back (§11).

---

## 16. Research

What each choice rests on. Where a source is press coverage of a talk rather than the talk
itself, it says so.

### 16.1 Hyperreal means "more real than real"

A microphone at a real punch records a dull pat; Foley is exaggerated, and natural only in
context. [arXiv 2605.31082](https://arxiv.org/html/2605.31082) ·
[Langkjær (CORE)](https://core.ac.uk/download/233629168.pdf) ·
[Designing Sound](https://designingsound.org/2016/02/28/sunday-sound-thought-9-constructing-which-reality/)

### 16.2 Imaginary machines from real sounds

- **Star Wars:** the blaster is a radio tower's guy-wire struck with a wrench or hammer
  (accounts differ); the TIE fighter an altered elephant bellow.
  [No Film School](https://nofilmschool.com/star-wars-sound-design) ·
  [Film Sound](https://www.filmsound.org/starwars/) · [CDM](https://cdm.link/star-wars-and-sound-design/)
- **Dune (2021):** three or four of about 3,200 new sounds began as synthetic. Mangini:
  "We can't find a worm, a shield, or an ornithopter in a sound library."
  [MPA](https://www.motionpictures.org/2022/03/dune-oscar-nominated-sound-team-on-sandworms-ornithopters-more/) ·
  [Tor](https://tor.com/2021/11/05/dune-ornithopter-sound-design) ·
  [Synthtopia](https://www.synthtopia.com/content/2022/02/01/the-sound-design-of-dune/)
- **The Expanse:** weapons start "with a real sound, like a real gun sound", then are
  altered. [A Sound Effect](https://www.asoundeffect.com/the-expanse-sound)

### 16.3 Sound across open air

- **Distance and air absorption.**
  [Audiokinetic](https://audiokinetic.com/a-wwise-approach-to-spatial-audio-part-1) ·
  [Arma 3](https://community.bistudio.com/wiki/Arma_3_Sound:_Filters) ·
  [Unreal](https://dev.epicgames.com/documentation/en-us/unreal-engine/sound-attenuation-in-unreal-engine)
- **Delay only for big events.**
  [Godot forum](https://forum.godotengine.org/t/how-do-i-make-every-single-node-simulate-the-speed-of-sound-with-delays/143645) ·
  [Taylor & Francis](https://www.taylorfrancis.com/books/e/9781351653954/chapters/10.1201%2Fb22247-10)
- **Whizz and crack.**
  [PC Gamer on PUBG](https://pcgamer.com/how-gunshot-sounds-work-in-playerunknowns-battlegrounds) ·
  [Morphic](https://morphic.com/resources/sounds/bullet-fly-by-sound-effects) ·
  [Zapsplat](https://www.zapsplat.com/?p=42787)
- **Echo in the browser.** [MDN ConvolverNode](https://developer.mozilla.org/en-US/docs/web/api/convolvernode) ·
  [Abratabia (vendor blog)](https://www.abratabia.com/web-game-audio/spatial-audio-games.php)

### 16.4 Ambience

- **Layers, detail out of the bed, random timing, subtlety.**
  [Bugnet](https://bugnet.io/blog/how-to-design-ambient-sound-layers) ·
  [Criware](https://blog.criware.com/?p=3193) ·
  [Audiokinetic](https://blog.audiokinetic.com/en/designing-ambience-systems-in-wwise/) ·
  [Splice](https://splice.com/blog/audio-soundscape-for-video-games) ·
  [Creator Sounds Pro](https://creatorsoundspro.com/building-immersive-rpg-worlds-layering-ambient-loops-for-maximum-realism) ·
  [Game Developer, Eon Altar](https://www.gamedeveloper.com/audio/video-game-audio---under-the-hood---eon-altar-ambience-system)
- **Zones blended by a game value; state changes that fade.**
  [Audiokinetic](https://www.audiokinetic.com/en/blog/open-world-ambient-design-using-image-based-parameters) ·
  [SCIL wiki](https://scil-wiki.su.edu/books/audio/page/using-states)
- **The Last of Us:** regions matching the level, real abandoned places recorded, reverb
  for contrast. [A Sound Effect](https://asoundeffect.com/the-last-of-us-part-ii-sound/) ·
  [Epic Sound](https://epicsound.com/2014/04/great-in-depth-interview-with-the-audio-team-on-the-last-of-us)
- **Ambience carrying a game:** Subnautica planned no music on the surface (commentary).
  [Spin](https://www.spin.com/?p=369687) · [The Geek Wave](https://thegeekwave.com/2020/06/subnautica-and-sound)
- **Quiet matters:** Alien: Isolation was criticised because "everything makes noise".
  [PC Gamer](https://pcgamer.com/the-audio-of-alien-isolation) ·
  [AV Club](https://avclub.com/alien-isolation-fills-up-the-quiet-space-that-keeps-re-1798273762)

### 16.5 Making sounds in code

- **Only where it solves a problem** (Paul Weir).
  [Audiokinetic Q&A](https://www.audiokinetic.com/en/blog/behind-the-sound-of-no-mans-sky-a-qa-with-paul-weir-on-procedural-audio)
- **What works:** modal synthesis fitted to one recording, shipped in Crackdown 2; Farnell's
  procedural models.
  [Microsoft Research](https://microsoft.com/en-us/research/?p=309038) ·
  [Ren, Yeh & Lin](https://typeset.io/pdf/example-guided-physically-based-modal-sound-synthesis-1z2lkvntsi.pdf) ·
  [Farnell practicals](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/8375/designing_sound.zip/practical31.html)
- **Its limit:** the best synthesised thunder was still told apart from a recording.
  [Fineberg, Walters & Reiss](https://arxiv.org/pdf/2204.08026.pdf)

### 16.6 Warnings, priority, mixing, loudness, accessibility

- **The alert ladder:** warning, caution and advisory defined by urgency; unique master
  warning and caution tones; lower urgency waits for higher; two senses for warnings and
  cautions.
  [14 CFR 25.1322](https://www.law.cornell.edu/cfr/text/14/25.1322) ·
  [FAA AC 25.1322-1](https://www.faa.gov/documentLibrary/media/Advisory_Circular/AC_25.1322-1.pdf) ·
  [EASA CS-25](https://www.easa.europa.eu/en/document-library/easy-access-rules/online-publications/easy-access-rules-large-aeroplanes-cs-25?page=42)
- **Alarm fatigue:** most alarms are false or not acted on, staff stop responding, and the
  favoured fix is fewer alarms that each mean more.
  [AAMI review (typeset)](https://typeset.io/pdf/monitor-alarm-fatigue-an-integrative-review-4jyt4oz7s0.pdf) ·
  [Cvach, approaches](https://researchgate.net/profile/Maria-Cvach/publication/320885426_Technologic_Distractions_Part_2_A_Summary_of_Approaches_to_Manage_Clinical_Alarms_With_Intent_to_Reduce_Alarm_Fatigue/links/5a071d184585157013a5bc62/Technologic-Distractions-Part-2-A-Summary-of-Approaches-to-Manage-Clinical-Alarms-With-Intent-to-Reduce-Alarm-Fatigue.pdf) ·
  [Physicians Weekly](https://www.physiciansweekly.com/alarms-in-emergency-rooms/)
- **Threat-weighted mixing:** Overwatch (press coverage of the GDC talk); DICE.
  [PC Gamer](https://pcgamer.com/how-overwatch-uses-sound-to-pinpoint-threats-you-cant-see) ·
  [GDC Vault](https://gdcvault.com/play/1023010/Overwatch-The-Elusive-Goal-Play) ·
  [Frostbite](https://frostbite.com/frostbite/news/how-hdr-audio-makes-battlefield-bad-company-go-boom) ·
  [ESA, Battlefield 6](https://www.theesa.com/behind-the-scenes/an-orchestra-of-the-battlefield-inside-the-audio-design-of-battlefield-6-with-mari-saastamoinen-minto/)
- **Snapshots and ducking:** stored mixes moved between by game state; frequency-based
  ducking over volume ducking (Baldur's Gate 3).
  [Game Developer](https://www.gamedeveloper.com/audio/the-future-of-game-audio---is-interactive-mixing-the-key-) ·
  [Audiokinetic, Baldur's Gate 3](https://www.audiokinetic.com/en/blog/baldurs-gate-3-rolling-for-audio-alchemy) ·
  [Wwise side-chaining](https://www.audiokinetic.com/download/documents/Wwise_SideChaining_Tutorial.pdf)
- **Loudness** (secondary sources).
  [Designing Sound](https://designingsound.org/2012/07/30/video-games-and-loudness-standards-interview-with-sonys-garry-taylor/) ·
  [Audiokinetic](https://audiokinetic.com/loudness-processing-best-practices-series-chapter1-loudness-measurement-part1)
- **Accessibility.**
  [XAG 105](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/105) ·
  [XAG 103](https://learn.microsoft.com/en-gb/gaming/accessibility/xbox-accessibility-guidelines/103)
- **Game feel.** [Wikipedia](https://www.wikipedia.org/wiki/Game_feel) ·
  [Juice it or lose it](https://gamejuice.pages.dev/articles/juice-it-or-lose-it-lessons)

### 16.7 Music and navigation

- **FTL** adds a percussion layer when a fight starts.
  [NPR](https://www.npr.org/2013/10/06/229171039/composing-game-soundtracks-that-move-faster-than-light)
- **Layering and resequencing.**
  [Game Developer, Winifred Phillips](https://www.gamedeveloper.com/game-platforms/hybrid-horizontal-vertical-structure-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-)
- **Outer Wilds:** tracking distant signals by ear, the model for LAST TRANSMISSION.
  [Mobius Digital](https://www.mobiusdigitalgames.com/news/separating-the-signal-from-the-noise)

### 16.8 Free sources

[NASA Image and Video Library API](https://images-api.nasa.gov/search?q=launch&media_type=audio) ·
[Freesound API](https://www.freesound.org/docs/api/overview.html) ·
[CDM on NASA's sound library](https://cdm.link/nasa-posts-huge-library-space-sounds-youre-free-use/)

---

## Appendix A: every message, and where its sound is

Every file in `game/` that shows the player something, and where its sound is designed.
Messages written only as texture (`chatter(…, false)`) are silent by §4.12.

| File | What it says or shows | Sound in |
|---|---|---|
| `bosses.js` | coming up on / in / out of a boss's sky; the pack called; the queen takes a ship; a boss dead (by you, or not); water across, refused or given; sentry and drone hits; hulks shot open | §5, §8.5, §8.6, §8.12 |
| `campaign.js` | orders, salvage, aces, veterans, reserves, phase lines, hangar bays, shield generators, the flagship, the finale | §8.15 (cabinet) |
| `factions.js` | light-drive arrival from the mouth; power temper changes; a part online; refused builds and purchases; bought; melter; fit removed or finished at a station; the teaching beats (`OPENING`) | §8.3, §8.4, §8.8, §8.9, §8.10 |
| `living.js` | raids, wars, ceasefires, leaders, laws, provinces, secession (texture); bounty posted (texture) and paid | §8.11 |
| `physics.js` | hull hits, the Screen, hull at zero, light drive cut, deaths, firing, the claw, bursts, rocks, traffic and drones hit | §5, §8.1, §8.2, §8.6 |
| `pilots.js` | escort breaking off; a patrol's two warnings; a convoy unloading (texture); your part taken; a scavenger first; not armed; rocks; traffic destroyed | §5, §8.6, §8.11 |
| `sector-places.js` | wormhole through / tuned; device still fitting or refused; pirates on your cargo; emergency jump; mines and decoys; sentries woken, firing, hit; caches opened, guarded, no room; friends; the grudge ship | §5, §8.3, §8.6, §8.8, §8.11, §8.12 |
| `sector.js` | no room; bought aboard; sold; refused; motes into the hold | §8.6, §8.9 |
| `survey-bearings.js` | THE COIL FIRED; your hull recovered; a part picked up or delivered; THE STATION IS WHOLE; territory changed hands | §8.6, §8.8, §8.10, §8.11 |
| `survey-outfit.js` | cloak broken; decoy, mine, eject, grapple, cloak, EMP, burner, brood | §8.3 |
| `survey-setup.js` | scanner down from your EMP; scan returns, nothing, a boss's sky, a region's edges; almanac entries; the opening banner | §8.4, §8.10 |
| `survey-state.js` | watching a chart target; pins; refusals on pages | §8.9 |
| `survey-tick.js` | Silent Running over | §8.3 |
| `survival.js` | light drive engaged, disengaged, cut, too deep; tank warnings; water and food out; buying water and food; refused; hull made good; objective notices; respawn | §5, §8.1, §8.5, §8.8, §8.9, §8.10 |
| `traffic.js` | swallowed by a star or well; haulers out of water, silent, saved, under way; distress calls; rammed; boss weapons | §8.7, §8.11, §8.12 |
| `update.js` | rounds striking and expiring; rocks breaking | §8.2, §8.6 |
| `war.js` | battles seen and over; powers too spent to fight (texture); a hunter sent; hulls bought and flown; the light drive fitted | §8.9, §8.11 |
| `input.js` | exit game armed | §8.9 |
| `machines.js` | a cabinet booting; a cabinet or the multiplayer door refusing | §8.15 |
| `survey-streaming.js` | a rock smashing into a world | §8.7 |
| `world.js`, `multiplayer.js` | a match starting | §8.15 |
| `lobby.js` | a player connected, connected to the host, disconnected | §8.14 |
| `account.js` | signing out; the lobby refusing to start ("Wait for every player…") | §8.9 (account door), §8.14 |
| `boot.js` | passes the survey HUD its `say`, which is `chatter`: covered above | — |
| `settings.js` | the volume preview | §8.9 |
| `survey-hud/panel.js` | the gravity band, the critical edge, the light-drive countdown, the tank WARNING and triangle | §5, §9 |
| `survey-hud/*` (pages) | chart, almanac, station, workbench, ship, record, sector, hangar, the cabinet room, death and lore | §8.9 |

**Nobody has listened to any of this yet.** It is a plan to be built and then judged by
ear in `sounds/listen.html`.
