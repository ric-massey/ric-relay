# KONDRITE — music

**Status:** a proposal, written 2026-11-13 and revised the same day. Nothing in it is
built. It answers Ric's question, *"What type of music would be good for this game?"*

**The revision.** The first version recommended rare music with long silences, on the
argument that Minecraft does it. Ric: *"Minecraft plays almost all the time. Most games
like this the music is constant with few pauses. Do your research on music in video
games."* The research (§3) bears him out. Minecraft's default does leave 10–20 minutes
between tracks, but players wanted more badly enough that Mojang added a Constant setting
in 2025. Music measurably raises immersion, and what makes players turn it off is
repetition, not how often it plays. So this version recommends **near-constant music,
built so it doesn't wear out.**

**Read with:** `SOUND-DESIGN.md`. Music sits inside that design: ultra realistic,
nothing speaks, regions noticed and never named, and warnings come first.

## Contents

1. [The short answer](#1-the-short-answer)
2. [What this game asks of music](#2-what-this-game-asks-of-music)
3. [What the research says](#3-what-the-research-says)
4. [The options](#4-the-options)
5. [The recommendation](#5-the-recommendation)
6. [The sound of it](#6-the-sound-of-it)
7. [When it plays](#7-when-it-plays)
8. [Keeping constant music from wearing out](#8-keeping-constant-music-from-wearing-out)
9. [Where the music comes from](#9-where-the-music-comes-from)
10. [Questions for Ric](#10-questions-for-ric)
11. [Sources](#11-sources)

---

## 1. The short answer

**A near-constant, adaptive ambient score, made from real instruments and old analogue
synthesizers, that follows what you are doing and where you are, built around one
melody that belongs to your station.**

- **Almost always playing**, with short breaths between pieces, the way most games in
  this genre do it and players ask for.
- **Adaptive in layers:** calm when you are flying, a pulse and percussion when
  something is shooting at you, fuller when you come home.
- **Shaded by where you are,** the way the starfield is tinted, without ever becoming a
  region's named theme.
- **About getting home:** your station's theme is as broken as the station, and gains an
  instrument with each part you bring home. Fragments of it run through everything else.

The mood: Brian Eno's *Apollo*, the organ of *Interstellar*, the home-made warmth of
*Outer Wilds*, and the endless, responsive score of *No Man's Sky*. Not epic trailer
orchestra, not EDM, and chiptune only in the arcade cabinets.

---

## 2. What this game asks of music

| What the game is | What that asks of the music |
|---|---|
| **Long.** A sector is hours | music that plays most of the time will be heard for hours, so it needs a lot of material and must not loop audibly (§8) |
| **Mostly calm, occasionally deadly.** Nothing hunts you, but guarded caches, bosses' skies and hunters do | a calm base that can turn tense quickly, without a cut |
| **About going and coming back.** Ric: "This is seeming somewhat like an extraction shooter in space." | the nerve of a long haul home with a full hold is the feeling to support |
| **Regions are noticed, never named** (BIOMES.md) | music may *shade* with a region, but a distinct region theme would be a label (§5.3) |
| **The station is broken and you fix it** | the strongest arc in the game, and the one music can carry best |
| **Ultra realistic sound, no tunes as feedback, nothing speaks** (SOUND-DESIGN.md) | music is never a reward jingle; no lyrics |
| **Warnings follow one ladder** (SOUND-DESIGN.md §5) | music always gets out of the way of a warning |
| **The simulators are arcade cabinets** | the one place for arcade music |
| **A browser game, often on phone speakers** | music must work quietly on small speakers, and stream |

---

## 3. What the research says

### 3.1 How often games like this play music

| Game | How much music | What it shows |
|---|---|---|
| **Minecraft** | default: a random 10–20 minutes between tracks. Players built mods to remove the gap ("Infinite Music", "Constant Music"), and in 2025 (Java 1.21.6) Mojang added a **Music Frequency** setting: Default, Frequent (about half the gap) and Constant (the next track almost at once) | the sparse default is Mojang's choice; **many players want it nearly constant**, and the answer was a setting |
| **Stardew Valley** | seasonal songs play at random with ambient sound between them; players asked for a loop button, and a mod makes it loop | the same pull toward more music |
| **No Man's Sky** | a generative score (Pulse, built from 65daysofstatic's material) that is effectively always there, "less full on" while you wander, plus scripted songs at set moments | **continuous music made bearable by never repeating** |
| **FTL** | music in every sector, two layers per piece: a calm one, and percussion added for a fight | continuous and adaptive with very little material |
| **Starfield, Elite Dangerous** | adaptive scores that move between exploration, combat, travel and stations; Starfield's runs to almost five hours | big games solve "constant" with a lot of music and state changes |
| **Subnautica** | tracks triggered by entering biomes and places, about 1 h 40 min of music in all | music tied to place, chosen at random |
| **Outer Wilds** | mostly silence and ambience in flight, music for moments | the exception, and a story game measured in minutes per loop, not hours |

**So the norm for this kind of game is music most of the time,** made to change with the
situation. Long silence is the exception, and where a game defaults to it, players have
pushed back.

### 3.2 What music does for players

- **It raises immersion.** In one study, players' immersion scores averaged 98.6 out of
  130 with music and 83.3 without (Evans, Durham).
- **It changes how time feels.** Music made a game's play time feel shorter, without
  changing how long players remembered it lasting (Sanders and Cairns, UCL).
- **Liked music raises engagement; disliked music lowers it.** That makes the quality
  and fit of the music matter more than its quantity.
- **Energetic music can cost performance.** One study found energetic music could raise
  immersion and lower scores. That is an argument for calm music during exploration and
  restrained music in fights.

### 3.3 Why players turn music off

- **Repetition** is among the top reasons players give for turning off game music: about
  28–30% in an ACM study of players' audio habits (Rogers et al.). An earlier, smaller
  survey (173 people) found 64% sometimes turn game music off, citing repetition and too
  little material.
- The other big reasons are **preferring their own music** and **doing something else at
  the same time**. A volume dial and an off switch answer those.

### 3.4 How composers keep continuous music fresh

- **Long pieces:** advice attributed to Winifred Phillips is that a piece should run about
  five minutes before it loops, to avoid ear fatigue.
- **Hide the loop:** a loop should be written so the listener doesn't notice where it
  starts again.
- **Layers and sections:** vertical layering (stems faded in and out) and horizontal
  resequencing (sections chosen at bar lines) let a small library sound much larger.
- **A "bored now" switch:** some games fade the music out after a piece has repeated too
  many times, so the player never hears it wear out (described from Karen Collins's
  *Game Sound*, secondhand).
- **Generative recombination:** No Man's Sky's approach, rebuilding music from parts so it
  never plays the same way twice.

---

## 4. The options

| Option | What it is | For | Against |
|---|---|---|---|
| **A. Sparse cues** (the first version) | music at long gaps | each piece lands | against the genre's norm and what players ask for; Ric doesn't want it |
| **B. Looping tracks** | a track per state, looped | simple | repetition: the top reason players mute game music |
| **C. Adaptive layered score** | near-constant music in stems, mixed by the game's state, with a large pool of pieces | the genre's norm done well; responsive; resists repetition | needs a real amount of composed material |
| **D. Generative** | music rebuilt from parts live | never repeats | hardest to make sound good; an option, not a requirement |
| **E. Music in the world only** | stations' radios, the cabinets | realism | absent from flight, where most of the game is |

**Recommendation: C, with E inside it.** An adaptive, layered score that plays nearly all
the time, plus station radios and cabinets as music inside the world. D stays available
later as a way to stretch the material.

---

## 5. The recommendation

### 5.1 How the score is built: layers

Every exploration piece is written in **stems** that the game mixes live:

| Layer | What it is | When it plays |
|---|---|---|
| **Bed** | slow pads and drones; the harmony | almost always |
| **Melody** | a solo, human instrument: piano, guitar, cello | most of the time, resting now and then |
| **Colour** | the region's shading (§5.3) | faded in by `regionDepth`, as the starfield tint is |
| **Pulse** | a low, felt rhythm | when something is hostile and near |
| **Percussion** | real drums and struck metal, held back | when something is aimed at you |
| **Home** | instruments from the station theme (§5.2) | as many as you have restored |

Between pieces there is a **short breath** of ambience, tens of seconds rather than
minutes, so the sector's own sounds are heard between pieces without the music
disappearing.

### 5.2 The station theme: music that is repaired

One melody belongs to **your station**, and it is incomplete in the same way the station
is. Each of the six parts adds one voice, in the order the README lists them:

| Station | What you hear in the theme |
|---|---|
| **Dead** (the start) | one instrument, alone and a little worn: an old upright piano or a guitar, as if from a radio somewhere aboard |
| + Drive spar (the dock) | a low cello |
| + Fusion core (the counter) | a warm analogue-synth pad: the power coming back |
| + Ranging lens (the market) | a second, answering line |
| + Jump coil (the hangar) | a slow pulse: the station has a heartbeat again |
| + Signal beacon (stock) | the melody carried further: bowed metal or high strings |
| + Ablative plate (the mouth) | the pipe organ, and everything together |
| **THE STATION IS WHOLE** | the full arrangement, as the banner says "now go somewhere you have not been" |

Why it is the spine of the score:

- **It is the game's story, told without a word.** SOUND-DESIGN.md has the station's
  machinery coming alive part by part (§4.3 there); the theme does the same in music.
- **It runs through everything.** The exploration pieces are written from its melody and
  harmony, and the **Home** layer carries the instruments you have restored. Early on the
  whole score is thin and lonely; by the end it is full. Your progress is audible
  everywhere, not only at the station.
- **It plays in full when you dock at home**, in whatever state the station is in.
- **Death and respawn.** The death page is silent, as the sound design says. On respawn,
  the theme's first instrument plays alone: you are home, and you lost something.

### 5.3 Regions: shading, never a theme

Games like Subnautica and Terraria give each biome its own music. Here that would be a
label, which BIOMES.md forbids. But the music can still answer the place, the way the
starfield tint does: **the Colour layer shades the music by region, faded in by
`regionDepth`**, so it changes over thousands of units and never at a line.

| Region | Shading of the Colour layer |
|---|---|
| Ordinary space, Settled reach | none; the score as written |
| The Belt, Shards, Rounds | low, struck textures: stone, and wood for the Rounds |
| The Rime | high, glassy textures: bowed glass, crystal |
| The Violet Cloud | softer, more blurred; long reverb |
| The Murk | the music itself degrades: tape wear, dropouts and static, deepening toward the middle, as the screen does |
| The Boneyard | cold metal: bowed and struck steel |
| The Wells | deeper; the bed drops an octave |
| The Warrens | closer and drier; the melody alone |
| The Lanes, the Works | busier pulse, a mechanical rhythm |
| **The Long Empty** | **the score thins to its last layer:** one sustained tone, or a single instrument, then that too. The emptiness is felt as everything else falling away (§10) |

The same piece heard in two regions should sound like the same piece in two different
places. Nobody should be able to name a region from its music; they should feel it change.

### 5.4 Danger

- **The Pulse and Percussion layers** (§5.1) bring tension in without a cut, from the
  piece already playing. That is FTL's two-layer idea, held back so the guns stay the
  action. It follows the sound design's sensor feed: hostile and near brings the pulse;
  aimed at you brings the percussion.
- **Bosses.** Each of the five bosses has a motif on its own instrument that takes over
  the Melody layer inside its sky, matching SOUND-DESIGN.md §4.7:

| Boss | Motif |
|---|---|
| Warlord | a distorted, ragged figure, like a broadcast on every channel |
| Admiral | low brass, disciplined and naval |
| Queen | strings played with the wood of the bow, insect-like |
| Corsair | a fast, rising figure that rips past |
| Warden | a doubled figure, twice, like its paired missiles |

- **At the Warning level, music drops to its bed** under the master warning, and comes back
  when the warning ends. Nothing competes with the warning.

### 5.5 Moments

A few moments get music written for them, played over the score:

| Moment | |
|---|---|
| Leaving the home bubble for the first time | the game opening up |
| First sight of each landmark on the almanac's ladder | the payoff for going far |
| THE STATION IS WHOLE | the station theme in full (§5.2) |
| THE COIL FIRED | the score torn apart, then something unfamiliar |
| A boss destroyed | its motif broken off |
| The light drive on a long run | the one place the score can be big |

### 5.6 Music in the world: station radios

Docked at a station that isn't yours, the score gives way to **that station's own music**,
a radio playing inside it, heard through the docking collar. Each power sounds like
itself (SOUND-DESIGN.md §4.5):

| Power | Its stations' radio |
|---|---|
| **The Cordon** | a military band: brass and snare, orderly |
| **The Hallow Line** | old music: folk and early classical recordings, warm and worn |
| **Morrow Compact** | smooth, polished, corporate: lounge and light jazz |
| **Unaligned** | anything, a little of everything |
| **No Colours** (pirate stations) | rough, distorted, played too loud |

### 5.7 The simulators and the front page

- **The cabinets** play arcade music, chiptune-style, through the cabinet's speaker
  (SOUND-DESIGN.md §8.15).
- **The front page** is silent until the first key press, which a browser requires anyway.
  After that, the station theme's first instrument plays under it: the game's identity
  in one instrument (§10).

---

## 6. The sound of it

### 6.1 Instruments

| Use | Instruments | Why |
|---|---|---|
| The human side | upright piano, acoustic guitar, cello, bowed metal | real, slightly worn, close: the pilot and home |
| The vast side | pipe organ, analogue synth pads and drones | Interstellar's organ and Apollo's synths: space as enormous and physical |
| Tension | real drums, struck metal, a low pulse | real hits, not programmed loops, so the score stays as physical as the sound |
| Texture | tape wear, a little noise, room sound | recorded, not rendered: it should sound played |

### 6.2 What to avoid

- **Epic trailer orchestra**, the space-game default, which would fight a mostly calm game.
- **Beat-driven electronic music and EDM**, which become wallpaper within an hour.
- **Chiptune**, except in the cabinets.
- **Lyrics and voices.** Nothing speaks in this game; a wordless choir is a question (§10).
- **Anything that announces itself as a loop:** a big ending, a fade, then the same opening.

### 6.3 What to listen to

References for the mood, not music to use: Brian Eno, *Apollo: Atmospheres and
Soundtracks* · Hans Zimmer, *Interstellar* · 65daysofstatic, *No Man's Sky: Music for an
Infinite Universe* · Andrew Prahlow, *Outer Wilds* · Ben Prunty, *FTL* · Inon Zur,
*Starfield* · C418, *Minecraft – Volume Alpha* · Paul Ruskay, *Homeworld*.

---

## 7. When it plays

### 7.1 Against the sound design's snapshots

| Snapshot (SOUND-DESIGN.md §6.1) | Music |
|---|---|
| Flight | the score: bed, melody, colour, home |
| Combat | pulse and percussion added; melody pulled back |
| Critical (hull at zero, a tank out) | the bed only, low and tense |
| Light drive | fuller; a written moment on a long run |
| Silent Running | the bed only, almost nothing: the point is quiet |
| Docked | the station theme at home; the station's radio elsewhere |
| A page open | the score, distant and muffled |
| Dead | silence, then the station theme's first instrument |

### 7.2 Always

- **At a Warning, the bed only** (SOUND-DESIGN.md §5); under a Caution, music ducks.
- **Under the foreground.** Music never masks a sound that matters.
- **Fades, never cuts,** except the drop for a Warning, which is immediate.

### 7.3 Settings

Mojang's answer to players who wanted more or less music was a setting, and it is the
right one here:

| Setting | |
|---|---|
| **MUSIC** volume dial | its own channel (XAG 105) |
| **Music frequency** | **Constant** (no breaths between pieces) · **Normal** (the default: short breaths, §5.1) · **Sparse** (minutes between pieces, for players who want the sector's own sound) · **Off** |

---

## 8. Keeping constant music from wearing out

Repetition is the main reason players turn game music off (§3.3), and this game is long.
Everything here is aimed at that:

- **Enough music.** For a start, about **60–90 minutes** of exploration material in stems,
  plus the station theme, the danger layers, the five boss motifs and the written moments.
  For scale: Subnautica's whole score is about 1 h 40 min; Starfield's is almost five hours.
- **Long pieces:** about five minutes or more before any repeat.
- **Layers multiply it.** The same piece with and without its melody, shaded by region,
  with different home instruments, sounds like different music.
- **Shuffle without repeats.** No piece plays again until most of the pool has played.
- **A "bored now" rule.** If the same piece would play too often, for example in one long
  fight, the game drops to the bed instead of looping it.
- **The station theme changes over the game**, so the core of the score sounds different at
  hour five from hour one.
- **Generative recombination later, if needed** (No Man's Sky): an option, not a requirement.

---

## 9. Where the music comes from

Top-tier music here has to be **written for this game**: the station theme must be
arranged six ways and woven through every piece, and the stems must be made to layer.
Stock tracks can't do that.

| Part | Source |
|---|---|
| **The score:** station theme, exploration pieces in stems, danger layers, boss motifs, moments | original: composed by Ric, a friend, or a commissioned composer. This is the heart of it, and the part worth paying for or making |
| **Station radios** | free, credited recordings: public-domain recordings for the Hallow Line's old music, and CC0 or CC BY tracks for the rest, from libraries such as OpenGameArt (filtered to CC0) and the Free Music Archive. A public-domain *composition* is not the same as a public-domain *recording*: each recording's licence has to be checked |
| **Cabinets** | CC0 chiptune (such as Kenney's music packs or OpenGameArt) or original |

The same rules as for sound:

- **Every track credited** in `sounds/SOURCES.md` with its licence; CC BY needs the
  credit shown in the game too.
- **No AI-generated music.**
- **Streamed from R2**, like the photographs and ambience beds. Music is roughly a
  megabyte a minute compressed, so 90 minutes of stems is far too much to commit, and a
  failed load means silence, never an error.

---

## 10. Questions for Ric

1. **Does the station theme work for you?** One melody that grows an instrument per part
   and runs through the whole score.
2. **Who writes it?** You, a friend, or a commissioned composer? This decides the most.
3. **The default frequency:** Normal (short breaths between pieces) or Constant?
4. **The Long Empty:** should the music thin away to nothing there (recommended, so the
   emptiness is felt), or keep playing?
5. **Station radios:** yes or no?
6. **A wordless choir:** allowed, or kept out with all voices?

---

## 11. Sources

- **Minecraft:** the Music Frequency setting (Default 10–20 min, Frequent, Constant),
  added in 1.21.6; mods that remove the gap; the music's design.
  [Minecraft Wiki, Options](https://minecraft.wiki/w/Options#Video_Settings) ·
  [Minecraft Wiki, options.txt](https://minecraft.wiki/w/Options.txt_(Java_Edition)) ·
  [Constant Music (CurseForge)](https://www.curseforge.com/minecraft/mc-mods/constant-music) ·
  [Infinite Music (Modrinth)](https://modrinth.com/mod/infinite-music) ·
  [Music of Minecraft](https://en.wikipedia.org/wiki/Music_of_Minecraft) ·
  [Kill Screen](https://www.killscreen.com/quiet-importance-minecraft-soundtrack/)
- **Stardew Valley:** seasonal songs at random with ambience between; players asking for a
  loop. [Dev Update #16](https://stardewvalley.net/dev-update-16/) ·
  [Steam discussion](https://steamcommunity.com/app/413150/discussions/0/405692758715197154) ·
  [Nexus mod](https://www.nexusmods.com/stardewvalley/mods/13099) ·
  [Final Boss](https://finalboss.io/stardew-valleys-music-quietly-ruined-other-cozy-games)
- **No Man's Sky:** a generative score from 65daysofstatic's material, responsive to play.
  [DIY](https://diymag.com/news/65daysofstatic-on-how-they-created-an-infinite-soundtrack) ·
  [Game Informer](https://gameinformer.com/b/features/archive/2016/05/30/65daysofstatic-on-creating-no-man-39-s-sky-generative-soundtrack) ·
  [IBTimes](https://www.ibtimes.co.uk/why-65daysofstatics-infinite-no-man-sky-soundtrack-one-theyll-never-truly-hear-1575503) ·
  [Audiokinetic Q&A with Paul Weir](https://www.audiokinetic.com/en/blog/behind-the-sound-of-no-mans-sky-a-qa-with-paul-weir-on-procedural-audio)
- **FTL:** two layers, percussion for fights.
  [NPR](https://www.npr.org/2013/10/06/229171039/composing-game-soundtracks-that-move-faster-than-light)
- **Starfield and Elite Dangerous:** adaptive scores; Starfield's almost five hours.
  [Starfield Wiki](https://starfieldwiki.net/wiki/Music) ·
  [A2Z Soundtrack](https://a2zsoundtrack.com/starfield-soundtrack-2023-video-game) ·
  [Elite Dangerous](https://en.wikipedia.com/wiki/Elite_Dangerous) ·
  [Massively OP](https://massivelyop.com/2015/05/12/jukebox-heroes-how-elite-dangerous-music-put-me-into-a-mild-coma/)
- **Subnautica:** music by place, about 1 h 40 min in all (fan wiki and forum).
  [Subnautica OST wiki](https://subnautica.fandom.com/wiki/Subnautica_OST) ·
  [Unknown Worlds forum](https://forums.unknownworlds.com/discussion/comment/2397436)
- **Outer Wilds:** mostly silence in flight, music for moments.
  [Needledrop](https://betweenmusicandgaming.substack.com/p/needledrop-outer-wilds) ·
  [Prima Games](https://primagames.com/feature/developing-music-outer-wilds-interview-composer-andrew-prahlow) ·
  [SPIN](https://www.spinmagazine.com/2020/06/outer-wilds-andrew-prahlow/)
- **Music and immersion, time and performance.**
  [Evans, Durham](https://musicscience.net/wp-content/uploads/2018/10/evans.pdf) ·
  [Sanders and Cairns, UCL](https://www.researchgate.net/publication/221437012_Time_perception_immersion_and_music_in_videogames) ·
  [Background music and immersion](https://www.researchgate.net/publication/282410867_The_Influence_of_Background_Music_of_Video_Games_on_Immersion) ·
  [Energetic music](https://ceur-ws.org/Vol-3866/paper5.pdf)
- **Why players turn music off.**
  [Rogers et al., ACM](https://dl.acm.org/doi/pdf/10.1145/3356590.3356599) ·
  [Bleeps and Pops survey](https://bleepsandpops.com/post/7462404775/survey-turning-off-game-music)
- **Keeping loops fresh.**
  [Audient, on Phillips](https://audient.com/hi/tutorial/composing-music-video-games/) ·
  [FH Wedel seminar paper](https://intern.fh-wedel.de/fileadmin/mitarbeiter/iw/Lehrveranstaltungen/2019WS/Seminar/Ausarbeitung11_Stobbe.pdf) ·
  [Game Developer, rethinking the audio loop](https://gamedeveloper.com/audio/rethinking-the-audio-loop-in-games) ·
  [Game Developer, Winifred Phillips GDC 2021](https://www.gamedeveloper.com/game-platforms/hybrid-horizontal-vertical-structure-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-) ·
  [Collins, *Game Sound* (MIT Press)](https://www.penguinrandomhouse.com/books/655117/game-sound-by-karen-collins/) ·
  [Southampton, on the "bored now" switch](https://generic.wordpress.soton.ac.uk/archaeology/2013/08/15/non-linear-sound-in-video-games)
- **The mood references.**
  [Apollo](https://en.wikipedia.org/wiki/Apollo:_Atmospheres_and_Soundtracks) ·
  [Interstellar](https://en.wikipedia.org/wiki/Interstellar_(soundtrack)) ·
  [Homeworld, Paul Ruskay](https://en.wikipedia.org/wiki/Paul_Ruskay) ·
  [Outer Wilds, Game Developer](https://www.gamedeveloper.com/audio/everything-but-lost-exploring-the-mesmerising-musical-legacy-of-outer-wilds)
- **Free music and licences.**
  [Cinevva](https://app.cinevva.com/guides/free-sound-effects-music) ·
  [GTStu](https://gtstu.com/free-royalty-free-music-indie-games/) ·
  [itch.io libre audio](https://itch.io/c/1078725/libre-audio) ·
  [OpenGameArt](https://opengameart.org/comment/95008)

Some figures come from single or secondary sources and say so above: the five-minute loop
advice is attributed to Phillips by a tutorial, the "bored now" switch is described
secondhand, and Subnautica's total is from a fan wiki. Nobody has written or heard any of
this music yet.
