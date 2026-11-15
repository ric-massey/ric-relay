# People simulator — the to-do list

Made 2026-11-14 at Ric's request: "make a list in order of what needs to get done. make sure
before each one is done research goes into it to see the best way to do it is. efficiency is
importnat for the program. and after bugs need to be looked for in the new code. and when its
done it needs to be checked off. … anytime i want to work on it i can say work on 1. it does it
then i can hand it to another llm to say work on2 and it does."

This file is the order of work for the People sandbox (`people.js`, the People half of
`index.html`). The Physics sandbox and the Lab are not on it.

**When Ric says "work on N", do item N below, the whole way through "How to do an item".**
One item per session. Do not start an item whose earlier items are unticked unless Ric says to.

## Read these first, every time

1. `/AGENTS.md` — the site's rules, and the long World Builder paragraph in it.
2. `PEOPLE-VISION.md`, the section **"2026-11-14 — The simulator, whole"** — what Ric wants, in
   his words, what was measured, and the fuller list each item here was cut from.
3. `README.md` in this folder, for the part of the engine the item touches.
4. This file's **Rules for every item** and **Speed log**.

## What this is, in five lines

A simulator of people: choose settings, press start, watch. Any scenario. Land from about 2 km²
up to a state. Every person is always a real person; how many there are is limited only by the
computer. Old times to modern. War and its aftermath true to the time. Catastrophes dropped
while it runs. **It is not a rewrite** — Ric: "existing engine is good it just needs to be
cleaned … its the things that this is missing."

## How to do an item

Do these in order. Do not skip one because the item looks small.

1. **Fetch.** `git fetch` and fast-forward. Other sessions push to `main`.
2. **Read** the four things above, and the code the item names.
3. **Research before designing.** Each item lists what to look up. Find how the problem is
   solved well elsewhere — published models, real figures, how other simulations do it cheaply.
   Read the sources; do not answer from memory. Write what you found, with links, under the
   item's **Research notes** heading in this file, and say which approach you chose and why,
   including what it costs to run.
4. **Ask Ric** the item's "Ric decides" questions, all at once, with your recommendation for
   each. Wait for his answers. Write them into the item with the date and his words. If the item
   has none, tell him the approach in a few lines and carry on.
5. **Measure before.** Run `node test/bench.mjs` (it exists once item 1 is done) and note the
   numbers.
6. **Build it**, following the rules below.
7. **Test it.** Add tests for the new thing and list them in `/.github/checks.mjs`. Run
   `node .github/checks.mjs` from the repo root, and `--slow` if the engine changed.
8. **Measure after.** Run the bench again, and a year-long run of the default world. Add a row to
   the Speed log. If the item made the world slower than its budget allows, fix that before going on.
9. **Look for bugs in the new code.** Read your own diff from the top as if somebody else wrote
   it. Then try to break it: the smallest and largest land, 20 people and the most the machine
   carries, every new setting at both ends, a year at top speed, a shared link, a phone-width
   window. Open the page in a browser and watch it; a green test is not the same as it working.
   Fix what you find and say what you found.
10. **Write it down.** README (what it does, why, the sources), `/AGENTS.md` if a rule changed,
    `PEOPLE-VISION.md` (tick the matching lines in its list), `EASTER_EGGS.md` if relevant.
11. **Tick the item here**: change `[ ]` to `[x]`, add the date and one line on what shipped
    and what was left out. Anything left out becomes a new numbered item at the right place in
    this list, not a note that gets lost.
12. **Commit and push** to `main` once it is finished and verified (Ric's standing rule: one
    push per finished piece of work). Tell Ric plainly: done or not done, what was measured,
    what is still open.

If an item turns out too big for one session, split it in this file into Na, Nb, … first, and
finish Na properly rather than half-finishing N.

## Rules for every item

- **Nothing is scripted.** No function starts a war, a famine, a city or a recovery on a timer.
  Things happen because of what people and the land are doing. What people say reports what
  just happened and never causes it. No AI model speaks for them.
- **Every setting does something, and means what its label says.** `test/behaviour.mjs`
  measures what share of people's hours a setting moves; quote its numbers.
- **Keep what is there.** Do not remove a mechanism or change how a default world behaves unless
  the item says so. Where a change is meant to be only faster, prove the world is the same,
  step for step, with a test.
- **A new thing that is switched off must leave the world exactly as it was.**
- **Efficiency is part of done.** Nothing may look at every person for each person, or at every
  square of the land each step. Work is done only for people who have something to do and land
  that is in use. Every item has a speed budget; the default is "no slower than 5% on the bench".
