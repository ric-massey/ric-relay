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

A lettered item (2b, 3b) is what a finished item measured and left. It does not stand in the way of
the numbered items after it: "work on 3" means item 3 even while 2b is unticked. Ric asks for a
lettered one by name ("work on 2b").

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
5. **Measure before** — only what the item changes (see **Running the sim only as much as
   needed**, below). For the engine's steps that is `node --expose-gc test/bench.mjs` from this
   folder (`--quick` for the three small rows); for making a world, `--start`.
6. **Build it**, following the rules below.
7. **Test it.** Add tests for the new thing and list them in `/.github/checks.mjs`. While
   working, run `node .github/checks.mjs --only world-builder` from the repo root (add `--slow`
   if the engine changed). Run the whole set, `node .github/checks.mjs` (and `--slow` if the
   engine changed), once, just before pushing.
8. **Measure after**, the same things as step 5. A year-long run of the default world only if
   the item changed what happens once the world is running. Add a row to the Speed log. If the
   item made the world slower than its budget allows, fix that before going on.
9. **Look for bugs in the new code.** Read your own diff from the top as if somebody else wrote
   it. Then try to break it, in the places the change reaches: the smallest and largest land,
   20 people and the most the machine carries, every new setting at both ends, a year at top
   speed (if the running world changed), a shared link, a phone-width window. If the page
   changed, open it in a browser and watch it; a green test is not the same as it working.
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

## Running the sim only as much as needed

Ric, 2026-11-15: "we are running the sim all the time. do we really need to run it that much?"
No. Long runs are for proving something they can prove; check against what the item touched.

- **Check what changed, not everything.** A change to how a world is made (who stands where,
  what they own) is proved the same world by comparing every person right after `create()`
  against the old code: the engine is fixed by its seed, so the same start is the same year.
  Run a year, or step-for-step tests, only when the change reaches the running world.
- **Time only what the item is meant to speed up.** `bench.mjs --start` times making worlds
  and runs no days; the full bench is for changes to the steps.
- **One run each way is enough for a big difference.** This machine drifts about 10% from run to
  run; take turns old, new, several times only when the answer is within that (the 5% budget
  checks). A 16 s → 2 s change shows in one run.
- **Keep the old answer instead of running the old code again.** Where a test compares against
  the old engine, save what the old engine gave once (a short fingerprint in `test/`) and
  compare against that.
- **Only World Builder's checks while working** (`--only world-builder`); the whole site's set
  once before the push.
- **A browser only when the page changed.**

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

### [x] 1. A speed test in the repo, and cheap walking

**Done 2026-11-15.** `test/bench.mjs` is the speed test; blocked steps and failed ways round are
remembered, the in-the-way check reads fewer squares, a crowd is placed with a finer map. Same
world, step for step (`test/walking.test.mjs`). 5,000 people 13× → 68×; 20,000 people 2× → 14×; a
20,000-person start 25.7 s → 2.6 s. Left out, on purpose: the crowding itself (see item 7's
"Now"), and visiting everybody every step (item 2). README, "A crowd that costs what it should".
Found on the way: the slow suite (`test/world-builder.test.mjs`) had been red since the
five-minute day went in — three checks still expected a twenty-minute day. Fixed.

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

Research notes (2026-11-15):
- **Measured first.** At 5,000 people, 6.25 million of 7.19 million person-steps a day were a walk
  that ended where it began; 82,000 an hour were a step aside and straight back. The route search
  ran 892,000 times a day and found a way 123 times. So the cost was not looking up neighbours
  slowly; it was asking the same question again when nothing had changed.
