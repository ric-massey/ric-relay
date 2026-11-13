# KONDRITE — sound design

**Status: an audit and a plan, written 2026-11-13. None of the proposals below are
built.** It lists every action, animation, place and event in the game that makes a
sound, or should, and says where the sound should go and why. It starts from what the
engine already does (`game/sound.js`, `test/sounds.js`, `sounds/listen.html`) and keeps
its rules: everything is synthesised or made by a standard-library script, nothing is
fetched from a CDN, nothing grates, and **if you can see it you can hear it**.

Read the README's sound section first. This file does not repeat it.

---

## 1. What the game sounds like today

Eighteen voices, all one-shots, all under 0.4 s, four volume channels:

| Channel | Voices |
|---|---|
| WEAPONS | `laser` `beam` `scatter` `seeker` `lance` (five `.wav` files) · `shot` (synth fallback) |
| IMPACTS | `hit` `rock` `boom` `tink` `fizz` `explode` |
| SHIP & GADGETS | `warp` `thrust` `pickup` |
| INTERFACE | `start` `win` `lose` |

About 190 call sites, every one through `gameSound(kind, x, y)` (`game/world.js`). The
engine already does the hard things right: per-instance pitch and level variation,
35 ms de-duplication so a volley is not a spike, filtered noise, a compressor on the
master, stereo pan by screen position, off-screen culling, and a measured test.

**What it does not have:** any sound longer than 0.4 s, any loop, any ambience, any
music, any sound on a menu, and any way for one sound to make room for another.

## 2. Findings — what is wrong now

Ranked by how much a player would notice.

### 2.1 A bug: `alarm` is silent

`gameSound("alarm")` is called three times — crossing into a boss's sky
(`game/bosses.js:271`), the warlord calling its pack in at half hull
(`game/bosses.js:315`), and a grudge ship coming back for you
(`game/sector-places.js:1059`). `sfxVoice` has no `alarm` branch and `SFX_CHANNEL` has
no entry, so all three play nothing. These are three of the most dramatic moments in
Survey and they are the only ones that were *meant* to have a sound of their own.
`test/sounds.js` does not catch it because it renders the voices `sfxVoice` knows,
not the names the game calls. **Fix first, and add a test that every literal passed to
`gameSound` is a voice.**

### 2.2 Three voices mean everything

| Voice | What it currently means |
|---|---|
| `win` | an almanac entry · a part picked up · a hull recovered · a part fitted · a light drive engaged · a sale · a boss killed · a bounty · a hauler saved · a workbench build · a ship bought · a cache opened |
| `hit` | your hull taking damage · an EMP going off · the Flagship Screen soaking a shot · **every refused button in every shop** · water at half · "too deep in a well to run" |
| `start` | the round starting · a purchase · a squad order · campaign salvage · **the decoy** · **the cloak** · the part delivered to the station · a fit begun |

The cost of this is learnability. A player who hears `win` cannot tell a ten-second
sale from the first time they logged THE LEVIATHAN, and a player who hears `hit` in a
shop flinches for a hull hit that did not happen. Sound only teaches if a sound means
one thing (Gaver's auditory icons, Blattner's earcons — §4.4).

### 2.3 The signature verbs borrow other things' voices

| Verb | Voice it borrows | Problem |
|---|---|---|
| **Scan** (`F`), the verb a mode called *Survey* is named for | `shot` — the cannon's fallback blip | sounds like firing; teaches nothing about what came back |
| Silent Running (cloak) | `start` — the round-start jingle | a three-note tune to announce going quiet |
| Decoy | `start` | same jingle |
| EMP | `hit` | indistinguishable from being shot |
| Mine laid | `shot` | sounds like a gunshot |
| Corsair Burner | `shot` | a dash that sounds like a blip |
| Brood Bay | `shot` | three bugs launched, one blip |
| Grapple | `thrust` | fine as a start; no line-tension, no catch |
| Burst Charge firing | `seeker` | the burster and the seeker are identical to the ear |

### 2.4 Continuous things make no sound

There is no engine. Holding thrust — the thing the player does more than anything
else — is silent; `thrust` is used once, by the grapple. There is no sound for the
tractor beam pulling, the melter running, skimming an atmosphere, the light drive
running, a fit in progress, a gravity well pulling, sitting near a star while it
repairs you, the Murk's static, the wall closing in Battle Royale, or the cloak's ten
seconds. A game with no loops sounds like a game made of clicks.

### 2.5 Warnings that are only drawn

- **Gravity** — `surveyWarning` (`game/survey-bearings.js:814`) computes four levels,
  GRAVITY AHEAD → HEAVY PULL → PULL EXCEEDS DRIVE → CANNOT ESCAPE, and draws them. No
  sound at any level. The README calls a supermassive well "the case where arriving
  late is fatal" — that is exactly the case audio exists for, because the player is
  looking at the ship, not the HUD.
- **Hull at zero** — "the next one kills you" plays the same `hit` as any graze. The
  most dangerous state in Survey has no sound that persists.
- **Sentry waking** — "Something in here just woke up" (`sector-places.js:546`), silent.
- **A patrol's warning** — "that is close enough" / "they told you once"
  (`pilots.js:246`), silent; the second line means guns are coming.
- **Distress call** (`traffic.js:89`), **enemy ace enters** (`campaign.js:216`),
  **a battle seen** (`war.js:207`) — silent.

### 2.6 Arrivals that are silent

Docking, landing on an inhabited world, coming out of a wormhole on the far side (the
`warp` plays going in), arriving after a light-drive run, respawning at the station,
a station section coming back online when you deliver its part, and the news headline
read to you on docking.

### 2.7 No interface sound at all