- **Sources.** Every real-world number (a yield, a range, a death rate) is written in the
  README with where it came from. Borrowed methods are credited there.
- **No dependencies, no build step, no external requests.** Plain files that open directly.
- **No real places.** Land comes from the seed. No coordinates of anywhere real (hard rule 1).
- **It must not look machine-made**, and words on the page stay short and plain.
- **Measure, don't tune by feel.** If a number is changed to make something happen, that is
  scripting the answer.

## The list

### [ ] 1. A speed test in the repo, and cheap walking

**Why first:** everything later adds work per person, and three quarters of the engine's time
is already going on one thing.
**Now:** measured 2026-11-14 on an Apple M1 — 5,000 people run at 13× at best, 20,000 at 2×.
About 75% of the time is `move` / `moveOnce` / `free` / `routeAround` in `people.js` (the check
that stops people walking through each other), though a person moves in under 3% of their
steps. `put` and `unput` search lists with `includes`, `indexOf` and `splice`. Starting a
20,000-person world takes 24 s, nearly all of it placing people (`actionTick`).
**Do:** (a) add `test/bench.mjs`: fixed seeds, several sizes, prints seconds per day, top speed,
memory per person and start-up time, so every later item can be measured the same way;
(b) find out why people who are not moving cost so much, and fix it; (c) make placing people at
the start fast.
**Research first:** uniform-grid and spatial-hash neighbour search for crowds; why blocked
agents retry every step and how crowd simulations avoid that (waiting, back-off, reservation);
cheap alternatives to A* for stepping round a body.
**Ric decides:** nothing.
**Done when:** the same seed gives exactly the same world as before (a test holds this); the
bench shows at least 3× faster at 5,000 people; a 20,000-person world starts in under 3 s.
**Budget:** this item must make things faster, never slower.

Research notes:

### [ ] 2. Do not visit people who have nothing to do

**Now:** every person is visited every step, 1,440 times a day. Hourly samples show 31% asleep,
26% making something, 24% idle. After item 1, `choose` and `work` are the next cost, and each
gets dearer per person as the crowd grows.
**Do:** a person who is asleep, working a set spell or waiting is not touched until their time
is up or something near them wakes them (a fight, a visitor, a fire). Find what in `choose` and
`work` grows with the size of the crowd and stop it.
**Research first:** discrete-event simulation; timer wheels and calendar queues; "sleeping"
agents in large agent-based models; keeping results the same whatever the frame rate.
**Ric decides:** nothing, unless the world cannot be kept identical — then show him the
difference, measured, before going on.
**Done when:** cost per person no longer rises with the number of people; 20,000 people run at
30× or better on the M1; frames, hours and batches still give the same world
(`test/time-food.test.mjs`).
**Budget:** faster only.

Research notes:

### [ ] 3. Off the page's thread, no top on people, and "what can this computer run"

**Now:** the engine runs inside the page's drawing loop, so a big world freezes the page. The
people slider stops at 20,000. Nothing tells the visitor what their machine can carry.
**Do:** run the engine in a worker and send the page only what it draws. Take the fixed top off
the number of people. On the setup page, run a short hidden test world and say, in one plain
line, about how many people this computer can run and how fast. The mark is advice: a visitor
can go past it. Ric: "if a friend has a better one i want them to be able to push those limits."
**Research first:** Web Workers and transferable buffers; whether `SharedArrayBuffer` can be
used on GitHub Pages at all (it needs headers Pages may not let us set — check, do not assume);
what `navigator.hardwareConcurrency` and `deviceMemory` do and do not tell you; how to benchmark
briefly without lying (warm-up, variance).
**Ric decides:** how the limit is shown, from two or three plain mock-ups.
**Done when:** the page stays smooth while a 20,000-person world runs flat out; the readout's
guess is within about 30% of what the world then does; the page still works opened as a file.
**Budget:** no slower than before on one thread.

Research notes:

### [ ] 4. Land from the seed: height, water, kinds of ground, any size

