# Survey — biomes as invisible rulesets

**Status: the directive for the biome work.** Ric's note, kept as written. The
region layer that exists in the code today was built *before* this and does not
yet obey it; what has been brought into line is recorded at the foot.

---

## The principle

Biomes should not be named zones the player is warned about. They should be
**invisible rulesets**.

The chart simply stops knowing what kind of space you are in:

```
REGION: UNKNOWN
```

and the player has to learn what that means by being there.

So at 224,000 units out, maybe everything gradually disappears.

No asteroids. No stations. No traffic. No wrecks. No obvious hazards. No
explanation.

You fly for six minutes. Then seven. And there is still nothing.

The player genuinely starts wondering: *"Did the generation break?"*

That is much more interesting, because **the biome itself becomes a discovery**.
Eventually the player works it out: *Oh. This isn't broken. This is a gigantic
region of almost completely empty space.*

And because dying isn't catastrophic in Survey, places like this are allowed to be
genuinely dangerous. The risk isn't "lose your 80-hour save". It's:

> "I probably won't make it home with what I found."

---

## Never tell the player the biome name

One region might contain dense asteroid ribbons. Another might have unusually
strong gravity. Another might be filled with tiny ice bodies that make water
trivial. Another interferes with sensors. Another is mostly enormous open void.

The game does not say `ENTERING VOID BIOME`.

The player eventually recognises: *"Oh shit. This is one of those areas."*

### The giant empty blob specifically

It works **because it is not fun in the normal videogame sense**. That is the
point. Most players wouldn't seek it out constantly. But they'll remember
encountering it.

Especially if there is a tiny possibility of something incredibly valuable inside.

Not a loot chest every ten minutes — that would destroy it. Something more like:
*there is a very small chance that this type of region contains a material,
phenomenon, ship part, structure or object that simply cannot occur anywhere
else.*

So you are six minutes into nothing. You know you are probably burning resources
for no reason. Then suddenly: **a pixel**. Way off your route. And because you
have seen literally nothing for minutes, that one pixel is more exciting than
twenty encounters in normal space.

Now you are deciding: *"Do I have enough water to investigate that?"*

**Protect the rarity fiercely.** If the player learns "empty regions always have
the legendary item somewhere inside", the illusion collapses and it is just a
treasure biome. Most crossings should genuinely produce nothing.

Maybe someone survives an enormous empty region, finds absolutely nothing, dies on
the way back, and later tells their friend: *"Don't go in there. There's fucking
nothing."* Meanwhile that friend's seed has something insanely rare sitting
300,000 units into one.

That's good.

### Unlabelled borders mean players invent the names

You might never call it The Empty. Players might. Someone says *"I found one of
those dead zones past Hallow territory."* Someone else calls them voids. Someone
calls them blackwater.

Eventually the community develops language for structures the game itself never
explicitly categorised.

---

## They are spatial rule-sets, not cosmetics

These aren't "biomes" in the normal cosmetic sense. They are **massive spatial
rule-sets**.

One area can be almost completely empty. Another absurdly dense with debris,
traffic, stations, resources, wrecks, signals. Another can be a giant maze, where
you are constantly choosing passages and getting turned around. Another an
enormous cave network, where open-space flying becomes careful enclosed
navigation. Another a gigantic city-world, where instead of empty interplanetary
space you are flying through layers of structures, traffic, lights, docking areas,
industrial zones, maybe tunnels through the planet itself.

None of them announce themselves. You just notice: *"Wait, space is getting
tighter."* Then eventually: *"Oh shit, this entire region is like this."*

**Every biome must answer: how does this change the way I fly?** Not: what
background art does this use?

| Region | What it tests |
|---|---|
| Empty | endurance and navigation; virtually nothing there |
| Dense | reaction time and route choice; stuff everywhere |
| Maze | navigation and memory; many paths, dead ends, shortcuts |
| Cave | precision flying; confined spaces and limited exits |
| City-world | traffic, navigation, infrastructure; extremely high activity |
| Gravity | slingshots and trajectory planning dominate |
| Ice-rich | water becomes abundant, changing range constraints |
| Sensor-distortion | you navigate visually or on partial information |
| Wormhole-heavy | topology gets weird; conventional distance matters less |
| War-torn | geography physically shaped by wrecks, patrols, blockades, abandoned stations |