- **Sleep and wake.** Physics engines stop working on a body that cannot change and wake it when
  a neighbour moves ([Roblox's sleep system](https://create.roblox.com/docs/physics/sleep-system.md)).
  The known failure is a sleeper that is never told
  ([their write-up of one](https://corp.roblox.com/newsroom/2020/07/roblox-physics-building-better-sleep-system)).
  Chosen: remember a blocked step, and count every way room can be made — a step, a death, a
  person moved or killed from outside. Cost: eight bytes a square, nine fields a person.
- **Grid cell size.** The usual advice is a cell about the size of the query
  ([rustsim-crowd](https://docs.rs/crate/rustsim-crowd/0.0.1/source/src/broadphase.rs);
  [FRNN for agent simulations](https://eprints.whiterose.ac.uk/153625/7/1-s2.0-S0743731519301340-main.pdf)).
  Not chosen: a finer grid would have changed every list the engine keeps. Chosen instead: keep the
  one-square grid and read only the squares a body's width can reach (1, 2 or 4, not 9).
- **Placing a crowd.** [Bridson's Poisson-disk sampling](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf)
  uses a background grid fine enough that a cell answers "taken" by itself. Used as a filter in
  front of the existing ring search, so everybody stands exactly where they did.
- **Not done because it would change the world:** back-off or reservation for blocked walkers.

### [x] 2. Do not visit people who have nothing to do

**Done 2026-11-15.** Somebody asleep, at a day's work, or jammed in a crowd is passed over until
their wait is up or room is made beside them; the lists of who stands where and who lives where
are kept up instead of made again; and every person is one kind of object from birth, which was
the largest single gain and not in the plan. Same world, step for step (`test/dozing.test.mjs`; a
year of the default world identical on all 365 days). On the cloud machine this was built on:
5,000 people 33× → 86×, 20,000 people 6× → 19×, and a person-step costs about the same at 5,000
as at 20,000 (0.49 and 0.54 µs; before, 1.26 and 1.61). **Not confirmed on the M1**: by the ratio
of the two machines 20,000 people should run at about 43× there (the target was 30×) — run the
bench on the Mac and add the row. Left out, on purpose, and now item 2b: people who may start a
conversation are still visited every step; asking a neighbour for food still reads through the
village; the search for a way round in a dense small land; the look at everybody each time the
page hands over a frame. README, "Only people with something to do".
Found on the way: a failed search for a way round that ran out of *tries* must not be remembered
(item 1 remembered any failure small enough); none had been in anything measured, and it is fixed.

**Now:** every person is visited every step, 1,440 times a day. Hourly samples show 31% asleep,
26% making something, 24% idle. Measured after item 1 (5,000 people): the largest costs are the
loops that touch everybody each step — `actionTick` refilling the who-stands-where lists, `act`,
and `rebucket` — then the route search, then `census`. With bodies at real size `choose` and
`work` lead, and each gets dearer per person as the crowd grows. Item 1's blocked-step memory
(`move`, `quiet`) is the same idea in one place; this item is that idea for the whole person.
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

Research notes (2026-11-15):
- **Measured first** (20,000 people, 80 km, the machine in the speed log). The plan above was half
  wrong. (a) 35% of the time — 50% with bodies at real size — was the JavaScript engine looking
  fields up by name, because a person came in 21 layouts: eight fields were added the first time
  they were used. (b) With bodies as drawn only a few percent of steps were anybody asleep or at
  work *in place*; 74% were somebody jammed more than 2.5 squares from where they were going,
  counted as walking. (c) With bodies at real size `choose` was 55% of the time, nearly all of it
  going through every person alive to find one village's.
- **Next-event time advance.** A discrete-event simulation keeps the time of the next thing each
  part will do and goes straight to it; nothing is worked out for a part between its events
  ([Leemis & Park course notes](https://huichen-cs.github.io/course/CSCI570/notes/lecture10_nes.pdf),
  [Discrete-event simulation](https://en.wikipedia.org/wiki/Discrete-event_simulation)). For
  agents: "regards only those points in time when changes actually occur"
  ([Event-driven agent-based simulation](https://www.doi.org/10.1186/2194-3206-1-3)). Chosen, in
  its plainest form: a wake step for each place in the people array. Cost: 17 bytes a person.
- **Timer wheels and calendar queues** ([Varghese & Lauck](https://blog.acolyer.org/2015/11/23/hashed-and-hierarchical-timing-wheels/)).
  Not chosen. They find "who is due now" without looking at everybody, but hand them over in the
  order they fall due; people must act in the order of the people array or the dice are drawn in
  a different order and it is a different world. Reading a table of numbers in that order costs
  about a thousandth of a visit, so there was nothing left to win.
- **Woken by a change in somebody else** is Repast's "watcher"
  ([Repast4Py guide](https://jozik.github.io/goes_bing/guide/user_guide.html)), and the sleeping
  body of item 1's notes. Chosen for the jammed: a list per block of ground, told by `madeRoom`.
  The known danger is the same — a sleeper nobody tells — so the test runs with an audit that
  looks at every sleeper on every step.
- **The same world however the time is handed over** ([Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/)):
  already how `advance` works; kept by putting every dozer's counts right before it returns.
- **One layout for every object of a kind** ([hidden classes and inline caches in V8](https://dev.to/omriluz1/hidden-classes-and-inline-caches-in-v8-36fp)):
  name every field when the object is made. Chosen; no cost.
- **Not done because it would change the world:** letting idle people skip the roll for starting
  a conversation (see 2b). **Not done because it is item 20:** packing people into number arrays.
- These sources were read as search summaries only: the session's network would not open the
  pages. Every figure here is one measured on this engine.

### [x] 2b. What item 2 measured and left

**Done 2026-11-15** (Ric: "do 2b finish 2 all the way"). (a) When somebody next tries to speak is
drawn once instead of rolled every step, so the idle are passed over, and so are two people in
conversation; this is the one part that makes a seed a different world from before, and a year of
the default world both ways over twelve seeds shows the same country (README, "When somebody next
speaks"). (c) A search for a way round that ran out of tries is remembered until anybody there
moves; it was 60% of a dense small land's time. (d) The page gives its word that it touched
nobody (`advance(seconds, true)`) and the look at everybody is left out. Everything but (a) gives
the identical world. At 20,000 people a person is now looked at on 9% of steps (the
target was under 10%). **Not met, and moved on:** the 2,000-on-17-km row still costs more per
person than the 5,000 row — what is left is searching for a way round a crowd that is always
moving, which is the crowding itself, and is written into item 7; and (b), asking a neighbour
without reading the village, could not be done with the same giver coming out, and is written
into item 11.

**Now** (measured 2026-11-15, cloud machine, after item 2):
- **Idle people are visited every step to roll for a conversation.** Somebody idle with no word
  owing rolls the dice each step to see whether they speak to whoever shares their square. One
  person-step in six at 20,000 people is this, and it cannot be passed over without drawing the
  dice in another order — a different world.
- **Asking a neighbour for food reads through the village** (`choose`, "ask"). Cheaper than it
  was, but it still grows with the size of the village: with bodies at real size a person-step
  costs 0.48 µs at 5,000 and 0.59 at 20,000.
- **The search for a way round, in a dense small land.** 2,000 people on 17 km cost 1.9 µs a
  person-step against 0.5 elsewhere; half of it is `routeAround` run again when somebody nearby
  moves (33,000 times a day for 1,355 ways found).
- **A look at everybody each time the page hands over time** (`lookRound`), for anything done to
  people from outside. At 20,000 people a day costs 12 s worked out in one piece, 15 s two steps
  at a time, 22 s a step at a time.
**Do:** (a) give talking its own dice, or roll once for when an idle person next speaks, so they
can be passed over like anybody else; (b) find a giver without reading the village — the houses
of item 7 or the mind of item 11 may be the right place, in which case fold it into that item;
(c) make the failed search cheaper or rarer — item 7's uncrowding may remove it; (d) let the
page say it has not touched anybody, or do the look only when something outside has.
**Research first:** independent random streams in simulations (one per purpose) and what they
buy; drawing the time of the next event instead of rolling every step (geometric waiting times);
how crowd simulators answer "no way through" cheaply.
**Ric decides:** (a) changes which conversations happen — same rules, same odds, different dice.
Show him a year of the default world both ways, measured, before doing it.
**Done when:** under 10% of person-steps are visits at 20,000 people; the 2,000-on-17-km row
costs no more per person than the 5,000 row; everything except (a) gives the identical world.
**Budget:** faster only.

Research notes (2026-11-15):
- **Measured first.** In the 2,000-on-17-km world, by how a search for a way round ended:
  remembered 138,582 a day at 0.4 µs; walled in 14,992 at 4 µs; no place to arrive 19,072 at
  1.5 µs; found 1,355 at 170 µs; **out of tries 3,325 at 730 µs — 2.4 of the day's 4.1 seconds.**
  So "run again when somebody nearby moves", as written above, was the wrong culprit: those are
  cheap. And at 20,000 people, once the idle were passed over, 9.5% of person-steps were people
  standing in conversation.
- **Drawing the wait instead of rolling for it.** The number of rolls until the first success is
  geometric, and is drawn in one go by inverse transform, `1 + floor(ln U / ln(1 − p))`, U never
  zero ([randlib's igngeom](https://git.fossee.in/scilab_for_xcos_on_cloud/.git/tree/modules/randlib/src/c/igngeom.c);
  [worked answer](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/23517138/random-number-generator-using-geometric-distribution)).
  Chosen: every wait is exactly as likely as it was, one draw a try instead of one a step.
  Apache Commons draws it as the floor of an exponential instead
  ([RNG-69](https://issues.apache.org/jira/browse/RNG-69)); not needed at one draw every few steps.
- **A dice stream for each purpose** ([L'Ecuyer, Simard, Chen & Kelton 2002](https://econpapers.repec.org/RePEc:inm:oropre:v:50:y:2002:i:6:p:1073-1075);
  [ns-2's rule](https://www.isi.edu/nsnam/ns/doc/node267.html): "each random variable should use
  a separate RNG object"). Not chosen for this: it keeps everything else's dice still when
  talking changes, but somebody would still roll every step, which was the cost. Worth doing
  for its own sake when settings are compared (`test/behaviour.mjs`): a later item.
- **"No way through", cheaply.** Nothing found that gives the same answer as a search with a cap
  on its tries except running it; so it is remembered exactly instead — valid while every body
  on the ground it looked at is where it was — and the audit checks that claim itself.
- **Tried and taken out:** number tables in place of the search's two Maps. Same answers
  (720,000 searches compared), no measurable gain: the time is in asking "is anybody in the way"
  six times for every neighbour, not in the look-ups.
- **(b), not done.** The giver is the best of food × kin × friendship over the village, and the
  friendship is the *giver's* memory of the asker, so no list kept per village gives the same
  answer without following all 21 places a person's food changes (and whatever a test does).
  Reading a village's larders is also not something a person could do. Moved to item 11.
- Sources read as search summaries only; the session's network would not open the pages.

### [x] 3. Off the page's thread, no top on people, and "what can this computer run"

**Done 2026-11-15.** The engine runs in a worker, kept by a new file, `people-host.js`, and the
page is sent only what it draws; where a worker cannot be had the same keeper runs on the page's
thread as the engine always did. The number of people has no top (the slider still sweeps to
20,000; a typed number or a link goes past it). The setup page quietly makes the world as set, runs
it for up to three seconds and says under "How many people" how fast it went. Same world, step for
step, through the keeper or not (`test/keeper.test.mjs`; a year of the default world is the
identical state on the engine before and after). Measured in a real browser on the machine in the
speed log, 20,000 people flat out: pressing Run froze the page 4.4 s and it then drew 7 frames a
second; now it does not freeze (14 ms) and draws every frame (worst gap 25 ms of 8 s), and the
world gets through about twice as much in the same stretch. README, "Off the page's thread".
**Met:** smooth at 20,000 flat out; works opened as a file (checked in a real browser from a
`file:` address: the worker starts and answers); the engine is exactly as fast on one thread.
**Not met, and moved on — now item 3b:** "the readout's guess is within about 30% of what the
world then does" holds for a world's first days and not after them, because a world's own cost
drifts by a factor of two to five over its first ten days, either way (measured below); and a very
big world is slow to *start*, which the worker hides from the page but does not shorten.
Found on the way, and fixed: (1) painting the land was 60 to 280 ms a time for an 80 km land, on
every frame at speed — with the engine gone that was what still held the page up; it is a pixel a
square now, about 1 ms. (2) The old page's "Running at N×" overstated a world too big to keep up
(it counted at most a tenth of a second a frame: it said 22× where the clock moved at 15×); the
keeper counts the time that really passed. (3) Looking at a person fixed a village's hourly
"how much to put by" figure at a moment of the panel's choosing, so a watched world could differ
from an unwatched one; the engine's `urgency` door puts the figure back.

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

Ric's answers (2026-11-15), from three mock-ups — a line under the slider, a mark on the slider, a
small table:
- **How it is shown: "A line under the slider".** One sentence under "How many people" that
  follows the settings; nothing blocks going past it.
- **Which speed "the limit" means: 16×.** Settled the second time of asking (below). Asked first whether the rough head count should mean
  16×, a year an hour or 1×, he said: "if your talking about top speed then that needs to have a
  max button like it works now... idk what a rough head count is..... like running a year in 20
  sec is kinda needed as well sometimes... so im not sure what this is". So: the Max button and
  every speed are untouched; the second sentence was reworded to plain words ("It should stay
  above 16× up to roughly N people"); and 16× — the fastest clock that runs exactly as asked — is
  this session's choice at the time. It is one constant, `STEADY` in `index.html`. Asked again
  the same day, with the line and its screenshot in front of him and the three meanings spelled
  out (16×, a year an hour, keeping up at 1×), he answered: "Keep 16×". So 16× is his.

Research notes (2026-11-15):
- **Measured first.** (a) Where the page's time went at 20,000 people: 186 ms a frame on the old
  page — the engine's 40 ms, and then the land, repainted a square at a time. (b) What a day costs,
  one seed, 34 worlds from 400 to 20,000 people on 17 to 300 km: 0.5 to 2.8 ms a person-day, *not*
  rising with the head count — 2,000 people in eight villages cost more each than 20,000 (who
  mostly stand jammed and are passed over) — and a world's second and third days differing by up
  to three times. So no table of machines and no rule of so-many-people-a-core could be honest;
  the only figure that is the world's own is that world, run. (c) Starting a world grows with the
  square of the head count: 10,000 in 0.9 s, 20,000 in 3.7 s, 40,000 in 16 s, 91% of it in the
  ring search that finds each person a place to stand.
- **Workers and handing buffers over.** A typed array's buffer can be *transferred* in
  `postMessage`: the memory moves, nothing is copied, and the sender's copy is emptied
  ([MDN, Transferable objects](https://developer.mozilla.org/docs/Web/API/Web_Workers_API/Transferable_objects);
  [Chrome, "Transferable objects: lightning fast"](https://developer.chrome.com/blog/transferable-objects-lightning-fast)
  — a 32 MB buffer cloned took hundreds of milliseconds). Chosen: every frame is five small typed
  arrays (where, colour, marks, gear, talk lines), cut to who is in view and transferred. Cost
  measured: 0.7 ms to read 5,000 people, 10.6 ms to read 20,000 (it is waiting on memory, a
  person being a large object: item 20), so a frame also says what it cost and the page waits six
  times that before asking again, and a frame asked for with nothing changed is answered "same".
- **`SharedArrayBuffer` on GitHub Pages: no.** It needs the page to be cross-origin isolated, which
  needs two response headers (COOP and COEP), and Pages does not let a site set headers
  ([GitHub community discussion 13309](https://github.com/orgs/community/discussions/13309), still
  open). The known way round is a service worker that adds them and reloads the page
  ([coi-serviceworker, described here](https://dev.to/stefnotch/enabling-coop-coep-without-touching-the-server-2d3n)):
  not chosen — it is somebody else's script, it reloads the visitor's first visit, and service
  workers do not run from a `file:` address at all. Nothing here needs shared memory.
- **A worker when the page is opened as a file.** A page opened from a folder may not start a
  worker from a file beside it (Chrome: "cannot be accessed from origin 'null'"); the usual answer
  is a worker made from text the page already holds, through a Blob
  ([collected answers](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/37718656/why-does-not-chrome-allow-web-workers-to-be-run-in-javascript)).
  The sources disagreed on whether that still works from `file:`, so it was tried rather than
  believed: it does (headless Edge, `file:` address, a 3,000-person world tried and run). Chosen
  for every case, served or not, so there is one path: `people.js` and `people-host.js` each keep
  the function they were built from (`factory`), and the page writes the two out again as the
  worker's text. If a worker never answers, the same keeper is made on the page's thread.
- **`hardwareConcurrency` and `deviceMemory`: not used.** The first is how many threads, which
  says nothing of how fast one is, and browsers cap it against fingerprinting (Safari to 8 or
  fewer); the second is rounded to 0.25–8 GB, capped at 8, and missing from Safari and Firefox
  ([MDN, deviceMemory](https://developer.mozilla.org/docs/Web/API/Navigator/deviceMemory);
  [MDN, hardwareConcurrency](https://developer.mozilla.org/docs/Web/API/Navigator/hardwareConcurrency)).
  The engine is one thread and memory is not its limit below about a million people.
- **Timing briefly without lying.** Fresh code runs slowly until the browser has optimised it, so
  a short test must throw its first runs away
  ([one account of the usual pitfalls](https://hackernoon.com/why-is-javascript-benchmarking-a-mess));
  and the browser's clock is coarsened (to about 0.1 ms without cross-origin isolation), so time
  whole stretches, never single steps. Chosen: whole days; a first day over in under a second is
  the warming-up and is not counted. Measured before that rule: 400 people said 820× and ran at
  1,100× to 1,700×.
- **How good the readout is** (headless Edge, the machine in the speed log; "said" is the line on
  the setup page, "ran" is the running world's own figure):

  | World | Said | Ran, first days | Ran, later |
  |---|---|---|---|
  | 400 people, 17 km | 1,200× | 1,600× | 2,300–2,900× by day 30 on |
  | 2,000 people, 17 km | 89× | 92×, 83×, 75× | 120–200× from day 4 |
  | 5,000 people, 40 km | 230× | 340× (days 1–2) | 100× from day 4, 65–75× by day 9 |
  | 20,000 people, 80 km | 38× | 34×, 25×, 22×, 18×, 49×, 46×, 37× | — |

  Within about a third at the start; out by two or three times once a world has settled or
  jammed. That is the world changing, not the timing, and three seconds cannot know it. So the
  line says "at first", and the rest is item 3b.
- **Not done because it would change the world:** placing a crowd faster (the start-up above).
  Everybody must stand exactly where the ring search puts them. Item 3b.
- The linked pages were read as search summaries; where two disagreed the thing was tried here.
  Every figure is one measured on this engine.

### [x] 3b. What item 3 measured and left

**Now** (measured 2026-11-15, the machine in the speed log):
- **A big world is slow to start.** 10,000 people 0.9 s, 20,000 3.7 s, 40,000 16 s: four times the
  time for twice the people. 91% is `actionTick`'s ring search (`people.js`, "Initial residents"),
  which for each newcomer walks every ring out from their spot and tries every point on any ring
  not wholly taken. The page no longer freezes while it happens ("Making the world… 12 seconds so
  far", and ← Settings gets out), but 100,000 people would take minutes and a million, hours. So
  "no top on people" is true of the rule and not yet of the wait.
- **The readout knows a world's first days only.** See the table in item 3's notes.
- **The readout's second sentence** ("stay above 16× up to roughly N people") is plain
  proportion from one measurement, and the per-person cost is not constant, so it is rough; and
  it means 16× (Ric, 2026-11-15: "Keep 16×").
- **Reading a frame of a very big crowd costs the worker 10 ms at 20,000 people** (0.5 µs a
  person, against 0.2 for a step of the engine), because a person is a big object. Frames are
  spaced out to keep that to about a seventh of the worker's time, so at 20,000 people the map
  moves about fifteen times a second rather than sixty. Item 20 (making a person small) is the fix.
**Do:** (a) place a crowd in time that grows with the crowd, not its square, with everybody
standing exactly where they stand now — or show Ric, measured, what a different placing changes;
(b) let the running world correct the readout: remember, for the settings last run, the speed it
really held, and say that on the setup page next time; (c) nothing for the frame cost unless
item 20 is reached.
**Research first:** exact nearest-free-spot searches on a grid (distance transforms, bucketed
rings); how other simulators start a large crowd.
**Ric decides:** nothing, unless a faster placing cannot give the same world — then show him
the difference, measured, before going on.
**Done when:** 100,000 people start in under 20 s as the same world; the readout, on a world run
before, is within about 30% of what that world did.
**Budget:** faster only.

**Done 2026-11-15.** (a) A big world starts about 4 to 7 times sooner as the same world:
100,000 people 102.6 s → 13–15 s, 40,000 14.1 → 3.4–3.8 s (README, "A big world starts in time").
(b) A world run on Max for ten seconds is remembered in the browser, and the setup page then says
what it really held. Left out: start-up still grows faster than the crowd (a million is still a
long wait), and the frame cost (c) waits for item 20, as planned.

Research notes:
- **Nearest free spot.** Exact distance transforms ([Felzenszwalb and Huttenlocher](https://cs.brown.edu/people/pfelzens/papers/dt.pdf),
  linear in the grid; the binary-image case is "distance to the nearest set pixel") find the
  *nearest* free spot. The engine puts a newcomer at the first free point of its own rings, which
  is not always the nearest, so a transform would make a different world. Chosen instead: keep the
  ring search point for point and cut only work that cannot change an answer (only points over
  ground that could be free; gaps covered by several bodies marked; full 8 × 8 blocks skipped;
  each piece filed once under the first ring that reaches it). Cost: a list of bodies per square
  while a crowd is placed, thrown away after.
- **Parents for the first children** was a seventh of a 100,000 start (children × couples). Sorted
  couples, a binary search, the same random draws, and a Fenwick tree's "k-th" descent
  ([Grey_Matter, Codeforces](https://codeforces.com/blog/entry/77616)) give the same parents.
- **Tried and taken out:** remembering per starting square how far round it is all full. Packed
  ground keeps slivers between bodies, so it never reached past a square or two.

### [x] 4a. Land from the seed: height, water, kinds of ground, any size

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

**4a done 2026-11-15.** Height in metres, sea from the edge, lakes, rivers that run downhill to
the sea, a lake or off the edge, eleven kinds of ground, fertility and ore from the kind, four
settings (sea, rivers, forest, hills), land up to 1,000 km (starts in 4.5–5.7 s, 640–750 MB),
villages only on livable ground, nobody placed in the sea or a lake. A default world feeds
itself (four seeds: 25 starved against 86 before). Left: crossing (4b, next); drawing it well and
the zoom down to a house (item 5); a land under 5 km across (with item 5's finer detail).
Tests: the trader test now tries several seeds (a visit within 1,000 steps was luck before too);
the keeper's frame test no longer assumes nobody dies in the first day.

### [x] 4b. Crossing the land

**Now:** people walk straight at where they are going, through lakes, the sea and over mountains.
**Do:** walking goes round the sea and lakes; forest, marsh, hills and rivers are slower to
cross, mountains and snow very slow; the way round is found with the search for a way round
crowds (`routeAround`) or a coarse route over the land, whichever is cheaper. Villages whose
people cannot reach each other by land do not trade or fight by land.
**Research first:** pathfinding on big weighted grids (A* with a coarse grid above it,
hierarchical pathfinding, flow fields for many walkers to one place); walking speeds over
rough ground (Tobler's hiking function; Naismith's rule).
**Ric decides:** nothing unless rivers need bridges or fords to be crossed at all.
**Done when:** nobody walks on water; a default world still feeds itself for a year; no slower
per person than 4a.
**Budget:** no slower per person.

**Done 2026-11-16.** Nobody walks into the sea or a lake; rough ground is slower except on ground
a village holds (it has paths); a way round water is planned over the squares when water is
ahead, and kept; a journey to another piece of land is refused. Rivers are fords (0.4 of the
pace); no question for Ric needed. Measured: four seeds' default year, 10 starved in all;
bench 2,000 and 5,000 people a little faster than 4a, 400 within this machine's drift. Left:
boats and bridges (vision, "Water as road and wall"); crowds pressed against a shore jam more.

Research notes:
- **How fast over what.** Tobler's hiking function (from Imhof's data): 6·e^(−3.5·|slope + 0.05|)
  km/h, 5 km/h on the flat, and three fifths of that off a path
  ([Wikipedia](https://en.wikipedia.org/wiki/Tobler%27s_hiking_function)). Soule and Goldman (1972,
  J. Appl. Physiol.) measured the cost of walking through light and heavy brush and bog against a
  road; secondary tables put forest at about 1.3 times a road's effort and mud 1.8
  ([review](https://jhp-ojs-tamucc.tdl.org/jhp/article/view/67)); a UK hiking study keeps Tobler's
  0.6 for all off-road ground ([arXiv 2303.16065](https://arxiv.org/pdf/2303.16065v6)). Chosen, as a
  share of walking pace on open ground: forest 0.6 (off a path), hills 0.7 (Tobler at a 10%
  slope), marsh 0.5 (bog, worse than brush), a river 0.4 (wading a ford), mountain 0.25 (Tobler at
  25%, off a path), snow and ice 0.3; grassland, dry land and beach 1.
- **Finding the way round.** A* over the whole fine lattice is what `routeAround` does for crowds,
  but it stops at 800 looks, a few squares. Hierarchical A* (HPA*: Botea, Müller and Schaeffer
  2004, [paper](https://webdocs.cs.ualberta.ca/%7emmueller/ps/hpastar.pdf)) plans on a coarse
  grid first and is up to ten times faster than plain A* within 1% of the best path. Chosen: the
  250 m squares are the coarse grid (A* over them, each costing its length over its pace),
  run only when the next step would go into deep water, and the answer kept for the same pair of
  squares; the crowd search still does the last few metres. Which ground joins which (a flood
  fill once a world) says at once when a place cannot be reached by land, so nobody searches a
  whole land for an island.

Ric's answers (2026-11-15), shown a working preview of the land (height, sea, lakes, rivers,
the ten kinds, sliders for sea, rivers, forest and hills):
- **Kinds of ground: "Ten plus snow and ice".** Sea, lake, river, beach, marsh, grassland, forest,
  hills, mountain, dry land, and snow/ice on high mountains and in cold worlds (the latitude
  setting), which nobody can farm.
- **How big "a state" is: 1,000 km across** (the recommendation: about Texas or France).
- **How small a square may get:** "big lands need to keep the size of a house at least........ the
  land doesnt change very much compared to the people. but a single square i should be able to
  zoom in and pick out their house which they should be able to go in. there will be different
  size of houses depending on how rich they are....". Read as: at any size of land, zooming in
  shows detail down to a single house; the land itself changes little, so it need not be stored
  that finely. Houses that people go into, sized by wealth, are item 7.
  Asked whether that means 250 m stored squares with finer detail worked out from the seed only
  for what is on screen: "im confused 6 billion swuares each square is less then a bite right? it
  shouldnt be more than one.... 6 billion bites is that too large? if so then yes the 250m if its
  not possible. the squares of the land should not take much space at all i want to be able to
  zoom as far that i can for my computer if that makes sense...". It is too large: one byte a
  square at house size (10 m) over 1,000 km is 6 GB for the kind of ground alone, more than a
  browser tab may hold, and minutes to make. So the land is stored at 250 m (about 10 bytes a
  square: 1,000 km is about 100 MB) and zooming in works out finer detail from the seed for the
  part on screen only, as far in as anybody wants, at the cost of the screen and not the land.
  That zoom is drawing, so it goes with item 5; houses with item 7.
- **Split** (2026-11-15), so each part is finished properly: **4a** the land itself at 250 m
  squares, up to 1,000 km: height, sea, lakes, rivers, the eleven kinds, fertility and ore from
  the kind, the settings, villages on ground that can be lived on, nobody standing in deep water,
  fields only on ground that can be farmed. **4b** crossing: walking round sea and lakes, slower
  through forest, marsh, hills and over rivers, mountains nearly closed.

Research notes:
- **Height.** Smooth noise in several sizes is the usual start (Red Blob Games,
  [terrain from noise](https://www.redblobgames.com/maps/terrain-from-noise/)); the engine already
  has a smooth-noise layer (`land()` in `people.js`). Real erosion (the stream-power law, E = K·A^m·S^n,
  solved implicitly by Braun and Willett's Fastscape: [Landlab](https://landlab.readthedocs.io/en/latest/reference/components/stream_power.html);
  a worked hobby version: [Frozen Fractal](https://frozenfractal.com/blog/2025/6/6/around-the-world-23-hydraulic-erosion/))
  carves believable valleys but runs many passes over every square, which a 500 km land (2.5
  million squares) cannot afford at start-up. Chosen: noise for height, no erosion pass; rivers
  come from the water step below.
- **Water runs downhill.** Fill the hollows first, then give each square one downhill neighbour of
  eight (D8) and count how much ground drains through it; a square is river where that count
  passes a threshold (O'Callaghan and Mark 1984, as summarised in [Tarboton's slides](https://brezak.irpi.cnr.it/images/slides/tarboton_low.pdf)
  and [SAGA's flow accumulation](https://saga-gis.sourceforge.io/saga_tool_doc/9.4.1/ta_hydrology_0.html)).
  Hollows: Priority-Flood (Barnes, Lehman and Mulla 2014, [arXiv 1511.04463](https://arxiv.org/pdf/1511.04463)):
  flood in from the edges with a priority queue, O(n log n), twenty lines of pseudocode; a hollow
  deep and wide enough becomes a lake, the rest drain over their lip. Filled ground always has a
  way down, so a river reaches the sea or a lake and never runs uphill by construction. Red Blob's
  [mapgen4](https://www.redblobgames.com/maps/mapgen4) does the same in spirit: rain everywhere,
  only the bigger flows drawn as rivers ([rivers](https://www.redblobgames.com/maps/rivers/)).
- **Kinds of ground.** Whittaker's diagram places biomes by yearly warmth and rain; its lines are
  drawn by hand and differ from book to book ([Wikipedia, Biome](https://Wikipedia.com/wiki/Biome)).
  Red Blob uses height for warmth and distance to water for wetness. Chosen: warmth from the
  existing "latitude" setting less height; wetness from rain noise and nearness to water; the kind
  from those two plus height and slope. Fertility and ore then follow from the kind.
- **Holding a big land.** Every square in typed arrays (as now) is about 4 bytes a number: 500 km
  × 310 km is 2.5 million squares, ~10 MB a number. A land twice as wide is four times that.

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
there are no roads. Measured 2026-11-15 (item 1): houses are scattered over a village's ground
closer together than bodies fit, so a village of several hundred is a solid disc — at 5,000
people in eight villages, 87% of all steps are somebody failing to reach their bed or bench.
Item 1 made that cheap; it did not make it stop. This item should.
Left by 2b (2026-11-15): in a dense small land (2,000 people on 17 km) a person-step still costs
about three times what it does at 5,000 on 40 km, and what is left is the search for a way round
running out of its 800 tries — about 2,300 times a day at 650 µs — in a crowd that is always
moving, so that nothing remembered about it lasts. **Done when** for this item should include:
that row costs no more per person than the 5,000 row on `test/bench.mjs`.
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
Left by 2b (2026-11-15): somebody going short asks "whoever has most put by" in the village, and
finds them by reading every neighbour's larder (`choose`, "ask") — which nobody could know, and
which costs more the bigger the village (with bodies at real size it is most of what is left:
43 million larders a day at 20,000 people before item 2, still one read each now). When what a
person knows is held in slots, they ask among those they know of, and this cost goes with it.
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
| 2026-11-15 | 1 | Apple M1, 8 GB | 4.4 s a day, 68× | 21 s a day, 14× | 0.8 KB at the start (0.6 before) | `test/bench.mjs`; same world; a 20,000 start 25.7 → 2.6 s |
| 2026-11-15 | 1 | Intel Xeon 2.1 GHz (cloud), 16 GB | 9.1 s a day, 33× | 46.4 s a day, 6× | 0.7 and 1.1 KB at the start | the same engine as the row above, on the machine item 2 was built on: about 2.2 times slower than the M1 |
| 2026-11-15 | 2 | Intel Xeon 2.1 GHz (cloud), 16 GB | 3.5 s a day, 86× | 15.5 s a day, 19× | 0.3 and 1.1 KB at the start | same world; a person is looked at on 52% and 30% of steps; real-size bodies 10.9 → 3.4 s and 70 → 17 s; a year of the default world 368 → 173 s |
| 2026-11-15 | 2 | Intel Xeon 2.3 GHz (another cloud machine), 16 GB | 2.4 s a day, 127× | 8.6 s a day, 35× | 0.3 and 1.1 KB at the start | item 2 again, on the machine 2b was built on (nearly twice as fast as the row above's) |
| 2026-11-15 | 2b | Intel Xeon 2.3 GHz, 16 GB | 2.6 s a day, 117× | 5.7 s a day, 52× | 0.15 and 1.2 KB at the start | a person looked at on 22% and 9% of steps; **a seed is a different world from this row on** (the 5,000 row is one world against another; five seeds average the same either way); handed over in frames with the page's word costs no more than in one piece |
| 2026-11-15 | 2b | AMD Ryzen 5 3600 (the Windows desktop item 3 was built on), 24 GB | 2.6 s a day, 116× | 5.7 s a day, 53× | 0.20 and 1.15 KB at the start | the engine as item 3 found it, on the machine item 3 was built on; a 20,000 start 3.7 s |
| 2026-11-15 | 3 | AMD Ryzen 5 3600, 24 GB | 2.8 s a day, 106× | 6.0 s a day, 50× | 0.20 and 1.18 KB at the start | same world, and the same speed: run turn about with the row above three times, 20,000 people took 6.43, 6.43, 6.37 s before and 6.39, 6.45, 6.36 s after (this machine wanders 10% from one run to the next, which is all the two rows differ by); a year of the default world 123 s before, 124 s after, identical state. **In a browser, 20,000 people flat out:** the page 7 frames a second → every frame; the clock about 15× → about 37× in the same stretch |
| 2026-11-15 | 3b | AMD Ryzen 5 3600, 24 GB | *not run: the running world is unchanged* | *not run* | | starts only (`bench.mjs --start`), same world: 10,000 0.86 → 0.56 s, 20,000 3.55 → 1.52 s, 40,000 14.1 → 3.8 s, 100,000 102.6 → 14.9 s |
| 2026-11-15 | 4a | AMD Ryzen 5 3600, 24 GB | 2.92 s a day, 103× | *not run* | 1.6 MB, 0.31 KB | a **different world** from here on (the land). `--quick`: 400 people 0.31 → 0.29 s, 2,000 3.17 → 3.73 s, 5,000 2.50 → 2.92 s; five seeds of 2,000 on 17 km: 3.87 s old, 4.37 s new, 3.76 s new with no sea (the sea packs people closer; the engine is not slower). 1,000 km starts in 4.5 s (2,000 people) |
| 2026-11-16 | 4b | AMD Ryzen 5 3600, 24 GB | 2.45 s a day, 122× | *not run* | 2.5 MB, 0.48 KB | a different world from 4a's (pace and water change who goes where). `--quick` against 4a: 400 people 0.30 → 0.33 s, 2,000 3.68 → 3.30 s, 5,000 2.62 → 2.45 s. 1,000 km starts in 4.3 s, 785 MB after a day |
| | 2 | Apple M1, 8 GB | *to be measured* | *to be measured — about 7 s, 43×, by the ratio* | | run `node --expose-gc test/bench.mjs` on the Mac and fill this in |