**Now:** each square has two numbers (`fert`, `ore`) from smooth noise. No height, water, forest
or coast. Land is 5 to 500 km across in 250 m squares.
**Do:** the seed makes height first; water runs downhill into rivers, lakes and a sea; ground
kinds follow from height, water and warmth — sea, lake, river, beach, marsh, grassland, forest,
hills, mountain, dry land. Each kind says whether it can be lived on, farmed and crossed.
Fertility and ore then come from the kind of ground, not from separate noise. Land from about
2 km² to a state, with the square getting smaller as the land does so a small world is not a
handful of squares. Settings for how much sea, river, forest and hill, with the seed deciding
the rest.
**Research first:** terrain from noise and from erosion; river networks by flow accumulation
and depression filling; climate-to-biome tables (Whittaker); Red Blob Games' map-generation
write-ups; how to hold a state-sized map without storing every square in full.
**Ric decides:** which kinds of ground are in; how big "a state" is in kilometres; how small a
square may get.
**Done when:** the same seed always gives the same land; rivers reach the sea or a lake and
never run uphill; a default world still feeds itself for a year; the largest land starts in a
few seconds and fits in memory on an 8 GB machine.
**Budget:** no slower per person; start-up may grow with the land, not with empty squares.

Research notes:

### [ ] 5. Drawing the land so it can be read, at three zooms

**Now:** one brown-to-green wash. Ric: "i can barely tell whats livable whats a forrest. what is
a beach."
**Do:** each kind of ground drawn so it is told apart at a glance. Three levels by zoom: far out,
land, water, settlements and borders; nearer, fields and houses; close, people as squares. Only
what is on screen is drawn. Zoomed far out, people need not be drawn at all.
**Research first:** how map-makers colour land and water so they read without a key; drawing
big tile maps cheaply on a canvas (cached tiles, coarser copies for far zoom, drawing only the
view); colours that still work for colour-blind people.
**Ric decides:** the look, from real screenshots of two or three versions on the same seed.
**Done when:** Ric can name every kind of ground on a new seed without a key; panning and zooming
a state-sized map stays smooth; nothing on the page drops below the site's contrast rule.
**Budget:** drawing a frame takes no longer than now at the default size.

Research notes:

### [ ] 6. Water people need and use

**Now:** people need only food.
**Do:** drinking water as a need, met from river, lake or well. Settlements start near water.
Crops depend on water: rain, dry years, land near a river. Fishing as a way to live. Water as a
barrier and a road: fords, boats, bridges, an army stopped at a river.
**Research first:** how much water a person and a field need; how far people historically
carried water; fishing yields; how rivers shaped where settlements stood.
**Ric decides:** whether thirst can kill within days as it really does, or is gentler.
**Done when:** with water off, the world is exactly as before; with it on, villages sit by water
without being told to, a dry year shows in the harvest, and a year-long default world survives.
**Budget:** default.

Research notes:

### [ ] 7. Houses, fields and roads as real things

**Now:** a house is a spot where a family sleeps; fields are squares people happen to harvest;
there are no roads.
**Do:** a house is a building on the land that takes work and material to put up. A field is
land a household works, visible as theirs. Stores, workshops and wells are buildings. Roads and
paths appear where people walk and make walking faster. This is the "green land their farming
and the brown box of a house" Ric described.
**Research first:** how much land a farming household worked and how villages laid fields out;
how paths form from use (desire paths) and cheap ways to model it; route-finding on a road
network that is cheap for many walkers.
**Ric decides:** who owns land — the household, the village, the leader — or whether that is a
setting.
**Done when:** zoomed in, every family has a house and land you can see; paths form between
places people go and nobody draws them by rule; the year-long run holds.
**Budget:** default.

Research notes:

### [ ] 8. Villages that become towns and cities

**Now:** a village is a point with a store and never becomes anything else. Factions × villages
is fixed at the start.
**Do:** village, town and city are sizes a place grows into, not types. A big place needs food
from the land and villages round it. The visitor chooses how settled the land starts: empty,
scattered villages, towns, cities already standing. Ric: "all of this being choices."
**Research first:** what share of people could live in towns before modern farming; how city
sizes are distributed; what a town needed from its countryside; why old cities lost people to
disease.
**Ric decides:** whether a city is drawn building by building or as a block when zoomed out.
**Done when:** on good land with trade a village grows into a town without being told to, on poor
land it does not; a world can start with a city and feed it or fail to.
**Budget:** default.

Research notes:

### [ ] 9. Materials and other ways to live

**Now:** farming, one kind of "goods", ore, trade.
**Do:** wood, stone, ore and cloth as real materials from the kinds of ground in item 4, and
what is made from each. Fishing, herding, hunting, wood-cutting and mining as livings chosen the
same way farming is — in `choose`, from the same figures, never as a branch on `p.job`.
**Research first:** what a day of each kind of work produced; how many people one worker in each
supported; what `PEOPLE-VISION.md`, "Ric's next list", item 2 says about production.
**Ric decides:** how many materials — few and clear, or many.
**Done when:** a village by a forest and a village by the sea live differently without being
told to; `test/behaviour.mjs` shows each new setting moving people's hours.
**Budget:** default.

