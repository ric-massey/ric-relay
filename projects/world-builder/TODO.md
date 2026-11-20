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

### [x] 5. Drawing the land so it can be read, at three zooms

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

Ric's answer (2026-11-16), shown six screenshots of one land (seed 3, 40 km) in two looks at
three zooms: **"Map colours"**, the brighter, clearer one, over "Natural" (darker, earthier, as
from the air) and over having both with a button.
Asked (2026-11-16) whether, on a land he had not seen (seed 26, 200 km, 64° north), he could pick
out sea, lakes, rivers, beach, marsh, grassland, forest, hills, mountains, dry land and snow and
ice without a key: **"Yes, all of them".**

**Done 2026-11-16.** Each kind its own colour and marks, relief shading, three ranges of zoom,
houses and fields nearer in, no people far out, zoom to 128 pixels a square, only what is on
screen drawn and kept in blocks; a 1,000 km land pans and zooms at the browser's frame rate.
**Not met:** the default view's frame is 0.03–0.06 ms over "no longer than now" (0.37–0.40 ms
against 0.32–0.34), the cost of the harvest-and-faction wash as its own picture (README,
"Drawing the land"). Left: houses are drawn, not real (item 7); zooming in past 128 pixels a
square, to a single house, waits for houses and smaller people (items 7 and 20).