## Why this makes the four slots matter

Survey's gear is about choosing **how you travel**, so these immediately give
equipment meaning.

A build that is amazing in the Empty might be miserable inside the caves. A
hyper-fast ship could be incredible across open void and terrifying to control
inside a maze. A huge cargo vessel might dominate the city regions and physically
struggle through narrow spaces. A scanner build might be fantastic in dense
clutter and unreliable in a distorted region.

Now the question stops being *"what is the best ship?"* and becomes:

> **"Where am I going?"**

## The city-world

If the scale is handled carefully this is a holy-shit moment. Someone has spent
ten hours seeing stars, planets, stations and sparse settlements. Then they travel
far enough and start seeing lights. More lights. Then structures. Then traffic.
Then they realise: **the entire planet is urbanised.**

No cutscene explains it. The scale does the work.

## What this gives Survey that it needs

**Visual memories.** Players should be able to remember a trip by geography:

> "That's when I crossed the empty region."
> "I lost that ship inside the caves."
> "I found the weird module in the maze."
> "The civil war happened around the city-world."

The map stops being coordinates and becomes **places**. And because the borders
are not labelled, the player learns the galaxy by experience rather than by
reading a biome map.

**Biomes are enormous changes in how space behaves, not themes painted onto the
same gameplay.** Executed that way, they are plausibly the thing that turns long
peaceful flights from "boring" into *"I wonder what kind of space I'm entering
next."*

---

# What is built, and what this directive changed  ·  *my note, not Ric's*

## Built before this note, and since brought into line

A region layer exists: a **pure function of position**, like the danger band, so
nothing is stored, nothing can desync, a chunk stays a pure function of its
coordinates, and flying away and back finds the same place. Regions are a Voronoi
diagram over jittered sites, so borders are irregular rather than a chessboard.
Each one multiplies the world's own abundances — the world says what kind of world
it is, the region says what kind of *here* this is — and sets the rock silhouette
(angular, smooth, or ordinary) and how much rock there is at all.

**What this note changed:** the first version named them. The panel read
`SHARD FIELD` and the chart washed itself in region colours with the names
written across them. That is exactly the Minecraft-biome-label failure this
document is about, so it is gone. The panel reads `REGION — UNKNOWN`; the chart
says nothing at all. What you charted is the only record of where you have been,
and an empty region reads as empty on it because there is nothing in it.

## THE WARRENS — a region you fly *inside*

Every other region is a rule about what space contains. This one is a rule about
the shape of the space itself: it is made of rock, and what you do in it is
thread passages. Almost nothing else is allowed in — a world inside a cave makes
no sense, a station in one has nobody to trade with, an asteroid field is rock
inside rock. What it has instead is what you would actually hide in a cave:
caches, and the ships that did not get out.

**Rock is everywhere and the passage is the hole.** That sentence is the whole
design and it took three attempts to arrive at, because the first two had it
backwards — open space by default with masses of rock in it. However that was
shaded, it came out as *bubbles*, and no drawing could fix it: a field of
separate blobs seen from outside is a field of blobs. The player was never
inside anything.

### How a cave can be built a chunk at a time

Chunks are 2,600 units, built independently from `(seed, cx, cy)` with no
knowledge of their neighbours, so nothing can be carved by walking a path and
remembering where it has been. The network is a **lattice** instead: a node per
coarse cell at a hashed position, joined to the node east of it and, more often
than not, the node south of it. Every link bows to a hashed side, so passages
curve rather than running straight. Any point can ask which links might reach it
by looking at the nine nodes around it, and two chunks either side of a line get
the same answer because they are asking about the same nodes.