Research notes:

### [ ] 10. The ten traits, and events that move them

**Now:** five traits (`bold`, `warm`, `greed`, `stub`, `loyal`), set at birth, never moved by
what happens.
**Do:** add patient, hot-tempered, hardworking, curious and honest (agreed 2026-11-14; the table
is in `PEOPLE-VISION.md`). Each must change a real choice in `choose`. What happens to a person
moves their traits slowly: a raid, a famine, a death in the family, a good year. Children take
after their parents as now. The visitor sets what people are like at the start.
**Research first:** what is known about which traits predict which choices; how much traits are
inherited; how much hard events change a person and how long it lasts.
**Ric decides:** how fast traits move — a hard year changes a person a little, or a lot.
**Done when:** each of the ten measurably moves people's hours in `test/behaviour.mjs`; a village
that was raided ends up measurably different from the same village that was not.
**Budget:** default.

Research notes:

### [ ] 11. The mind: a fixed number of things a person holds

**Now:** a list of friends, one piece of news, one number for belief. Ric: "a person can hold a
certain number of bits of information."
**Do:** each person has a fixed number of slots, set by the visitor. One slot is one thing known
or felt: who or what it is about, what kind (friend, grudge, debt, news, skill, a price, a
place), how strong, how old. When the mind is full the weakest goes. Decisions read the mind.
The friends list, the single piece of news and belief move into it.
**Research first:** how many people a person can really keep track of, and in what layers; how
memories fade; fixed-size ways to store this that cost nothing to copy or scan.
**Ric decides:** the default number of slots; whether people differ in how many they have.
**Done when:** a person's memory never grows past its size; the person panel shows what somebody
holds in plain words; a grudge formed in year 1 still changes a choice in year 3.
**Budget:** default; memory per person must not rise.

Research notes:

### [ ] 12. Talking as passing what you hold

**Now:** two people close together say a line picked from a short list.
**Do:** talking passes a slot from one person to another. Whether it is believed depends on
trust; it can arrive weaker or changed. People act on what they hold even when it is wrong.
Children start with a weaker copy of some of what their parents hold and are told more (Ric:
"a mix of both"). On screen a piece of news can be traced from person to person back to where
it began.
**Research first:** how rumours and opinions are modelled as spreading between people; how
stories change as they are retold; how much parents' feuds pass to children.
**Ric decides:** how often things are passed on wrong.
**Done when:** news of an event reaches a far village days later, by a path that can be followed;
two villages can believe different things about the same event; what is said on screen is always
the thing that was passed.
**Budget:** default. Talking must cost only for people who are near somebody.

Research notes:

### [ ] 13. Leaders and factions that deal with each other

**Now:** chiefs, votes, rule by the rich, tax, relief, breakaways, war and peace, and the visitor
ruling a faction.
**Do:** factions that start as friends, strangers or enemies, as a setting. Dealings short of
war: alliance, trade agreement, tribute, threat. Who becomes leader depends on the people; what
a leader does depends on their own ten traits and what they hold in mind.
**Research first:** how small societies chose and removed leaders; why neighbours stayed at
peace or did not; `PEOPLE-VISION.md`, "Ric's next list", item 5.
**Ric decides:** nothing up front.
**Done when:** the same two factions under a hot-tempered leader and a patient one end up
measurably different over many seeds; "two tribes that hate each other with almost no money" can
be set up from the setup page alone.
**Budget:** default.

Research notes:

### [ ] 14. War true to its time, and what it leaves

**Now:** wars start and end, soldiers are real people, gear wears, armies eat from home.
**Do:** why a war starts and ends comes from what people and leaders hold in mind. Walls, sieges
and raids. Afterwards: the dead missing from their households, widows and orphans, burned
buildings, lost harvests, people fleeing, land changing hands, grudges that last and fade. A new
leader can end a war their predecessor began. Ric: "i want war to be accurate to the time and i
want the aftermath of war to be accurate too."
**Research first:** how many died in battles and how many from hunger and sickness around them;
how far an army could go from its food; how long places took to recover; what refugees did.
**Ric decides:** nothing up front.
**Done when:** a war measurably thins the next harvest and the next generation; a war begun under
one leader can end under the next without any rule saying so; `test/rule.test.mjs` still holds.
**Budget:** default.

