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

**Done 2026-11-20**, in five parts (14a–14e below): wartime effort where the danger is not, what a war leaves, why wars start and end, peace by marriage, trade deals and tribute, and walls, raids and a fighting season. **Left out** across them: weapons, reach and deadliness by era and how far an army can go (item 15); crafters turning to gear for the soldiers; a page button to offer a marriage (both done in 15.5h).

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
thirds). `test/treaties.test.mjs`. **Left out:** a page button to offer a marriage (done in 15.5h); everyday
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

### [ ] 15. Eras, old to modern — split into 15a to 15h

**Split 2026-11-20** (Ric: "Split it"), because 15c and 15b stand on part of it. The order is
**15a → 15c → 15g → 15b → 15e → 15f → 15h → 15i → 15d** (rearranged 2026-11-20, below; faith before marriage at Ric's word; 15i added the same day). This entry
keeps the research and Ric's answers for all of them; tick it when 15d is ticked.

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

**Checked 2026-11-20 (Ric: "let's go through it all again and see if anything is missing for
15"): what 15a–15d do not yet cover.** Waiting on Ric for which go in and where.
1. *Time.* At 16× a year takes about two hours (a day is five minutes at 1×), so a century is
   about 190 hours. "Moving on by itself" over centuries would never be seen, and neither would a
   chiefdom growing into a state. Needs a way to run years quickly — the long-run speed item 20
   and the vision's "skipping through generations" point at — or it stays a promise on paper.
2. *Where a new technique comes from.* 15d has techniques spreading by contact, nothing on how
   one first appears. Proposed in the same rule as everything else: from the stats (the curious,
   item 10) and a need (a hard winter, a war being lost), only where there is a surplus to spare
   people for it; and a technique can be **lost** when the people who held it die out (item 11's
   skills), as wheel-thrown pottery was lost in post-Roman Britain (to source).
3. *Livings for an industrial or modern people.* One farmer feeding 166 means almost nobody farms;
   the engine's livings are farming, fishing, herding, hunting, wood, stone, ore, crafts and
   trade (item 9). A modern people needs factory and service work, or most of it sits idle.
4. *Power, wires, fuel.* The vision lists "towers, power, fuel, vehicles"; 15 has towers and
   cars. A tower needs power; a telegraph needs a line; a car needs fuel made somewhere. Each a
   thing on the land, built and broken, by the tower's rule.
5. *News by each means.* The vision's list — on foot, by rider, by letter, by telegraph or radio,
   by phone near a tower. A letter needs somebody who can write and somebody to carry it; 15
   gives only a speed per era.
6. *Writing.* Not anywhere yet. It is what lets a law outlast a leader (15c), a tax be counted,
   an office be run from far away, a letter be sent; Seshat codes it with government. Who can
   read, by era and by people, from the stats.
7. *Faith.* 15b names it and nothing builds it. Priests are one of Seshat's offices, and in many
   peoples the ruler's right to rule came from it. Ask Ric whether it is wanted, and where.
8. *How far an army can go.* The vision gives "how far an army can go" to 15; 15 lists weapons
   and travel but not an army's reach on what it can carry or take (logistics by era).
9. *Inheritance.* "When somebody dies" is one world setting (coins to the children, the faction or
   the village). Land and rank passing to the eldest son, split between all children, or to the
   kin group is a custom like marriage, tied to it (dowry, a widow's share) and to 15c (a chief's
   heir). Proposed: in 15b, from the stats like the rest.
10. *Figures still unsourced* (each named in the notes above): ancient and medieval share of
   people farming, rail and telegraph speeds, sword and bow lethality, Roman and medieval army
   shares, industrial and modern house forms, medicine by era (life expectancy, children dying),
   marriage distances in miles, how fast customs change. 15c's research is thin on city councils
   and modern states. Each to be read before the item that uses it is built.
11. *Which era the present world is.* Ric chose Ancient, Medieval, Industrial and Modern, with
   "the present farming village stays as it is". The vision also says "from tribes". Is the
   present village the tribal era (before any state), or one more era beside the four?

**Ric's answers to that check (2026-11-20), and what each became:**
1. *Time:* "there is a max option that runs it as fast as your computer can handle. So. That's
   figured out." Measured on Ric's M1 before item 2: 400 people at 408× — a year in about four
   and a half minutes, a century in about seven and a half hours; bigger worlds are slower.
2. *Where a technique comes from:* "Idk what to do about 2. Propose an idea please" → **15e**.
3. *Livings:* "technology needs to be more of a thing and there does need to be jobs so do some
   research of how we could implement that" → **15f**.
4. *Power, wires, fuel:* "These seem kinda fixed by #3 answer" → in **15f**, as buildings and
   what they make.
5. *News:* "the news speed shouldn't be for era it should be for what is built" → **15d**: news
   moves at the speed of what is built between two places.
6. *Writing:* "If writing is that important put it in I'm not sure where or how it will
   influence things" → **15e**, with what it changes.
7. *Faith:* "Faith seems pretty important. How do we make it so they can come up with their own
   faiths?" → **15g**.
8. *Armies:* "we need to cover what it is carrying with it so it knows how far they can go.
   Armies will need more work too because rn they just run up one at a time instead of using war
   strategies" → **15h**.
9. *Inheritance:* "I agree" → in **15b**.
10. *Figures:* "Research these numbers please" → found below; what could not be found is said.
11. *Eras:* "I guess there can be a fifth I was thinking there was more eras that were important
    to humans as well" → below, **Which eras**.
12. "Organize them the best way you see fit" → the order is now
    **15a → 15c → 15b → 15e → 15f → 15g → 15h → 15d** (ways; government; marriage; know-how and
    writing; work and buildings; faith; armies; eras as starting points, news, towers, cars,
    houses, medicine). Each stands on the ones before it.

**Ric's answers to the questions after that (2026-11-20):**
- Nine eras: "Sure all 9 work."
- Faith driving harsh things (sacrifice, holy war): "Yes it can drive harsh things" → 15g.
- How often things are found: "Rare (make it a slide tho)" → 15e: a setting, rare by default.
- Faith before marriage, so marrying within a faith is there from the start: "However it has been
  in history. Which I think is a yes" → **15g moves before 15b**; the order is now
  **15a → 15c → 15g → 15b → 15e → 15f → 15h → 15d**. 15g's teachers-and-writing link is added
  when 15e is built.
- Weapons: Ric supplied Dupuy's figures (below, in 15h), gathered in another session.

**Which eras (research 2026-11-20).** Archaeology's three ages (Stone, Bronze, Iron) with the
Stone Age split into Palaeolithic, Mesolithic and Neolithic (Lubbock, 1865), and history's
ancient, post-classical, early modern and late modern after them; the three ages are criticised
as too centred on tools and as meaningless outside Europe
([Three-age system](https://en.wikipedia.org/wiki/Three-age_system);
[List of time periods](https://en.wikipedia.org/wiki/List_of_time_periods)). That criticism is the
reason for doing it as below. **Proposed:** an era is only a *starting point* — the know-how
(15e) and buildings (15f) a people begins with — never a stage it must pass through. Nine to
choose from per faction: **Foragers** (bands, no farming), **Early farmers** (the present world's
village), **Bronze Age** (first cities, writing, kings), **Ancient** (iron, coin, empires),
**Medieval**, **Early modern** (gunpowder, printing, ocean ships), **Industrial**, **Modern**,
**Information** (computers, phones). Once 15e exists each is a list, so nine cost little more
than four.

**Figures found (2026-11-20, for item 10 of the check).**
- *People farming.* England: industry and services already 40% of workers in 1381 (so about 60%
  farming); men in farming 68% in 1522, 46% around 1700; farming 37% of workers by 1759
  ([Broadberry, Campbell and van Leeuwen](https://pureadmin.qub.ac.uk/ws/portalfiles/portal/1640964/EEH_Sectoral_shares_paper.pdf);
  [LSE wp240](https://www.lse.ac.uk/asset-library/information/wp240.pdf)). US one farmer feeds 19
  (1940) → 166 now (above). *Not found:* a Roman figure.
- *Travel and news.* Persian royal road: about 2,700 km in seven to nine days by relays of horse
  and rider; Roman *cursus publicus*: about 80 km (50 miles) a day, one courier the whole way
  ([History of Information](https://historyofinformation.com/detail.php?entryid=1700);
  [World History Encyclopedia](https://www.worldhistory.org/article/1442/letters--post-in-the-ancient-world/)).
  Telegraph: in 1844 news of a royal birth was on London's streets within forty minutes; the 1858
  Atlantic cable took 16½ hours for 99 words, the 1866 cable eight words a minute, against weeks
  by ship ([Victorian Web](https://victorianweb.org/technology/telecom/telegraph.html);
  [AI Impacts, transatlantic message speed](https://aiimpacts.org/historic-trends-in-transatlantic-message-speed/)).
  *Thin:* early rail — one report of a royal train averaging 40 mph; to source properly.
- *Weapons.* Found: Dupuy's tables, supplied by Ric (2026-11-20) — in 15h.
- *Under arms.* Roman army 255,000 (Tiberius) to about 390,000–442,000 (Severus, Diocletian)
  ([Size of the Roman army](https://en.wikipedia.org/wiki/Size_of_the_Roman_army)), against an
  empire of perhaps 45 to 120 million — about half to one per cent. *Not found* from a good source:
  medieval shares (only hobby figures, about 0.2% for an English army of 10,000).
- *Houses.* Back-to-back houses from about 1790 in Leeds, Birmingham, Manchester and other
  industrial towns; byelaw terraced houses replaced them; built new until banned in 1909
  ([Harrison, Industrial Archaeology Review](https://eprints.whiterose.ac.uk/142804);
  [Back-to-back house](https://en.wikipedia.org/wiki/Back-to-back_house)). *Not found:* modern
  forms, to source with 15d.
- *Medicine.* About half of all children died before fifteen among foragers and in historical
  populations (48.8% averaged over 20 forager and 43 historical populations), about a quarter in
  the first year ([Volk and Atkinson 2013](https://hraf.yale.edu/documents/1064)). World life
  expectancy at birth 32 in 1900, 73 in 2023 ([Our World in Data](https://ourworldindata.org/grapher/life-expectancy)).
- *Marriage distance.* British baby boomers married someone about six miles from where they were
  born, against 18 in Europe and 60 in the US (an 11-generation family tree, 1650–1950); in some
  English regions up to 80% of working-class couples began under four miles apart; rural Dorset
  1837–1936 under 11 miles even into the 1930s (Perry 1969)
  ([Ancestry summary](https://blogs.ancestry.com/cm/how-far-would-you-go-to-find-love/);
  [Daily Mail on the Science paper](https://www.pressreader.com/uk/scottish-daily-mail/20180302/281522226585763)).
  The *Science* paper itself to read before 15b.
- *How fast customs change.* Peoples whose ancestors lived through less stable climates from
  generation to generation keep less to tradition (Giuliano and Nunn, *Review of Economic Studies*
  2021, [NBER w23617](https://www.nber.org/papers/w23617)) — but a 2026 replication found errors
  and a smaller, often non-significant effect ([Economic Inquiry](https://ideas.repec.org/a/bla/ecinqu/v64y2026i1p22-37.html)).
  So: customs change as the people who hold them change (15a), with no extra constant tuned on this.
- *City councils* (for 15c). Italian communes: an assembly of citizens, then councils for
  finance, tolls, the army, roads and food; consuls, then a *podestà* hired from outside so no
  faction held the office; guilds gaining power until in Florence in 1282 the guilds ruled; term
  limits; most later fell to a lord, Venice and Siena did not
  ([Britannica](https://www.britannica.com/place/Italy/The-popolo-and-the-formation-of-the-signorie-in-central-and-northern-Italy);
  [Podestà](https://en.wikipedia.org/wiki/Podest%C3%A0)). Modern states still to research with 15c.

### [x] 15a. Each people's ways, and decisions made from the stats

**Done 2026-11-20.** A tab a faction under Their nature (`own` in the link); events move people by age (Roberts and DelVecchio; nothing under six, Bauer et al.) and size (a parent lost twice, a burned house, each week of famine, a war lost); an elected leader's decisions are half the leader, half the people's average. A world nobody sets apart starts as before; the running default world changes (Ric: "Yes, always"). `test/ways.test.mjs`. Left: the council and great families who share the say are 15c; the era's numbers on a per-faction record (`WAR_ERA` and the rest) move with 15d, where eras are set per faction — nothing reads them per faction until then. `dealings.test.mjs`'s "more killed under hot-tempered leaders" was 6 against 4 before and 3 against 3 after, too few deaths to tell apart; it now asks for no fewer.

Split out of 15 on 2026-11-20 as the groundwork 15c, 15b and 15d stand on.
**Now:** every number about how a people lives and fights is one constant for the whole world
(`WAR_ERA`, the food and travel figures), and a faction's ways of doing things are a few
settings chosen at the start (`rule`, `land`).
**Do:** one record per faction, its *ways*: the era's numbers already in the engine (war, walls,
food, travel, news) and its customs. **Customs are not labels chosen once: they come from the
stats of the people with the most say** (Ric, below) — the leader, and whoever the leader must
carry (15c). As those people change, or are replaced, or their traits move, the customs move.
**Make what changes a person depend on their age and on how big the thing was** (Ric, below):
item 10's events move traits by fixed amounts whatever the age; here the young move more and the
old less, and a bigger event (a war lost, a famine, a parent killed) more than a small one.
**Research first** (begun): how much traits move with age — rank-order stability of personality
rises from about 0.31 in childhood to 0.54 at college age, 0.64 at 30 and about 0.74 from 50
([Roberts and DelVecchio, Psychological Bulletin 126, 2000](https://stafforini.com/works/roberts-2000-rankorder-consistency-personality/);
updated by [Bleidorn et al. 2022](https://www.gwern.net/doc/psychology/personality/2022-bleidorn.pdf):
stability rises through early life to a plateau in young adulthood). How a people's customs
follow its powerful people, and how fast customs change, still to research.
**Ric decides:** whether the visitor sets each people's nature at the start (ten sliders per
faction, not one set for the world), so two peoples begin with different customs.
**Ric (2026-11-20): "I like nature sliders"** — yes, per faction. Proposed: the world's ten
sliders stay as they are and every faction starts from them; a faction can be opened to set its
own ten, so a world nobody touches is the world it was.
**Done when:** a world nobody changes is byte for byte the world it was; two factions whose
leading people differ in their stats end up with measurably different customs; a raid moves a
child more than an old person.
**Budget:** default.

**Ric (2026-11-20):** "the culture needs to be decided but it still differs between people. So
the most influential people what morals and stats they have should decide the marriage thing.
The marriage thing should be decided through the stats. That's something that needs to also be in
the givernment and everything else they make a decision based on their stats and sometimes those
decisions change their stats if their young enough or the thing that happened was a big enough
deal."

Research notes:

*Researched 2026-11-20.*

**How much an event moves somebody, by age.** Rank-order stability (above): about 0.31 in
childhood, 0.54 at college age, 0.64 at 30, about 0.74 from 50 (Roberts and DelVecchio 2000).
What is not stable is what can move, so the share an event moves a person is taken as one minus
that: 0.69, 0.46, 0.36, 0.26. War is sharper still: in Georgia and Sierra Leone, war changed the
fairness and in-group loyalty of people who lived through it between about 7 and 20, and had no
measurable effect on young children and only a muted one on older adults
([Bauer, Cassar, Chytilová and Henrich, *Psychological Science* 25, 2014](https://coevolution.fas.harvard.edu/publications/wars-enduring-effects-development-egalitarian-motivations));
across nearly 20 studies in over 40 countries the effect of war on cooperation at home is strong
and does not fade with time
([Bauer et al., "Can War Foster Cooperation?", *J. Econ. Perspectives* 30(3), 2016](https://www.nber.org/papers/w22312)).
So the curve is: little before about six, most from six to twenty, falling to a quarter of that
by fifty. *Not used:* Giuliano and Spilimbergo's "impressionable years" (18–25) paper was
retracted ([notice](https://www.restud.com/retraction-of-growing-up-in-a-recession/)).

**How big an event is.** The meta-analysis of life events and personality (44 studies, 121,187
people) found real but small effects and tested no dose
([Bühler et al., *European J. of Personality*, 2023](https://boris.unibe.ch/185539)); war studies
measure exposure as a dose — deaths in the household or community (Voors et al. 2012, already in
the README; Bauer et al. 2016). Nothing found gives a dose-response curve. So size is the share of
what was lost: in a raid, the share of the village killed or burned; in a famine, how long they
went without; a death, how close the dead was (a parent or child more than a cousin). Plain
proportion, no tuned curve.

**How a people's customs follow its powerful people.** People copy those who are admired and
followed — prestige-biased learning ([Henrich and Gil-White, *Evolution and Human Behavior* 22,
2001](https://pubmed.ncbi.nlm.nih.gov/11384884/); [Jiménez and Mesoudi 2019, review](https://link.springer.com/content/pdf/10.1057/s41599-019-0228-7.pdf)),
and leaders can move a group's norms of cooperation (Henrich, Chudek and Boyd 2015,
[the "Big Man" models](https://pmc.ncbi.nlm.nih.gov/articles/PMC4633849)). Against that, a people's
basic values change mostly as one generation replaces another, slowly
([Inglehart, generational replacement](https://www.cambridge.org/core/books/civic-culture-transformed/value-change-over-a-third-of-a-century/10C6E418C8706870594626CEECBFE4B9)).
**Approach chosen:** nothing new is tuned. A custom is a decision made from the stats of whoever
has the say (the leader now; the council and great families with 15c); those stats move only as
the people themselves move (events, by age and size) or are replaced (death, a new leader, a
revolution, children who take after their parents). Generational replacement then gives the
slow change for free. Cost: one pass over a faction's grown-ups once a day (as `landWant`
already does), nothing per person per step.

**Ric's answers (2026-11-20):**
- Age and size of an event, in every world (it changes the default world): "Yes, always".
- An elected leader's decisions lean to what the people are like (half the leader, half the
  average grown-up), not to the middle: "Lean to the people".
- New events: "A war lid and loosing a parent" — a war lost (the whole faction, more the more it
  lost) and children grieving a parent (more than any other death).
- Per-faction sliders: "Faction tabs" — All, then one tab a faction, each starting from All.

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
Also (Ric, 2026-11-20, below): on hemmed-in land, more wars end in conquest and tribute, and more
offices appear, than on open land from the same seed — or the run says it does not, and that is
written down instead of tuned.
**Budget:** default.

**Ric's answers (2026-11-20), after the research:** split 15 ("Split it"). On offices: "Which
ones exist shouldn't be how big the people is unless if that's how it would play out idk how
governments started or how they got big and how they were designed." So **no office is unlocked
by size.** An office comes to exist when a leader or council has a need they cannot meet
themselves (more disputes than they can hear, more households than they can collect from, a war to
run) and the means to keep somebody in it, and chooses by their own stats to make one — a greedy
ruler farms out the tax, an honest one pays a collector. If bigger peoples end up with more
offices, as Seshat found, that must come out of the run, and is measured, not set. And every
decision comes from the stats of whoever decides (see 15a).
**How governments started and grew — what was found for Ric's "idk".** Two explanations, and both
are about what people did, not a size reached. Carneiro: where farmland is hemmed in by
mountains, desert or sea, a beaten village cannot move away, so war ends in conquest and tribute
instead of flight, and conquerors build the apparatus to hold what they took
([Carneiro, *Science* 1970; restated 2012](https://www.sociostudies.org/journal/files/seh/2012_2/005-030.pdf));
cross-cultural tests find it holds in some places, not all
([HRAF re-analysis](https://hraf.yale.edu/documents/1284)). Flannery and Marcus, over the whole
record from bands to empires: population and surplus alone do not explain it; each society's own
"social logic" — how its people thought rank should be earned or inherited — decided whether and
how inequality and offices grew; chiefdoms became states by taking in other chiefdoms, and states
became empires by swallowing states
([*The Creation of Inequality*, 2012](https://prod.lsa.umich.edu/anthro/people/faculty/archaeological-faculty/kflanner/The-Creation-of-Inequality-How-Our-Prehistoric-Ancestors-Set-the-Stage-for-Monarchy-Slavery-and-Empir.html);
[review](https://www.lrb.co.uk/v35/n07/steven-mithen/foursomes-and-so-on)). That second one is
Ric's rule in the historians' words: the people's own stats decide the design.

**Ric (2026-11-20): "could we build something like this in there?"** — yes, as things that can
happen, never as a path a faction is put on. What the engine already has, and what it lacks:
- *Carneiro — has:* land from the seed with sea, lakes, rivers and hills nobody walks through
  (4a, 4b); a village with no good land in reach feels **cramped**, and a cramped leader is more
  ready for war (`found`, `decide`); war takes villages (`capture`, 14); tribute agreed between
  factions (14d). *Lacks:* (1) **the way out.** A family running from war goes only to a village
  of its own faction (`flee`, `capture`). On open land the beaten should be able to leave
  instead — break new ground beyond the winner's reach as a people of their own — and only where
  sea, mountain or desert close that off are they stuck with the winner. That one choice is the
  whole of Carneiro's argument. (2) **taken as a subject, not only absorbed.** Today a taken
  village simply changes flag. A beaten people should also be able to stay itself — its own
  leader, its own ways — and pay tribute, as most conquered chiefdoms did; which of the two
  happens comes from the winner's stats and how far away it is. (3) **holding it costs
  somebody.** More subject villages than the ruler and the coalition can watch is the need that
  makes an office (above): a collector for the tribute, a captain for the garrison.
- *Flannery and Marcus — has:* the start setting for who leads (vote, a chief and then his
  child, the richest) and revolts that change it (`overthrow`). *Lacks:* whether rank is
  **earned or inherited** comes from the people's own stats (15a) — the proud and the greedy
  among the leading families making it run in families, the warm and the stubborn holding it
  open — rather than from a setting chosen once; and **a people taken in brings its own ways**,
  so a conqueror ruling three subject chiefdoms holds three sets of customs that pull on it.
- *Measured, not set:* the same seed on hemmed-in land and on open land (the sea, hills and
  "how settled" settings), many seeds each, counting how wars end, tribute paid, offices made
  and how many villages one faction holds. No number is changed to make the hemmed-in side win.
  Cost: the way out is `found` run for a beaten household, already cheap; a subject is one more
  relation per pair of factions.

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

**Kings** (Ric, 2026-11-20: "Why aren't kings a thing in the government plan? Or are they just not by
that term?"). They are, not by that word: the engine's "A chief for life, then their child" is hereditary
rule, which is what a kingship is; the research above has the king who must carry his great men (Magna
Carta), and 15g's ruler who takes up a faith for the standing it gives is divine right. What the plan does
not yet have is the *word* and what goes with it: a title by how much the ruler holds and how it is held —
a chief of one people, a king over several chiefs' peoples, an emperor over kings (Flannery and Marcus:
chiefdoms became states by taking in chiefdoms, states empires by swallowing states). *Proposed:* the title
is read off what the ruler actually holds (one people or many, inherited or chosen), shown in the panel
and the news, and never decides anything by itself. *Question for Ric:* titles shown that way?
**Ric (2026-11-20): "We can show titles that way."**

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

**Order (asked and answered 2026-11-20).** Ric: "should eras be done first? … it is the groundwork for the rest
no?" Every finding above ties a people's way of ruling to its size and age (Seshat) and to its
customs (Ric: different peoples in one era). The groundwork all three items share is the
per-faction *ways* record. Proposed: split 15 into **15a** (the *ways* record and the era numbers
the engine already has: war, walls, food, travel, news — the world unchanged until a value is
changed), then **15c** and **15b** on top of it, then **15d** (towers, cars, building shapes,
medicine, techniques spreading). Ric: "Split it" — done above.

**Slavery and serfdom are in 15c too** (added 2026-11-20 (added 2026-11-20, Ric: "I feel like there probably is something I'm missing historically" … "Keep languages all one language But add the other 10 please. And then research them"; read as search summaries; nothing built)). *Now:* nobody is unfree.
*History:* Roman Italy's slaves were perhaps 1 to 1.5 million of 5 to 6 million in the late first
century BC (20–30%), the empire as a whole about 10% (Scheidel, [2005](https://www.Gwern.net/doc/history/2005-scheidel.pdf));
only a handful of societies ever passed 20% (Roman Italy, the US South, Brazil, the Caribbean);
captives of war were a main source. *To read before building:* Domesday's *servi* (about a tenth of
those counted), medieval serfdom, and Domar's argument that bound labour arises where land is plentiful
and hands are few. *Proposed:* unfree people as a status a people's law allows or forbids (15c), from
the stats of those with the say (15a): captives taken in war or raids may be kept and worked or sold,
a debtor may be bound, a lord's tenants bound to the land; they work and live as others do but cannot
leave or choose, and may flee or rise when they can. *Questions:* (1) In, as proposed? (2) Can a
player-ruled faction keep, free or forbid it?

### [ ] 15g. Faith: peoples who come up with their own

Added 2026-11-20 (Ric: "Faith seems pretty important. How do we make it so they can come up with
their own faiths?").
**Now:** there is no faith.
**Research (2026-11-20).**
- *What ideas stick.* Boyer: the religious ideas that last break only a few everyday expectations
  — a person who cannot die, a river that listens — which makes them easier to remember than plain
  ideas or very strange ones (the "minimally counterintuitive" effect; the evidence is mixed and
  stronger in the young) ([Religion Explained](https://en.wikipedia.org/wiki/Religion_Explained);
  [Minimal counterintuitiveness](https://en.wikipedia.org/wiki/Minimal_counterintuitiveness_effect)).
- *Two ways a faith lives.* Whitehouse: rare, frightening, unforgettable rites bind small groups
  tightly (imagistic); teaching repeated often, by specialists, holds large, centrally run faiths
  together (doctrinal); tested on 645 rituals in the world's ethnographic files
  ([Modes of religiosity](https://en.wikipedia.org/wiki/Modes_of_religiosity)).
- *Faith and rule.* Across Austronesian peoples, belief in broad supernatural punishment came
  *before* political complexity, while moralising high gods did not
  (Watts et al., Proc. R. Soc. B 2015); ritual human sacrifice helped keep stratified societies
  stratified once they were (Watts et al., [Nature 532, 2016](https://www.nature.com/articles/nature17159)) — correlational.
- *How a faith spreads.* Stark: early Christianity grew about 40% a decade by one person at a time
  along family and friends, people who were closer to members than to anyone outside, plus more
  children; no mass conversions needed ([Rise of Christianity](https://press.princeton.edu/node/62616);
  [a review](https://www.astralcodexten.com/p/book-review-the-rise-of-christianity)).
- *How faith fades.* Agent-based models fitted to survey data: religiousness falls as life gets
  safer and people more educated (Gore, Lemos, Shults and Wildman,
  [JASSS 21(1), 2018](https://jasss.soc.surrey.ac.uk/21/1/4.html)).
**Proposed (not agreed).** A belief is something a person holds (item 11): an explanation of
something big that happened which they cannot otherwise explain — a drought, a plague, a victory —
with a rite (what to do) and a rule (what is forbidden). It is *made up by a person* after such an
event: likelier in the curious, the bold or the frightened (item 10), stronger after a bigger
event (15a). It spreads by talk along trust (item 12), the way Stark found, and sticks better if it
is strange in one way only. When many hold the same belief it is a faith with a name, made from
the words of the land and the person who began it. Then, all from the stats of those who hold
it (15a): which rites and rules it keeps; whether it lives by rare great rites in small groups or
by teaching (which needs teachers, and writing helps, 15e); whether a ruler takes it up for the
standing it gives (15c), with priests as an office; whether it splits when two leaders hold
different versions. What it does: more trust and help among those who share it, marrying within it
(15b), a reason in a war's grudges (item 14c), and fading where life is safe.
**Done when:** a faith that nobody wrote appears after a hard event, spreads along friendships and
not at random, and a people with one does measurably different things than without.
**Ric decides:** whether a faith can make people do harsh things (sacrifice, holy war) or keep it
to rites and rules.
**Ric (2026-11-20): "Yes it can drive harsh things."** A faith's rules may call for sacrifice or
holy war where its holders' stats lead there — never placed, and measured like any other custom.
**Budget:** default.

**Festivals and holy days are in 15g too** (added 2026-11-20 (added 2026-11-20, Ric: "I feel like there probably is something I'm missing historically" … "Keep languages all one language But add the other 10 please. And then research them"; read as search summaries; nothing built)). *Now:* every day is a working day
but for sleep and rest. *History:* the Church forbade work on Sundays and feast days; how many feasts
were kept varied from a handful to about 30 a year even between neighbouring manors on one estate,
negotiated between lords and tenants, and some lords allowed none
([*Journal of Ecclesiastical History*, work and holy days](https://resolve.cambridge.org/core/journals/journal-of-ecclesiastical-history/article/work-and-festa-ferianda-in-medieval-england1/4732239CC2F61BA02104400C3C6F2754);
[Durham, peasants' leave](https://dur.ac.uk/departments/academic/history/news/medieval-peasants-enjoyed-a-surprising-range-of-sick-annual-and-bereavement-leave-benefits/));
popular figures of 40–60 feast days and 150–180 working days are loose. *Proposed:* a faith's rest days
and festivals are its own (15g), kept or not by a people's customs and its lords (15a, 15c); a
festival is a day people gather, eat, talk and pass news, so it does something. *Question:* in, as
proposed?

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

**Inheritance belongs here too** (Ric, 2026-11-20: "I agree"): who gets land, house, goods and
rank when somebody dies — the eldest son, all the children alike, the kin group, a widow's share —
is a custom like marriage and tied to it (a dowry is an early share), from the stats of the
people with the most say (15a). It replaces the single "When somebody dies" setting for peoples
whose customs have been worked out; a world nobody changes keeps the setting as it is.
Also here (Ric, 2026-11-20, from 15.5e): **the old handing the farm to a child in exchange for
their keep** — a room, food, fuel — as medieval maintenance agreements did, the land going back if
the child failed them (research in 15.5's notes).

**Ric (2026-11-20), after the research:** "For marriage it looks like it depends on the culture.
And the culture needs to be decided but it still differs between people. So the most influential
people what morals and stats they have should decide the marriage thing. The marriage thing should
be decided through the stats." So the customs listed in the approach below are not chosen per
people: each comes from the stats of that people's most influential (15a), and each person still
weighs a match by their own stats inside them.

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

### [ ] 15e. Know-how: how a technique is found, spreads and is lost; and writing

Added 2026-11-20 (Ric: "Idk what to do about 2. Propose an idea please"; "If writing is that
important put it in").
**Now:** there is no know-how: what a people can make is fixed by the settings.
**Research (2026-11-20).**
- *Where new things come from.* Muthukrishna and Henrich: innovation is mostly not lone genius
  but what a "collective brain" does — serendipity, recombining things already known, and small
  improvements — and its rate rises with how many people learn from each other, how faithfully
  they copy, and a little variation in the copying
  ([Phil. Trans. R. Soc. B 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4780534)).
- *Losing it.* When rising seas cut Tasmania off from Australia, the people there lost skills
  over ten thousand years: too few learners to keep hard skills alive
  ([Henrich, American Antiquity 2004](https://www2.psych.ubc.ca/~henrich/Website/Papers/HenrichTasmania.pdf));
  across Oceania larger, better connected islands had more and more complex tools (Kline and Boyd,
  Proc. R. Soc. B 2010). Contested: others find population does not predict complexity everywhere.
- *Why there and then.* Allen: Britain mechanised because labour was dear and coal cheap, so
  machines that swap labour for fuel paid there and nowhere else
  ([Allen, CAGE](https://warwick.ac.uk/fac/soc/economics/research/centres/cage/news/podcasts/allen-industrial-revolution.pdf));
  contested on the wages, not on the idea that people invent to save what is dear.
- *Writing.* It began as accounts — Uruk, about 3300 BCE, mostly records of grain and goods — and
  Goody shows what it then did to a society: tax, census, contracts, written law, all kept by
  trained specialists, at first priests and officials
  ([Goody, *The Logic of Writing and the Organization of Society*, 1986](https://www.cambridge.org/core/books/logic-of-writing-and-the-organization-of-society/letter-of-the-law/51EF636AD61CE00900F441A6608079AC);
  [Englund 2011](https://cdli.ucla.edu/staff/englund/publications/englund2011a.pdf)). Who could
  write: in England about 1800, about 60% of men and 40% of women could sign their names; north-west
  Europe rose fastest 1600–1800 ([Our World in Data](https://ourworldindata.org/literacy)).
**Proposed (not agreed).**
1. *A technique is something people hold*, like the skills of item 11, not a flag on a faction.
   Each has what it is built from (other techniques, a material in reach) and what it does (a
   way of working, a building, a weapon). There is one list with what each needs; there is no
   order and no tree a people walks along.
2. *Found by somebody at work.* While a person does a task, there is a small chance they find a
   technique whose parts they already know. It is higher when they are curious (item 10), have
   time and food to spare, and the task is short of something — a hard winter, a war being lost,
   work that costs too many hours, which is Allen's "dear labour". More people who know the parts
   and talk to each other means more finding, so a big connected people invents more without that
   being set: the collective brain comes out of the run.
3. *Spread* by teaching (a parent, a master), by seeing it done, by taking a made thing apart
   (traded goods, captured weapons), and with people who marry in or move. Copies are imperfect;
   a skilled teacher copies better.
4. *Lost* when everybody who held it dies or forgets it without passing it on — Tasmania.
5. *Writing is one technique, and it changes the others:* what is written does not die with the
   person who knew it (a lost technique can be found again in writing); a letter carries news
   word for word instead of as remembered (item 12's distortion falls); a tax, a debt and a law
   can be written and checked (15c's collectors can be audited, and a law outlasts the memory of
   it); an office can be run from far away. Who can write is a skill taught, chosen by the stats
   (the curious, families that can spare a child, customs from 15a).
**Done when:** with nothing scripted, a technique is found, spreads to a neighbour and is lost
in a people that shrinks; a connected people finds more than the same people cut off.
**Ric decides:** how often things are found (rare, as history, or often, so a run shows it).
**Ric (2026-11-20): "Rare (make it a slide tho)".** A setting, "How often new things are found",
rare by default (as in history); turned up, a run shows it sooner.
**Budget:** default (a finding is checked only for people already at work).

### [ ] 15f. Work and buildings: technology people are employed in

Added 2026-11-20 (Ric: "technology needs to be more of a thing and there does need to be jobs so
do some research of how we could implement that"; power, wires and fuel go here: "These seem kinda
fixed by #3 answer").
**Now:** the livings are farming, fishing, herding, hunting, wood, stone, ore, crafts and trade
(item 9). With one farmer feeding 166, almost everybody would have nothing to do.
**Research (2026-11-20).**
- *How a game models it.* Victoria 3: every building is a workplace; each has "production methods"
  that set what it uses, what it makes and which workers it needs, and a new technology unlocks a
  new method rather than a free bonus — automation needs fewer labourers but more engineers, and
  costs coal and engines ([Dev Diary 5](https://forum.paradoxplaza.com/forum/threads/victoria-3-dev-diary-5-production-methods.1480760)).
- *Why workers move.* Structural transformation: as people grow richer they spend a smaller share
  on food (Engel's law), about the same on goods and more on services, and work follows the
  spending from farm to workshop to service
  ([Herrendorf, Rogerson and Valentinyi, NBER w18996](https://www.nber.org/papers/w18996)).
  England's share in farming above (60% in 1381 to 37% in 1759) and the US's one-in-166 are the
  same movement.
**Proposed (not agreed).** A workplace is a building with a *method*: what goes in (materials,
fuel, power), what tools it needs, how many hands and which skills, and what comes out. A
technique (15e) unlocks a method, never a bonus. People choose a workplace in `choose` the way
they choose any living, by what it pays against the walk and their skills, reading the same
`livelihood` figures. What is wanted comes from households' spending — food first, then goods,
then services (a shop, a carter, a teacher, a healer, a clerk who can write). Power works, fuel
works, wires and lines are buildings with methods too, and a tower or a car stops working when
what feeds it stops. Money stays simple (Ric).
**Done when:** a people that farms better moves people into other work by itself; knocking down a
power works stops what it fed; no workplace is placed by the program.
**Ric (2026-11-20, from item 17):** "Firefighters can be a job if it matches with the cities needs.
Or towns. That's the thing about the jobs they have to match what the city needs." A job exists
where the place needs it and can pay for it — never placed, never a fixed share of the people.
**Budget:** default.

**Long-distance trade is in 15f too** (added 2026-11-20 (added 2026-11-20, Ric: "I feel like there probably is something I'm missing historically" … "Keep languages all one language But add the other 10 please. And then research them"; read as search summaries; nothing built)). *Now:* traders carry within reach of
their village. *History:* caravans went about 35 km a day, a camel carrying about 160 kg; over long,
slow, unsafe routes mostly goods dear for their weight paid, though some routes carried ordinary goods
too — wool, cloth, millstones, weapons, slaves; ships went far faster per day
([UNESCO](https://en.unesco.org/silkroad/sites/default/files/knowledge-bank-article/the%20necessities%20of%20trade.pdf);
[Transport Geography](https://transportgeography.org/?page_id=1042);
[Bulliet interview](https://revistas.uniandes.edu.co/index.php/hiscrit/article/download/8485/8766/39075?inline=1)).
*No share of trade by value found yet.* *Proposed:* goods carried between far places by traders who
travel for weeks, worth it only for what is dear for its weight (finished goods, ore, wool), by land or
by boat; a route grows where traders keep going, and bandits and pirates (15.5b, 15h) prey on it.
*Question:* in, as proposed? On a 1,000 km land, far trade is within one world.

### [ ] 15h. Armies: what they carry, how far they go, and strategy

Added 2026-11-20 (Ric: "we need to cover what it is carrying with it so it knows how far they can
go. Armies will need more work too because rn they just run up one at a time instead of using war
strategies").
**Now:** an army marches on a village of each enemy, one place at a time, and its men arrive one
by one; food comes from home without being carried.
**Research (2026-11-20).**
- *Carrying.* Engels worked out how Alexander's army was fed: what a man, a mule and a cart can
  carry, what each eats, and that pack animals eat their own loads, so an army can go only so many
  days from water and food; a soldier carried about ten days' rations by one summary
  ([Engels 1978](https://ucpress.edu/books/alexander-the-great-and-the-logistics-of-the-macedonian-army/epub-pdf);
  [History Hit](https://www.historyhit.com/how-did-alexander-the-great-sustain-his-army/)). His
  rations appendix to be read before building.
- *Numbers and weapons.* Lanchester: with hand weapons each fights one at a time and strength grows
  with numbers (linear law); with weapons that reach, every man can fire at every enemy and
  strength grows with numbers squared (square law), so splitting an army quarters each half —
  concentration decides; real battles fit about 1.5 between the two
  ([Lanchester's laws](https://en.wikipedia.org/wiki/Lanchester%27s_laws);
  [Kress, NPS](https://faculty.nps.edu/mkress/docs/Lanchester_Models.pdf)). This is why arriving
  one at a time is so costly, and more so with each era (15d).
- *Dupuy's lethality, by weapon* (supplied by Ric, 2026-11-20, from another session's search; its
  own notes on what it saw are kept). Units are roughly theoretical casualties an hour against men
  standing one to a square metre on open ground. Two versions disagree — the 1964 HERO report adds
  a mobility factor and runs higher — so **use one set only: the 1980 book's**, Dupuy, *The
  Evolution of Weapons and Warfare* (1980), p. 92, as reproduced by Duke's firearms-law centre,
  ISSI (2021) and a CGSC monograph:
  sword, pike and the like 23; ordinary bow 19; English longbow 36; 17th-century matchlock musket
  19; 18th-century flintlock 43; early 19th-century rifle 36; mid-19th-century rifle (Minié
  bullet) 102; late 19th-century breech-loader 153; Springfield 1903 495; WWI machine gun 3,463;
  WWII machine gun 4,973; 16th-century 12-pounder cannon 43; 17th-century 224; Gribeauval
  12-pounder 940; French 75 mm 386,530; WWII 105 mm howitzer 657,215; WWII medium tank 935,458
  (one source prints 575,000); WWII fighter-bomber 1,245,789; V-2 3,338,370; 20 kt nuclear
  airburst 49,086,000; 1 Mt 695,385,000 (one source 694,385,000).
  *Not in that set:* javelin, crossbow, arquebus (the 1964 set has crossbow 32 and arquebus 10,
  but is not to be mixed in). How the index is made — rate of fire × targets per strike ×
  relative effect × range effect × accuracy × reliability — with the factors known for sword
  (reach 1 m, accuracy 0.95, effect 0.4), longbow (200 m, 0.95, 0.5), musket (150 m, 0.55, 0.6),
  flintlock (200 m, 0.65, 0.7) and the 1903 rifle (2,000 m, 0.95), from Dupuy's *Numbers,
  Predictions and War* (1979) via [Volokh 2022](https://reason.com/volokh/2022/11/01/the-theoretical-lethality-index-is-useful-for-military-history-but-not-for-gun-control-policy/).
  A missing weapon is made from those factors, never guessed.
  *Dispersion (OLI = TLI ÷ dispersion), NOT verified* — from memory of Dupuy's *Understanding War*
  (1987, p. 84): antiquity 1, Napoleonic 20, American Civil War 25, WWI 250, WWII 3,000, 1973
  4,000. To check in the book before it is used; without it deadly weapons would kill far too many.
- *How a program reasons about ground.* An influence map: a coarse grid where each side's strength
  spreads out and fades with distance, giving threat, who holds what and where the front is; game
  armies use it to choose where to attack, defend or gather
  ([Game Developer: influence mapping](https://www.gamedev.net/articles/programming/artificial-intelligence/the-core-mechanics-of-influence-mapping-r2799);
  [Miles and Louis, UNR 2006](https://www.cse.unr.edu/~sushil/pubs/newestPapers/2006/cig06/cig2006.pdf)).
**Proposed (not agreed).** An army is people who carry real food and goods (by hand, beast or
cart, 7d), eat each day, take from the land and villages they pass (hurting them, item 14b), and
are fed along a line of carts from home that can be cut. How far it can go is worked out from that
before it sets out, and it turns back when it must. It gathers before it marches and moves
together; its leader (by their stats: bold, patient, hot-tempered) chooses from one influence map
per side, kept up once a day on a coarse grid, where to strike (the weakest held place), whether
to go round, wait for numbers, hold a river or a hill, cut the enemy's food, or retreat. Battles
fought with the law for their weapons (15d).
**Done when:** an army that outruns its food turns back or starves; a gathered army beats the same
men arriving one by one; cutting a supply line makes an army withdraw — none of it scripted.
**Also in 15h** (Ric, 2026-11-20, from 15i's research): **mercenaries** — soldiers whose living is war,
hired from a treasury by contract, who plunder or turn bandit when nobody pays them (the free
companies; about a third of armies in 1500 by one estimate; Thomson's *Mercenaries, Pirates, and
Sovereigns* to read first) — and **pirates**, taking at sea from boats carrying goods (7d), run by
their own rules (Leeson); Barbary captive numbers (Davis) to find first.
**Budget:** default (one coarse map per side a day).

### [ ] 15i. People who belong to no one place: foragers, herders who move, and travellers

Added 2026-11-20 (Ric: "aren't their people who aren't part of a place? Depending on the era too? They
travel?"). Before 15d, which makes "Foragers" one of the starting eras.
**Now** (read from `people.js`): everybody belongs to a village from birth (`p.home`); a village
never moves; traders, herders, hunters and soldiers go out and come back. Every grown-up takes a job
(farmer, crafter, trader, fisher, woodcutter, miner, herder, hunter), farming is always there, there
is no gathering of wild plants, and every faction has a leader (elected, a chief, or the richest).
A band where everybody hunts, gathers and shares, with no jobs, no farming, no ruler and no fixed
place, cannot be made.
**What history has** (research begun 2026-11-20):
- *Foragers.* Bands of a few families who moved camp: Binford's "foragers" moved often and stored
  nothing, his "collectors" moved to a few key places (water) and sent parties out from them; how
  often a band moves follows how fast it uses up the food round its camp; band size is strikingly
  steady and changes with the season (Binford 1980, [pdf](https://edisciplinas.usp.br/pluginfile.php/4902707/mod_resource/content/1/Binford.pdf);
  Kelly, *The Lifeways of Hunter-Gatherers*; Batek, [PNAS 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5373393);
  263 camps, [*American Antiquity* 2018](https://www.cambridge.org/core/journals/american-antiquity/article/scaling-the-size-structure-and-dynamics-of-residentially-mobile-huntergatherer-camps/3A1BC468ED01A37BA8FFCE003D1C7B44)).
  No ruler, held down on purpose (Boehm, 15c's notes); work by age and sex, not by trade; food shared.
  *Moves a year and camp sizes to read from Kelly's and Binford's tables before building.*
- *Herders who move.* Pastoral nomads following grazing by season; about 30–40 million today, a
  falling share where farms spread; 40% of Mongolia still; long pushed aside by farmers and towns
  ([Nomadic pastoralism](https://en.wikipedia.org/wiki/Nomadic_pastoralism);
  [Pastoralism journal 2015](https://core.ac.uk/download/70970062.pdf);
  [FAO](https://www.fao.org/3/y2647e/y2647e02.htm)).
- *Travellers inside a settled people.* Pedlars, tinkers and travelling craftsmen, players, pilgrims,
  harvest workers on the road, and vagrants ([Nomad](https://en.wikipedia.org/wiki/Nomad); "weaver in
  winter, bricklayer in summer", 15.5's notes). *No share of the population found yet; to find before
  building.*
**Proposed (not agreed).** A household's home can be a camp, not a village: a camp moves when the
food round it runs down (the forager rule) or with the season and the grazing (herders), and takes
its people, shelters and stores with it. What a people does comes from what it knows (15e: no
farming known means gathering and hunting) and its customs and stats (15a), never from a switch;
a forager band gets jobs only if a need makes them (15f) and a ruler only if 15c's needs make one.
Travellers are people whose living keeps them on the road (pedlar, tinker, harvest hand), and the
landless who have no place to go (after a famine, a war, 15.5b). Settled and moving peoples meet:
trade, raids, marriage, and the old quarrel between the farmer's field and the herder's grazing.
**Ric decides:** (1) which kinds — forager bands, herding nomads, travellers inside settled peoples,
all three? (2) can a settled family take to the road and back (a vagrant after a famine; a herder
family settling)? (3) is a moving people a faction of its own, or can it live inside a settled one's
land?
**Ric's answers (2026-11-20):** (1) **all of them**, "and if there are more ways of living we're
missing"; (2) a settled family can take to the road and back: **yes**; (3) a moving people as its own
faction or inside a settled one's land: "What is realistic. Probably both." And the figures: "yeah
that stuff needs looked up".
**Looked up (2026-11-20):**
- *How often foragers moved, and how many.* Across 312 forager cases, a camp moved on average 7.4
  times a year (median 5.5, from 0 to 58); a camp held on average 41 people (median 27) (Marlowe 2005,
  summarised in [PMC table](https://pmc.ncbi.nlm.nih.gov/articles/PMC2999363/table/T3));
  the Ache, in rich forest, moved 75–100 times a year in camps of about 43. Warm, productive places
  mean shorter, more frequent moves ([PMC review](https://pmc.ncbi.nlm.nih.gov/articles/PMC5373393)).
  *To read from Kelly's tables before building:* distance a move.
- *Both, as Ric guessed.* Steppe peoples formed empires of their own beside settled ones and lived
  off them by tribute, raiding and trade — the Xiongnu beside the Han, alternating war and peace to
  raise the tribute and avoiding taking farmland — while many herding and travelling peoples lived
  within a state's land and law (Barfield, *Shadow Empires*, [Princeton](https://press.princeton.edu/books/paperback/9780691278308/shadow-empires);
  [review](https://asianreviewofbooks.com/content/shadow-empires-an-alternative-imperial-history-by-thomas-j-barfield/);
  Golden, ["The stateless nomads of early medieval Central Eurasia"](https://cyberleninka.ru/article/n/the-stateless-nomads-of-early-medieval-central-eurasia)).
  Nomads alone had few resources to build a state from, so their empires drew on settled neighbours.
  *So:* a moving people is a faction when its own stats and needs make it one (15c), and otherwise
  lives on a settled people's land, paying or not.
- *Travellers in a settled land.* England licensed hawkers and pedlars in 1697 at £4 a year and £4 a
  horse, treating the unlicensed as vagrants ([Hawkers Act 1697](https://vlex.co.uk/vid/hawkers-act-1697-808145973));
  the fear of vagrants followed fast population growth in the sixteenth and seventeenth centuries,
  which made a large underemployed migratory labour force, and many taken up as vagrants were simply
  out of work ([*Rural History* 2013, poverty and mobility](https://resolve.cambridge.org/core/services/aop-cambridge-core/content/view/0918E97B5FE98C377E190988311860D1/S0956793312000180a.pdf/editorial-poverty-and-mobility-in-england-1600-1850.pdf);
  [Sturdy beggar](https://en.wikipedia.org/wiki/Sturdy_beggar)). *No share of the people found yet;*
  Beier's and Slack's work is where to look. That is the sim's own rule: people take to the road when
  land and work run out, not by a quota.
- *More ways of living than the three* (Ric: "if there are more ways of living we're missing"). The
  usual classification runs foragers (most food from hunting, fishing and gathering), herders,
  horticulturalists (gardens with long fallow — fields cleared, used, left, so villages may move
  every some years) and farmers ([eHRAF, subsistence types](https://ehrafworldcultures.yale.edu/help/LearnMore/subsistence.html);
  [CUNY, subsistence](https://pressbooks.cuny.edu/discoveringculturalanthropology/chapter/chapter-5/)),
  with many peoples between them ([ANU, the middle ground](https://openresearch-repository.anu.edu.au/server/api/core/bitstreams/87962771-a5d0-41ae-a57f-828fa5545e0c/content)).
  Ways the sim does not have, *to research before Ric chooses*: **shifting cultivation** (slash and
  burn, the village moving when the soil tires — ties to 15.5d); **foragers who settle** where food is
  rich enough (big fishing peoples, who stored food and had rank and slaves); **transhumance**
  (the village stays, the herds and herders go up to summer grazing and back); **sea nomads** living
  on boats; and livings from **taking** — raiders, bandits and pirates — and from **fighting for
  pay** (mercenaries), which 14e's raiding bands and 15h's armies touch.
**The other ways of living, researched (2026-11-20, Ric: "Research those").** For each: what it is,
what the sim already has toward it, and whether it is worth having.
- *Shifting cultivation (slash and burn).* Short spells of cropping, then long fallow while the
  forest and the soil come back — 20 to 40 years in old Europe; shortening the fallow works only to a
  point, then yields fall and the soil goes. Boserup: as people grow more crowded, fallow shortens,
  from forest fallow to bush fallow to yearly cropping, and each step is more work for each meal; where
  land is short, shifting cultivation cannot be kept up. The land is usually held by households
  ([FAO](https://www.fao.org/4/r5265e/r5265e06.htm); [Shifting cultivation](https://en.wikipedia.org/wiki/Shifting_cultivation);
  [Mertz and others, *Human Ecology*](https://link.springer.com/doi/10.1007/s10745-006-9014-4)).
  *Have:* fields, forest, households holding land (7c); worn soil and regrowth are 15.5d. *Worth it:*
  yes, and nearly free once 15.5d is in — it is clearing forest for a field and leaving it, and the
  village moving when no forest is left near. Boserup's sequence then comes out of the run as people
  grow crowded. *To find:* how often swidden villages moved.
- *Foragers who settle.* Where food is rich and can be stored — the salmon of the North-West coast —
  foragers lived in permanent winter villages, stored food, had hereditary nobles, commoners and
  slaves, raided, and were denser than many farming peoples near them; storage was needed for this but
  did not cause it alone, and crowding and war did not predict it ([PMC 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8020663);
  [Canadian Museum of History](https://historymuseum.ca/cmc/exhibitions/archeo/hnpc/npvol28e.html);
  Wengrow and Graeber, [*American Anthropologist*](https://discovery-pp.ucl.ac.uk/10040342/1/Wengrow_Graeber_American%20Anthropologist_Rough.pdf)).
  *Have:* fishing (6c), stores, ranks by wealth. *Worth it:* yes — it is the forager band of 15i
  staying put where the fish are, with rank coming from 15c's stats, not from the fish. It shows that
  settling does not need farming.
- *Transhumance.* The village and most people stay; the herds and a few herders go up to summer
  pasture (an alp, a shieling, a hafod) and come down in autumn — in the Alps in late September or
  early October, and in the Alps since about 3000 BC ([Transhumance](https://en.wikipedia.org/wiki/Transhumance);
  [Alpine transhumance](https://en.wikipedia.org/wiki/Alpine_transhumance);
  [Almabtrieb](https://en.wikipedia.org/wiki/Almabtrieb)). *Have:* herders who go out and come back
  each day (9b). *Worth it:* yes, small: herders sleeping at a summer hut for the season where grazing
  is far and high, the herds grazing the hills in summer, and the village keeping hay for winter.
- *Sea nomads.* The Sama-Bajau lived by fishing and trade from boats, many families keeping close to
  shore in stilt houses or on their boats, diving for sea cucumber, shell and pearls for land patrons
  who traded them on, and trading with land peoples for pottery and iron; now mostly settling
  ([Bajau](https://en.wikipedia.org/wiki/Sama-Bajau); [ANU Press, Sather](https://press-files.anu.edu.au/downloads/press/p69411/html/ch13s04.html);
  [National Geographic](https://www.nationalgeographic.com/photography/article/we-are-what-we-eat-diving-for-dinner-with-the-sea-gypsies)).
  *Have:* boats (6d, 7d), fishing, coasts. *Worth it:* the least: a home that is a boat, which needs
  long warm coasts the seed must make. Could come later, after boats as homes are natural.
- *Bandits and pirates.* Hobsbawm's social bandits came from peasants in times of impoverishment,
  economic crisis, war, conquest and foreign rule, and a few were remembered as noble; "in real life
  most Robin Hoods were far from noble" ([Social banditry](https://en.wikipedia.org/wiki/Social_banditry);
  [British Academy](https://www.britac.ac.uk/blog/eric-hobsbawm%E2%80%99s-%E2%80%98bandits%E2%80%99)). Pirates
  ran their ships by written codes and rules because it paid them to (Leeson, *The Invisible Hook*,
  [Princeton chapter](https://assets.press.princeton.edu/chapters/s8850.pdf)). *Have:* the landless
  and the hungry (15.5b), the dishonest stealing (10), raiding bands (14e), roads and carts and boats
  carrying goods (7d). *Worth it:* yes — a band taking from carts and villages is the landless,
  hungry and dishonest choosing to take, a living weighed in `choose` like any other, and it rises
  in hard times by itself. *To find:* Barbary corsairs' captive numbers (Davis) if piracy at sea goes in.
- *Fighting for pay.* Free companies of the 12th–14th centuries fought for whoever hired them and
  plundered between wars; Siena paid 291,379 florins in 1342–99 to buy them off; condottieri hired
  out by contract and some became lords; the Swiss hired out by canton; by one estimate about a third
  of European armies in 1500 were mercenaries; standing armies came partly in answer to the free
  companies' plunder ([Free company](https://en.wikipedia.org/wiki/Free_company);
  [Condottieri](https://en.wikipedia.org/wiki/Condottieri);
  [War History, medieval mercenaries](https://warhistory.org/2017/10/20/mercenaries-during-the-middle-ages/)
  — popular sources, the shares rough). *Have:* soldiers raised by a faction (14e), a treasury.
  *Worth it:* yes, with 15h: soldiers whose living is war, hired from the treasury, who turn bandit
  when nobody pays them. Janice Thomson's *Mercenaries, Pirates, and Sovereigns* to read before
  building.
**Questions for Ric:** which of these go in, and where? Recommendation: shifting cultivation with
15.5d (it is that part's land change used as a way of farming); bandits with 15.5b (hunger and
landlessness are what make them) or with 15i; foragers who settle and transhumance in 15i;
mercenaries and pirates in 15h; sea nomads last, or not at all.
**Ric (2026-11-20): "Yep"** — placed as recommended, with 15.5 done before 15, and none in 16–19.
So nothing placed in 15.5 may lean on an item of 15: shifting cultivation needs only 15.5d's land,
and bandits only what 15.5b and the engine already have (hunger, the landless, theft, raiding bands,
carts and roads). Written into each item:
- **15.5d** — shifting cultivation.
- **15.5b** — bandits on land.
- **15i** — foragers who settle, seasonal herding, and sea nomads as its last part.
- **15h** — mercenaries, and pirates at sea.
**Done when:** a people with no farming know-how lives by gathering and hunting, moves camp when the
food runs down, and has no fixed jobs and no ruler unless its own needs make them; a herding people
moves with the season; none of it is a switch.
**Budget:** default (a camp moves rarely; nothing per person between moves).
**How foragers' days differ** (added 2026-11-20, Ric: "do they sleep different do they actually live
different? Are their responsibilities different?"; "didn't hunter gatherers live longer but couldn't
support as many people as farmers?").
- *Work and leisure.* Agta foragers: about 24 hours a week of work out of camp, 20 of chores, and a third
  of daylight in leisure; neighbours who took up farming worked about 10 hours a week more, and the women
  in the most farming communities had half the leisure (Dyble and others, *Nature Human Behaviour* 2019,
  [paper](https://www.nature.com/articles/s41562-019-0614-6)); among the Tsimane and Hadza, farming gave
  more food an hour for about the same hours, which may be why it was taken up (Kraft and others 2021,
  [pdf](https://gurven.anth.ucsb.edu/sites/default/files/sitefiles/papers/kraft%20et%20al.%202021.pdf)).
- *Children.* Raised by many hands: each couple with young children had help from about 1.3 other adults
  in South American foragers, and older children did much of it; grandmothers were not the main helpers
  there ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC2817285); [PMC 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC10955362)).
- *Food.* Game divided across the band with no favour to kin; plant foods shared widely, a little more to
  kin ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4184416)).
- *How long they lived.* Life expectancy at birth was low because so many children died, but those who
  reached adulthood most often died at about 68–78: an adult forager could expect a long life (Gurven and
  Kaplan, "Longevity among hunter-gatherers", 2007, [pdf](https://gurven.anth.ucsb.edu/sites/secure.lsit.ucsb.edu.anth.d7_gurven/files/sitefiles/papers/GurvenKaplan2007pdr.pdf)).
  Early farmers were shorter and sicker than the foragers before them in 19 of 21 societies studied (Cohen
  and Armelagos 1984), recovering later in some regions; the big change was more births, closer together,
  rather than fewer deaths ([Mummert and others 2011](https://econpapers.repec.org/RePEc:eee:ehbiol:v:9:y:2011:i:3:p:284-301);
  [PMC 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC9942808)).
- *How many the land holds.* Foraging seldom supports more than about one person a square kilometre, from
  0.01 up; shifting cultivation about 20–30 a square kilometre of farmland, farming far more
  ([Foragers](https://en.wikipedia.org/wiki/Hunter-gatherer); [MIT Press excerpt](https://muse.jhu.edu/books/9780262312264/9780262312264-12.pdf)).
  So Ric is right on both counts: fewer, healthier, longer-lived adults as foragers; many more people, more
  crowded and sicker, as farmers.
*None of it is set:* the hours come from how much work a day's food takes and what is shared; the health
comes from a varied diet against a grain diet and from crowding (15.5r); the numbers from how much food
the land gives each way; the sleep from 15.5s. Measured against these figures when 15i is built.

**Also in 15i** (Ric, 2026-11-20): **foragers who settle** where food is rich and can be stored (the
fishing peoples of the North-West coast), **seasonal herding** (herds and a few herders at summer
pasture, the village keeping hay for winter), and, **as its last part**, **sea nomads** whose home is
a boat. Research in the notes above.

### [ ] 15d. Eras as starting points; news by what is built; towers, cars, houses, medicine

Split out of 15 on 2026-11-20; rewritten the same day with Ric's answers. Last of the 15 family,
because an era is now only a starting list of know-how (15e) and buildings (15f).
**From 15a (2026-11-20):** the era numbers that are one constant for the world now (`WAR_ERA` — season, standing, campaign, wall worth, hold and days — and the food and travel figures) go on a record per faction here, where they first differ by faction; 15a left them as they are since nothing could read them differently yet.
**Do:** the nine eras as starting points chosen per faction (**Which eras**, in 15); weapons by
era with the Lanchester law that fits them (15h); medicine (children dying, length of life); house
shapes by era and by people; cell towers and cars as things built, owned, fed and destroyed; and
**news at the speed of what is built** (Ric: "the news speed shouldn't be for era it should be for
what is built"): between two places, news goes by the fastest thing that links them — a walker, a
road, a relay of horses, a post (needs writing, 15e), a telegraph line, a radio, a tower in reach —
and each of those is a thing that can be built, cut or knocked down.
**Done when:** 15's "Done when": the same land and people from two starting eras fight, travel and
hear news at measurably different speeds; knocking down a tower or cutting a line slows the news
in its area and nowhere else.
**Budget:** default.

### [x] 15.25. Faster People simulation without losing quality, and births without a population cap

Added 2026-11-20 at Ric's request after a performance audit: "1-5 needs added in todo as
15.25". On births: "Idk why births stop they shouldn't." Then: "Don't do the birth cap fix.
Just put it in the todos with the others. Only mess with the todo page." **This entry records
future work; none of these changes has been implemented by the audit.** Another session is
working on the engine, so re-read and re-profile its current version before implementing this.

**Do, in small measured passes:**

- [x] **1. Make conversations cheaper to record.** `converse` and `conversationState` in
  `people.js` create before/after snapshots and compare their fields for every exchange.
  Reuse temporary storage and avoid duplicate reads while keeping every conversation, its
  actual effects and the inspector's before/after receipts. An inspected record must still
  survive eviction from the rolling history without being changed by later conversations.
- [x] **2. Reuse pathfinding storage.** `routeAround` creates maps, heap storage and node objects
  for each search. Investigate reusable scratch buffers for it and `landWay`, keeping the same
  search order, tie-breaking, search bounds, routes and checks on every footstep. Preserve the
  invalidation rules for blocked steps, failed searches, bodies moving and crossings changing.
- [x] **3. (measured; not built, see Research notes) Schedule people who are due instead of scanning everyone each step.** `actionTick`
  skips idle people's behaviour but still checks everyone's wake time 1,440 times per day.
  Investigate an ordered active list or due-time buckets. Preserve the existing person order,
  including somebody woken by an interaction during a step, hourly updates, births, deaths,
  moves and outside orders. Measure the scheduler's own overhead before choosing it.
- [x] **4. Send and paint changed map regions.** `people-host.js` currently builds a full crop
  picture and copies the whole owner array for a land update; `index.html` repaints the land
  from that answer. Investigate changed chunks, separate ownership changes from crop changes,
  and reuse transfer buffers safely. Keep the same detail and update cadence, correct borders,
  panning and zooming, with a complete first picture and recovery from a missed update.
- [x] **5. Keep indexes for repeated population searches.** Audit family, faction, village and
  event-witness lookups before adding more features. Reuse existing resident/spatial lists;
  add ordered child or faction lists where measurements justify them. Births, deaths, adoption,
  moves and faction changes must keep every index correct. Preserve eligibility, encounter
  order and random-number consumption; do not replace individual people with totals.
- [x] **Remove the birth population cap.** `reflect` currently requires `people.length < 3000`
  before a couple can have a child. Remove that arbitrary gate when this work is implemented.
  Keep the existing age, partner, food, crowding and fertility rules, including Children set to
  zero. Add regression coverage for births at and above 3,000 people and for crossing that
  boundary through actual births; newborns must still use existing household supplies and
  join the engine's growing memory, wake and spatial structures correctly. This intentionally
  changes worlds at the old cap, and its extra simulation work must be reported separately
  from the gains made by optimizations.

**Research first:** allocation reuse and bounded search workspaces, ordered event scheduling,
spatial queries and transferable-buffer ownership. Extend the audit with current profiles of
ordinary villages, dense towns, war, winter and older worlds, plus large sparsely settled maps.
Keep the engine and its worker; these are improvements within them.

**Audit measurements (2026-11-20, provisional):** AMD Ryzen 5 3600, 24 GB, Node v24.19.0,
seed 7, sickness off, full conversation records, the working copy then current. With the first
day excluded, CPU-profiled runs took about 2.36 s/day for 5,000 people on 40 km (three measured
days), and 14.84 s/day for 20,000 on 80 km (two days). Conversations accounted for about 22%
and 16% of sampled time respectively; local route searches about 16% at 20,000. These are
inclusive call-tree shares, not additive categories. Only about 27-28% of person-steps ran
behaviour, although every wake time was checked. Desktop load varied, so these are pointers
to where to measure, not guaranteed performance targets. A keeper-only land update for 400
people on 500 km took about 21 ms to prepare and contained 12.4 MB of typed-array data; that
excludes message delivery and browser painting. No optimization speedup has yet been measured.

**Ric decides:** the scope above is requested. The discussion of seven friends did not authorize
a new friendship cap; keep the existing five-person close circle and other relationship rules.
**Done when:** each optimization is measured before/after and produces the same world for the
same seed, including memories, events, choices and conversation receipts, over representative
timelines and outside interventions. Extend `walking`, `dozing`, `keeper`, conversation and
time/food coverage where needed. Verify map changes in the browser at phone and desktop widths.
Test the birth fix separately because removing the cap intentionally changes outcomes. Record
the results and any remaining work here; do not tick this whole item after only one pass.
**Budget:** improve measured runtime or display cost without reducing simulation detail;
unaffected benchmark cases follow the existing no-more-than-5% regression budget. Measure the
cost of newly allowed births separately rather than disguising it as an optimization regression.

**Research notes (2026-11-20).** Profiled first (seed 7, sickness off, a day after the first):
5,000 on 40 km 2.06 s a day, of it `act` 20% and conversations 21% inclusive (receipts about
half of that); 20,000 on 80 km 14.2 s, `landWay` 15% self, `routeAround` 9%, conversations 11%.
Counted at 20,000: 916 land-way asks a day, 534 searched, 4.7 million looks, the cache never
cleared; 7,437 crowd searches, 50 million body checks.
- *Reused workspaces*: both searches already pushed a place again rather than changing its
  priority, the cheap way ([Amit Patel's A* implementation notes](https://theory.stanford.edu/~amitp/GameProgramming/ImplementationNotes.html));
  what cost was making a queue, two `Map`s and an object a place each search. Chosen: typed
  arrays kept between searches, a table emptied by a round number. Same order, same ties.
  `Math.hypot` could not be swapped for `Math.sqrt`: 35% of whole-number pairs give a different
  last digit, which would break ties differently.
- *Ordered event scheduling*: a calendar queue ([Brown 1988](https://www.maths.tcd.ie/~eoin/index/brown_calendar88.html))
  is the standard O(1) way to pick who is due. Measured before choosing: the pass over everybody's
  waking time is about 5% of a 5,000-person day (an extra empty pass), and a tighter loop gave no
  measurable change in three alternated runs. A queue would also have to keep the person order
  the world depends on. Not built.
- *Changed regions and transferable buffers*: a buffer handed to the page belongs to the page
  ([MDN, Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)),
  so the keeper keeps its own copy of what it sent and sends only the blocks that differ; the page
  paints a block with `putImageData`'s dirty rectangle ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData)).
  A canvas is held premultiplied by alpha, so reading back see-through pixels is lossy
  ([Mozilla bug 389366](https://bugzilla.mozilla.org/show_bug.cgi?id=389366)): the page check
  reads the canvas once first.
- *Population searches*: none of the whole-population scans was hot (census 0.15 s a day at
  20,000, `reflect` 0.1 s). The ones that were: a village's houses searched through every house
  (0.19 s a day), a founding's search for each family's children, and the census reading traits
  by a list of names.

**Ric's answers:** none were needed: "the scope above is requested", and the birth fix was asked
for with it.

**What was done (2026-11-20), all five passes and the births, each held to the identical world.**
Proof: a scratch harness hashed the whole world (people, minds, villages, factions, events and
their hops, conversations and receipts, stores, holders) after every day, old engine against
new, in nine worlds (orders from the page, 2,000 on 17 km, a town, two enemies at war 40 days,
150 days through winter, 400 on 500 km, 5,000, 20,000, light records): the same in all nine
after passes 1–5.
1. Conversation receipts: done (before-rows reused, after compared in place; `shift` for the
   rolling list).
2. Search workspaces: done. 20,000 people: crowd search 2.9 → 1.6 s a day, land search 0.99 →
   0.90 s. Costs about 0.8 MB of fixed workspace per world (a 400-person world 2.5 → 3.3 MB).
3. Scheduling the due: measured and **not built** (above).
4. Changed map regions: done. 400 on 500 km: 21 → 11 ms to prepare a land update, 12.4 MB → a
   few KB. The page paints only changed blocks and no longer repaints the whole land whenever
   the villages are sent. Checked in headless Edge, small and big land and phone width: painted
   by blocks = painted whole, value for value. `test/land-updates.test.mjs`.
5. Indexes: done where measured: each village's houses (`homesOf`), a founding's children,
   census traits by name.
- Births: the 3,000 line is gone. `test/births.test.mjs` (slow lane): births above 3,000 with
  the audit on, a country crossing 3,000 by births and births after, none with Children at
  nought.
- **Bug found and fixed**: somebody passed over as listening was not woken when their speaker
  was drawn into talk with another, so passing over differed from visiting everybody (two
  enemies of 300 on day 6; two seeds in five at 3,300). Fixed in `said`; such worlds now equal
  plain walking (`test/dozing.test.mjs`, "left listening"), and so differ from before.

**Done 2026-11-20:** passes 1, 2, 4 and 5 and the births, measured and held to the same world; pass 3 measured and not built; a passing-over bug found by the audit and fixed. Left: nothing of this item; the biggest costs now are `act` itself and the conversations' own work (`exchange`), which no pass here touched.

### [ ] 15.5. What items 1–14 missed, and what is weak

**Order (Ric, 2026-11-20): 15.5 is done before 15** — "we should do 15.5 then 15". The
whole order is now **15.5 → 15 (15a done; then 15c, 15g, 15b, 15e, 15f, 15h, 15i, 15d) → 16 → 17**.
15.25 was done by another session the same day.

Added 2026-11-20 (Ric: "Look through 1-14 and see what we missed or where we need to improve",
then "15.5 please"). Every "not met", "open" and "left out" note in items 1–14 was checked against
items 15–20 and `PEOPLE-VISION.md`. Parts a–h are things no later item picks up; part i is things
that are in but hardly show in a normal world; part j is speed. Do the parts in order, one a
session, the way any item is done; split further if one is too big.

**[x] 15.5a. The store piles up goods nobody uses** (left open by item 9). *Done 2026-11-21:*
crafters make to order (one order a person, a season's stock kept from what is taken, the bench
paying only for what is asked); a default year's store ends at 0.14–0.16 goods a head, about a
season and a half of use, against 38–54 before; 37 → 0 dead of cold and 7 → 3 starved over four
seeds, because crafters no longer burn the wood and hours the village needs. Also: households
start owning goods, the levy calls any trade, and a rumour of sickness keeps people from going to
load there (a 12b gap). Left: births in big worlds are about a tenth of a real rate in the old
engine too (`test/births.test.mjs`) — for 15.5k. README, "Made to order". A village store holds
hundreds of goods that are never spent. 15f's jobs and workplaces stand on this economy, so it
must make sense first. Find out where goods come in and why nothing draws them down (what
households want, what crafters use, what wears out). Done when: a default year's store holds
roughly what its people use in a season, without a cap or a rule that throws goods away.

**15.5b. Towns cannot be fed from round them** (left open by item 8 and its food-supply fix). A
city of half the people starves: the land round it has a quarter of what it needs to spare, and
its money buys less. Research how real towns drew grain (item 8's notes: 20–30 km by land, much
further by water) before changing anything. Done when: a starting city is fed or fails because
of the land and the roads round it, measured over several seeds, never because a number was
turned until it lived.

**Split 2026-11-21** (too big for one session, as "How to do an item" says): **b1** rivers that run
one way and grain by boat in bulk (the transport the rest needs) → **b2** the government's grain
trade (a leader buying grain in from other villages and peoples, and forcing hoarders to sell, by
their stats) and the "done when" above, measured → **b3** food riots → **b4** bandits on land. The
research for all four is in the notes below.

**[x] 15.5b1. Rivers that run one way, and grain by boat.** *Done 2026-11-21:* boats go with the
current at full pace, across it at two thirds and against it at a third; they follow rivers round
corners and past fords and bridges (both were impassable before); a landing may be on a big river; a
village's boat carries ten carts of grain where that is quicker a ration, and a village that would
ship grain wants a boat. Measured: no boat built in a year of three river worlds, old or new — few
villages are on navigable water and grain seldom moves between them. Left out: villages that settle
by water (the vision's "Water as the reason places are where they are", not yet an item). README,
"Rivers that run one way, and grain by boat".

**[ ] 15.5b2. The government's grain trade**, and the measurement of a starting city fed or failing.

**[ ] 15.5b3. Food riots** (Ric: "Yes they should"; who riots and why in the notes below).

**[ ] 15.5b4. Bandits on land** (Ric, from 15i's research).

**15.5c. Land from about 2 km²** (left by item 4a, never done by item 5). The smallest land is 5 km
across (25 km²); Ric asked for about 2 km². The square must get smaller as the land does, or a
house and its field are one square. Ric decides: how few people and villages a land that small
starts with.

**15.5d. Land that changes** (`PEOPLE-VISION.md`, "Land"). Soil worn out by farming the same
square year after year and coming back when left; forest cleared and staying cleared until it
regrows. Floods and fires dropped by the visitor stay item 17. Research first: medieval yields on
land left fallow and not; how long woodland takes to come back.

**15.5e. Health: wounds and old age** (`PEOPLE-VISION.md`, "People"). A wound from a fight or a
battle that heals slowly or does not; old age taking away what a person can do (heavy work, long
walks, fighting). Item 18 stays the mechanism for sickness that spreads. Ric decides: whether a
lasting wound can stop somebody working for good.

**15.5f. A household's own firewood** (left open by item 9). Firewood is the village's, while
food, water and money are the household's. Make it the household's, fetched or bought like water.

**15.5g. News of a good harvest** (left open by 12b). People act on news of dear food and dry
years, not on news of plenty elsewhere. A good harvest becomes an event people hold and pass on,
and traders and the hungry act on it the way 12b's news is acted on.

**[x] 15.5h. Two things left out of items 13 and 14.** *Done 2026-11-21:* a soldier at war is
armed from what the loyal give, then by the treasury buying from the store, then by an order the
crafters fill (15.5a); a world with wars off is the same world. The Factions tab has **Arrange a
marriage** for a ruled people: any grown-up of each, no refusal, a partner either had left on their
own, family refused, and at war it ends the war. Left out: nothing of h. README, "Wartime gear, and a
marriage of your choosing". (1) In a war, crafters turn to making gear for
the soldiers, from the stats and the store as any work is chosen (14a); (2) a page button for a
ruled faction to offer a marriage for peace (13, 14d), using 14d's marriage as it is.

**15.5i. In, but hardly seen in a normal world.** Measure each again after item 15 has changed
the world, and only then decide whether it needs work; write what was found here.
- Fords, bridges and armies stopped by water show only on lands of about 100 km and up: the default
  17 km land has no big river (6). Boats carrying goods are rare everywhere (7).
- Few houses built in a first year; no road built on purpose, roads only wear in (7).
- News is forgotten within days, since in a full mind it is usually the weakest thing held (12).
- Few have family in another village early on, so fleeing to family and food sent to them are rare
  (12b).
- Fights only between neighbours of one village (10); Honest moves no hours until people go hungry
  (10).
- People moved house about half again as often after item 11 (248 a world-year against 168);
  written down, never explained.
- A faction at war works as much as one at peace (51% against 51%), not more (14a).
- Even wars mostly outlast two years (3 of 13 ended, 14c, 14e).
- Widows remarry no sooner or later for a war (14b); remarriage itself is 15b.

**15.5j. Speed.** 20,000 people on 80 km ran at 52× after 2b and about 19× by item 13, a little
lost with each item; the row has not been run since item 13, and the M1 rows for item 2 on were
never filled in. Run the full bench, find what each item added at 20,000, and win back what does
not change the world. Item 15 adds per-faction ways, offices and know-how, so this matters more
after it.
**Overlaps 15.25** (added the same day by another session after a performance audit): the
speed work itself is 15.25's five passes; j is only the 20,000-person measurement and, if it
finds something 15.25 does not cover, a pass added there rather than here.

**15.5k. Babies, children and mothers dying, and the gap between births** (added 2026-11-20, Ric:
"early humans … the baby infertility rate was low … is all that built in?"; "Write what you said
down"). *Now* (read from `people.js`): each person's age of death is drawn at birth between 0.72 and
1.28 of "How long they live" (default 60), so almost nobody dies of age before about 43; a child dies
only of the sickness (three times likelier under five) or of cold. Nearly every child grows up. A
fed couple at home has children at a steady rate, with no gap after a birth, and no mother dies in
childbirth. *History:* about a quarter of babies died in their first year and nearly half of children
before fifteen, among foragers and in historical populations alike (Volk and Atkinson 2013, item 15's
notes); foragers had about six children each, about 3.7 years apart, the gap kept mostly by
breastfeeding, and 60% reached fifteen (Kaplan, Hill, Lancaster and Hurtado 2000,
[pdf](https://www.unm.edu/~jlancas/KaplanHillLancasterHurtado_2000_LHEvolution.pdf); forager and
chimpanzee vital rates, [PNAS 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6600907); Hill and
Hurtado on the Ache's spacing); England's parish registers 1650–1800 give about 10 mothers dead per
1,000 births, 17 at the mid-seventeenth-century peak, and with several births a woman's lifetime risk
near one in sixteen ([Cambridge Group, childbirth in the past](https://www.campop.geog.cam.ac.uk/blog/2024/09/19/childbirth-in-the-past/);
[*Medical History*](https://pubmed.ncbi.nlm.nih.gov/3511335/)). *Needed:* yes, for every era,
today's village included. It is a missed piece of item 10's people, and it changes the default world:
with children dying as they did, today's birth rate would shrink every world, so births rise to
match — as they did in life — rather than a number being turned until the world holds.
*Proposed:* children die of what killed them (sickness, hunger, cold, accident) at the historical
strength by age, not of a fixed rate; a mother can die in childbirth; a mother nursing a baby is
unlikely to conceive for a few years; how long people live and how many children they have stay
settings. Each era's medicine (15d) then lowers these, as it really did.
*Questions:* (1) Children dying of real causes at real rates, so a family loses some? (2) Mothers
dying in childbirth? (3) The gap after a birth? (4) The default world's "Children" setting then means
"as many as they had", with the world measured to see it holds?
**Ric's answers (2026-11-20):** all four **yes**. Asked whether 15.5k belongs in 15.5 or elsewhere:
it stays in 15.5 — it changes today's world in every era, and 15d's medicine stands on it — and runs
right after 15.5e (wounds and old age), the other part about bodies.

**Ten things history had that the plan missed** — checked against this file, `PEOPLE-VISION.md`
and `people.js` on 2026-11-20 (added 2026-11-20, Ric: "I feel like there probably is something I'm missing historically" … "Keep languages all one language But add the other 10 please. And then research them"; read as search summaries; nothing built). **One language** for everybody, by Ric's word: no
part for languages. Seven are parts of 15.5 below; slavery and serfdom go to 15c, long-distance
trade to 15f, festivals and holy days to 15g.

**15.5l. Men and women.** *Now:* the engine has no sex at all — any two grown-ups who are not kin may
pair and have children. *History:* almost every people divided work by sex (Murdock and Provost's
cross-cultural codes, 1973); where the plough was used men did the field work and women worked more
at home, and peoples whose forebears ploughed still hold more unequal views of women's place today
(Alesina, Giuliano and Nunn, "On the Origins of Gender Roles: Women and the Plough", *QJE* 2013,
[NBER](https://www.nber.org/papers/w16718.pdf); [HRAF](https://hraf.yale.edu/documents/1096/hypotheses/3469)).
*Needed:* yes, and first among these — 15.5k's mothers dying in childbirth, 15b's marriage and
inheritance and 15.5n's house work all need it. *Proposed:* each person is a man or a woman at birth;
a child needs a mother; who does which work is a people's custom from its stats (15a, already built),
the plough leaning it one way as Boserup and Alesina found, never one rule for every people.
*Questions:* (1) Who does which work: a custom per people from its stats, as proposed? (2) May two men
or two women live as a couple (no children of their own; they may take in orphans, as 14b's orphans
are taken in)?

**15.5m. Children working.** *Now:* a child does nothing until "Grown up at" (default 14) but fetch
water from six (6a). *History:* children did light farm and house work early — minding sheep and
younger children, scaring birds, gleaning — and serious work from about twelve to fourteen (Pittsburgh,
[the medieval child](https://representingchildhood.pitt.edu/medieval_child.htm)); children were a
real part of the labour market, with wages that tracked the economy (Horrell and Humphries, "Children's
work and wages in Britain, 1280–1860", [LSE](https://researchonline.lse.ac.uk/id/eprint/100510));
pauper apprenticeship was allowed from seven, more usually in the teens. Popular sites put herding and
weeding at seven but cite nothing; Hanawalt's *The Ties That Bind* to read before building.
*Proposed:* light tasks from about six or seven (minding the young, herding near home, scaring birds,
gleaning at harvest), more as they grow, full work at "Grown up at"; schooling, where a people has it
(15e), takes hours from this. *Question:* children working, as proposed?

**15.5n. Work in the house.** *Now:* none but fetching water. *History:* making cloth was one of
the largest uses of a household's hours — spinning was about 85% of the work of cloth, and most women
and many girls spun (a historian's blog, [ACOUP](https://acoup.blog/2021/03/19/collections-clothing-how-did-they-make-it-part-iii-spin-me-right-round/));
by one table a pound of yarn took about 500 hours on an early wheel and 200 about 1700, 3 on a water
frame by 1800 (unsourced blog; Humphries and Schneider, "Spinning the industrial revolution",
[Oxford](https://ora.ox.ac.uk/objects/uuid:4f321519-a0b7-4879-a521-139cbca81b25/files/r0v8380664), to
read for real figures). Cooking and minding small children took hours every day; no figure found yet.
*Note:* Ric said no to tracking household goods wearing out (15.5a), so cloth is hours spent, not a
stock to count — unless Ric wants clothes to matter (warmth, 9c's cold). *Questions:* (1) House work
as hours a household must spend each day (cooking, minding children, spinning), so a household short of
hands feels it? (2) Do clothes count for anything (keeping warm in the cold), or only the hours?

**15.5o. Animals that work.** *Now:* none; "packhorse" is a word in a comment, and carts move without
anything pulling them. *History:* a plough team was eight oxen and a carucate the land it could
plough in a season; Domesday counted over 80,000 teams, about 650,000 oxen; horses came into farm work
slowly, first in richer, market-minded places, two horses doing about the work of three oxen; horse
hauling changed carting in the 12th–13th centuries (Langdon, *Horses, Oxen and Technological
Innovation*, [Birmingham thesis](https://etheses.bham.ac.uk/id/eprint/14029);
[Carucate](https://en.wikipedia.org/wiki/Carucate); [Domesday ploughs](https://sites.google.com/site/domesdaymaterials/domesday-book/data-terminology/manors/ploughs);
[Medievalists, horse or ox](https://www.medievalists.net/2023/02/horse-ox-medieval-times/)).
*Proposed:* oxen and horses as animals a household or village owns, bred from the herds (9b), fed on
grazing and hay; a plough team sets how much land a household can work, a horse or ox pulls a cart
(7d), horses carry riders and soldiers (15h later). *Questions:* (1) In, as proposed? (2) Animals as
counted beasts that eat and die, or as part of what a household owns (cheaper)?

**15.5p. Irrigation and big works.** *Now:* none; `PEOPLE-VISION.md` notes "irrigation is not built by
anybody yet"; river flats are spared in dry years (6b). *History:* Wittfogel's claim that big
irrigation made despots is widely rejected; Bali's rice terraces were run for a thousand years by
local water-temple networks, Nepal's small canals by farmers; Hohokam canals were cleaned yearly in
one to eight days by the villages that used them ([Arizona](https://open.uapress.arizona.edu/system/actioncallout/e/a/d/eade843d-73b8-4c98-a577-22e0eee3a4d6/attachment/d43f5c1a16aa22fcdf630239591b30fd.pdf);
[Irrigation management](https://en.wikipedia.org/wiki/Irrigation_management)); irrigation raised
yields round Assyrian canals ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4811293)).
*No figure for how much it raises a yield found yet.* *Proposed:* a ditch from a river is a thing a
village (or a leader) builds with hours, that waters the fields along it so a dry year spares them as
it spares river flats, and needs cleaning each year or silts up. *Question:* in, as proposed?

**15.5q. Climate over centuries.** *Now:* each year's rain differs (6b) and winters vary, but nothing
shifts over decades. *History:* the Little Ice Age cooled the northern hemisphere by under 1 °C on
the whole (more in places, by some accounts 2 °C in northern Europe in the 16th–17th centuries), with
longer winters and cool wet summers, shorter growing seasons and failed harvests (Parker, *Global
Crisis*, [Yale](https://www.degruyterbrill.com/document/doi/10.12987/9780300189193/html);
[PMC review](https://pmc.ncbi.nlm.nih.gov/articles/PMC3198350)); Kelly and Ó Gráda argue the
smoothing of the data made the cycles look tidier than they were ([UCD](https://www.ucd.ie/t4cms/wp10_14.pdf)).
*Proposed:* a slow swing in warmth and rain over decades and centuries, from the seed, under the
year-to-year weather — never a scripted cold age. *Questions:* (1) In, from the seed? (2) A setting
for how big the swings are, off by default so a world is as it was?

**15.5r. Dirt and disease in towns.** *Now:* a town loses one more person in a hundred a year and a
city a little over two, a fixed number (item 8). *History:* the town penalty came from crowding, waste
and foul water; infants in English market towns of 2,000–3,000 died at 209–270 in 1,000 in 1675–1749
against under 100 in remote country; it fell once water, sewers and public health came (from the 1870s
in the US), and some argue it lasted into the 1930s where water and sewers lagged
([*Continuity and Change*, Norway](https://www.cambridge.org/core/journals/continuity-and-change/article/urban-penalty-towns-and-mortality-in-nineteenthcentury-norway/E13CF2DD58DA5CBC98D2397FD32E9066);
[PMC 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7186836); [Haines, NBER](https://www.nber.org/papers/h0134)).
*Proposed:* replace the fixed number with its causes: how crowded a place is, whether its water is
fouled (a well near houses, a river below a town), and later its sewers and clean water as things
built (15d); the sickness (and item 18) spreads more where these are bad. *Question:* in, as
proposed, measured so a default world's towns lose about what they do now?

**Ric's answers on l–r and the three placed in 15 (2026-11-20):**
- *l, who does which work:* "Yes? I mean pregnant women can't farm as well and might not be as strong.
  And there should be some societal stuff too." So bodies differ as well as customs. *Looked up:* women
  averaged about 52% of men's upper-body and 66% of lower-body strength in one study (Miller and
  others 1993, [PubMed](https://pubmed.ncbi.nlm.nih.gov/8477683/)), the gap larger in the upper body
  ([review 2023](https://pubmed.ncbi.nlm.nih.gov/36696264/)); a new mother was meant to lie in for about
  a month, which poorer women could seldom afford ([LEMDO, pregnancy and childbirth](https://lemdo.uvic.ca/emee/childbirth.html));
  women did a little over a third of farm tasks in early modern England
  ([*The Experience of Work in Early Modern England*](https://resolve.cambridge.org/core/books/experience-of-work-in-early-modern-england/agriculture-and-food-production/756B4A05E951DAD3663CEE82452005B5)).
  *No source found* on how late pregnancy cut field work; to look again before building.
  *So:* each person has a strength that differs by sex and person; heavy work (ploughing, quarrying,
  fighting) goes slower for the weaker; late pregnancy and the weeks after a birth cut heavy work, and
  the lying-in lasts as long as the household can spare her; and on top of the bodies, each people's
  customs (15a) say who is expected to do what — which may hold women back from work they could do, or
  not — and those customs move as their people's stats do.
- *l, couples of the same sex:* "Yeah. If society believes it's ok — people have died over that." So
  such couples exist, and how a people treats them is its own custom from its stats (15a): accepted,
  hidden, or punished — and where it is punished, by its law (15c) and its faith (15g), people can be
  harmed or killed for it, as they have been. Never one rule for every people.
- *m, children working:* yes.
- *n, house work as hours:* yes. *Clothes:* "They should maybe matter? If it doesn't cost much for the
  copy or gpu" — one number a person (how warm what they wear is), worn down by use and made good by
  spinning hours, read only in the cold (9c): no drawing and no stock of goods. Kept only if it costs
  next to nothing; measured.
- *o, working animals:* yes, **the cheapest way to run** — counted as what a household or village owns,
  not as animals that walk about, eat and die one by one.
- *p, irrigation:* yes.
- *q, climate over centuries:* yes, and **on by default** (Ric's choice: a default world changes with it).
- *r, town deaths:* "There shouldn't be a town fixed death rate it should all be of actual causes." So
  the fixed rate goes entirely; towns die of crowding, foul water and the sickness, measured.
- *15c, slavery and serfdom:* yes, **with a setting to turn it off**; a ruled faction can keep, free or
  forbid it: yes.
- *15f, long-distance trade:* yes. *15g, festivals and holy days:* yes.
**15.5s. Sleep that follows the way people live** (added 2026-11-20, Ric: "sleep should follow the way
they live. Didn't foragers and even on slept in two 4hr segments. Until there was artificial light it
wasn't like that right?"). *Now* (`sleepTicks` in `people.js`): somebody who goes to bed in the dark
sleeps until dawn, one to ten hours, in one piece; nobody has a light. *History — partly right, and
argued:* Ekirch found over 500 references to a "first sleep" and "second sleep" in pre-industrial
Europe, with a waking hour between, and argues artificial light ended it
([Scientific American](https://www.scientificamerican.com/article/ancient-sleep-in-modern-t);
[National Geographic](https://www.nationalgeographic.com/science/article/polyphasic-biphasic-segmented-sleep));
but three equatorial forager peoples measured with wrist monitors slept in one piece, about 6.4 hours,
falling asleep some three hours after sunset, waking before sunrise, an hour longer in winter, timed by
the night's cooling as much as the dark (Yetish and others, *Current Biology* 2015,
[pdf](https://gurven.anth.ucsb.edu/sites/secure.lsit.ucsb.edu.anth.d7_gurven/files/sitefiles/papers/yetishetal2015.pdf));
farmers in Madagascar did sleep in two pieces, and the Hadza showed a stir after midnight
([PMC 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC4763365)); and a 2023 reading of the English sources
questions how common it was ([PMC 2023](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10404514/)).
Two pieces seem to come with **long nights and no light** — the far north in winter — more than with a
way of life. *Proposed:* a person needs a night's sleep (about six to seven hours, a little more in
winter); they lie down some hours after dark, not at dark, unless tired; where the night is much longer
than the sleep they need, they wake in the middle and are up a while (tending the fire, talking) before a
second sleep — so two sleeps appear on long winter nights without a rule saying so, and vanish where
nights are short or (with 15e/15f) light is had: a fire, candles, lamps, then electric light, each letting
people stay up. *Questions:* (1) As proposed — two sleeps arising from long nights, not set by era?
(2) The waking hour does something (talking, passing news, minding the fire), not just shown?
**Ric (2026-11-20):** "For the sleeps how close to the equator changes the nights which changes the
sleep. So I think it should all be in there." Both yes: two sleeps arise from the length of the night,
which the world already works out from its latitude and the day of the year (the sunrise equation,
TODO "the year is settings"), so near the equator nights stay about twelve hours and sleep stays in one
piece, as Yetish measured, and far north the long winter nights split it, as Ekirch's sources describe —
by the same rule, with nothing set per place or era. The waking hour does something: people talk and
pass news (item 12), tend the fire, see to children.
**Light is a thing** (Ric, 2026-11-21: "Lights should be a thing where is technology?"). Technology is
15e (a technique found, spread, lost) and 15f (workplaces and what they make: power, fuel, wires). Light
is split the same way, so 15.5 needs nothing from 15:
- *In 15.5s, the old lights,* from what the world already has: the hearth's firelight, burning firewood
  (9c), and rushlights and tallow candles from the fat of the herds (9b). Light was dear: by Nordhaus's
  reckoning a thousand lumen-hours (about a hundred hours of one candle's light) cost some 58 hours of
  work gathering wood in the Old Stone Age and about 5.4 hours in 1800 — sixty hours of work bought about
  ten hours of tallow candlelight around 1775 ([Our World in Data, from Nordhaus](https://ourworldindata.org/grapher/hours-of-work-per-1000-lumen-hours?tab=chart);
  [HumanProgress](https://humanprogress.org/trends/lighting-costs-near-nothing-now/);
  [Nordhaus, Cowles paper](https://econpapers.repec.org/RePEc:cwl:cwldpp:1078)). So a household burns light
  only as far as it can spare the fat or the wood, and staying up (spinning by the fire, 15.5n) costs it.
- *In 15e and 15f, the later ones:* oil lamps (olive, then whale), better candles, gas lamps (a gasworks
  and pipes), electric light (a power works and wires) — each a technique a people finds or learns, and
  a thing built and fed, so it stops when what feeds it stops. As light gets cheaper people stay up
  later and the night's waking hour goes, by the rule above. (1900: 0.22 hours of work a thousand
  lumen-hours; 1992: 0.00012.)
**Light changes sleep** (Ric, 2026-11-21: "Shouldn't light mess with sleep?"). Yes, and measured: two
Toba/Qom communities in the Argentine Chaco, of one people and once foragers, one with electricity and
one without — the one with it slept later and less, and its body clock (the evening rise of melatonin)
ran later; the lead author thinks industrial societies show it more strongly
([de la Iglesia and others 2015, PubMed](https://pubmed.ncbi.nlm.nih.gov/26092820/);
[University of Washington](https://www.washington.edu/news/2015/06/19/access-to-electricity-is-linked-to-reduced-sleep);
[melatonin follow-up, PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC5320422)). *So:* light after dark
does two things, by how bright it is — people stay up while they have it (and spend it), and their
sleep moves later and shortens a little, so on long nights the middle waking goes and on short ones
people sleep less. Firelight and a candle do little of this; electric light does most. *To find
before building:* how many minutes, from the full papers.

**Budget:** default for a–s; j faster only.

Research notes (2026-11-20, Ric: "research those and make sure all are needed first and the
logistics of them. Like any questions that would pop up. Not coding questions"). For each part:
what the engine does now (read from the code, not run), what history says, whether it is needed,
and the questions for Ric. Nothing here is agreed. Sources were read as search summaries.

**a. The store.** *Now:* a crafter sells everything over one good to the store
(`people.js` "make"); a household buys one good when it holds under 0.15 and never uses it up;
goods leave the store only for houses, gear and carts. So goods are made every day and almost
nothing spends them, and the price sits at its floor while crafters keep working. *History:*
peasants owned far fewer household goods than in later centuries and put their spare into
livestock and the farm (Briggs, manorial court-roll inventories c.1270–1420,
[medievalists.net](https://www.medievalists.net/2011/02/manorial-court-roll-inventories-as-evidence-for-english-peasant-consumption-and-living-standards-c-1270-c-1420/);
Briggs, Forward and Jervis, [open monograph](https://library.oapen.org/bitstream/handle/20.500.12657/89841/1/the-material-culture-of-english-rural-households.pdf));
much craft work was made to order rather than for stock (books, swords: [Smarthistory](https://smarthistory.org/making-books-for-profit-in-medieval-times),
[Albion, cutlers](https://albion-swords.com/articles/cutlers-and-guilds.htm)); a thin source.
*Needed:* yes, and first: 15f's workplaces sell into this. *Likely shape:* goods a household
really uses that wear out (clothes, pots, tools already wear), and crafters working when there is
a want, not into a full store.
*Questions:* (1) Should a household need goods the way it needs food and water (clothes and pots
wearing out), or is "goods" only for houses, gear and carts? (2) Should crafters make to order
(somebody asks, they make it) or for the store, stopping when it is full? (3) When nobody wants
what crafters make, what do they do: farm, move, go hungry?

**b. Feeding towns.** *Now:* market day carries spare food up to 10 km to a town going short;
boats carry goods only between two landings on the same water. A city of half the people starves:
the land round it has about a quarter of what it needs to spare. *History:* a pre-industrial town
seldom held more than a tenth to a fifth of a people (item 8's notes), so a city of half the
people is a start the past did not have. Small towns drew on 8–12.5 km round (Dyer); Wiltshire
manors sold grain within about 17 km ([Galloway and others, summarised](https://sas-space.sas.ac.uk/39/1/britnell.pdf));
carting about doubled the price of bulk goods within 50–70 km ([MPRA 10924](https://mpra.ub.uni-muenchen.de/10924/1/MPRA_paper_10924.pdf));
in England carting cost about twice river carriage (Masschaele, *EcHR* 1993), and Diocletian's
edict made shipping grain across the Mediterranean cheaper than carting it 75 miles
([Laudan](https://www.rachellaudan.com/2014/07/roman-empire-food-miles.html)). Big cities lived
on grain by water. *Needed:* partly. A town of the size history had being fed is needed; a city
of half the people starving may be the right answer. *Likely shape:* grain carried by boat in
bulk along rivers and coasts (7d's boats, made to carry grain), and nothing else changed.
*Questions:* (1) Is a city of half the people starving a bug, or the truth to keep? (2) Should
boats carry grain in bulk to a town by water, so only cities on water can grow big, as in
history? (3) Should the start choice say a city may not be fed?

**c. Land from 2 km².** *Now:* 5 km across at least (25 km²), because the default eight villages
do not fit below that (`people.js` "How much land"); a square is 250 m. 2 km² is about 1.4 km
across: six squares by six. *History:* a holding was about 12 ha (item 7's notes), so 2 km²
(200 ha) is fifteen to twenty holdings: one hamlet or small village, a few dozen to about a
hundred people. Figures for people per km² in 1300 disagree by four times between sources
([summary blog](https://dailymedieval.blogspot.com/2019/04/population-density.html);
[Warwick paper](https://warwick.ac.uk/fac/soc/economics/seminars/seminars/conferences/venice3/programme/english_medieval_population.pdf)).
*Needed:* Ric asked for it. It is a different kind of world: one village, close up.
*Questions:* (1) What is a 2 km² world for: one village watched house by house? (2) Then how many
people, villages and factions: one village and no wars, or several hamlets? (3) Should the land
itself be finer at that size (a square of 50 m, more detail stored), or the same 250 m squares
drawn finer, which item 4a chose for zooming in? (4) What happens at the edge: is the rest of the
world just not there (nobody comes or goes), or are there people beyond it?

**d. Land that changes.** *Now:* a forest square holds sixty loads and grows twenty back a year,
so a forest is never cleared for good; fields are farmed on whatever ground is farmable and never
tire. *History:* English demesne wheat gave about three to six times the seed (Campbell's yields
database, [BAHS](https://www.bahs.org.uk/crop-yields-database/); Ebony, 2.9 times:
[BAHS](https://www.bahs.org.uk/AGHR/ARTICLES/33n1a2.pdf)); a third of the land lay fallow under
three fields, half under two ([Britannica](https://www.britannica.com/topic/three-field-system));
marling and manure raised yields. Wheat on Rothamsted's Broadbalk with no manure since 1843 is
low but has not fallen to nothing: worn soil settles at a floor, it does not die
([Rothamsted](https://www.rothamsted.ac.uk/news/maintaining-wheat-yields-possible-over-many-years)).
English fields left alone were scrub in about 25 years and near woodland in about 50
([Cambridge, passive rewilding](https://www.repository.cam.ac.uk/handle/1810/323983)).
*Needed:* for long runs, yes. Over a year or two it changes little. *Likely shape:* each square
remembers how hard it was farmed; yields fall toward a floor and come back with fallow or manure;
farmers clear forest for new fields (assarting) and a field left alone goes back to scrub, then
forest, over decades.
*Questions:* (1) Should people clear forest to make new fields, so the map changes? (2) Fallow:
should farmers rest land by their own choice (and is that a people's custom, 15a), or always?
(3) Should herds manure fields, so herding and farming help each other? (4) Is it worth it before
eras, given most runs are short?
**Shifting cultivation is in 15.5d too** (Ric, 2026-11-20): with soil that wears and forest that
grows back, farmers may clear forest for a field, crop it a few years and leave it to regrow (20 to 40
years in old Europe), and a village with no forest left near may move. As people crowd, the rest
grows shorter and the work for each meal longer, until fields are cropped every year (Boserup) —
coming out of the run, not set. *To find before building:* how often such villages moved. Research
in 15i's notes.

**e. Wounds and old age.** *Now:* a wound lowers a person's health, which comes back at a fixed
rate (if they have water) and always comes back in full. Old age only makes sickness and cold more
likely; everybody works as hard until the day they die, at an age drawn at birth. *History:* 32%
of medieval Cambridge skeletons had broken bones, 44% of ordinary working people, nearly all well
healed ([Dittmar and others, via Cambridge](https://www.cam.ac.uk/node/221581)); some badly hurt
people were cared for for years ([Lund knee](https://www.discovermagazine.com/medieval-skeleton-reveals-what-life-was-like-with-a-disability-in-the-middle-47582)).
Old peasants handed their holding to a child in exchange for keep — a room, food, fuel — under
agreements the manor court enforced, and the land went back if the child failed them
([Encyclopedia.com, widows and the elderly](https://encyclopedia.com/history/news-wires-white-papers-and-books/widows-and-elderly);
[ORB, retirement](https://www.the-orb.arlima.net/encyclop/culture/towns/florilegium/lifecycle/lcret02.html)).
*Needed:* yes, and it ties to 15b's inheritance. *Questions:* (1) Should a bad wound leave lasting
harm (slower, cannot fight, cannot do heavy work)? (2) Should the old slow down over years, so
there is a time when a person can no longer farm? (3) Should the old hand the farm to a child for
their keep, as in history (and should that wait for 15b's inheritance)? (4) Who looks after
somebody who cannot work: their family, at a cost in the family's hours?

**f. A household's firewood.** *Now:* the village store burns wood for everybody in the cold.
*History:* the right to take wood for the fire (firebote, one of the estovers) belonged to a
holding, from the lord's or the common wood ([Estovers](https://en.wikipedia.org/wiki/Estovers));
town households bought it. Rural households burned most of the firewood there was, and how much
is badly recorded (Warde 2019, [Cambridge repository](https://www.repository.cam.ac.uk/handle/1810/292463));
the only per-family figure found (6–12 cords a year) is from a game book and is not used.
*Needed:* least of all. It makes firewood work like food and water, and a cold household
different from its neighbour, but little else. *Questions:* (1) Keep it, or drop it? (2) If kept:
does a household fetch its own wood like water, and may it cut only where the land rule (7c)
lets it?

**g. News of a good harvest.** *Now:* traders already see every price within reach (Ric's
choice in 12b); "Food is dear in V" and dry years add a pull. *History:* whether medieval grain
markets were one market or many is argued: Gras saw about fifteen separate market areas, Clark
an efficient market from the thirteenth century ([Galloway](https://sas-space.sas.ac.uk/42/1/galloway.pdf)).
*Needed:* small. Since traders see prices anyway, plenty elsewhere already pulls them; this adds
the hungry and families acting on it. *Questions:* (1) Who should act on news of plenty: traders,
the hungry moving there, families sending to buy? (2) Is it worth an item, or fold it into 15h's
supply or 15f's trade?

**h. Wartime gear and a marriage button.** *History:* the English crown bought arms in bulk by
orders spread over many places so no one place ran short — about 1.23 million arrows 1341–59, and
20,000 bows and 900,000 arrows given out 1344–51 — through royal fletchers and outside suppliers
([Richardson thesis](https://etheses.whiterose.ac.uk/3919/1/Thom_Richardson_thesis_final.pdf);
[De Re Militari, the Tower](https://deremilitari.org/?p=2105)). So wartime gear was paid for by the
ruler and made by ordinary crafters answering orders. *Needed:* the gear, yes, before 15h (an
army that carries its supplies needs them made). The button is small. *Questions:* (1) Does the
leader pay for gear from the treasury (raising tax), or order it unpaid? (2) Marriage button: may
the other side refuse, by the same reckoning 14d uses? Who can be offered: only the leader's
family, or you choose?

**i. Weak spots.** No research: they are to be measured after 15. *Question:* which of them matter
most to you, so they are looked at first?

**j. Speed.** *Question:* should 20,000 people at 16× (the speed Ric chose in item 3) be a floor no
later item may go under? On the machine items 13–14 were measured on, 20,000 ran at about 16–19×,
right at it.

**Summary.** Needed before 15f: a (the store). Needed, with a question on what the truth is: b.
Needed, Ric's own asks: c, e. Needed for long runs: d. Small: g, the button in h. Least needed: f
(could be dropped or folded into a). The gear in h belongs before 15h. i and j are checks.

**Ric's answers (2026-11-20).** These replace the "likely shape" lines above where they differ.
- **a.** Households using goods up: **no** — "adding that will have little return for how much that
  cost to track". Crafters make to order: **yes**. When nobody wants what they make: "What do people
  do in real life?" → researched below.
- **b.** A city of half the people starving: "People starving blame the government or die. And
  governments generally don't want people dying so they would try to make it work? No? A lot of
  people move or try something if they have the skills. This needs researched (make sure this isn't
  already in)" → researched below. Boats carrying grain in bulk: **yes** — "Boats should be pretty
  important for travel because it makes it easy but then the question goes of which way the rivers
  travel" → researched below.
- **c.** A 2 km² world is one village watched house by house: yes. How many people and groups:
  whatever happens — "If a group of 50 people decide to break off they should. Inventions are so
  much less likely and so on" (no special rules for a small world; 15e's finding rate already
  falls with fewer people). Land **stored finer if the computer allows** (as people have no top:
  advice, not a block). The world beyond the edge: **an option** (closed, or people coming and going).
- **d.** People clear forest for fields: yes. Resting land: **the people's choice** (a custom, 15a).
  Herds manure fields: yes.
- **e.** Lasting harm from a bad wound: yes. The old slowing down: yes. Handing the farm to a child:
  **in 15b**, with inheritance. Who looks after somebody who cannot work: "Family or even maybe they
  find a way to make a new job" (15f's workplaces give the second).
- **f.** Firewood: **keep** — "firewood was important till the modern age no?" Yes: rural households
  burned most of Europe's firewood, and its use did not fall in many countries until after the
  Second World War (Warde 2019, above).
- **g.** Where news of plenty goes: "Not sure which is best. Do research" → below.
- **h.** Wartime gear "must be payed for or donated. Nothings free": the leader pays from the
  treasury, or people give it. The marriage button: "The marriage button is for me so I should have
  ultimate power" — read as: Ric picks anybody on either side and the match is made, no refusal.
- **i.** Which weak spots first: "Idk" → measure all after 15, those people see most (rivers and
  boats, houses, news) first.
- **j.** No floor: "it can go under in massive runs like 20,000 people".

Research after Ric's answers (2026-11-20):

**What craftsmen did when their trade was slack (a, Q3).** Mixed livings were the rule, not the
exception: one trade often did not feed a family, so people combined them — blacksmith and trader,
tailor and night-watchman — and many took day labour or went on the road for work part of the year;
harvest needed extra hands everywhere ([Habsburg history, "Weaver in winter, bricklayer in
summer"](https://www.habsburger.net/en/chapter/weaver-winter-bricklayer-summer); by-employment,
[EHS working paper](https://ideas.repec.org/p/ehs/wpaper/10001.html); England's men in farming fell
from about 65% to 43–51% by the early 1700s as work specialised,
[*The Experience of Work in Early Modern England*](https://www.cambridge.org/core/books/experience-of-work-in-early-modern-england/introduction/48EE0BECF2672EE15CE26DA6B282EFD3)).
*In the engine already:* `choose` weighs every living for everybody, so a crafter with no work
farms, fishes, cuts wood or moves without a new rule. *What to build:* crafting pays only for what
was asked for, so with no orders the bench stops paying and the rest follows by itself.

**A town going hungry: what is already in, and what is not (b, Q4).** *Already in* (read from
`people.js`): hunger lowers mood and mood lowers loyalty to the leader; enough disloyalty
overthrows a chief or the rich (`revolution`) or breaks a village away (the "breaks away" setting);
a leader who believes in sharing, or has a full treasury, turns on relief — the treasury buys
bread from the village store for those who cannot pay; the hungry move house to where there is
food, ask neighbours, and act on news of famine. *Not in:* a government getting grain from
**elsewhere**. Relief only buys from the store of the hungry place itself, so when that is empty
it does nothing. *History:* Florence rebuilt Orsanmichele about 1290 as a public grain market with
storage halls above, and rationed in famine ([Nanni 2019](https://flore.unifi.it/retrieve/e398c37f-4b86-179a-e053-3705fe0a4cff/Nanni%202019_Facing%20the%20Crisis%20in%20Medieval%20Florence.pdf));
Tuscan communes' legitimacy rode on feeding the city ([*Speculum*, Feeding the Medieval Italian
City-State](https://www.journals.uchicago.edu/doi/10.1086/693379)); a permanent public granary was
the exception, most were set up in a crisis or a war ([Horrea](https://francoangeli.it/riviste/articolo/45695));
Venice and Genoa bought their grain abroad; Valencia subsidised grain brought in. England's Books of
Orders (1587, reissued in every dearth until the 1640s) had juries count every holder's grain and
justices force it to open market at fair prices ([Slack, "Books of Orders"](https://core-prod.cambridgecore.org/core/journals/transactions-of-the-royal-historical-society/article/books-of-orders-the-making-of-english-social-policy-15771631/77CAFBCE3647464DE4F0BD606B14B0CD);
[Nielsen, *JEH*](https://www.cambridge.org/core/journals/journal-of-economic-history/article/storage-and-english-government-intervention-in-early-modern-grain-markets/50C3503F73A5B77135688A8426954580)).
*So the missing piece is the government's own grain trade:* a leader whose people are going hungry
spends the treasury buying grain from other villages and other factions (by cart or boat) into a
store, and may force hoarders to sell or ration — each by the leader's stats (15a: a warm leader
buys, a greedy one keeps the treasury, a hard one takes from hoarders by force). Nothing here makes
a city that cannot be fed live: if there is no grain to buy in reach, it still starves, blames the
leader, or empties.
*Question for later:* food riots — the hungry seizing grain from stores and carts — were the other
side of this. In, as an act of the angry (item 10's hot-tempered), or not?

**Which way rivers run (b, Q5).** *In the engine:* when the land is made, every square gets one
downhill neighbour and water is added up along it (`people.js`, the water step), but that direction
is not kept once the land is made, and a boat goes as fast either way. *History:* downstream a boat
drifts with the current, often under sail; upstream it was towed by people or horses from the bank,
much slower, and only where the bank was clear the whole way
([Viabundus, river transport](https://www.landesgeschichte.uni-goettingen.de/roads/viabundus/?p=939));
on the Tiber a towed barge made about 15–20 km a day upstream, by a trial with a replica
([Ostia](https://ostia-antica.org/introduction/rome-transport-tiber.htm)); later canal practice is
roughly 25–30 km a day down, 8–16 up (a blog, not a source to use). Carting cost about twice river
carriage in medieval England (Masschaele), and much more against the sea. *What to build:* keep
each river square's downhill direction (one number a square, already worked out), make a boat
faster with the current and towed slowly against it, and let grain and goods go by boat where
that is cheaper. So towns downstream of good farmland are fed more easily than towns upstream of
it — which is how river cities grew, without a rule saying so.

**Where news of plenty belongs (g, Q18).** Merchants learned prices by letters: Datini's archive
holds over 100,000, and his factors at Caffa left for Tuscany on news that grain had risen there;
how fast prices evened out between markets followed how fast news went between them
([MAIASP 2022](https://en.maiask.ru/data/documents/14_EvstiuninENG.htm);
[*EREH* 2017](https://econpapers.repec.org/RePEc:oup:ereveh:v:21:y:2017:i:4:p:414-433.);
[AHA 2020](https://aha.confex.com/aha/2020/webprogram/Paper28964.html)). So news of plenty has two
halves: heard by word of mouth, which is 12b's machinery and costs nearly nothing to add, and
carried by letter, which needs writing (15e) and travels at the speed of what is built (15d).
*Recommendation:* keep g in 15.5 as the word-of-mouth half (a good harvest becomes news like a
famine, and traders, the hungry and families act on it as on 12b's news), and let 15e's letters
and 15d's roads make it faster later. No separate item.

**Ric (2026-11-20):** the marriage button as read above, **yes** (he picks anybody on either side;
no refusal). Food riots: "Do research on people is it really just a hot tempered thing?"

**Food riots: who riots, and why (b).** Not a matter of temper. What the research finds:
- *Unfairness, not hunger alone.* Riots came when food seemed held back or sent away unfairly —
  grain hoarded, carted out of a hungry district, sold above what was thought a fair price. There
  were hard years with no riots and riots in years prices were steady (Thompson, "The Moral Economy
  of the English Crowd", 1971, [text](https://libcom.org/article/moral-economy-english-crowd-eighteenth-century-e-p-thompson);
  [Encyclopedia.com, Food riots](https://www.encyclopedia.com/food/encyclopedias-almanacs-transcripts-and-maps/food-riots)).
- *Mostly orderly.* The usual riot seized grain and sold it at the "fair" price, or stopped a cart
  leaving; killing was rare (Thompson; [Moral economy](https://en.wikipedia.org/wiki/Moral_economy)).
- *A community act.* Whether hardship turned into a riot depended on how close-knit the people
  were — neighbours who knew each other, a trade in common (Bohstedt, *Riots and Community Politics
  in England and Wales*; *The Politics of Provisions*,
  [summary](https://www.ids.ac.uk/wp-content/uploads/2018/11/Ep-02_Food-Riots-Food-Rights-and-the-Politics-of-Provisions_Transcript.pdf)).
  Miners, weavers and labourers who bought their bread, more than farmers who grew it; rural workers
  too ([*Historical Journal* 2021](https://www.cambridge.org/core/services/aop-cambridge-core/content/view/59BAAD776E6130924B6D37D87E81ADFA/S0018246X21000029a.pdf/rural_workers_and_the_role_of_the_rural_in_eighteenthcentury_english_food_rioting.pdf)).
- *Women prominent*, from the sixteenth century on, as the ones who bought the household's food
  (Thompson, *Customs in Common*).
- *Early, not late.* In Ireland's famine riots ran into the hundreds in 1846–47 and faded as hope
  and anger gave way to despair at the worst ([EH.net](https://eh.net/encyclopedia/irelands-great-famine/);
  [RTÉ on Ó Gráda](https://www.rte.ie/history/famine-ireland/2020/0921/1166563-hunger-will-break-through-a-wall-food-riots-)).
- *The answer from above* — relief or soldiers — decided what came next (Bohstedt). Today: worse
  poverty and less food a head make riots likelier (Berazneva and Lee), but price alone does not
  say where (Heslin, *Journal of Peace Research* 2021, [via vLex](https://vlex.co.uk/vid/riots-and-resources-how-875453579)).

*How it would fit the engine:* a riot is something a village's hungry do together, never a timer.
It is likelier where people go short while they can see food that is not theirs (a store, a
hoarder's larder, a cart leaving), where they know each other well (item 11's friends), and among
those who buy their food rather than grow it; temper (item 10) makes it rougher, patience and
fear of the soldiers hold it back, and it fades when the hungry are too weak. Most riots take the
grain and sell or share it at a fair price; a hot-tempered crowd may burn or hurt. The leader
answers by their stats — relief, buying grain in, or soldiers — and that moves loyalty, which the
engine already turns into an overthrow or a breakaway.
**Ric (2026-11-20): "Yes they should"** — food riots are in 15.5b, as above.
**Bandits are in 15.5b too** (Ric, 2026-11-20, from 15i's research): the hungry, the landless and the
dishonest (item 10's honest trait) may choose to take for a living — from carts on the roads (7d) and
from weakly held villages, as 14e's raiding bands do — weighed in `choose` like any living, rising by
itself in hard times (Hobsbawm: impoverishment, crisis, war, conquest). Nothing starts a band;
nobody is placed as a bandit. Those robbed hold it against them, as any theft (10, 12). Research in
15i's notes.

**Order of 15.5 after the answers** (with l–r added 2026-11-20): a (made to order) → h (gear paid
for; the button) → b (the government's grain trade; food riots; bandits; rivers with a direction;
grain by boat) → r (dirt and disease in towns) → e (lasting wounds; the old slowing) → l (men and
women) → k (children and mothers dying; the gap between births) → m (children working) → n (work in
the house) → d (clearing, wear, fallow by choice, manure, shifting cultivation) → o (animals that work)
→ p (irrigation) → q (climate over centuries) → s (sleep) → f (household firewood) → g (news of plenty) → c (2 km²,
finer land, the edge as an option) → j, then i after 15. l comes before k because k's mothers need it.

### [ ] 16. Ruins and scavenging

**Now:** a dead village leaves nothing.
**Ric (2026-11-20):** the unit is the **building**, not the village — any building nobody keeps up
decays, and a dead village is one where all of them are (research notes below).
**Do:** a place that dies or is destroyed leaves a ruin holding what was really there, less what
rotted and what others took. Scavenging is a living chosen like any other and lasts only while
ruins do. A world can start already ruined. Ric: "ruins... seems like it needs to be viable for
scavengers as well".
**Research first:** how long food, tools and buildings last untended.
**Ric decides:** nothing up front.
**Done when:** nothing is ever created to be found; a ruin empties as it is searched; a small
band can live on a ruined world for a while and then has to do something else.
**Budget:** default.

Research notes (2026-11-20, Ric: "let's look at 16 now"; read as search summaries; nothing built):

**What the engine does now** (read from `people.js`, not run). "A dead village leaves nothing" is
not quite true. When a village has stood empty for a week and nobody who fled is waiting to come
back, it is marked dead ("V stands empty"), its till goes to the faction's treasury — and
everything else stays in it, unread: its store of food, goods, wood, stone, ore, wool and hides,
its houses (built or burned), its walls, well, boat and bridge, and what the last people to die
there left (`die` puts a dead person's food, goods and gear into their village's store). Nothing
reads a dead village again: no one takes from it, no one moves in, it does not decay, and a new
village (`found`) may be founded on the same ground and gets none of it. Inside a living village
an empty house is taken first by newcomers and burned houses are rebuilt, so the village-sized ruin
is what is missing. So item 16 is mostly **letting people find and use what is already there, and
letting it rot**; little new has to be made.

**How often places died, and why.** England has some 2,000–3,000 known deserted medieval villages
(Beresford and Hurst listed 2,263 in 1968), emptied over 1340–1750: plague, but more often slow
economic change — land turned to sheep, poor soil, a colder climate, a lord clearing tenants
([Deserted medieval village](https://en.wikipedia.org/wiki/Deserted_medieval_village);
[Beresford's Lost Villages, Hull](https://dmv.hull.ac.uk/);
[National Trust](https://www.nationaltrust.org.uk/discover/history/why-were-some-medieval-villages-deserted);
[Herefordshire](https://htt.herefordshire.gov.uk/herefordshires-past/the-medieval-period/villages/deserted-villages)).
Most were never lived in again; their fields became pasture. Wharram Percy's church stayed in use
for six centuries after the village went ([English Heritage](https://english-heritage.org.uk/visit/places/wharram-percy-deserted-medieval-village/history/significance)).

**How long things last untended.**
- *Grain:* kept and watched, traditional stores lose about 2–5% over a season to insects, rodents
  and mould; damp or heat can ruin grain in three months; rodents are the danger in an unwatched
  store, damaging the building too ([FAO](https://www.fao.org/4/t0522e/T0522E09.htm);
  [Post-harvest losses](https://en.wikipedia.org/wiki/Post-harvest_losses_(grains))). No figure for
  an abandoned store was found; *to be chosen and said as a guess:* gone within a year or two.
- *Timber and thatch:* reconstructed houses left unrepaired stood one to four decades — a sunken
  house 13 years with no repairs and fit for more, West Stow's leaning badly at 40, Castell Henllys'
  roundhouses rebuilt at 30–35 ([Mytum and Meek, Liverpool](https://livrepository.liverpool.ac.uk/3077192/);
  [West Stow](https://heritage.suffolk.gov.uk/media/pdfs/2015_west_stow_british_archaeology.pdf);
  [*The Life Cycle of Structures in Experimental Archaeology*](https://www.sidestone.com/openaccess/9789088903656.pdf)).
  The roof goes first, then the frame racks.
- *Stone:* lasts centuries, and was the most taken: medieval builders stripped Roman buildings for
  stone and burned marble for lime; in Italy it was organised, with permits and workshops
  ([Liverani 2025](https://flore.unifi.it/retrieve/329060e9-8f9e-4149-b513-85fe113b9f07/Liverani2025_Use%20and%20misuse%20of%20reuse.pdf);
  [Brewminate, spolia in Rome](https://brewminate.com/architectural-spolia-and-urban-transformation-in-ancient-and-medieval-rome/)).
  Using old stone was not always cheaper than new (Brenk, in the same).
- *Iron and tools:* rust but last years; no figure used.
- *Fields:* scrub in about 25 years, near woodland in about 50 (15.5d's notes) — a ruin's fields go
  back to the wild on the same clock as any field left alone.
- *A modern town:* Pripyat, emptied in two days in 1986, was looted over the years after, and
  trees and vines took it within decades ([Atlas Obscura](https://www.atlasobscura.com/articles/pripyat-before-after);
  [National Geographic](https://www.nationalgeographic.com/culture/article/life-goes-on-chernobyl-35-years-after-worlds-worst-nuclear-accident)).
  So what is portable goes in years; what is built goes in decades; stone stays.

**Who owned what was left.** Medieval law gave ownerless things to the lord or the crown, not the
finder: goods washed up from a wreck with nobody left alive were the king's by privilege (Bracton),
hidden gold and silver with no known owner was treasure trove and the crown's
([Treasure trove](https://en.wikipedia.org/wiki/Treasure_trove);
[Jus naufragii](https://en.wikipedia.org/wiki/Jus_naufragii);
[Bracton](https://amesfoundation.law.harvard.edu/Bracton/Unframed/English/v2/339.htm)) — though
people living by a wreck took what they could and believed it theirs for centuries. So whether a
ruin is free to take is a custom and a law, like the land rule (7c) and 15c's laws.

**How it would fit the engine** (proposed, not agreed). A dead village becomes a ruin: the same
record, still holding what it held, read by nobody until somebody comes. Its store rots by kind —
food fast, wool and hides slower, goods and tools slowly, wood in years, stone never; its houses
lose their roofs and fall over decades; its fields go back to scrub. Scavenging is a living in
`choose`, weighed like cutting wood: the walk, what one knows is there (a ruin is held in the mind
like a market, item 11, and passed on in talk, item 12), and what it is worth against other work.
What is carried away is gone from the ruin, so a ruin empties as it is searched. Builders can take
stone and timber from ruins instead of quarrying and cutting (stone robbing). A household or a band
can move into a ruin and roof its houses again rather than build from nothing. A world that starts
ruined is a world whose places are made as usual and then emptied before the start, so everything
in the ruins was really there.

**Ric (2026-11-20): a ruin is a building, not a village.** "It shouldn't be a dead village it should
be a dead building. Because if a village has 1 person there and 15 buildings the other buildings
would start breaking down the same way no? And the buildings are something that needs to be
thought of too. How do they change in look? Also what type of buildings are needed?" So the unit
is the building: any building nobody keeps up decays, whether its village is dead, nearly empty,
or full and too poor to mend it. A dead village is just a place where every building is in that
state. The notes above still hold for what a ruin holds and who takes it.

**What buildings there are now** (read from `people.js` and `index.html`). *Houses* are real: a
place, a size by wealth, built or a building site, burned (TODO 14b), and drawn from above as their
roof — thatch in the faction's colour with a ridge; a site as its timber frame, roofed by quarters;
a burned house as a charred floor and wall stumps. Houses never wear: an unburned house stands as
new for ever. *Wells, bridges and boats* are one point each per village, built once, never worn.
*Walls* are a number from 0 to 1 per village, and are the one thing that already decays: about four
years of peace takes them down. The *store*, the *workshop* (the bench) and the *market* are not
buildings at all: the store is a pool of goods at the village's middle, and making goods happens
at home.

**How buildings decay, and what keeps them up.**
- *Roofs go first.* Thatch needs its ridge redone about every 12–15 years and the whole coat every
  15–30 years for long straw, 25–35 for combed wheat reed, 30–60 for water reed; birds and fungus
  eat it faster in shade (modern UK guidance: [Historic England](https://historicengland.org.uk/advice/technical-advice/buildings/thatching-advice/);
  [Thatch Advice Centre](https://www.thatchadvicecentre.co.uk/thatch-information/care-thatch/longevity);
  [Thatch](https://en.wikipedia.org/wiki/Thatch)). With the roof gone, rain reaches the walls:
  clay and wattle walls wash down, timber rots from the bottom, and the frame racks and falls
  (the unrepaired reconstructions above, 13 to 40 years).
- *Kept up, a peasant house could last centuries.* The old view that peasant houses lasted a
  generation came from excavated poor houses; Dyer and others showed many were well built, and the
  oldest dated peasant house still lived in was framed from timber felled in 1262. The poor's
  cottages of wattle, daub and thatch were the ones that did not last
  ([Peasant homes in medieval England](https://en.wikipedia.org/wiki/Peasant_homes_in_medieval_England);
  [Dyer, furnishings](https://www.medievalists.net/2011/03/furnishings-of-medieval-english-peasant-houses-investment-consumption-and-life-style/);
  [Wrathmell, hypotheses](https://www.medievalists.net/2011/06/some-general-hypoteses-on-english-medieval-peasant-house-construction-from-the-7th-to-the-17th-centuries/)).
  So how long a house stands depends on what it is made of and whether anyone mends it.
- *What is left in the end.* A deserted village is now grass over earthworks: house platforms,
  the banks of crofts, sunken lanes ("hollow ways"), with stone footings where houses were of stone
  ([Wharram Percy, description](https://www.english-heritage.org.uk/visit/places/wharram-percy-deserted-medieval-village/history/description);
  [Gainsthorpe](https://www.english-heritage.org.uk/visit/places/gainsthorpe-medieval-village/history/)).

**How a building could change in look** (proposed; the page already has three of these looks).
From above, as houses are drawn now:
1. *Kept* — as now.
2. *Worn* — the thatch greyer and patched, the ridge sagging; a house whose upkeep is behind.
3. *Roof holed* — part of the roof gone and the frame showing through (the building-site look,
   run backwards).
4. *Roofless* — the walls' outline only, green inside.
5. *Fallen* — stumps and rubble, the burned house's look in grey and green, not black.
6. *Earthwork* — a faint platform in the grass, then scrub and trees on 15.5d's clock; a stone
   house keeps its wall lines far longer than a timber one.
A burned house joins at 5. Time in each stage follows the material (item 9: wood or stone).

**Which buildings are needed.** A medieval village commonly had houses with their outbuildings, a
church, the lord's manor house, a mill, a smithy, a bread oven, barns and granaries, an alehouse
and a dovecote; Wharram Percy had about forty peasant houses round a church and two manor houses;
the lord owned the mill and oven and charged for their use
([Herefordshire, structure of a village](https://htt.herefordshire.gov.uk/herefordshires-past/the-medieval-period/villages/the-structure-of-a-village);
[Building History, villages](https://buildinghistory.org/villages.shtml)). The site's rule is that
every setting does something, so the proposal is **a building only where it does something the
sim already does or an item is about to add**, sorted by that:

| Building | What it would do | Now / which item |
|---|---|---|
| House | sleep, keep food and water, a household's wealth shown | in (7) |
| Well, bridge, boat landing, wall | water, crossing, boats, defence | in (6, 7, 14e), as points or a number |
| Store / granary / barn | where the village store is; can burn, be raided, have rats | the store is a pool now |
| Workshop / smithy | where crafters make goods, tools and weapons; ore and wood go in | making is done at home now; 15f |
| Market place | where market day and trade happen | a point now (8) |
| Leader's hall / manor | where the leader lives; a court, offices (15c); the barn for the leader's share (7c) | 15c |
| Shrine / church | where a faith's rites happen | 15g |
| Alehouse | where people meet and news spreads | talk happens anywhere (12) |
| Fort / castle, garrison | holding a place taken (14c), a stronger wall | 14c, 14e |
| Mill, oven | grinding and baking for a fee | nothing in the sim grinds or bakes |
| Dock / harbour | boats carrying goods (7d), grain by boat (15.5b) | 15.5b |
| Factory, power works, tower | modern work and news | 15d, 15f |

Mill and oven do nothing unless grinding and baking are added, which adds tracking for little —
the same trade-off Ric made for household goods in 15.5a.

**Questions for Ric (these replace the list that was here):**
1. *Upkeep as work:* should every building need mending (rethatching, posts, walls), so a household
   too poor or too few to keep its house up sees it wear, and a building nobody mends falls?
   That costs hours in every living village, which the old engine never spent.
2. *Which buildings:* from the table, which should be real buildings? Recommendation: store/barn,
   workshop, market place and dock now (they are already things the sim does), the hall, shrine and
   fort with 15c, 15g and 14's garrisons, factory and tower with 15d/15f; no mill or oven.
3. *The look:* the six stages above, shown on a real seed as screenshots before it is built?
4. *Who may take from a ruin* (still open): anybody, or only the faction that held the land (others are thieves,
   a grievance), or as each faction's own law (15c)?
5. *Moving back in:* a living village already gives a newcomer an empty house first. Should a
   roofless or fallen house be taken and mended the same way (cheaper than building new), and a
   whole ruined village be resettled, or do ruins mostly stay ruins, as most English ones did?
6. *Stone robbing:* should builders take stone and timber from ruins for new houses and walls?
7. *A world that starts ruined:* what emptied it — a war, a plague, a catastrophe (item 17), or
   nothing said? And how many survivors, and where?
8. *Ruins of what era:* item 16 comes before item 15 is built, so a ruin can hold only what today's
   villages hold. Should 16 wait for 15 (so a ruined modern town can hold modern things), or go now
   and grow with 15?
9. *Danger in ruins:* should some ruins be dangerous — sickness where the dead lie, radiation after
   item 17, the dead's kin or a garrison guarding it — or is that item 18's?
10. *How long things last:* fine to use the figures above (grain gone in a year or two untended;
   thatch worn in 15–30 years, a timber house falling one to four decades after its roof goes; stone
   for good), said as guesses where no clean figure was found?

**Ric's answers (2026-11-20):**
- *Walls:* "4 years of peace is that realistic for the walls?" → researched below: no.
- *Every new building gets the broken looks too:* "The new buildings will need the broken stuff put
  in too" — each building in the table has its own six stages, in its own shape.
1. *Upkeep:* "If they are living in it it doesn't need patches if no one lives there or works there
   then I can be rebuilt for a cost." So **a building in use does not wear**; only one nobody lives
   or works in decays, and it can be mended for a cost. No upkeep hours in a living village.
2. *Which buildings:* the table, **and grinding and baking added** ("probably needs to be added") —
   so the mill and oven are in, with what they do (researched below).
3. *Screenshots of the stages first:* "No that's ok."
4. *Who may take from a ruin:* "Anyone. But people may still be protective of the land or view it
   as theirs" — anybody may take; whoever thinks it theirs (the faction whose land it is, the
   family that left it) may hold it against them, a grievance like any other (items 10–12).
   Ric, the same day: **"only if they see them or hear about it"** — the grudge comes only from
   seeing the taking (being within sight, as events are seen in item 12) or being told of it, and
   a wrong telling can blame the wrong person, as any news can.
5. *Moving back in:* "Needs to be fixed if it isn't but cost less then making a new one" — a ruined
   house is mended before it is lived in, for less than building new, by how far gone it is.
6. *Stone robbing:* **no.**
7. *A world that starts ruined:* "If it starts with a person then it's not in ruin. And if it
   starts empty then it is unknown" — buildings with nobody in them, and no cause given.
8. *Timing:* **wait** — item 16 is built after item 15, so ruins can hold every era's things.
9. *Danger in ruins:* **item 18's.**
10. *Figures:* "Yes but look again before a guess" → looked again, below; what is still a guess
   says so.

**Walls in peace — four years was not realistic.** Town walls were neglected in peace — the Crown
sometimes had to push towns into repairs, and murage money was sometimes never spent on the walls —
but they stood: York mended its walls bit by bit for centuries, smaller German towns preferred
constant small repairs to rare overhauls, and most English town walls went only when towns sold
and pulled them down in the eighteenth century
([Murage](https://en.wikipedia.org/wiki/Murage);
[Building History, town walls](https://buildinghistory.org/buildings/townwalls.shtml);
[Towns and Defence in Later Medieval Germany](https://deremilitari.org/?p=1753);
[Worcester city walls](https://en.wikipedia.org/wiki/Worcester_city_walls)). A timber rampart
rotted and was given up in part as its posts decayed
([hillfort summary, Bath Spa](https://researchspace.bathspa.ac.uk/16195/1/16195.pdf)); no figure for
how many years a palisade post lasts in the ground was found. *So:* a wall is a building like the
rest — it does not wear while its village lives in it, and once nobody is there it falls on the
clock of its material, timber far sooner than stone. Walls are not taken down in peace unless
somebody chooses to. **The engine's "gone in about four years of peace" (`people.js`, the siege
step) is wrong by this, and is changed when item 16 is built** — or earlier, if Ric wants it fixed
on its own (it changes how often a walled place holds out in a later war).

**Grinding and baking.** *Without a mill:* grain was ground by hand, about an hour for two pounds of
flour on a simple stone (Laudan, rough); in a modern Indian study a household's hand grinding took
three hours a day and a mill cut it to a third of an hour; families needed "a couple of hours every
day" ([Laudan, "The daily grind"](https://www.rachellaudan.com/2009/11/its-the-shear-bloody-work-of-it-sic-grinding.html);
[ICAR, Indian Farming](https://epubs.icar.org.in/index.php/IndFarm/article/download/172931/66228/527950)).
No rotary-quern figure was found. *With a mill:* lords claimed "suit of mill" — their tenants' grain
ground at the lord's mill, the miller taking a toll in grain, about a sixteenth at Chester — though
grain bought at market could be ground anywhere and many tenants were not bound; the earl of Chester
seized grain sent elsewhere and even bread baked elsewhere
([Mills Archive](https://new.millsarchive.org/from-quern-to-computer-the-history-of-flour-milling/7);
[Chester mills, British History Online](https://archive.british-history.ac.uk/node/48976);
Langdon, [*Mills in the Medieval Economy*](https://academic.oup.com/book/47612)). *Ovens:* in
much of France and the Low Countries all had to bake in the lord's oven for a fee; oven monopolies
outlived mill ones round Lyon and were gone in Flanders by the late middle ages
([Banal rights](https://en.wikipedia.org/wiki/Banal_rights)). *How it would fit:* grain becomes
flour before it is food — by hand at home, costing a household hours every day, or at a mill for a
share of the grain, saving those hours; bread is baked at home or at an oven for a fee. A watermill
needs a stream (item 4's rivers); who owns a mill or oven and whether people must use it is the
land rule and the government's (7c, 15c), so a greedy lord's mill takes more. *Questions for later
(when 16 is built):* who builds the first mill — the leader, the village, or anybody with the
means? Is grinding a household's chore for anybody in it, or by custom (15a)?

**Looked again before guessing (Ric's 10).**
- *Grain:* sealed pits kept wheat "for several years" without insects
  ([Saint-Denis grain pits](https://archeologie.culture.gouv.fr/saint-denis/en/grain-pits)); in a
  barn, medieval farmers seldom kept wheat more than two years, and at Crawley over 170 years of
  accounts old wheat appears nine times, under 2% of the crop (McCloskey and Nash,
  [pdf](https://deirdremccloskey.com/docs/graham/nash.pdf)); a watched store loses 2–5% a season.
  *Still a guess:* how fast an unwatched store goes; chosen as a watched store's loss several times
  over, gone within one to two years, and pit storage, if built, lasting years.
- *Thatch:* 15–30 years for long straw, longer for reed, kept up (above). *Still a guess:* how
  long a roof lasts with nobody mending it.
- *Earth walls once the roof is gone:* rain at the base and the corners is what brings cob down,
  and a wall kept wet fails ([IHBC, dampness in earth walling](https://ihbc.org.uk/guidance_notes/docs/Cob_Paper/page6.html));
  no figure in years was found. *Still a guess.*
- *Timber frames:* unrepaired reconstructions stood 13 to 40 years (above).
- *Stone:* centuries; walls went when people took them down.

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

Research notes (2026-11-20, Ric: "Alright 17"; read as search summaries; nothing built):

**What the engine has now** (read, not run). Nothing can be put into the People world while it
runs except orders to a faction you rule and live settings. Hard times that come by themselves:
dry years (rain by place and year, 6b), cold winters (firewood, 9c), the sickness. The physics
sandbox has a tool row (place, throw, erase, heat, cool, pin); the People page has none. Things
item 17 would lean on: people flee danger at their own village and come home when it has passed
(14b), news is seen within 3 km and told beyond (12), houses can burn and be rebuilt (14b, 7b),
and items still to come — buildings that break in stages (16), land that changes (15.5d), and
radiation sickness (18).

**What each kind does, from the published figures.**
- *Nuclear weapon.* Blast and the distance a given overpressure reaches scale with the cube root
  of the yield: eight times the yield, twice the reach (Glasstone and Dolan, *The Effects of
  Nuclear Weapons*, 1977, [DTRA pdf](https://www.dtra.mil/Portals/125/Documents/NTPR/newDocs/NTREReport/Glasstone%201977%20-%20The%20Effects%20of%20Nuclear%20Weapons.pdf);
  the same rule in the 1957 edition). 5 psi is the classic "most buildings down" ring. Thermal
  burns and fallout have their own chapters (the burn ranges by yield, and a fallout plume carried
  downwind) — *to be read from the book itself before building.* Hiroshima: about 350,000 people
  there that day, about 140,000 dead by the end of 1945; the city's residents fell to about
  137,000 by November 1945, 171,000 in 1946, jobs back to prewar levels by about 1948, and the
  centre was again the densest place by 1950, because people chose to rebuild where it was
  ([Hiroshima Prefecture](https://www.pref.hiroshima.lg.jp/site/peace80-en/reconstruction-atomic-bombing.html);
  [LSE CEP](https://cep.lse.ac.uk/_new/publications/abstract.asp?index=11800)).
- *Asteroid.* The Earth Impact Effects Program (Collins, Melosh and Marcus 2005) takes the
  object's size, density, speed, angle and the ground it hits, and gives entry, crater, fireball
  and heat, thrown-out rock, shaking and the air blast at any distance; near the impact heat does
  most harm, and far off the Earth's curve shields places from it
  ([paper](https://articles.adsabs.harvard.edu/pdf/2005M%26PS...40..817C);
  [the program](https://impact.ese.ic.ac.uk/ImpactEarth/)). Its equations are published: *to be
  read from the paper before building.*
- *Volcano.* Ash: a few millimetres can damage crops, under about 50 mm can even act as a mulch on
  pasture, 100 mm or more (less when wet, twice as heavy) brings down weak, flat or wide roofs, and
  over 300 mm kills or starves livestock ([USGS, roof loading](https://volcanoes.usgs.gov/volcanic_ash/roof_loading.html);
  [USGS, pastures](https://volcanoes.usgs.gov/volcanic_ash/amount_ash_pastures.html);
  [GNS Science](https://www.gns.cri.nz/our-science/natural-hazards-and-risks/volcanoes/ash/)).
  Far off, the cold: Laki (Iceland, 1783) poisoned the grass, killed 60–80% of the island's
  livestock and, by the famine after, a fifth to a quarter of its people
  ([Laki](https://en.wikipedia.org/wiki/Laki)); Tambora (1815) killed about 10,000 at once and tens
  of thousands more by famine and disease nearby, cooled the northern summer about half a degree,
  and 1816 was "the year without a summer" — failed harvests in Britain and Ireland, typhus after
  ([Tambora](https://en.wikipedia.org/wiki/1815_eruption_of_Mount_Tambora);
  [Year Without a Summer](https://en.wikipedia.org/wiki/Year_Without_a_Summer);
  [Oeschger Centre, Bern](https://boris.unibe.ch/81880/7/tambora_e_web.pdf)). So a volcano is two
  things: what falls near it, and colder years everywhere.
- *Fire.* In forest and shrubland a fire runs forward at about a tenth of the wind speed (0.3 to
  10.5 km/h observed), in cured grass about a fifth, and grassfires have run 10–15 km/h
  ([Cruz and Alexander 2019](https://link.springer.com/article/10.1007/s13595-019-0829-8);
  [CSIRO, grassfire rule of thumb](https://research.csiro.au/spark/news)). In a town: the Great Fire
  of London (1666) began in a bakery, was driven by wind through timber houses (by then mostly
  tiled, not thatched — thatch spreading it is a myth), burned 13,200 houses and left about
  70,000 of 80,000 homeless; the recorded dead are a handful and the real count is argued; a gap in
  the houses on London Bridge stopped it crossing the river
  ([London Museum](https://www.londonmuseum.org.uk/collections/london-stories/great-fire-of-london/);
  [Museum of London, myths](https://museumoflondon.org.uk/discover/three-myths-you-believe-about-great-fire-london);
  [Londonist](https://londonist.com/2016/08/is-it-true-that-only-six-people-died-in-the-great-fire)).
  So fire spreads by wind and by what there is to burn, and a gap stops it.
- *Earthquake.* Most deaths are from buildings falling, so what matters is what they are built of:
  mud brick and unbuilt-up stone fall even at moderate shaking (Iran's stock, 80% of it, "succumbs
  even for moderate levels"); the USGS's PAGER estimates deaths from shaking × how many of each
  kind of building × how likely each is to fall × how many inside die
  ([USGS, collapse fragility](https://pubs.usgs.gov/publication/70035719);
  [Jaiswal and Wald 2010](https://webarchive.library.unt.edu/web/20121002070525/http://earthquake.usgs.gov/earthquakes/pager/prodandref/Jaiswal_Wald_2010_Semi.pdf)).
  *Its tables by building kind to be read before building.*
- *Flood.* Crop loss goes with depth, how long the water stands, and when in the growing year it
  comes ([Monteleone 2023](https://cris.unibo.it/retrieve/72f0b22c-b022-42c1-9280-445d3c881340/2023_Monteleone_Estimations%20of%20Crop%20Losses_WATER.pdf);
  [2026 preprint](https://egusphere.copernicus.org/preprints/2026/egusphere-2026-6703/)). *No figure
  for pre-modern flood deaths was found; to look again before building.* The land already knows
  where water goes (rivers downhill, lakes, river flats: 4a, 6b), so a flood can follow the
  ground rather than a circle.
- *Drought.* Already in as dry years (6b). A placed drought is the same thing made worse for a
  place and a number of years.

**How it would fit the engine** (proposed, not agreed). One record for every kind: where, how
big, when, and what it does at each distance — to people (killed or hurt, by what they stand in or
under), to buildings (a stage of item 16's damage, by material), to the land (ash, burned, flooded,
poisoned, a crater; recovering on 15.5d's clock), to stores and fields, to water, and to the sky
(colder or darker years for the whole map, for so long). Fire and flood also *spread* — fire by
wind and fuel (forest, timber, thatch), flood downhill along the ground the land already has — and
stop at gaps; the others are rings. Everything after is the engine's own: the dead are missing from
their households, the hurt heal or do not (15.5e), people who see it or hear of it flee and come
back or do not (14b, 12), fields go unharvested, a leader sends relief or does not (15.5b), a
faith may form round it (15g). Nothing is written to happen afterwards. With nothing placed,
nothing is looked at.

**Questions for Ric:**
1. *By themselves:* should catastrophes also happen on their own (a setting: off, rare, as often as
   real ones), or only when you drop them?
2. *How you drop one:* a tool on the People page — pick a kind, a size, tap the map? And named
   sizes to pick from (a Hiroshima-sized bomb, a Tambora-sized eruption), or only numbers?
3. *How real:* the published equations (cube-root blast, the impact program, ash thresholds, fire
   at a share of the wind), or simpler rings?
4. *Fire started by people:* the Great Fire began in a bakery. Should ovens and hearths sometimes
   start fires by themselves (more in dry, windy weather, in timber towns), and people fight them
   and make firebreaks? Or are fires only dropped?
5. *Warning:* should some come with signs people can read — a river rising, a mountain rumbling —
   so some flee in time, or always without warning?
6. *The whole map:* a big eruption or many bombs cool the years after everywhere (1816; nuclear
   winter). In, as a cold that thins every harvest for some years?
7. *Fallout:* item 17 puts it on the land and item 18 makes people sick from it. Fine to split it
   that way?
8. *Order:* buildings breaking is item 16, which waits for 15. Should 17 wait for 16 too, or go
   first with houses only (they can already burn)?

**Ric's answers (2026-11-20):**
1. By themselves: **a setting**, "for sure".
2. Dropping one: **numbers only** — no named sizes.
3. **The published formulas.**
4. Fires started by people: **yes**, "but make sure it's backed by statistics on how often and how
   it spreads" → researched below. And: "Firefighters can be a job if it matches with the cities
   needs. Or towns. That's the thing about the jobs they have to match what the city needs."
5. Warning signs: **yes**, "if there is one and it's likely people would leave" → below.
6. Colder years over the whole map: **yes**, "if it's realistic" → below.
7. Fallout on the land here, the sickness in 18: **yes.**
8. **17 comes after 16.**
Also asked: "Is plague apocalypses in there too? Or is that later?" — **later: item 18**, "Catastrophes
in people: plague, radiation, zombies", one mechanism (something carried that spreads and changes
the body and what the person wants); the existing sickness becomes it with its old numbers.

**Fires people start: how often, how they spread, and who fights them (Ric's 4).**
- *How often.* Small fires were common and poorly recorded; big ones were not rare. Several hundred
  large urban fires burned in early modern Europe, more in the seventeenth century, clustered in
  hot dry spells (Garrioch, "Large fires and climatic variability in urban Europe, 1500–1800",
  [*Climate and Culture*](https://www.whpress.co.uk/CCH/952_Garrioch.html); "Towards a fire history
  of European cities", [*Urban History* 2019](https://www.cambridge.org/core/journals/urban-history/article/towards-a-fire-history-of-european-cities-late-middle-ages-to-late-nineteenth-century/DCF986C2797AAFB0A9B6F07DE549E501)).
  England 1500–1750 had over three hundred town fires that destroyed ten houses or more — two or
  three a year across a country of some hundreds of towns ([Tufts, Perseus](https://dl.tufts.edu/teiviewer/parent/rv043431c/chapter/c8s10)).
  London 1833–49 counted 450 to 840 fires a year, most small. *Still to find before building:* a
  rate per household per year for small fires (Garrioch's and Zwierlein's studies are where to
  look). *So:* a fire starts in a household at a small chance a day, raised by dry weather, wind
  and trades that burn (baking, smithing); most stay in one house.
- *How it spreads.* Building to building by radiant heat, hot gas carried on the wind, and
  firebrands landing downwind; it depends strongly on wind speed and direction and on the gap
  between buildings, and changes between gaps of 1–2 m and 2–3 m (Himoto and Tanaka, *Fire Safety
  Journal* 2008, [pdf](https://repository.kulib.kyoto-u.ac.jp/dspace/bitstream/2433/93452/1/j.firesaf.2007.12.008.pdf);
  Usui and Teraki 2018, spread by gap and construction, [J-STAGE](https://www.jstage.jst.go.jp/article/journalcpij/53/3/53_1507/_article/-char/en);
  wind-tunnel firebrands, [*Frontiers* 2020](https://www.frontiersin.org/articles/10.3389/fmech.2020.628510)).
  London's 1666 fire stopped at a gap on London Bridge. *The model to build from:* Himoto and
  Tanaka's three ways of spreading, with each house's material (item 9) and the gap to the next
  (houses already have real positions and sizes, 7a); *their fitted numbers to read before
  building.* Out of town, the share-of-the-wind rule for grass and forest (above).
- *Who fights them.* Rome had paid firefighters (the vigiles, under Augustus) with bucket chains
  and pumps; they were later replaced by guilds. London before 1666 had no organised fire service;
  after it, fire insurers paid their own brigades, and the first fire-engine company is dated 1678;
  Boston passed fire rules in 1631 ([History of firefighting](https://en.wikipedia.org/wiki/History_of_firefighting);
  [Vigiles](https://en.wikipedia.org/wiki/Vigiles)). So most of history fought fire with
  neighbours and buckets, and paid firefighters came where a town was big and rich and had lost to
  fire. *How it fits Ric's rule:* everybody near a fire may run to it with water, weighed in
  `choose` like any task (a neighbour's house, one's own); a firefighter is a job a town takes on
  only when its own losses make it worth paying for — the 15f rule that jobs match what the place
  needs.

**Warnings people would act on (Ric's 5).**
- *Volcano:* there are signs — steam blasts, small quakes, swelling — and acting on them saves
  lives: Pinatubo (1991) showed signs two months ahead, the clearest in its last ten days;
  evacuation 48 hours before the big eruption saved 5,000–20,000 lives, and the visible early
  eruption is what persuaded people to go; the signs alone did not
  ([USGS, Pinatubo](https://www.usgs.gov/news/remembering-mount-pinatubo-25-years-ago-mitigating-crisis);
  [USGS fact sheet](https://pubs.usgs.gov/fs/1997/fs113-97)). *In:* rumbling days to weeks ahead,
  some people leaving by their own boldness and what they hold (items 10–12), more once ash falls.
- *Flood:* a river rises before it floods, and warnings work only when people believe them; more
  warning time is not always better ([EEA, flood warnings](https://www.eea.europa.eu/publications/late-lessons-2/late-lessons-chapters/late-lessons-ii-chapter-15);
  [PMC review](https://pmc.ncbi.nlm.nih.gov/articles/PMC7120419)). *In:* water rising for a day or
  more, seen by those by the river.
- *Earthquake:* some are preceded by foreshocks and many are not, and a foreshock cannot be told
  from an ordinary small quake until after; L'Aquila (2009) had them, read only afterwards
  ([Reasenberg, USGS](https://pubs.usgs.gov/publication/70021771);
  [PMC, central Italy](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10474115/)). *Not in:* no
  usable warning, by Ric's rule.
- *Fire:* smoke is seen as it spreads; people flee or fight. *Bomb, asteroid:* no warning in the
  world (a warning would be something people have, like a radio — 15d).

**Colder years over the whole map — is it realistic? (Ric's 6).**
- *Volcanoes: yes, measured.* Tambora cooled the northern summer about half a degree and 1816's
  harvests failed in Britain and Ireland; Laki's haze brought a hard winter to Europe (above).
- *Bombs: argued.* Robock, Toon and Xia model soot from burning cities cooling the world for years,
  and in *Nature Food* (2022) famine killing more than the war — assuming trade stops and nobody
  adapts; Los Alamos (Reisner and others, 2018, 2019) found far less soot reaching high enough and
  far less cooling, and others have said the Robock group's data and code are hard to check
  ([*ACP* 2023 discussion](https://acp.copernicus.org/articles/23/6691/2023/);
  [*Nature* 2011](https://www.nature.com/articles/475037b);
  [NIDS review](https://www.nids.mod.go.jp/english/publication/security/pdf/2023/01/04.pdf)).
  *So:* volcanic cold is in, from the measured eruptions. Cold after bombs is a real effect of
  unsettled size; proposed: it follows the soot a city's burning puts up (how much burned, from this
  item's own fires), using the published range, with the low end as the default and the setting
  able to take the high end. **Ric (2026-11-20): yes.**

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
| 2026-11-20 | 15a | AMD Ryzen 5 3600, 24 GB | 2.25 s a day, 133× | *not run* | 6.6 MB, 1.29 KB | **each people's ways**: a faction's own nature, events by age and size, a war lost, elected leaders lean to their people; a different world. Against 14e, quick rows alternated new/old/new: 400 0.13/0.13/0.13 s, 2,000 0.68/0.68/0.71 s, 5,000 2.31/2.28/2.25 s — within the drift. Cost: ten adds per grown-up per census (every six hours), one pass over a faction's people per war lost. |
| 2026-11-20 | 15.25 | AMD Ryzen 5 3600, 24 GB | 1.96 s a day, 153× (2.15 before) | 12.3 s a day, 24× (14.8 before) | 6.7 MB, 1.30 KB | **faster, the same world**: passes 1, 2, 4, 5 against 15a, alternated twice, nothing else running: 400 0.13/0.13 → 0.11/0.11 s, 2,000 0.69/0.68 → 0.60/0.60 s, 5,000 2.14/2.16 → 1.94/1.99 s, 20,000 14.83/14.85 → 12.27/15.16 s (the second an outlier; 12.46/12.47 with births), 400 on 500 km 0.16/0.15 → 0.14/0.15 s; a 400-person world 2.5 → 3.3 MB (the search workspace). **Births past 3,000 and the listening fix, measured apart**: 5,000 1.94/1.99 → 2.09/2.04 s (people are born now), 20,000 12.27 → 12.46/12.47 s. Land update for the page, 400 on 500 km: 21 → 11 ms, 12.4 MB → a few KB |
| 2026-11-21 | 15.5a | Intel Xeon (cloud), 4 cores | 2.51 / 2.65 s a day (2.63 / 2.53 before, same machine) | *not run* | 7.0 MB, 1.37 KB | **made to order**, a different world (who takes which trade). `--quick` two runs each; 400 people timed alone for ten days 0.17 → 0.15 s a day; none of the new code in the profile |
| | 2 | Apple M1, 8 GB | *to be measured* | *to be measured — about 7 s, 43×, by the ratio* | | run `node --expose-gc test/bench.mjs` on the Mac and fill this in |