Research notes:
- **Reading land without a key.** Imhof's *Cartographic Relief Presentation* is the reference:
  shading lit from the upper left, with colour tints for height ("the Swiss manner";
  [Wikipedia, terrain cartography](https://www.wikipedia.com/wiki/Hillshade)). Shading and areas
  are read with the eye's edge, points and lines need looking at (UNBC relief lectures,
  [2021](https://gis.unbc.ca/wp-content/uploads/2021/02/relief2021.pdf)). Chosen: each kind of
  ground its own colour, the relief shaded from the height, and nearer in each kind its own marks
  (tree crowns, reeds and pools, peaks, waves, furrows) so colour is never the only difference.
- **Hill shading:** 255·(cos zenith·cos slope + sin zenith·sin slope·cos(azimuth − aspect)), a
  sun at 315°, 45° up, slope and aspect from Horn's 3×3 gradient
  ([ArcGIS, how hillshade works](https://pro.arcgis.com/en/pro-app/2.7/tool-reference/3d-analyst/how-hillshade-works.htm);
  GDAL's defaults are the same). Heights exaggerated three times, as small-scale maps do.
- **Colour-blind readers.** ColorBrewer's colour-blind-safe qualitative palettes stop at four
  colours ([ColorBrewer](https://en.wikipedia.org/wiki/ColorBrewer)); for more classes the advice
  is shape or pattern as well as colour ([EU data visualisation guide](https://data.europa.eu/apps/data-visualisation-guide/colour-for-categories)).
  Eleven kinds of ground is too many for colour alone, so the marks carry it: water blue against
  land (safe for red-green blindness), forest dark with crowns, snow light, rock grey with peaks.
- **Drawing a big map cheaply.** Far out, one picture a pixel a square, smoothed; nearer, the land
  drawn once into blocks at the zoom's size (4 to 64 pixels a square) and kept while the view
  moves; what changes (harvest, who holds it) as a see-through wash a pixel a square on top. Only
  blocks on screen are drawn or kept (40 at most).

### [x] 6. Water people need and use

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

Ric's answer (2026-11-16): thirst **"Real, on by default"**: without water a person dies in about
three days, faster in heat; a setting, and with it off a world is exactly as before.
**Order (Ric, 2026-11-16): "Do 6"**, before the rest of item 7.
**Split** (2026-11-16): **6a** drinking water as a need: a household keeps water at home and
fetches it from a river or lake (the sea is salt), digs a well when water is far, and villages
start near fresh water; **6b** crops and rain: rain by place and by year, a dry year in the
harvest, river flats spared; **6c** fishing as a way to live; **6d** water as a road and a wall:
fords, boats, bridges, an army stopped at a river.

**6a done 2026-11-16.** Thirst setting (real by default, gentler, off); households keep and
fetch water, children from six too; wells dug where fresh water is over a kilometre off; villages
start near fresh water; off is exactly as before. A year holds on six seeds (372 alive against
382 off). **Not met:** the speed budget, 11 to 21% slower on three bench rows, the cost of a new
daily task. **Open:** traders stopped prospecting with water on (0 of 16 seeds against 2 of 16);
cause not found; the travel test runs water off. Comes with later parts: rain and dry years
(6b), fishing (6c), boats and bridges (6d).

**6b, 6c, 6d done 2026-11-16** (Ric: "6 just needs to finish"). **6b:** a year's rain by place
and year, more varied on dry ground, a dry year thinning the crop by about what the rain fell
short, river flats spared, rain filling the water pots; a dry year about one in five. **6c:**
villages by water fish, fish come back as real waters do, a fisher is a living. **6d:** big rivers
only at fords and bridges, villages build bridges and boats, people are rowed over, an army is
stopped by water. Each has a setting, and off is exactly as before. **The trader puzzle from 6a
was chance**: over sixty seeds a trader set off to look at another market in 7 with water against
4 without; the travel test runs with water on again. **Item 6 is done.** **Not met:** the speed budget on two rows: 20,000 people on 80 km 7% slower a day, 400 on 500 km 0.09 → 0.16 s; a walker at a bend in a big river sometimes falls back on the slow way-round search (README, "Fords, bridges and boats"). 6a's speed miss is mostly gone: the fields it added are now declared at birth. **Open:** a default 17 km land has no big river, so fords, bridges and armies stopped by a river show only on lands of about 100 km and up; a boat is built only where people keep wanting to cross, which on these lands is rare.

Research notes:
- **How much water.** About 20 litres a person a day is basic access, the quantity WHO ties to a
  source within 1 km or a 30-minute round trip; 50 to 100 litres is the UN's range for all
  domestic use; drinking alone is 2 to 4.5 litres ([UN, water](https://www.un.org/global-issues/water);
  Sphere's emergency minimum 15 litres, [Sphere](https://interactive.spherestandards.org/)). Chosen:
  a household uses 20 litres a person a day from what it keeps at home.
- **How long without it.** Roughly three to five days for an adult, one to two in heat above about
  32 °C, longer in cool damp weather (secondary sources agree on the range; none is a clinical
  study, which cannot ethically be done:
  [Discover](https://www.discovermagazine.com/how-dehydration-can-kill-you-in-a-matter-of-days-42297)).
  Chosen: about three days, faster in warm weather, as Ric chose.
- **Wells.** Hand-dug to the water table, lined as they go; medieval wells went past 8 m
  ([Evesham excavation](https://explorethepast.co.uk/2018/03/a-tale-of-two-structures-ovens-and-wells-in-medieval-evesham));
  a deep dry hole was "several months of lost time and labor"
  ([CUNY, wells](https://pressbooks.cuny.edu/gorokhovich/chapter/wells/)). No clean medieval figure for
  the work was found; chosen: about thirty person-days of digging, said as a guess.
- **Rain (6b).** Yearly rain varies by about 15 to 20% in wet temperate country and 30% and more
  in dry (the coefficient of variation rises as rain falls); a crop loses about as much as its
  water fell short, FAO's yield response factor for wheat about 1.0 to 1.15
  ([FAO Irrigation and Drainage Paper 66](https://www.fao.org/4/i2800e/i2800e.pdf)). River flats
  were farmed because floods water and enrich them. Chosen: as in the README, "Rain and dry years".
- **Fords and bridges (6d).** Fords were where a river ran shallow over gravel, and towns grew at
  them (Oxford, Frankfurt); a river draining a few hundred square kilometres is tens of metres
  wide. A timber bridge was weeks of a crew's work; no clean figure found, chosen 75 person-days,
  said as a guess, and 15 for a boat.
- **Fish (for 6c).** Natural waters yield roughly 20 to 50 kg a hectare a year (FAO,
  [inland fisheries](https://www.fao.org/4/x5744E/x5744e0q.htm)); medieval fish ponds were kept by
  monasteries for Lent; no medieval yield a hectare was found.

**Order changed (Ric, 2026-11-16):** "Move houses up: do item 7 (houses) and item 20 (people drawn
their real size) next, so zooming to a single house works sooner. Item 6 (water) waits." Item 20
in this list is in fact about memory (a person in plain number arrays); how big people are on
screen comes from the engine's body size (the "Bodies" setting), so showing people at their real
size when zoomed in is done here, with the houses.

### [x] 7. Houses, fields and roads as real things

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

Ric's answers (2026-11-16):
- **People at their real size by default: "Real size by default".** Half a metre wide, so nobody
  is in anybody's way and crowds stop jamming (the "Bodies" setting, default "real" from now).
- **Who owns the land:** "I think that this should differ. It should be a setting for each tribe.
  And the leader decides that or sometimes the people. Like different governments". So each
  faction has its own rule for land (the family, the village, the leader), chosen by its leader,
  or by its people where they rule themselves, and it can change.
- **Who builds a new house:** "Depends. Sometimes a family sometimes a builder."
- **Split** (2026-11-16), so the zoom to a house comes first: **7a** real-size people by default,
  houses as buildings with a real size that follows wealth, people asleep inside them, a village
  laid out in plots, and zooming in to a single house; **7b** building new houses, by the family
  or a builder, with work and goods; **7c** fields as land a household works, owned by the
  faction's own rule; **7d** paths that form where people walk and make walking faster.
- **Added to 7d (Ric, 2026-11-16: "Write them in", after asking whether people get boats, cars,
  bridges and roads, "probably same time as roads").** With roads come the things that run on
  them and on water: **carts and wagons** as real things a household or trader owns, built from
  goods, faster and carrying more on a road than off it (today a trader's "cart of grain" is only
  a number, `grainLoad`); and **better boats**, which 6d made as one rowing boat a village uses
  only to ferry people: boats that carry goods, trade along rivers and coasts, and are counted
  and lost like any other thing. Cars wait for item 15 (eras).

**7a done 2026-11-16.** People are half a metre wide by default; a house is a building with a
real size by the household's wealth, in plots round the village's middle; a family sleeps inside
it; the page zooms to 4,096 pixels a square with the ground's fine marks and the houses at their
true size; armies are raised from crafters when farmers run short. A default year holds (four
seeds, 16 starved against 10); 2,000 on 17 km now costs less a person than 5,000 on 40 km.
**Not met:** 20,000 on 80 km is 46% slower a day (7.40 → 10.78 s): nobody is jammed, so more are
busy, and with village stores emptier the search for a neighbour with grain looks through
everybody (README, "Houses"). That search is the first thing 7b looks at.
Comes with later parts: building new houses (7b), fields as land (7c), paths (7d).

**7b, 7c, 7d done 2026-11-16** (Ric: "Jump on 7. All of it plz"). **7b:** couples who marry into a
house with other grown-ups, or households too many for it, take an empty house or build one, by
floor area, with goods or gathered materials, themselves or with a paid builder; newcomers take an
empty house or a hut. **7c:** every faction's own land rule (families, the village, the leader),
chosen by its chief, its voters or you, or set for the world; families work their own fields first
and others' for half. **7d:** paths and roads worn in by walking and fading without it; carts owned
by traders; goods by boat along coasts and rivers; boats lost. And asking a neighbour for grain
made cheap (20,000 people 13.4 → 10.8 s a day). Ric's carts note: carts by traders only, farmers'
carts starved more. **Item 7 is done.** **Not met / open:** in a first year few houses are built (few couples marry into a crowded house that soon); boats carry goods only where two villages both have landings on the same water and the water is quicker, which on the default lands is rare; nobody builds a road on purpose, roads only wear in; 5,000 people are at the edge of the speed budget (5%).

Research notes:
- **A house and its plot.** Excavated medieval peasant houses: Houndtor (Dartmoor), 13th century,
  14.2 by 4.3 m with a living end about 6 by 4 m ([Legendary Dartmoor](https://www.legendarydartmoor.co.uk/2016/03/21/long_house/));
  across England, France and Germany rectangular, about 15 to 23 m long by 4 to 6 m wide; each on
  a toft with a garden and whatever outbuildings the family could afford
  ([encyclopedia.com](https://encyclopedia.com/history/news-wires-white-papers-and-books/farmers-and-peasants-building-peasant-communities)).
  A bigger house is not always a richer one (Ede, early medieval: the byre grew with the herd,
  [Leiden medievalists](https://www.leidenmedievalistsblog.nl/articles/bigger-isnt-better-why-a-large-house-doesnt-mean-more-wealth-an-early-medieval-example-from-the-central-netherlands)),
  but Ric wants size to follow wealth, and it broadly did.
- **A household's land.** The virgate (yardland), a common peasant holding: nominally 30 acres
  (about 12 ha), 24 in later court rolls, often half that; many held a ferling, 7.5 to 8.75 acres
  ([Wikipedia, Virgate](https://en.wikipedia.org/wiki/Virgate); [Milton Abbas](https://miltonabbashistorygroup.com/medieval-peasant-life-in-milton-abbas-landholding/)).
  A 250 m square is 6.25 ha: a holding is one to two squares.
- **Building (7b).** Peasant houses in later medieval England were mostly put up by carpenters,
  in weeks, for a few pounds (Dyer, *English peasant buildings in the later middle ages*, 1986); no
  clean figure in person-days was found, so the work by floor area here is a guess. Couples in
  north-west Europe set up their own household at marriage (Hajnal, 1982), the reason a married
  couple living with others builds.
- **Who works whose land (7c).** Open-field villages held land by household in strips, with
  commons besides; harvest workers were paid in sheaves; on a manor, labour and rent in kind went to
  the lord.
- **Carts and boats (7d).** An ox cart about 3 km an hour on a good road and much slower off one; a
  small sailing and rowing boat about 6 km an hour along a coast.
- **Paths from use.** Helbing, Keltsch and Molnár, *Modelling the evolution of human trail systems*
  (Nature 388, 1997) and the active walker model (Phys. Rev. E 56, 1997,
  [arXiv](https://arxiv.org/abs/cond-mat/9806097)): walkers wear the ground where they go, worn
  ground is pleasanter and attracts walkers, wear fades without use; pedestrians, steering to a
  destination, make a minimal-detour system. Chosen when paths are built: wear a square for each
  footstep, fade it daily, a path where wear passes a line, faster walking on it.

### [x] 8. Villages that become towns and cities

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

Ric's answer (2026-11-17): a city far out is **"Houses, then a block"**: every house as far out as
they can be told apart, then one block the size of its built-up area.

**Done 2026-11-17** (Ric: "Yes, item 8"). A place is a village, a town (400) or a city (5,000) by its size; it has room for as many as the food brought into it feeds besides its own rule; market day takes spare food to the biggest place near that is short; towns and cities lose more to sickness; "Where they live at first" chooses hamlets, villages, market towns or a city; far out a town is one block (Ric: "Houses, then a block"). On rich land a village grew into a town in a year without being told to, on poor land none did; a city at the start was not fed and shrank. **Not met / open:** food is hardly ever carried into a town (prices differ little between places after a harvest, and the loads people carry are small), so towns grow by keeping people rather than by drawing grain from round them; a city of half the people cannot be fed; the 400-people-on-500-km row is 0.02 s a day slower.

**Food supply fixed 2026-11-17** (Ric: "Fix food supply"). Prices were the same everywhere (every
store empty, so every price at its top), a market load could only be sold to an empty till, loads
were five days, and a war anywhere kept everyone from market all winter. Now market day goes to a
town whose households are going short, sells door to door to them at 1.2 coins a day's food, carries
a handcart load, and counts fear at half on the road to one's own town. Rich land, a year each way:
a starting city 363 starved against 511 with 15,000 days sold in; from villages 57 against 122, a town
of 415 at the year's end, 12,200 days sold. Default world unchanged (16 starved a world against 17).
Still open: a city of half the people (the land round has a quarter of what it needs to spare, and
its money buys less). Item 8's "101 starved" was the total of six worlds, 17 a world.

Research notes:
- **How many lived in towns.** Before modern farming rarely more than a tenth to a fifth of a
  people: Europe about 1500 about 10% in towns of 5,000 or more, the Low Countries and Italy more
  (de Vries, *European Urbanization 1500–1800*, 1984; Bairoch, *Cities and Economic Development*,
  1988). England's small towns held about 300 to 2,000 (Dyer). Chosen: a town from 400, a city from
  5,000.
- **How city sizes are spread.** Roughly by rank, the second about half the first, the third a
  third (Zipf's rank-size rule), with a capital often above it (a "primate city"). Not imposed here:
  sizes come from the food that reaches each place.
- **What a town needed from its countryside.** Its grain: by land a bulk load went little more than
  20 to 30 km before carting cost more than it was worth, by water much further; London about 1300
  drew from some 60 km round (Campbell, Galloway, Keene and Murphy, *A Medieval Capital and its Grain
  Supply*, 1993); a market town from the villages a day's walk round, on market day.
- **Why cities lost people to disease.** Crowding, foul water and imported infections: burials in
  London exceeded baptisms through the 17th and 18th centuries and it grew by migration, about 8,000
  a year by 1700 (Wrigley, "A simple model of London's importance", 1967). Chosen: one death more a
  hundred a year in a town, a little over two in a city.

### [x] 9. Materials and other ways to live

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

Ric's answers (2026-11-17, "Start item 9"): materials **"Few and clear"**: wood, stone, ore, cloth
(from wool), and food as grain, fish and meat; forest gives wood (houses, carts, boats, fuel), hills
stone (walls, wells, bigger houses) and ore (tools, weapons), grass wool (cloth, clothes, packs),
water fish, forest meat by hunting, grass meat and milk by herding. Firewood **"Yes, as a setting"**:
cold makes people burn wood, without it they sicken or die in a hard winter; a setting turns it
off and leaves the world as it was.

Split, as items 6 and 7 were:
- **9a. Wood, stone and ore.** Cutting wood, quarrying and mining as livings weighed in `choose`
  like fishing; each village's store holds them at a price; houses are built of wood or stone, and
  what crafters make uses them; tools and weapons need ore, carts wood. A setting, "Materials",
  real or one kind of goods as before (identical world).
- **9b. Herding and hunting.** Meat and milk from grazing on grass, meat from game in forest that
  runs out when overhunted; wool, spun into cloth for clothes and packs.
- **9c. Firewood.** A household burns wood in the cold, fetched or bought; without it, sickness and
  death in a hard winter. Its own setting.

**Done 2026-11-17** (Ric: "Start item 9"; "Few and clear"; firewood "Yes, as a setting"). 9a wood, stone and ore cut, quarried and mined within 4 km, weighed like any work, sold to the store at what it is short of; houses of wood or stone; crafters work wood, ore and wool; tools and weapons take ore, carts wood, packs wool, shields wood or hide; traders carry them. 9b herding on grass, dry land and hills (food, wool, hides) and hunting in forest (meat, hides; game runs out). 9c firewood burned in the cold from the store, dear in autumn, the cold killing the young and old where there is none; turf and dung on treeless land. Settings "Materials" (off: one kind of goods, the world identical) and "Firewood". A forest village and a village by water live differently without being told to (`test/materials.test.mjs`). **Not met / open:** a year costs about 11 alive a world against before (about 7 to the cold, the rest within the run-to-run spread); battle deaths 137 against 124 in six worlds, from wars falling differently; the 2,000 and 5,000 rows are about a tenth slower and the 500 km row half again (more walking); the store still piles up hundreds of goods, as it did before; a household's firewood is the village's, not its own; stone is used only for houses (walls are item 14).

Research notes:
- **What a day of each work gave.** A woodcutter cut and split about a cord (3.6 m³ stacked, near
  two tonnes) a day with an axe; managed woodland regrows some 3 to 5 m³ a hectare a year (coppice),
  so a 6.25 ha square gives about twenty cords a year and a forest is a slow stock, not endless.
  A quarryman broke a cubic metre or two of rough stone a day; a medieval miner some hundreds of
  kilograms of ore. Chosen: a day's work at good ground is one "load" of each; wood comes back at
  a square's yearly growth, stone and ore do not run out (an ore square gives as rich as it is).
- **How many each worker supported.** Before modern farming four out of five worked the land, one
  farmer feeding about one and a quarter (item 8 notes); a forest or a quarry fed nobody directly,
  so those livings live by selling to the store, as the bench does, at what the village is short of.
- **What a house took.** A timber-framed cottage some 10 to 20 m³ of timber, a hall many times that;
  stone where wood was scarce or for the rich. Item 7b's "goods" for a house become loads of wood,
  or stone where the village has it.
- **Item 2 of "Ric's next list" in PEOPLE-VISION**: "materials become goods, goods become
  equipment", demand tied to household needs and gear replacement, a ledger of production and stock.

### [x] 10. The ten traits, and events that move them

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

Ric's answers (2026-11-17, "Start item 10"): how fast traits move **"A little"** (a raid or famine
moves a trait about a twentieth of its range, about half of that fades over some years, children
start near the parents' new number); setting them **"Ten sliders"**, one per trait's average in a
"Their nature" group with "How much they differ"; a fight between neighbours kills **"Rarely, as
in history"** (about 1 in 4,000 people a year, the dead person's family holding a grudge).

**Done 2026-11-17.** Patient, hot-tempered, hardworking, curious and honest added, each changing a
choice in `choose` (and the old choice at its middle): the hardworking work more against resting
and visiting; the curious do other trades, move and scout; the patient keep more back for the
winter and fill the larder before it, and bide their time; the hot-tempered go and have it out
with those they cannot stand, and sometimes come to blows (one fight in a thousand kills); the
dishonest steal from a neighbour's larder when hungry with nothing to pay. A raid, three days
without food, a death in the family, being robbed and a good year each move traits a few
hundredths; half wears off, half again every two years. Ten sliders; the person panel shows all
ten. Each person's first four traits are drawn as before. **Not met / open:** 20,000 people on
80 km is 9% slower (the old ask-a-neighbour search, with more people short; item 11 replaces it);
memory 0.67 → 0.80 KB a person; Honest moves no hours until people go hungry (0.8% over 200 days); starved 19 a world against 15
in twelve worlds, within the spread; grudges still live in the friends list (item 11), so a
feud is only as long as memory holds it; fights are between neighbours of one village only.

Research notes:
- **Which traits predict which choices.** Honesty-humility (HEXACO, Ashton and Lee) predicts
  cheating and stealing when it pays (Hilbig and Zettler 2009); conscientiousness effort and
  hours; openness moving away (Jokela 2009) and changing work; trait anger aggression when
  provoked (Bettencourt et al. 2006). So each new trait gets the one choice it is known for.
- **How much is inherited.** About 40% of personality differences (Vukasović and Bratko 2015,
  twin studies; Polderman et al. 2015, about half for human traits in general). The engine's old
  rule — the parents' mean and a stray set by "How much they differ" — is kept for all ten.
- **How much events change a person, and for how long.** Small and partly lasting (Bleidorn,
  Hopwood and Lucas 2018; Jeronimus et al. 2014: bad events raise neuroticism a little, some of
  it for years). War: more cooperation within one's own group (Bauer et al. 2016), more
  impatience and risk-taking (Voors et al. 2012, Burundi). Hard times leave people more careful
  for life (Malmendier and Nagel 2011). Chosen with Ric's "A little": a few hundredths per event,
  half fading with a two-year half-life.
- **Killing.** 13th- and 14th-century England, about 20 to 25 homicides a year in 100,000 (Given
  1977; Eisner 2003): one in about 4,000.

### [x] 11. The mind: a fixed number of things a person holds

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

Ric's answers (2026-11-17, "Start item 11"): **20** things by default; people differ **"A
little"** (a quarter either way, from birth, taken after the parents); **"Grudges last longest"**
(a friendship not kept up halves in about a year, family and grudges in about five, news in a
season).

**Done 2026-11-17.** Each person's mind is a fixed number of slots in four flat arrays shared by
the world: friends and grudges, family, news, larders seen with food to spare, debts for food,
and what they think about sharing. A full mind forgets its weakest (grudges and family counting
double); things fade by their age when read. Asking for food goes to those one knows of; a debt
is paid back; a grudge turns a chat cold. The person panel lists what somebody holds in plain
words. **Not met / open:** right after a world is made a person takes more (the bench: 0.80 → 1.29
KB; the minds are there from the start); once it has run a few days, 0.7 KB less. People move house more (248
moves a world-year against 168). Friendships saturated (somebody who chatted daily called twenty people close); 2026-11-18,
Ric "do 5": five close at most, the least close dropping back when a sixth comes (fights up, 313
a world-year against 220; minds still full, so no memory saved). Then
"fix the grudges": a refusal of food no longer makes an enemy (grudges 1.1 an adult against 5.1,
fights 51 a world-year against 313, starving unchanged; fight lethality reset to the medieval rate). News held is only
the newest; who has food is only seen, never told — passing what one holds is item 12.

Research notes:
- **How many, and in layers.** About 5 closest, 15, 50 and 150 (Dunbar 1993; Zhou et al. 2005).
  Twenty slots: the inner two layers and a handful of things known.
- **How memories and ties fade.** Closeness falls without contact, friends much faster than
  family (Roberts and Dunbar 2011); forgetting falls off with age (Ebbinghaus; Wixted 2004). Bad
  is remembered longer than good (Baumeister et al. 2001).
- **Fixed-size storage that costs nothing to copy or scan.** One block per person in flat typed
  arrays (struct of arrays); the dead's blocks reused; fading read off the age, so nothing is
  touched as time passes.

### [x] 12. Talking as passing what you hold

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

Ric's answers (2026-11-18, "Start item 12"): how often things are passed on wrong, **"1 in 20"**;
gossip about people, **"Yes, cools only"** (hearsay never makes an enemy).

**Done 2026-11-18.** Only those within 3 km see an event; everybody else hears it in a chat,
believed as far as they trust the teller, and 1 time in 20 changed in the telling (a number, a
village or a side swapped); the changed telling travels as the true one. News of a war or a
village taken blames the side as told. The hungry who are turned away are told where there is
food. Gossip cools or warms the hearer toward a third person. Children start with a weaker copy
of some of each parent's mind. The person panel follows each piece of news back to whoever saw
it. Met: news reached villages 36–54 km away in 1.5–4 days; two villages believed different
tellings in three of four worlds; what is said is what is held (tested). **Not met / open:**
people act only on news of wars and villages taken, and on where food is (12b). In a full mind
news is often the weakest thing, so it is forgotten within days. Past 400 hearings an event's
trail is kept only for the people who still hold it. Fights rose (66 a world-year against 55),
from children taking on their parents' grudges.

Research notes:
- **How rumours change.** Leveling, sharpening, assimilation (Allport and Postman 1947): in
  laboratory chains much is lost at each telling; field studies find much less, and rumours in
  organisations mostly accurate (DiFonzo and Bordia 2007). Hence 1 in 20, a slider from never to
  1 in 3. https://en.wikipedia.org/wiki/Rumor ;
  https://www.rit.edu/news/truth-about-rumors-and-why-we-believe-them
- **How they spread.** Daley and Kendall (1965): ignorant, spreader, stifler; spreading by
  pairwise contact, stopping when the spreader meets those who know. Here: the newest news
  goes to whoever is met and has not heard it; it stops being told when forgotten.
  https://www.emergentmind.com/topics/daley-kendall-rumor-model
- **What is passed on best.** Gossip about people, over facts about things (Mesoudi, Whiten and
  Dunbar 2006).
  https://research-portal.st-andrews.ac.uk/en/publications/a-bias-for-social-information-in-human-cultural-transmission/
- **Parents' feuds.** Beliefs about conflict correlate strongly between parents and children
  (Psihologija 2021); no figure found for blood feuds as such.
  https://doaj.org/article/6f74e2ee67174a7e8b9d2729a97ae7af
- **How fast news went on foot.** No sourced figure for village word of mouth; royal riders
  covered up to about 100 miles a day. Here it goes as fast as people meet.
- **Chosen, and its cost.** Two more numbers per slot (who told them, which telling), 5 bytes;
  the tellings on the event; who told whom on the event for a year. Talking costs only when two
  people meet, as before.

### [x] 12b. Acting on more of what is heard

**Done 2026-11-19.** News of a sickness keeps people from the village their telling names (moving,
going hungry, market, trade); a household with close family elsewhere leaves a sick home for them
one time in five and comes back a week after it ends; news of a famine keeps movers away and sends
family with food; a new "Food is dear in V" and the old dry-year news pull traders' food and grain
half as hard again. Met: trips set out for A by outsiders in 30 days, told the sickness is at A
1, told it is at B 9; trips to B 206 and 10 (`test/heard.test.mjs`). Default year, eight seeds: starved 12 → 16, sick deaths 115 →
109, 18 left for a sickness, 106 days of food carried to family, traders' grain 72 → 504. Speed the
same. **Not met / open:** few have family in another village in a world's first years, so flight
and help are rare early; news of a good harvest elsewhere is not a thing yet (only dear food and
dry years); traders still see every price within reach (Ric's choice).

**Now:** people act on news of wars and villages taken (as a grievance) and on being told where
there is food.
**Do:** news of a famine sends relatives to help or people away from the place; news of a
sickness keeps people from the village it is in; news of a good harvest or high prices draws
traders. Each read from what the person holds, so a wrong telling sends them the wrong way.
**Ric decides:** which kinds of news people act on.

**Ric's answers (2026-11-19):**
- Which news: "Sickness", "Famine", "Prices and harvests" (all three).
- Traders, who see every village's prices within reach: "Keep it, news adds a pull".
- Hearing of a sickness in one's own village: "A few, to family" leave for a while.
**Done when:** a changed telling of where a sickness is moves people measurably differently from
the true one.
**Budget:** default.

Research notes:
- **What the engine has now (2026-11-19).** Events people can hold and pass on include "A sickness
  has started in V" (`sick`), "V is starving" (`famine`) and "A dry year for F … about N%"
  (`dry`); a wrong telling can swap the village or the number. Only war, taken and feud news is
  acted on (`actOn`: a grievance). Where to move house, where to go when hungry and where a
  trader carries a load are all chosen from every village's true store and prices within reach
  (`choose` "move", the hungry move, `bestRoute`): nobody needs to have heard anything.
- **Sickness.** Early modern Italian cities issued health passes (fedi di sanità) to show a
  traveller came from a place free of plague, and turned away people and goods from places
  reported infected; Venice had its travellers and envoys report any news of contagion so trade
  could be steered round it (Bamji, *Social History of Medicine* 2019,
  https://eprints.whiterose.ac.uk/123540/1/Bamji%20SHM%20Health%20passes.pdf; Duke collection of
  bills of health 1630-1818, https://archives.lib.duke.edu/catalog/italpubhealthdocs). England in
  1665 controlled travel, York's innkeepers reporting every arrival (search summary; see also
  Udale on Bristol household quarantine, https://blogs.lse.ac.uk/economichistory/2022/11/18/household-quarantine-in-bristol-1565-1604).
  So what kept people from a place was the report of sickness there, true or not.
- **Famine.** In the Somali famine of 2011 people's social connections decided who coped, though
  the same networks did not always carry everyone (Maxwell et al., *Food Policy* 2016,
  https://pmc.ncbi.nlm.nih.gov/articles/PMC5176329/); in Kagera, Tanzania, migrants cut their own
  eating to send to relatives at home in need (De Weerdt and Hirvonen, IFPRI,
  https://www.ifpri.org/blog/how-migrants-africa-maintain-economic-and-social-links-home-villages);
  among the Dinka chiefs call on the starving family's own relatives first (World Peace
  Foundation, https://worldpeacefoundation.org/blog/an-exceptional-farmer-who-survived-a-famine-my-aunt-mary-ajok-south-sudan/).
  Help goes along family ties, to those one hears are in need.
- **Prices and traders.** Where traders cannot know prices elsewhere, prices between markets
  stay far apart and goods go to waste; when Kerala's fishermen got phones, the spread nearly
  vanished and waste stopped (Jensen, *QJE* 2007, https://econpapers.repec.org/RePEc:oup:qjecon:v:122:y:2007:i:3:p:879-924;
  questioned on who had phones, Srinivasan and Burrell 2013,
  https://www.ischool.berkeley.edu/node/7017). Medieval merchants ran on letters: the Datini
  archive holds over 100,000, and its factors at Caffa wanted to sail for Tuscany on news that
  grain had risen there (MAIASP 2022, https://en.maiask.ru/data/documents/14_EvstiuninENG.htm).
  A trader goes where they have heard it is dear.

### [x] 13. Leaders and factions that deal with each other

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

**Done 2026-11-18.** A setting, "How the factions start": old friends (allied, trading free of
tax), strangers, old enemies (a feud every grown-up grew up knowing, held as long as a grudge,
passed to their children). An old bond between factions that opinion drifts toward and that
fades over a generation. Demands for tribute, tribute paid and stopped, alliances against a
common enemy or between old friends, allies called to war, trade deals free of tax; all from
the page too, when ruling a faction. A leader's temper, patience, warmth, honesty and boldness,
and what they hold against the other side, decide; half as much for an elected one. Leaders are
chosen for prestige as well as boldness; a people who have turned on an elected leader vote
early. A preset, "Two old enemies". Met: hot-tempered leaders spent 1,790 days at war against
patient leaders' 426, over six seeds, with 32 killed against 8 (`test/dealings.test.mjs`, in
the slow lane); the preset gives two hostile factions with a coin a head. **Not met / open:**
peace by marriage between leaders' families (PEOPLE-VISION, war, item 8) is not here; tribute
is a share of stores, not a number agreed; the leader's choices are rules weighted by their
traits, not plans; trade deals form between almost every pair of neighbours at peace.

Research notes:
- **Who leads.** Dominance and prestige both: strength and kin support, generosity, skill,
  trustworthiness (von Rueden et al. 2008, 2014, Tsimane).
  https://www.gurven.anth.ucsb.edu/sites/secure.lsit.ucsb.edu.anth.d7_gurven/files/sitefiles/papers/vonruedenetal2014hn.pdf
- **Removing them.** Ridicule, disobedience, in the end the end of their leadership (Boehm
  1993). https://www.Gwern.net/doc/sociology/intrasexual-aggression/1993-boehm.pdf
- **Peace between neighbours.** Trade, intermarriage, shared ceremonies (the Upper Xingu); trade
  can also cause wars. https://pmc.ncbi.nlm.nih.gov/articles/PMC4250129
- **Leaders' nature and war.** Leaders' traits predict war, more where nobody checks them
  (Horowitz, Stam and Ellis 2015). https://cambridgeblog.org/2016/03/what-motivates-leaders-to-go-to-war/
- **Chosen, and its cost.** Five numbers more per pair of factions; a leader's mind is read only
  when they weigh a war. No cost per person.

### [x] 14. War true to its time, and what it leaves

**Done 2026-11-20**, in five parts (14a–14e below): wartime effort where the danger is not, what a war leaves, why wars start and end, peace by marriage, trade deals and tribute, and walls, raids and a fighting season. **Left out** across them: weapons, reach and deadliness by era and how far an army can go (item 15); crafters turning to gear for the soldiers; a page button to offer a marriage.

**Now:** wars start and end, soldiers are real people, gear wears, armies eat from home.
**Do:** why a war starts and ends comes from what people and leaders hold in mind. Walls, sieges
and raids. Afterwards: the dead missing from their households, widows and orphans, burned
buildings, lost harvests, people fleeing, land changing hands, grudges that last and fade. A new
leader can end a war their predecessor began. Ric: "i want war to be accurate to the time and i
want the aftermath of war to be accurate too."
**Wartime effort, not only fear** (added 2026-11-17; Ric: "wartime fear should be bad but that
should also make people do stuff as well like try harder for more supplies and stuff… civilizations
have more inginuit and push to accomplish things nduiring wartime", and "fold into 14"). Now
`p.fear` rises for everybody in a faction at war anywhere, however far off, until it is full, and
it only ever counts against work (fields 0.7, fishing 0.7, the bench 0.5, carrying 0.8, market 0.4
to 0.8) — so a faction at war sits at home and grows poorer. Found while feeding towns: it stopped
every market day from harvest to spring. Split it in two:
- **Danger near** (a siege on one's own place, enemies seen, being hit): hide, flee, leave the
  fields, markets close — as now, but only where the fighting is.
- **A war on** (anywhere): people push — put more by for the winter, rest a little less, keep
  farming, carting and going to market, crafters turn to gear for the soldiers, more join up,
  walls go up, the leader taxes harder. Its cost is hands away and what is taken, not idleness.
Research: how far from the front work went on as before; what war economies stored and built
(town walls raised in wartime, siege stores; "Dig for Victory").
Done when, besides the below: a faction at war away from the fighting stores and works more, not
less, while a place under siege still empties its fields.
**Left over from item 13** (added 2026-11-18; Ric: "Add them"):
- **Peace by marriage** between leaders' families (PEOPLE-VISION, war: "Peace: a new leader, a
  treaty, tribute, a marriage, and whether it holds"), and whether it holds.
- **Trade deals are too easy:** they form between almost every pair of neighbours at peace. Make
  them need real trade between the two (sales across the border), not just liking.
- **Tribute is a fixed share** of stores and treasury. Make it an amount the two sides agree,
  weighed against what a war would cost.
Done when, for these: peace by marriage happens in some worlds and sometimes fails; under half of
neighbouring pairs at peace have a trade deal in a default world; tribute differs with how
lopsided the two sides are.
**Research first:** how many died in battles and how many from hunger and sickness around them;
how far an army could go from its food; how long places took to recover; what refugees did.
**Ric decides:** nothing up front.
**Done when:** a war measurably thins the next harvest and the next generation; a war begun under
one leader can end under the next without any rule saying so; `test/rule.test.mjs` still holds.
**Budget:** default.

**Split** (2026-11-19, "start item 14"), so each part is finished properly:
- **14a Wartime effort, not only fear.** Fear only where the danger is (a siege on one's own
  place, enemies at its edge, a raid on it lately, a blow); a war elsewhere makes people push.
- **14b What a war leaves.** Burned houses and fields, lost harvests, the dead missing from their
  households, widows and orphans taken in, people fleeing and coming back, land changing hands;
  a war measurably thins the next harvest and the next generation.
- **14c Why wars start and end.** Read from what leaders and people hold in mind; a new leader
  can end a war; a place taken is held, not lost again the next week. (Split again 2026-11-19:
  walls and raids are 14e.)
- **14d Peace and dealings left from item 13.** Peace by marriage, trade deals that need real
  trade, tribute as an agreed amount.
- **14e Walls, sieges and raids.** Walls raised in wartime; raids as well as sieges; fighting
  seasons and an army a people can keep; weariness that knows who is winning (added 2026-11-19).

### [x] 14a. Wartime effort, not only fear

**Done 2026-11-19.** Fear only from danger at one's own village (a siege, enemy soldiers at its
edge, a raid on it in the last three days, a blow). A war elsewhere makes people want to provide up
to a fifth more, rest a little less, and their village aim for a store a quarter bigger. Forced
wars, six seeds: away from the fighting, hours at work 23% → 51% (the faction at peace: 51%),
afraid 96% → 5%; with enemies at the door still 28% at work, 92% afraid; the two sides at war held
28,700 → 39,100 days of food after 60 days. A default year, eight seeds (at war about half the
year either way): starved 116 → 47, alive 2,822 → 3,017, killed in battle 176 → 113, villages
taken 19 → 11, births 122 → 147. Bench unchanged. **Not met:** "works more" than a faction at
peace: it works as much (51% against 51%), with more of its hands in the army. **Left out:**
crafters turning to gear for the soldiers, and walls raised in wartime (14c).

**Now:** see the paragraph "Wartime effort, not only fear" in item 14.
**Done when:** a faction at war away from the fighting stores and works more, not less, while a
place under siege still empties its fields.
**Budget:** default.

Research notes (2026-11-19):
- **The damage of a medieval war was a band, not a country.** A chevauchée burned a strip some
  20–40 km wide along its line of march (John of Gaunt's 1373 column on a 20 km front); people in
  its path fled to walled towns and castles, and those away from it saw little.
  https://EN.wikipedia.com/wiki/John_of_Gaunt%27s_chevauch%C3%A9e_of_1373 ;
  https://historyskills.com/classroom/year-8/chevauchee
- **Wartime builds.** English towns asked for murage (a toll for building and mending walls) when
  the enemy was near or had just landed (Winchester; New Winchelsea 1415, "the frontier of the
  king's enemies"; Canterbury, five grants 1378–1402). Walls are 14c.
  https://www.wikipedia.org/wiki/Murage ; https://gatehouse-gazetteer.info/murage/mur/441.html
- **Growing more at home in a war.** Britain 1939–45: vegetables up about 55%, potatoes about 80%,
  allotments from about 815,000 to 1.4 million (popular histories; official totals not found).
  https://www.history.co.uk/article/how-brits-utilised-allotments-during-two-world-wars-the-era-of-growing-your-own ;
  https://trmt.org.uk/local-history/marking-ve-day-80-in-2025/feeding-the-nation-dig-for-victory
- **Chosen, and its cost.** Fear comes only from what is at one's own village: a siege, enemy
  soldiers at its edge (counted already, once a day, for the siege), a raid on it in the last
  three days, a blow. A war anywhere instead adds to wanting to provide, to the winter store a
  village aims for, and takes a little off rest. The army, the levy and the leader's tax already
  grow in a war (item 13 and before). No cost per person: whether a faction is at war is
  worked out once an hour, not looked up through every other faction at each choice.

### [x] 14b. What a war leaves

**Done 2026-11-19.** Where enemy soldiers stand at a village's edge the standing crop is spoiled
(10% a day green, up to 60% ripe); while they hold the upper hand by the siege's measure, houses
burn (a household loses half its food to them, sleeps in the ruin and rebuilds; drawn charred on
the page); a place taken is sacked; households run from a siege to their own side and come home
a week after the enemy left. Met: forced wars, six seeds, harvest in year two 212,000 → 167,000
against wars off, births 175 → 111 (both were already lower before this item: 170,000 and 113).
Default year, eight seeds: starved 47 → 72, villages taken 11 → 25, harvest and births the same;
bench unchanged. **Open:** villages change hands back and forth very often in a long war (131 times
in six worlds over two years, 222 before this item): that is item 14c, why wars end. Most of those
who flee in a default year are still away at its end, because its wars do not end. Widows do not
remarry sooner or later for the war; the dead's places in households are filled only by births.

**Now** (2026-11-19): the dead leave heirs, grief and orphans who are taken in; a widowed partner
grieves; a village taken changes hands with some of its people fleeing for good. Armies do nothing
to the land they stand on, and nobody runs from one except at the moment a place falls.
**Do:** crops spoiled and houses burned where an army stands; a place taken sacked; people
fleeing an army to their own side and coming home when it has gone.
**Done when:** a war measurably thins the next harvest and the next generation.
**Budget:** default.

Research notes (2026-11-19):
- **Who died of a war.** The Thirty Years' War: about 4.5–8 million dead, of whom most were
  civilians and soldiers dead of disease and hunger, not battle; one critique finds battle deaths
  cannot explain any substantial part of the loss, and hunger driving disease does
  (germanhistorydocs.org, "Estimated casualties during the Thirty Years War";
  https://eprints.whiterose.ac.uk/id/eprint/385/1/outramq1.pdf). Here: no deaths are added by
  rule; they come from the harvest spoiled, the store taken and the crowding of refugees.
- **What armies did to the land.** Raiders destroyed crops and houses, stole livestock and fed
  themselves on it; people fled in masses to walled towns and castles
  (https://historyskills.com/classroom/year-8/chevauchee ; https://www.wikipedia.org/wiki/Chevauchee).
  Jean de Venette: villages burned, people plundered; a historian of the period compares the
  fleeing to today's internally displaced (https://www.medievalists.net/2009/12/the-experience-of-civilian-populations-during-the-hundred-years-war-in-france-1330-1440/).
- **Grain burns only when ripe.** Grain in the field can be cut, trampled or burned, and burns only
  in a short window when ripe and dry; green grain will not (Thorne, GRBS,
  https://grbs.library.duke.edu/index.php/grbs/article/download/1861/3491/0 , on Hanson's
  *Warfare and Agriculture in Classical Greece*, who argues it rarely caused famine).
- **How long it lasts.** The Harrying of the North, 1069–70: Domesday (1086) still listed about 60%
  of Yorkshire holdings as waste; decades to recover (https://EN.wikipedia.com/wiki/Harrying_of_the_North).
  Here recovery is not a number: burned houses are built again by their households (item 7b), a
  village everybody fled stands empty for them, and the fields grow back as they always do.
- **Chosen, and its cost.** Once a day, for each village with enemy soldiers at its edge (already
  counted for the siege): each soldier spoils a share of the standing crop on its square and the
  eight round it, 10% a day when green up to 60% when ripe; while they outnumber the village's own
  soldiers there, a house burns for about every ten of them, the outermost first, its household
  losing half the food in it to the soldiers; a place taken loses half its store and a quarter of
  its houses. Households run, the frightened and the less bold first, to the nearest village of
  their own faction with no enemy at it, and come home a week after the last enemy left. Nothing
  per person; only villages with enemies at them do any work.

### [x] 14c. Why wars start and end

**Done 2026-11-19.** Each side remembers whose leader began the war; that leader, or their parent,
child or partner, keeps the old mark for peace, and anybody else makes peace sooner (Croco). The
leader's own grudges and their people's (thirty read a day) keep a war going, no more than temper does. A
place taken keeps half its takers as a garrison for a year. Fourteen worlds, two years: peace per
thousand war-days under the leaders who began it 0.12 → 0.22, under a new leader 2.2 → 4.9; places
changing hands 190 → 100, taken back within 90 days 80 → 29; starved 248 → 179; default worlds' wars
ended 14 → 26. `test/rule.test.mjs` holds; bench unchanged. **Open:** forced wars between two
evenly matched sides still mostly outlast two years (3 of 13 ended); the people's grudges were tried
in starting wars too and taken out (they made patient leaders as warlike as hot ones); walls and raids are 14e.

**Now** (2026-11-19): a leader goes to war on grievance, land, hunger, greed for a richer
neighbour and what they hold against the other side (item 13); they make peace when weariness (the
dead a head, the years, the hungry) passes a mark set by their boldness, temper and the
aggression setting, and the other side accepts if weary or outmatched. Who began the war plays no
part, and what the people hold plays none. A place taken is easily taken back: 14b measured 131
captures in six forced-war worlds over two years.
**Do:** a war's end read from who the leader is and what they and their people hold; a new leader
can end a war without a rule saying so; a place taken is garrisoned.
**Done when:** a war begun under one leader can end under the next, measurably more often than
under the leader who began it; places change hands back and forth less; `test/rule.test.mjs`
still holds.
**Budget:** default.

Research notes (2026-11-19):
- **Who ends wars.** Croco, "The Decider's Dilemma" (APSR 2011) and *Peace at What Price* (2015):
  a culpable leader — one in office when the war began, or who came to power mid-war with a
  political tie to one who was — is far less ready to end it, fearing punishment for a bad
  outcome; a non-culpable leader is more ready to accept the compromise that ends it.
  https://www.cambridge.org/core/journals/american-political-science-review/article/deciders-dilemma-leader-culpability-war-outcomes-and-domestic-punishment/509114969EBDD6FAC6DA9323744CDFB4
  Leader turnover made interstate war termination more likely, 1816–2006 (Quiroz Flores et al.):
  https://lup.lub.lu.se/search/files/37690562/2017_11_Quiroz_Flores_Ba_ck_von_Hagen_Jamar_Teorell.pdf
- **The people's part.** Fatalities raise public demand for withdrawal, and the effect runs through
  the news of them (Fetzer, Souza, Vanden Eynde and Wright, AJPS 2025, eight NATO countries in
  Afghanistan): https://repec.cepr.org/repec/cpr/ceprdp/DP16102.pdf
- **Holding what was taken.** Lancastrian Normandy, 1415–50, was held by garrisons in its key towns
  and castles, sized to the state of the war and drawn on for field armies (Curry):
  https://eprints.soton.ac.uk/388591/1/Curry_1906.indd.pdf
- **Chosen, and its cost.** Each side of a war remembers whose leader it was when it began
  (`rel.began`). A leader who began it, or whose parent or partner did, keeps the old mark for peace;
  any other leader's mark is lower by 0.3. What the leader holds against the other side raises it
  (up to 0.15); what a sample of thirty of their grown-ups hold against them raises it less, more
  under an elected leader; neither more than a leader's temper does. A place taken
  keeps half of the soldiers who took it as its garrison. Cost: thirty minds read once a day per
  pair of neighbouring factions; nothing per person.

### [x] 14d. Peace and dealings left from item 13

**Done 2026-11-19.** Peace by marriage between leading families (the richest of the faction when the
leader has nobody free, after Ric: leaders are well off and people married within their standing):
offered instead of a war by a patient, warm leader, or to end a war nearly weary enough; it holds
while the couple do. Twelve worlds of two old enemies, two years: three marriages, one ending a war,
one keeping the peace two years, one failed within four months. Trade deals need sales both ways
across the border: in force 93% → 34% of neighbouring pair-months at peace (six default worlds, a
year). Tribute agreed by how lopsided the sides are, 5% to 45% of a year's stores (was a flat two
thirds). `test/treaties.test.mjs`. **Left out:** a page button to offer a marriage; everyday
marriages by wealth (new item 15b).

**Now** (2026-11-19): peace comes from weariness or a new leader, never a marriage; a trade deal
forms between any two neighbours at peace who like each other well enough (six default worlds, a
year: one in force for 250 of 268 pair-months of neighbours at peace, 93%); tribute is always
0.3% of the stores and 1% of the treasury a day, about two thirds of the stores a year, whoever
pays whom.
**Do:** peace by marriage between leaders' families, and whether it holds; trade deals that need
real trade across the border; tribute an amount the two sides agree, weighed against a war.
**Done when:** peace by marriage happens in some worlds and sometimes fails; under half of
neighbouring pairs at peace have a trade deal in a default world; tribute differs with how
lopsided the two sides are.
**Ric decides:** nothing up front (item 14).
**Budget:** default.

Research notes (2026-11-19):
- **Marriage and peace.** Benzell and Cooke, "A Network of Thrones: Kinship and Conflict in Europe,
  1495–1918" (AEJ: Applied 2021): the death of a relative two rulers shared, for reasons that had
  nothing to do with politics, was followed by more and longer wars; growing kinship explains a
  good part of the fall in European war after 1800. They take Erasmus's point that a marriage can
  make a peace but not make it last. https://www.aeaweb.org/research/familial-ties-network-thrones ;
  https://econpapers.repec.org/RePEc:aea:aejapp:v:13:y:2021:i:3:p:102-33 . Cases: the Treaty of
  Troyes (1420, Henry V and Catherine of Valois); the Treaty of Perpetual Peace (1502, James IV and
  Margaret Tudor), broken at Flodden in 1513.
- **What tribute is worth.** Fearon, "Rationalist Explanations for War" (International
  Organization 1995): because a war costs both sides, there is a range of settlements both prefer
  to fighting, set by each side's chance of winning less its costs.
  https://en.wikipedia.org/wiki/Bargaining_model_of_war ; https://www.doi.org/10.1017/S0020818300033324
- **Treaties follow trade.** The Hanse's treaties mostly confirmed or restored privileges its
  merchants already used (Cologne in England 1157, Novgorod 1191/2; Stralsund 1370 and Utrecht 1474
  enforced and restored them). https://www.historytoday.com/archive/feature/hanseatic-league-europes-first-common-market ;
  https://wikipedia.com/wiki/Treaty_of_Utrecht_(1474)
- **Chosen, and its cost.** Marriage: a leader's youngest free grown child (else a brother or
  sister, else the leader) marries the other leader's; the one who is not a leader moves to the
  other side. Offered to end a war that is nearly weary enough for peace, or between two peoples
  with bad blood by a patient, warm leader; it holds while the two are alive and together, and
  while it holds a leader's wish for war against the other side counts half. A war begun while it
  holds is a marriage that failed. Trade: every sale by one faction's people in another's village
  adds to a running sum both sides keep (it falls 1% a day); a deal needs it to reach a day's food
  for each of the smaller side's people, and lapses below half that. Tribute: the side taking it
  is r times as strong (and after a war, the dead each lost); it wins a war with chance
  r / (1 + r) (Tullock's contest), and the two agree on that less an even half, as a share of a
  year's stores (5% to 45%), paid a little each day. Cost: a sum per sale, and a search through the
  people only on the day a marriage is made.

### [x] 14e. Walls, sieges and raids

**Done 2026-11-20.** A fighting season (up to a fifth of grown-ups in spring and summer, 4% from
harvest to winter's end), raiding bands of one soldier in five sent every fifteen days at the
richest weakly held enemy village, walls raised where danger came near (doubling a village's
defence, twenty more days of siege), and weariness that counts places lost and taken and fields
spoiled; a side that has lost places and is past its mark yields. All in `WAR_ERA` for item 15.
Forced wars, thirteen seeds, two years: soldiers 30–46 all year → 25–30 in season, about 10 out of
it; places taken 50 → 7; starved 304 → 88; raids burned houses without a siege in 9 of 13; wars
where a side took places ended on days 368–499, even ones mostly 600–708 (two not in two years). A
default year, eight worlds: starved 48 → 21, alive 2,997 → 3,139, killed in battle 109 → 8, places
taken 16 → 2, peace made 4 → 0 times within the year. A walled place held longer than the same
place open, seed for seed (`test/walls.test.mjs`). **Left out:** a wall costs materials, not
hours; bands found no stores to carry off; first walls at castle strength (worth 2, sixty days)
stopped every capture, so they are a village's.

**Now** (2026-11-19): a village defends itself with a quarter of its grown-ups and any soldiers near; an army
goes for one place of each enemy at a time. At war, a side triples its soldiers in three months,
to about a quarter of all its people, and keeps them under arms the whole year round. Weariness
grows with the dead, the years and the hungry, never with who is winning: losing villages and
fields does not tire a side, and taking them does not keep the other keen.
**Do:**
- walls raised in wartime by the people of a place (murage; see 14a's notes);
- raids by small bands on open villages away from the main army, as well as sieges;
- fighting seasons: soldiers go home for the harvest, so a long war is fighting between sowing
  and harvest with quiet in between, not two years without a break;
- an army a people can keep up: a few in a hundred for long, more only for a season;
- weariness that counts who is winning: places and fields lost tire a side, places taken keep the
  other at it; a stalemate still runs long (evenly matched wars do: Bennett & Stam 1996).

Build the season, the army and the walls as numbers, not fixed rules, so item 15 can set them per
era without undoing anything (Ric, 2026-11-19: "Yes please", after asking whether this covers
fighting through the different ages): how long the fighting season is (all year = no season), how
many in a hundred can stay under arms for long and for one season, and how much a wall is worth
against an attack. 14e sets them for today's farming village; item 15 sets them for each age:
- Ancient / Medieval: soldiers are farmers and go home for the harvest; a few in a hundred under
  arms for long, more for one campaign; walls strong, sieges take months.
- Industrial (1800s): paid standing armies and railways fight all year; call-ups of a whole age
  group; cannon beat tall walls, low earth forts and trenches take over.
- Modern: no season; up to about one in five under arms in a big war, only because the rest feed
  them; walls hardly matter.
**Done when:** a walled place holds out measurably longer; raids burn and take without a siege;
a war's soldiers go home at harvest; a side clearly losing makes peace sooner than one that is
even, measured over the forced wars below.
**Budget:** default.

Research notes:
- Added 2026-11-19 at Ric's word ("Add them to 14e") after asking whether long even wars are
  realistic. Forced wars (`scratchpad even.cjs`: 600 people, three tribes of 200, 0 against 1,
  13 seeds, two years): both sides start at 200 people, 4 villages, 16-18 soldiers and stay close
  (the stronger at most about 1.3 times the other's soldiers); 0-17 a side killed in battle in two
  years; each side falls to 130-160 people, mostly to hunger and to the third tribe, which stays
  out and grows to about 270. 7 of 13 wars ended within two years, 5 of them between month 18
  and 24, so the count tips either way with small changes. Wars end on the clock (weariness about
  0.3 a year against a mark of 0.9-1.05 for the leader who began it) or with a new leader; the
  only "losing" test, fewer than a third of the other's soldiers, never comes between equals.
- **The season and the army.** Feudal service was forty days a year; campaigns ran between sowing
  and harvest, and pre-modern standing forces were well under one in a hundred of the people.
  (https://warhistory.org/article/feudalism-and-military-history )
- **Raids.** Most medieval war was raiding: the chevauchée
  (https://en.wikipedia.org/wiki/John_of_Gaunt%27s_chevauch%C3%A9e_of_1373 ), the Harrying of the
  North, the Border reivers who rode in the dark months after harvest
  (https://www.historic-uk.com/HistoryUK/HistoryofScotland/The-Border-Reivers/ ); villagers fled to
  walled towns (https://www.medievalists.net/2009/12/the-experience-of-civilian-populations-during-the-hundred-years-war-in-france-1330-1440/ ).
- **Walls and sieges.** Towns paid for walls by murage grants (https://gatehouse-gazetteer.info/murage/mur/441.html );
  a strong castle could hold for months (Kenilworth 1266, about six)
  (https://www.english-heritage.org.uk/learn/story-of-england/medieval/siege-warfare/ ).
- **Chosen, and its cost.** `WAR_ERA`: season on, standing 0.04, campaign 0.2, wall worth 1 (a
  full wall doubles defence), 20 more siege days, 30 days to build. Raiders are soldiers with id % 5
  = 2; a target is picked every fifteen days per enemy from villages within thirty squares. Cost: a
  pass over the villages every fifteen days per enemy; the bench is unchanged.

### [ ] 15. Eras, old to modern

**Now:** one era, a farming village with hand weapons.
**Do:** an era is a set of numbers over the same world: how many one farmer feeds, what
buildings are made of and hold, weapons' reach and deadliness, how fast people and news travel,
medicine, and from 14e how long the fighting season is, how many can stay under arms and what a
wall is worth. Modern things exist as things in the world, never as a switch — a phone works only
within reach of a cell tower, and a tower can be built or destroyed (Ric: "cell towers must be a
thing too"). Money and shops stay simple. **Cars** (added 2026-11-16, Ric: "Write them in")
belong here, the same way as the tower: a car exists only in an era that makes them, is built
and owned, needs a road to drive on (7d) and fuel to run, and is fast only where those are.
**Research first:** real figures for each era and each number; how far a tower reaches; how eras
were handled in other history simulations and where that went wrong.
**Ric decides:** which eras; whether a world can move from one era to the next by itself.
**Done when:** the same land and people in two eras fight, travel and hear news at measurably
different speeds; knocking down a tower slows the news in its area and nowhere else.
**Budget:** default.

**Ric (2026-11-20):** "and also for eras the buildings shapes. technology. 15b and it snot just eras there should be different ways in each era.  you know what i mean?  as for marrage same thing." So an era also sets the shapes of buildings (not only what they are made of and how big) and its technology; and within one era, peoples differ: two factions of the same age can govern, marry, build and fight in different ways (customs per people, not one way per era).

**Ric's answers (2026-11-19, asked before a scheduled run):**
- Which eras: "Ancient, Medieval, Industrial (1800s), Modern" (all four offered; the present
  farming village stays as it is).
- Moving from one era to the next by itself: "A setting, on or off" — the visitor chooses.
- Different groups in different eras in the same world (one side guns, the other spears): "Yes".
- Order: go straight to 15 although 12b, 14b, 14c and 14d are unticked: "Yes, do 15".

Research notes:

*Researched 2026-11-20 with 15b and 15c, at Ric's word ("do research please for all of those. To
see what was the historical and correct way"). Nothing here is built; the approach waits on Ric.*

**How other history simulations did eras, and where it went wrong.** Civilization's tech tree
is the usual way, and the usual complaint about it is that it is deterministic: one fixed
sequence everybody walks through, the same for every people, and technology driving society
rather than the other way round ([Ghys, "Technology Trees: Freedom and Determinism in Historical
Strategy Games", Game Studies 12(1), 2012](https://gamestudies.org/1201/articles/tuur_ghys);
[Slocombe, Liverpool](https://livrepository.liverpool.ac.uk/3027693/)). That is exactly what Ric
said not to do ("it snot just eras there should be different ways in each era"). The academic
model that worked is the other way: Turchin, Currie, Turner and Gavrilets ran an agent-based
model over the real Old World in which military technology (horse warfare) spread outward from
where it began, and the spread of large states it predicted matched the record, 65% of the
variance, 1500 BCE–1500 CE ([PNAS 110(41), 2013](https://pmc.ncbi.nlm.nih.gov/articles/PMC3799307)).
So: **an era is per people, not per world, and a technique spreads by contact** — trade, war,
marriage, people moving — when the "move on by itself" setting (Ric, 2026-11-19) is on.

**The numbers an era sets.** What was found, and how sure:
- *How many one farmer feeds.* US: 19 in 1940, 73 in 1970, about 166 now (American Farm Bureau
  Federation's figure, worked from farm output, not one farmer's
  — [fb.org fast facts](https://fb.org/newsroom/fast-facts),
  [Statista series since 1940](https://statista.com/statistics/207339/number-of-persons-fed-per-farmer-in-the-us-since-1940)).
  Ancient and medieval figures still to be sourced from a farming-share series before building.
- *Travel and news.* Roman travel is modelled by Stanford's ORBIS: fourteen ways of going by
  road, from walking to relays of horses, plus river boats and two kinds of ship, with cost —
  not distance — deciding who is connected ([ORBIS](https://isaw.nyu.edu/exhibitions/space/orbis.html);
  [Scheidel, SSRN 2609654](https://papers.ssrn.com/abstract=2609654)). Sixteenth century: a
  courier from Ragusa to Constantinople, about 1,200 km, could take up to thirty days; Braudel's
  maps of news reaching Venice are drawn in one-week bands
  ([Luebke, "A two-miles-per-hour world"](https://pages.uoregon.edu/dluebke/301ModernEurope/Space-Time%2016thC.html)).
  Industrial: rail and telegraph (figures to source). Modern: a phone works within a tower's
  reach — GSM's own timing limits a cell to 34.9 km, 120 km in extended-range cells at half the
  capacity; what a tower really covers depends on ground and how many use it
  ([Timing advance](https://en.wikipedia.org/wiki/Timing_advance)). That is the "tower" Ric asked
  for: a thing with a reach, which can be built and knocked down.
- *Weapons.* Trevor Dupuy's Theoretical Lethality Index scores a weapon by rate of fire, range,
  accuracy and effect: a 1903 rifle 495, a Maxim gun 3,463, a WWII .50 machine gun 4,973 — 115
  times a flintlock. Armies spread out as weapons got deadlier, so losses a day rose far more
  slowly than the index (his Operational Lethality Index divides by that spreading out)
  ([Dupuy Institute](https://dupuyinstitute.org/2018/05/07/scoring-weapons-and-aggregation-in-trevor-dupuys-combat-models/);
  [Volokh, the TLI table](https://reason.com/volokh/2022/11/01/the-theoretical-lethality-index-is-useful-for-military-history-but-not-for-gun-control-policy/)).
  An era sets both numbers, never deadliness alone. Sword and bow values to read from Dupuy's
  *The Evolution of Weapons and Warfare* (1980) before building.
- *How many under arms.* Modern peacetime: about 1% or less (US late 1980s, 2.25 million); world
  wars at their peak about 10% of Britain's whole population; the "nation in arms" after the
  French Revolution raised the share less than usually thought (13 great powers, 1600–2000)
  ([Our World in Data](https://ourworldindata.org/military-long-run-perspective);
  [unamur paper](https://www.unamur.be/en/eco/eeco/pdf/technology.pdf)). 14e's `WAR_ERA`
  (season, standing share, campaign share, wall worth, wall hold, wall days) is already the
  shape this takes; Roman and medieval shares still to source.
- *Buildings and their shapes* (Ric, 2026-11-20). Round timber-and-thatch houses were the
  typical building of pre-Roman Britain; longhouses held several generations and were lengthened
  as the family grew; Rome laid towns out on a grid of blocks (*insulae*) with the atrium house
  (*domus*) and blocks of flats; the late medieval north built timber-framed hall houses
  ([English Heritage](https://www.english-heritage.org.uk/learn/story-of-england/romans/architecture/);
  [Britannica, house](https://www.britannica.com/topic/house-dwelling);
  [Longhouse](https://en.wikipedia.org/wiki/Longhouse)). Industrial terraces and modern blocks
  still to source. A shape belongs to a people as well as an era: Iron Age Britain built round
  while Rome built square in the same centuries.

**Approach proposed (not agreed).** One record per faction, its *ways*: the era's numbers (what
`WAR_ERA` holds now, plus food, travel, news, weapons, medicine, building) and its customs
(government — 15c; marriage — 15b; building shape). The present world is that record filled with
today's values, so a world nobody changes is byte for byte as it was. Towers and cars are things
on the land, built and owned like houses and carts. Cost: one lookup per faction where a
constant is read now; nothing per person.

### [ ] 15b. Who marries whom

Added 2026-11-19 at Ric's word, while 14d was built: "generally leaders are well off dont people
who marry marry in similarry pay ranges? most the time in earlier times and the money was spread
unevenly in lots of areas i mean there was tons of factors that play into who marrys who".
**Now:** two single grown-ups who are not kin and like each other enough may pair up when they
talk, whatever each owns, whatever their families think, and whichever side of a border they are
on. 14d's marriages for peace take a leader's own family first, then one of the faction's richest.
**Do:** marriage that follows what it followed in the time: standing and wealth (marrying within
one's own kind), what the families want and what a match brings them (land, a dowry), the parish or
village (most married within a few miles), faith and people, age at marriage by era (late in
north-west Europe, early elsewhere: Hajnal), and remarriage after a death.
**Research first:** homogamy by wealth and class in pre-industrial records (parish registers,
marriage contracts); dowry and bride-price; how far people went to find a spouse; who arranged it.
**Ric decides:** how much families arrange it against the couple's own liking; whether it differs by era (item 15).
**Ric (2026-11-20):** it differs by era and also between peoples of the same era ("as for marrage same thing"); research it before building ("those need to be researched").
**Done when:** in a world where wealth is uneven, the rich mostly marry the rich and the poor the
poor, measurably more than by chance, and the leading families marry each other.
**Budget:** default.

Research notes:

*Researched 2026-11-20 (see item 15's note). Nothing built; the approach waits on Ric.*

- **Age at marriage, and where the couple lives.** North-west of a line from Trieste to St
  Petersburg, women married at 24 or more and men at about 26, spouses were close in age, 10% or
  more never married and a new couple set up its own household; east and south of it most women
  were married by 25, nearly everybody married, and the bride joined her husband's family
  ([Western European marriage pattern](https://en.wikipedia.org/wiki/Western_European_marriage_pattern);
  [Levine, Encyclopedia.com](https://www.encyclopedia.com/international/encyclopedias-almanacs-transcripts-and-maps/european-marriage-pattern)).
  The engine already follows the north-western way (a couple moves out — comment at
  `people.js` ~1364); it is one of two customs, not the rule.
- **Who chooses.** In 190 foraging societies almost all children were born in marriage and
  marriage was arranged by parents and close kin; about 70% (69.9%) were parental arrangements,
  and parents controlled daughters' marriages more than sons'
  ([Apostolou, Evolution and Human Behavior 28(6), 2007](https://hraf.yale.edu/ehc/documents/22)).
  So the couple's own liking deciding alone, as now, is the rare case in history, not the usual.
- **What passes between the families.** In Murdock's Ethnographic Atlas of 1,167 pre-industrial
  societies, bride-price (the groom's side pays) is in about two thirds and dowry (the bride
  brings property) in under 4% — but dowry was the custom of the stratified plough societies of
  Europe and Asia, where most people lived. Bride-price goes with more than one wife and with
  divorce ([Anderson, "The Economics of Dowry and Brideprice", JEP 21(4), 2007](https://ideas.repec.org/a/aea/jecper/v21y2007i4p151-174.html)).
- **Like marries like.** Over 1.7 million English marriage records 1837–2021 the underlying
  correlation of groom's and bride's status is about 0.8, unchanged in 180 years, and evidence
  takes it back to 1754 ([Clark and Cummins, LSE working paper 337, 2022](https://www.lse.ac.uk/asset-library/information/wp337.pdf)).
  The comparative history of marrying within one's class is van Leeuwen and Maas
  ([IRSH 50 supplement 13, 2005](https://research-portal.uu.nl/en/publications/endogamy-and-social-class-in-history-an-overview/)).
  This answers Ric's "dont people who marry marry in similarry pay ranges?": yes, strongly.
- **How far.** Parish-register studies find marriages mostly within the parish or the next few;
  readers who could sign went further ([Durham thesis](https://etheses.durham.ac.uk/id/eprint/7130);
  [Shropshire 1754–1810](https://qmro.qmul.ac.uk/xmlui/handle/123456789/1673)). A figure in miles
  to read from Millard, *Local Population Studies* 1982, before building.
- **Cousins and more than one wife.** About 85% of recorded societies allowed a man more than one
  wife, though most men in them had one ([Henrich, Boyd and Richerson, "The puzzle of monogamous
  marriage", 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3260845)). Cousin marriage was common
  until the Western Church forbade it; how long a people lived under that ban predicts how rare
  it is today ([Schulz et al., Science 366, 2019](https://coevolution.fas.harvard.edu/sites/projects.iq.harvard.edu/files/culture_cognition_coevol_lab/files/sciencefull.pdf)).
  Both are customs that differ between peoples of the same age — Ric's "as for marrage same thing".
- **Marrying again.** In sixteenth-century England a quarter to under a third of those marrying
  were marrying again; by the nineteenth about a tenth ([Wrigley and Schofield via Boulton,
  Continuity and Change](https://resolve.cambridge.org/core/journals/continuity-and-change/article/london-widowhood-revisited-the-decline-of-female-remarriage-in-the-seventeenth-and-early-eighteenth-centuries/A3B2E55B71FD085349C9F3D865EFB987)).

**Approach proposed (not agreed).** Each people's marriage customs, on its *ways* record (item 15):
who decides (a weight from the couple's liking to the families' choice), what passes (nothing,
bride-price, dowry), the age, where the couple lives (own house, his family, hers), cousins
allowed or not, one spouse or more, and how far a match is looked for. A match is weighed as liking
plus the families' weight times what it brings them (wealth and standing alike, the payment, an
alliance) less the distance. Families look among the singles their own village and the next few
hold, a list already kept up (item 2), so it costs a short list a day per family with somebody
of age, not everybody against everybody. **Measured by** the correlation of spouses' household
wealth against the same people paired at random, and how often the leading families marry each other.

### [ ] 15c. Government, deeper

Added 2026-11-19 at Ric's word, while 14e was built: "is there government in there? governmnet
decides alot of those things and the government probably needs to be way deeper no?"
**Now:** a faction's government is one leader (a chief, an elected leader who can be voted out or
turned on, or the richest), who alone sets tax, relief, the army, who holds the land, war, peace,
alliances, trade deals, tribute and marriages; a village may have its own tax and relief; there are
revolutions and breakaways. Nobody stands between the leader and the people: no council or nobles,
no officials or collectors, no laws or courts. Walls (14e) are raised by a village on its own.
**Do:** the people and bodies a government is made of, and what each decides, so that what a
faction does depends on who holds which office: a council or great families the leader must carry,
officials who collect, judge and muster (and can be honest or not), laws that last past a leader
(levies, murage, what is a crime and what it costs), and how each of these differs by kind of rule
and by era (item 15).
**Research first:** how chiefdoms, early states, feudal monarchies, city councils and modern states
divided these powers; how much a ruler could do without the great families; what officials cost.
**Ric decides:** how deep; which offices; whether this comes before eras (15).
**Ric (2026-11-20), for 15b and 15c both:** not one way per era: different ways within each era (different peoples of the same age govern differently), and the same for marriage. "and also for eras the buildings shapes. technology. 15b and it snot just eras there should be different ways in each era.  you know what i mean?  as for marrage same thing."
**Ric (2026-11-20), later:** "eras are important to be done deeply as well as governments    tribes even had different ways": tribes too, not only states, had their own ways of ruling (e.g. chiefs, elders, councils, assemblies); research and build that range, and eras just as deeply.
**Ric's answers (2026-11-20):** how deep: "yes the governemnts need to go way deeper"; it comes before 15 (asked "15c first, or straight to 15?"); 15b and 15c "need to be researched" first. Which offices: still Ric's, asked after the research with what each era had.
**Done when:** two factions with the same leader but different councils or laws do measurably
different things.
**Budget:** default.

Research notes:

*Researched 2026-11-20 (see item 15's note). Nothing built; the approach waits on Ric.*

**The range of ways people ruled — tribes as much as states (Ric: "tribes even had different ways").**
- *No ruler at all, held down on purpose.* Among egalitarian foragers and others, a headman leads
  by persuasion, and anybody who tries to command is met by criticism, ridicule, disobedience,
  shunning and, in the end, killing — Boehm's "reverse dominance hierarchy"
  ([Boehm, Current Anthropology 1993](https://www.gwern.net/doc/sociology/intrasexual-aggression/1993-boehm.pdf)).
- *A big man.* In Melanesia standing was earned, not inherited: a man gathered a following by
  giving and feasting, and lost it when he could not; in Polynesia, by contrast, rank was
  inherited, chiefs and sub-chiefs made a pyramid, and polities of two or three thousand were
  ordinary ([Sahlins, "Poor Man, Rich Man, Big-Man, Chief", CSSH 5(3), 1963](https://www.cambridge.org/core/product/identifier/S0010417500001729/type/journal_article)).
- *Kin groups and a peacemaker, no head.* The Nuer had no ruler; lineages joined against the more
  distant and split against the nearer, and a killing was settled through a leopard-skin chief,
  a neutral man with no power to command
  ([Evans-Pritchard, *The Nuer*, 1940](https://is.muni.cz/el/phil/podzim2023/CMAa07/um/Evans_Pritchard_E_E_1940_The_Nuer.pdf?lang=en);
  [OpenStax, acephalous societies](https://openstax.org/books/introduction-anthropology/pages/8-2-acephalous-societies-bands-and-tribes)).
  The book also has an age-set system: men of one age grade act together.
- *Chiefs and an assembly.* Among the Germans Tacitus described, chiefs decided small matters and
  all the free men decided great ones, having heard the chiefs first; the assembly met at new or
  full moon, a king or chief was heard for his age, birth, war record or eloquence, assent was
  the clash of weapons, and the assembly also tried crimes
  ([Germania 11](https://facultystaff.richmond.edu/~wstevens/history331texts/barbarians.html)).
- *A council whose members can be recalled.* The Haudenosaunee Grand Council: fifty chiefs, each
  chosen by his clan's mother and removable by her ("dehorned") if he did not serve his people
  ([Haudenosaunee Confederacy](https://www.haudenosauneeconfederacy.com/chiefs.html)).
- *A king who must carry the great men.* Magna Carta clause 12: no scutage or aid without "the
  common counsel of the kingdom", save three named cases; clause 14 said how that council was
  summoned, forty days' notice ([Magna Carta Project](https://magnacarta.cmp.uea.ac.uk/read/magna_carta_1215/Clause_12)).
  More generally North, Wallis and Weingast: most states in history are a coalition of the
  powerful who share out land, offices and monopolies, and keep the peace with each other only
  while staying in pays better than fighting
  ([*Violence and Social Orders*, NBER w12795](https://www.nber.org/papers/w12795.pdf)).
- *Salaried officials.* The Western Han had about 120,000 officials for about 58 million people,
  one for every 480 or so, before the clerks under them
  ([Government of the Han](https://en.wikipedia.org/wiki/Government_of_the_Han_dynasty)).
  Across 414 societies over 10,000 years, Seshat codes whether a polity has professional
  soldiers, officers, priests, bureaucrats and judges, courts and examinations; these arrive
  together with size, one dimension explaining about three quarters of the variation
  ([Turchin et al., PNAS 115(2), 2018](https://pmc.ncbi.nlm.nih.gov/articles/PMC5777031)).
  That is the link to eras: which offices a people can have depends on how big and how settled it is.
- *Collecting the tax.* A state could pay collectors a wage, a share, or sell the right: the tax
  farmer (Rome's *publicani*, the Ottoman *iltizam*) paid a bid and kept whatever he collected
  above it, which is why tax farming was hard on the taxed
  ([Cosgel and Miceli, "Tax collection in history"](https://pages.ucsd.edu/~bslantchev/courses/ps143a/readings/Cosgel%20&%20Miceli%20-%20Tax%20Collection%20in%20History.pdf)).

**What makes who holds office change what a faction does — two models.**
- *Selectorate theory*: a leader keeps power by keeping a "winning coalition". With few to please,
  spending goes to them (land, office, gifts); with many, it goes to things everyone gets (relief,
  walls, roads), because those are cheaper per head
  ([Bueno de Mesquita et al., *The Logic of Political Survival*, 2003](https://en.wikipedia.org/wiki/Selectorate_theory)).
- *Blanton and Fargher*: over a worldwide sample, rulers who lived off their own people's taxes
  had to give them voice, provided more for all and were more limited; rulers with income from
  outside the people (tribute, plunder, monopolies) did not
  ([*Collective Action in the Formation of Pre-Modern States*, 2008](https://link.springer.com/book/9780387738765);
  [2009 article](https://www.socionauki.ru/journal/files/seh/2009_2/collective_action_in_the_evolution_of_pre_modern_states.pdf)).

**Approach proposed (not agreed).** A faction's government becomes three things, all real people
or records, never a label that decides by itself:
1. *Who must agree* — the coalition: nobody (one ruler), the great families (the richest
   households, by name), the elders, a council chosen by kin, or all grown-ups. A decision the
   leader makes now (tax, war, peace, relief, the army) needs the coalition's leaning, not the
   leader's nature alone. The coalition's size sets how the treasury is spent between the
   coalition and everyone (selectorate). That is the item's "Done when": the same leader with a
   different coalition does measurably different things.
2. *Offices* — real people with a job: collector, judge, captain, elder, peacemaker. They cost
   their keep (or the farmed share), and they take a cut by their own honesty (item 10's traits)
   unless somebody checks them. None in a band; about one per few hundred people in an early state.
3. *Laws* — records on the faction that outlast a leader: a levy, a wall levy, what a killing or
   a theft costs (a payment between kin groups in a tribe, a fine or punishment in a state), the
   land rule. Changed only by whoever the way of ruling says can change them.
Revolts, elections and breakaways stay as they are, now reading the coalition: a coalition whose
share shrinks turns on its ruler (North, Wallis and Weingast). Cost: each faction keeps its
coalition and officials as kept-up lists, a few dozen people; a decision sums over those, not
over everybody. Within the default budget.

**Order (asked 2026-11-20).** Ric: "should eras be done first? … it is the groundwork for the rest
no?" Every finding above ties a people's way of ruling to its size and age (Seshat) and to its
customs (Ric: different peoples in one era). The groundwork all three items share is the
per-faction *ways* record. Proposed: split 15 into **15a** (the *ways* record and the era numbers
the engine already has: war, walls, food, travel, news — the world unchanged until a value is
changed), then **15c** and **15b** on top of it, then **15d** (towers, cars, building shapes,
medicine, techniques spreading). Waiting on Ric.

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
| 2026-11-16 | 7a | AMD Ryzen 5 3600, 24 GB | 1.89 s a day, 159× | 10.78 s a day, 28× | 3.3 MB, 0.64 KB | **people at real size by default**, a different world. 400 people 0.34 → 0.12 s, 2,000 on 17 km 3.23 → 0.55 s, 400 on 500 km 0.15 → 0.05 s; 20,000 on 80 km 7.40 → 10.78 s, slower (busier people, emptier stores); a default year 115 → 40 s |
| 2026-11-16 | 6a | AMD Ryzen 5 3600, 24 GB | 1.77 s a day, 168× | 12.6 s a day, 23× | 3.2 MB, 0.63 KB | **thirst on by default**, a different world. Against 7a: 400 people 0.12 → 0.14 s, 2,000 0.55 → 0.62 s, 5,000 1.72 → 1.77 s, 20,000 10.5 → 12.6 s (fetching is a new daily task) |
| 2026-11-16 | 6 | AMD Ryzen 5 3600, 24 GB | 1.75 s a day, 172× | 13.5 s a day, 22× | 3.4 MB, 0.67 KB | **rain, fishing and crossing water on by default**, a different world. Against 6a: 400 people 0.14 → 0.13 s, 2,000 0.62 → 0.60 s, 5,000 1.80 → 1.75 s, 20,000 12.6 → 13.5 s, 400 on 500 km 0.09 → 0.16 s (walking round big rivers); person fields declared at birth |
| 2026-11-16 | 7 | AMD Ryzen 5 3600, 24 GB | 2.05 s a day, 146× | 14.9 s a day, 20× | 3.5 MB, 0.68 KB | **houses built, land held by each faction's rule, paths worn in, carts, boats**, a different world. Against item 6: 400 people 0.125 → 0.125 s, 2,000 0.62 → 0.62 s, 5,000 1.96 → 2.05 s, 20,000 14.3 → 14.9 s, 400 on 500 km 0.145 → 0.10 s; asking a neighbour made cheap |
| 2026-11-17 | 8 | AMD Ryzen 5 3600, 24 GB | 1.72 s a day, 174× | 14.2 s a day, 21× | 3.6 MB, 0.71 KB | **towns and cities**; a paid-building search made cheap. Against item 7: 2,000 0.62 → 0.57 s, 5,000 2.12 → 1.72 s, 20,000 15.1 → 14.2 s, 400 on 500 km 0.10 → 0.12 s |
| 2026-11-17 | 9 | AMD Ryzen 5 3600, 24 GB | 1.96 s a day, 152× | 14.55 s a day, 21× | 3.8 MB, 0.74 KB | **materials and livings**: wood, stone, ore, herds, game, firewood. Against before: 2,000 0.60 → 0.68 s, 5,000 1.80 → 1.96 s, 20,000 14.95 → 14.55 s, 400 on 500 km 0.13 → 0.19 s (more walking) |
| 2026-11-17 | 10 | AMD Ryzen 5 3600, 24 GB | 2.06 s a day, 146× | 15.96 s a day, 19× | 4.1 MB, 0.80 KB | **the ten traits**: quarrels, fights, theft, raids and hard years moving people. Against item 9: 2,000 0.66 → 0.66 s, 5,000 1.98 → 2.06 s, 20,000 14.6 → 16.0 s (+9%: the old ask-a-neighbour search, with more people short), 400 on 500 km 0.19 → 0.14 s; memory 0.67 → 0.80 KB a person (five traits, four fields) |
| 2026-11-17 | 11 | AMD Ryzen 5 3600, 24 GB | 1.92 s a day, 155× | 16.30 s a day, 18× | 6.6 MB, 1.29 KB, measured right after making the world (0.80 before: the minds are there from the start) | **the mind**: twenty slots a person in flat arrays. Against item 10: 2,000 0.67 → 0.68 s, 5,000 2.08 → 1.92 s, 20,000 16.2 → 16.3 s, 400 on 500 km 0.14 → 0.14 s; a running world 0.7 KB a person lighter |
| 2026-11-18 | 12 | AMD Ryzen 5 3600, 24 GB | 1.84 s a day, 163× | 15.1 s a day, 20× | 7.0 MB, 1.36 KB at the start (2.77 against 2.62 KB a person by heap after) | **talking passes what you hold**: who told whom, tellings that change. Against the world before: 400 0.15 → 0.15 s, 2,000 0.70 → 0.71 s, 5,000 1.92 → 1.84 s (alternated four times), 20,000 16.4 → 15.1 s, 400 on 500 km 0.20 → 0.16 s; 0.27 KB a person more by day 120 |
| 2026-11-18 | 13 | AMD Ryzen 5 3600, 24 GB | 3.09 s a day, 97× (loaded machine) | 19.3 s a day, 16× (loaded) | 6.4 MB, 1.26 KB | **factions dealing with each other**: no change against the world before, alternated twice on the same loaded machine: 400 0.18 → 0.17 s, 2,000 0.98 → 0.98 s, 5,000 3.08 → 3.13 s, 20,000 19.3 → 19.2 s, 400 on 500 km 0.20 → 0.19 s |
| 2026-11-19 | 14a | AMD Ryzen 5 3600, 24 GB | 1.92 s a day, 156× | *not run* | 7.0 MB, 1.36 KB | **wartime effort**: fear only where the fighting is, a different world. Against item 13, alternated: 400 0.13/0.14 → 0.13/0.13 s, 2,000 0.69/0.68 → 0.68/0.71 s, 5,000 1.97/1.95/1.98/1.94 → 1.94/2.20/1.87/1.92 s: the same |
| 2026-11-19 | 14b | AMD Ryzen 5 3600, 24 GB | 1.96 s a day, 153× | *not run* | 7.0 MB, 1.37 KB | **what a war leaves**: crops spoiled, houses burned, sacks, refugees, a different world in a war. Against 14a, alternated: 400 0.13/0.13 → 0.13/0.13 s, 2,000 0.67/0.68 → 0.67/0.65 s, 5,000 1.92/1.95 → 1.97/1.96 s: the same |
| 2026-11-19 | 14c | AMD Ryzen 5 3600, 24 GB | 1.93 s a day, 155× | *not run* | 7.0 MB, 1.37 KB | **why wars end**: blame, grudges, garrisons, a different world in a war. Against 14b, alternated: 400 0.13/0.13 → 0.13/0.13 s, 2,000 0.66/0.67 → 0.79/0.66 s, 5,000 1.92/1.98 → 2.03/1.93 s: the same within this machine's drift |
| 2026-11-19 | 12b | AMD Ryzen 5 3600, 24 GB | 2.24 s a day, 133× | *not run* | 7.0 MB, 1.37 KB | **acting on news of sickness, famine and prices**: the same world until a report comes. Against 14c, alternated: 400 0.13/0.13 → 0.14/0.14 s, 2,000 0.70/0.70 → 0.72/0.72 s, 5,000 2.30/2.22 → 2.25/2.23 s; mid-year 2,000 (day 150, six days) old 0.59–0.64 s, new 0.63–0.76 s, a different world: a profile gives the new reading 0.5% of the time |
| 2026-11-20 | 14d, 14e | AMD Ryzen 5 3600, 24 GB | 2.06 s a day, 146× | *not run* | 7.1 MB, 1.38 KB | **peace by marriage, trade deals, tribute; walls, raids, a fighting season**: a different world in a war. 14e against 14d, alternated: 400 0.13/0.14 → 0.13/0.13 s, 2,000 0.70/0.68 → 0.70/0.69 s, 5,000 2.01/2.06 → 2.06/2.06 s: the same |
| | 2 | Apple M1, 8 GB | *to be measured* | *to be measured — about 7 s, 43×, by the ratio* | | run `node --expose-gc test/bench.mjs` on the Mac and fill this in |