Because the passages *are* the open space and the lattice is connected by
construction, the region is explorable by definition — measured at 99.7%
of open space reachable from outside, against 78% when it was noise alone.

### Why there is no circle in it anywhere

"Inside a passage" started as *distance to the centreline is less than the bore*.
That makes a **tube**: a constant cross-section, two walls that are mirror images
of each other, and ends that are literally circles. It is the shape of a pipe.

The boundary is displaced by noise sampled **in the world** rather than along the
passage, so a point on the left wall and the point opposite it ask different
places and get different answers. The walls stop agreeing — one bulges into an
alcove while the other runs straight past it — which is what the inside of a cave
actually looks like.

And the wall is **traced, not stamped**. Marching squares over the field, drawn
as straight segments and flat polygons. Drawing rock as a union of discs gives a
scalloped boundary at any scale; stroking a polyline gives round caps. Both are
circles, and circles were the complaint.

The width varies along a passage — a squeeze you have to line up for at 190
units across, an ordinary run, and one node in seven opening into a chamber
twelve hundred across. Each node carries its own bore and its own roughness, so
some stretches are clean curves and others are bitten into.

### The one thing that can never happen

A hull dropped inside a mass cannot fly out of it: collision pushes it off each
disc in turn and there is always another one behind. Measured before it was
fixed — nine hundred units deep, three seconds of collision moved it
ninety-three. Every teleport in the game now goes through `outOfRock`, and there
is a catch-all in the collision pass besides, because it is the one failure
nobody can play their way out of.

## What a region looks like

Nothing about a region is ever said. What some of them do is *look* slightly
different, which is a different thing from a label: a tint is something you
notice and then have to work out, where a name is something you read.

Four of these were here before the fifth was added, and it is worth listing them
together because the rule they follow is the same — **the visual reinforces a
mechanical fact rather than decorating a name.**

| | what you see | the fact underneath |
|---|---|---|
| **the Rime** | the asteroids are pale blue | they are ice, and a melter turns them into range |
| **the Murk** | static across the interface, heavier the further in you go | the scan is down to a tenth: the instrument is what should look broken |
| **the Violet Cloud** | nebulae everywhere | it is thick, and you can see about half as far |
| **the Belt, Shards, Rounds** | rocks are lumpy, sharp or round | three different mining grounds |
| **the Long Empty** | the starfield itself thins out | the one region where even the backdrop has nothing to offer |

And a **tint on the starfield** for six of them — the Rime pale blue, the Cloud
violet, the Murk grey, the Works gold, the Boneyard cold grey, the Long Empty
dull. A third of the region's colour at the middle of a patch, faded in by
`regionDepth` so it arrives over a few thousand units instead of switching on
across a line.

Small on purpose. This must never become a label: a sky you could read a name
off is the Minecraft biome banner in a different font, and the whole design is
that you learn what somewhere is by being in it.

**And the naming mechanism already exists**: pins. A player can drop one, colour
it, and name it whatever they like — "dead zone", "blackwater". That is the
feature this document asks for and it shipped before the document existed.

**Thirteen kinds, and ordinary space is the commonest.** A region cell is
**93,000 units** across, which measures out at about **100,000 across a patch**
and three minutes to cross one.

It has been three numbers, and the history is the argument:

- **31,200 — a minute.** A minute of anything is a stretch of scenery, not a
  place, and certainly not somewhere you start wondering whether the generator
  has broken.
- **200,000 — six minutes.** Sized from five-to-twenty minutes at cruise, which
  is 170,000 to 690,000 units. It made a patch unmistakably a place. It also
  made a sector *monotonous at the scale anybody plays it*, and that only became
  visible once `test/biomes.js` measured one instead of trusting the arithmetic:
  a run out to the abyssal boundary passed through six to nine of the thirteen
  kinds, four of them had no example inside 700,000 units, and the first two
  hundred thousand of every world were one thing.
- **93,000 — three minutes**, which is what is here. Long enough that a patch is
  still a place; short enough that the thing biomes exist for — noticing the
  rules changed — happens more than a handful of times in a run.