The front page, the account door, the settings rail, the station pages, the chart, the
almanac, the hangar, the arcade room, the lobby: zero calls. Moving through a menu,
opening a page and closing it are all silent, while buying something plays a jingle.

### 2.8 No priority between sounds

Every sound plays at its own fixed level and the compressor sorts out the pile. Your own
cannon and a sentry's shot at you are the same voice at the same level. When a fight is
busy, the one round that is about to hit you is no louder than forty that are not. That
is the "loudest sound wins" mix Overwatch's team rejected (§4.2).

### 2.9 Smaller things

- Ore motes play `pickup` on a 25% roll (`sector.js:730`) — so the pentatonic "little
  tune" the comment promises is mostly gaps. A step-up in pitch per mote in a run would
  keep it musical without playing every one.
- The campaign's mothership finale is a slow-motion death (`slowmo(0.45, 1.4)`) but the
  sound runs at full speed; its rumble is `boom` on a 5% roll per frame
  (`campaign.js:915`).
- A tab that goes to the background does not suspend the audio context.
- No mono option, and SETTINGS → AUDIO has no music or ambience dial (there is nothing
  to put on one yet).

---

## 3. The direction: the hull is the microphone

Space has no air. Every space game picks a convention, and the good ones pick one on
purpose. KONDRITE's should be: **you hear what your hull feels and what your
instruments tell you.**

- **Your own ship is close, full-range and physical.** Engine, guns, hits, gadgets,
  scrapes — felt through the frame. Bass is allowed here.
- **Everything else is filtered by distance.** Another ship's gun is a duller, quieter,
  low-passed version of the same voice, and gets brighter as it closes. That is a
  physical story (the instruments relay what the sensors pick up) and it does the
  mixing job of telling "near and about me" from "out there".
- **The instruments have their own voice.** Scan, gravity warning, low tanks, tractor —
  a cockpit family of clean sine and triangle tones, never noise. When you hear a pure
  tone, it is the ship talking to you.
- **Silence is a material.** Survey is long and mostly calm, and BIOMES.md asks the Long
  Empty to feel like nothing. Ambience must be quiet enough that its absence is
  noticed.

This keeps the README's rule intact. A sound with a place is still dropped off screen;
an instrument sound (a warning, the scan) is the ship talking and has no place, which
is the README's own definition of an interface sound.

---

## 4. Research: where sounds work best, and why

### 4.1 Sound is half of game feel