Research notes:

### [ ] 15. Eras, old to modern

**Now:** one era, a farming village with hand weapons.
**Do:** an era is a set of numbers over the same world: how many one farmer feeds, what
buildings are made of and hold, weapons' reach and deadliness, how fast people and news travel,
medicine. Modern things exist as things in the world, never as a switch — a phone works only
within reach of a cell tower, and a tower can be built or destroyed (Ric: "cell towers must be a
thing too"). Money and shops stay simple.
**Research first:** real figures for each era and each number; how far a tower reaches; how eras
were handled in other history simulations and where that went wrong.
**Ric decides:** which eras; whether a world can move from one era to the next by itself.
**Done when:** the same land and people in two eras fight, travel and hear news at measurably
different speeds; knocking down a tower slows the news in its area and nowhere else.
**Budget:** default.

Research notes:

### [ ] 16. Ruins and scavenging

**Now:** a dead village leaves nothing.
**Do:** a place that dies or is destroyed leaves a ruin holding what was really there, less what
rotted and what others took. Scavenging is a living chosen like any other and lasts only while
ruins do. A world can start already ruined. Ric: "ruins... seems like it needs to be viable for
scavengers as well".
**Research first:** how long food, tools and buildings last untended.
**Ric decides:** nothing up front.
**Done when:** nothing is ever created to be found; a ruin empties as it is searched; a small
band can live on a ruined world for a while and then has to do something else.
**Budget:** default.

Research notes:

### [ ] 17. Catastrophes on the land

**Now:** nothing can be dropped on the world.
**Do:** one tool the visitor uses while the world runs: a place, a size, what it does to people,
buildings and soil, and for how long. Nuke, asteroid, volcano, flood, fire, drought and
earthquake are the same tool with different numbers. What follows is not written: it comes from
dead workers, lost stores, poisoned land and people leaving.
**Research first:** published effect sizes — blast and fallout by weapon size, ashfall and cold
years after eruptions, impact effects by size, how floods and fires spread.
**Ric decides:** whether catastrophes can also arrive by themselves, as a setting.
**Done when:** each kind can be placed mid-run; with none placed the world is exactly as before;
the aftermath differs with where and when it lands.
**Budget:** default; no cost at all while nothing is happening.

Research notes:

### [ ] 18. Catastrophes in people: plague, radiation, zombies

**Now:** one sickness setting.
**Do:** one mechanism: something a person carries, that passes to others in a stated way, and
changes their body and what they want. Plague, radiation sickness and zombies are that
mechanism with different numbers. A zombie is the same real person, turned.
**Research first:** how infections are modelled person to person; real figures for how diseases
spread and kill; the published zombie-outbreak models.
**Ric decides:** what a turned person wants and whether they can be cured.
**Done when:** the existing sickness is this mechanism with its old numbers and behaves as it
did; a zombie outbreak can be started on one person mid-run and spreads or dies out by itself.
**Budget:** default.

Research notes:

### [ ] 19. History, families and the dead, and saving a world

**Now:** 400 remembered events, living-family links, nothing saved.
**Do:** a history that can be gone back through, so a war can be traced to what began it.
Families that include the dead. Saving a world and coming back to it, in the visitor's own
browser.
**Research first:** keeping a long history small; saving large worlds in a browser.
**Ric decides:** how far back history is kept in full.
**Done when:** a saved world reopened carries on exactly as it would have; any living person's
grandparents can be found.
**Budget:** default; history must not grow without limit.

Research notes:

### [ ] 20. Making a person small

**Now:** a person is 61 fields and about 1.5 KB. Memory is not the limit below about a million
people.
**Do:** only if the bench by then shows memory, or the cost of walking through large objects, is
what stops a bigger crowd: pack people into plain number arrays.
**Research first:** struct-of-arrays layouts and what they bought other JavaScript simulations.
**Ric decides:** nothing.
**Done when:** the same world comes out, memory per person is several times lower, and the bench
is faster.
**Budget:** faster only.

Research notes:

## Speed log

One row per finished item. Same machine where possible; say which machine.

| Date | After item | Machine | 5,000 people, 40 km | 20,000 people, 80 km | Memory per person | Note |
|---|---|---|---|---|---|---|
| 2026-11-14 | (start) | Apple M1, 8 GB | 24 s a day, 13× | 129 s a day, 2× | about 1.5 KB | measured by hand before this list existed |