What that bought, measured on one sector across seventy-two bearings: the median
distance before the rules change for the first time fell to **33,000 units**,
which is just outside the home bubble, and fifty-one of seventy-two bearings meet
something that is not ordinary space inside 100,000. Inside the abyssal boundary
a run now meets **eleven to thirteen** of the thirteen kinds rather than six to
nine.

The home bubble is a fixed **30,000 units** of guaranteed ordinary space and is
no longer a fraction of the cell. The two numbers answer different questions —
one is "how far does the opening need to be predictable for", the other is "how
big is a place" — and tying them together meant shrinking the patches silently
halved the opening as a side effect. 30,000 covers the Home and Open bands,
which is where the opening happens and where the first two yard parts are.

Measured over twelve thousand sites across six sectors:

| | |
|---|---|
| **ordinary space** | **35%** — and it has to be the commonest, or none of the rest reads as unusual |
| belt, settled reach, cloud, shards, wells, lanes, boneyard, murk, rime, rounds | 5–10% each |
| **the city** | **1.8%** |
| **the Empty** | **1.2%** |

The two rare ones are the two rarest, which is the whole of Ric's instruction.

**And the Empty is empty.** Not "almost" — the first version was a set of small
multipliers, 0.04 of the rock and a twentieth of the traffic, which is a thin
scattering of everything rather than an absence, and a thin scattering reads as an
ordinary quiet stretch. `nothing: true` is a hard switch on the region rather than
a multiplier, because a floor elsewhere in the generator can quietly turn a zero
back into a trickle — two of them already did, since the well roll and the gate
roll both clamp abundance to a minimum so that a "SEALED" world still has gates.
Nothing multiplied by anything is still something when somebody puts a `Math.max`
in the way.

Measured: **zero objects in the entire streamed sector** — rocks, wells, worlds,
stations, traffic, hulks, caches, clouds, fields, gates, wrecks, sentries — across
forty seconds of flat-out flying. The landmarks are deliberately outside the
switch: an authored thing alone in an ocean of nothing is the best possible use of
an ocean of nothing.

**Two of them change a rule rather than a quantity**, which is the test this
document sets — and both **deepen toward the middle** rather than switching on at a
line. A rule that steps at a border is a rule you can see the edge of; one that
deepens is one you notice happening to you.

**The murk** cuts the scan from ordinary at its border to **a tenth of normal at
its middle** — 307 units, which is not scanning, it is confirming something is
directly in front of you. And the *interface* goes wrong with it, because the
interface is the instrument being interfered with: grain over the whole screen,
thicker the deeper in you are, with the occasional horizontal tear. At the worst
of one it is most of what you can see. `reduceMotion` turns the noise off and
leaves the rule, because flickering static across a whole screen is exactly what
that setting is for.

**The rime** is small ice bodies as far as the scan reaches and almost nothing
else — no wrecks worth the name, few worlds, hardly anybody living there. Every
rock in it is drawn ice-blue, so what it is made of is a fact about the window
rather than something you learn from the hold. Water is the thing that decides how
far you can go, so a ship with a melter can treat it as somewhere to refill rather
than somewhere to cross.

**And the scan is a decision again.** It recharged in nine seconds, which is a
button rather than a choice; it is twelve now. The thirty per cent is buyable back
— the **COOLANT LOOP** takes one of your four slots to restore the old rate, which
is exactly the question the slots exist to ask.

## Not built

Everything that changes the *shape* of space rather than its contents: maze, cave,
city-world, sensor distortion, wormhole-heavy, war-torn. Those need generators
that build structure rather than scatter objects — the `wall()` primitive the
Leviathan and the Vault share is the start of that machinery and is why the second
enterable place cost an afternoon rather than a week.

And the thing the Empty exists for: the very small chance of something that can
occur nowhere else. That is 6.6 — authored, rare, and it must stay rare or the
Empty becomes a treasure biome and the whole effect collapses.