Game feel is defined in part by "appropriate, impactful, and pleasing (non-repetitive)
sound effects" ([Game feel — Wikipedia](https://www.wikipedia.org/wiki/Game_feel)), and
Jonasson & Purho's *Juice it or lose it* (Nordic Game Jam 2012) built a dull Breakout
into a satisfying one with flash, shake, particles and sound
([summary](https://gamejuice.pages.dev/articles/juice-it-or-lose-it-lessons)). Steve
Swink's *Game Feel* is the other primary source
([reader](https://brkeogh.com/2017/03/31/an-incomplete-game-feel-reader/)).

**For KONDRITE:** the game already has shake (`addShake`) and particles (`burst`) on
almost every event. Where those fire and no sound does — docking, the EMP ring, the
grapple catching, the hull reaching zero — the event is two-thirds juiced. Those are
the cheapest wins in this document.

### 4.2 Play by sound: importance, not loudness

Overwatch's audio team was given "Play by Sound" as a goal and found that standard HDR
mixing, where "the loudest sound wins", did not serve it. They built an **importance
system**: every enemy gets a priority from how close it is, whether it is looking at
you and whether it is shooting at you, and the mix is re-weighted live to put the
biggest threats forward and dim the rest. Lawlor called it "the most important feature
we added to the game when it comes to playing by sound"
([PC Gamer](https://pcgamer.com/how-overwatch-uses-sound-to-pinpoint-threats-you-cant-see);
[GDC Vault](https://gdcvault.com/play/1023010/Overwatch-The-Elusive-Goal-Play);
[Audiokinetic](https://www.audiokinetic.com/ko/blog/overwatch-game-audio-using-wwise-1)).

DICE's Frostbite HDR audio came at it from the other side: "play the right sounds, not
all sounds" — prioritise rather than compete for dynamic range
([Frostbite](https://frostbite.com/frostbite/news/how-hdr-audio-makes-battlefield-bad-company-go-boom);
[slides](https://www.slideshare.net/slideshow/adaptive-mixing-in-frostbite/3128152)).
Battlefield 6's audio director lists "threat-based mixing" among current work
([ESA](https://www.theesa.com/behind-the-scenes/an-orchestra-of-the-battlefield-inside-the-audio-design-of-battlefield-6-with-mari-saastamoinen-minto/)).

**For KONDRITE:** a small version of this is affordable in Web Audio — see §6.2. Every
in-world sound gets an importance (is it aimed at me, how close, is it mine), and the
importance sets gain and filter brightness. A sentry firing *at you* is bright and
forward; a war two hundred units off is dull and back. It also fixes §2.8 without a
single new voice.

### 4.3 Sound as navigation

Outer Wilds is the strongest precedent for a game about finding things in space: the
Signalscope tracks audio — travellers' instruments, distress beacons, quantum signals —
and creative director Alex Beachum said "a large part of the original narrative design
of the game was created with the signalscope in mind"
([Mobius Digital](https://www.mobiusdigitalgames.com/news/separating-the-signal-from-the-noise);
[Wikipedia](https://wikipedia.com/wiki/Outer_Wilds)). Each world has its own musical
identity you can hear from anywhere. Note that the game also gives visual direction
cues, so sound is never the only channel
([Family Gaming Database](https://www.familygamingdatabase.com/accessibility/Outer+Wilds)).

**For KONDRITE:** the scan is a sonar and should sound like one — an outgoing pulse, then
returns that arrive *later for things further away*, with a timbre per kind (§7.4).
LAST TRANSMISSION is "still broadcasting"; it should be audible before it is on screen
as a faint signal on the instruments, which is the one landmark where breaking the
"see it to hear it" rule is the point of the place.

### 4.4 Make one sound mean one thing

Auditory icons (Gaver, 1986) map a system event onto the sound of a physical event;
earcons (Blattner, Sumikawa & Greenberg, 1989) are abstract tones built into structured
families. Users associated auditory icons with commands more easily; **earcon families
are good at hierarchies** like menus and error levels
([Brewster, CHI '93](https://www.dcs.gla.ac.uk/~stephen/papers/CHI93.PDF);
[Gaver](https://www.ioa.org.uk/system/files/publications/WW%20GAVER%20AUDITORY%20ICONS.pdf)).

**For KONDRITE:** in-world events get auditory icons (a hull hit sounds like metal, a
cache like a seal breaking). The interface and the instruments get **earcon families**:
one family for *money* (sale, purchase, refusal), one for *discovery* (scan returns,
almanac, landmark), one for *warning* (gravity, tanks, hull). Within a family, pitch and
length carry importance — a sale is two short notes, an almanac entry is a longer rising
phrase in the same key. That replaces `win` / `hit` / `start` (§2.2).

### 4.5 Procedural sound for an endless place

No Man's Sky's audio was built procedurally because its universe is: Paul Weir made a
generative music tool, *Pulse*, with 65daysofstatic supplying the material, and the
VocAlien tool for creature voices
([Digital Trends](https://www.digitaltrends.com/?p=1020736);
[Splice](https://splice.com/blog/?p=16269);
[Audiokinetic Q&A](https://www.audiokinetic.com/en/blog/behind-the-sound-of-no-mans-sky-a-qa-with-paul-weir-on-procedural-audio)).

**For KONDRITE:** the sector is a pure function of the seed, and the sound can be too —
a station's hum, a world's drone and a region's bed can all be derived from the same
`seeded()` the chunk uses, so the same place always sounds the same and the place next
door does not. It also costs no files, which keeps the game's no-dependency rule.

### 4.6 Music that follows play

Two standard techniques: **vertical layering** (stems on one timeline, faded in and
out — drums enter when combat starts) and **horizontal resequencing** (switching
sections at bar lines, with stingers for victory or loss); most scores mix both
([Game Developer, Winifred Phillips GDC 2021](https://www.gamedeveloper.com/game-platforms/hybrid-horizontal-vertical-structure-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-)).
FTL — the closest relative in tone — uses two tracks per piece, one without percussion
and a layer added over it when a fight starts
([NPR](https://www.npr.org/2013/10/06/229171039/composing-game-soundtracks-that-move-faster-than-light)).

**For KONDRITE:** if music comes in at all, vertical layering is the right shape for
Survey (§9), and it has to stay out of the Long Empty.

### 4.7 Space with sound in it

Every space game breaks physics; the question is how. Elite Dangerous's players
explain its soundscape as sound reaching you through the ship's structure, and Frontier
use sonification of real data for some of its space sounds
([Frontier forums](https://forums.frontier.co.uk/threads/the-answer-why-there-is-sound-in-space.239479);
[A Sound Effect](https://www.asoundeffect.com/?p=26142)). The physical basis is real:
vibration travels through a hull into the air of a pressurised cabin
([New Space Economy](https://newspaceeconomy.ca/2026/04/16/why-cant-we-hear-sound-in-space.md)).
This is the basis of §3.

### 4.8 Loudness and accessibility

Sony's guidance is about −24 LUFS integrated for home platforms and −18 LUFS for
portable ones, −1 dBTP peak
([Designing Sound interview with Garry Taylor](https://designingsound.org/2012/07/30/video-games-and-loudness-standards-interview-with-sonys-garry-taylor/);
[Audiokinetic](https://audiokinetic.com/loudness-processing-best-practices-series-chapter1-loudness-measurement-part1)).
A browser game played on phone speakers sits nearer the portable figure. Xbox
Accessibility Guideline 105 asks for separate volume controls for at least music,
voice, active sound effects, background/ambient effects and narration, and recommends
spatial audio; XAG 103 asks that every important cue go through more than one sense
([XAG 105](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/105);
[XAG 103](https://learn.microsoft.com/en-gb/gaming/accessibility/xbox-accessibility-guidelines/103)).

**For KONDRITE:** add AMBIENCE and MUSIC dials when those exist; add a mono switch
(pan is information, and one-earbud players lose it); and keep the rule that every new
warning sound has a visual twin — they almost all already do.

---

## 5. A sound vocabulary

Every proposed sound below belongs to one family. The family says what kind of
waveform it is built from, so that a player learns the families before the members.

| Family | Built from | Meaning | Channel |
|---|---|---|---|
| **Hull** | filtered noise + low triangle, short | something physically touched you or your ship did something | SHIP / IMPACTS |
| **Guns** | the five `.wav` lasers + new ones | something fired | WEAPONS |
| **Out there** | the same voices, low-passed by distance | it happened, not to you | by voice |
| **Instruments** | clean sine / soft triangle, no noise | the ship is telling you something | INTERFACE (new: INSTRUMENTS) |
| **Money** | two plucked notes, major | a transaction | INTERFACE |
| **Discovery** | rising phrase, one fixed key, longer | you found or learned something | INTERFACE |
| **Warning** | falling or pulsing, minor second / tritone | danger is close and rising | INSTRUMENTS |
| **Place** | slow loops, seeded | where you are | new: AMBIENCE |

**One key.** Discovery, money and the jingles should share one tonal centre (the
current `start` is A-based: 220/330/440). Then every reward in the game is "in tune"
with every other one and the pentatonic ore pickups already fit it.

---

## 6. Mix architecture

### 6.1 Buses

```
voice → (distance filter) → (importance gain) → channel bus → duck bus → master → compressor → limiter → out
                                                                   ▲
                                       instruments + discovery sidechain the world here
```

Add channels **AMBIENCE** and **INSTRUMENTS** (or fold instruments into INTERFACE —
it is a judgement call; XAG 105 argues for separating active effects from background).
Add **MUSIC** only if §9 is built.

### 6.2 Importance (Overwatch, small)

At `gameSound` time, compute a 0–1 importance:

- `1.0` your own ship, and anything aimed at you within a screen
- `0.7` anything on screen hostile to you
- `0.4` on screen, neutral (a war between two other powers)
- multiply by distance from the ship, not from the camera centre

Use it to set gain (−9 dB at the bottom) and a low-pass cutoff (4 kHz at 1.0 → 900 Hz at
0.4). This is §3's "out there" family, and it is two nodes per voice.

### 6.3 Ducking

When an **instrument** or **discovery** sound plays, pull the world bus down ~6 dB for
its length. The almanac entry is the moment to celebrate; it should not be fighting a
mining run. Ducking is a `GainNode` ramp on one bus.

### 6.4 Loops

Loops need a manager the one-shots never needed: start, update a parameter per frame,
stop with a release. Cap them (engine, one well, one beam, one ambience bed, one
alarm). Every loop must ramp in and out — a loop that cuts is a click.

### 6.5 Voice limit

The 35 ms de-dup handles same-frame volleys. Add a hard cap per voice kind (e.g. six
`hit`s live), stealing the lowest-importance one. A Total War battle with eight hulls a
side is the case.

---

## 7. The inventory

Every row is an event the game already has. **Today** is what plays now (— is
silence). **Priority**: P0 broken, P1 core feel, P2 depth, P3 polish.

### 7.1 Your ship

| Event | Code | Today | Proposal | Why there | P |
|---|---|---|---|---|---|
| Thrust held | ship update | — | **Engine loop**: low filtered noise + sub triangle; gain and cutoff follow thrust; pitch follows speed a little; release tail on let-go. Per-hull character (Skiff thin, Tender heavy) from `shipSpec` | the most-performed action in the game; the hull family's anchor | P1 |
| Reverse thrust | ship update | — | same loop, a step down in pitch, more noise | tells forward from back without looking | P2 |
| Turning hard | ship update | — | small attitude-jet puffs on turn start, very quiet | feel of a ship with RCS; optional | P3 |
| Over cruise speed (slingshot boost, burner) | `me.boost` | — | wind-like high band on the engine loop that bleeds down with the boost | the README makes "coasting it off" a feeling; make it audible | P2 |
| Hull hit (survey) | `physics.js:321–340` | `hit` | **Hull** voice, heavier than now; pan from the side it came from | — | P1 |
| Hull reaches zero | `physics.js:339` | `hit` | one distinct crack + start a **critical loop**: slow two-note heartbeat on instruments until you mend | "meant to be terrifying" — a state, not an event | P1 |
| Brush with a solid (no damage) | collision | — | soft scrape, gain by contact speed | "a slow brush is free" should still be felt; teaches the shape | P2 |
| Hard contact (damage) | collision | `hit` | scrape + clank | — | P2 |
| Death (survey) | `survival.js:520` | `lose` | `explode` close-up + low-passed fall to silence over ~1.5 s before the death screen | death needs a gap of silence to land | P1 |
| Respawn at station | `survival.js:560` | — | station hum fading in + a soft "systems up" rising triad | the setback ends; tells you you are home | P1 |
| Invulnerability ending | `ship.invuln` | — | quiet tick on the instrument family | you are vulnerable again | P3 |

### 7.2 Weapons

| Event | Code | Today | Proposal | P |
|---|---|---|---|---|
| Cannon / beam / scatter / seeker / lance | `physics.js:610, 674` | the `.wav`s | keep; route through importance (§6.2): yours full, theirs filtered | P1 |
| Burst Charge fired | `physics.js:674` | `seeker` | its own voice: a thump-launch, lower than the seeker | P2 |
| Burst Charge goes off | `physics.js:731` | `boom` | keep, and add a short ring-out matching the 190-unit blast | P3 |
| Seeker locking / turning | seek logic | — | very quiet rising whine on a seeker *aimed at you* only | threat that you can't see behind you — exactly the Overwatch case | P2 |
| War Fan, Warden's Swarm | `WEAPONS.fan/swarm` | scatter / seeker | their own files in `make-lasers.py` — boss parts should sound like trophies | P2 |
| Miss into rock / structure | `update.js:339, 353` | `tink` | keep; it is right | — |
| Round expires | `update.js:365` | `fizz` | keep | — |
| Out of range of everything | — | — | nothing. Correct. | — |

### 7.3 Devices (the four slots)

| Device | Today | Proposal | Why |
|---|---|---|---|
| Decoy | `start` | pneumatic launch + a fading copy of your engine loop drifting away (panned with the decoy for its 14 s) | the decoy *is you* to the sentries — let it sound like you |
| Mine laid | `shot` | soft clunk; arming at 1.6 s gets a click | the arm delay is a rule; hear it |
| Mine (yours) near you once armed | — | slow tick that quickens as you close on it | "flew back over your own mine" is a death cause |
| Mine expires / oldest fizzles | `fizz` | keep | — |
| Cargo eject | `rock` | hatch thunk + a rattle of tumbling cargo | it is a loss; make it feel like one |
| Emergency jump | `warp`(via `emergencyJump`) | `warp` but longer and torn — then near-silence on arrival (no scan, lost) | "being lost somewhere else" |
| Grapple | `thrust` | line fire (zip) → catch (clank) → tension creak during the 0.45 s pull; refusal "Nothing to hook" gets a dry click | the miss is free and frequent — make the refusal tiny |
| Silent Running | `start` | **everything ducks −12 dB and low-passes** for the ten seconds; your engine loop drops to a whisper; a faint heartbeat. Firing breaks it with a sharp un-duck | the cloak should *sound* like hiding — the best audio-only feature in the list |
| EMP | `hit` | a charge-up whine (~0.2 s) → a wide low *whump* → electrical crackle that dies; your own instruments go silent for `EMP_STUN` and return with a reboot chirp | it takes down your own kit — let the player hear their instruments go dead |
| Corsair Burner | `shot` | a roaring ignition into the boost band of the engine loop | — |
| Brood Bay | `shot` | wet hatch + three chittering launches staggered | — |
| Flagship Screen absorbs a hit | `hit` | glassy shield chime, *not* a hull hit; recharge after 12 s gets a rising hum | the screen took it — you did not; this is the most misleading reuse in the game |

### 7.4 The Survey instruments

| Event | Code | Today | Proposal | Why there | P |
|---|---|---|---|---|---|
| **Scan pulse** | `survey-setup.js:661` | `shot` | outgoing sine ping with a short tail | the name of the mode | P1 |
| **Scan returns** | `surveyScan` found list | — | one soft return per echo, **delayed by its distance** (e.g. 0.15 s → 0.9 s across the reach), panned by bearing, **timbre by kind**: salvage/cache a warm note in key, station a two-note chord, wormhole a bent tone, sentry/boss a low dissonant blip. Cap at ~8 returns, closest first | the player learns the shape of what is around them *by ear* — a sonar that works like one (§4.3) | P1 |
| Scan finds nothing | `survey-setup.js:782` | — | the pulse with no returns, then one low "empty" tone | silence is also information, but it needs a frame | P2 |
| Scan not charged | `surveyScan` | silence (by design) | keep — the comment argues for it | — |
| Scan blocked by own EMP | `survey-setup.js:654` | — | dead-instrument buzz | — | P3 |
| Scan in the Murk | `scanRange()` | — | the same ping through bitcrush/static, returns smeared | the instrument is what is broken here (BIOMES.md) | P2 |
| Tractor beam pulling | tractor | — | thin hum while a mote is in the beam | MK1→MK3 reach is a thing you "feel" — hear it | P2 |
| Ore mote into the hold | `sector.js:730` | `pickup` 25% | every mote, climbing the pentatonic within a run, reset after a pause | turns mining into a little tune, as its comment wants | P2 |
| Hold full (LADEN) | `sector.js:171` | — | low "clunk-full" on the money family | it changes what you are doing next | P2 |
| Melter running | `factions.js:877` | — | gentle sizzle loop while it runs | — | P3 |
| Skimming an atmosphere | `surv.overAir` | — | wind loop, gain by depth in the air | "costs time instead of money" — the time should sound like something | P2 |
| A fit completes | `factions.js:651` | `win` | mechanical lock + discovery-family short phrase | — | P2 |
| Light drive engage | `survival.js:51` | `win` | spool-up (rising saw through low-pass) into a steady high loop for the run | it is the late-game prize; hold-your-heading needs a sound to hold | P1 |
| Light drive disengage / cut | `survival.js:39, 118`, `physics.js:330` | — | spool-down; a *cut* (hit) is an abrupt choke | — | P1 |
| "Too deep in a well to run" | `survival.js:46` | `hit` | warning-family refusal | — | P2 |
| Objective arrow points somewhere new | `objective()` | — | nothing. Correct. | — |

### 7.5 Gravity and the places that kill

| Event | Code | Today | Proposal | Why there | P |
|---|---|---|---|---|---|
| GRAVITY AHEAD → CANNOT ESCAPE | `surveyWarning` | — | instruments: a slow pulse that speeds up and drops in pitch level by level; at CANNOT ESCAPE a held tritone | the most important missing sound in the game — the warning has to land while eyes are on the ship | P1 |
| Inside a well's pull | hazards | — | **Place** loop: a sub-bass drone whose level is the pull you are feeling; stars warm and rumbling, black holes a pitch-falling, filtered rush | turns trajectory planning into something you can hear | P2 |
| Star repairing your hull | star heal | — | the star's drone + soft rising tick per hull point | the star is "a destination rather than only a way to die" | P2 |
| Slingshot released (left faster) | almanac telemetry | — | a whoosh on exit + boost band | the moment "it lets go" (README) | P2 |
| Burned in a star / swallowed by a black hole | death causes | `lose` (UI) | death-by-place: the drone swells and cuts to silence | different deaths, different endings | P2 |
| Battle Royale wall closing | BR | — | low hum at the wall's face, louder as you near it; bounce off it is a hard thud | — | P2 |
| Wormhole in | `sector-places.js:192` | `warp` | keep | — | — |
| Wormhole out (the far side) | arrival | — | reversed warp + a distinct "where am I" silence | arriving is half the trip | P2 |

### 7.6 Places and regions (ambience)

Each a seeded, quiet loop that **fades in by `regionDepth`**, the same function the
starfield tint already uses, so it arrives over thousands of units and never switches
on at a line. This is the audio half of BIOMES.md's "noticed, never named".

| Place | Bed |
|---|---|
| Ordinary space | almost nothing: a very faint hull tick and the engine |
| The Belt / Shards / Rounds | distant grinding, irregular, tuned per silhouette (lumpy low, sharp brittle, round soft) |
| The Rime | high crystalline creaks, sparse — ice |
| The Violet Cloud | a soft, wide hiss that closes in like fog |
| The Murk | radio static and tearing that grows toward the middle — matches the screen grain; off under reduced motion |
| Wells region | slow beating between two low tones (two pulls) |
| Lanes / Settled reach | faint chatter: comms clicks, a distant engine passing |
| The Works | industrial rhythm, a slow far-off machine |
| The Boneyard | cold wind through metal, occasional groan |
| **The Long Empty** | **genuine silence**, and the engine loop slightly quieter — the one place where removing sound is the design |
| City (1.8%) | layered traffic and hum that grows as you approach — the scale reveal BIOMES.md describes, by ear first |
| **The Warrens** | close reflections: a short delay/convolution on your own engine and guns, so you hear the walls; squeezes louder, chambers wider |
| The Leviathan (inside) | the same reflections + slow structural groans; the three caches get a deeper hum the further down the spine |
| The Vault | a sealed, pressurised room-tone; the lock as a held low note |
| NODE 01 | "somebody else's terminal": a faint data warble |
| LAST TRANSMISSION | a looping signal, the one landmark audible before it is visible — faint at the edge of hearing, clearer as you close |
| A station (near) | a seeded hum, a different chord per owner faction |
| An inhabited world (near) | low wind + distant settlement sounds |
| A battle on screen | the importance system does this; no extra bed |

### 7.7 Stations, money and the interface

| Event | Today | Proposal | P |
|---|---|---|---|
| Docking | — | docking clamps (two clanks) + station hum in, world ducks | P1 |
| Undocking | — | clamps release + engine back up | P1 |
| Landing on a world | — | descent rumble + touchdown | P2 |
| News headline on docking | text only | a short comms blip before it; headlines from a power at war get a different blip | P3 |
| Sell | `win` | money family: two plucked notes, rising | P1 |
| Buy | `start` / `win` | money family: two notes, falling | P1 |
| Refused (can't afford, not stocked, no slot, already fitted, …) | `hit` | money family: one dull note, short — never a hull sound | P1 |
| Part delivered — station section comes back on | `start` | the biggest discovery phrase in the game + the station's hum gains a note per section restored (six sections, six notes: the station you rebuild literally becomes a chord) | P1 |
| THE STATION (all six) | `win` | the full chord, once | P1 |
| Ship bought / swapped in the hangar | `win` | hangar thunk + engine starts in the new hull's voice | P2 |
| Workbench build | `win` | a short tool sequence | P2 |
| Hull repaired at a dock | `win` | rising tick, like the star | P2 |
| Water / food bought | `start` | liquid pour / crate | P3 |
| Menu move (keys / pad) | — | very quiet tick | P1 |
| Menu choose / back | — | soft select / soft lower-pitch back | P1 |
| Page open / close (chart, almanac, station, settings) | — | page-open swish, short | P2 |
| Chart pin drop / lift | — | pin click; lift a softer one | P3 |
| Chart zoom step | — | tiny detent per step | P3 |
| Almanac card opened | — | soft page | P3 |
| Account door / sign in ok / error | — | select / confirm / refusal from the families above | P3 |
| Reset survey: first press arms | — | warning chord held for the four seconds | P2 |
| Reset survey: second press | — | a long fall to silence | P2 |
| Save button pressed | — | short confirmation (README: "say out loud that it worked" — make that literal) | P2 |
| Settings volume step | preview | keep | — |

### 7.8 Discovery

| Event | Today | Proposal | P |
|---|---|---|---|
| Almanac entry logged | `win` | discovery phrase, ~1.2 s, world ducked; **landmarks** get a longer phrase than telemetry entries | P1 |
| A secret entry (NODE 01, THE LEVIATHAN) | `win` | its own phrase, in a mode the others never use | P2 |
| Almanac verb unlocked (6 / 12 / 18) | — | discovery phrase + a mechanical "new system online" | P1 |
| Part picked up | `win` | lift + secure; louder for one of the six station parts | P1 |
| Your hull recovered | `win` | your old engine loop starting once, then the discovery phrase | P2 |
| Cache opened / the deep hold | `win` | a seal breaking (hiss + clank); the deep hold a bigger version | P1 |
| A pale dot appears in the Long Empty | — | nothing. The silence before is the sound. | — |

### 7.9 The living world, traffic and war

The living world is "shown before it is said" (README). The audio rule should match:
a sound only for things that happen **on screen** or **to you**. Everything written
with `chatter(…, false)` (texture, never shown) stays silent.

| Event | Today | Proposal | P |
|---|---|---|---|
| Patrol: "that is close enough" | — | comms blip, the faction's tone | P1 |
| Patrol: "they told you once" (now angry) | — | the same blip + a weapon arming click | P1 |
| Distress call | — | a weak, repeating signal, panned to the hauler | P1 |
| Hauler saved / water handed across | `win` | discovery phrase, short | P2 |
| A battle seen | — | the battle is its own sound via importance; add one comms crackle on first sight | P2 |
| A battle ends / memorial | — | a single low bell-like tone for a memorial | P3 |
| Raiders hit a station on screen | — | none extra — the guns are the sound | — |
| Bounty posted on you / paid | — | paid: money family, longer; posted: nothing (you read it later) | P3 |
| Scavenger takes your part / pirate takes the cargo | — | a short "lost" tone | P2 |
| Convoy unloading (texture) | — | silent | — |
| War declared / ceasefire / leader falls / secession | — / — | **silent unless docked**: when you dock the headline gets its blip (7.7) | — |

### 7.10 Bosses and sentries

| Event | Today | Proposal | P |
|---|---|---|---|
| "Coming up on X's sky" | — | a distant low horn on the instruments | P1 |
| Crossing into a boss's sky | **`alarm` (silent — bug)** | a real alarm voice, per boss: warlord harsh and fast, admiral a naval two-tone, queen an organic chitter | **P0** |
| Out of the sky | — | the alarm resolves, one falling note | P2 |
| Warlord calls the pack in | **`alarm` (silent)** | horn + three answering blips from off screen | **P0** |
| Grudge ship returns | **`alarm` (silent)** | the warlord-style alarm with a distinctive "it's back" motif | **P0** |
| Boss hull bar dropping | hits | at 50% and 25% a heavier hit so the fight has acts | P2 |
| Admiral's screen soaks / returns | hit | glassy chime (same family as your Flagship Screen) | P2 |
| Corsair dash | — | the burner voice, filtered by importance | P2 |
| Queen sends a taken ship | — | brood launch voice | P2 |
| Boss killed | `explode` + `win` | a long, layered death (two or three staggered booms), then the discovery phrase | P1 |
| Boss killed by someone else | — | the death only, no discovery phrase | P2 |
| Sentry wakes | — | a servo whine rising to a lock tone, panned | P1 |
| Sentry loses you (running dark, EMP) | — | whine falling | P2 |
| Guarded cache unsealed (guard gone) | — | a latch releasing | P2 |
| Rammed by the warlord | `hit` | heavy collision voice | P2 |

### 7.11 The simulators (Survival, Battle Royale, Campaign)

| Event | Today | Proposal | P |
|---|---|---|---|
| Round start | `start` | keep — it is the one thing `start` should mean | — |
| A wave cleared (Survival) | — | short discovery phrase | P2 |
| Last life / shared reserve at one | — | the critical heartbeat from 7.1 | P2 |
| BR: first hit stays quiet (by design) | `hit` | keep | — |
| BR: a ship eliminated | `explode` | add a short kill-feed tick so you know it was a kill, not a hit | P2 |
| BR: wall starts moving | — | low horn | P2 |
| Campaign: squad order 1/2/3 | `start` | three distinct radio acks, one per order | P2 |
| Campaign: salvage picked up | `start` | per type: patch (weld), shield (hum), rapid (rack), heavy (clunk) | P2 |
| Campaign: enemy ace enters | — | the boss alarm family, shorter | P1 |
| Campaign: hangar bay / shield gen destroyed | `explode` | the subsystem-destroyed voice, heavier than a fighter | P2 |
| Campaign: core exposed | `start` | a rising alarm from the mothership | P2 |
| Campaign: mothership finale (slow motion) | `boom` 5% per frame | **slow the audio with the world**: pitch every sound down by `slowScale`, a long low-passed rumble bed for the 1.4 s, then a huge final boom | P1 |
| Campaign: transport reaches the planet / lost | `win` / `lose` | keep the stings, give them longer phrases | P3 |
| Win / lose screen | `win` / `lose` | keep; they are the stings | — |
| Arcade cabinet booting | — | a CRT power-on thunk + rising whine | P3 |
| Back from the cabinet to the dock | — | station hum fades back in | P3 |

### 7.12 Multiplayer and the front page

| Event | Today | Proposal | P |
|---|---|---|---|
| Front page attract loop | — | **stay silent.** Browsers block autoplay before a gesture anyway, and a front page with "six pieces of text" should not shout | — |
| First keypress / tap (audio unlocks) | — | one soft power-on so the player learns sound exists | P3 |
| Player joins / leaves the lobby | — | soft join / leave blips | P3 |
| Connection lost | — | the warning family | P3 |

---

## 8. Animations that should be synced to sound

Places where the game already draws motion and the sound should follow the drawing,
not just the event:

- **EMP ring** travels to `EMP_REACH` over `EMP_RING_TIME` (0.55 s). Its whump should
  peak as the ring leaves and its crackle should end when the ring stops — the README
  says the ring teaches the radius; let the sound teach the duration.
- **Grapple line** (`surv.grappleTo`, 0.45 s): fire, catch and release on the drawn line.
- **Scan ring** (`surveyHUD.ping`): the returns in 7.4 should land as the ring passes
  each echo, not all at once.
- **Shake** (`addShake`): any shake ≥ 5 should have a low-frequency component in its
  sound; a shake with no bass reads as a camera bug.
- **Burst particles** in a faction's colour: the faction tone family in 7.9 and 7.6 can
  share those colours' identities.
- **Murk dither**: the static loop's density should follow the same depth value that
  drives the shader.
- **The mothership coming apart**: synced with the slow-motion (7.11).
- **Decoy drifting off**: its engine copy panned along its drawn path.

## 9. Music — a recommendation, not a plan

The game has none, and it is not obvious it should. Survey is long and calm, and
BIOMES.md wants regions where nothing happens to *feel* like nothing. The suggestion:

- **No music in Survey by default.** Ambience (7.6) does the job music does elsewhere.
- **One thing worth trying:** a single sparse layer inside a boss's sky, and a
  percussion layer added over it while you are in a fight there — the FTL two-layer
  shape, faded by state.
- **The simulators** are arcade machines; a short loop per cabinet would suit them, and
  being inside a cabinet makes that an in-world sound rather than a score over the game.
- Whatever is built, it gets its own dial and never plays in the Long Empty.

This is Ric's call. It is the one section here that changes what the game *is*.

## 10. Accessibility

- New dials: AMBIENCE, and MUSIC if §9 happens (XAG 105).
- A **mono** switch, because pan carries information here (scan returns, threats).
- Every warning sound in this file already has a visual twin (the warning text, the
  ring, the bar) — keep it that way (XAG 103). Never add a cue that is sound-only.
- Reduced motion turns off the Murk's static loop, as it turns off the grain.
- The heartbeat and alarm loops must stop when the page is paused or hidden.

## 11. Testing

`test/sounds.js` already holds every voice to limits on harshness, hiss and length.
Extend it rather than replacing it:

1. **Every voice called is a voice that exists** — collect every literal
   `gameSound("…")` / `playSfx("…")` across `game/` and fail on one `sfxVoice` does not
   know. That catches §2.1 and every future one.
2. **Loops** get their own limits: no click at start or stop (energy in the first and
   last 5 ms under a threshold), level within the loop steady, and a cap on how many run.
3. **Repeats-a-second** limit (0.2 s) stays for one-shots; loops are exempt by name.
4. **Integrated loudness** of a scripted ten-minute Survey session (mining, a scan
   every 12 s, a fight, a dock) measured roughly against −18 LUFS (§4.8).
5. **sounds/listen.html** gets a scene per new loop and per family, so somebody can
   rate them by ear in plain words, as it does now.

## 12. Order of work

1. **P0** — give `alarm` a voice (three call sites), and the test in §11.1.
2. **Split the overloaded voices** (§2.2): money family (sell / buy / refuse),
   discovery family (almanac / part / cache / station section). No new systems, only
   new voices and changed call sites. Biggest learnability gain for the least code.
3. **The scan as sonar** (7.4) and **gravity warnings** (7.5) — the two instrument sounds
   the mode is built around.
4. **Loop manager** (§6.4), then the **engine**, the **hull-critical heartbeat** and the
   **light drive**.
5. **Device voices** (7.3), Silent Running's duck first.
6. **Importance + distance filter** (§6.2) — fixes friend/foe and busy fights at once.
7. **Docking, landing, respawn, the station chord** (7.7).
8. **Ambience beds** by region (7.6) with the AMBIENCE dial.
9. Interface ticks, campaign finale slow-down, the rest of P2/P3.
10. Music, if Ric wants it (§9).

## Sources

- Game feel — [Wikipedia](https://www.wikipedia.org/wiki/Game_feel) ·
  [Juice it or lose it, summary](https://gamejuice.pages.dev/articles/juice-it-or-lose-it-lessons) ·
  [An incomplete game feel reader](https://brkeogh.com/2017/03/31/an-incomplete-game-feel-reader/)
- Overwatch, *Play by Sound* — [GDC Vault](https://gdcvault.com/play/1023010/Overwatch-The-Elusive-Goal-Play) ·
  [PC Gamer](https://pcgamer.com/how-overwatch-uses-sound-to-pinpoint-threats-you-cant-see) ·
  [Audiokinetic](https://www.audiokinetic.com/ko/blog/overwatch-game-audio-using-wwise-1) ·
  [PCGamesN](https://pcgamesn.com/overwatch/overwatch-devs-on-creating-a-game-you-can-play-by-sound-and-announcing-dolby-atmos-support)
- DICE HDR audio — [Frostbite](https://frostbite.com/frostbite/news/how-hdr-audio-makes-battlefield-bad-company-go-boom) ·
  [Adaptive mixing in Frostbite](https://www.slideshare.net/slideshow/adaptive-mixing-in-frostbite/3128152) ·
  [Designing Sound on HDR in Wwise](https://designingsound.org/2013/06/finding-your-way-with-high-dynamic-range-audio-in-wwise/) ·
  [Battlefield 6 audio](https://www.theesa.com/behind-the-scenes/an-orchestra-of-the-battlefield-inside-the-audio-design-of-battlefield-6-with-mari-saastamoinen-minto/)
- Outer Wilds — [Mobius Digital](https://www.mobiusdigitalgames.com/news/separating-the-signal-from-the-noise) ·
  [Wikipedia](https://wikipedia.com/wiki/Outer_Wilds) ·
  [Family Gaming Database](https://www.familygamingdatabase.com/accessibility/Outer+Wilds)
- Earcons and auditory icons — [Brewster et al., CHI '93](https://www.dcs.gla.ac.uk/~stephen/papers/CHI93.PDF) ·
  [Gaver, Auditory Icons](https://www.ioa.org.uk/system/files/publications/WW%20GAVER%20AUDITORY%20ICONS.pdf)
- No Man's Sky — [GDC Vault](https://gdcvault.com/play/1024067/contactUs) ·
  [Audiokinetic Q&A with Paul Weir](https://www.audiokinetic.com/en/blog/behind-the-sound-of-no-mans-sky-a-qa-with-paul-weir-on-procedural-audio) ·
  [Digital Trends](https://www.digitaltrends.com/?p=1020736) ·
  [Splice](https://splice.com/blog/?p=16269)
- Adaptive music — [Winifred Phillips, GDC 2021](https://www.gamedeveloper.com/game-platforms/hybrid-horizontal-vertical-structure-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-) ·
  [FTL, NPR](https://www.npr.org/2013/10/06/229171039/composing-game-soundtracks-that-move-faster-than-light)
- Sound in space — [Frontier forums](https://forums.frontier.co.uk/threads/the-answer-why-there-is-sound-in-space.239479) ·
  [A Sound Effect on Elite Dangerous](https://www.asoundeffect.com/?p=26142) ·
  [New Space Economy](https://newspaceeconomy.ca/2026/04/16/why-cant-we-hear-sound-in-space.md)
- Loudness — [Designing Sound, Sony's Garry Taylor](https://designingsound.org/2012/07/30/video-games-and-loudness-standards-interview-with-sonys-garry-taylor/) ·
  [Audiokinetic loudness series](https://audiokinetic.com/loudness-processing-best-practices-series-chapter1-loudness-measurement-part1)
- Accessibility — [XAG 105](https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/105) ·
  [XAG 103](https://learn.microsoft.com/en-gb/gaming/accessibility/xbox-accessibility-guidelines/103)

The Overwatch, DICE and No Man's Sky talks are behind the GDC Vault; their details here
come from press coverage and developer interviews, not the recordings. Nobody has
listened to any of the proposals in this file — they are a plan to be tuned in
`sounds/listen.html`, not a finished mix.
