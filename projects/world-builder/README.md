# World Builder — the People Sandbox

Hundreds of people who farm, trade, talk, pair up and grow old. You set how their world works, run
it, and watch what they make of it.

**This folder was World Builder, one page with two sandboxes, until 2026-11-25**, when Ric asked
for them to be separate projects (*"I need you to separate physics sim and people sim into two
separate projects"*). The physics sandbox, the Lab and the three physics probes moved to
[`projects/physics-sandbox/`](../physics-sandbox/README.md). This one kept the folder — most of the
docs, tests and the work list already pointed here — and is called the **People Sandbox** on the
page. A link to the old `#physics` address is sent on to the Physics Sandbox; `lab.html` here is a
redirect to the Lab.

Ric, 2026-11-12, on what the page was for: *"You choose one. You then can choose options for the
worlds. Like how many people. … How the money works how long the people's lives are. Like tons of
settings. Then you hit run it opens the world."*

It grew out of KONDRITE's living world but it is not it. Ric again: *"this is not going to open
Kondrite. Those were just the already written code that you could look at to get an idea of what I
wanted."* So it is its own code, in this folder, and it imports nothing from KONDRITE.

Linked from Exploration (MODULE 005) and the terminal (`people`, or `worlds` as before). Not on the
front door or in `latest.js` yet; that waits on Ric having looked at it.

## Files

The [People sandbox master vision](PEOPLE-VISION.md) records Ric's 2026-11-12 feedback and the
full direction being refined: individual lives and civilizations, deeper work and relationships,
communication, clarity, selection, following, control and equipment. It separates stated goals
from proposed mechanics; its implementation baseline and next-deliverable proposal distinguish
what has shipped from future direction, including the shared daily clock and remaining long-term balance work.

| File | What it is |
|---|---|
| `index.html` | The page: settings → the running world. Styles and page script inline. |
| `lab.html` | A redirect: the Lab moved to the Physics Sandbox on 2026-11-25. |
| `people.js` | The people sandbox's engine. No DOM; runs the same in node. |
| `people-host.js` | The People engine's keeper (TODO item 3): holds a world, runs its clock and answers the page with only what it draws, so the engine can sit in a worker. No DOM and no timer of its own; the same in a worker, on the page's thread and in node. |
| `PEOPLE-VISION.md` | Living master design for the People sandbox; goals, proposals and open questions. |
| `UI-REVAMP.md` | The People UI taken apart before a rebuild (2026-11-24): what the page shows and lets you click, what a world actually does, every setting measured for how much and how soon it changes a world, and a proposal with Ric's questions. Section 6, what each screen shows first, was agreed (TODO 21a, 2026-11-25), and the page was rebuilt on it the same day (21b to 21g; "The People page, rebuilt" below). |
| `test/watching.test.mjs` | TODO 21: a world watched every way the rebuilt page watches it is the world unwatched; every layer answers; run a day, until the next season and a year stop to the minute; pausing on a pin; taps on a house, a field and the land; the visitor's changes logged; the setup's three layers. About a minute. |
| `TODO.md` | The People simulator's work in order, twenty numbered items (and 2b, done, and 3b: what items 2 and 3 measured and left). "Work on N" means item N of this file, done by its "How to do an item" (2026-11-14). |
| `test/bench.mjs` | Not a check — the People engine's speed, measured the same way every time: `node --expose-gc test/bench.mjs`. Its numbers are one machine's and go in `TODO.md`'s speed log. "visited" is the share of person-steps on which anybody was looked at. |
| `test/walking.test.mjs` | Quick check that the walking short cuts only make the engine faster: the same engine with them off (`create(options, { plainWalking: true })`) must give the identical world — packed villages, deaths, people moved or killed from outside, a crowd placed at once. |
| `test/dozing.test.mjs` | Quick check that passing over people with nothing to do (TODO item 2) only makes the engine faster: against the engine run the long way round, hour by hour, with `{ audit: true }` making the short cuts check themselves — an ordinary country, a packed village, war, a hungry winter, a shared store, real-size bodies, nobody talking, people changed from outside, a fight at night, moving house, time handed over in frames (with and without the page's word that it touched nobody), and a dense small country. |
| `test/keeper.test.mjs` | Quick check on the keeper and on people having no top: a world run through the keeper at any speed, read all the while, is the engine's own world; a frame says what the world says; panels, a tap and orders go through; the quiet try-out reports a speed and leaves nothing running; the slider's sweep is what it was and a typed number goes past it; and the two files come out whole when written out again as a worker's text. |
| `test/time-food.test.mjs` | Quick clock/food checks: identical timelines through frames/hours/batches, daily rations, children/parents, crop stocks, reserves, aging, imminent elections and inheritance. |
| `test/travel.test.mjs` | Quick travel checks: a detour out of a U-shaped crowd without teleporting/overlap, real equal-price market visits, conserved coins and closed borders. |
| `test/equipment.test.mjs` | Quick equipment checks: paid materials, repairs, real harvest/cargo/combat effects, wear, stored/broken items and death salvage. |
| `test/conversations.test.mjs` | Quick receipt checks: observed effects, a conserved grain transfer, stable IDs and a held record surviving history eviction. |
| `test/world-builder.test.mjs` | Seven actual days per People preset (its physics half is the Physics Sandbox's `test/physics.test.mjs` since 2026-11-25); `--generations` opts into the retained long-term experiments. These can be very expensive on the real clock; in the slow lane of `.github/checks.mjs` (`--only world-builder --slow`) and in `simulations.yml`. |
| `test/day.mjs` | The one definition of "a different day": tallies adult person-hours per activity and measures what share of them two runs spend differently. Shared by the two below so a measurement and a check cannot disagree. |
| `test/behaviour.mjs` | Not a check — a measurement. Reports what share of an adult's hours each setting actually moves, against rerolling the seed as the null. Run it before and after changing how people decide. A short probe cannot see a slow mechanism; use `--days`. |
| `test/settings-impact.mjs` | Not a check — a measurement. Every People setting against the default world on every core: how differently adults spend their hours (against a reseed) and how far each outcome moves. A row of 0.00 is a slow setting, not a dead one. Written for `UI-REVAMP.md`. |
| `test/decisions.test.mjs` | Quick decision checks: a day slept, worked and walked in human proportions, and seven settings that must move at least 3–5% of an adult's hours. Guards against the hash check passing while a setting does nothing. |
| `test/traits.test.mjs` | The ten traits (TODO item 10): the first four drawn as before, each slider sets what people are like, each new trait changes a choice, and a raided village ends up quicker to anger, warmer to its own and less patient than the same village not raided. |
| `test/mind.test.mjs` | The mind (TODO item 11): no mind ever holds more than its size, sizes differ a little about 20, what is held reads in plain words, and a grudge from year 1 is acted on in year 3. |

No build step and no dependencies. `python3 -m http.server 8912 --bind 127.0.0.1`, then open
`/projects/world-builder/`.

## The three rules

1. **Every setting does something.** The engine exports a `SCHEMA` — the groups, the settings,
   their ranges, the words shown beside a slider (`say`), and which other setting switches one off
   (`when`). The page builds its controls from that list and the engine reads the same keys, so a
   control cannot exist without an engine behind it. The optional `--generations` experiments
   walk every setting; routine People tests check daily mechanisms
   and bounded presets. A short daily run does not prove an annual mechanism has happened. **To add a setting:** add it to `SCHEMA`, read
   `S.<key>` in the engine, run the test. Nothing in `index.html` changes.
2. **Nothing is scripted.** This is KONDRITE's rule (Ric: *"it needs to be able to happen through
   the collectives of the people. Nothing forced or faked"*). No function starts a war, a famine
   or a breakaway on a timer. A leader weighs grievances that real thefts and killings left; a
   village breaks away only when the people living in it have each stopped being loyal. If
   something you want never happens, change a pressure, not the outcome — and don't tune a number
   until the thing appears on cue.
3. **Talk reports, it never causes.** Every line somebody says is a template over what just
   happened between two people: food that changed hands, news passed on, a mind changed. The test
   checks that any news repeated is in the record. **No AI model speaks for them, and none should
   be wired in** — that would cost money per visitor, need a key, and break the site's
   no-dependencies rule; templates are why hundreds can talk at once for nothing.

## The physics sandbox

Moved to [`projects/physics-sandbox/`](../physics-sandbox/README.md) on 2026-11-25, with its whole
write-up — the engine, breaking apart, emergence, shape and sequence, chemistry, motion and heat,
form, the Lab and the hands.

## The people sandbox (`people.js`)

A map of land that grows food, villages, and a few hundred people who each need to eat. At 1×, one day takes **twenty real minutes**, and 365 days make a year (Ric, 2026-11-12:
"1x should be a 20 minute day" and "the people should move slower"; since 2026-11-14 a day is five minutes — see "A five-minute day and a map with a size" below). The visible clock shows
day, time and year. Pause freezes both activity and calendar; the speed buttons scale both.

### One clock and food measured in days

Reworked 2026-11-12 after Ric asked for food "closer to how food works in real life". The
implementation choices below make daily need and reserves meaningful, but are a simplified
simulation, not medical nutrition or a validated agricultural model.

- One food unit is **one adult-day ration**. Adults consume 1 per day in hourly portions.
  Children's daily need rises linearly from 0.35 at birth to 1 at the adulthood setting. It does
  not depend on lifespan. Newborns do not create starting supplies: they draw on the household.
  Food returned on death is removed from the deceased's pockets to avoid feeding children twice.
  Parents share food while retaining 0.25 ration for themselves; couples
  and village support keep the existing household rules. Food shopping can be retried after two
  simulated hours, rather than the old months-long cooldown.
- A crop tile holds up to **48 rations times its fertility**, replenishing linearly over a
  **60-day** scale at default richness. Harvests still remove actual stock and are bounded by
  carrying capacity. These are stocks of ready food, not seasonal planting/growth stages.
- A person's panel shows daily need and how many days their carried food covers. A village's
  store estimate divides its food by its actual residents' combined daily needs; personal bags,
  future harvests and incoming trade are not part of that store-only estimate. One food-price
  unit now prices one adult-day ration.
- Hungry hours accumulate and affect health; missing a meal does not cause instant death.
  `hunger` still controls deterioration. Age, consumption and recovery update hourly. Spoilage,
  food variety, water and individual health/energy requirements are not modeled yet.
- **The year** (2026-11-14). Until then every day was the same day, so nobody ever had a reason
  to store. Every number in it is a setting or comes from the sky (Ric: *"the variables should
  all be editable"*): **distance from the equator** sets day length from the sunrise equation with
  the almanac's −0.833° (twelve hours on the equator, 15.6 / 8.8 at 45°, 18.7 / 5.9 at 60°), and
  people work in the light; **how cold winter gets** sets growth, which follows a warmth curve
  peaking in mid-July and stops below a frost line, normalised so a year with seasons grows what
  one without does — in one half; **when the world starts**; and **year to year**, which draws
  each year an early or late spring (up to three weeks), a warm or cold year and a good or poor
  yield (±30%) from a hash of the seed and the year, so a seed always gives the same years and
  two seeds give different ones. What happens in a year, all measured on year-long runs:
  - **The harvest.** About two months after the warmest day the grain is ripe and a day's
    reaping brings in up to four times a day's gathering; a late year has a late harvest. Without
    it, nobody's day could bring in more than they ate and a hard-winter world starved to the
    last person by February. With seasons a field holds a season's growth (`FIELD_CAP`), and
    what is still standing when the frost comes is lost. At harvest everybody helps.
  - **Putting by.** A household holds back food for the lean days ahead (`winterAhead`): every
    day that grows less than a year's average, weighted by the shortfall and the cold, plus a
    month for stripped fields to grow back — the hungry gap, without which a world that stored
    for the frozen months still starved in April. A quarter over, for a long winter, for each
    child's real need split between the parents at home (`feeds`). A full larder only stops
    somebody wanting to work once it covers that. People with coins buy ahead.
  - **When it runs short.** With the grain in houses the village store is empty all winter, so
    somebody going hungry goes to a neighbour (`ask`): family first, then friends, then whoever
    has most put by. They buy what that household can spare beyond its own winter, at a price
    that climbs as the seller's store falls; what money cannot buy, kinship or a warm nature may
    give. Orphans are taken in by a grown sibling or whoever has most (`carer`). A whole village
    that runs short moves: the move option judges a place by what its houses hold, and a couple
    goes together. When nobody at home has any, they walk to the next village (within twenty
    tiles, not at war) and buy from a household there — strangers sell, only people who know
    each other give.
  - **Where it stands.** Year-long runs of a 300-person valley, starved out of 300: default mild
    winter 4, 27 and 6 over seeds 11, 108 and 205; hard winter 2 and 4; no winter 0. Seed 108 is
    a valley with villages on thin ground and a poor first year, and it has ranged from 9 to 40
    across small changes — read it as "a bad year on poor land kills one in ten", not as a fixed
    number. Before buying from the next village was added the same seed lost 40 and a hard
    winter up to 63. Grain still does not move by trade (traders read the store, and the store
    is empty in winter); the hungry carry it themselves.
  - **A night lasts until dawn.** A sleep chosen in the dark ends when it gets light (one to ten
    hours); a sleep in daylight is a whole one. While it was always seven hours, somebody who
    woke before a spring dawn at 45° went back to bed until one in the afternoon, and adults
    spent 54% of their hours asleep.
- **How it starts** (2026-11-14). Ric: *"when I change the settings it feels like the people do
  the same thing every time"*. Measured, he was right about the first day: every world began
  with everybody fed, the same food in every house and nothing short, so a setting showed only
  once it bit — on day one most settings moved a day less than changing the seed did (3.5–8%),
  by day thirty a third to nearly half. The starting state is now four settings on the setup
  page, each at a default that makes exactly the world it always did: **food put by** (nothing,
  up to a year — squared, so the low end is days), **crops in the fields**, **how old they are**
  (mostly children to mostly old) and **how settled they are** (how many start in couples and,
  past the middle, how many friends each already has). Over the first two days, against a
  reseed's 3.5%: three months put by moves 47% of an adult's hours (they rest, talk and fit
  tools rather than work), a field ready to reap 15%, mostly children 12%. How settled they are
  shows later, through who they ask and who they follow, not on day one.
- **Sickness is a village fever, not smallpox** (2026-11-14). It lasts seven days and kills about
  3% of fed, rested adults who catch it (`SICK_HAZARD`) — three times that for a child under five,
  for somebody near the end of their life and for anybody hungry, which is how a bad harvest and
  an outbreak become one disaster (`frailty`). A conversation passes it on 15% of the time
  (`CATCH`), and surviving it makes you immune for good. Before that date it killed 22% of
  everybody who caught it, alike, and passed on 35% of the time, so it reached nearly everybody:
  default worlds lost 60–83 of 400 people to it in 240 days and shrank. Measured after, the same
  worlds lose about a dozen and grow. `decisions.test.mjs` gives a whole fed world the fever at
  once and requires a few in a hundred to die. Births were checked at the same time and need no
  change: about 49 a year per thousand people, inside the range of real pre-industrial villages.

`advance(seconds)` advances seconds of playback at 1×. `step(hours)` advances simulated hours by
calling that **same** function. Both run every action: 5 actions per playback second, 250 per
simulated hour, 6,000 per day. `YEAR` is now **8,760 hourly updates**; it is not a number of walking
steps. `days` and exchange timestamps read the completed action clock. Summing frame-sized time
uses compensation so splitting the same elapsed time does not change the world.

Food/aging run hourly; reflection and markets every six hours; village decisions, territorial
updates, faction decisions and population samples daily. Soldiers receive 1 coin per day if their
faction can pay; this matches one ration at the fixed default price, not a guarantee that floating
prices remain affordable. Treasury reserves use a week's wage budget. Fertility probabilities
are expressed per year and scaled to reflection cadence rather than firing the old annual
probability four times daily. Terms, lifespan and political cooldowns retain calendar-year units.

The existing speed controls multiply time handed to the same engine; they never select a cheaper
model or skip consequences. A slow device may run below the requested speed. At 1× a year still
costs 121 hours 40 minutes of playback; even headless generation-scale runs require all those
walking/work steps. Optimization, higher-speed design and persistence remain future work.

### What a person decides to do

Rebuilt 2026-11-13 after Ric: *"what you change doesn't change a lot for the people day to day"*.
He was right, and `test/behaviour.mjs` was written to find out how right. It tallies every adult's
activity every simulated hour, so a run becomes a distribution of person-hours, and compares two
runs by **what share of hours are spent differently** — with *rerolling the seed* as the null,
since a setting you cannot feel more than a reroll is a setting you cannot feel.

**What it found.** Twenty of thirty-one settings moved a day less than half as much as a reroll
did; the median setting moved **0.6%** of an adult's hours, and twelve moved **exactly none**
(`crowd`, `births`, `hunger`, `plague`, `inherit`, `memory`, `rule`, `term`, `rebel`, `war`,
`aggression`, `deadly`). The four-day probe is too short to see the slow ones — elections, war and
plague are not four-day mechanisms — but `hunger`, `rich`, `crowd` and `memory` should move a day
and did not. Three causes, all structural:

1. **A day was five scripts, one per job.** `work` branched on `p.job` and ran a fixed sequence.
   Nothing a setting could change altered the shape of a day, only a number inside one.
2. **Work cost no time and fed everybody.** A day's field work took six *simulated minutes* and
   brought back 3.6 adult-day rations. Adults spent 54% of their hours walking, 0.1% harvesting,
   and were never short of food — so nothing downstream of scarcity could bite.
3. **How much the land grows only changed how fast a field refilled**, never its ceiling or a
   day's yield, so rich and thin ground fed a farmer identically.

**What replaced it.** One place where a person decides, and it is a comparison:

- **Needs.** Besides food: `rest` (rises with the hours awake, faster at real work, cleared by a
  night in a bed), `alone` (hours since anybody spoke to them), `fear` (danger at their own
  village — a siege, enemies at its edge, a raid on it lately — or a blow just taken; a war
  elsewhere is effort, not fear: "Wartime effort", below). `urgency(p)` turns them into 0–1.4 wants and is exported, so the person panel shows
  the same figures the engine decided with.
- **Options.** Sleep, eat, a day in the fields, a day at the bench, a load to carry, standing
  guard, going to find somebody, fitting tools, sitting the day out. Each is scored against what
  the person needs, what the walk and the risk cost, and what they are good at. The best wins,
  with a little noise so neighbours do not move as one.
- **A job is competence, not a script.** It is worth about a third again at the work it names, and
  anybody may do anybody's work when their circumstances call for it. `chooseJob` and the daily
  choice read the *same* figures (`livelihood`), so what somebody is called and how they spend
  their hours cannot drift apart — before this they did: a sixth of a village were called crafters
  while 0.1% of its hours went on making anything.
- **Work costs hours and feeds about one household.** `SPELL` holds the hours: sleep 7, a day at
  the bench 5, a watch 4. A day in the fields brings back 1.8 rations, 2.25 with a tool. **The land
  sets how long that takes, not how much it is** (2026-11-14): five hours on ordinary ground,
  divided by how fast it gives — `rich` across the world, the patch's own fertility locally, so
  `uneven` decides who finishes early — and capped at nine (`FIELD_HOURS`), after which they bring
  back what they managed. Scaling the load instead (the 2026-11-13 version) moved a fed farmer's
  day by 2.7%, because a fixed shift on rich land looks exactly like one on thin land; scaling the
  hours is how farming labour actually differs, and it moves a day 7–9%. Land is the thing there is
  not enough of, which is what gives the settings about land something to bite on.
- **People have houses.** Spread over the village's own ground, shared by a couple and their
  children. Bodies cannot overlap, so when people were first given a reason to all be home at
  night, one point in the middle of a village could not hold them and the village gridlocked;
  the market, the workshops and the fields are places now, not points.

The village store stays a shared pool, so selling into it does not require standing on a
particular tile — fitting tools still does, and the `gear` task still walks to the middle for it.

**Moving house is a choice** (2026-11-14). Before, a person changed village only by accident — two
people of different flags happening to talk, a dice roll on a full village, or hunger. Now
`choose` weighs a `move` option against everything else: how fed and how full somewhere reachable
is against home, against what holds them (a partner, children, the friends they remember living
there, the flag). `switch` is how much a border counts against a place, `crowd` what "full" means,
and `memory` how many ties a person can hold. Somebody who has just moved settles for ninety days
before weighing it again. In a fed, peaceful world almost nobody moves — 1 to 3 people in sixty
days of a default world — and that is correct: these three settings are felt over a season or
under pressure, not on day three. Don't tune the weights until a fed world churns.

**The famine that was a traffic jam** (found 2026-11-14). A default world starved 77 of its 400
people by day 20 and 148 by day 60 — no war, no plague — while its stores held hundreds of
rations at under a coin each and the dead had coins in their pockets. They were stuck: the walk
code counted somebody as stuck only if they got no closer *than the last step*, so a person
sliding to and fro round a neighbour got a hair closer every other tick and was never counted.
One was traced spending seventy hours "Walking" 1.2 tiles from home. The first repair measured stuck
against the closest they had been; after three fresh tries at a spot nearby they did the thing
from where they stood (`act`). The routing update below bounds that nearby-arrival fallback and excludes distant travel tasks.
In the first repair’s measurements, starvation went to zero and walking fell from
about 13% of an adult's hours to 4%, and rerolling the seed now moves 4.9% of a day rather than
13.5% — much of the old "variety between worlds" was which villages happened to jam. **Every
measurement taken before this date includes the jam**, the 2026-11-13 after-numbers above among
them.

**Verification changed with the clock.** The old `step()` experiments allowed only eight actions
per 1/200 year and no longer describe this world. Routine simulations now check seven **actual**
days per preset, money/state invariants and the visible day/spacing contracts. The quick time/food
suite compares the complete same-seed state through batched, hourly and frame calls, isolates a
day's consumption/growth, actual births, and imminent election/death/inheritance boundaries. Original
multi-year setting and century outcome checks are retained behind `--generations`:

```
node projects/world-builder/test/world-builder.test.mjs --generations
```

That is an explicitly expensive experiment, not a CI check that was run for this change. A week
of stability is not evidence of century-scale balance; earlier century measurements are superseded.

42 settings in ten groups: the land, the year (distance from the equator, how cold winter gets,
when the world starts, year to year), how it starts (food put by, crops in the fields, how old
they are, how settled they are), the people, lives (lifespan, childhood, children, hunger,
sickness), money (coins or a shared store, inequality, prices, tax, inheritance), minds (talk,
stubbornness, how divided, memory, changing sides), power (who leads, terms, loyalty, breaking
away), war, and time.

What a person does: farms (walks to a field, brings food home, sells what they do not need),
makes goods, carries goods to wherever they fetch more, or soldiers. They eat, pair up, have
children, remember up to a set number of friends and grudges, and talk to whoever is standing on
the same ground — which is how news, opinions, loyalty and sickness travel.

What adds up from that:

- **Factions** have a leader, a treasury, a tax and an opinion of every other faction. Leaders
  are voted in, inherit, or are simply the richest, by the setting.
- **War** needs a grievance (thefts, killings, a lost village), or hunger and no land left, and a
  leader bold enough who thinks it can be won. Soldiers march on the nearest enemy village; an
  undefended village is taken. Peace comes when a side is tired enough.
- **Breakaways** happen when a village's own people have, on average, stopped being loyal. If the
  leader lives there it is a coup or an early vote instead.
- **People change sides** by marrying across a border, walking to wherever there is food, being
  talked round by somebody doing better, or being conquered.
- **Money** is conserved: every coin is in a pocket, a till or a treasury, and the test adds them
  up every year. With "no money" every village keeps one store everybody eats from.

Things found while tuning it, so nobody undoes them:

- **Children on day one need parents.** Without them a third of the starting population starved
  in three years, because a child eats from a parent's share.
- **A village feeds its own children whatever it does about money**, and a couple eats from one
  pot. Orphans starving beside a full store was not a finding about economics.
- **A treasury must spend.** Tax flowed in and nothing flowed out, so within a decade every coin
  was in a chest and no farmer could be paid. Leaders now push spare coin back into their
  villages' tills.
- **Somebody with an empty bag goes home to eat — once** (`p.ate`), or a village with nothing to
  give holds its farmers at the door forever.
- **Coin worlds are harsher than shared ones, and that is left in.** A broke person can starve
  beside a full store unless the leader believes in sharing or a neighbour is kind. That is what
  the money setting is for.

### Ruling, live rules, graphs and grain trade (2026-11-14)

Ric: *"the person watching can choose the tax and big decisions and stuff for each area"*, and
asked for the graphs and the grain trade the year needed. All of it is on the running page.

- **Ruling a faction.** On the Factions tab, *Rule it yourself* hands that faction's leader
  decisions to the watcher (`rule`, `order`, `orderVillage`, `declare` in `people.js`): the tax on
  every sale, the share of adults under arms (filled in peace too), whether the treasury buys
  bread for the hungry, and war or peace with each neighbour. Each village can be given its own
  tax and its own relief (`taxOf`), which is what "each area" means here. Nothing else changes:
  people still live by their needs, so a heavy tax is felt and resented — `test/rule.test.mjs`
  holds that a sixty per cent tax costs loyalty against the same world left alone. Peace takes
  two: the other side weighs its own dead, years and hungry as its leader would, and nobody makes
  peace the week they were attacked unless badly outmatched. Elections and successions still
  happen; the watcher's decisions outlast leaders until handed back. Your decisions are in the
  news. A world nobody rules is byte for byte the world it was.
- **Live rules.** The World tab's *Change the rules* lists only the settings the engine reads as
  it goes (`LIVE` in `people.js`, marked `live` in the schema): land, the year, crowding,
  children, hunger, sickness, prices, tax, the minds, breaking away and war. The ones that shape
  only the first day — the map, how many people, the seed, how it starts, money, inequality —
  are not offered, because moving them later would change nothing. Step buttons, not sliders:
  the panel redraws several times a second.
- **Graphs.** The World tab draws one point a day (`sample`): people, food on hand in days a head,
  the price of food, the share going hungry, deaths a day, loyalty, and grain carried between
  villages. The last 600 days.
- **The map shows what happened.** Households that moved are drawn as fading arrows from the old
  home to the new (dashed when hunger drove them) for twenty days, and the big news of the last
  fortnight — famine, war, peace, a village taken, founded, abandoned or broken away, sickness —
  as a ring and a word where it happened. Only what the engine recorded (`moves`, `events`).
- **Grain trade.** With seasons the grain is in houses and the store is empty all winter, so the
  old traders, who read only the store, never moved any. A trader now also carries grain: from a
  village whose houses hold more than their winter (`spare`) to one whose houses are short of the
  next fortnight (`short`), a cart of eight packs, bought door to door at each seller's price and
  never into their own winter, sold door to door to the most short at cost plus forty per cent;
  whoever cannot pay does not get it. A trader takes only as much as the short households there
  can pay for (`purse`), never while the harvest is still standing, and only traders cart grain —
  when anybody could, two-fifths of a hard winter's adults chose to carry food to one village,
  jammed at its middle for a week and stopped sleeping. Coins are conserved.
  **What it does not do yet:** with grain carts on and off, same code and seeds, four year-long
  runs lost 50 and 48 — no measurable effect on survival — and with carting left to traders,
  few of whom exist, under a dozen rations a year now move. The mechanism is real; making it
  matter (more traders when grain is dear, granaries, credit) is not done.
- **A jammed journey arrives.** A trip between villages finishes only by physically getting
  there (the crowd routing above) — except when it has stood within 2.5 tiles of its end for most
  of an hour after rerouting, when it counts as arrived. Forty carriers aimed at one village's
  middle otherwise never arrived at all.

### Settings that mean what they say (2026-11-14)

Ric, going through the setup page: *"a full village … there should be an option to say as much as
can sustain it"*, *"kids shouldn't have a bunch of money cuz they can't spend it"*, stubbornness
*"should be passed on genes … set the range but not everyone being the same"*, *"what if a system
of who has the most money gets overthrown by a civil war?"*, and *"soldiers in peacetime … should
be decided by leaders"*. Each is now what the engine does (`test/settings-sense.test.mjs`):

- **A full village** goes to *as many as its land can feed*: the limit is what the fields within
  eight tiles grow on an average day, a ration a head (`crowdOf`, `landFeeds`), worked out daily
  with the territory, so lost land or thin soil makes a village full sooner. The number stays as
  an option, and is still the default.
- **A household is one purse and one pot.** Children may hold coins, from the start or an
  inheritance (an earlier version of this day kept them from children altogether; Ric: *"kids
  should be allowed to hold coins. But their parents can use them"*). Whoever feeds a child can
  spend its coins for the household once their own are gone, and a couple's coins are one purse
  (`funds`, `pay`); a parent with nothing eats from what a child holds beyond its own next three
  days, as already from a partner's plate. The rule behind it, in Ric's words: settings can be
  played with, but the core must never make *"a kid having a bunch of money while his parents
  are starving"*.
- **Natures are personal and inherited.** Stubbornness was one number for the whole world; now each
  person has their own (`stub`), and a conversation moves each by their own openness. Children take
  after their parents. **How much they differ** sets how far one founder's nature — stubbornness,
  boldness, warmth, greed — is from the next and how far a child strays; at its middle the founders
  are spread exactly as before. The inspector shows Stubborn and Greedy bars.
- **Who leads, at first.** Each faction has its own way (`f.rule`), shown on its card. A chief or a
  rule of the rich falls in a civil war (`revolution`) when at least 45% of its grown-ups have
  turned on it and they outnumber the soldiers still loyal two to one: both sides lose people, and
  the winners choose a vote if they lean to sharing, else a chief. Nothing is on a timer; a regime
  its people bear is never touched, and one fallen cannot fall again for three years. Measured: a
  hated rule of the rich (inequality 0.95, loyalty none, tax 50%) fell in both factions inside 120
  days; a borne one (no inequality, full loyalty, no tax) stood.
- **Soldiers at the start**, then the leader's call: in peace each leader moves a little a day
  toward half the biggest neighbouring army's share plus a base, a little more for old wrongs and
  a bold leader, less when the treasury cannot pay — and recruits toward it in peace too. Matching
  a neighbour in full was an arms race to the cap; half settles near eight in a hundred.
- **No longer live:** stubbornness, how much they differ, peacetime soldiers and tax are people's
  natures and leaders' decisions now, so the running World tab no longer offers them; nor are how
  long somebody lasts with no food, how many people a mind holds, or the distance from the
  equator — how bodies, minds and places are is set once, at the start (Ric: *"starvation should
  be decided at the beginning"*). Tax had been
  live and did nothing: moving it shifted only a floor leaders seldom reached, and no faction's
  actual tax changed. It is **Tax at the start**; to set a tax mid-run, rule the faction.

Then a pass over every other setting for the same kind of thing:

- **Starving took ten days.** Somebody with nothing at all to eat lost all their health in ten
  days at "Going hungry" 1 — four times faster than a fed adult with water lasts. It is about six
  weeks now (`STARVE`), and the setting says it in days ("about 42 days with no food at all";
  14 to 208 across its range). Every famine figure before this date was measured at the old rate. Measured after, the same year-long runs of a 300-person valley starved 0, 1, 0 and 0 (mild winter seeds 11 and 108, hard winter 11 and 108), where they had starved 0, 32, 5 and 27: the "famine valley" of seed 108 was mostly people dying before asking a neighbour, buying grain or moving could reach them.
- **"A vote every" hid itself** unless votes were the starting rule, although a revolution can
  bring votes in and they use it. It always shows.
- **"The world starts in"** said "Autumn — the harvest is in the fields" and "Winter — with
  nothing put by", which contradicted Crops in the fields and Food put by when those were set
  otherwise. Plain season names now; what is in the fields and the houses is set under How it
  starts.
- **Settings with no explanation** — who starts rich, inheritance, loyalty, how quick to fight, how
  deadly, villages each — now say what they do.

### A world that does not go still (2026-11-14)

Ric: *"the people stopped doing things — they didn't take more land, they weren't greedy, they
weren't fighting ever, wars are always really fast … the simulation got to a point where no one
was doing anything."* Measured over two years of a 200-person valley, he was right: no war, no new
village, no faction risen or fallen, and adults asleep or sitting at home 50–75% of their hours.
Once a household had its winter put by, nothing in the engine gave anybody a reason to want more.
What was added, each measured over three years on three seeds:

- **Ambition.** A person measures what their household is worth (coins, food, goods) against
  their village's average, and the greedy want to stand above it (`ambition` in `urgency`): they
  keep working, trading and saving after the larder is full. Making goods rose from 4–9% of adult
  hours to 17–29% in a first year.
- **Land hunger.** A village whose fields feed fewer than two a head sends its bolder families
  out to found a new village on good open land (`found`), long before it is "full" by a count.
  Villages now spread in the first months until territories meet; where no land is left, that is
  felt as cramped.
- **Reasons to fight.** Besides old wrongs and hunger: land running short (fields feeding under
  two a head across the faction) and, for a greedy leader, a neighbour richer a head (`covet`).
  Wars may begin from the first half-year, and between the same two eighteen months after a peace
  (they were held off a year and three years, so every war in a world began in its thirteenth
  month and the next years were silent).
- **Wars that last and do not slaughter.** A village defends itself: a quarter of its grown-ups
  stand behind its walls besides any soldiers, besiegers make headway only while they outnumber
  all of that by a fifth, and a bigger place holds out longer. A fight is skirmishing: about one
  blow in four hours of close contact, and a blow wounds more than it kills; the wounded go home
  and are let go rather than cut down as they leave — chased down, they had been most of a war's
  dead, a quarter of a world in eleven days. War-weariness builds with the dead, the years and the
  hungry, so wars between equals run through campaigns and winters.

**What a three-year run looks like now:** wars from the seventh month that run one to two years
with a fifth of adults under arms, famine in the war winters because soldiers do not farm (the
heavier cost of war, as it was), villages taken late, one faction swallowing another, peace, and
new villages founded throughout. Battle deaths are about five in a hundred over a war. Wars and
famine are not scripted: each comes from people's land, wealth, grievances and leaders.

### A five-minute day and a map with a size (2026-11-14)

Ric: *"generations take hours even at 1500x speed … what if instead of 20 minute day it was a 5
minute day"*, and then *"I don't want the people moving faster … maybe we need to define how big
the map is"*. A day at 1× is five minutes. The engine's cost is the number of small steps a game
day holds, so it now takes 60 a game hour instead of 250 (`ACTIONS_PER_HOUR`): everything measured
in hours — sleep, shifts, seasons, rations — is as it was, and everything that was counted in
steps (how long a conversation stands, cooldowns, when somebody counts as stuck) is converted by
`TK` to last the same game time. Measured headless: 200 people run a year in about 3 minutes, 400
in about 8 (a little over three times faster than the twenty-minute day). A world plays out the
same at any viewing speed; it is only coarser in its steps than it was.

The map has a scale: **a square is 250 metres**, so a village's fields, about eight squares out,
reach two kilometres, as farming villages' did. **How much land** is a slider in kilometres east
to west, 5 to 40 (north to south is 0.62 of it); the old valley, district and region are 11, 17
and 25 on it, and a link or preset that names one still opens it (Ric: *"we should be able to
choose how big the land is"*). Below 5 km the default eight villages do not fit.

**Up to the size of a state, on a computer that can carry it** (Ric: *"largest should be the size
of like a state … Idaho or Utah or Tennessee"*, and *"a big computer could run bigger worlds with
options to turn parts of tracking off"*). Land goes to 500 × 310 km — about 155,000 km², between
Tennessee and Utah — and people to 20,000. Three things make that possible, measured:

- **Detail**, a settings group: **Bodies** "as drawn" (the default; everybody keeps a drawn box's
  width apart, so nobody overlaps on screen) or "real size" (half a metre on 250-metre squares:
  nobody is ever in the way, the bookkeeping of who stands where is skipped, and a world runs
  about 3½ times faster — 400 people, a year in 1.8 minutes instead of 6.3 — but boxes drawn
  larger than life can overlap); **Conversations** "every one written down" or "only what
  happens" (they still pass on news, friendship and sickness; little faster on its own).
- **Land over 40 km is mostly wild** (`WILD`, `worked`): crops are worked out only within four
  kilometres of a village, and a square first reached is a full stand of virgin growth. Every
  map up to 40 km is exactly as it was. Borders are worked out around each village rather than
  by asking every square about every village, and the lists of who stands on each square exist
  only where somebody stands — both give the identical world, checked on three seeds.
- **The page paints a big land a pixel a square**, its soil worked out once, and repaints it at
  most every two seconds; eight pixels a square would have been a canvas larger than a browser
  allows.

Measured headless with real-size bodies: 500 km and 2,000 people, a year in about 9 minutes; in a
browser at Max about 5. **Many thousands of people are still slow** — 8,000 on 500 km took an hour
a year — because some of what a person does still looks through everybody (who to ask for food,
who to buy grain from); that is the next thing to make fast. Tests move "how many people" and
"how much land" to twice and ten kilometres more, not half way to their ends, which test the
computer rather than the world. People
**walk 4.5 km an hour**, 18 squares (`TILE_METRES`, `WALK_KMH`); until this they covered about
37 squares an hour, nine kilometres, on a map with no size. A stride longer than a fifth of a
square is taken in checked pieces, so nobody walks through anybody. Tests step the world by
`People.STEP` (one step) or by game hours, never by seconds, which mean a different amount of the
world at a different day length.

### How fast a world can run (2026-11-14)

Ric: *"16x is pretty slow ... a year every minute should be the fastest probably"*. The clock now
goes to 50×, 100×, 250× and **Max**. Above 16× the page runs as much simulation as fits in 40 ms a
frame (since 2026-11-15 the keeper does, on its own thread, ten milliseconds at a time: see "Off the page's thread") and drops the rest — the world goes slower than asked, never differently — and says what it
reached: *"Running at 900× — a year every 8 minutes"*. **Max has no ceiling** (Ric: *"someone with a better computer can run faster"*): it asks for as much as fits in each 40 ms, so a faster machine simply goes faster. Ric chose to keep the engine exact at about a year every 8 minutes rather than coarsen it for speed.

A year a minute is about 7,300×, and the engine does not reach it. Everybody acts 250 times a game
hour, so walking, crowding and who meets whom are exact; measured without drawing, 200 people ran
at 670×, 400 at 400× and 900 at 100× (cost grows faster than the head count). The tables of who
stands where were a Map of Sets rebuilt from nothing every tick — 43% of the time; they are now
reused arrays with only the used cells cleared, which gives the identical world (same seed, same
state, checked) about 1.3× faster in Node and around 900× in a browser at 400 people. The next
exact saving — letting somebody asleep or mid-shift skip the ticks in which nothing about them
changes — is perhaps another 2×. Reaching a year a minute would need people to move in coarser
jumps at high speed, which would make a world play out differently depending on how fast it is
watched; that breaks a rule this engine was built on and has not been done.

### A crowd that costs what it should (2026-11-15)

`TODO.md` item 1. Ric: *"efficiency is importnat for the program"*, and *"i feel like right now im
running it inefficiantly"*. He was right, and the waste was in one place.

**What was measured.** On a 5,000-person world, 87% of everybody's steps were an attempt to walk
that got nowhere. A village that size is packed as tight as bodies allow, so a person aiming at
their bed or bench tries the heading and four ways round it, and ends the step where they began —
most often by stepping aside and straight back. That was 6.25 million such attempts a day, three
quarters of the engine's time, spent on people who never moved. The search for a way round a crowd
ran 892,000 times a day and found a way 123 times.

**What changed.** Nothing about what happens; only what is worked out twice.

- **A blocked step is remembered** (`move`, `quiet`). It can only come out differently if room has
  been made near the walker: somebody stepped away or died. Each square keeps the count at which
  room was last made on it; a person who stands where they stood, wants the same step and has had
  no room made on the nine squares round them is blocked again without looking. An arrival can
  only block, so arrivals are not counted. A step aside-and-back counts as blocked: nobody else
  acts in between, so nothing saw it.
- **A way round that could not be found is remembered** the same way (`noWay`, `stillNoWay`), over
  the squares the search actually looked at.
- **"Is anybody in the way" reads one, two or four squares, not always nine** (`free`): only the
  squares a body's width from the spot can touch.
- **A crowd is placed with a finer map** (`markTaken`, `takenAt`; `ringTaken` until item 3b): sixteen small
  squares to a square's side, each marked when it lies wholly inside one body's reach. A spot on a
  marked square is taken without looking; a ring crossing only fully marked squares is skipped.
- **Who takes an orphan in** is found in one pass over the population (`findCarers` in `census`),
  not one pass per orphan.
- Smaller things: no list built per person per step to ask "is this a local task", number keys
  in the route search, no search of a square's list before adding somebody to it.

**The world is the same world**, step for step. The idea is the sleeping body of a physics engine
(a thing that cannot change is not worked on until a neighbour moves), and the danger with it is
well known: a sleeper that never hears it should wake. So every way room can be made is counted —
a step, a death (`die`), and a person moved or marked dead from outside the engine, which the
tests and the page are allowed to do — and `test/walking.test.mjs` runs the engine both ways and
holds them equal, hour by hour. It was checked by breaking each short cut on purpose (eight ways);
the test caught every one. The old engine and the new were also run side by side from the same
seed: a year of the default world, six days of 3,000 people at war with sickness, a day of 20,000.
Identical every time.

Because a sine differs by a hair between an Apple and an Intel chip, the test compares two runs on
the machine it is on rather than against a stored answer.

**What it bought** (Apple M1, 8 GB, `test/bench.mjs`, bodies as drawn):

| People | Land | Start, before → after | A day takes, before → after | Top speed, before → after |
|---|---|---|---|---|
| 400 | 17 km | 0.02 → 0.02 s | 0.78 → 0.52 s | 382× → 577× |
| 2,000 | 17 km | 0.12 → 0.05 s | 11.9 → 4.4 s | 25× → 68× |
| 5,000 | 40 km | 0.90 → 0.15 s | 23.8 → 4.4 s | 13× → 68× |
| 20,000 | 80 km | 25.7 → 2.6 s | 132 → 21 s | 2× → 14× |
| 400 | 500 km | 0.17 → 0.19 s | 0.47 → 0.37 s | 644× → 813× |

**What it costs.** Eight bytes a square of land for the room counts, only with bodies as drawn:
about 14 MB more on the 500 km map (56 → 69 MB at the start). Nine small fields on a person. The
finer map exists only while a crowd is being placed.

**What it did not fix, and should not hide.** The crowd itself. With the default eight villages a
world of thousands is eight solid discs of people who mostly cannot get to where they are going;
that is now cheap, and it is still what happens. It is the same world as before on purpose (this
item was not allowed to change it). Giving houses and fields real ground of their own is `TODO.md`
item 7. And every person is still visited every step whether or not they have anything to do:
after this change that visiting, not walking, is the largest cost, and it is item 2.

Sources read for this: on grid cell size against query radius, the
[rustsim-crowd broadphase notes](https://docs.rs/crate/rustsim-crowd/0.0.1/source/src/broadphase.rs)
and [Fixed-radius near neighbours for agent simulations](https://eprints.whiterose.ac.uk/153625/7/1-s2.0-S0743731519301340-main.pdf);
on sleeping and waking, [Roblox's sleep system](https://create.roblox.com/docs/physics/sleep-system.md)
and its account of [a sleeper that was never woken](https://corp.roblox.com/newsroom/2020/07/roblox-physics-building-better-sleep-system);
on placing points that keep their distance with a background grid,
[Bridson's Fast Poisson Disk Sampling](https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf).
None of their code is used.

### Only people with something to do (2026-11-15)

`TODO.md` item 2. After item 1 the largest cost was no longer walking: it was that every person,
and every list of who stands where, was gone through on every step — 1,440 times a day — whether
or not anything about them could change.

**What was measured first**, because the guess was wrong. The plan was to stop visiting people who
are asleep or at work. Measured on this machine at 20,000 people:

- **A third of all the time was the computer not knowing what a person is.** Eight fields were
  added to a person the first time they were used (`stuck`, `lastDistance`, `markets`, …), in
  whatever order a life happened to use them, so there were 21 different layouts of "a person" in
  memory. A JavaScript engine keeps a short cut for reading a field off objects it has seen laid
  out the same way; past a few layouts it gives up and looks the field up by name every time. That
  was 35% of the time with bodies as drawn and 50% at real size.
- **Most people who looked asleep were not.** With bodies as drawn, 74% of all person-steps were
  somebody standing jammed in a packed village more than 2.5 squares from the bed, field or bench
  they were walking to (the crowding item 1 found; item 7 is its cure). They are "walking", so a
  rule for sleepers never reaches them.
- **With bodies at real size, half the time was `choose` looking through everybody alive** to find
  the people of one village: 43 million neighbours a day looked through to find somebody to ask
  for food.

**What changed.** Nothing about what happens.

- **Every person has every field from birth** (`newPerson`), empty until used: one layout. This
  alone halved a day at 5,000 and 20,000 people. **Add any new field of a person there**, not
  where it is first used.
- **Somebody with nothing to do but wait is passed over** (`wake`, at `act`): asleep, in the middle
  of a day's field work or a batch at the bench — standing where they mean to be, with a wait
  running, nothing said or struck still showing, and in a task in which nobody starts a
  conversation. The loop does not look at them until the step their wait runs out.
- **Somebody jammed is passed over until room is made near them** (`jammed`, `watchFor`, `tell`).
  Item 1 already remembers their blocked step and the failed search for a way round; while both
  stand, a step changes two counts and nothing else. They are put on a list for the ground those
  memories read, in blocks of four squares; `madeRoom` — a step taken, a death — tells the block.
- **Whoever dozes is woken before anybody else changes them** (`wakeUp`): spoken to, asked for
  food, widowed, taken along to another village. Everybody is woken on the hour, when anything may
  touch anybody (one visit in sixty). Their counts are put right as they wake, and before `advance`
  returns (`settle`), so nothing outside the engine ever reads a stale one.
- **The lists of who is on each square are kept up, not emptied and refilled** (`rebucket`,
  `shifted`, `gone`; `put`/`unput`): only somebody who crossed onto another square is moved, into
  the same place in the order.
- **Who lives in each village is a list** (`residents`), made again only after a birth, a move, a
  village changing hands, the dead leaving, or the hour — so asking a neighbour, selling a cartload
  door to door, an army's rations and what a village eats in a day no longer go through the world.
- **Asking for food looks at what a neighbour has first**, and passes by anybody who could not beat
  the best so far even as kin and a friend.
- **Two things about item 1's memory of a failed way round.** It is kept only when the search was
  *walled in* — ran out of places to look. A search that ran out of *tries* is not kept: somebody
  arriving can shut off a dead end it was wasting its 800 looks in, and the same search then gets
  through, so "nobody new can open a way" is not true of it. (None had been small enough to be
  kept under the old limit in anything measured; no world changed.) And what is kept is the ground
  the search looked at, not that ground stretched to where the walker was going: in a 2,000-person
  country on 17 km, 96,000 searches a day were run again because somebody moved between a walker
  and a bed twenty squares off, for 1,355 ways found. Now 33,000. *(A search out of tries is
  remembered after all since later the same day, until anybody there moves: below.)*

**Why some people were still visited every step.** Somebody idle and due a word with a neighbour
rolled the dice on every step to see whether they started talking. The dice are one stream;
drawing them in another order is another world. So they were visited — about one person-step in
six at 20,000. *Changed later the same day, on Ric's word: "When somebody next speaks", below.*

**The world is the same world**, step for step. `create(options, { plainWalking: true })` runs the
engine the long way round — everybody, every step, every list refilled — and
`test/dozing.test.mjs` holds the two equal hour by hour over ten kinds of world, with
`{ audit: true }` making the short cuts check themselves on every step: nobody passed over may
have been changed, every kept list must be what making it again would give. It was checked by
breaking each short cut on purpose, 22 ways: the test catches 20. The other two cannot show —
not waking the dead (they do nothing either way), and keeping a search that ran out of tries
(the case it guards is too rare to stage). The engine as it was before this item and the engine
now were also run side by side from the same seed: **a year of the default world, identical on
every one of 365 days**; a day and more of 20,000 people, a day and a half of 5,000 with bodies as drawn and at real size, and two
and a half days of 2,000 on 17 km, all with the audit on, identical every hour.

**What it bought** (Intel Xeon 2.1 GHz cloud machine, 16 GB, `test/bench.mjs`, bodies as drawn — not the M1 of the table
above: this was built in a cloud session, and its numbers are about 2.2 times the M1's):

| People | Land | A day takes, before → after | Top speed, before → after | Steps on which a person is looked at |
|---|---|---|---|---|
| 400 | 17 km | 0.92 → 0.60 s | 327× → 499× | 45% |
| 2,000 | 17 km | 8.5 → 5.6 s | 35× → 54× | 68% |
| 5,000 | 40 km | 9.1 → 3.5 s | 33× → 86× | 52% |
| 20,000 | 80 km | 46.4 → 15.5 s | 6× → 19× | 30% |
| 400 | 500 km | 0.61 → 0.28 s | 489× → 1,084× | 39% |

With bodies at real size: 5,000 people 10.9 → 3.4 s a day, 20,000 people 70 → 17 s. A year of the
default world: 368 → 173 s. Starting a world is unchanged (20,000: 4.4 → 4.3 s). Per person-step,
5,000 and 20,000 people now cost about the same (0.49 and 0.54 millionths of a second; before,
1.26 and 1.61). **On the M1 the 20,000 row should come out near 7 s a day, about 43× — worked out
from the ratio between the two machines, not measured: run `node --expose-gc test/bench.mjs` there
and put the row in `TODO.md`'s speed log.**

**What it costs.** Four small fields on a person, twenty bytes a person of tables, and a list of
watchers per block of ground while people are jammed. When time is handed over in small pieces
(the page, a frame at a time) everybody is looked at once per piece for anything done to them
from outside: at 20,000 people a day's working-out goes from about 12 to 15 seconds
when a piece is two steps, and 22 when every step is its own piece — still under the
46 it took before.

**What it did not fix, and should not hide.** Per person, a dense small land is still four times
dearer than a big one (the 2,000-on-17-km row): there the search for a way round a crowd is half
the time. People who may start a conversation are still visited every step. Asking a neighbour
for food still reads through the village, so it grows with the village, not the world. All three
are `TODO.md` 2b — done the same day, next section.

**Rules this leaves** (also in `/AGENTS.md`): anything new that changes *another* person in the
middle of a step calls `wakeUp(them)` first; anything that changes where somebody lives calls
`changedHomes()`; anything that makes room calls `madeRoom` (item 1); a new field of a person goes
in `newPerson`. Run `test/dozing.test.mjs` — the audit names what was missed.

Sources. The method — keep, for each part, the time of the next thing it will do, and go straight
to it — is next-event time advance, the ordinary way of running a discrete-event simulation
([course notes after Leemis & Park](https://huichen-cs.github.io/course/CSCI570/notes/lecture10_nes.pdf);
[Discrete-event simulation](https://en.wikipedia.org/wiki/Discrete-event_simulation)), and its use
for agents is argued in [Event-driven agent-based simulation](https://www.doi.org/10.1186/2194-3206-1-3)
("regards only those points in time when changes actually occur"). Timing wheels
([Varghese & Lauck, 1987](https://blog.acolyer.org/2015/11/23/hashed-and-hierarchical-timing-wheels/))
were looked at for holding the wake times and not used: a plain table read in the order of the
people array keeps the dice in order, which a wheel does not. Being woken by a change in somebody
else is Repast's "watcher" ([Repast4Py guide](https://jozik.github.io/goes_bing/guide/user_guide.html)).
Same result however the time is handed over: [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/).
Object layouts and why one is fast and many are slow:
[Hidden classes and inline caches in V8](https://dev.to/omriluz1/hidden-classes-and-inline-caches-in-v8-36fp).
These were found and read as search summaries; the session's network did not allow the pages
themselves to be opened, so the figures in this section are the ones measured here, not theirs.
None of their code is used.

### When somebody next speaks, and the rest of what item 2 left (2026-11-15)

`TODO.md` 2b. Ric: *"do 2b finish 2 all the way"*. Four things item 2 had measured and left.

**1. When somebody next speaks — the one change that makes a different world.** On every step on
which somebody could speak, they rolled the dice for whether they tried to, at the same odds each
step (30% at the default). So the step on which they next try is a number that can be drawn once:
how many rolls until the first that comes up (`nextTry`, kept as `tryIn` on the person and counted
down only on steps they could have spoken). Every wait is exactly as likely as it was. What
changes is which numbers come off the dice, so **a seed gives a different world from the one it
gave before this date** — the same country, another history. Nothing else about talking changed:
who can be spoken to, what is said, what it does.

Measured, because "the same in law" should be shown and not only argued: a year of the default
world, twelve seeds, under the old rule and the new. The last column is how far apart the two
are, in units of how much one seed differs from the next; with twelve seeds, anything under about
0.8 is what chance alone gives.

| A year of the default world | Old rule, mean ± one seed's spread | New rule | Apart by |
|---|---|---|---|
| People alive at the end | 379 ± 16 | 373 ± 24 | 0.3 |
| Births | 13.5 ± 3.2 | 16.1 ± 5.2 | 0.6 |
| Starved | 8.6 ± 11.8 | 14.8 ± 19.8 | 0.4 |
| Died of sickness | 14.2 ± 4.9 | 16.0 ± 4.0 | 0.4 |
| Died in battle | 10.6 ± 7.0 | 11.3 ± 9.0 | 0.1 |
| Conversations a person a day | 9.3 ± 1.1 | 9.9 ± 1.1 | 0.6 |
| Moves of house | 368 ± 104 | 327 ± 117 | 0.4 |
| Changes of flag | 109 ± 73 | 114 ± 72 | 0.1 |
| Wars | 4.5 ± 1.8 | 4.5 ± 2.0 | 0.0 |
| Share of coins held by the top tenth | 0.56 ± 0.05 | 0.55 ± 0.04 | 0.2 |
| People remembered, a person | 8.95 ± 0.20 | 8.92 ± 0.23 | 0.2 |
| Mood | 0.72 ± 0.02 | 0.71 ± 0.03 | 0.6 |
| Grown-ups' hours: asleep | 40.8% ± 2.1 | 40.0% ± 2.1 | 0.4 |
| … at a bench | 16.2% ± 3.8 | 14.3% ± 3.0 | 0.6 |
| … in the fields | 8.2% ± 0.4 | 8.5% ± 0.7 | 0.4 |
| … in conversation | 8.8% ± 1.3 | 9.6% ± 1.3 | 0.6 |

Conversation was the nearest to the line, so it was measured alone over a month in **200 seeds
each way: 8.909 conversations a person a day under the old rule, 8.914 under the new** (give or
take 0.1 either way; the middle seed 8.75 and 8.70; one seed in ten under 7.8 or over 10 in
both). Under either rule about one world in fifty goes into a trading rush in which half of
everybody is on the road with a load and talks twice as much (2 of 200 old, 4 of 200 new).

What it buys: between tries there is nothing for somebody idle to do, so they are passed over
like anybody asleep, and so is somebody jammed in a crowd who is idle. Two people in conversation
are passed over too until the first of them has finished (`untilHeard`): once the idle were, that
was one person-step in ten.

**2. A search that ran out of tries is remembered, until anybody there moves.** Item 2 stopped
remembering these, rightly: an arrival can make such a search succeed. But they were 60% of a
dense small land's time — 3,325 searches a day at 730 millionths of a second each in the
2,000-on-17-km world, run again every seven steps by somebody who had not moved, in a crowd that
had not moved either. With every body where it was, a search is the same search. So each square
also keeps the count at which somebody last *came* to stand on it (`cameAt`, `came`, beside
`roomAt`), and this kind of memory (`rm.any`) is dropped when anybody on the ground it looked at
comes, goes or dies. The search itself also stopped working out the same two square roots at
every look. Its answers are the same: 720,000 searches were run both ways side by side.

**3. The page says it has touched nobody.** `advance(seconds, true)` leaves out the look at
everybody for what was done to them from outside, and the putting-right of passed-over people's
counts afterwards. The page gives its word because it only draws people; a test or a console
leaves it off and gets both. The engine's own doors (`rule`, `order`, `orderVillage`, `declare`,
`set`) say for themselves that something was done. **After `advance(…, true)`, call
`world.settle()` before reading anybody's `wait`, `stuck`, `routeRetry`, `talk`, `tryIn` or
`sayT`.**

**4. Asking a neighbour for food** still reads through the village. No way was found to find the
best giver without reading everybody's larder that gives the same giver, short of following every
change to anybody's food. The honest fix is that nobody knows the larder of two and a half
thousand neighbours: it belongs with what a person holds in mind, and it is now part of `TODO.md`
item 11.

**The world is the same world** for 2, 3 and 4, and for 1 it is the world the new rule makes run
the long way round: `test/dozing.test.mjs`, twelve kinds of world now. The audit was made to
check what each memory actually claims — that every body on that ground is where it was, and for
a search out of tries that nobody else has come — and to search again whatever is remembered and
see that there is still no way. Broken on purpose 31 ways; it catches all 31. (It caught two real
mistakes while this was being built: a listener reading what a passed-over speaker still had to
say from a count that was behind, and a false alarm of its own.) Before the talking rule
changed, the engine with 2, 3 and the faster search was run against the engine as item 2 left it:
identical over the thirteen kinds of world, and hour by hour for 60 hours at 2,000 people, 36 at
5,000 and 26 at 20,000.

**What it bought** (Intel Xeon 2.3 GHz cloud machine, 16 GB — a different, faster cloud machine from the one in the table
above, so both columns were measured again on it; bodies as drawn, seed 7):

| People | Land | A day takes, item 2 → 2b | Top speed | Steps on which a person is looked at |
|---|---|---|---|---|
| 400 | 17 km | 0.39 → 0.32 s | 767× → 938× | 45% → 27% |
| 2,000 | 17 km | 3.8 → 3.4 s | 80× → 89× | 68% → 48% |
| 5,000 | 40 km | 2.4 → 2.6 s | 127× → 117× | 52% → 22% |
| 20,000 | 80 km | 8.6 → 5.7 s | 35× → 52× | 30% → 9% |
| 400 | 500 km | 0.19 → 0.19 s | 1,559× → 1,566× | 39% → 24% |

Handed over in pieces, at 20,000 people: before, a stretch that took 8.1 s in one piece took
8.7 s two steps at a time and 12.6 s a step at a time. Now, with the page's word, pieces of any
size cost what one piece costs (9.7, 9.7 and 9.7 s for the same stretch of the new world);
without it, 12.5 and 16.8.

**What it did not fix, and should not hide.** A dense small land is still dearer per person than
a big one. With the talking rule changed, one seed is no longer the same world before and after,
so a single row is one world against another: the 5,000 row above is slower by that and nothing else — over five seeds a day at 5,000
people took 3.4 s under either talking rule. What is left there is the search for a
way round in a crowd that is always moving, and that is the crowding itself — `TODO.md` item 7.
With bodies at real size the cost is still asking a neighbour (item 11).

Sources. Drawing the number of rolls until the first success in one go is the inverse-transform
way of sampling a geometric distribution, `1 + floor(ln U / ln(1 − p))` with U never zero
([randlib's igngeom](https://git.fossee.in/scilab_for_xcos_on_cloud/.git/tree/modules/randlib/src/c/igngeom.c);
[a worked answer](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/23517138/random-number-generator-using-geometric-distribution)).
Giving talking a dice stream of its own
([L'Ecuyer et al., streams and substreams](https://econpapers.repec.org/RePEc:inm:oropre:v:50:y:2002:i:6:p:1073-1075))
was looked at and not used: it keeps other things' dice still when talking changes, but somebody
would still have to roll every step. Read as search summaries, as above. None of their code is
used.

### Off the page's thread, no top on people, and what this computer can run (2026-11-15)

`TODO.md` item 3. Ric: *"the number of people should be infinite just based on can your computer
run it"*, and *"i want there to be a way that i can see what my limit will be because of my
computer. but if a friend has a better one i want them to be able to push those limits."*

**1. The engine has a keeper, and the keeper has its own thread.** Until now the engine ran inside
the page's drawing loop: forty milliseconds of world, then a frame. With 20,000 people that was
seven frames a second, and pressing Run froze the page for four seconds while the world was made.
`people-host.js` now holds the world, runs its clock and answers the page, and the page never
touches a person. It asks for four things and gets back plain numbers and words:

| The page asks for | and is sent |
|---|---|
| a frame — where it is looking, how closely, which colouring | who is in view (and half a screen round it): where, what colour, a byte of marks (child, hurt, sick, leader, speaking, reaping), what they carry; the lines between people talking; the few labels and sentences that are drawn; villages and factions, only when what the map shows of them has changed; the fields, every few steps and at most five times a second |
| the panel it is showing | what that tab needs: sixty rows of the People list already searched and sorted, one person, one village, the factions, the news, the talk, the world's counts |
| who is under a tap | a person or a village |
| a decision — rule, tax, arms, relief, war, peace, a live setting | that it was done, and what the other side answered |

The keeper is written with no timer and no thread of its own: it has two doors, `receive(message)`
and `run(seconds, budget)`. In a worker a small loop feeds them; where a worker cannot be had the
page keeps the very same keeper and calls `run` once a frame, in at most 40 ms, exactly as the
engine was always run; the tests call both by hand. One code path in three places. `?nothread` on
the address asks for the page's own thread, to compare.

*The same world.* The keeper hands time to the engine as `advance(seconds, true)`, in pieces of a
quarter of a second, and only reads. `test/keeper.test.mjs` runs a world through it at 1×, 16×,
250× and flat out, reading frames, every panel and a tap all the while, and holds it equal to the
engine walked to the same step alone. That test found one thing the page had always done wrong:
how much a village still has to put by for winter is worked out once an hour from its store *at
the moment it is first asked*, and the Person panel asks several times a second — so a watched
world could differ from an unwatched one. The engine's `urgency` door now puts the figure back.

*Opened as a file.* A page opened from a folder may not start a worker from a file beside it. So
the worker is started from text: `people.js` and `people-host.js` each keep the function they were
built from (`factory`), and the page writes both out again and hands that to the worker
(`keeperText` in `index.html`). Nothing is fetched, so it is the same whether the page is served
or opened from a folder; it was tried from a `file:` address in a real browser rather than assumed.
If a worker never answers, everything it was sent is given to a keeper on the page's thread.

*What it costs.* Reading 5,000 people for a frame takes the worker 0.7 ms; reading 20,000 takes
10.6 ms — most of it waiting on memory, a person being a large object. So every frame says what it
cost and the page leaves six times that before asking again (about a seventh of the worker's time
at most), and a frame asked for with nothing changed — the same view, the world on the same step,
which at 1× is every frame but five a second — is answered "same". The page draws at its own rate
whatever the world is doing: moving and zooming use the last frame with the view as it is now.

*A world never ran behind a hidden tab, and still does not:* the keeper is told to wait while the
page is hidden or paused. Leaving a world ends its thread.

**2. The land is painted a pixel a square.** With the engine gone, the page was still held up, by
its own painting: a land under about 500 squares across was drawn a square at a time, eight pixels
each, a colour spelled out as words for every one — 60 to 280 ms for an 80 km land, on every frame
at speed. It is now one small picture written straight into its pixels (about 1 ms) and stretched
onto the map as it is drawn, with the line where two factions' land meets kept as a list of edges
and drawn over it, a quarter of a square wide as it was. People are drawn a path a colour, not two
calls a person, with the dark line round each box a dark box a pixel bigger laid under it. Far
out, where a box is two or three pixels, there is no dark line: it used to swallow the colour, and
a full village showed as a black disc.

Measured in a real browser (headless Edge) on an AMD Ryzen 5 3600, 20,000 people on 80 km, clock
at Max, over the same eight seconds of each:

| | Before | After |
|---|---|---|
| Pressing Run holds the page for | 4.4 s | 14 ms (the world is there 5.4 s later; the page answers meanwhile and says "Making the world…") |
| Frames drawn a second | 7 | every one the browser offers (150 with nothing capping it) |
| Longest wait between frames | 229 ms | 25 ms |
| The world's clock moved | 0.41 of a day, about 15× | 0.99 of a day, about 37× |
| The page said it was running at | 22× | 54× at the end, having averaged 37× |

The last row is its own correction. The page used to work out "Running at N×" from what it asked
for in a frame, counting at most a tenth of a second per frame, so a world too big to keep up was
overstated. The keeper counts the time that really passed.

**3. No top on people.** The slider still sweeps to 20,000 — a convenient sweep, as the physics
sliders are — and beside it is a box where any whole number of 20 or more can be typed; a link
carries one too. `clean()` reads the top from `inputMax` (for people, none) and every other range
keeps its ends. Which village holds each square was a sixteen-bit table and is a thirty-two-bit
one, because with no top on people there is none on villages, and the old table would have run
out, silently, at the 32,768th. A world past what the computer can hold fails in its worker and
the page says so; it does not take the page with it.

What is *not* true yet: a big world is slow to start. Finding everybody a place to stand grows
with the square of the head count — 10,000 people 0.9 s, 20,000 3.7 s, 40,000 16 s — and it cannot
be done another way without people standing somewhere else, which is a different world. The page
no longer freezes while it happens, counts the seconds, and ← Settings gets out at once. `TODO.md`
item 3b.

**4. What this computer can run.** Not a table of machines, and not a guess from how many cores a
browser admits to (it caps the number, and it says nothing of how fast one is). When the settings
have been left alone for a moment, the world they describe is made on a thread of its own, out of
sight, and run for up to three seconds, and how fast it went is written under "How many people":

> On this computer: about 210× at first with these 5,000 people (a year every 9 minutes). It
> should stay above 16× up to roughly 65,000 people.

Ric chose that — a line under the slider — over a mark on the slider and a small table. It is the
same engine, seed and first hours the real world will have, so the first figure is that world's
own on this computer. Whole days are measured where there is time, because a night costs far less
than a day; and a first day that is over in under a second is not counted, because a browser runs
fresh code slowly for its first moments (before that rule, 400 people were said to run at 820× and
ran at 1,100× and more). The second sentence is plain proportion from the first. It is advice: the
box takes any number. A world not even made in twelve seconds is given up as "more than this page
can try out in a few seconds". Without a worker only worlds up to 2,000 people are tried, since
the try-out would hold the page up.

Why it could not be a rule of thumb, measured on 34 worlds of one seed: a day costs from 0.5 to
2.8 ms a person, and not more for more people — 2,000 people in eight villages cost more *each*
than 20,000, most of whom stand jammed and are passed over — and one world's second and third days
differ by up to three times.

How good it is:

| World | The line said | It ran, first days | Later |
|---|---|---|---|
| 400 people, 17 km | 1,200× | 1,600× | 2,300–2,900× from day 30 |
| 2,000 people, 17 km | 89× | 92×, 83×, 75× | 120–200× from day 4 |
| 5,000 people, 40 km | 230× | 340× | 100× from day 4, 65–75× by day 9 |
| 20,000 people, 80 km | 38× | between 18× and 49×, about 30× on the whole | |

Within about a third at the start, and out by two or three times once a world has settled or
jammed — which is the world changing, and nothing three seconds can know. So the line says "at
first", and the running world says what it is doing now. The second sentence means 16×, the
fastest clock that runs exactly as asked: Ric's choice ("Keep 16×"), over a year an hour and over
keeping up at 1× (`TODO.md`, item 3). It is one constant, `STEADY` in `index.html`.

### A big world starts in time, and the readout learns from the world (2026-11-15)

TODO item 3b. Two things: making a big world took a time that grew with the square of the crowd,
and the setup page's line only knew a world's first days.

**Making a world.** Nearly all of a big start is placing people who arrive where somebody already
stands: each searches rings outward from their spot (`actionTick`, "Initial residents") until a
point is free. Everybody must stand exactly where they stood before, so the search itself is kept,
point for point, and only work that could not change an answer is cut:

- **Only the points of a ring that could be free** (`overGround`, `lookShell`, `ringsOver`).
  The ground round a newcomer is looked over once, a shell of squares at a time as the rings reach
  it. Each piece not wholly taken (a square with few marks, or a small gap in one nearly full) is
  filed once under the first ring that reaches it and kept on a running list until the rings pass
  it. A ring with nothing on the list is passed without a look; on the others only the points
  over a listed piece are tried, in their old order.
- **Gaps that two bodies cover between them are marked** (`coveredGap`). The finer map marks a
  small square only when one body covers it all. A gap covered by two or three bodies together
  was looked over again by every newcomer near it. Each square now keeps the bodies that reach
  it, and a gap whose sixteen pieces are each within a body's width of one of them is marked:
  `free` would have turned down every point in it.
- **Full blocks are passed in one look** (`blockFull`, `lookRow`, `lookColumn`): squares
  full all over are counted by blocks of 8 × 8, and a block all full is skipped.
- **Parents for the first children** (`settle`): each child chose among the couples old enough,
  a list made afresh per child (children × couples). The couples are now sorted by the younger
  partner, so how many qualify is a binary search. The random draws are made in the same order,
  and the couple a draw names is read off a Fenwick tree (binary indexed tree, the "find the
  k-th" descent: [Grey_Matter's tutorial](https://codeforces.com/blog/entry/77616)).

Considered and not used: an exact distance transform of the free ground (Felzenszwalb and
Huttenlocher, [Distance Transforms of Sampled Functions](https://cs.brown.edu/people/pfelzens/papers/dt.pdf),
linear in the grid) gives the *nearest* free spot, but the world has always put a newcomer at the
first free point of its own rings of points, which is not always the nearest one, so a transform
would make a different world. Remembering, for each starting square, how far round it is all full
was tried and did nothing: packed ground keeps slivers between bodies, so few rings are wholly full.

Same world: whole starting worlds (every person, the villages, the stats) compared against the
engine before this change on eleven settings from 400 to 100,000 people (including one village,
three, and "settled" at 0, 0.9 and 1), all identical; and `test/walking.test.mjs` still holds a
crowd's places against the plain search. Measured with `test/bench.mjs --start` (Ryzen 5 3600):

| People, land | Before | After |
|---|---|---|
| 10,000, 56 km | 0.86 s | 0.56 s |
| 20,000, 80 km | 3.55 s | 1.52 s |
| 40,000, 113 km | 14.1 s | 3.4–3.8 s |
| 100,000, 179 km | 102.6 s | 13.3–14.9 s |

Still more than twice the time for twice the people: a newcomer starts inside the packed crowd and
the real holes between bodies have to be tried to keep the same world. A million is still a long
wait.

**What a world really did.** While a world runs on Max, the keeper (`people-host.js`) adds up the
world's time and the real time (the time owed, at most a tenth of a second a turn, so a back tab
asleep does not count as slowness; nothing while paused). After ten seconds on Max the page keeps
that speed in this browser, with the day it reached and how long the world took to start, against
the world's settings (`localStorage`, `wb-people-held`, the newest twenty). The next time those
settings are chosen the setup page says that instead of trying the world out: "Last time on this
computer, these 400 people ran at about 2,100× on Max, to day 70 …", with the 16× head count
worked from it. In a headless Edge the default world's try-out said 1,100×; on Max it held
2,100× to day 70, and the setup page then said so. With nothing kept, the try-out speaks as before.

### Land from the seed (2026-11-15)

TODO item 4a. Until now each square had two numbers from smooth noise, fertility and ore. Now the
seed makes the land the way land is made, and fertility and ore follow from it (`land()` in
`people.js`). It has its own random draws, so the same seed gives the same land whatever the
other settings.

1. **Height**, in metres: smooth noise in lumps from 300 km down to 1 km across, each as tall as
   its size (1,400 m for the biggest, 18 m for the smallest), the same method as Red Blob Games'
   [terrain from noise](https://www.redblobgames.com/maps/terrain-from-noise/). A lump wider than
   the land is only a tilt, so a 17 km land is a valley with hills, and only a land hundreds of
   kilometres across has ranges and snow. "How hilly" makes the middle sizes taller. The ground
   drops toward the edges, so a sea is a coast.
2. **Water runs downhill.** Priority-Flood (Barnes, Lehman and Mulla 2014,
   [arXiv 1511.04463](https://arxiv.org/pdf/1511.04463)) floods in from the edges, lowest first,
   with a queue of 65,536 height buckets so it takes time in step with the land. The square that
   reaches another first is where that one drains, so water always has a way out and never runs
   uphill. The **sea** is the ground a rising sea would reach from the edge, its level chosen so
   "How much sea" of the map is sea. A hollow filled more than 15 m deep (more on a land with
   thousands of metres of height in it) is a **lake**; a shallower one drains over its lip.
   **Rivers**: rain on every square, added up downstream, and a square is river where the
   ground draining through it passes an area (O'Callaghan and Mark 1984, as in
   [SAGA's flow accumulation](https://saga-gis.sourceforge.io/saga_tool_doc/9.4.1/ta_hydrology_0.html)):
   about 5 km² at the usual setting, from about 60 km² at the fewest to half a square kilometre
   at the most.
3. **Kinds of ground**, eleven, as Ric chose ("Ten plus snow and ice"): sea, lake, river,
   beach (a strip by the sea), marsh (wet, flat, low, by water), grassland, forest (wet ground,
   more with "How much forest"), hills (rising 40 m or more a kilometre), mountain (90 m a
   kilometre and high, or anything just under the snow line), dry land, and snow and ice above a
   snow line that comes down with "Distance from the equator" and "How cold winter gets": about
   2,400 m at 45° with a real winter, 900 m at 70° with a hard one (the Alps' is near 2,800 m,
   Norway's 900 to 1,500 m). Warmth and wetness stand in for Whittaker's temperature and rain;
   his biome lines are drawn by hand and differ book to book, so the kinds are set by these few
   plain rules instead.
4. **Fertility and ore from the kind**: grassland 0.8, forest 0.55, hills 0.42, dry land 0.22,
   beach 0.18, nothing on water, marsh, mountain or snow, all times 1.15; ground within a
   kilometre of a river or lake grows up to 0.2 better, most at the bank (river flats are laid
   down by floods, which is why villages sit by rivers); "How uneven it is" still spreads each
   kind's fertility either way. The 1.15 is measured, not felt: with it the ground within 2 km
   of a village grows what it did on the old land, 0.568 against 0.566 over ten seeds (0.49
   without it and the flats). Ore: mountains 0.8, hills 0.45, little elsewhere.

What people do with it, for now: villages start only on ground that can be lived on (beach,
grassland, forest, hills, dry land), spaced by that ground and not by the whole map; nobody is
placed standing in the sea or a lake (the crowd placing of item 3b treats them as full ground);
fields are only where something grows. Walking still goes straight, so people can wade a lake
on the way somewhere: going round water, and slower ground, is item 4b.

Measured: a year of the default world on seeds 11, 3, 5 and 7: 25 starved in all against 86 on
the old land, and more people alive on every seed (384, 388, 388, 403 against 383, 329, 353,
382). What the new settings move (`test/behaviour.mjs`, four days, three seeds; short and noisy,
the same settings read 3 to 10% from one run to the next): "How hilly" 7.6% of adults' hours,
"How much sea" 4.6%, "How much forest" 3.2%, "How many rivers" 2.7%.

The largest land is now 1,000 km across ("a state", Ric's choice), 4,000 squares by 2,480,
about ten million. A world on it starts in 4.5 s with 2,000 people
and 5.7 s with 20,000, and holds 640 to 750 MB. A day there costs what it does on a smaller land
(2,000 people: 2.9 s at 1,000 km, 2.4 s at 500): nothing is done for squares nobody uses.

Speed, per person, is unchanged: 2,000 people on 17 km take 3.87 s a day on the old land and
3.76 s on the new with no sea (five seeds each). With the usual 15% sea it is 4.37 s, because
the same people stand on less land and crowds cost more to walk through.

### Crossing the land (2026-11-16)

TODO item 4b. Until now people walked straight at where they were going, through lakes and the
sea and over mountains.

- **Nobody walks into the sea or a lake.** `free`, the one test of whether somebody may stand
  somewhere, says no to deep water, so walking, the crowd search and placing all keep off it.
  Somebody put in the water from outside may still walk out.
- **Rough ground is slower**, as a share of the pace on open ground (`PACE`): forest 0.6 (three
  fifths off a path: Tobler's hiking function, from Imhof's data,
  [Wikipedia](https://en.wikipedia.org/wiki/Tobler%27s_hiking_function)), hills 0.7 (Tobler at a
  10% slope), marsh 0.5 (bog is worse than brush: Soule and Goldman 1972, J. Appl. Physiol.), a
  river 0.4 (wading a ford), mountain 0.25 (Tobler at 25%, off a path), snow and ice 0.3;
  grassland, dry land and beach 1. **Except on ground a village holds**, which has paths: with a
  whole village walking its own streets at the pace of open hills, crowds round its middle
  jammed for hours (43 people stuck over 200 steps against 1, measured on the default world).
- **The way round water** (`landWay`). When the next square ahead is water, the walker plans a
  way over the 250 m squares: A* with each square costing its length over its pace, so it also
  goes round a mountain where that is quicker. The answer is kept for that pair of squares (the
  land never changes, so it is never stale), and its corners are cut where a straight line stays
  dry. This is the coarse level of hierarchical path-finding (HPA*, Botea, Müller and Schaeffer
  2004, [paper](https://webdocs.cs.ualberta.ca/%7emmueller/ps/hpastar.pdf)); the crowd search
  still does the last few metres.
- **Which ground joins which** (`landPiece`): one flood a world numbers every piece of land.
  A journey to another piece, an island or over the sea, is refused when it is set (`go`): the
  walker stays and idles instead of searching a whole land for a way that is not there. So
  villages that cannot reach each other by land neither trade nor fight by land; boats are later
  (PEOPLE-VISION, "Water as road and wall").

Measured. A year of the default world on seeds 11, 3, 5 and 7: 10 starved in all, 376 to 399
alive. Two days of 600 people on a land 60% sea: nobody in the water (on 4a's land 85 of them
were standing in it); 34 stood jammed for over 200 steps, crowds pressed against the shore, the
cost of water taking room. The quick bench against 4a: 400 people 0.30 → 0.33 s a day, 2,000
3.68 → 3.30 s, 5,000 2.62 → 2.45 s. The 1,000 km land starts in 4.3 s and holds 785 MB after a
day (the way-finding arrays are made when first needed). `test/land.test.mjs` walks somebody to
the far shore of a lake and sees them go round and arrive.

### Drawing the land (2026-11-16)

TODO item 5. Ric: "i can barely tell whats livable whats a forrest. what is a beach." The land
is now drawn so each kind of ground reads without a key (Ric named all eleven on a land he had
not seen, seed 26, without one), in the look he chose, "Map colours", over a darker, earthier
one.

- **Colour and marks.** Each kind has its own colour (`LOOKS` in `index.html`), and nearer in its
  own marks drawn from the seed, the same square the same every time: waves on water, rivers as
  lines along the way the water runs (`riverTo`, one byte a river square from the engine's
  drainage), sand grains on beaches, pools and reeds in marsh, tufts on grass, tree crowns lit on
  the sunny side in forest, curves on hills, peaks of different sizes on mountains, pebbles and
  cracks on dry land, drifts on snow. Eleven kinds is too many for colour alone, and colour-blind
  readers need more than colour (ColorBrewer's colour-blind-safe qualitative sets stop at four:
  [ColorBrewer](https://en.wikipedia.org/wiki/ColorBrewer)), so the marks carry it as well.
- **Relief.** Each square is lit by a sun in the north-west, 45° up, from the slope round it:
  Horn's gradient and the hillshade formula as ArcGIS and GDAL use them
  ([ArcGIS](https://pro.arcgis.com/en/pro-app/2.7/tool-reference/3d-analyst/how-hillshade-works.htm)),
  heights exaggerated three times; worked out once a world by the keeper (`hillShade`). Shading
  lit from the upper left is Imhof's "Swiss manner"
  ([terrain cartography](https://www.wikipedia.com/wiki/Hillshade)).
- **Three ranges of zoom.** Far out (under 3 pixels a square): the whole land as one picture,
  smoothed, with halved copies so a big land is cheap to shrink; villages and their names (a name
  that would cover another is left out); no people, who would be under a pixel. Nearer: the land
  in blocks with its marks, the faction colour and harvest as a see-through wash on top, houses
  round each village (one for about four people), and from 20 pixels a square furrows on the
  fields. Close (up to 128 pixels a square, twice the old limit): the same marks larger, and
  people. Houses are drawn, not yet things in the world: TODO item 7.
- **Only what is on screen.** A block (512 pixels, or the whole land when it fits in 2,048) is
  drawn once at the zoom's size and kept, 80 at most; at most one new block a frame, the rest of
  the view showing the plain picture for a frame or two. Houses are drawn into the blocks, and
  only the blocks round houses that changed are drawn again. Fields are kept as paths in land
  units, made again when ownership is sent. A big land's picture is repainted 600,000 squares a
  frame instead of all at once.

Measured in headless Edge, frame drawing time (script, not GPU). The default world: 0.37–0.40 ms
against 0.32–0.34 before, three runs each way, so **0.03 to 0.06 ms over** the item's budget of
"no longer than now": the wash for harvest and faction colour is now its own picture over the
land, and folding it back in would mean redrawing every mark at each repaint. A 1,000 km land:
every zoom and panning at 275 to 300 frames in three seconds (the browser's limit); the slowest
frame fell from about 150 ms (the repaint every two seconds, 119 ms before this item) to about
20 ms; a jump to a new zoom on a 200 km land holds at most 30 ms for a frame or three, instead of
570 ms.

### Houses, and people at their real size (2026-11-16)

TODO item 7a. Ric wanted to zoom in and pick out a family's house. A house was a point people
slept near, and a person kept about a hundred metres of room round them, so a person was bigger
than any house could be.

- **People are half a metre wide by default** (Ric: "Real size by default"): the "Bodies" setting
  now starts at "Real size", and the old spacing is "Spaced out". Nobody is in anybody's way.
- **A house is a building** (`homes`, `newHome`): a place, a length and width in metres and a
  facing. A village is laid out in plots spiralling out from its middle about 19 m apart, never
  on water. A house is 12 to 24 m long and 4.5 to 7 m wide, after excavated medieval peasant
  houses (Houndtor, Dartmoor: 14.2 by 4.3 m; England, France and Germany: about 15 to 23 by 4 to
  6 m); the richest household of a world gets the biggest, by rank of what it owns at the start
  (Ric: "different size of houses depending on how rich they are"). A couple shares a house and
  children live with a parent; a partner who marries in moves in. 400 people make about 275
  houses.
- **Asleep inside.** Going to bed means into the house: the last stretch inside is walked at the
  usual pace, where before anybody within 125 m of their bed had arrived.
- **Zoom down to a house**, to 4,096 pixels a square (a 15 m house about 245 pixels long). Past
  128 pixels a square the ground is drawn smooth with marks a few metres across worked out from
  the seed for the screen only (tree crowns, tufts, pebbles, reeds, ripples), rivers as a line
  15 m wide, and the houses at their true size: a roof in the faction's colour over thatch, its
  ridge along its length. From 20 pixels a square a person shrinks toward their real size, never
  under three pixels. The village's marker goes once its houses can be seen.
- **Soldiers from crafters too.** With real-size bodies farmers no longer queue in crowds, a
  field is worked faster, and fewer people farm; an army raised from farmers alone stalled short
  of what its leader asked (4 of 23 wanted 6). A leader now raises farmers first, then crafters.

Measured. A year of the default world, seeds 11, 3, 5 and 7: 16 starved in all against 10 before,
alive 376 to 392 against 376 to 399, village stores lower at the year's end (fewer farm); and a
year takes about 40 s instead of 115. `test/bench.mjs`: 400 people 0.34 → 0.12 s a day, 2,000 on
17 km 3.23 → 0.55 s (item 7's target, no dearer a person than 5,000 on 40 km, is met: 0.19 against
0.26 µs a person-step), 5,000 2.37 → 1.89 s, 400 on 500 km 0.15 → 0.05 s; **20,000 on 80 km 7.40 →
10.78 s, slower**: with nobody jammed twice as many people are doing something each step (27%
against 14%), and when a village store is empty every hungry person looks through all their
neighbours for one with grain to spare (`choose`, a quarter of the time).

### Acting on more of what is heard (2026-11-19)

TODO item 12b. Until now people acted on only two kinds of news: wars and villages taken (a
grievance) and who had food to spare. Where to move, where to go when hungry and where a trader
carried a load were chosen from every village's true store and prices, heard or not. Ric chose
which news people act on: **"Sickness", "Famine", "Prices and harvests"**; traders **"Keep it, news
adds a pull"**; a sickness at home sends **"A few, to family"**. Everything is read from the telling
a person holds, so a telling that names the wrong village sends them the wrong way.

- **Sickness.** Somebody who holds "A sickness has started in V" from the last 30 days does not move
  there, go there hungry, take food to its market, carry a load to it or look for a market there. Somebody who hears it of
  their own village, and has close family (a family tie above 0.4) in another village of their own
  side, takes their household to them one time in five, and comes back a week after the last case
  there. Early modern Italian cities turned away people and goods from places reported infected,
  checked by health passes (Bamji 2019), and Venice had its travellers report any news of
  contagion; those who could left London in 1665, and some carried it with them.
- **Famine.** "V is starving" keeps people from moving there. Somebody with food beyond their
  winter's keep and family in V takes them up to a load (`grainLoad`), given to them, or to the
  store if they have gone. Help in a famine runs along family ties (the Somali famine of 2011,
  Maxwell et al. 2016; migrants in Kagera, Tanzania, cutting their own eating for relatives at
  home; Dinka chiefs calling on a starving family's relatives first).
- **Prices and harvests.** A new piece of news, "Food is dear in V": one household in seven there
  going hungry with money to pay, not in the first month, not while it is starving, at most one a
  side every four months. A trader still sees every price within reach, but food and grain go half
  as willingly again to where they have heard food is dear, a famine, or a dry year for that side.
  Where traders cannot know prices elsewhere, prices stay far apart and food is wasted (Jensen 2007,
  Kerala's fishermen and their phones); Datini's factors at Caffa wanted to sail for Tuscany on news
  that grain had risen there.

Measured: everybody outside the biggest village (seed 13, day 60) told of a sickness there: trips
set out for it by outsiders over 30 days (to sell, trade or look for a market) 11 with no report,
1 told it is there, 9 told it is at the next village instead; trips to that next one 99, 206 and
10 (`test/heard.test.mjs`, the item's "done when"). Everybody with family in another village
(seed 11, day 200) told it is starving: 431 days of food carried there in ten days. A default year, eight seeds, before → after: starved 12 → 16 (the usual spread), died of the
sickness 115 → 109, left home for a sickness 0 → 18, food carried to family 0 → 106 days, grain
carted by traders 72 → 504 days, market food 10,766 → 12,880. Few have family in another village
in a world's first years (11 grown-ups of about 270 after a year, seed 11), so flight and help
are rare until families spread by marriage.

**Chosen, and its cost.** The news a person holds is read at most once an hour when they decide
(`rumours`, cached until anything is held or forgotten), only while some report of these kinds
is under 30 days old (120 for a dry year); which village a telling names is worked out once per
telling and kept by the engine, not on the event. Under half a percent of a mid-year day (a
profile); the bench unchanged. "Food is dear" first read households short of a fortnight's food:
that is every village at the start, and at one a village every two months it was as much news as
everything else together, crowding the rest out (the newest is what is told).

### Why wars start and end (2026-11-19)

TODO item 14c. Ric: "why a war starts and ends comes from what people and leaders hold in mind …
a new leader can end a war their predecessor began." Before this, a leader went to war on
grievance, land, hunger, greed and what they held against the other side (item 13), and made peace
when weariness (the dead a head, the years, the hungry) passed a mark set by their boldness and
temper. Who had begun the war played no part, and nor did what the people held. A place that was
taken was easily taken back the next week, because every soldier who took it marched on.

Now:

- **Who is to blame.** Each side of a war remembers whose leader it was when it began
  (`rel.began`). A leader who began it, or whose parent, child or partner did, keeps the old mark
  for peace. Any other leader's mark is 0.3 lower, and on the other side the mark for accepting is
  0.1 lower (`culpable`). This follows Croco's "culpable leader": one in office when the war began,
  or tied to the one who was, fears punishment for a bad end and fights on, while one who is not
  can accept the compromise ([APSR 2011](https://www.cambridge.org/core/journals/american-political-science-review/article/deciders-dilemma-leader-culpability-war-outcomes-and-domestic-punishment/509114969EBDD6FAC6DA9323744CDFB4)).
  A change of leader made the end of interstate wars more likely, 1816–2006
  ([Quiroz Flores et al.](https://lup.lub.lu.se/search/files/37690562/2017_11_Quiroz_Flores_Ba_ck_von_Hagen_Jamar_Teorell.pdf)).
  No rule says a new leader ends a war: a leader is replaced by death, a vote or a revolt as before,
  and only the blame differs.
- **What they hold.** The leader's own grudges and the news they hold against the other side
  (`heldAgainst`, item 13) raise the mark for peace by up to 0.15. What their people hold raises it
  too: thirty grown-ups read evenly through the list (`folk`), at 0.05, or 0.1 under a leader they
  can vote out. Never more than a leader's temper moves it: at three times that, and with the
  people's grudges adding to the wish to start a war as well, an old feud everybody held kept
  patient leaders at war as long as hot-tempered ones (`test/dealings.test.mjs`, 1,194 days against
  1,787). So what the people hold weighs on how a war ends, not on whether it starts. The dead a head were
  already in the weariness; casualties are what turn people against a war, through the news of them
  ([Fetzer et al., AJPS 2025](https://repec.cepr.org/repec/cpr/ceprdp/DP16102.pdf)).
- **Holding what was taken.** Half of the soldiers who took a place stay as its garrison for a year
  (`v.heldTo`), as the English held Normandy town by town
  ([Curry](https://eprints.soton.ac.uk/388591/1/Curry_1906.indd.pdf)).

Measured. Two years each, eight default worlds and six forced wars (600 people, 40 km, three
factions), before → after:

| | Default worlds | Forced wars |
|---|---|---|
| Wars ended | 14 → 26 | 4 → 3 |
| Places changing hands | 59 → 35 | 131 → 65 |
| — taken back within 90 days | 23 → 9 | 57 → 20 |
| Starved | 123 → 89 | 125 → 90 |
| Killed in battle | 193 → 170 | 101 → 94 |
| Houses burned | 547 → 469 | 1,334 → 780 |

How often a war ended, per thousand days of it, all fourteen worlds together: under the leaders on
both sides who began it 0.12 → 0.22; once either side had a new leader 2.2 → 4.9. Wars mostly last
over a year, so even before this most ended under somebody new (16 of 18); now a new leader ends
one over twenty times as readily as the one who began it. Cost: thirty minds read once a day for
each pair of neighbouring factions; the bench is unchanged. Test: `test/war.test.mjs`, "Why wars end".

### Peace by marriage, trade deals and tribute (2026-11-19)

TODO item 14d, item 13's leftovers. Before this, peace came from weariness or a new leader and never
from a marriage; a trade deal formed between nearly any two neighbours at peace who liked each other
(in force for 93% of neighbouring pairs at peace, six default worlds, a year); and tribute was a
flat 0.3% of the stores and 1% of the treasury a day, about two thirds of the stores a year,
whoever paid whom.

- **Peace by marriage.** On the day a leader would choose war, one more patient and warm than
  hot-tempered may offer a marriage instead (never a leader of middling nature, up to six times in
  ten the most patient and warmest); and a leader whose war is nearly weary enough for peace may end
  it with one. The other side's leader takes it as they are warm and the bad blood is less. Who
  marries: the leader's youngest free grown child, else a brother or sister, else the leader, else
  the richest free grown-up of the faction, "one of its great families" (Ric: leaders are well off,
  and people married within their standing). The one who is not a leader goes to live on the other
  side. The tie holds while the two are alive and together; while it holds, a leader's wish for war
  against the other side counts half, not nothing; a death or a parting ends it, and it is told. A
  war begun while it holds is a marriage that failed. Kinship between rulers made wars rarer and
  shorter, and the death of the relative who tied them made them likelier again (Benzell and Cooke,
  "A Network of Thrones", AEJ: Applied 2021, https://www.aeaweb.org/research/familial-ties-network-thrones );
  Erasmus: a marriage can make a peace but not make it last. The Treaty of Perpetual Peace (1502)
  married James IV to Margaret Tudor and did not prevent Flodden (1513).
- **Trade deals need trade, both ways.** Every sale by one faction's people in another's village
  (food sold door to door or to the store, goods, wood, stone) adds to a running sum that falls by
  1% a day (about the last hundred days). A deal needs each side's people to have sold half a day's
  food for each of the smaller side's people in the other's villages, and lapses below half that,
  unless the two are old friends. The Hanse's treaties mostly confirmed privileges its merchants
  already used (https://www.historytoday.com/archive/feature/hanseatic-league-europes-first-common-market).
- **Tribute is an agreed amount.** The side taking it is r times as strong (its soldiers and a
  share of its grown-ups, and half its allies'; after a war, times the square root of how many more
  the payer lost). It would win a war with chance r / (1 + r) (a Tullock contest), and the two agree
  on that less an even half, as a share of a year's stores between 5% and 45%: twice as strong, a
  sixth; three times, a quarter. It is paid a little each day, from that day's stores, and from the
  treasury at the same rate as before against the stores. A settlement both sides prefer to the cost
  of a war: Fearon, "Rationalist Explanations for War" (1995), https://www.doi.org/10.1017/S0020818300033324 .

Measured: trade deals in force for 92 of 273 neighbouring pair-months at peace in six default
worlds over a year (34%, from 93%); in twelve worlds of two old enemies over two years, three
marriages: one ended a year's war, one kept two peoples from war for the two years, and one
failed within four months. Leaders have no grown children at the start, so the first marriages
come from the great families. Cost: a sum per sale; a search through the people only on the day a
marriage is made. Not done: everyday marriages still ignore wealth (TODO 15b). (The page's button
for a marriage came with TODO 15.5h: "Wartime gear, and a marriage of your choosing".)

### Government: councils, officials and laws (2026-11-22)

TODO item 15c. Ric (2026-11-20): "the governemnts need to go way deeper"; no office unlocked by
size ("Which ones exist shouldn't be how big the people is unless if that's how it would play
out"); (2026-11-21) headman, collector, judge or peacemaker, captain and governor; paid "All four,
ruler's traits pick"; unfree people "Yes, as proposed", and a faction you rule can keep, free or
forbid them. Setting **Government** under Power: "Councils, officials and laws" (default) or "The
leader alone (as before)", which leaves the world exactly as it was (fingerprinted).

- **Who must agree.** Each faction keeps a council: nobody (the ruler alone), the great families
  (the five richest households), the elders (the five oldest), or everybody (a people who vote,
  as before). Which it is comes from the stats of those who have the say already — the greedy and
  the bold make rank run in families, the patient give it to the old, the bold and hot-tempered
  rule alone (Flannery and Marcus, *The Creation of Inequality*, 2012) — and changes only on a
  clear lean. A ruler's decisions are then half the ruler and half the council's average
  (`ruling`), as an elected leader's already were half the people's. A small council is paid in
  gifts from the treasury's spare coins and the hungry get relief only from an overflowing
  treasury; a people who answer to everybody get relief (Bueno de Mesquita et al., *The Logic of
  Political Survival*, 2003). A council whose members have turned on the ruler puts one of their
  own in (North, Wallis and Weingast, NBER w12795).
- **Officials, from a need.** A **headman** for each village past the three nearest the ruler's
  home (a konohiki, a reeve): without one, its people's loyalty drains. A **collector** once a
  people pass about 480 (the Western Han's one official to about 480 people): without one, the tax
  past what one ruler collects stays in the tills. A **judge** once disputes pass one a day (a
  quarrel, a theft seen, a killing): without one, only that share is heard. A **captain** for a
  war or a held place: a levy musters twice as fast. A **governor** over each people who pay as
  subjects: without one, half the tribute is lost on the way, and a people with one finds it
  harder to stop paying. None is placed by size; bigger peoples have more because they need more.
- **Paid four ways**, picked by the stats of whoever has the say: a wage from the treasury (the
  honest; needs a treasury), a farm — a fixed sum owed, the rest kept, as England's sheriffs (the
  greedy; Pipe Roll Society), land for service, its yield (the bold and cold; the Ottoman timar),
  or unpaid by lot for a year with an audit at its end (the warm, among a people who vote; Athens'
  euthyna). Officials skim by their honesty (more on a farm); an audit at the end of a year makes
  anybody who kept more than a little give half back and lose the office.
- **Laws that outlast a leader**, looked at monthly, changed only on a clear lean: a thief pays
  back twice what was taken (the honest and warm) or is fined to the ruler (the greedy and bold); a
  killing is paid for by the killer's kin to the dead's — a wergild, forty days' bread (early
  English law, 200 shillings for a freeman) — fined, or punished by death (the hot-tempered and
  cold); and whether people may be held unfree (the greedy and bold who are neither warm nor
  honest).
- **Unfree people.** Where the law allows it, a quarter of those who stay in a taken village
  (the less bold) become captives, held by the ruler: their coins beyond a day's go to whoever
  holds them, they never go with founders, and the bold among the wronged run, now and then, to
  the nearest village of another people. A law forbidding it, or a ruler from the page ("Unfree
  people": as the law says, kept, set free, forbidden), frees them all. Domesday counted about one
  in eleven so (25,156 *servi* of 283,242).
- **Carneiro, as things that can happen** (Carneiro, *Science* 1970). When a people's last place
  falls, a winner whose nature leans to tribute (greedy and patient more than hot and bold, and
  more the further it is from home) leaves it its own and takes a share of its stores a year: a
  subject. Otherwise those who will not live under the winner go, with their ruler, to break new
  ground at least 3 km from the winner's villages — where the land has room; sea, hills, marsh and
  other villages close that off, and then they are absorbed as before.
- **Titles**, read off what is held (Ric: "We can show titles that way"): a chief; a king over one
  or two subject peoples; an emperor over three, or over a king. A people who vote have a leader.
  Shown on the Factions tab with the council, officials, how they are paid and the laws.
- Counts: `offices`, `skimmed`, `uncollected`, `audited`, `judged`, `wergild`, `councilCoups`,
  `subjects`, `wayOut`, `bound`, `freed`, `ranFree`. `test/government.test.mjs`.

**Measured** (a year each). Chiefs, 1,200 people on 17 km, three factions: seed 2, 190 starved
against 200 with the leader alone; seed 7, 86 against 115, with two councils turning on their
chief. Under the rule of the rich (800, two old enemies): 15 offices made, 100 coins skimmed, 1
starved against none. A default world (400, vote): one headman and the laws, nothing else needed.
Cost: a sort of one faction's grown-ups once a season for its council; the rest is a few dozen
people a day.

**Left out:** scribes (15e) and priests beyond teaching a faith (15g); debtors bound for debt;
the hemmed-in against open land run of many seeds (said in TODO 15c's "Done when") — measured
for one pair of worlds only (above), not tuned; a governor's subject people keeping its own
customs pulling on the ruler (15a's ways stay its own, since it stays its own faction).

### Soldiers on campaign (2026-11-22)

TODO item 15j. Ric (2026-11-22): "in real like do soldiors choose duty over food and company? if so
how do we change that?" They did not choose: food came to them (rations carried, issued, foraged or
taken), they ate and slept with their fellows, and the way out was desertion. Setting **Soldiers on
campaign** under War: "Live with the army; some desert" (default) or "Come home to eat and sleep
(as before)", which leaves the 15d world exactly as it was (fingerprinted).

- A soldier in an army that is gathering or marching (15h), of a people at war, keeps to duty and
  sleeps where the army lies; their fellows are their company. Only thirst or a wound sends them off.
- **Desertion**, weighed once a day: about a fifth a year for a fed, paid army at war (a French
  estimate, 1700–63; peacetime armies lost 2 to 7% a year — Prussian infantry 1713–40 about 2.1%,
  French 1716–49 4.4%, Saxony 7%; Linch, *J. Social History* 2016, on the British army's 77,696
  desertions 1803–15), three times as likely when hungry, more for each day unpaid, for the
  disloyal and the afraid, for a people losing and for the hired, less under a law that hangs
  killers (15c). A deserter goes home to farm.
- **A 15h bug found on the way:** the road an army is fed by counted as cut by the enemy's own
  soldiers standing at home by their village at its far end, so armies fell back nearly every time
  they marched (30 marches, 29 retreats in a year). Now only enemy soldiers 3 km or more from their
  own places cut it (1 retreat).
- Counts: `deserted`, `campHours`. `test/campaign.test.mjs`.

**Measured** (a year, 600 people, three old enemies, two seeds): battles are still few either way
(2 to 7 dead a year), because item 14's fights are skirmishes where the wounded leave the line;
fed soldiers mostly stayed with the army the old way too (7 of 8 against 8 of 8); the hungry and
unpaid desert six times as often as the fed and paid. **Left out:** deserters caught and punished;
generals and strategy (Ric's coming item stands on this).

### Caravans (2026-11-22)

TODO item 15l. Ric (2026-11-22): "caravans are a yes". Setting **Caravans** under War's neighbours
(on by default; off leaves the 15j world exactly as it was, fingerprinted).

- A village trader looks no further than 34 squares (8.5 km). A **caravan** goes from there to about
  150 km (600 squares): caravans made about 35 km a day, so weeks on the road. It carries what is
  dear for its weight — finished goods, ore and wool, never grain — on pack animals: twice a pack on
  foot, four times with horses (a camel or pack horse about 160 kg).
- Who goes: a trader, or anybody grown, well-off (more than 5 coins) and greedy enough, from their
  own village, at most one caravan from a village every twenty days. It is weighed beside every
  other thing they might do that hour, and goes when it is worth twice the best load to somewhere near.
- Where to: goods to a place whose people have asked for goods (orders waiting) and whose store has
  none, sold to them door to door at a fifth over the store's price; ore and wool to a store that can
  pay. A route already gone **pulls** (a road known, buyers found), up to three times for five trips,
  so routes grow where trade keeps going; the third trip makes news ("Caravans now go regularly …").
- **Robbery:** bandits by its road take half its load to their own place. More caravans on a road,
  more to rob.
- Why the door-to-door sale: village stores almost never have coins (15.5b2's finding), so a caravan
  selling into the store sold nothing; real long-distance merchants sold to whoever wanted their goods.
- **Only in their eras** (Ric, 2026-11-22: "carasvans were only ina few eras anyways right?"): the
  Bronze Age (donkey caravans; the Assyrian merchants' runs to Kanesh, about 1900 BC), antiquity (camels
  from about 1000 BC: the incense routes, the Silk Road), the Middle Ages (the Sahara) and the early
  modern era. Foragers and early farmers pass goods village to village; industrial peoples send them by
  rail and ship. Modern trucks are left out.
- **Living on the road** (Ric: "caravaners dont have homes their truck is their home no?"; chosen: "Live
  on the road"): from a far market a caravaner goes on to the next one worth going to, and home only
  when none is; their family stays in their village (a child no longer walks after a parent gone far).
- **The road is not walked step by step.** A caravan takes its days at 35 km a day (140 squares) and
  is there; bandits whose place lies within 2 km of its line take half its load three times in ten.
  Walked, a 200 km land ran hundreds of times slower (the crossing test took 77 minutes): finding a
  path across 150 km for every step, and children walking 65 km after a caravaner parent. A caravaner
  sets out only with food for the road.
- Counts: `caravans`, `caravanSold`, `caravanFar`, `caravanRobbed`, `caravanOnward`, `caravansHome`; test hooks `w.routes()`,
  `w.caravanRoute(pid, vid)`. `test/caravans.test.mjs`.

**Measured** (60 days, 1,500 people on 60 km, 36 places, medieval): 43 caravans, 92 goods sold beyond
a trader's reach, 33 routes. A 200 km land runs a day in about the time it did before caravans. Before letting the well-off run them,
none went: that land had no traders and no crafters at all. **Left out:** pirates on boat routes (15r);
caravanserais and fairs; robbery measured against trade over years.

### Sickness in armies (2026-11-22)

TODO item 15m, from 15k's research. Before the 20th century sickness killed more soldiers than the
enemy: about four to one in the Napoleonic wars, two to one in the American Civil War, seven to one in
the Spanish–American War (Montana State on Napoleon; the National Museum of Health and Medicine;
PubMed 18192771); in the Thirty Years' War most of the dead were civilians, of hunger and of sickness
spread by troops and refugees. Setting **Sickness in armies** under War (on by default; off leaves
the 15l world exactly as it was, fingerprinted).

- An army gathering or marching (15h, 15j) is a **camp**: a crowd with no wells or latrines, half as
  foul as it can be at 150 soldiers (a town needs 2,000, 15.5r). Its foulness makes the sickness pass
  more readily between soldiers who talk, as a town's foul water does.
- **Camp fever**: each soldier with the army catches a fever about one day in a hundred, more as the
  camp grows (at any time about a fifth of Wellington's Peninsular army was sick: with a week's
  illness, near three in a hundred a day). Dysentery and typhus are not the village's sickness, so
  having had that is no shield. It kills about three times as many of those who catch it as a
  village fever (about one in ten).
- **Carried**: a sick soldier on campaign within 750 m of a place not their home leaves it there one
  day in twenty, whoever there has had the village's sickness; from there it passes by talk as any
  sickness does. A fever breaking out in an army is news (at most once a month for a people).
- Counts: `campDays` (soldier-days with an army), `campOutbreaks`, `armySpread`, `soldierSick`
  (soldiers dead of sickness); hooks `w.campSickness(fid)`, `w.campFoulOf(p)`. `test/armysick.test.mjs`.

**Measured** (a year, 600 people, three old enemies, four seeds): soldiers dead of sickness 30 against
8 killed in battle, about four to one (off: about 6 against 10); 2 to 14 places a year caught it from
an army; 4 to 12 fewer people alive at the year's end. **Left out:** refugees carrying it on purpose
(they carry it now only as anybody does, by talk); camp hygiene by era (Roman latrines, modern medicine
beyond the one `medicine` factor).

### Bows, armour and chariots (2026-11-22)

TODO item 15n, from 15k's research (Ric: "your leaving out wars from like the 1200s. or 1000bc and
those eras and technologies"). Setting **Bows, armour and chariots** under War: "By era" (default) or
"Hand weapons alone (as before)", which leaves the 15m world exactly as it was (fingerprinted).

- **Who shoots.** Before guns a share of every army draws a bow, fixed by who they are (a hash of
  their id): foragers half, early farmers three in ten, the Bronze Age two in five, antiquity a
  quarter, the Middle Ages two in five (Crecy about half, Agincourt nearly four in five, the English
  extreme; the other shares are guesses). With gunpowder nobody does (15d's muskets).
- **Which bow** (Dupuy's lethality, 1980, against a sword's 23): a simple bow (19) for foragers and
  early farmers, the composite bow (between; a guess) in the Bronze Age and antiquity, in the Middle
  Ages the crossbow (33) or, for a hard-working people (mean `hard` over 0.55, the lifelong practice
  it took), the longbow (36). A bow reaches 1.2 to 1.5 squares where a hand weapon reaches 0.8.
- **Armour**, a piece of gear (cost 6 goods: a horseman's body armour was worth about twelve oxen),
  bought by the soldier out of their own purse after a winter's bread, never by the treasury, of hide
  among early peoples and of iron after: so the well-off are armoured and the levy is not. What it
  stops, of a blow and of an arrow: padded coats 20% and 25%; bronze scale 30% and 30%; mail over
  padding 45% and 50%; plate (Middle Ages, early modern) 60% and 80% (mail alone did not stop arrows,
  mail over a padded coat greatly cut the risk, plate was nearly arrow-proof by the late 1400s:
  *Journal of Medieval Military History*; ACOUP's armour myths). A bullet: less than half a blow's.
  It wears slowly where it is struck.
- **Chariots**: in the Bronze Age one soldier in ten is a chariot archer (Kadesh, about 1274 BC: 5,000
  to 6,000 chariots, platforms for archers and javelin men): a steadier shot (a fifth harder, a
  little further) and harder to hit (30% less).
- Count `armoured`; hooks `w.bowFor(p)`, `w.armourOf(fid)`, `w.strike(p, foe, base, shot)`,
  `w.outfit(p, vid)`, `w.chariot(p)`. Armour is left out of the "go and buy gear" choice, so a poor
  soldier does not keep walking to the shop for armour they cannot afford. `test/oldarms.test.mjs`.

**Measured** (a year of medieval war, 600 people, three old enemies, three seeds): 32 to 50 pieces
of armour bought; wounds 473 against 512 and battle dead 7 against 9 with hand weapons alone; item
14's skirmishes stay small either way. In one blow test: a blow 0.37 of a life, on plate 0.15; an
arrow 0.37, on plate 0.075. **Left out:** horses and horse archers (15o), volleys and formations,
armour's weight slowing its wearer.

### Generals and strategy (2026-11-22)

TODO item 15o, Ric's own item, with 15k's gaps 2, 3, 4 and 14 in it. Ric (2026-11-22): who leads
"Captain, else leader"; strategies "All five"; skill "Nature + experience". Setting **Generals** under
War: "Led, scouted, and they break" (default) or "No general (as before)", which leaves the 15n world
exactly as it was (fingerprinted).

- **Who leads.** The captain (15c) if the people has one; the leader if not, or if the leader is bold
  (over 0.75) and goes in person.
- **Skill**: from the general's nature (patient, curious, bold) and five points in a hundred for each
  battle seen, up to eight. A battle "seen" is a rout on either side.
- **What they know** (15k gap 3: commanders knew the enemy from scouts, slowly and often wrongly;
  Trasimene was a march into an unscouted valley; ACOUP on reports). Each day a general learns how
  strongly an enemy place is held only if one of their soldiers is within 2 km of it (5 km for a
  horseman) or one of their own places within 3 km; what is learned is off by up to half, less the
  more skilled the general; a place nobody has seen is guessed from its size. Before, 15h's map saw
  every soldier of every side exactly.
- **The plan**, chosen when the army is first raised, with each new general, monthly, and at once
  when a waiting army's enemy marches. Each is scored from the general's nature and the strength they
  believe each side has:
  - *seek a battle* (the bold, the skilled, the stronger): the army marches on the enemy place where
    their soldiers are, not away from them;
  - *raid and burn* (the greedy and hot-tempered, the weaker): the army goes out as raiding bands
    (14e) instead of marching on a place;
  - *besiege* (the patient, the much stronger): 15h's choice, the place worth most against what holds it;
  - *wait and wear them down* (the patient and timid, the weaker): the army stays gathered at home;
  - *lie in wait* (the curious and skilled, when the enemy is on the road): the army goes to a point
    two-thirds along the enemy's road and waits there; enemies caught marching take half again as
    much from each blow.
  A change of plan is news ("…, at the head of …'s army, lays siege").
- **Morale, rout and pursuit** (15k gaps 2 and 17: a formation that held lost a few in a hundred; most
  of a battle's dead fell when one side broke and was pursued; Krentz; ACOUP on morale and cohesion;
  Howard on pursuit). Every soldier knocked out of the line is a shock to their army that halves in
  six hours; when the shock passes 10 to 30% of what marched (more for a skilled general and a loyal,
  fed people) the army **breaks**: every soldier of it runs home for a day and fights nobody, the
  wounded among them are no longer let go, and blows on the running do three times the harm, four
  from a horseman. Then it gathers again. Both generals learn.
- **Horsemen** (15k gap 4): where a people has horses (by its era, or held know-how, 15d, 15e), about
  one soldier in seven rides: they see further as scouts and are deadliest in pursuit.
- **Horse archers** (15k gap 14): a horseman of a herding people that does not farm (15i) shoots from
  the saddle (a reach of 1.6, a fifth harder than a sword) and is harder to hit (30% less), as the
  Mongols swarmed, shot and drew back.
- Counts `routs`, `pursuitDead`, `plans`, `ambushes`; hooks `w.generalOf`, `w.skillOf`, `w.planOf`,
  `w.choosePlan`, `w.scout`, `w.intelOf`, `w.rout`, `w.routing`, `w.horseman`, `w.horseArcher`,
  `w.battlesOf`. `test/generals.test.mjs`.
- Found on the way: `knows()` says yes to everything before a people's first count of know-how, so
  15l's caravans loaded horses' weight for early farmers; both now ask `has()`.

**Measured** (a year of medieval war, 600 people, three old enemies): battle dead 13 to 22 a world
against 1 to 4 without generals; 5 to 16 routs; about half the battle dead (27 of 53) fell running;
plans changed 8 to 21 times; 0 to 11 ambushes. War is far more decisive, as Ric's coming wars need.
**Left out:** deserters and prisoners as a source of news (prisoners are 15q); screening (horsemen
keeping the enemy's scouts off); formations; a general's own death in battle mattering more.

### Siegecraft and service (2026-11-22)

TODO item 15p, from 15k's gaps 15 and 16. Setting **Siegecraft and service** under War: "By era"
(default) or "Numbers alone (as before)", which leaves the 15o world exactly as it was (fingerprinted).

- **Engines.** Three or more besiegers at a walled place work at breaking its wall, which takes, by
  the besiegers' era: early farmers 40 days (ramps and mining by hand), the Bronze Age 25 (the
  Assyrian ramp and ram; Lachish's ramp of some three million stones), antiquity 20, the Middle Ages
  25 (the trebuchet, first in England at Dover in 1216-17, and mining), early modern 8 (cannon),
  later 3 or 4. What is broken no longer counts in the defence or in how long the place holds out;
  it is mended a twentieth a day once they have gone. A wall half broken is news. (English Heritage
  and World History Encyclopedia on medieval siege warfare; Hebrew University on Lachish.)
- **Starving a place out**, the slow last resort (Kenilworth, 1266, held nearly six months): a place
  with more enemy soldiers at its edge than its own for a fortnight, its store under a third of a
  day's food a head, and half its grown-ups hungry, gives itself up to the besiegers.
- **Feudal service** (the Middle Ages): a soldier owes forty days a year with the army (knight-service);
  then they go home to farm and are not called again that year, so a feudal army melts away when its
  service ends. Somebody well-off (over 40 coins) and not bold who has not yet served may pay scutage
  (10 coins) into the treasury instead, which 15h's hiring spends on soldiers who serve as long as they
  are paid. Hired soldiers owe no days.
- **A paid standing army** (antiquity, Rome): no days owed; it digs a fortified camp every night, so
  it is not caught on the march by an ambush (15o) and its camp, with latrines, is half as foul (15m).
- Other eras keep the levy as before.
- Counts `breached`, `starvedOut`, `serviceEnded`, `scutage`; village fields `breach`, `blockade`;
  hooks `w.siegeWorks(vid, fid, attackers, ours)`, `w.serviceOf`, `w.service`, `w.servedOut`.
  `test/siege.test.mjs`.

**Measured** (a year, 600 people, three old enemies, two seeds): medieval, 50 and 61 of the levy went
home after their forty days and 5 and 7 paid scutage; soldier-days with an army fell from about 4,300
to 2,350; captures 3 and 0 against 1 and 0. Ancient, a wall was broken once in each world. No place
was starved out in these years: villages flee or fall to numbers first. **Left out:** engineers and
prisoners building ramps; countermining; the 1200s' shift from forty days to paid foot soldiers.

### Prisoners, mutiny and war loans (2026-11-22)

TODO item 15q, from 15k's gaps 5, 6 and 7. Setting **Prisoners, mutiny and war loans** under War:
"Taken, ransomed, borrowed for" (default) or "None of it (as before)", which leaves the 15p world
exactly as it was (fingerprinted).

- **Prisoners.** A soldier knocked out of the line by a blow may be taken: about one in seven, one in
  two if their army has broken (15o). They are kept at the captor's nearest place, fed from its store,
  and nobody fights them. In the Hundred Years' War captives of every rank were ransomed by contract,
  a living for common soldiers too, financed by kin and merchants (Ambuhl, *Prisoners of War in the
  Hundred Years War*, 2013; set scales from Agincourt on).
- **Ransom**: after ten days (word sent, terms agreed), 5 coins and half of what the prisoner and their
  parents are worth, 60 more for a leader and 20 for an official; paid out of the prisoner's purse and
  their household's, or by their people's treasury for a leader or an official. Seven-tenths go to
  the soldier who took them, the rest to the captor's treasury. A ransomed prisoner goes home to farm,
  on their word not to fight again in this war.
- **Unransomed** after two months: exchanged if the other side holds one of the captor's people;
  otherwise killed where the captor's ruler is hot-tempered and dishonest (`ruling` over 0.65 and under
  0.4), else let go.
- **Mutiny** (the Army of Flanders, unpaid after Spain's bankruptcy of 1575, sacked Antwerp in 1576;
  garrisons held forts as security for arrears): when two in five of a people's soldiers, and at least
  four, have gone five days unpaid, they rise together at their place, take what they are owed from its
  till and the people's grain there, and hold it, marching nowhere, until the treasury pays the rest;
  after a month unpaid they scatter, the poor to banditry (15.5b4).
- **War loans** (Slantchev, *Borrowed Power*: borrowing lets wars start, last longer and end harder; a
  default leaves armies unpaid). A people at war with less than a fortnight's wages in its treasury
  borrows from the ten richest grown-ups of its own and of peoples not at war with it, a third of each
  one's coins, up to twice its number of people in coins (halved for each default), and owes about a
  tenth a year in interest, paid to the lenders. At peace with more than a fortnight's wages it repays
  a fiftieth a day. Owing three times its credit, or two months behind with its interest, it
  **defaults**: the lenders lose it all, its treasury is empty (the soldiers go unpaid, so they may
  rise), and nobody lends to it for three years. No coin is made: a loan is coins moved from lenders.
- Counts `prisoners`, `ransomed`, `ransomCoins`, `exchanged`, `prisonersKilled`, `released`,
  `mutinies`, `mutinyTook`, `borrowed`, `repaid`, `defaults`; hooks `w.takePrisoner`, `w.held`,
  `w.ransoms`, `w.mutinyDay`, `w.borrow`, `w.debtOf`. `test/spoils.test.mjs`.

**Measured** (a year of war, 600 people, three old enemies, two seeds, before the ten days' wait was
added): 31 to 79 prisoners, nearly all ransomed, 700 to 1,700 coins in ransoms; 0 to 5 mutinies; about
800 to 1,170 coins borrowed; no default within a year. **Left out:** merchants lending against
ransoms; prisoners as a source of news for generals (15o); a ruler's own ransom ending a war.

### Wounds, small wars and the sea (2026-11-22)

TODO item 15r, from 15k's gaps 8, 9 and 10. Setting **Wounds, small wars and the sea** under War: "As
found" (default) or "As before", which leaves the 15q world exactly as it was (fingerprinted).

- **Calibrated 2026-11-22** (with "Armies that meet"): one in five of *every* knock out of the line
  dying later killed 5 to 9% of a warring people a year (soldiers were knocked out 160 to 290 times a
  year, many again and again; nearly all the battle dead were these). Now only a severe wound (life
  left under a quarter) can kill later, the worse the likelier, up to three in five; a light knock
  never. Battle dead in a year of old enemies: 3 to 13 among 600.
- **Wounds measured** (15k gap 8: in 18th- and 19th-century battles about three or four were wounded
  for each killed, and many of the wounded died later; Encyclopedia.com's casualty figures; ACOUP).
  Measured first: in a year of medieval war about five or six soldiers were knocked out of the line
  for each killed outright, and none of the knocked-out died of it later. Now one in five of those
  knocked out dies of the wound within ten days, fewer with healing herbs (four-fifths), a healer at
  work in their village (seven-tenths) or medicine (three-tenths). Measured after: about 3.2 wounded
  survivors to each dead (4.0 and 2.3 in two worlds), 12 to 14 a year dying of wounds. Counts
  `knockedOut`, `diedOfWounds`.
- **War between bands** (15k gap 9: among foragers and tribes war was raids and ambushes, not
  battles; Keeley; the later counts in Our World in Data, about 2% of deaths for bands and 8 to 9% for
  chiefdoms). A people that does not farm (15i) raises no army and lays no siege: its plan is always
  to raid (14e's raiding bands, two in three of its fighters).
- **War at sea** (15k gap 10: medieval naval war was coastal — landings, supplying armies, blockading
  ports, and piracy, the first reason warships were built in the north). A boat's cargo is robbed only
  by **pirates**, bandits of a place with a boat, from up to 1 km (a cart: 500 m); nobody on the shore
  robs a boat. A port is **shut** while a place of an enemy at war with a boat is within 10 km: its
  boats carry no grain (counted `blockaded`), so it goes by cart. Counts `piracy`, `blockaded`.
- Hooks `w.dying(p)`, `w.woundDeaths()`, `w.bandAtWar(fid)`, `w.blockaded(vid)`, `w.waylay(q, p, ux,
  uy, step)`. `test/smallwar.test.mjs`.

**Left out:** landings (armies carried by boat); warships and sea battles; pirates of their own (they
are 15.5b4's bandits with a boat at home); measuring band war's deaths against the 2% found.

### Working harder at war (2026-11-22)

TODO item 15.5i1 (Ric, choosing from 15.5i's measurements: "Work at war"). Setting **Working harder at
war** under War (on by default; off leaves the 15r world exactly as it was, fingerprinted).

- **Measured first:** among grown-ups who are not soldiers, at midday in the same months, 58% were at
  work at war and 58% at peace (three seeds, old enemies, with and without wars); 14a's wartime push
  (provide a fifth more, rest a little less) was there but showed nothing. A snapshot at midday also
  hid the length of the day.
- **Now** each village counts its grown-ups away with the army (`v.away`, soldiers more than 1 km
  beyond its edge) and those left at home feel the slack — the share gone against those left, up to
  0.6 — wanting to provide up to three times that more and resting less, as wives, the old and the
  young took over the fields.
- **Measured after** (work hours a day of grown-ups not soldiers, the second half of a year of war,
  three seeds): 6.46 against 6.26 off (+3%; 6.71 against 6.20 on one seed, the same on another). Small,
  because an army is about a tenth of a people and not all of it away at once, and people already
  work most of the light; harvests unchanged.
- Hook `w.slackOf(p)`; `test/homefront.test.mjs`.

### Quarrels between villages (2026-11-22)

TODO item 15.5i2 (Ric, choosing from 15.5i: "Quarrels between villages"). Setting **Quarrels between
villages** under War (on by default; off leaves the 15.5i1 world exactly as it was, fingerprinted).

- **Measured first:** in seven worlds every quarrel (55 to 232 a world) was between neighbours of one
  village: the hot-tempered went looking only for somebody of their own village they could not stand
  (item 10), so a grudge against a thief, a robber or a rival of the next village never came out.
- **Now** a grudge deeper than -0.5 against somebody of another village, not of a people at war with
  theirs, may be had out too: when that person is within 1 km (met at market or the fields' edge), or
  their village is within 5 km and they go to find them. The same weighing as any quarrel (temper,
  patience, the walk, hunger, tiredness).
- **Measured after** (a year, two default seeds and one of old enemies): 2 to 4 quarrels between
  villages a world against 44 to 66 within, fights alike either way. Few, because grudges against
  people of other villages are few.
- `test/feuds.test.mjs`.

### Roads built on purpose (2026-11-22)

TODO item 15.5i3 (Ric, choosing from 15.5i: "Roads built on purpose"). Setting **Roads built on
purpose** under War (on by default; off leaves the 15.5i2 world exactly as it
was, fingerprinted).

- **Before:** roads only wore in where people walked most (7d), and wore away again.
- **Now** once a year, at peace, a people chooses the way most walked — the straight line between two
  of its places within 10 km, or along a caravan route of its own gone three times or more (15l) —
  that is not a road yet and has no deep water across it, and builds it: a crew does a kilometre (four
  squares) a day. The ruler pays the crew two coins a square into the nearest village's till; with no
  coins in the treasury the work is levied and the village store feeds the crew (a day's food for four
  a square). Work stops while the people is at war. A square built stays a road however little it is
  walked; walking on it is as fast as on any road. Roman roads were built by soldiers and levied
  labour for the state; medieval ones were kept up by levies on the places they served.
- Counts `roadsBegun`, `roadsBuilt`, `roadSquares`, `roadPaid`, `roadLevied`; hooks `w.roadDay`,
  `w.roadJob`, `w.builtRoad`. `test/roadwork.test.mjs`.

**Measured** (400 days, two default seeds): 4 roads (50 squares) in one, nearly all levied
(treasuries are almost always empty, 15.5b2's finding); none in the other, at war most of the time.
**Left out:** keeping roads up (built ones never decay), bridges on built roads (15.5i4), tolls.

### Fishing boats and road bridges (2026-11-22)

TODO item 15.5i4 (Ric, choosing from 15.5i: "Water: boats and bridges"). Setting **Fishing boats and
road bridges** under War (on by default; off leaves the 15.5i3 world exactly as it was, fingerprinted).

- **Measured first:** rivers that cannot be waded are only on lands of about 100 km and up, and few
  (87 to 184 squares of 160,000); where a village sits beside one it does bridge it (three in sixty
  days on one land), but everywhere else every river is waded, so no bridge is ever wanted. A boat was
  wanted only by people who could not walk round water to where they were going, or for a grain
  cargo, and on these coasts neither happened: no village anywhere built one, though a tenth of the
  land is sea.
- **Now** a village with a landing on the sea, a lake or a big river whose people have been out
  fishing thirty times wants a boat, the more the more they fish (up to as much again as a bridge),
  and its fishers catch a third more from it, further out. With a boat, grain may go by water as it
  could since 15.5b1. A road built on purpose (15.5i3) across a stream bridges it, and the news says so.
- Village field `fishTrips`; count `roadBridges`. `test/waterwork.test.mjs`.
- Found on the way: counting the fisher's job was the wrong measure; fishing is mostly done on the side
  by farmers and hunters, and no village had two fishers.

**Measured** (a year, default lands): 4 to 6 boats a world; 2 road bridges in the one world that built
roads; fish caught about the same. No grain went by boat in a year: grain trade between villages with
boats is still rare. People alive at the year's end varied with which worlds fell into wars (battle
dead 61 against 31, 20 against 0), not with the boats. **Left out:** coastal trade of goods by boat
(caravans by sea), boats lost at sea while fishing.

### Armies that meet (2026-11-22)

Ric (2026-11-22): "do the peoplle at war just run past each other to go to the cities?" They did: a
soldier noticed an enemy only within 750 m, armies marched straight at the place they meant to take,
and nothing sent an army to meet another or to relieve a place of its own. Ric: "Yes, add both".
Setting **Armies meet** under War (on by default; off leaves the 15.5i4 world exactly as it was,
fingerprinted).

- **Relief.** Once a day, with the campaign (15h): a place of a people's own under siege (a siege
  begun, three or more of them at it; a raid at its edge is not enough) is relieved — its army goes
  there — when the odds are clearly good: half as many again as its ruler's nerve asks. Most battles of
  the past came out of a raid met or a siege relieved (15k's research).
- **Armies seen.** An enemy army on the march (its soldiers away from their own places) is seen when
  within 5 km of a soldier or a place of the people, 10 km of a horseman (15o). It is met only when it
  is coming for one of the people's places, and only if the numbers suit the ruler's nature — about
  1.3 of ours to each of theirs, fewer for the bold, more for the patient (commanders avoided pitched
  battle unless the odds were good: Vegetius); otherwise it is kept clear of.
- The army goes to the meeting point as to an ambush point (15o); it fights whatever it finds there
  (soldiers still strike only within reach). A new meeting is news.
- Counts `armiesSeen`, `armyMeets`, `armyAvoided`, `reliefs`; hook `w.meeting(fid, oid)`.
  `test/meeting.test.mjs`.

**Measured** (a year, 600 people, three old enemies, three seeds). First built, it met every army seen
and relieved every place with three enemies at its edge: 22 to 44 relief marches a year and 32 to 56
battle dead among 600 people. Ric asked "is that more realistic?": the where was, the how much was not —
5 to 9% of a people dead in battle a year, against about 0.5% for the most warlike societies on record.
Tuned as above, and with 15r's dying of wounds put right (below): armies met 0 to 6 times a year, kept
clear of 7 to 72 sightings, sieges relieved up to 8 times; battle dead 3, 5 and 13 (0.5 to 2% of the
people); places taken 1 to 2. **Left out:** an army seen but
not met falling back from a stronger one; an army caught on the march by one that met it head on
gets no surprise (only a lying in wait does, 15o).

### Armies spread out, and the deadliness slider (2026-11-22)

Ric (2026-11-22): "and this changes per era correct? and there is a slider to make them more
dangerous", then "Yes, fix both". Measured first (a year of old enemies, one world an era): deaths rose
with the era, but industrial and modern war killed 56 of 600 a year (9%, beyond even the worst real
wars: Serbia lost about 4% a year in 1914–18, mostly to sickness, France about 1% in battle), and the
slider "How deadly a fight is" moved deaths from 25 to 27 between 1 and 3.

- **Armies spread out** (setting under War, on by default; off is the world before, and the default
  world of early farmers is the same either way). Dupuy's dispersion: the ground held by a hundred
  thousand men grew from about 1 km² in antiquity to 20 under Napoleon, 250 in 1914 and 3,000 in
  1939–45, so losses a day fell even as weapons grew deadlier. A blow now lands 70% as often with
  muskets, 35% with rifles, 20% with machine guns. And a gun's greater power is more hits, not a harder
  one: no single blow is more than one and a half times a sword's; the rest of its `hit` goes into how
  often blows land (before, a machine gun's one hit did two and a half times a sword's harm, so nearly
  every hit killed).
- **The slider** now makes each blow harder too (×0.6 + 0.4 × the slider: 1 at the default, so nothing
  changes there) and a severe wound likelier to kill later (by its square root, up to 1.6 times).
  Measured, medieval: 4, 25 and 40 battle dead a year at 0.3, 1 and 3 (it was 11, 25, 27).
- Hook `w.blowOf(fid, deadly)`; `test/dispersion.test.mjs`.

**Measured after** (a year of old enemies, 600 people, three worlds an era; battle dead a year):
early farmers 13, 19, 3 (mean 2.0% of the people); Bronze Age 11, 16, 17 (2.4%); ancient 13, 20, 17
(2.8%); medieval 25, 20, 15 (3.3%); early modern 14, 8, 17 (2.2%); industrial 24, 10, 16 (2.8%);
modern 28, 19, 31 (4.3%). Rising with the era, but all still above the about 0.5 to 1% a year of the
most warlike societies on record: three old enemies at war all year round in a small land is the
worst case, and the gap is open (see TODO).

### Parole, deserters and the books (2026-11-23)

TODO item 15.5u. Ric (2026-11-23): "there are a few bugs that need to be added in", pasting an outside
review; then, of deserters and the unfree, "this should be dependednt on the leaders". Setting
"Parole, deserters and the books" under War ("As each leader decides" by default; "As before" is the
world before, fingerprinted).

- **Spare food and spare coins.** `stats` set `v.spare` to food held above what people keep back;
  `workDay` set it again to spare coins a household. Whichever ran last won, so grain carts and riots
  sometimes read coins and a workplace's pay sometimes read food. Now `v.spare` is food and
  `v.spareCoins` is coins.
- **Parole.** A prisoner let go (ransomed, exchanged or released) gave their word not to fight again,
  and nothing remembered it. `PAROLE` (beside the people, not a field on them) keeps the people they
  gave it to; no levy or hiring takes them while that war lasts.
- **A default pays the lenders.** A people that could not pay its war loans set its treasury to
  nothing and paid nobody: coins left the world (seen in ordinary play, 115 coins on one day of
  "Too many people", seed 4). What is left now goes to the lenders by what each was owed.
- **Deserters, as the leader decides.** A forgiving leader (warm, or slow to anger) takes them back
  when the army is short; a hard one (hot-tempered and cold, or under a law of death for killing)
  has them caught and fined, beaten or, where the law is death, killed, and keeps them out of the army
  for the war; one in between lets them be until the war is over. Armies did all three.
- **The unfree.** Kept out of the levy, as hiring already kept them out. A leader whose army is badly
  short (under half of what it wants) arms them, the bold and the ruthless sooner, and the warm and
  the honest free them for it (Rome's *volones* after Cannae, 216 BC). Armed and not freed, they desert
  twice as readily.
- `test/warbooks.test.mjs`.

### War by what a people knows (2026-11-23)

TODO item 15.6. Ric (2026-11-23): "the weapons and how people fite and the stategies … all by era. and
the technology and era need to be coorilated and technology and weaponry should be coorilated." Setting
"What war follows" ("What each people knows and can pay for"; "By era label (as before)" is the world
before in every era). A default world — early farmers, eras standing still — is byte for byte the
world it was either way, because an early people that has found nothing has exactly the early kit.

**War know-how** is a second list beside the first (`WAR_TECH`), found, passed on, written down and
lost like any other technique (15e), but mostly by smiths and soldiers, three times as often at war,
and only where eras move on by themselves. Each needs what came before (research notes in TODO 15.6):
bronze casting (smithing) → the war chariot (carts, bronze) and the composite bow (bronze); steel (iron,
the mill) → the crossbow; the stirrup (horses, smithing); cannon (gunpowder, iron); drill and volley
fire (gunpowder, writing; taught, not seen); the bayonet (gunpowder, steel); rifled breech-loaders
(steel, steam); high explosives (gunpowder, steam); the machine gun (rifling, steam); motor lorries
(the engine); the tank (lorries, steel, machine gun); the aeroplane (engine, steel); and past the
Second World War (Ric: "Go past WWII") the jet engine, the helicopter and guided weapons. Each era
starts with what it really had. It is kept in its own word of bits because the first list's 32 would
overrun; who holds any is kept beside the people (`WK`), as rare state is. A people fights with a
piece once one in twenty of them holds it.

**The kit** (`kitOf`), worked out once a day for each people, is everything war read off the era:
- the weapon (hand, bronze, iron, steel, musket, rifle, machine gun), the bow and how many shoot (half
  of a people that does not farm, three in ten of one that does, four with composite bows or
  crossbows, a quarter of a paid army with iron), chariots (with the chariot and no riding), horses
  and the stirrup;
- armour, weighed against what the enemy carries: the best a people can make (padding, bronze scale,
  mail, plate), dropped against rifles and back as steel helmets — not bought where it does not pay;
- how an army is raised, from government and treasury (ACOUP, "Pre-Modern Armies for
  Worldbuilders"): a levy where nothing is written; owed service where writing meets land held by the
  leader or great families with the say; paid where the treasury holds a month's wages, kept while it
  holds a week's;
- the fighting season (none once rail or lorries can carry an army through winter), the standing army
  and the most called for a season, and how many soldiers a unit holds (15.6b);
- siege work: days under a wall to break it (40 by hand, 25 with bronze, 20 with iron and writing, 8
  with cannon, 4 with high explosives, 3 with tanks), and gunpowder without cannon mines a wall in
  half the time and blows it, with those on it.

**Walls answer the guns** (Parker 1976, the trace italienne). A wall's worth is the wall's (what its
builders could raise: 1 by hand, 1.2 with bronze, 1.4 with iron and writing) and the guns' brought
against it: cannon take 43% off a high wall, exploding shells 70%, tanks and bombers half again. A
people facing cannon, with its wall up and danger near, builds a low, thick wall of stone over twice
the days; that stands cannon whole and keeps half against shells. The worths the era table gave
(0.8 early modern, 0.4 industrial, 0.2 modern) come out of this arithmetic.

`test/warknow.test.mjs`.

### Blasts (2026-11-23)

TODO 15.6 step 6. Ric (2026-11-23): "what about bombs?", then "Yes, add them". Before, every blow was one
soldier striking one other. A blast (`blast`) hurts everybody within its reach, more the nearer, soldier
or not — a civilian killed counts among the war's dead (14b) — breaks a wall it falls on, burns houses
under it and blows a bridge. Where they come from, all from what a people knows:
- **Grenades:** a blow in close fighting is sometimes one, one in sixty with gunpowder, one in twenty
  with explosives; it hurts all within 3 m (6 m with explosives).
- **Guns:** one for every forty soldiers, bought from a village's smiths by the treasury (30 coins,
  goods and iron; no coin made or lost). In battle each fires every hour at the nearest enemy unit
  within reach (1 km for cannon, 2 km for shells, 5 km for rifled artillery), scattered more by a poor
  general's gunners; solid shot ploughs a line through a close rank, an exploding shell hurts all
  within 15 m. At a siege they fire into the place, a couple a gun a day. Half are lost when an army
  breaks, and the winner takes what it can use.
- **Mines:** an army holding ground for six hours with explosives lays a few in front of it.
- **Demolition:** an army that breaks with explosives blows a bridge of its own behind it. A blown
  bridge can be waded where it stood at a ford's pace, and its village may build it again.
- **Left in the ground:** about one shell in five did not go off in the First World War (the estimates
  run from a fifth to nearly a third: [CWGC](https://admin.cwgc.org/our-work/news/the-iron-harvest-a-warning-from-history/);
  [Military History](https://www.military-history.org/behind-the-image/behind-the-image-the-iron-harvest-on-the-western-front.htm);
  [Scientific American, 1915](https://www.scientificamerican.com/blog/anecdotes-from-the-archive/clearing-explosives-1915/));
  one in ten here once a people has aircraft, three in a hundred with guided weapons, and half that for
  bombs. They lie where they fell (`LEFT`) until somebody stands on them — one chance in twenty a day
  for each person within 25 m — or a people that knows explosives clears them from its own land at
  peace, about half in two years. Around Ypres alone such shells have killed 260 people since 1918
  ([Iron harvest](https://en.wikipedia.org/wiki/Iron_harvest)); the Landmine Monitor still records
  thousands of casualties a year ([2023](https://www.the-monitor.org/en-gb/reports/2023/landmine-monitor-2023/major-findings.aspx)).
  Nothing places one that a war did not leave.

### Where soldiers stand (2026-11-23)

TODO item 15.6b. Ric (2026-11-23): "what abuout actual. strategicplacement of the people?"; "having a
comander and the ranks but again equivilant to the weapons and eras"; drawing "a yes but make it a
toggle". Setting "Where soldiers stand" ("Units in formation, on ground the general chooses"; "Every
soldier for the nearest enemy (as before)" is the world before). Research notes are in TODO 15.6b.

- **An army in the field forms units** once a day while it is not fighting (`formArmy`): its horsemen
  in two wings, the rest in units of as many as orders reach — about 150 by voice and standard, 100
  with writing, drums and riders, 60 under a captain with the telegraph, 12 with radio (van Creveld,
  *Command in War*). With three or more, the last is the reserve.
- **Each unit has an officer**, a real person chosen as the people choose (ACOUP on officers; the sale
  of British commissions, 1683–1871): by vote where the people votes, bought where the rich rule (5
  coins to the treasury), by service and skill in a paid army, else birth and wealth. An officer lost
  leaves the unit slower to answer and nearer breaking until a sergeant steps up two hours later.
- **The way of fighting is a unit's shape**, chosen by the general by nature and skill against what
  they know the enemy carries (`chooseShape`), never by era: a shield wall or a deep block of spears
  (against horse) or loose order before guns; pikes guarding shot with muskets and no bayonets; a
  firing line where a paid army has drilled, or a column a bold general sends; open order, dug in,
  with rifles; small units spread out with radio. Each shape is how deep it stands, how far apart its
  files are (Dupuy: about 10 m² a soldier in antiquity, 250 m² from the 1650s to 1871, 27,500 m² in
  1939–45), which ranks strike, whether it stops a charge, and what is left of shots at it once dug in.
- **Each soldier holds a place**, walked to the last metre, instead of running at the nearest enemy;
  only the ranks that strike in that shape strike (archers always shoot, guns fire from the first three
  ranks).
- **The general chooses the ground** where the army stands to meet an enemy or lie in wait
  (`chooseGround`): height over the way the enemy comes, a river or marsh in front, a wood for cover
  (not for horse), open ground for horse; a poor general reads it worse. In a blow, striking uphill or
  crossing water lands less often, and shots into a wood far less (Dupuy's terrain and posture factors
  were not found in numbers; these are guesses and said so).
- **Flanks, rear and reserve.** Horse on the wings; with the stirrup and a bold general, they ride
  round to the enemy's side and rear. A blow from the side lands half as hard again and from behind
  twice as hard, and shakes the unit more. The reserve goes where a unit of the line is losing.
- **Cohesion** falls on the move, more through woods, marshes and rivers and in a charge, and with
  losses; it comes back standing still, and blows are harder from a unit that holds together.
- **Breaking.** A unit holds while its losses are under what its morale bears; then, if it has kept
  together and its officer stands, it withdraws in order and is not hunted, else it breaks and runs
  and is cut down (most of a battle's dead: Krentz; ACOUP). When half an army's units have gone, the
  army breaks (`rout`).
- **Night.** An attacker draws off 600 m for the night, out of reach of a bow or a musket.
- The page draws units when zoomed in with **Units** on: an outline in its people's colour, a tick for
  its facing, a diamond on its officer, the reserve dashed.
- The work is an hour per army, not a step per soldier. `test/formations.test.mjs`.

### Tanks and aircraft (2026-11-23)

TODO item 15.6c. Ric (2026-11-23): aircraft "Scout, bomb and carry"; anything past the Second World War,
"Go past WWII". Part of "What war follows"; a people that does not know them is unchanged.

- **Built when they pay**, at a works with power, by a people at war that knows them and can bear the
  cost after a week's wages: a tank 120 coins, an aircraft 100, with goods and iron, from the treasury
  into the village's till. War orders count as work for a works, so a people at war that knows them
  will put one up. Up to a tank for every 25 soldiers and an aircraft for every 40. A helicopter for
  about one aircraft in four once known; jets once known.
- **Fuelled** from the works' stores (half a load of wood a tank a day, a load an aircraft); short of
  fuel, some stay idle.
- **Tanks** go with the line's units: each fires on the enemy's front, the soldiers with them are hit
  a quarter less often, and a line with nothing to stop them (no tanks, shells or explosives) is
  shaken. They break down and are knocked out: about one in a hundred an hour in battle, more against
  shells, tanks and guided weapons. At Flers in 1916 about a third of the first tanks broke down before
  the attack ([Spartacus](https://spartacus-educational.com/FWWflers.htm);
  [Tank Museum](https://tankmuseum.org/article/tanks-at-flers)).
- **Aircraft** fly once a day, a jet twice. Every flight looks over the enemy's places (what the
  general knows of them is then current). An aircraft carries rations to soldiers in the field who are
  short, bought from a store at home, or ten soldiers to an army in battle and outnumbered; a
  helicopter only carries. Otherwise it bombs: the enemy's army if it is in the field, else, under a
  hot-tempered, cold leader, a town (killing those who live there), else a bridge or a store. Bombs miss
  by about half a kilometre with propellers — kinder than the record, where of night bombers that said
  they had attacked only a third were within five miles ([Butt Report](https://en.wikipedia.org/wiki/Butt_Report)) —
  by a few hundred metres with jets, and land where aimed with guided weapons.
- **Lost** to the enemy's aircraft and guns: about 1.5 in a hundred a sortie against fighters, one more
  against machine guns, three more against guided weapons, half that for jets. Bomber Command lost
  about 2.3% a sortie over the war, 6% in its worst months
  ([Lancaster Archive](https://lancaster-archive.com/bc_stats.htm);
  [Canada, *Crucible of War*](https://www.canada.ca/content/dam/themes/defence/caf/militaryhistory/dhh/popular/crucible-war-1939-1945-14.pdf)).
- `test/machines.test.mjs`.

### Raids (2026-11-23)

TODO item 15.6d. Measuring 15.5i7 found most of war's dead falling at raided villages: a band sent every
fortnight stood and fought the village's soldiers for up to five days. Ric (2026-11-23), asked what should
change and whether raiders should harm villagers: "whatever is realsistiic", "again whatever is most
realistic". Setting **Raids** under War: *Strike the weakly held, take and go* (the default) or *A band
stays and fights for days (as before)*, which is the old world exactly (`test/raids.test.mjs`). A world
not at war is unchanged.

- **Where a band goes.** Three days after a band is home, the next is weighed: only a place of the
  enemy's within reach held by fewer than two-thirds of what the band would bring (a fifth of the
  people's soldiers; two-thirds under a raiding plan, or for a people that does not farm), and with no
  wall worth climbing. No such place, no band.
- **What it does there**, looked at every hour. Met by as many of the place's soldiers as it is, it
  breaks off. A quarter of it down, it breaks off. More of them than hold the place, it burns a house for
  every three of them and takes what it can carry from the houses and the store, and goes. Raiders on
  their way home fight nobody, and the village's soldiers chase them only across its own fields.
- **Those in a burned house.** A grown-up in the way is killed one time in ten; somebody is carried off
  one time in ten, the young twice as often, to the raiders' nearest place, and held unfree where the
  raiders' law allows. They count as war dead, and as people taken.
- **Why.** Keeley: tribal warriors preferred raids, ambushes and surprise attacks on settlements to
  battles, and the many raids, not the battles, killed most people, though a raid often broke off after a
  handful of casualties ([review](https://michaelgheller.substack.com/p/war-before-civilization-by-lawrence);
  [Cambridge](https://www.cambridge.org/core/product/955437C42DE2BD373787AB6AB36DF6EE/core-reader)).
  On the Plains a party slipped into a camp at night for its horses, success was counted in horses, and
  warriors left a fight they were winning when it cost too much
  ([Plains Humanities](https://plainshumanities.unl.edu/encyclopedia/doc/egp.war.023.html)). Violent
  deaths ran from 0.3% (Mae Enga) to 1% (Piegan) of a people a year
  ([Our World in Data](https://ourworldindata.org/ethnographic-and-archaeological-evidence-on-violent-deaths)).
  The odds of being killed or carried off are guesses, said as such: the reivers' victims' complaints
  list goods, captives and some killed, but no source found gives a rate.
- **Measured** (`test/raiddead.mjs`, a year of old enemies, 600 people, seeds 1–3; before → after):
  war dead a year early 2.8% → 1.8%, medieval 4.9% → 2.9%, industrial 6.4% → 4.4%, modern 3.4% → 3.0%.
  The share falling at a raided village went from 28–64% to 0–3%. Villagers killed in raids, a year a
  world: 1 to 5; carried off 1 to 11. What was left was armies fighting most days, not the rout it
  first looked like (one seed misled): see "Battle by choice".

### Battle by choice (2026-11-23)

TODO item 15.6e. It began as "soldiers cut down in the rout", and measuring by the soldier showed the rout
was not it: of those routed, 0–5% were killed running. Soldiers died at 16–47% a year because armies met
and fought most days — 35 to 125 engagements a world a year, nearly all ended at nightfall with neither
side broken and taken up again the next morning. Ric asked (2026-11-23) "is it actually .3-1% of people
who went onto the battlefield died? i feel like if ou were on the battlefild it was more likley" — it is
not: that figure is of a whole people — and then chose "Battle by choice". Setting **Battle** under War:
*Given when the general chooses* (the default) or *Whenever armies meet (as before)*, which is the old war
exactly (`test/battle.test.mjs`). A world not at war is unchanged.

**Correction, 2026-11-24 (TODO 16c):** `armyHour` had divided the enemy's mean position a second
time before `giveBattle`, so the proximity exception was measured against a point toward the map's
corner. The regression now holds an outnumbered army caught one square from its enemy. Rerunning
the existing three forced wars of 100 days (300 people, seeds 4/7/11, later additions off as in
`test/battle.test.mjs`): engagements 15 → 17, refused 2 → 2, caught 0 → 2, routs 4 → 4, soldiers
killed 9 → 9. The "whenever armies meet" comparison stays at 53 engagements and 16 soldiers killed,
with its historical fingerprint unchanged. The year-long figures below are historical, before
this correction, not current balance measurements.

- **Giving battle.** When the enemy's army first comes within 3 km, the general weighs it with the same
  nerve that decides whether to march out to meet them: about as many of ours as theirs for a bold
  general, more for a cautious or patient one, a third better on ground chosen to stand on. Short of
  that, the army draws off to where it gathered — unless it is caught within a kilometre, or the enemy has
  twice its horse (half the time).
- **Resting.** After drawing off it does not come on again for a week; after a drawn battle, two; after a
  rout, a month. While resting it neither marches nor goes out to meet anybody.
- **Investing.** While a place's wall stands and it has a day's food a head, an army come against it
  stands in a ring just outside the wall and its people stay behind it; neither goes for the other, though
  the ring turns on anybody who comes at it from outside (a relief). Once the wall is breached or the
  store is empty, it is stormed. The siege runs as before (`siegeWorks`: engines, guns, mines, hunger).
- **Why.** Greek hoplite battles killed about 5% of the winners and 14% of the losers, most once one side
  broke (Krentz 1985, [GRBS](https://grbs.library.duke.edu/article/viewFile/5321/5325)); pursuit was cut
  short by ground, night and tiredness ([*Pursuit as closure*](https://camws.org/sites/default/files/meeting2016/049.PursuitasClosure.pdf)).
  France lost about 15–18% of the men it mobilised in 1914–18, some 4% a year
  ([INED](https://ined.fr/en/everything_about_population/demographic-facts-sheets/focus-on/farewell-life-farewell-love)) —
  about the worst on record. Medieval commanders mostly avoided pitched battle, the cost of defeat being
  too great (Gillingham, Morillo, France; [Morillo](https://www.medievalists.net/2012/10/battle-seeking-the-contexts-and-limits-of-vegetian-strategy/)).
- **Measured** (`test/soldierdead.mjs`, a year of old enemies, 600 people, seeds 4–9, old way against new in
  the same worlds): army engagements medieval 297 → 95, industrial 218 → 79; dead in the line 22 → 20 and
  79 → 36. But soldiers killed a year moved little — medieval 22% → 21%, industrial 56% → 46% — because the
  dead at villages did not fall (46 → 39) or rose (66 → 87): soldiers who no longer meet in the field meet
  at the places they march on. A first measurement on seeds 1–3 read "medieval 30% → 18%"; it was three
  seeds and a version with a bug in it, and is not to be quoted. Fights at villages are TODO 15.6g. Not
  tuned toward the record: the odds a general takes are `meeting`'s, unchanged.

### Leave to cross (2026-11-23)

TODO item 15.6f. Ric: "why wouldnt soldiers avoid areas that are others property unless they haave
persmission?" Setting **Crossing another people's land** under War: *Leave is asked first* (the default)
or *Armies go where they please (as before)*. A world where no army's road crosses a third people is
unchanged (`test/passage.test.mjs`).

- Before it marches, an army looks along its road from where it gathered to its goal. Where the road
  crosses the land of a people it is not at war with — a village's fields, or the land claimed round them
  (15.7e) — it asks that people's leader, once a season and goal.
- **Given** to friends, allies and trading partners, to whoever marches on a people they hate, and by a
  small people to the strong they dare not refuse (more than twice their strength), less by a stubborn
  leader. Otherwise, a little short of yes, **for a price**: a tenth of a season's pay of the army, from the
  treasury, where it can pay twice that.
- **Refused**, a bold general (over 0.6) with half again the other's strength forces the way: the villages
  along the road lose a tenth of their stores, and it is a wrong that people holds (grievance and ill will,
  as at the start of a war) — never a war started by a rule. Anybody else gives that goal up for two
  months and turns to another.
- **Why:** passage was asked and refused (Edom refusing Israel, Numbers 20, even when offered payment for
  water); crossing anyway was itself a cause of war (Belgium, 1914, which brought Britain in); and an army
  crossing uninvited lived off the land. Armies only (Ric's choice of armies or everybody, made in his
  absence: traders, herders and hunters pay for what they take from claimed land instead, 15.7e).
- The road is a straight line from where the army gathers to its goal; the soldiers walk the land's way,
  which may bend round it.

### Taking a place (2026-11-23)

TODO item 15.6g. Setting **Taking a place** under War: *Surrender is demanded first* (the default) or
*Stormed as soon as the enemy is strong enough (as before)* (`test/taking.test.mjs`).

- **Terms first.** The first day an army is strong enough to attack an open place (no wall worth the name),
  its surrender is demanded. A place outnumbered by about twice and more — more again under a stubborn
  leader — with few soldiers of its own (under a third of the attackers) gives itself up: it changes hands,
  its soldiers and leader march out to the nearest place of their own, nothing is burned or sacked, nobody
  is taken captive, and a quarter of its till is paid. A place that refuses is besieged and stormed as
  before, and sacked when it falls: the law of siege allowed a place that refused terms to be plundered
  ([Lieber Institute](https://lieber.westpoint.edu/sack-cities-laws-war-evolving-attitudes-historical-perspective/);
  Gillingham in *How Fighting Ends*, 2012; surrender on terms was the common end of a siege,
  [Medievalists](https://www.medievalists.net/2017/09/surrender-medieval-europe-indirect-approach-2/)).
- **Drawing off.** An army that has come to a place it cannot take — judged once most of it has arrived — and is not investing it behind its
  wall, calls the attack off and gives the place up as a goal for two months, rather than fighting its
  garrison at the edge day after day.
- **Measured** (`test/soldierdead.mjs`, a year of old enemies, 600 people, seeds 4–6, the old taking
  against the new in the same worlds, everything else as it now stands): soldiers killed a year medieval
  17% → 20%, industrial 31% → 25%; dead at a village 23 → 26 and 38 → 32. That is within what three seeds
  can tell apart, and in none of the six worlds was any place asked to surrender or stormed: **the
  soldiers who die at villages are not dying in places being taken.** They fall within a village's reach
  outside any unit — garrisons and armies passing or gathering near a place — which is what TODO 15.6h is
  for. (For comparison, before 15.6f–15.9 on seeds 4–9, 15.6e measured 21% and 46%.)

### Chasing an enemy home (2026-11-23)

TODO item 15.6h. Setting **Chasing an enemy home** under War: *Not alone into their own fields* (the default)
or *Wherever they run (as before)*, which is the old world exactly (`test/pursuit.test.mjs`).

- **Measured first.** 15.6g found that most soldiers who die fall within a village's reach, though no place was
  being taken. `test/villagedead.mjs` now says who they are, counted and nothing else (no dice, nobody
  changed): for each soldier knocked down or killed at a village, whether it was their own village, the
  striker's or a third people's; where they were walking and on what; whether two of their side stood within
  750 m; whether the striker was at home there; whether the place was their people's goal; and how far off
  their home was. A year of old enemies, 600 people, seeds 4 and 5 — **medieval**: of 24 dead at a village, 21
  died at the enemy's, 19 of them alone, fighting its defenders, from a home 3 to 8 km away; for 10 of them the
  place was no goal of their people's (not the army's target, a raid's, or a gathering place) — they had
  followed a lone enemy home. Seeds 4–6 **industrial** is different: 15 of 24 were defenders at their own
  village, shot from outside it.
- **What changed.** A soldier alone lets an enemy go once it is inside its own village's fields, unless that
  place is their army's target or their raid's, or two of their own side stand within 750 m. They still fight
  whoever comes within reach; choosing to fight is untouched. Drawing a pursuer in among one's own people is
  the oldest trap there is.
- **Measured after** (seeds 4–6, a year, 15.10 off in both): 240 to 430 chases a world-year let go; dead at a
  village medieval 27 → 26, industrial 24 → 25; soldiers killed a year medieval 18% → 17%. **The deaths did
  not fall.** Attackers dying where their people had no goal fell from about 10 to 5, but defenders dying at
  their own village rose from about 3 to 10, and the rest are soldiers who arrive one at a time at the place
  their own army was sent to take. That is item 15.6i, below.

### Coming to a place (2026-11-23)

TODO item 15.6i. Ric: "do 15.6i too, whatever is realistic". Setting **Coming to a place** under War: *The army
camps outside and goes in together* (the default) or *Each soldier walks straight in (as before)*, which is the
old world exactly (`test/column.test.mjs`).

- **Measured first** (`test/arrival.mjs`: each army and the place it marches on, hour by hour; a year of old
  enemies, medieval, seeds 4 and 5, 15.10 off): 36 times three or more of an army reached a place, and from the
  first of them coming within its fields to the most of it standing there at once took 217 hours on average —
  nine days — and that most was 6.2 soldiers. Each soldier, once fed and armed, walked to the goal by themselves,
  so an army came strung out over the road and its first fought the garrison alone (15.6h).
- **What changed.** A soldier of an army (not a raid) marching on a place goes first to a camp two squares
  outside its fields, on the side the army set out from, and waits there until three in five of the army
  (everybody but the garrison that stays home) are in the camp, or three days after the first came — six after
  the camp was set, if nobody can reach it. Then the camp goes in together. A camp a month old is set afresh. A
  medieval army that meant to take a place came up to it as a body, pitched camp not far off and attacked only
  after ([HistoryNet](https://www.historynet.com/medieval-warfare-how-to-capture-a-castle-with-siegecraft/));
  15h's gathering already makes it set out together. The three in five and the three days are guesses.
- **Measured after:** the same worlds (seeds 4–6, a year, 15.10 off). First to most of an army at a place 217 → 170 h, most
  at once 6.2 → 6.0; dead at a village medieval 26 → 25 and industrial 25 → 24; soldiers killed a year medieval 17%
  → 17%, industrial 22% → 25%, and in industrial two places were taken where none had been. **It hardly moved the
  deaths, and why was measured:** an army marched on a place like this only once a world-year in each world
  (`columns`), so most soldiers who reach an enemy place come with a raid, which this leaves alone. In that first
  build the camp waited for three in five of the whole army, of whom only a few had set out, so each camp
  opened on the clock; it now counts those who set out for it, and the one camp in seed 4 filled and went in two
  hours after its first came (seed 5 still waited out its three days). The 15.6h label "its army's target" also
  matched raiders, whose raid and army can point at the same village.
- **Found on the way:** a camp nobody could reach (on water, say) would never have opened, and the army never
  attacked; and a camp left from an old war would have opened at once on a new one. Both fixed.

### Why things happen (2026-11-23)

Ric: "is there an easy log we can add that helps with some of it and doesnt slow it down?" The News tab's
decisions now say why, in a line under each: **because:** and the numbers the decision was made on, read in the
engine where it was made (`note(kind, text, weight, x, y, f, why)`; the keeper passes `why` to the page). Wars
begun (how much the leader wanted it against the line, and what from: old wrongs, land and hunger, envy, their
own grudge, a faith; strength against the enemy's; the leader's nature), peace (how tired of it, against how
tired they had to be, the dead and the years), a marriage instead of a war, a general's plan, an army drawing
off, soldiers rising unpaid, borrowing, famine, dear food, plenty, sickness, walls, new villages, coups,
breakaways, civil war, roads, debasement, enclosure, the theft law, and money not taken for food.

- **Free.** A reason is written only when something is logged — a few hundred times a world-year — and the log
  keeps 400 lines. Bench, the last engine and this one back to back: 2.52 and 2.36 s a day against 2.37 and 2.51
  at 5,000 people.
- **It only reports.** Nothing reads `why`; a world with it is the same world (`test/why.test.mjs`).
- **Not yet:** the reasons behind each person's own choices. Ric looked at that ("dont worry about it now"): the
  cheap way is each person's latest choice and its biggest reason, and a full history only for whoever is being
  followed.

### Where money comes from (2026-11-23)

TODO item 15.8. Ric: "how does the currency work i kinda want only one curency but how is it made?", then
"one currence different coins are okay on currency", and "when does money not become important like in
war. or in apocolypses?" Setting **Where coins come from** under Money: *Mined, struck, lost and debased*
(the default) or *A fixed stock from the first day (as before)*, which is the old money exactly
(`test/mint.test.mjs`).

- **One money.** Every price in every people is reckoned in the one coin, as Ric asked; coins of different
  mints and metals are worth what is in them, all in that one money of account.
- **From the ground.** Ore carries a little silver: a load of ore from rich ground (ore above 0.4) brings
  `0.3 × (ore − 0.4)` coins of it. A people that knows **striking coins** (a new technique, `coining`,
  needing smithing and writing; ancient and later peoples start with it, as Lydia struck the first about
  600 BC) buys the silver into its mint and keeps a twentieth (seigniorage); a people that does not keeps it
  as weighed silver, money all the same, as Mesopotamia's shekel of silver was a weight. Each world starts
  with the stock it always had, so earlier peoples start with weighed silver.
- **Going out.** Coins in people's hands wear and are lost at 2% a year (the figure Hopkins used for
  Rome's coinage, and estimated for Viking-age silver, [Lockyear](https://discovery.ucl.ac.uk/10171145/3/Lockyear_thordeman%20final.pdf)).
  People fleeing an army bury half their coins; they dig them up if they come home, and if they never do —
  dead, or their village taken — the coins stay in the ground, gone from the world, as the hoards that peak
  in wars did.
- **Debasement.** Once a month, a greedy ruler (over 0.6) who is not honest (under 0.4), whose people
  strikes coins and who cannot pay a month of three or more soldiers, strikes coins with no silver behind
  them: three tenths of a coin a head, into the treasury. Their coin is then trusted a fifth less, and trust
  comes back about 3% a month (Rome's third century; England's Great Debasement, 1544–51).
- **When money stops mattering.** Each village, each day: coins are trusted as far as its people's coin
  is; under siege, or in a famine (more than three in ten hungry and under two days of food a head in the
  store), much less. Below 0.35 no food is sold for coins there, by the till or to it: it moves only by
  being shared, given and asked for, as it already could. It comes back when the siege or the famine ends.
  A twice-debased coin is near the line; a famine on top of it is under it. Nothing switches money off by a
  rule (Radford, *The economic organisation of a P.O.W. camp*, 1945; Germany 1923 and 1945–48). Money can
  fail by itself, not only in a catastrophe (Ric's question; my choice in his absence).
- **Every coin accounted for.** What is in hands, tills, treasuries and the ground is what was there at the
  start, plus silver mined and coins debased, less coins lost and hoards never dug up; `count.minted`
  follows it and the test adds it up.
- **Measured** (seed 2, 400 people, a year): early farmers 4,306 coins → 4,275 (14 mined, 45 lost — that
  was with a third of the silver; at the final rate about 45 mined against 43 lost with "How often new
  things are found" at its top); medieval 4,306 → 4,285 (21 struck, 42 lost). Prices in this engine follow
  food against mouths, not the money stock, so more or fewer coins change who can buy, not what bread
  costs; that is unchanged.
- **Not done:** a coin's own metal (every coin here is the one money; debasing lowers trust in a people's
  coin, not the worth of particular coins), and Gresham's law, which needs coins that differ.

### Where the coins go (2026-11-23)

TODO item 15.10. Ric: "can we talk about the extreme wealth concentration that happens and how people with no
money still survive. so we need to look into that and figure out what is most realistic", and of every choice
in it, "the three questions should be answered by what is realistic". Three settings under Money, each with the
old way kept; all three off is the old world exactly (`test/coins.test.mjs`).

- **Measured first** (seed 2, 400 people, the default world, `test/gini.mjs`): grown-ups' coins went from a
  Gini of 0.22 to 0.81 in a year; the top tenth held 68% of them, 44% held none, and the village tills went
  from 853 coins to 2. The five richest were soldiers. Followed through: soldiers buy their food at the store
  (about 7,600 days of it in a year, among 14,100 soldier-days) but it costs them about a quarter of their
  pay, and they had nothing else to spend on; every tax on a sale goes from the till to the treasury and from
  there to the soldiers. Nobody starved.
- **Soldiers' pay** (*Stopped, sent home and spent* or *Kept whole (as before)*). What the army feeds and
  arms a soldier with — rations drawn for a campaign, grain from the faction's share, gear the treasury buys
  — is stopped from the pay, leaving at least a tenth of a day's pay. Gaius Messius's pay slip from Masada
  has all fifty denarii of one payment taken for barley, food, boots, straps and a tunic
  ([HC Magazine](https://www.hcamag.com/us/news/general/fun-friday-ancient-roman-soldier-penniless-after-hr-fees/246921));
  British soldiers had up to sixpence of a shilling a day stopped for rations until the messing allowance
  of 1898, and from 1847 had to be left at least a penny a day
  ([Hansard 1901](https://api.parliament.uk/historic-hansard/commons/1901/may/14/pay-of-private-soldiers)).
  A soldier with no partner and a parent living at home sends half of what they hold beyond a week's pay to
  that parent. At a village of their own, they spend a seventh of a day's pay and a tenth a day of whatever
  they hold beyond two weeks' pay on drink, food and company, into its till. **That share is a guess**: no
  source found gives it. That soldiers kept little is the record's; with the seventh alone, soldiers were
  still the richest after a year.
- **The village store** (*Sells to whoever has coins to spare* or *Mostly buys (as before)*). Somebody holding
  more than a season's bread in coins spends a sixtieth of the rest a day on goods for the house, up to a
  stock that grows with what they hold (at most ten), ordering from the crafters what the shelf does not have;
  such goods wear out in a year and a half each (crafters' and traders' stock does not). The rates are guesses.
- **The penniless** (*Alms and loans as well as kin* or *Kin, neighbours and the ruler only (as before)*).
  Before this, somebody with nothing ate what they reaped, hunted and fished, shared a household's pot, was
  given food by kin and neighbours they asked, and in some peoples got the ruler's relief; that all stays.
  Now, hungry at the store with no coins: first alms from somebody of their own faith, who gives at most a
  fortieth a year of what they hold beyond a season (zakat's rate; the Church's quarter of the tithe for the
  poor, after Gelasius in 496, is the harvest tax here already); then a loan from kin, a friend or a warm
  neighbour with a season to spare, at most a month's bread owed, paid back once the borrower has it and a
  few days' bread besides, a tenth a year on top and nothing between kin. A borrower who dies takes the debt
  with them. Small debts between neighbours were everywhere in the court rolls, mostly for goods rather than
  coin (Briggs, *Credit and Village Society in Fourteenth-Century England*, 2009,
  [review](https://reviews.history.ac.uk/review/835/print)); England's poor law reached about one person in
  eleven by 1813–15, mostly the old, orphans and widows ([Boyer, EH.Net](https://eh.net/encyclopedia/english-poor-laws/)).
- **Measured after** (the same world, a year): Gini 0.81 → 0.65, top tenth 68% → 43%, none 44% → 26%, tills
  2 → 1,276 coins; the five richest a hunter, a herder, a soldier, a hunter, a soldier. Most of the coin moved
  by soldiers spending at their own village (4,696 coins), then stoppages, loans and house goods.
- **Over decades:** twenty years of the same world (seed 2, 400 people at the start, about 290 throughout, nobody starved
  either way). The old way climbs and stays: Gini 0.80 after a year, 0.88 by year 4, 0.93 by year 11 and 0.96 at
  twenty, the top tenth holding 97% of the coins, three in four grown-ups with none, and the tills empty nearly
  every year. The new way moves between 0.65 and 0.84 (0.76 at ten years, 0.82 at twenty), the top tenth holding
  43–68%, the tills between 128 and 1,332 coins, and the richest a mix of hunters, herders, farmers and soldiers
  rather than always soldiers. It still drifts upward over the second decade, and about half of grown-ups hold
  no coin by the end, which for people who eat what they grow is not the same as being poor; what drives the
  drift is not yet followed through. One seed: this says which way, not how far.
- **Against the record.** Alfani's estimates for Italy give the top tenth 45–55% of all wealth about 1500 and
  70–80% by 1800, over three centuries and counting land ([VoxEU](https://voxeu.org/article/europe-s-rich-1300));
  these figures are coins only. Nothing was tuned to reach a number: the causes were taken away and the
  distribution is what it came to.
- **Found on the way:** a soldier's `at` is the last market they went to, not where they stand, so spending
  first keyed to it almost never ran.
- **Not done:** gambling (it moves coin between soldiers, not back to a till); servants and day wages paid by
  the rich; interest hidden or forbidden by a faith's rule (no faith here makes one about lending).

### How technology moves (2026-11-23)

TODO item 15.9 (a to g, and i; h, computers, is not to be done). Ric: "how is technology advancement? i
dont want it linear because it isnt." Setting **How know-how moves** under Minds: *By need, the land,
practice and meeting* (the default) or *As before: some things only by era*, which is the old know-how
exactly (`test/tech.test.mjs`). It works only where things are found at all (How often new things are
found above 0).

- **(a) Eras follow know-how.** Anything can be found once its parts are known — iron, horses, printing,
  gunpowder, the railway — without "Eras move on by themselves". A people's age is read off what it knows,
  once a day: farming makes it farmers, then each age is reached when at least half of the things that came
  in with it are in use and the age before was reached (writing; iron, horses, beans, the mill, herbs; the
  collar; printing and gunpowder; steam, rail, the telegraph; the engine, medicine, the radio; the phone).
  A change is in the news. What followed the era label before (archers, caravans, armour of hide or iron,
  `eraOf`) now follows this. The starting era stays only as the starting know-how. Archaeology's ages are
  names for what was in use, and one people can be in several at once.
- **(g) The wiring, as the record has it.** Changed: riding needs nothing (horses were ridden on the steppe
  about 3500 BC, by people without the cart); gunpowder needs writing and herbs (found by Chinese alchemists
  seeking elixirs, 9th century); the steam engine needs iron working and the mill (Newcomen, 1712: cast-iron
  cylinders, mine pumps); the railway needs steam and iron (1825, iron rails); the telegraph needs writing
  and iron working (1837: wire and code, not steam); medicine needs writing, herbs and printing (germ
  theory, 1860s–80s, came out of a printed science); and the **telephone** (Bell, 1876) is a thing of its
  own, needing the telegraph, before the radio (Marconi, 1895); the phone and its towers need the telephone
  and the radio. Unchanged: writing (farming), the plough and ditches (farming), the mill (the wheel,
  smithing), the collar (plough, cart), beans (farming, plough), printing (writing, smithing — metal type,
  1440), the radio (the telegraph), the engine (steam), striking coins (smithing, writing). The war list
  (15.6) is unchanged. Dates from the standard histories, from memory, to be checked one by one.
- **(b) Need steers what is found.** What somebody finds is still drawn by chance from what they could
  find, but weighted: three times for farming's tools (plough, beans, collar, mill, ditches) in a hungry
  village, herbs and medicine where people are sick, wells and ditches more than a kilometre from fresh
  water, carts, boats, horses, rail and the engine for traders and fishers; twice for metal work (smithing,
  iron, steam, printing, coining, gunpowder, the telegraph) for crafters and miners, farming's tools for
  farmers, boats for fishers (Boserup: crowding brings the plough; Hicks, Habakkuk and Allen: what is dear
  is saved on). How strongly — three and two — is my choice in Ric's absence.
- **(c) What the land has.** Iron working, the railway and the engine need ore within reach of one of a
  people's villages or iron in its store; the steam engine wood to burn; boats timber. Without it a thing
  is not found there, and a people that knows it but has none anywhere cannot use it (`has` says no), as
  Bronze Age peoples without tin had to trade for it. Both finding and using (my choice).
- **(d) Getting better at a thing.** Each people does each thing it knows with a skill: 1 for what it
  started with; 0.7 for a thing new to it; moving over about a year toward 0.85 + 0.075·log₁₀(1 + those who
  know it) — better the more who do it, worse as few do (Wright 1936 and Arrow 1962 on learning by doing;
  Henrich 2004 on Tasmania). It scales what the plough adds to a day's reaping and how much beans spare a
  field. Kept per people (my choice).
- **(e) Knowing is not using.** When a thing reaches a people that is new to it (not farming's tools),
  a stubborn ruler (over 0.7, or 0.55 where the people's own faith keeps to rites) who is not curious (under
  0.4) forbids it: it is held and passed on but not used. The ban ends when that people is at war with one
  that has it, or under a new ruler (the Ottoman ban on printing in Turkish, 1485–1727). Who may forbid: a
  ruler, and a faith through its ruler (my choice); a ban can be broken by war or a new ruler.
- **(f) Places where ideas meet.** The chance of a find grows with the size of the village, as
  (people/100)^0.15 (Bettencourt and others, 2007: invention grows faster than a city), a third more in a
  town and three-fifths more in a city, and half again where a curious ruler has a treasury of five coins a
  head to keep scholars. Schools are 15f's teachers.
- **(i) A research panel.** Each people on the Factions tab has a fold, "Research", with its age and how
  many things are within reach; open, a bar for each thing it knows (how many hold it, darker the better
  it is done, "still learning it", "forbidden", "nothing here to make it with"), the things within reach
  (those whose parts it already holds, those held most widely first) and what it lost (and whether it was
  written down). It sets nothing: finds stay by chance and need, so it shows what is near, never a date.
  The ruler cannot push research (my choice in Ric's absence).
- **Measured** (seed 2, finds at the top, a year): 34 finds; new things at 0.71–0.98 skill; every people
  still farmers.

### Eras (2026-11-22)

TODO item 15d. Ric (2026-11-19, 20): eras "Ancient, Medieval, Industrial (1800s), Modern", then
"Sure all 9 work"; different peoples in different eras in one world: "Yes"; moving on by itself: "A
setting, on or off"; news "shouldn't be for era it should be for what is built"; "cell towers must
be a thing too"; cars "Write them in". Settings under How it starts: **Era** (Foragers, Early
farmers — the default, the world before exactly, fingerprinted — Bronze Age, Ancient, Medieval,
Early modern, Industrial, Modern, Information), **The first people's own era**, and **Eras move on
by themselves** (off by default).

- **An era is a starting point, never a stage** (Ghys, *Game Studies* 2012, on the tech tree's
  determinism; Turchin et al., *PNAS* 2013: techniques spread by contact): the know-how its people
  start with (15e), to which ten techniques were added — iron working, riding and pack horses,
  printing, gunpowder, the railway, the telegraph, the engine, medicine, the radio, the telephone.
  After the start a people has what its people hold: they learn from neighbours who have it, lose
  it, and, with eras moving on, find it. One of the ten changes a whole people — its arms, its
  medicine, its tractors — only once one in ten of them holds it (seen in the page: a medieval
  people beside an industrial one was "fighting with rifles" when one man had learned of the
  railway).
- **War** (14e's numbers, per people): Bronze Age and Ancient armies about one in a hundred under
  arms (Roman, Our World in Data), medieval half that; walls worth more in stone, less once
  gunpowder came; no fighting season from the industrial age; modern standing armies about one in a
  hundred, ten in a hundred at war (the world wars).
- **Weapons by what a people knows** (Dupuy, *The Evolution of Weapons and Warfare*, 1980, the
  1980 table only): hand weapons, iron, muskets, rifles, machine guns. Each reaches further — so a
  soldier strikes any enemy in reach and many can strike one, Lanchester's square law, where hand
  weapons fight one to one — and hits harder, but far less than the lethality index rises, as
  armies spread out (his dispersion): a machine gun two and a half times a sword's blow.
- **Travel**: an army's reach half again with horses, double with rail (15h). **Medicine**: a
  people with it loses a tenth as many children (about half died before fifteen in the past, a few
  in a hundred now; Volk and Atkinson 2013) and a third as many of its sick. **Farming**: with the
  engine a farmer reaps three times as much (one farmer fed 19 in 1940 and 166 now; AFBF).
  **Printing**: teaching goes three times as quick.
- **Houses by era**: round huts for foragers (drawn round), the Roman courtyard house for the
  Bronze and Ancient ages, the hall house as before for early farmers and the middle ages,
  terraces for the industrial age (back-to-backs and byelaw terraces; Harrison), blocks for the
  modern ages (English Heritage; Britannica, house).
- **News at the speed of what is built.** A telegraph office on the line (a people that knows the
  telegraph puts one up, 300 hours) carries a village's big news at once to the people's other
  places on the line; a telephone tower (the telephone, 400 hours, run by a power works) to every
  place within 35 km (GSM's timing limit); a radio to a people's powered places. Cut or knocked down
  — by hand, or half the time in a sack — it stops carrying there and nowhere else, and news goes
  back to word of mouth.
- **Cars**: a trader with 30 coins buys one where the engine is known and a works stands; on a road
  it goes three times a walk, while the power works at home has fuel; off the road it sticks.
- Counts: `wired`, `cars`. `test/eras.test.mjs`.

**Measured** (a year each, 400 people): foragers moved camp 17 times, nearly all hunting; ancient
peoples built water mills; industrial ones telegraph offices (15 pieces of news wired); the
information age built towers and passed 535 pieces of news by them, and its sick died a sixth as
often; an industrial people beside early farmers, old enemies, fought 23 battle deaths' worth and
had its lines cut. Cost: a look at the villages with lines and towers for each piece of big news.

**Left out:** relays of horses and the post as carriers of news; eras set per people beyond the
first in the page (the link holds the two settings); house shapes by people as well as by era;
tanks, aircraft and the bomb (Dupuy's table has them; nothing yet makes them); a forager camp's
ground is still drawn like a village's land round it.

### People who belong to no one place (2026-11-22)

TODO item 15i. Ric (2026-11-20): "aren't their people who aren't part of a place? Depending on the
era too? They travel?"; which kinds: "all of them"; a settled family taking to the road and back:
"yes"; a moving people its own faction or inside a settled one's land: "Probably both." Setting
**People on the road and in camps** under Lives ("Everybody keeps to their village (as before)"
leaves the 15h world exactly as it was, fingerprinted) and **Peoples who forage** under How it
starts (none by default; item 15d's Foragers era sets it per people).

- **A band.** A people that does not know farming (15e: farming, the plough, ditches, wells, the
  cart and bridges unknown) lives from camps by hunting, herding and fishing; nobody farms or keeps
  a trade. What a camp has is shared each day by what each needs (game divided across the band with
  no favour to kin). Its headman takes no tax and keeps no soldiers at peace (Boehm's reverse
  dominance hierarchy); with 15c's government, everybody has the say.
- **Moving camp.** A camp moves when the near ground is used up: the measure is what a day's hunt,
  herd or fishing would bring at the nearest ground that still has something, less the further it
  is (to a tenth at 3 km) — central-place foraging — and below 0.4, at least 20 days after the last
  move, the band goes to the best ground 2 to 8 km off that no other village holds. Across 312
  forager cases camps moved 7.4 times a year on average, from 0 to 58 (Marlowe 2005); bands here
  moved two to three times a camp a year. A band that splits makes two camps. Rich fishing keeps a
  camp where it is: foragers who settle come out of the same rule. Herders' camps move as their
  grazing is eaten down.
- **Taking up farming.** Farming passes to a band by being seen (15e); once more than half of it
  knows how, the band settles where it is camped and becomes a settled people.
- **On the road.** Somebody grown with no coins, going hungry, in a village where more than one in
  seven is hungry, bold enough and with no children under twelve, takes to the road (at most one
  grown-up in ten of a village) — the vagrants of the sixteenth and seventeenth centuries were
  mostly people out of work (*Rural History* 2013). They walk to another village within 10 km,
  ask for bread at the door (given from a store that has it, more often than not), sleep where
  night finds them, and settle where there is a fortnight's bread a head and few hungry.
- Counts: `campMoves`, `bandsSettled`, `wandered`, `wanderersSettled`, `alms`.
  `test/roaming.test.mjs`.

**Measured** (a year): two bands among two farming peoples moved camp 11 times without know-how,
all hunting, herding and fishing; with know-how both learned farming from their neighbours and
settled within the year — fast, as they live among farmers. A crowded world with sickness put 24
on the road. Cost: one pass over a camp's people a day.

**Left out:** herders sleeping at a summer hut (transhumance); sea nomads (Ric: last, or not at
all); pedlars and tinkers as livings of their own (traders already travel).

### Armies: what they carry, how far they go, and strategy (2026-11-22)

TODO item 15h. Ric (2026-11-20): "we need to cover what it is carrying with it so it knows how far
they can go. Armies will need more work too because rn they just run up one at a time instead of
using war strategies." Setting **Armies** under War: "Gathered, fed and led" (default) or "Each
soldier marches alone (as before)", which leaves the 15f world exactly as it was (fingerprinted).

- **Gathering.** For each war, an army gathers at its own village nearest where it means to strike;
  soldiers draw bread and arms there. It marches when enough have reported in within two days —
  half, plus up to four tenths more for a patient leader and less for a hot-tempered one — or after
  a fortnight with whoever has come, never fewer than three. Out of the fighting season (14e) it
  waits at the gathering place. While it gathers, standing with it weighs more for a soldier, and a
  soldier away leaves fetching the house's water to the household. Lanchester: men who arrive one
  by one are beaten one by one (Lanchester's laws; Kress, NPS).
- **How far.** Ten days' bread a soldier, half as much again where the people have carts, at about
  20 km a day, there and back: an army strikes only within about 100 km (150 with carts) of one of
  its villages (Engels, *Alexander the Great and the Logistics of the Macedonian Army*, 1978).
  Soldiers out of bread already go back to the nearest village of their own (item 14).
- **Where to strike.** Once a day each side's soldiers are counted on a map of 2 km squares (an
  influence map: Game Developer, "The core mechanics of influence mapping"; Miles and Louis, 2006).
  Of the enemy's places within reach, the leader picks the one worth most — its people and store —
  against what stands near it on that map and its walls; a bold leader weighs the worth more, a
  patient one the defence. A plan is kept unless one half again better shows, or the place falls.
- **Fed along a road.** When three or more enemy soldiers stand in a 2 km square on the road
  between the gathering place and the goal, a marching army falls back to the gathering place and
  gathers again; it is news.
- **Hired men** (the free companies; Thomson, *Mercenaries, Pirates, and Sovereigns*, 1994): a
  ruler at war with coins to spare and fewer under arms than wanted hires up to three a day from
  the bold among the land's bandits and the poor of peoples it is not fighting, within 7.5 km, at
  twice a soldier's wage; unpaid for a week, or let go at the peace, they go back to robbing (or to
  farming, with coins in hand).
- Counts: `marched`, `withdrawn`, `outOfReach`, `hired`, `hiredGone`, `hiredBandits`. The Factions
  tab shows each army gathering or marching. `test/armies.test.mjs`.

**Measured.** In the war worlds tried (600 people, old enemies, a year, two seeds) soldiers so
seldom chose duty over food and company that no battles were fought either way; armies gathered
and marched 7 and 8 times and fell back 3 and 6 times. So "a gathered army beats the same men one
by one" is held here by the gathering rule (tested), not shown in a battle — said, not tuned.
Cost: one pass over the soldiers a day for the map; a look through one side's villages per war a
day.

**Left out:** pirates at sea (goods by boat are only grain runs so far); battles fought by
Lanchester's laws for each era's weapons (15d); Barbary captive numbers.

### Work and workplaces (2026-11-22)

TODO item 15f. Ric (2026-11-20): "technology needs to be more of a thing and there does need to be
jobs"; (from item 17) jobs "have to match what the city needs". Setting **Work and workplaces**
under Lives: "Livings a place needs and can pay for, and workplaces" (default) or "Farming, crafts
and trade only (as before)", which leaves the 15e world exactly as it was (fingerprinted).

- **Spending decides the work** (Engel's law; Herrendorf, Rogerson and Valentinyi, NBER w18996):
  households buy bread first, and what a village can pay for anything else is its households'
  coins beyond a week's bread. Each day a village counts that, its sick and its children of six
  and over.
- **Three livings, weighed in `chooseJob` like any other**, worth what the place needs times what
  it can pay, shared by whoever already does it: a **healer** where people are sick — paid by the
  sick, and while a village is tended a third fewer of its sick die; a **teacher**, only somebody
  who writes, where there are children and their families have three coins to spare — each
  half-day a child has a small chance to learn to write (15e); a **miller** where a mill stands —
  paid a little by each household, and the mill's saving on grinding needs one.
- **Workplaces people put up**, at the hours they take, never placed (Victoria 3's production
  methods: what goes in, the hands, what comes out): a **water mill** once a people knows it and
  the village is within 2 km of a river (600 hours); a **power works** once they know the steam
  engine (found from the mill and smithing, 15e), only when there is work for it (1,200 hours); and
  **works** beside it where goods are asked for (800 hours). While the power works runs — two loads
  of wood a day from the store — a crafter at the works makes three times what a bench does; knocked
  down, sacked (half the time) or out of wood, the works is a bench again. Hours and fuel are
  guesses, said as such.
- Counts: `taught`, `servicePaid`, `worksBuilt`, `worksBroken`. `test/works.test.mjs`.

**Measured** (a year, 400 people, finds "often"): nine water mills built, three millers, a
teacher, 115 coins paid for services; a teacher put to work taught five children to write in a
month. Seed 2's land is mostly hunting ground, about half its grown-ups hunters, so whether farming
better moves people into other work could not be seen there; said, not tuned. Cost: one pass over
each village's people a day.

**Left out:** firefighters (no fires until item 17); long-distance trade by caravan (Ric's question
on it is still open); shops, carters and clerks.

### Know-how: found, passed on, lost; and writing (2026-11-22)

TODO item 15e. Ric (2026-11-20): "Idk what to do about 2. Propose an idea please"; finds "Rare
(make it a slide tho)"; "If writing is that important put it in". Setting **How often new things
are found** under Minds, a slider: never (as before — the 15b world exactly, fingerprinted),
rarely as in history (the default), now and then, often so a run shows it.

- **A technique is something a person holds** (`p.know`, a bit each), not a flag on a people. One
  list, each with what it is built from and no tree to walk: farming, digging wells, building
  boats, building bridges (from the cart), the cart, the plough, irrigation ditches, smithing,
  weaving — the farming village the engine already was, which everybody starts holding — and,
  to be found, writing, resting fields with beans, the water mill, the horse collar, healing herbs
  and the steam engine (15f).
- **Found by somebody at work** (Muthukrishna and Henrich, *Phil. Trans. R. Soc. B* 2016: the
  collective brain): each spell of work, a small chance to find one whose parts they hold — more
  for the curious, a third as much when hungry, twice where the village is going short (Allen:
  people invent to save what is dear). More people working who hold the parts means more finds,
  without that being set. Rarely as in history is about one find a year among 400; the top of the
  slider two hundred times that. A find others of the people already hold is no news.
- **Passed on** to children, each thing copied a little imperfectly (98 in 100), reading and
  writing only where the family has coins to spare a child for it; and to whoever sees it done in a
  talk (writing excepted: it must be taught, 15f's teachers).
- **Lost** when the last of a people who held it dies (Henrich, *American Antiquity* 2004:
  Tasmania), and news. A people that writes writes down what it knows, and a lost thing that was
  written is read again by somebody who can read, now and then.
- **What each does.** Without wells, bridges or boats known, a village does not dig, build or make
  them; without the plough, a village reaps as one without oxen. Resting fields with beans: soil
  tires 40% slower (15.5d). The water mill: a household by a river spends a quarter less time
  grinding and cooking (15.5n; with 15f, only where a mill stands and a miller works it). The horse
  collar: a village's horses plough as oxen do. Healing herbs: a fifth fewer die of a sickness.
  **Writing**: news told by somebody who writes passes word for word; a collector who keeps
  accounts skims half as much (a scribe's check, 15c); a written law needs a clearer lean to
  change (Goody, *The Logic of Writing and the Organization of Society*, 1986).
- Counts: `finds`, `learned`, `lost`, `relearned`. `test/knowhow.test.mjs`.

**Measured** (a year, 400 people): rarely, one find (the horse collar), spread by being seen to
three of four peoples; often, 26 finds and all five new things in most peoples, four in a hundred
writing; in a land of 60, a technique lost and found again within two years. Taught to one person,
healing herbs is held by about 35 sixty days later. Cost: a bit test per spell of work and per talk;
one pass over the people a day.

**Left out:** losing a technique because its material is out of reach; trade goods and captured
weapons taken apart to learn from; scribes as a separate office (counted into the collector here).

### Who marries whom (2026-11-22)

TODO item 15b. Ric (2026-11-19): "dont people who marry marry in similarry pay ranges? … there
was tons of factors that play into who marrys who"; (2026-11-20) "The marriage thing should be
decided through the stats." Setting **Who marries whom** under Lives: "Each people's customs, from
its nature" (default) or "Whoever likes each other (as before)", which leaves the 15g world exactly
as it was (fingerprinted).

- **Customs, worked out each day** from the stats of whoever has the say (the ruler and 15c's
  council): how much the families decide (stubborn, patient and greedy peoples arrange, the
  curious leave it to the couple; about 70% of marriages in 190 foraging societies were arranged
  by parents, Apostolou 2007); what passes between families — a dowry where wealth is unequal and
  oxen plough, a bride-price among the greedy, or nothing (Anderson, JEP 21(4), 2007: dowry in the
  stratified plough societies, bride-price in two thirds of the Ethnographic Atlas); where the
  couple lives (a house of their own for the bold and curious, else his family's) and, with a
  house of their own, late marriage for the patient — women at 24, men at 26 (Hajnal's
  north-west European pattern); cousins forbidden where the people's faith is a taught one
  (Schulz et al., *Science* 366, 2019); and who inherits.
- **A match weighed inside them.** Two who like each other still marry, unless the families say
  no: as far as they decide, more the further apart the two families' wealth (twice as well off is
  a third of the way to a flat no), for another people, and for another faith held hard. Families
  also arrange matches themselves, as often as they decide: a single of age is matched with the
  single of the other sex within reach (6 to 16 km, the curious further; Perry 1969: under 11
  miles) whose family's wealth is nearest theirs, of the same faith if they can, near in age; if
  nobody of like standing is in reach, they wait. A dowry is an early share, 15% of the bride's
  parents' coins to the groom; a bride-price ten days' bread and a tenth of the groom's family's
  wealth to her parents. Two of 15c's great families married are news.
- **Who inherits** (Ric: "I agree"), with the setting "When somebody dies" at its usual "their
  children": a widow's third (English dower), then all the children alike, the eldest son alone,
  or the children and the dead person's brothers and sisters, by the people's custom.
- **Handed over for keep** (Ric, from 15.5e): the old who can no longer work and have no partner
  give what they have and their house to their eldest grown child in the village, who keeps them in
  food; if the child dies or leaves, the bargain is off.
- Counts: `arranged`, `wedRefused`, `brideprice`, `dowry`, `greatWed`, `handedOver`, `keptFed`.
  `test/marriage.test.mjs`.

**Measured** (a year each; the correlation of the log of the two families' wealth among couples
made that year, against the same people paired at random, about 0): a default world 0.61 against
0.23 by liking alone; very unequal wealth 0.21 against 0.12, and under chiefs 0.52 against 0.35
(Clark and Cummins found about 0.8 in English marriages 1837–2021). The families' own matches alone
correlate 0.98 in the test. Fewer marry in a year (66 against 73 couples), and births fall with it
(17 against 26 in the default world), as later, choosier marriage did. Cost: one pass over a
people's grown-ups a day for its customs and the singles, and a search through the singles for a
few families a day.

**Left out:** more than one wife (a person has one partner in the engine); widows forbidden to
marry again; dowries of land rather than coins.

### Faith (2026-11-22)

TODO item 15g. Ric (2026-11-20): "How do we make it so they can come up with their own faiths?";
"Yes it can drive harsh things." Setting **Faith** under Minds (on by default; off leaves the 15c
world exactly as it was, fingerprinted).

- **Made up by somebody.** After a famine, a sickness, a dry year, a war lost or their village
  taken, one grown-up of the place — the likeliest the curious, then the bold and the frightened —
  may make up what lay behind it; about one such event in six makes a faith, more after a bigger
  one (a guess, said as one; Ric chose "Rare" for finds). Those already holding a faith hold it
  harder instead.
- **What it holds comes from its maker's nature** (Boyer, *Religion Explained*): its rite — a feast
  (the warm), a fast (the patient), offerings, or sacrifice (the hot, bold and cold); its rule —
  no stealing (the honest) or never turning the hungry away (the warm); war on those who do not
  hold it (the hot, bold and stubborn); whether it lives by rites or by teaching (the curious and
  patient teach; Whitehouse's two modes); and a holy day every seven or ten days, or none.
- **It passes along trust** (Stark, *The Rise of Christianity*): in a talk, from a holder to
  somebody who trusts them (close friends and kin), more from the zealous, more to the frightened
  and the hungry, less to the stubborn and to those holding another; and to children. Named once
  ten hold it, from the place and its maker ("the Way of Fiye", "Saemad's people").
- **What it does.** Holders keep the holy day: in daylight they gather in the village and talk
  instead of working. Holders trust each other more and give to each other more readily; a faith
  that forbids stealing stops its zealous holders stealing; one that forbids refusing makes them
  give. When a ruler holds a named faith it becomes the people's own: holders grow a little more
  loyal, and where it is taught a priest is named (15c's offices). A faith that calls for war adds
  to a ruler's reasons against a people that does not hold it; one that calls for sacrifice, held
  hard in a place in hard times, kills somebody held unfree, or else somebody who does not hold it
  (Watts et al., *Nature* 532, 2016: mostly slaves and outsiders).
- **It fades** where life is safe — fed, unafraid, well — and is gone when nobody holds it (Gore,
  Lemos, Shults and Wildman, *JASSS* 21(1), 2018).
- Counts: `faiths`, `converts`, `lapsed`, `faithsGone`, `sacrifices`, `holyWars`, `holyDays`.
  `test/faith.test.mjs`.

**Measured.** Twenty holders seeded in a world of 400: in sixty days 11% of those who trusted a
holder took it up, 2.8% of the rest. At the first rate tried (twenty times faster) every grown-up
of a village held it within forty days, against Stark's 40% a decade; at the rate kept a faith
spreads over years, not weeks. Cost: one sum over the people a day while any faith is held, and a
few comparisons in each talk. (Since 15.12a's dice, 2026-11-24, five such worlds pooled: 6% against 2.1%, three times.)

**Left out:** splits when two leaders hold different versions; faith in marriage (15b, since done);
festivals with feasting beyond gathering; writing a faith down (15e). All of it, and what is not true to
life here (no belief before a faith, fading in a year of good life, a ruler's people not following), is
TODO item 15.11. Its five ★ parts are in: next section.

### What faith does (2026-11-23)

TODO 15.11i to 15.11m, the five marked ★ (Ric: "do 15.11 the stars do all of the stars"). Each joins faith to
something the sim already did, and each is its own setting under Minds, shown while Faith is on, on by default;
with all five off the world is the one before them exactly (`test/faithdoes.test.mjs`, fingerprinted). Ric
was not asked the two "Ric decides" questions this session; each was answered with the recommended choice,
written below, for him to overturn.

A faith now takes five more things from its maker's nature when it is made (`makeFaith`), read only where
their setting is on: `tie`, how far its gods stand behind the ruler (higher for a faith of rites made by
somebody loyal and incurious); `sorcery`, whether it forbids blaming sorcery (the warm and honest) or sees it
everywhere (the hot, stubborn and cold); `kids`, many (the warm and ungreedy) or restraint (the patient and
curious); `wed`, marry young (the stubborn and warm); and `celibate`, whether a taught faith's teachers keep
apart (the patient and stubborn). The Factions tab says each on the faith's line.

- **Heaven's favour** (15.11i). Where a people's faith ties its gods to the ruler, each famine, sickness,
  dry year or war lost in its lands is held against the ruler, `tie` times the event's size (`blameRuler`;
  a place taken is the old ruler's war lost, counted there). Blame takes loyalty off everyone, a tenth of the
  blame up to 0.35, half that for those who do not hold the faith, and it is taken off after the rest of
  loyalty is clamped, so a full belly does not hide it. It fades by 0.2% a day (half gone in about a year)
  and a new ruler starts at nothing. The risings the sim already has follow from the loyalty; once a people
  has turned (blame over 1, loyalty under 0.4), the news says the gods have turned from the ruler. A faith
  that does not tie its gods to the ruler blames nobody: its holders only hold it harder, as before. The
  mandate of heaven, and Jia 2014 (*Economic Journal*) on droughts and peasant revolts in China; Chaney 2013
  (*Econometrica*): in Egypt a bad Nile strengthened the religious authority instead, which is the untied case.
- **Prophets** (15.11j). Each hard time adds to a place's `trouble` (a famine 1.5 a month it lasts; it falls
  by half in about four months). Past 4, each further hard time there has a one-in-five chance that
  somebody — the curious, bold, frightened and unhappy first — comes forward promising the world put right
  (`prophet`), at most once in two years a place; a new faith, and where they held one, a new reading of it,
  said so. A movement passes three times as readily to the hungry, the frightened and the unhappy, and those
  of the faith it reads anew are held back only half as much by their own zeal (`faithTalk`). Its holders
  turn from a ruler who does not hold it (0.6 of their zeal off loyalty, after the clamp). When hard times
  come again to a place where it is held, the promise has failed: the stubborn hold it a little harder, the
  rest lose 0.3 of their zeal (Festinger, *When Prophecy Fails*); the second failure ends it as a movement,
  and so does a year with its place's trouble under 0.5. Wallace 1956, "Revitalization movements". **Ric
  decides** "whether a prophet's movement can found a new people of its own": answered yes, but only through
  the breakaway the sim already has — a prophet among the rebels is first in line to head it (`secede`), and
  when a people's ruler holds a faith it becomes theirs. Nothing makes a people for a movement.
- **Blaming a neighbour** (15.11k). After a famine, a sickness or a dry year, a village of eight grown-ups or
  more may blame somebody (`hunt`): odds 0.12 times the event's size times (0.4 + the village's fear + how far
  its temper is above the middle), 1.8 times where two faiths are each held hard by a tenth of it (Leeson and
  Russ 2018: trials were most where churches competed), 0.3 where the people's faith forbids it and 1.8 where
  it sees sorcery everywhere, 0.6 where a judge (15c) hears it. Who is picked is read from the village: old
  (over fifty), a woman, poor (under a third of the village's mean coins), cold, disliked (how sixteen others
  feel about them), of another faith than most there, a healer, with a little chance — Oster 2004 (*JEP*) on
  Europe's cold decades, Miguel 2005 (*ReStud*) on witch killings of old women in Tanzania's droughts and
  floods. A judge lets them go 0.3 + half their honesty of the time. Otherwise by the anger (the village's
  temper, or the judge's, plus its fear, a little chance, more where the faith sees sorcery): from 1.3 killed,
  from 0.9 driven out to the nearest place not at war, else shunned (24 of the village think worse of them).
  **Ric decides** "whether a hunt may kill": answered yes (Ric, 15g: "Yes it can drive harsh things"), only
  where the anger is that high. The News tab says who, why and how ("Blamed").
- **Children** (15.11l). The devout conceive more readily, by 1 + a fifth of the mother's zeal, and a quarter
  of it again where their faith bids many, a third of it less where it bids restraint (Kaufmann, *Shall the
  Religious Inherit the Earth?*; the Hutterites at the far end). A celibate faith's priest and its holders
  over 0.9 zeal marry no one and have no children; the rest of its holders do. A people whose faith marries
  young has no late marriage (15b's Hajnal pattern). **Not done:** more than one wife, which needs a
  household that holds more than one partner.
- **Trust in trade** (15.11m). A village's `faith` is the one held by two in five of those who live there
  (counted in `faithDay`). A load to a place of the trader's own faith is worth 1 + 0.3 of their zeal as
  much to them, to a place of another 1 − 0.2 of it; a caravan goes half as far again to reach one of its own
  (`tradeTrust`). Somebody whose faith is not their people's own weighs trading 1.3 times as high
  (`chooseJob`). Greif on the Maghribi traders; the Armenian, Parsi and Hadrami diasporas. Counted:
  `faithLoads`, caravans to a place of the trader's faith.
- Counts: `blamed`, `favourLost`, `prophets`, `failed`, `hunts`, `witch` (killed), `drivenOut`, `shunned`,
  `acquitted`, `celibate`, `faithLoads`.

**Research:** not searched this session. The sources named are the ones TODO 15.11 lists, as remembered
from the standard literature; what each is cited for above is the finding as generally reported, and the
numbers in the rules are guesses that the findings point the way of, not values read from them. To be
checked one by one.

**Measured** (`test/faithdoes.test.mjs`, forced cases): loyalty 0.77 under a ruler blamed for three famines
against 0.96 where the faith does not tie its gods to the ruler, twenty days on (seed 4); a prophet after 15
famines in one place, the movement's followers 0.78 loyal against 0.88 for their neighbours a month later
(at 0.35 of zeal rather than 0.6, talk with loyal neighbours pulled them back to within 0.06), and their zeal
1.00 → 0.70 when the promise failed; 63 hunts in 400 forced famines at fear 0.6 (16 killed, 47 driven out),
21 where the people's faith forbids it; the best load from a village worth 3.82, 4.97 where its buyers hold
the trader's faith, 3.06 where they hold another. **In a default world** (four seeds, 400 people, three years
each, all five on and all five off): nobody starved in any of them, so hard times were few — no prophet, no
blame, three hunts in twelve world-years (one driven out, two shunned), births 273 on against 274 off, one to
three faiths a world where any arose. So in an ordinary world these five do almost nothing yet, because 15g's
faith seldom starts there; that is 15.11a's question (measure 15g alone over years), not answered here.
**Cost:** the same runs took 294–306 s with the five on and 287–299 s off, inside run-to-run noise: one more
tally over the people a day, and the rest only after a hard event, one village at a time.

### Each one's own dice (2026-11-24)

TODO 15.12a. Ric: "Separate people's random draws. Tie randomness to the person, decision type, and simulation time
… Skipping a robbery option shouldn't redistribute everyone's rolls." Until this date every draw came off one stream,
`R`, in the order people happened to be visited, so one extra draw anywhere changed everybody's dice after it.

- **A draw is a hash** (`draw` in `people.js`): of the seed, who is deciding (`ACT`: a person's `p.dc`, a village's,
  a people's, or the world's), the step, which of their draws this step it is, and the kind of draw (the old
  separate streams for traits, foul water, wounds, sexes, babies and minds are kinds now). MurmurHash3's finaliser
  mixes it; it is counter-based, as Philox and Threefry are (Salmon, Moraes, Dror and Shaw, "Parallel random
  numbers: as easy as 1, 2, 3", SC11, 2011), so it costs one hash a draw.
- **Who decides** is set where a person, a village or a people takes its turn (`act`, `live`, `reflect`,
  `chooseJob`, `market`, `villageTurn`, `decide`), and a loop over many people draws each on their own (`Rp`).
- So feeding one person reaches another only through what the world models — a talk, a trade, a store, a price, a
  ruler's order. `test/dice.test.mjs`: one person fed, and the 120 people of a far village of another people do
  exactly what they did.
- **Ric chose "New only"**: every seed gives a new world from this date; the old stream is not kept. Every
  fingerprint was pinned again, and the tests whose worlds had been picked by seed were looked at one by one
  (TODO 15.12a says which and how).
- **A person is at V8's edge.** Four more fields on a person made every step 70% slower: the object no longer fit
  what V8 keeps in it. The dice are one small object, `p.dc`, and everything 15.11 and 15.12 added to a person is in
  one more, `p.lf`. Anything new a person holds goes in an object of its own.
- **Measured:** the bench as before (400, 2,000 and 5,000 people), and 5,000 people over three seeds 2.36 s a day
  with the old dice and the new.

### Faith, deeper (2026-11-24)

TODO 15.11a to h and n to z. Ric: "i just want it to be realistic you know?", then "finnish all of 15". Each part is
a setting under Minds, shown while Faith is on, on by default; with all of them off the world is the one before
(`test/faithdeep.test.mjs`, fingerprinted with three faiths held). Ric decided three questions on 2026-11-24 — a
ruler may force a faith ("Yes, by nature"), shrines and temples are built now ("Build now, simply") — and the
rest were answered with the recommended choice, written in TODO.md for him to overturn. **None of the research
named in TODO.md was read this session**: the works are cited as remembered, and every number below is a guess
to be checked, not a measurement of the world's record.

**Before (15.11a, `test/faithcount.mjs`).** Four default worlds, ten years each, before these parts: 4 to 12 faiths
made, 1 to 4 named; almost nobody held one for three years, then one took the world over: 89% to 97% of grown-ups held
a faith by the tenth year. Faiths lasted three to five years on average. A people whose ruler held a faith was no
more loyal, and had fewer births (2 to 4 a year per hundred against 4 to 5, few people-years).

**After** (seeds 1 and 2, every part on): 3 and 4 faiths in ten years, and 34% and 52% of grown-ups holding one by the
tenth, still rising; nobody let one go. Folk belief holds off a faith that does not keep it, so faiths come slower.

- **Belief before faiths** (b). Everybody holds a folk belief (`lf.folk`), taken after their parents, of their
  people's kind: the ancestors, the spirits of places, or both (`folkOf`). A faith that keeps it passes more readily
  to those who hold it, one that does not less; letting a faith go falls back on it.
- **What a faith can hold** (b2). `widen` gives a new faith what is sacred, what comes after death, food and drink,
  harm, who leads and who joins, pilgrimage, monks, healing, how it stands toward others, giving, lending, rank,
  washing, a truce and turning from new things — each from its maker's nature and what went wrong, the clashing kept
  out (nothing that harms no one asks for a sacrifice). Each does something: see TODO 15.11b2. Boyer, *Religion
  Explained*; the Seshat and Pulotu databases for the range.
- **Fading** (c). Zeal fades six times slower for somebody who cannot read, faster in towns and among other faiths,
  and offerings that failed take it away (`fadeOf`). Norris and Inglehart; Stark; Festinger.
- **From the ruler** (d). The loyal come over to the ruler's faith, the household and officials first; a hot,
  stubborn, zealous ruler taxes or forces it, and the forced keep theirs hidden and go back to it. Bulliet's
  conversion curve; *cuius regio*; the Kakure Kirishitan. 13 → 52 of 169 in 120 days, 17 without.
- **When faiths meet** (e). Sects of a faith held by two rulers; tolerant sects join back; two faiths side by side
  borrow days; a faith bound to win others over presses them. Stark and Bainbridge; Allport.
- **Faiths that change** (f). Rite and days drift to the holders' nature, a fifth as fast written down; a large
  faith of rites turns to teaching; a written faith can be found again. Whitehouse, *Modes of Religiosity*.
- **What a faith owns** (g). A keeper in each village (its priest, else its most zealous); a tithe of half a
  hundredth a month to them, coins from hand to hand; shrines; a greedy ruler of another faith takes half of what its
  keepers hold. 69 coins of tithe and two shrines in 90 days for a people of 30 holders.
- **Feasts and the dead** (h). Harvest, midwinter, spring and a day for the dead, paid for by the store; burials paid
  for by the household. A year: 24 feasts, 63 days of food.
- **Comfort** (n), **oaths, courts and sanctuary** (o), **who is above whom** (p), **rites of a life** (q), **reading**
  (r), **keeping and forbidding** (s), **days without war** (t), **martyrs and morale** (u), **fleeing for faith**
  (v), **great temples** (w), **pilgrims** (x), **sacred land** (y), **washing and healing** (z): each as TODO.md says,
  with its numbers. Bentzen 2019; Leeson 2012; Becker and Woessmann 2009; the Peace of God; Berman; Hornung 2014;
  Lansing, *Priests and Programmers*.

**Left** (TODO 15.13): a faith made by hand on the page, land given to a faith, trial by ordeal, more than one wife,
what faith does in an epidemic (with the plague item), and reading the research.

### Lives with a history (2026-11-24)

TODO 15.12b to e, in Ric's words in TODO.md. Three settings, on by default, each off the world after 15.11 exactly;
the links of why things happened are always kept and change nothing (`test/lives.test.mjs`). Research, as for
faith: cited as remembered, not read this session.

- **Hearing of a thing** (b). `lf.heard` beside `know`: a talk passes word first; it is learned beside somebody who
  does it as their own work three times as readily as before, by seeing it done half as readily; children have heard
  of what their parents know. Epstein 1998 and De la Croix, Doepke and Mokyr 2018 on apprenticeship; Polanyi on
  tacit knowledge. The plough: 135 talks beside a farmer, 193 seeing it done.
- **Experience** (c). Years in ten kinds of work (`lf.xp`), an hour at a time, slowly forgotten, never to nothing.
  Yield is 0.8 of a seasoned hand's for a beginner, 1.0 at three years, 1.15 at ten (Wright 1936, Arrow 1962). A
  change of work costs a season (0.12 of a day's worth), so people keep to a lane: 7.4% changed work in 120 days,
  10.6% before. A people's skill at a technique is its people's at that work (15.9d's per-people skill, replaced, as
  Ric chose).
- **How things are found** (d). One aim at a time, picked as 15.9b picks and three times as readily something heard
  of, only in work the person practises (a hundred hours at it); headway comes now and then, a third of the way, so a
  find takes about as long as the old daily chance said, but is built up, and the news says over how many days and at
  what. Arthur, *The Nature of Technology*; Ogburn and Thomas 1922. A smooth version, a little every day, was tried
  first: everybody's finds would have come together, years in.
- **Why it happened** (e). A link (`because`) for each real change in a life — not paid, took to the road, robbed,
  lost a load, a change of work, a find, learned a thing, a move, an office — pointing at the one before. A robbery,
  a mutiny, a famine and a find carry the chain on the News tab ("after: …"), five links back; the person panel shows
  theirs, what they are best at, and what they are working toward. The newest 20,000 links are kept.

### Ruins and scavenging; grinding and baking (2026-11-24)

**Bug fixes, TODO 16c (2026-11-24).** A newly made village starts with `empty: 0`. Its empty days
wait while refugees can return or living people still call it home, then count seven days before it
becomes a ruin. Founders receive their new `home` in `rehome`, before walking; the census counts home
assignments, not physical arrivals. This corrects the bug-search note's explanation without giving a
failed founding party an immortal destination. Oven and mill tolls are charged once per dwelling,
keeping the existing couple's payer; several single adults in one house no longer each pay for all
its mouths. The checks for these and the other three fixes are in `test/ruins.test.mjs` (`--bugs`
runs just the five regression situations). All five fail against the engine before 16c.

Caravans now resolve a landing in sea or lake to nearby dry ground before `jump`, preserving its
bucket and walking-memory updates. Battle choice receives the enemy's actual mean position, already
divided by the number of soldiers once; it no longer divides that mean again. Ritual killings have
both the existing `sacrifices` event count and an initialized `sacrifice` death count, so `stats()`
stays finite. Every other literal death cause was checked for an initialized counter too.

Three default years (seeds 1–3) change from 382/389/386 living people to 380/387/395; none starves
either way. Engagements change 26/0/26 → 25/0/58, refusals 16/0/3 → 14/0/2 and routs 4/0/5 → 4/0/1.
These are bug corrections, not a retuning toward fewer battles. The seed fingerprints and a clean
43-world fuzz (3,025 world-days, including the original coastal-caravan case) are recorded under
TODO 16c. The older balance measurements elsewhere in this file predate these corrections.
All 98 World Builder suites, including the slow simulations, pass with existing pinned fingerprints
unchanged. Alternating the old and fixed engine twice on the Ryzen 5 3600 gives 5,000 people
2.60/2.86 → 2.67/2.62 seconds a day; the 400- and 2,000-person rows also stay within the 5% budget.

TODO item 16, in Ric's answers of 2026-11-20 (written into the item). Four settings: **Buildings left alone** and
**Grinding and baking**, on by default; **Scavenging**, on, under the first; **Places empty at the start**, "None" by
default. With the first two "old" and scavenging off, the world is the one before item 16 exactly
(`test/ruins.test.mjs` holds its fingerprint; every older test's `LATER` list turns them off).

- **The unit is the building** (Ric: "it should be a dead building"). A house, and every other building a place has,
  wears only while nobody lives or works in it (Ric: "If they are living in it it doesn't need patches") — `h.left`
  is when it was last left empty, `stageOf` reads the stage off it: kept, **worn** at 3 years, **roof holed** at 10,
  **roofless** at 20, **fallen** at 35 and **a mound** at 60 for timber walls; stone walls stand roofless until 200
  and are a mound at 500. Guesses from unrepaired reconstructions standing 13 to 40 years (Mytum and Meek; West
  Stow; *The Life Cycle of Structures in Experimental Archaeology*) and thatch lasting 15–30 years kept up (Historic
  England; the Thatch Advice Centre); no figure was found for a roof nobody mends. A burned house is fallen, then a
  mound. Walls are stone where most of what went in was stone (`buildShift`), and for the first houses where stone
  lies within 2 km and the household is better off. Worked out once a day (`ruinsDay`), a look at every house.
- **Mended before it is lived in** (Ric: "Needs to be fixed if it isn't but cost less then making a new one"). A
  household looking for a house takes the least gone empty one; past worn, it is a building site again at a share
  of new — a tenth worn, 30% holed, half roofless, three-quarters fallen, nine-tenths a mound (`mendHouse`).
- **The other buildings** (Ric's table, TODO 16). A place has a **store**, a **market** once it is a town, a
  **hall** where its people's leader lives, a **smithy** once it has twenty and knows smithing, a **landing** where
  it has a boat, a **fort** once it has the low thick wall, and the workplaces, shrines and temples it has built,
  each drawn in its own size and colour (`BL_SIZE`). They stand for what the place already does, so they are not
  built by hand; they wear like houses once the place is empty, and when it is lived in again a workplace, shrine or
  temple is work to finish again at the same shares, the rest are paid for from the store (`mendBuilding`).
- **Walls** (Ric: "4 years of peace is that realistic for the walls?" — no: York, Worcester and the German towns
  mended theirs for centuries). A wall no longer falls in peace; once its place is empty it goes in 30 years if
  timber and 300 if stone (`v.wallSt`, `v.wallWd`: what went into it). Guesses; no figure for a palisade was found.
- **What a ruin holds** is what was there: its store, and what its last people had (`die` already put a dead
  person's food, goods and gear in it). It rots by kind (`ROT_DAY`): grain half in three months — a watched store
  loses 2–5% a season (FAO), medieval farmers seldom kept wheat two years (McCloskey and Nash), an unwatched one is
  a guess — wool and hides half a year, wood six, goods eight, iron fifteen, stone never. Measured: 400 of grain in
  a ruin is 24 a year later, 20 goods 18, 30 stone 30.
- **Knowing of a ruin** is held in the mind (item 11, `M_RUIN`, half gone in two years): its neighbours within
  5 km when a place dies, whoever passes within a kilometre, and anybody told in a talk ("Nobody's left at X.
  There's still things lying about."). Found empty, it is forgotten.
- **Scavenging** is weighed in `choose` like cutting firewood: what they think is there against the walk, up to
  15 km. Three hours of searching, then home with the most worth carrying of what is left — a back-load, 25 days of
  grain or 3 goods (`SCAV_CARRY`) — never stone (Ric: no stone robbing). Food goes to the household, goods to the
  person, the rest is sold to the village. Measured (seed 5, 300 people, a third of the places empty): 138 worth in
  the ruins taken in a month by 28 trips, word passed 106 times, two ruins settled; three trips or fewer in the two
  months after.
- **Whose it was** (Ric: "Anyone. But people may still be protective of the land or view it as theirs", "only if
  they see them or hear about it"). Taking from another people's ruin is news at the ruin, once a season a ruin and
  a people: those who see it, and those told, hold it against the people the telling names (`lootedFrom`), so a
  wrong telling blames the wrong people. The family that left is not singled out; the people is.
- **Settling in a ruin.** A place sending families out may choose a ruin within reach over open land, a tenth more
  for its houses; the new place takes the ruin's houses (to mend), store, buildings, wall, well and boat
  (`takeRuin`). Most ruins stay ruins, as most English deserted villages did.
- **Places empty at the start** (Ric: "if it starts empty then it is unknown"): the world is made as usual, then a
  third of the places, or all but one place a people, are emptied with nothing said, what they had left in the
  store, each a different number of years into its decay from the seed (a few months to thirty, the recent likelier).
  The survivors know the empty places within 10 km.
- **Grinding and baking** (Ric: "probably needs to be added"). The two hours of cooking (15.5n) become cooking
  (1¼ hours, a quarter more a mouth), grinding — a fifth of an hour a mouth at a rotary quern, about an hour a day
  for five (Mills Archive), 4.3 times that at a saddle quern before iron working (Journal of Archaeological Science
  vol. 72), a ninth of it with a mill (ICAR, *Indian Farming*: three hours to a third) — and baking, half an hour at
  home or a tenth at a common oven. The miller is paid in grain, a sixteenth (Chester's toll, British History
  Online); a place of forty builds an oven (150 hours, a guess), and each household gives it a twenty-fourth of its
  day's bread, into the store (banal ovens were paid in kind; the share is a guess). With "old", the 15.5n hours.

**Measured** (a year of the default world, three seeds, before → after): people 383, 398, 387 → 382, 389, 386;
nobody starved either way; births 56 → 53; hours of house work 455,000 → 665,000 (grinding by hand); an oven in
six or seven places a world, taking 3,400 to 4,400 days of bread a year into the stores. The bench is the same
within the machine's drift (5,000 people: 2.27–2.31 → 2.30–2.41 s a day). A wall after 500 days of peace: 1.00, was
0.80.

**Left out** (TODO 16b): the family who left holding a ruin as theirs, apart from their people; danger in ruins
(Ric: item 18's); building a store, market or hall by hand; a separate look for each kind at each stage (they share
the five stages, each in its own shape and colour); what an oven saves in firewood (no figure found); a ruin's
fields going back to scrub on their own clock (they follow the land's, 15.5d).

### A land of one village, and beyond its edge (2026-11-22)

TODO item 15.5c. Ric asked for land of about 2 km²; the smallest was 5 km across (25 km²), where the
default eight villages fit. Ric (2026-11-20): a 2 km² world is one village watched house by house;
how many people and groups, "whatever happens" (no special rules for a small world); land "stored
finer if the computer allows" (advice, not a block); and the world beyond the edge, "an option":
closed, or people coming and going.

- **How much land** now goes down to 1.5 km across (1.5 by 1 km, six squares by four), in quarter
  kilometres, and says "one village's land" up to 3 km. Under about 5 km not every village asked for
  fits; what does not fit is not made, as before.
- **Squares stay 250 m.** The engine counts in squares throughout (how far people walk, a village's
  reach, what a square holds), so finer squares would change every world. Since 7a houses stand and
  are drawn at their true size inside the squares, and zoomed in the page draws the fine detail of
  the ground from the seed (4a, 5), so a house is not a square; a square is about half a holding's
  fields (6.25 ha). Said here so Ric can ask for finer squares if he still wants them.
- **Beyond the edge** (setting, under The land, closed by default = the world before): open, each
  week strangers may walk in from beyond, about one a month for each ten kilometres of edge, more
  when the land holds fewer than it started with and none while it is hungry — a grown-up of 16 to
  35 with a week's food, who joins the nearest village (`stranger`). And the hungry who live within
  2 km of the edge may leave for good, a household at a time, three in a hundred of them a week,
  taking their food, goods and coins out of the world (`overTheEdge`; the coins come off the world's
  sum, so the money test still balances). Guesses, said as such.
- Counts: `strangers`, `left` (also a way of leaving in `die`, with no grief).
- `test/smallland.test.mjs`.

**Measured** (a year each, one village of 60 on 1.75 km², four seeds): 30 to 36 starve, closed, as
the fields round it feed about thirty (30 on the same land: none starve); open, 9 to 43 leave over
the edge and 1 to 3 strangers come, and starving falls to 4 to 28. On 2.5 km² the same 60 are fed.

**Left out:** squares finer than 250 m; strangers bringing coins or goods; whole bands arriving.

### News of plenty (2026-11-22)

TODO item 15.5g. Ric (2026-11-20): "Not sure which is best. Do research." Merchants learned prices by
letter (Datini's archive holds over 100,000) and moved grain on news of a rise; how fast prices
evened out between markets followed how fast news went between them (research notes under 15.5g in
`TODO.md`). So news of plenty has two halves: by word of mouth, built here with 12b's machinery, and
by letter, which needs writing (15e) and roads (15d). Until now people acted on news of dear food,
famine and dry years, not on news of plenty.

- **The news** ("plenty", in `villageTurn`): a village whose store and houses hold more than half a
  year's food a head (`PLENTY_DAYS`), where hardly anyone is hungry and grain is cheap, is news:
  "There is grain to spare in V." At most once a village a year and once a people every two months.
  It passes in talk like any news, and is acted on for 45 days (`ACT_DAYS.plenty`).
- **Traders** who hold it, with no load that pays from where they are, go there to load instead of
  to the next market.
- **The hungry** weigh moving there a little more (+0.25).
- **A hungry household with coins**, its own store empty, goes there to buy (task "buyfar": half
  its winter's want, with up to six-tenths of its coins), a day's walk or less, and comes home.
- The page marks it "Plenty". Counts: `plenty`, `plentyBought`.
- **A setting**, "News of plenty", under Minds. Off is the world 15.5f left, step for step
  (`test/plenty.test.mjs`).

**Measured** (a year each, six default worlds, against 15.5f): six pieces of news of plenty, none
bought on (nobody hungry with an empty store within reach); people 2,377 → 2,377, starved 0 → 0. It
matters where some go short and others have plenty, as the test sets up.

**Left out:** letters (15e) and faster news on roads (15d); families sending to buy for kin elsewhere.

### A household's own firewood (2026-11-22)

TODO item 15.5f. Ric (2026-11-20): keep it — "firewood was important till the modern age no?"
Until now firewood was the village's, burned from its store for everybody, while food, water and
money were the household's. The right to take wood for the fire (firebote, one of the estovers)
belonged to a holding, from the lord's or the common wood; town households bought it; rural
households burned most of Europe's firewood (Warde 2019).

- **Each house's own wood** (`h.wood`), burned in the cold as the village burned it for each of its
  people (`BURN` × chill); a house with not enough is cold (`h.cold`), and its people die of cold by
  it, whatever the neighbours have. On the first day each house has what the store had for it.
- **Wanted** (`hearthWant`): a month of the worst cold now and the winter ahead, as the store
  reckoned it.
- **Bought** (`hearths`, daily): short of half of it, a household with coins buys from the store at
  its price, while the store keeps a third of what it wants for crafts and building.
- **Cut** (task "firewood", "Cutting firewood"): otherwise somebody goes to the village's woods for
  four hours and brings home six-tenths of a woodcutter's day, taken from the same woods (which run
  down and grow back as before). Where no forest is in reach, dung and turf, as before.
- Firelight after dark (15.5s) burns the house's wood.
- Counts: `hearthCut`, `hearthBought` (loads).
- **A setting**, "Whose firewood", under Lives. "The village store's, for everybody" is the world
  15.5s left, step for step (`test/hearth.test.mjs`).

**Measured** (a year each, six default worlds, against 15.5s): households cut 1,614 loads and bought
564; 17 people died of cold in households that ran short (none when the store warmed everyone);
people 2,387 → 2,367, births 136 → 129. That is the change this part asked for: a cold household
different from its neighbour.

**Left out:** wood carried to towns by sellers door to door; charcoal; whose wood it is to cut
(the land rule of 7c is not asked).

### Sleep that follows the night (2026-11-22)

TODO item 15.5s. Ric (2026-11-20): "For the sleeps how close to the equator changes the nights which
changes the sleep. So I think it should all be in there"; the waking hour does something; and
(2026-11-21) light is a thing, and light changes sleep. Until now somebody who went to bed in the
dark slept until dawn in one piece. Three equatorial forager peoples slept in one piece, about 6.4
hours, falling asleep some three hours after sunset (Yetish and others 2015); Ekirch found a "first
sleep" and a "second sleep" in pre-industrial Europe, where winter nights are long (research notes
under 15.5s in `TODO.md`).

- **A night's need** (`need`): six and a half hours, up to an hour more as the night lengthens past
  twelve.
- **Bedtime** (`bedtime`): a grown-up's wish to sleep after dark is a quarter of what it was until
  three hours after dusk where the village has wood for a fire to sit by, an hour and a half where it
  has none; the tired still go early.
- **One sleep or two** (`nightSleep`): where the night is more than six hours longer than their need
  (over about twelve and a half hours, never near the equator) and two hours of it are left, they
  sleep half their need, are up an hour at home (`watch`, "Awake in the night": no longer alone,
  so they talk with whoever else is up, and mind the fire), then sleep until dawn. Otherwise one
  sleep, to dawn or their need and an hour, whichever is first. The same rule makes one sleep at the
  equator and two in a northern winter; nothing is set by place.
- **Firelight costs wood**: a grown-up up after dark at home burns a little of the village's wood
  (`lightWood`), about 130 loads a world-year.
- Children sleep as before. Candles, lamps and brighter light, and light moving sleep later, are 15e
  and 15f.
- Counts: `wakings`, `lightWood`.
- **A setting**, "Sleep", under Lives. "From dark to dawn in one piece" is the world 15.5q left, step
  for step (`test/sleep.test.mjs`).

**Measured** (a year each, six default worlds at 45°, against 15.5q): about 32,000 wakings in the
night a world-year (the long nights of the winter half), reaped 359,900 → 358,800, births 124 → 136,
people 2,391 → 2,387. One world at 62° 38,900 wakings; at 2°, none. A first build split any long
stretch left before dawn, so the tired who went to bed early woke in the night even at the equator
(16,000 a year there); now the split follows the length of the night.

**Left out:** children's sleep, naps by day beyond what was there, light brighter than a fire.

### Climate over centuries (2026-11-22)

TODO item 15.5q. Ric (2026-11-20): yes, from the seed, and **on by default**, so a default world
changes with it. Until now each year's weather differed (6b) but nothing shifted over decades. The
Little Ice Age cooled the northern hemisphere by under 1 °C on the whole (by some accounts 2 °C in
northern Europe in the 16th–17th centuries), with longer winters, cool wet summers and failed
harvests (Parker, *Global Crisis*); Kelly and Ó Gráda argue the smoothing of the data made the cycles
look tidier than they were (research notes under 15.5q in `TODO.md`).

- **The swing** (`climateOf`, exported with `seasonAt`): three waves of about 70, 210 and 600 years
  with phases from the seed, for warmth and, apart, for rain. A year is nearly the one before; a cold
  age comes and goes over generations; nothing is scripted and no two seeds have the same centuries.
- **Its size**, the setting "Over the centuries" (under The year), 0 to 1, at 0.5 by default: at
  the middle the swing reaches about ±0.1 of `warmth` (whose year runs from −1 to 1; about a degree)
  and ±7% of the rain; at 1, twice that.
- **What it does**: added to each day's warmth (`seasonAt`), so a cold age has a later spring and an
  earlier frost; growth times 1 + the swing (a cold age's harvests about a tenth worse at the middle);
  and the century's rain added to each year's (`rainField`).
- "Every century alike" (0) is the world 15.5p left, step for step (`test/climate.test.mjs`).

**Measured** (a year each, six default worlds, against 15.5p): reaped 368,600 → 359,900 days of food
(2% less: these seeds start a little cold), starved 0 → 0, people 2,398 → 2,391. A run of centuries is
where it shows, and no world here has been run that long.

**Left out:** volcanic winters (single cold years), a climate that differs north to south across a
big land.

### Irrigation (2026-11-22)

TODO item 15.5p. Ric (2026-11-20): yes. Until now nobody built irrigation; river flats were spared in
dry years (6b). Wittfogel's claim that big irrigation made despots is widely rejected: Bali's rice
terraces were run for a thousand years by local water-temple networks, Nepal's small canals by
farmers, and Hohokam canals were cleaned yearly in one to eight days by the villages that used them
(research notes under 15.5p in `TODO.md`). No figure for how much a ditch raises a yield was found, so
a ditch does what the notes asked, no more.

- **Wanted** after a dry year: a village within 2 km of a river whose middle had under 85% of a usual
  crop (`newRainYear`) wants a ditch (`v.wantDitch`).
- **Dug** (task "ditch", in the slack of the year, like clearing forest): 800 hours, about a hundred
  person-days (a guess), from the river square nearest the village to the village (`ditchDug`). It
  waters the farmland within 1.25 km of that line (`watered`).
- **What it does** (`rainField`): a watered square loses only 15% of what a dry year would take from
  it, as river flats are spared.
- **Kept** (`ditchYear`, at the turn of each year): 320 hours of cleaning a year, some forty
  person-days; a ditch not cleaned silts up and waters nothing until it is cleaned again.
- Counts: `ditches`, `silted`, `ditchCleaned` (hours). It needs "Rain" by place and year.
- **A setting**, "Irrigation", under Lives. "None" is the world 15.5o left, step for step
  (`test/irrigation.test.mjs`).

**Measured** (two years each, six worlds with "Year to year" at 0.8 and "How many rivers" at 0.8,
against 15.5o): 8 ditches dug in two of the worlds, none silted; the other four had no dry year by a
river and are the same worlds. People 2,429 → 2,452, reaped within a percent: in two years the ditches
had not yet met a second dry year.

**Left out:** big works a leader orders (canals, dams, terraces); water rights and quarrels over
them; a ditch raising the yield of an ordinary year.

### Animals that work (2026-11-22)

TODO item 15.5o. Ric (2026-11-20): yes, "the cheapest way to run" — counted as what a household or
village owns, not as animals that walk about, eat and die one by one. Until now carts moved with
nothing pulling them and the plough was never mentioned. A plough team was eight oxen and a carucate
the land it ploughed in a season; Domesday counted about 650,000 oxen in some 80,000 teams; horses
came into farm work slowly, two doing about the work of three oxen, and changed carting in the 12th
and 13th centuries (Langdon, *Horses, Oxen and Technological Innovation*).

- **Counted, a village's own** (`v.oxen`, `v.horses`): an ox for every three people and a horse for
  every twenty at the start, about Domesday's share.
- **The plough** (`plough`): with a full team (an ox for every four people) a day's reaping is what
  it was; with none, four-fifths (`PLOUGH_MIN`), the work of a hoe; between, between.
- **Horses** pull a village's carts faster: 0.75 of a walk off the roads instead of 0.6.
- **Kept up** (`beastTurn`, daily): worn out in about ten years (horses twelve), bred back toward
  what the village needs where it has grazing; eaten when it starves with its store empty (horses
  first, an ox about 150 days of food); half the oxen and most horses driven off when it is sacked.
- **Custom.** `f.plough`, the share of a people living in villages with half a team or more, leans
  its customs about women's work a little (15.5l's `split`, as Alesina, Giuliano and Nunn found).
- Counts: `beastsEaten`.
- **A setting**, "Animals that work", under Lives. "None" is the world 15.5d left, step for step
  (`test/beasts.test.mjs`).

**Measured** (a year each, six default worlds, against 15.5d): starved 6 → 0 (a starving village eats
its beasts first: 114 eaten in all), reaped 371,190 → 368,500, people 2,346 → 2,400.

**Left out:** horses for riders and soldiers (15h); hay as a crop; oxen bought and sold; a household's
own beasts rather than its village's.

### Land that changes (2026-11-22)

TODO item 15.5d. Ric (2026-11-20): people clear forest for fields, yes; resting land is "the people's
choice"; herds manure fields, yes; and shifting cultivation with it. Until now a field never tired
and a forest was never cleared. English demesne wheat gave three to six times its seed (Campbell); a
third of the land lay fallow under three fields, half under two; marl and manure raised yields;
Rothamsted's Broadbalk, unmanured since 1843, is low but has not fallen to nothing; English fields
left alone were scrub in about 25 years and near woodland in about 50 (research notes under 15.5d in
`TODO.md`).

- **Soil** (`soil`, each square, 1 fresh): every harvest taken wears it toward half
  (`SOIL_FLOOR`): a full field's worth takes 15% of what is left above the floor, about a tenth of
  its strength in a year of steady reaping and a third in five. A square's crop grows back to, and
  as fast as, its strength. Not reaped for six months (a winter is not a rest), it comes back: half
  of what it lost in a fallow year, most in two.
- **Manure.** A village's herds leave dung (`v.manure`, from each herd-day) that goes onto the
  fields as they are reaped, a quarter of what each has lost at a time: about a third of what wears
  in a default world.
- **Fallow by custom** (`restWill`, from how patient a people is): tired land (under 0.75) is
  worth that much less to them when they pick a field, so the patient rest it and the impatient
  hardly.
- **Clearing forest** (`landTurn`, `clearedFor`): a village short of land (a tenth hungry, or
  nearly full) picks the nearest forest square beside its fields, and its people clear it in the
  slack of the year, 1,200 hours (a guess: no figure for assarting by the hectare was found). The
  square becomes grassland that farms better, starts fresh, and its wood goes to the store.
- **Growing back** (`regrow`, monthly): a cleared square nobody reaps is scrub (half its gain gone)
  after 25 years and forest again after 50. Shifting cultivation is this and nothing more: cleared
  land wears, and a village short again clears more.
- **The page is told** (`groundLog`: square, kind, how well it farms): the keeper sends what is new
  with each land update and all of it with a whole land, and the page recolours the square and
  repaints.
- Counts: `cleared`, `regrown`, `manured`.
- **A setting**, "Land that changes", under The land. "The land never changes" is the world 15.5n
  left, step for step (`test/landchange.test.mjs`).

**Measured** (a year each, six default worlds, against 15.5n): reaped 396,746 → 371,190 days of food
(6% less, from tired land), 58 squares cleared (none in seed 4, whose land is treeless; 23 in seed 6),
people 2,355 → 2,346, starved 11 → 6, births 126 → 122. A first build let the herds' dung undo all
the wear (no square lost a tenth in a year) and counted the winter as a rest.

**Left out:** villages that move when the forest near is gone (people move house already, one by
one); marling; floods and fires dropped by the visitor (item 17).

### Work in the house (2026-11-22)

TODO item 15.5n. Ric (2026-11-20): house work as hours a household must spend each day, yes; clothes
"should maybe matter? If it doesn't cost much for the copy or gpu". Spinning was about 85% of the
work of cloth, and most women and many girls spun (ACOUP; Humphries and Schneider); cooking and
minding small children took hours every day, for which no figure was found.

- **Hours owed** (`h.chores`, each house): two hours of cooking a day, a quarter-hour more for each
  mouth after the first, and an hour for each child under five — guesses, said as such — counted an
  hour at a time, up to sixteen.
- **Done** as a task, "house" (`choose`): two hours at home, by whoever weighs it highest. Its pull
  grows with the hours owed, and by custom (15.5l's `split`): a woman's is times 1 + 0.6 × split, a
  man's 1 − 0.7 × split. The lame and the old do it more slowly.
- **Short of hands.** A household eight hours or more behind wastes a seventh more food, and its
  children under five are a third likelier to die (15.5k).
- **Clothes** (`p.clothes`, one number a person, 0 to 1): worn out in a year and a half, made good by
  "spin" (two hours at home, for the worst-clothed of the household under 0.7: 300 hours a person's
  clothes, a guess). Read only in the cold: the chance of dying of it is times 2 − clothes.
- Counts: `houseHours`, `spunHours`.
- **A setting**, "Work in the house", under Lives. "No house work" is the world 15.5m left, step for
  step (`test/housework.test.mjs` holds its fingerprint).

**Measured** (a year each, six default worlds, 15.5m and n together against 15.5k): about 28,000 hours of spinning a world-year, so clothes run down slowly
(a third of what wears is made good); starved 3 → 11, births 119 → 126, children dying young 30 → 32.
A first build counted the two hours' shift wrongly and nobody ever finished house work: every world
starved (91 to 181 of 400), caught by the same measurement.

**Left out:** caring hours for the sick and the frail (15.5e), light to spin by after dark (15.5s),
cloth as goods to sell, and girls' and boys' house work (children mind only the fields and the herd,
15.5m).

### Children working (2026-11-22)

TODO item 15.5m. Ric (2026-11-20): yes. Children did light farm and house work early — minding
sheep and the younger ones, scaring birds, gleaning — and serious work from about twelve to fourteen
(Pittsburgh, the medieval child; Horrell and Humphries, children's work and wages in Britain
1280–1860).

- **A child's share of a grown-up's day** (`childShare`): nothing before seven, rising evenly to
  seven-tenths the year before "Grown up at", a grown-up's from then.
- **What they do**, by day: go to the fields beside a parent who is working there (most at the
  harvest), and mind the herd within 2 km of home. What they reap or bring in is their share of a
  day (`harvestCapacity`, the herd's day). They still fetch water from six, as before.
- **A setting**, "Children working", under Lives. "Nothing until grown" is the world 15.5k left,
  step for step (`test/childwork.test.mjs`).

**Left out:** schooling taking the hours (15e); children's wages and apprenticeship (15f).

### Babies, children and mothers (2026-11-22)

TODO item 15.5k. Ric (2026-11-20), all four yes: children dying of real causes at real rates,
mothers dying in childbirth, the gap after a birth, and "Children" meaning as many as they had. Until
now almost every child grew up and no mother died of a birth. About a quarter of babies died in
their first year and nearly half of children before fifteen, among foragers and in historical
populations alike (Volk and Atkinson 2013); England's parish registers give about 10 mothers dead per
1,000 births (Cambridge Group); foragers' births were about 3.7 years apart, kept so mostly by
nursing (Kaplan and others 2000).

- **Children's deaths** (`childHazard`, a yearly chance): 0.2 in the first year, 0.04 to five, 0.008
  to grown — the fevers, the flux and accidents — on top of the sickness, hunger and cold already
  here; times 2.5 hungry, times 1 + 1.5 × foul where the water is foul (15.5r), twice for a baby whose
  mother is dead. Counted as `young`.
- **Childbirth** (in `deliver`): one mother in a hundred dies, twice that starving, half again past
  thirty-five. Counted as `childbirth`.
- **Nursing** (`p.nurse`, `fecund`): while she nurses a living baby under eighteen months a woman
  conceives at 0.15 of her rate; a baby who dies leaves her free sooner, as in life.
- **As many as they had.** Couples conceive 2.4 times as readily as they bore a child before
  (`BIRTHS_UP`), so that with these deaths a world holds its numbers, as the measurement shows.
- Deaths draw from a stream of their own (`RK`). It needs Men and women (15.5l).
- **A setting**, "Babies and mothers", under Lives. "Nearly every child grows up" is the world 15.5l
  left, step for step (`test/infancy.test.mjs`).

**Measured** (three years each, six default worlds, against 15.5l): people at the end 2,517 → 2,493
(it holds), births 267 → 392, 100 children dead young (a quarter of the births), 3 mothers dead of a
birth (under one in a hundred), sickness deaths 90 → 131 (more children for it to take). Starved
10 → 13.

**Left out:** each era's medicine lowering these (15d); wet nurses; miscarriage and stillbirth.

### Men and women (2026-11-21)

TODO item 15.5l. Until now the engine had no sex at all: any two grown-ups not kin could pair and
have children. Ric (2026-11-20): who does which work, "Yes? I mean pregnant women can't farm as well
and might not be as strong. And there should be some societal stuff too"; couples of two men or two
women, "Yeah. If society believes it's ok". Women averaged about 52% of men's upper-body and 66% of
lower-body strength in one study (Miller and others 1993); almost every people divided work by sex
(Murdock and Provost 1973), and where the plough was used more unequally (Alesina, Giuliano and Nunn
2013). Research notes under 15.5l in `TODO.md`.

- **Each person is a man or a woman** at birth (`p.sex`, 0 a woman, 1 a man), half and half, with a
  strength at heavy work of their own (`p.str`: about 1 for a man, 0.62 for a woman, each a little
  either way). About four in a hundred are drawn to their own sex (`p.same`; a guess, said as one:
  surveys today find 2 to 5, and the past cannot be asked). These are drawn from a stream of their own
  (`RS`).
- **Couples.** At the start a woman and a man; later, two people pair as before if they are a man and
  a woman neither drawn to their own sex, or two of one sex both drawn to it, as far as their people
  accepts it (`accepts`, from its warmth and how set in its ways it is: a warm, open people nearly
  always, a cold, set one about one time in twenty). Couples of one sex have no child of their own.
  Harm done to them for it is their people's law and faith (15c, 15g).
- **A child is carried nine months** (`p.due`), conceived at the rate a couple had a child before,
  by a woman neither carrying nor lying in. In the last two months her strength at heavy work is
  four-tenths, and after the birth (`deliver`) she lies in a month where the household can spare her
  (her larder half its winter's want or more), ten days where it cannot. A fifth of the couples at the
  start are already carrying, so the first births are not nine months off.
- **Bodies** (`brawn`): what a day of the heaviest work gives — reaping, cutting, quarrying, mining —
  and a blow are times 0.55 + 0.45 × strength: a man about 1, a woman about 0.83.
- **Customs** (`split`, each people's own, from its nature as its ways are, 15a): how far women are
  kept from the fields, the hunt, the heavy trades and the army, from how set in its ways and how bold
  it is (and the plough, when oxen come with 15.5o). A woman's wish to go to that work is times
  1 − 0.3 × split; where split is a quarter or more, no woman is taken as a soldier.
- Counts: `conceived`, `sameCouples`.
- **A setting**, "Men and women", under Lives. "Nobody is either" is the world 15.5e left, step for
  step (`test/sexes.test.mjs` holds its fingerprint; the older fingerprint tests now set it).

**Measured** (a year each, six default worlds, against 15.5e): births 116 → 93 and conceived 92 (a
child now takes nine months and its mother cannot conceive again while carrying or lying in; 15.5k is
where births rise to match, as Ric answered), starved 16 → 2, 23 couples of one sex. A first build
paired nobody at the start (an `else` that bound to the wrong `if`) and was caught by the measurement.

**Left out:** who does the house work (15.5n), mothers dying in childbirth and the gap a nursing baby
makes (15.5k), marriage by wealth and inheritance (15b), and laws and faiths about couples (15c, 15g).
The marriages of 14d still match whoever each leader's heir is.

### Wounds and old age (2026-11-21)

TODO item 15.5e. Ric (2026-11-20): a bad wound can leave lasting harm, yes; the old slow down, yes;
somebody who cannot work is looked after by "Family". Until now a wound came back in full at a fixed
rate, and everybody worked as hard as ever until the day they died. Of ordinary working people buried
in medieval Cambridge, 44% had broken a bone, nearly all well healed (Dittmar and others 2021); some
badly hurt people were cared for for years (research notes under 15.5e in `TODO.md`).

- **A wound** (`wound`, from any blow of a tenth of a life or more: a battle's strike, a village
  fight). The chance it is more than a bruise is one and a half times the blow; then it takes
  strength (`p.harm`) that heals by half about every two months. The worse the blow, the likelier
  some of it stays for good (`p.lame`): about a fifth of the heaviest battle blows, almost no fight
  between neighbours. Whether a wound lasts draws from its own stream (`RW`).
- **Age** (`ageVigour`): full strength until three-quarters of "How long they live" (45 at the
  default 60), half at 60, a fifth at the very end.
- **`p.vig`**, what is left of both, is read by work: what a day reaps, fishes, herds, hunts, cuts,
  quarries or mines is times `vig`, the bench a little less; walking goes at half to full pace; a
  blow strikes at 0.4 to full. Under a fifth of their strength nobody goes to work at all; they eat,
  fetch water, talk and rest.
- **Soldiers.** Nobody under 0.6 is taken as a soldier, by choice or by the wartime levy, and a
  soldier lame or too old for it (under 0.4 not counting a wound that will heal) is sent home.
- **The family feeds them.** Somebody under half their strength who has nothing to eat takes it from
  a grown child of theirs in the same village, from what that child holds beyond a week.
- Counts: `wounds`, `lamed`, `discharged`, `keptOld` (days of food).
- **A setting**, "Wounds and old age", under Lives. "Full strength until the day they die" is the
  world 15.5r left, step for step (`test/health.test.mjs` holds its fingerprint).

**Measured** (a year each, six default worlds, against 15.5r): starved 15 → 16, births 109 → 116,
battle deaths 11 → 15 (noise across these seeds); 1,212 wounds (most in seed 4's year of five wars),
63 left lame for good, 30 soldiers sent home. Two first builds were wrong and measured so: the wartime
levy drafted the lame back the next day (731 sent home in a year in one world), and a quarter of all
wounds lasting left 160 lame in that world in a year.

**Left out:** the old handing the farm to a child for their keep (15b, with inheritance); the hours a
family spends caring (15.5n's house work); a new kind of work for those who cannot farm (15f).

### Dirt and foul water in towns (2026-11-21)

TODO item 15.5r. Ric (2026-11-20): "There shouldn't be a town fixed death rate it should all be of
actual causes." Until now a town lost one more person in a hundred a year and a city a little over
two, a fixed number (item 8). The urban penalty came from crowding, waste and foul water. Infants in
English market towns of 2,000–3,000 died at 209–270 in 1,000 in 1675–1749, against under 100 in
remote country. It fell once towns had clean water and sewers (research notes under 15.5r in
`TODO.md`, with links).

- **How foul a village's water is** (`foulness`, once a day): the waste of those who live round it,
  as far as it reaches the water. All of them where it drinks from a well among its houses (the
  cesspits seep in); half where it drinks from a river or a lake. On a river, the waste of every place
  of twenty or more within 10 km upstream comes down too, less the further up (`riverDirt`, which
  way each river runs from 15.5b1). `v.foul` = load / (load + 2,000): a hamlet of 50 drinks nearly
  clean water (0.02), a town of 1,000 at a well 0.33, a city of 5,000 at one 0.71.
- **What it does.** Foul water kills (the flux, typhoid, the fevers): up to 3 deaths in a hundred a
  year at the foulest, times frailty, so the young, the old and the hungry most. A town of 1,000 at a
  well loses about one in a hundred a year, as the fixed toll did, and a city about two to three. A
  sickness starts up to four times as often where the water is foulest, and passes up to twice as
  readily in conversation.
- Deaths of foul water draw from a stream of their own (`RD`), so a world goes the way it would have
  gone until somebody dies of it. Drawn from the main one, every world was different from its first
  hour and six tests' seeds stopped holding.
- `stats().foul` counts the deaths of foul water (they are also counted as `sick`). Every village has
  `foul` and `foulLoad`.
- **A setting**, "Dirt in towns", by Sickness. "A fixed toll" is the world 15.5b4 left, step for step
  (`test/dirt.test.mjs` holds a fingerprint of it, and the older fingerprint tests now use it).

**Measured** (a year each, against 15.5b4). Six default worlds: 3 deaths of foul water in all;
sickness deaths 81 → 93 (seed 6 alone 19 → 28), infections 2,116 → 2,239. Three starting cities of
3,000 on 40 km: 33 deaths of foul water, sickness deaths 480 → 432 (most die in the first outbreak,
and the city has scattered to about 900 within a fortnight, old and new alike). Two worlds of market
towns of 3,000 (measured before foul deaths had their own stream): 9 deaths of foul water, sickness
deaths 263 → 279. No place stayed a town all year in any of these, so the old
toll and the new causes both did little. Speed: `bench.mjs --quick` alternated twice, within drift
(5,000: 2.71/2.97 → 2.81/2.76 s a day, a busy machine).

**Left out:** sewers, clean water brought in, and wells dug away from the houses, as things a village
builds (15d); waste on the streets as something seen; a sickness that lives in the water itself
(cholera) rather than passing between people; one house's well against another's.

### Bandits on land (2026-11-21)

TODO item 15.5b4. Ric (2026-11-20), from 15i's research: the hungry, the landless and the dishonest
may choose to take for a living, from carts on the roads and from weakly held villages, weighed like
any living and rising by itself in hard times. Nothing starts a band and nobody is placed as a
bandit; those robbed hold it against them. Hobsbawm's bandits (*Bandits*, 1969) came out of the
peasantry in times of impoverishment, crisis, war and conquest, went back to it when times mended,
and were few; "most Robin Hoods were far from noble" (research notes under 15i in `TODO.md`).

- **Who takes it up.** A living is weighed as before (`chooseJob`), and now robbing is weighed
  against the best honest work (`wouldRob`). It needs hard times (`hardship`): hunger above all,
  and with it nothing put by and no coin, no house, or a war's ruin (their village struck or fled
  from, or conquered). Hunger or ruin has to be there to start it. The less honest the likelier
  (nobody of honesty 0.7 or more), the bolder somewhat. It also needs something within a day's walk
  to take (`preyFor`: other places' stores weighed by how weakly they are held, and a road out),
  and few at it already: past about one grown-up in twenty a village's bandits find nothing more.
  The hungry and dishonest think about it oftener than about their living in general, and a bandit
  who is fed thinks about stopping about once a month. A village so short that everybody is sent to
  the fields sends its would-be bandits there too.
- **On the road.** A bandit spends a day lying in wait (`roadOf`: a third of the way to the place
  their village's carts go most, at least 2 km out), by daylight, while short of food. A cart that
  passes within half a km, not of their own village and not a soldier's, loses its food (up to ten
  days' worth) and four tenths of the carter's purse. The bandit goes home with it and lies low
  for three days. The carter holds it against them, as any theft.
- **As a band.** Once a day a village with three or more bandits fit to ride may send them out, at
  most every twenty days. They ride for the store within 15 km worth most against what holds it, never
  their own, never a walled one, never where yesterday's soldiers at hand are as many as the band.
  If the soldiers there are two to their three, they are driven off and bruised. Otherwise each takes
  up to ten days' food, the band no more than a third of the store, the faction's grain in its share.
  A few of the place's people hold it against each of them.
- Nothing is made or lost: what they take is somebody's food and coin. Events "Bandits" on the page,
  the occupation Bandit in the people list, and `stats()` counts `banditry`, `waylaid`,
  `banditGrain`, `banditCoins`, `banditRaids`, `banditsDriven`.
- **A setting**, "Bandits", under Power (with coins only). Off, the world is the one 15.5b3 left, step
  for step (`test/bandits.test.mjs` holds a fingerprint of it; `test/riots.test.mjs` now runs with
  bandits off).

**Measured** (a year each, against 15.5b3). Six default worlds: 1–4 took to robbing in each, in the
hungry months, and most were back at honest work by the year's end; 20 robberies on the road in all,
no raids; starved 12 → 19 in all six, but seed 4's 2 → 6 came with no robbery at all, so most of it is
noise (a different world from day 30; seeds vary by ±5). Eight starting cities of 1,000: 1–12 took it
up, 1–58 robberies on the road each, 2 raids in all; starved 9 → 3. Speed: `bench.mjs --quick` alternated twice, 400, 2,000 and 5,000
the same within drift (5,000: 1.80/1.81 → 1.81/1.84 s a day).

**What measuring changed.** The first build weighed robbing before a short village sent everybody to
the fields, and let the hungry rethink their whole living twelve times as often. In eight cities that
starved twice as many: towns lost their farmers to the road, the hungry went into the army in
numbers and starved there, and one town of 200 had 28 bandits. Now robbing comes after the fields,
the frequent rethink is only "rob or not", bandits are capped at one in twenty, a bandit robs at
most every three days and only while short, and a band takes a third of a store at most.

**Left out:** leaders hunting bandits down (offices are 15c: a captain); bandits living apart in the
hills or forest; a band with a leader and a name; bandits remembered as heroes; pirates (15h).

### Food riots (2026-11-21)

TODO item 15.5b3. Ric (2026-11-20): "Yes they should", after asking "is it really just a hot
tempered thing?" The research says it is not. Riots came where people went short while they could
see food that was not theirs, among neighbours who knew each other, and most among those who bought
their bread. Most crowds took the grain and paid what they called a fair price (E. P. Thompson,
"The Moral Economy of the English Crowd", 1971; Bohstedt, *Riots and Community Politics*; the
research notes under 15.5b in `TODO.md`, with links).

- **Who comes out** is Granovetter's threshold model (*American Journal of Sociology*, 1978). Once a
  day, in a village where more than one in seven are going hungry, each hungry grown-up has their own
  share of the village that must be out before they join. It is higher for the patient, the loyal and
  where soldiers stand ready under a bold leader. It is lower for the hot-tempered, the well-friended,
  those who buy their food, and where the food is plainly being kept from them (carts of food leaving,
  the faction's grain in the store, rich larders). Counting up from the readiest, a riot happens only
  if enough come out to bring out the next, at least five and one in twelve of the grown-ups. Nothing
  starts one on a timer. The weak (half their strength gone) stay home, as famine riots faded once
  hunger had gone on too long (Ó Gráda on Ireland, 1846–47). With nothing in sight, hunger alone
  brings nobody out.
- **What they do.** Each takes four days' food, from carts setting off first, then the store, then
  larders holding more than a winter's need. They pay the owner a coin a day's food, the store's price
  in plenty, as far as their purse goes. A hot-tempered crowd (mean temper over 0.62) pays nothing,
  and those whose larders it opens hold it against them; now and then somebody is bruised, never
  killed. No coin or food is made or lost.
- **The leader answers by their nature** (`ruling`), whichever way they lean further. **Force** (as
  bold as they are past warm): soldiers sent from anywhere in the faction break it up, half of what was
  taken goes back into the store, some are bruised, and the crowd holds it against the leader by name.
  **Kindness** (as warm as they are past greedy): a week's food each from the store, the faction's
  grain first, then the treasury paying. **Neither**: nothing. What a leader does weighs on the
  crowd's loyalty (`p.wronged`, half gone in a season, as a forced sale weighs), and the engine
  already turns lost loyalty into a vote, an overthrow or a breakaway. A visitor ruling a faction
  answers by its relief.
- **A setting**, "Food riots", under Power (with coins only; a shared store has nothing to riot
  over). Off, the world is the one 15.5t left, step for step (`test/riots.test.mjs` holds a
  fingerprint of it).

**Measured** (a year each, against 15.5t). Six default worlds: 3 riots in all (seed 5: one, broken up
by soldiers; seed 11: two, both fed), none in the other four; starved 13 → 12 in all six, loyalty about
the same. Three starting-city worlds of 1,000: 3, 18 and 3 riots (seed 3's farming hamlets riot every
few weeks in the hungry months), 5 of them rough; soldiers broke up 9, leaders sent grain for 2, and 13
were left alone; starved 1 → 1. Speed: `bench.mjs --quick` alternated old and new twice, 400 and
2,000 the same, 5,000 2.10/2.16 → 2.15/2.20 s a day (within drift). The check is once a day and only
in a village already going hungry.

**Left out:** riots over anything but food (taxes, a leader's choice); a riot spreading by news to the
next town (riots came in waves); a leader fixing the price by law afterwards (the "assize of bread");
hangings. Bandits are 15.5b4, above.

### Treasuries that can pay: the harvest tax (2026-11-21)

TODO item 15.5t, found by 15.5b2. A ledger of every coin in and out of the treasuries (default world,
seed 11, 120 days) showed why every treasury was empty: the only tax was on sales through a village
store, and most food never passes through one — a farming household eats what it grows. Even at its
top of 60%, reached by day 90 of peace, it brought in about half the soldiers' wages. Ric: leaders
"can tax what they want lol just like real life", the share moved "By the leader's traits".

- **A tax on the harvest** ("Tax on the harvest at the start", default a tenth; none means none,
  ever, and then the world is the one before). A share of everything reaped goes into the village
  store as **the faction's grain** (`v.levy`, days of food). States of the past took most of what they
  took from the land, in kind where little money ran: the tithe was the tenth sheaf, lamb and cheese
  ([*Leges Edwardis Confessoris*](https://sourcebooks.web.fordham.edu/source/1115Ledwtith.html);
  [Tax in kind](https://en.wikipedia.org/wiki/Tax_in_kind)), the land tax the "backbone" of Byzantine
  revenue, and in kind because coin was scarce ([Slantchev, "Revenue"](https://pages.ucsd.edu/~bslantchev/courses/ps143a/05%20Revenue.pdf)).
- **What it pays for.** The faction's grain sold from the store pays the treasury, not the till (its
  share of every sale of food, in proportion); a soldier the treasury cannot pay in coin is paid a
  day's food from it; soldiers going on campaign are fed from it first, for nothing; and so is
  relief for those who cannot pay (added after the measurements below, found reading the diff:
  the treasury had been paying the till for its own grain). Its grain
  is never more than the store holds. (Owed to the treasury as coin instead, it was never paid: by
  day 300 every till was empty, all 4,200 coins in the world were in people's purses, and the stores
  held 18,700 days of food nobody needed to buy. Measured.)
- **The leader decides it once a year, as the reaping begins**: a chest (`f.chest`) of a year's
  soldiers' wages, more by as much as they are greedier than warm (up to a year and a half), less
  what is in hand — coins, and the faction's grain at what the store pays for it — over what the
  fields gave since the last reaping; at most half. (Moved a point a day, it rose to half the harvest
  in winter, with nothing to reap; a warm leader content with a quarter of a year's wages could not
  pay their own army by spring; and grain counted at a coin a day, when year-old grain sold at a
  third of that, made leaders think themselves rich. All measured.) The coins in that chest are not
  "spare" for the daily rule that sends a treasury's spare coins back to the tills.
- **Felt by those who pay it**: a farmer's loyalty falls with the share as everybody's does with the
  tax on sales. A leader may take half the harvest; their people answer as they would.
- **A faction you rule** has "Tax on every harvest" beside "Tax on every sale"; the faction list
  shows both.

**Measured, a year each, six seeds, against the engine before (15.5b2).** The default world: tax on
sales, the year's mean, 0.49–0.55 → 0.14–0.33; days a treasury held less than a coin 61–85% →
14–34%; loyalty 0.62–0.66 → 0.76–0.89; soldiers kept 6–8 → 8.5–9.5; starved 0 in five seeds either
way, 9 → 10 in the sixth. **The price of it: the leaders took 26–38% of the harvest**, to keep
eight in every hundred under arms. Rome kept about one in a hundred and took perhaps a twentieth of
output (Duncan-Jones: the army 60–80% of the empire's spending; pre-modern states commonly 5–7% of
output, Song China 12–15%, [Economics of the Roman army](https://en.wikipedia.org/wiki/Economics_of_the_Roman_army);
[Warwick CAGE](https://warwick.ac.uk/fac/soc/economics/research/centres/cage/news/podcasts/ma-east.pdf)).
So the share is what that army costs, not a number tuned; the start's 8% under arms is a setting.
The treasuries still run short before the harvest in some years, when the fighting season (14e)
nearly doubles the army each autumn. A starting city (as 15.5b2): it ended with 140–305 people
against 172–404, starved 2 against 10 in all six, tax 0.17–0.29 against 0.50–0.56, grain carted in
103–1,826 days against 0–388; it empties by people moving out, and few stay hungry long enough for
a public order (0–475 days bought). `test/treasury.test.mjs`; with no harvest tax, `rivers` and
`wartime` hold the world as it was.

### The government's grain (2026-11-21)

TODO item 15.5b2, the second of four parts of 15.5b. Before this a leader's only help to the hungry
was relief bought from their own village's store, which did nothing once that store was empty; and
a carrier took grain only where the households going short could pay for it. So a poor city was
never sent grain, however full its leader's treasury. Ric: the way it reaches people should have
"options based on the type of ruler there is"; hard leaders force hoarders to sell; laying grain in
ahead "Both, by traits".

- **A public order for grain.** Once a day a leader may set coins from the treasury aside in a
  village of theirs going short — as many hungry as the engine already calls "food is dear", a
  sixth of its people. (Households short of a fortnight's food are most of any village most of
  the year; an order on that tied every treasury up in every village, measured.) The coins stay on
  the village, so none is made or lost. A carrier of any people, by cart or boat, sees them as
  buyers there, as it sees the households' purses; after selling door to door, what is left goes
  into the store, paid from them. Florence did this in the famine of 1328–30: grain fetched from
  Sicily, 60,000 florins from the city's purse, sold at what the poor could pay
  ([Giovanni Villani](https://en.wikipedia.org/wiki/Giovanni_Villani);
  [Nanni 2019](https://flore.unifi.it/retrieve/e398c37f-4b86-179a-e053-3705fe0a4cff/Nanni%202019_Facing%20the%20Crisis%20in%20Medieval%20Florence.pdf)).
- **How much, from the leader's stats** (`ruling`, so an elected leader leans to the people): of
  what the treasury holds beyond three weeks' soldiers' wages, a share of warmth times
  (1 − greed). Spending into the wages made the tax rule raise the tax to its top in a hungry city
  within two months, measured, so the wages come first.
- **How it reaches people.** In a village under an order, a household's next days of food from the
  store are a ration: the treasury pays as much of the price as the leader is warmer than greedy —
  nothing (the greedy sell at the store's price), cheaper, or all of it, a dole like Rome's
  ([Cura annonae](https://en.wikipedia.org/wiki/Cura_annonae)). Only the next days, not a
  winter's laying-in. Relief for those who cannot pay is as it was.
- **Hoarders made to sell.** A bold leader (over the middle) makes households holding more than
  their winter's store, in a village going short, sell the rest to the store at a fair price —
  what each would ask a neighbour, not the store's price in a dearth, which is pinned at its top
  and emptied the treasury in a month, measured — paid from the till, then the treasury. England's
  Books of Orders (1587, reissued in every dearth to the 1640s) had juries count each holder's grain
  and justices send it to market ([Slack](https://core-prod.cambridgecore.org/core/journals/transactions-of-the-royal-historical-society/article/books-of-orders-the-making-of-english-social-policy-15771631/77CAFBCE3647464DE4F0BD606B14B0CD)).
  The engine's `hard` trait is hard-working, so "hard" here is `bold`. Those made to sell hold it
  against the leader as a tax on that grain would weigh (`p.forced`, half forgotten in a season).
- **Laying in.** A patient leader (over the middle) also orders grain into the store in the three
  months after the reaping, up to 60 days a head for the most patient — the hungry months before
  the next harvest — as China's "ever-normal" granaries did
  ([Britannica](https://www.britannica.com/topic/ever-normal-granary)). It comes only from what
  households hold above their own winter, as any trader's does.

Nothing makes a city that cannot be fed live: where nobody within reach has grain to spare, no
order is filled. `test/grain.test.mjs` holds the order and that no coin is made or lost, the
greedy leader who makes none, the bold leader's forced sale (and the timid one's none), the
ration's share, and laying in by a patient leader only.

**Measured, a year each, old against new, six seeds each.** A starting city (2,000 people on
30 km, half of them in one city): the city ended with 172–404 people against 178–315 before (mean
246 against 258), starved 10 against 23 in all six; grain bought on public orders 0–89 days' food
in a year; hoarders made to sell 37–1,332. The default world: starved 0 in five seeds either way,
9 in one new; forced sales 0–170, public grain 0–19. Bench (`--quick`, two runs each way): within
this machine's drift (400 people 0.15 against 0.17 s a day; 5,000 2.12–2.33 against 2.12–2.13).

**So the city still fails, and not because of the land.** The public order is almost never
funded: in every world measured, old and new, the tax rises to its top of 0.6 within about three
months of peace and the treasury still sits near nothing, because the taxed trade does not cover
the soldiers' wages (default world, seed 11: four factions of about 100, 4 to 9 soldiers, tax 0.60
and treasury 0 to 95 by day 90). The city empties as before, its people moving out rather than
starving. That is its own piece of work, written into the TODO as 15.5t; with money in the
treasury the order works (the test).

### Rivers that run one way, and grain by boat (2026-11-21)

TODO item 15.5b1, the first of four parts of 15.5b. Ric: "Boats should be pretty important for
travel because it makes it easy but then the question goes of which way the rivers travel".

- **A river runs one way.** The way each river square drains was already worked out when the land
  is made (`riverTo`); a boat now uses it. With the current a boat goes at its full pace, across it
  at two thirds, and against it at a third. Upstream, boats were towed from the bank by people or
  horses, about 15 to 20 km a day (Neckar: about 20 km in five hours of hauling,
  [Wikipedia](https://en.wikipedia.org/wiki/Chain_boat_navigation_on_the_Neckar); Roman Rhine and
  Tiber about 15 to 20, [Viabundus](https://www.landesgeschichte.uni-goettingen.de/roads/viabundus/?p=939)),
  and downstream they drifted or sailed, two or three times as fast — a thin source for the downstream
  figure, said here so it is not mistaken for a measured one. A way over water is now the quickest,
  not the fewest squares, so the way down a river is not the way back.
- **Boats follow a river round its corners and past its fords and bridges.** Until then a boat moved
  only side to side between squares, so a river that ran corner to corner, as half of them do, had
  no way along it; and a ford or a bridge cut a river into pieces no boat could pass.
- **A landing can be on a big river**, not only a lake or the sea. Until then no river village could
  ever have a boat.
- **Grain by the boatload.** A village's boat carries ten carts of grain. A cart took half a tonne
  to a tonne (Langdon: "a ton was a very respectable load for horse-hauled transport"); boats on the
  Thames carried 60 to 200 quarters, about 13 to 45 tonnes ([London and Thames estuary
  study](https://archaeologydataservice.ac.uk/catalogue/adsdata/arch-3427-1/dissemination/pdf/general_guide.pdf));
  a village's own boat, fifteen person-days to build, is the small end. A grain trader at home whose
  village has a boat loads a boatload where the boat takes less time a ration than a cart — so a
  slow pull upriver can still lose to the road — and a village that would send grain better by water
  wants a boat, as people who want to cross water do (6d). River carriage cost about half what
  carting did in medieval England (Masschaele, *EcHR* 1993); here that saving is the time a ration takes.

Measured: the default world, which has no big river, is the same world (`test/rivers.test.mjs`).
On the longest big river of a 60 km land, a boat takes 1.9 hours down and 5.3 back up. **In a year
of three river worlds (60 km, 1,500 people, 16 villages) no village built a boat**, before or after:
few villages stand on water a boat can use (two to five of sixteen), and grain moved between
villages only 0 to 101 days' food in a year, and no village came to want a boat the three times it
takes to build one (how often it came close was not counted). So this part
changes nothing yet in an ordinary world. It is the transport the next parts stand on: a leader
buying grain from far off (15.5b2), and villages that grow where water is (the vision's "Water as
the reason places are where they are"). `test/rivers.test.mjs` holds the way down and up, the
corners and fords, and that a trader takes a boatload only with their village's boat.

### Wartime gear, and a marriage of your choosing (2026-11-21)

TODO item 15.5h, two things items 13 and 14 left out.

**Gear for a war is paid for or given.** Ric: it "must be payed for or donated. Nothings free".
In history the English crown bought arms in bulk — about 1.23 million arrows 1341–59 — by orders
spread over ordinary fletchers and outside suppliers, and paid for them (Richardson's thesis on the
Tower's armouries, [White Rose eTheses](https://etheses.whiterose.ac.uk/3919/1/Thom_Richardson_thesis_final.pdf);
[De Re Militari](https://deremilitari.org/?p=2105)). So:

- A soldier at war who needs a weapon or a shield mended or made takes it first from what the
  people have **given** for the war, then has the **treasury buy** it from the village store, as
  rations are already bought (`provision`). What the store has not got is left as an order (15.5a),
  and crafters make it as they make anything asked for. At peace a soldier still pays from their
  own wages, as before.
- At war, a **loyal** grown-up (loyalty over 0.6) who has more goods than the one they keep gives
  the rest, when they next shop, to their village for the soldiers' gear.
- A world with wars off is exactly the world it was (`test/wartime.test.mjs`).

Measured, four wars of 300 people, 120 days each, old against new: soldiers with a weapon and a
shield 90–97% against 92–97% (they were already armed out of their wages); the treasury bought 11
to 24 goods' worth of gear in each, the people gave 10 to 23 and 7 or 8 of it was used; battle
deaths 0–1 against 0–4. Treasuries in a long war end empty either way: wages drain them.

**A marriage of your choosing.** Ric: "The marriage button is for me so I should have ultimate
power." On the Factions tab, for a people you rule, each neighbour has **Arrange a marriage**: type
or pick any grown-up of yours and any of theirs (the leader and their family listed first, then the
unmarried), and they are married — 14d's marriage as it is, binding the two peoples, without the
other side's leave. Somebody already married leaves their partner on their own. Family cannot marry,
and a child cannot be chosen. At war, the marriage ends the war, as 14d's marriages to end a war do.
The news says it was on your word; it does not call a farmer "of one of the great families", which
is 14d's wording for its own choice, the richest.

### Made to order (2026-11-20)

TODO item 15.5a. A village store held hundreds of goods that nobody ever used: a crafter sold
everything past one good to the store, the store's price sat at its floor, and the bench still
paid, so crafters kept working. Measured on the default world over a year before the change: seed 1
made 30,103 goods and took 2,723 out of the store, seed 2 made 38,461 and took 1,217; the stores
ended the year at 38 and 54 goods a head, with about 15,000 more in crafters' own hands, unsold
because the till could not pay for them.

Ric's answers: households using goods up, **no** ("adding that will have little return for how
much that cost to track"); crafters make to order, **yes**; and when nobody wants what crafters
make, "What do people do in real life?" They took other work: one trade often did not feed a
family, and people combined trades, took day labour and went where work was (the TODO's research
notes, with sources). `choose` already weighs every living for everybody, so nothing new was
needed for that half.

- **An order** is left by somebody who wants goods the store cannot supply: a household with less
  than a sixth of a good and the coins for one, a worker whose tool, pack, weapon, shield or cart
  needs fitting or mending, and a house waiting on goods (with "One kind of goods"). Each person
  holds one order at a time, the largest they have wanted, at one village; it is filled when they
  buy, dropped when they die, and given up after sixty days. A village's `wanted` is the sum of
  its people's orders (`test/orders.test.mjs` adds them up).
- **A season's stock.** The store also keeps about what was taken from it lately: `used`, a running
  sum of goods taken out that falls by e⁻¹ in ninety days. That is the shop keeping what it sells
  in a season, not a cap: nothing is thrown away, and salvage from the dead can still put more on
  the shelf.
- **What a crafter can sell** is the orders plus that stock, less what is on the shelf, and no more
  than the till can pay for. A batch is made only up to that, plus one in hand; the bench is worth
  only the part of a batch that is asked for, shared between the village's crafters, so with
  nothing asked for it is worth nothing and people do something else. A house a household pays a
  builder for is an order too: a builder's wage keeps a crafter while there is one to build.
- **The price of goods** is dear while orders wait and cheap while the shelf holds more than a
  season's use: 2 at a full season's stock, between 0.6 and 9 as before.
- **Goods are carried only where they are asked for** and can be paid for. Without that, a village
  with orders waiting looked dear, and carriers took packs there that its empty till could not
  buy, and kept them: 20 to 37 goods each by autumn.
- **Households start owning goods**, of every age (a sixth to one good each, spread by id, so the
  world's dice fall as before). Everybody starting with nothing sent every household to the store in
  the first hours, and the orders it left set a season's stock several times what a village used.
- **A levy calls up any trade**, farmers and crafters first. It took only those two, and once
  crafters were few the faction in `test/rule.test.mjs` had taken to mining to a man and its army
  stalled at 3 of 25.
- **A rumour of sickness keeps people from going to load there**, not only from carrying there
  (12b's gap, found by `test/heard.test.mjs` once trade moved: hunters of other peoples kept going
  to the village named to pick up a load for somewhere else).
- The village panel shows **On order** beside Goods.

Measured, the default world over a year, after: seed 1 made 496 and took out 165, seed 2 made 577
and took out 177 (the rest is in households' hands, about 0.7 a head); the stores ended the year at
0.14 and 0.16 goods a head, about a season and a half of what was taken. Making goods fell from 4–7%
of grown-ups' hours to about 1%, and hardly anybody keeps "crafter" as a trade in an ordinary year:
the goods are made in spare hours by people who farm, herd and hunt, as Ric's answer expected. The
hours went to herding, hunting and rest. Over four seeds, a year each, old against new: 1,556 →
1,601 alive, 88 → 98 born, 7 → 3 starved, 37 → 0 dead of cold (crafters had been burning the wood
the fires needed: a batch takes wood), 8 → 15 in battle, 7 → 12 houses built, and the richest
tenth's share of the money 0.82–0.90 → 0.61–0.73. A winter with little put by (`stored` 0.2, five
seeds, thirty days) had a twentieth of the hungry hours.

Found on the way: the engine already had a function named `askFor` (asking a neighbour for food),
and the first version of this one had the same name; the later declaration won, and every order
asked a village for food instead. It was renamed `placeOrder` before anything was measured for
this section.

Cost: a few sums per purchase and per sale, and one pass over the houses being built per village
an hour, which was already made for materials. `test/bench.mjs --quick`, two runs each, old then
new: 2,000 people 0.89/0.85 → 0.84/0.84 s a day, 5,000 2.63/2.53 → 2.51/2.65; the 400-person row
read 0.16/0.13 → 0.18/0.19, but ten days of that world timed alone read 0.170/0.163 → 0.159/0.150
s a day, and none of the new code is in its profile — the row is noise at 0.03 s.

### Faster, the same world; and children past 3,000 people (2026-11-20)

TODO item 15.25. Ric asked for the performance audit's five passes and, separately, for births
past 3,000 ("Idk why births stop they shouldn't"). Every speed pass had to give the identical
world: each was checked by hashing the whole world (every person, every mind, villages,
factions, events with who told whom, conversations with their receipts, stores and holders)
after every day, old engine against new, in nine worlds: an ordinary country with orders given
from the page (ruling, war, tax, peace), 2,000 on 17 km, a town, two old enemies at war for 40
days, 150 days through winter, 400 on 500 km, 5,000 on 40 km, 20,000 on 80 km, and
conversations kept light. All nine were the same, hash for hash, before the births change.

**Measured first** (CPU profiles, seed 7): at 5,000 people the step itself (`act`) is a fifth of
the time and conversations another fifth, half of that the receipts; at 20,000 the land search
(`landWay`) is 15% and the crowd search (`routeAround`) 9%.

1. **Conversation receipts** (`converse`). What each of the two was before is kept as numbers in
   two rows used again and again, made into the receipt only once something has been said, and
   what each is after is read off them and compared directly instead of building a second
   receipt. The receipts and effects are field for field what they were. The rolling list of 160
   exchanges drops its oldest with `shift` rather than cutting a new array.
2. **The two searches.** The land search keeps its queue in typed arrays between searches; the
   crowd search keeps its places, costs, "does a body fit here" answers and nodes in fixed
   arrays (a table of 16,384 rows emptied by moving on a round number; an 800-look search reaches
   at most 6,401 places), in place of two new `Map`s and an object a place. Same order, same
   ties, same ways. A 20,000-person day: the crowd search 2.9 → 1.6 s, the land search
   0.99 → 0.90 s (timed by wrapping them). `Math.hypot` is kept: it is not the same number as
   `Math.sqrt(x² + y²)` (35% of whole-number pairs differ in the last place), and a different
   estimate breaks ties differently.
3. **Only waking whoever is due.** Measured, not built: passing over the sleepers is one look at a
   number each; an extra empty pass over 5,000 people cost about 5% of a day, a tighter loop
   gave no measurable change over three alternated runs, and an ordered list of who wakes when
   would have to be kept in the person order the engine depends on. Left as it is.
4. **The land sent to the page** (`people-host.js`, `index.html`). The keeper remembers what it
   last sent, and once the page holds a whole land it sends only the 64-square blocks whose
   crops or holders have changed; a square's crop is only worked out again when the engine's
   number for it has changed. The page writes them into its copy and paints only those blocks
   (and the halved copies round them); it paints the whole land again only when the colours
   change (a village changing sides, a faction's colour), not every time the villages are sent,
   as it did. An update the page did not take is answered at the next ask with the whole land.
   400 people on 500 km: 21 → 11 ms to prepare, 12.4 MB → a few KB sent. In the browser (headless
   Edge, a small land, a big one and a phone-width window), the picture painted block by block
   was checked against the same land painted whole every five seconds of Max: the same, value
   for value, including the halved copies. (Before the canvas is first read back, a few
   see-through wash pixels differ by one: the browser keeps a canvas premultiplied by its
   alpha, and the specification warns that reading it back is lossy; once read, never again.)
5. **Searches of everybody.** None was hot except: every search of a village's houses went
   through every house in the land (now each village keeps its own, in the same order); a
   village founding a new one looked through everybody for each family's children (now once);
   the census read the ten traits through a list of names (now by name: 0.15 → 0.11 s a day at
   20,000).

**Births past 3,000.** `reflect` had `people.length < 3000` among the conditions for a child: a
world started bigger never had one. Gone; age, a partner at home, food, crowding and the
Children setting still decide, and Children at nought still means none
(`test/births.test.mjs`). This changes every world that reaches 3,000, and its cost is the extra
people, not the engine (speed log).

**A bug the audit found.** With births at 3,300 people the engine's own audit stopped: somebody
passed over as listening was left standing after the one speaking to them had been drawn into
talk with somebody else. The old engine did it too, with no births (two seeds in five at 3,300,
and two old enemies of 300 on their sixth day): passing people over was not, there, the same
world as visiting everybody. `said` now wakes whoever either speaker was talking to before. Worlds
where it happened differ from before from that hour on, and are now the same as with everybody
visited every step (`test/dozing.test.mjs`, "left listening").

Sources: Brown, R. (1988), "Calendar queues: a fast O(1) priority queue implementation for the
simulation event set problem", *CACM* 31(10) ([abstract](https://www.maths.tcd.ie/~eoin/index/brown_calendar88.html))
— the event-scheduling idea weighed and not needed for pass 3; Amit Patel's
[A* implementation notes](https://theory.stanford.edu/~amitp/GameProgramming/ImplementationNotes.html)
(an array heap, inserting again rather than changing a priority, as both searches already did);
MDN, [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
(a buffer handed over belongs to the other side, so the keeper keeps its own copy of what it
sent) and [`putImageData`](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/putImageData)
(painting a dirty rectangle of a kept image); on premultiplied alpha,
[Mozilla bug 389366](https://bugzilla.mozilla.org/show_bug.cgi?id=389366).

### Each people's ways, by its own nature (2026-11-20)

TODO item 15a, the groundwork for government (15c), faith (15g) and marriage (15b). Ric: "the
most influential people what morals and stats they have should decide … sometimes those
decisions change their stats if their young enough or the thing that happened was a big enough
deal." Before this every faction began from the same ten sliders, every event moved everybody by
the same amount whatever their age, and an elected leader's nature was simply pulled toward the
middle.

- **A faction's own nature.** Under Their nature the setup page has a tab for All and one a
  faction. All is the ten sliders as before. A faction's tab shows the same ten, starting from
  All; moving one sets that faction apart, and moving it back drops it. The link carries it as
  `own=2.temper=0.9,…` (the faction, the slider, the value). "How much they differ" stays one for
  the world. A world nobody sets apart starts person for person as it did
  (`test/ways.test.mjs` keeps the old engine's fingerprint), and setting one faction apart
  leaves every other faction's people exactly as they were.
- **Customs come from the stats of whoever has the say.** Nothing new is tuned. What a faction
  does was already decided from its leader's nature: a chief or the richest by their own, which
  is how a grasping people's chief comes to keep the land for themselves (five of six seeds, none
  for a content people). A leader the people can vote out was half their own nature and half
  "ordinary"; the other half is now **the people's own**: their grown-ups' average, counted
  with the census every six hours. So a hot-tempered people's elected leader acts
  hot-tempered (Ric: "Lean to the people"). Every trait a leader's decision reads (bold, warm,
  greedy, honest, patient, hot-tempered) goes through this. People copy those they admire and
  follow ([Henrich and Gil-White 2001](https://pubmed.ncbi.nlm.nih.gov/11384884/)), but a people's
  values change mostly as one generation replaces another (Inglehart): here a people's customs
  move only as its people move or are replaced — events, deaths, a new leader, a revolution,
  children who take after their parents. 15c adds the council and great families who share the say.
- **An event moves the young more, and a bigger one more.** How much a hard event moves somebody
  is one minus how stable personality is at their age: 0.31 in childhood, 0.54 at college age,
  0.64 at thirty, 0.74 from fifty ([Roberts and DelVecchio 2000](https://stafforini.com/works/roberts-2000-rankorder-consistency-personality/)),
  over its value at thirty, so a thirty-year-old moves as everybody did before. Nothing before
  six: war left no measurable mark on children younger than that, and only a muted one on older
  adults ([Bauer, Cassar, Chytilová and Henrich 2014](https://coevolution.fas.harvard.edu/publications/wars-enduring-effects-development-egalitarian-motivations)).
  So a six-year-old moves 1.9 times as much as before, a twelve-year-old 1.6, a sixty-year-old
  0.72: a child two to two and a half times as much as the old. *Size* is plain proportion, since
  no study found gives a dose curve (the meta-analysis of life events,
  [Bühler et al. 2023](https://boris.unibe.ch/185539), tested none): a parent lost counts twice
  any other death; a house burned in a raid is a raid of its own for the household; every week
  without food after the third day is another famine; a war lost is felt by the whole people.
- **A war lost** (Ric: "A war lost"). At a peace, the side that lost more places than it took, or
  that pays for it, is shaken as a raid, all of it, times one plus the share of its places it
  lost; a faction that falls has lost everything (twice). No study found separates losing from
  living through a war, so the raid's own changes are used. Counted in `stats().warsLost`.

**Measured.** A year of the default world, eight seeds (1–7, 11), before and after: 11 starved
both times; people 3,143 → 3,151; wars 28 → 29; raids 86 → 79; quarrels 1,087 → 882 and fights
632 → 497; killed in battle 7 → 22 (a handful a world, so noisy). Average traits at the year's end
moved by no more than a few hundredths. Checked on the page: the tabs, a link that carries one
faction's nature, moving a slider back to All, fewer factions than an open tab, a phone-width
window, and a world started from such a link.

### Walls, sieges, raids and the fighting season (2026-11-20)

TODO item 14e. Before this a side at war tripled its soldiers in three months, to about a quarter
of its people, and kept them under arms the whole year; an army went for one place of each enemy at
a time and nothing else; no village had a wall; and weariness grew with the dead, the years and the
hungry, never with who was winning.

- **The fighting season.** Soldiers were farmers: feudal service ran forty days a year, and a
  campaign was fought between sowing and harvest. At war, in spring and summer before the crop is
  ripe, a side calls up to a fifth of its grown-ups (`WAR_ERA.campaign`), at about 2% a day; from
  harvest to the end of winter it keeps only a few (`WAR_ERA.standing`, 4%) and the rest go home.
  The army marches only in season; garrisons in places taken stay all year.
- **Raids.** Besides the army, every fifteen days a side picks the open enemy village within thirty
  squares that has the most food and people for the fewest defenders (never the army's own target)
  and sends a band of one soldier in five at it for five days. A band burns houses (a third of a
  house for each raider, against a tenth for an army), spoils crops and carries off stores, and wins
  against a village's grown-ups alone if it outnumbers its soldiers and the place has under half a
  wall. It does not take the place. Raiding the countryside, not besieging it, was most of medieval
  war: the chevauchée (https://en.wikipedia.org/wiki/John_of_Gaunt%27s_chevauch%C3%A9e_of_1373 ),
  the Border reivers (https://www.historic-uk.com/HistoryUK/HistoryofScotland/The-Border-Reivers/ ),
  the people of France in the Hundred Years War
  (https://www.medievalists.net/2009/12/the-experience-of-civilian-populations-during-the-hundred-years-war-in-france-1330-1440/ ).
- **Walls.** A village raises a wall in wartime when danger has come near (enemies at its edge in
  the last sixty days, or a raid on it in the last year) and nobody is attacking it that day, as
  towns raised murage to build theirs (https://gatehouse-gazetteer.info/murage/mur/441.html ). It
  takes about thirty days and its stone (else spare wood, else goods): ten and half a unit for each
  person. A full wall doubles a village's defence (`WAR_ERA.wallWorth`) and adds twenty days to a
  siege (`WAR_ERA.wallHold`); a place taken keeps half its wall; at peace a wall falls back over
  four years. A siege could take months (Kenilworth, 1266, about six;
  https://www.english-heritage.org.uk/learn/story-of-england/medieval/siege-warfare/ ); these are a
  village's walls, not a castle's, and set higher they stopped every place being taken at all.
- **Who is winning.** Each side counts the places it has lost and taken and the crop spoiled on its
  land in this war. Places lost add to its weariness (more for a small people), places taken take a
  little off, and spoiled fields add as much as a fifth of a year's food would. A side that has lost
  places to an enemy that has lost none, and is a little past its mark, yields: peace, with tribute
  more often than not. Between equals it comes to nothing, so even wars still run long, as they do
  (Bennett and Stam, "The Duration of Interstate Wars", APSR 1996).

All of these are numbers in `WAR_ERA` at the top of `people.js`, so item 15 can set them for each
age (all year, no season and walls worth little for a modern army). The page draws a grey ring round
a village with at least a quarter of a wall.

Measured. Forced wars (600 people, three tribes, one declares on another, thirteen seeds, two
years), the 14d engine against this one: soldiers 30–46 all year → about 25–30 in season and about
10 out of it; places taken 50 → 7; starved 304 → 88; raids burned houses without any siege in 9 of
13 worlds; wars ended within two years 13 → 11. Wars where one side took places ended on days 368,
420 and 499; even ones mostly on days 600–708, and two not in two years. A default year, eight
worlds: starved 48 → 21, alive 2,997 → 3,139, killed in battle 109 → 8, places taken 16 → 2,
houses burned 244 → 50 (36 of them by bands), 54 walls raised, peace made 4 → 0 times within the
year (wars are fought less hard, so they tire later). Not done: a wall costs materials, not
people's hours; bands carry off stores only where there are any, and in these runs there were none
to take. Test: `test/walls.test.mjs` (slow, about eight minutes).

### What a war leaves (2026-11-19)

TODO item 14b. Ric: "i want the aftermath of war to be accurate too." Before this the dead already
left heirs, grief and orphans who were taken in (`die`, the census), a widowed partner grieved, and
a place taken changed hands with some of its people fleeing for good (`capture`). But an army did
nothing to the land it stood on, and nobody ran from one until the moment a place fell.

Now, once a day, for each village with enemy soldiers at its edge (counted already for the siege,
in `villageTurn`):

- **Crops spoiled** (`ravage`). Each enemy soldier spoils a share of the standing crop on its
  square and the eight round it: 10% a day while it is green (trampled and cut, slowly), up to 60%
  when it stands ripe (burned). Grain burns only in a short window, ripe and dry (Thorne, on
  Hanson's *Warfare and Agriculture in Classical Greece*:
  [GRBS](https://grbs.library.duke.edu/index.php/grbs/article/download/1861/3491/0)).
- **Houses burned** (`burnHouse`). While the enemy has the upper hand there by the siege's own
  measure (more of them than its soldiers and the quarter of its grown-ups who take up arms), a
  house burns for about every ten of them a day, the outermost first. Its household loses half the
  food it had in it, which goes into the soldiers' packs, as raiders fed themselves on what they
  took ([the chevauchée](https://historyskills.com/classroom/year-8/chevauchee)). They sleep in the
  ruin and build it again by item 7b's building, from nothing. The page draws it as a charred floor
  until somebody starts on it.
- **A place taken is sacked** (`sack`): half its store taken or spoiled, a quarter of its houses burned.
- **Running, and coming home** (`flee`, `comeHome`). While a place is under siege, households run,
  the frightened and the less bold first, about a quarter a day, to the nearest village of their own
  faction with no enemy at it; soldiers and the leader stay. A week after the last enemy left its
  edge they come home, if it is still their own side's. A village everybody fled stands empty for
  them rather than dying out. People fled to walls and towns
  ([Jean de Venette, and the civilians of the Hundred Years War](https://www.medievalists.net/2009/12/the-experience-of-civilian-populations-during-the-hundred-years-war-in-france-1330-1440/)).

No deaths are added by rule. Most of a war's dead were of hunger and disease, not battle (the
Thirty Years' War: [germanhistorydocs.org](https://germanhistorydocs.org/en/from-the-reformations-to-the-thirty-years-war-1500-1648/estimated-casualties-during-the-thirty-years-war),
[Outram](https://eprints.whiterose.ac.uk/id/eprint/385/1/outramq1.pdf)). Here they come from the
spoiled crop, the store taken and the crowding of refugees. How long the land takes to recover is
not a number either: the Harrying of the North left about 60% of Yorkshire waste in Domesday twenty
years on ([Wikipedia](https://EN.wikipedia.com/wiki/Harrying_of_the_North)); here recovery is
houses rebuilt by their households and fields that grow back as they always do.

Tried first, and changed: houses burned and households ran whenever more enemy soldiers than the
place's own stood at its edge. In a default year (eight seeds) that starved 89 against 47 and let
households leave at the first raider. Now it is the siege's measure for both.

Measured. Forced wars (600 people, 40 km, three factions, 0 and 1 at war from day 1; wars on
everywhere, so the third may fight too), six seeds, two years:

| | Wars off | War, before | War, now |
|---|---|---|---|
| Harvest in year two (days of food, a world) | 212,000 | 170,000 | 167,000 |
| Births in year two (six worlds) | 175 | 113 | 111 |
| Children under two in factions 0 and 1 at the end | 235 | 117 | 139 |
| Starved (six worlds, two years) | 3 | 61 | 125 |
| Villages taken | 0 | 222 | 131 |
| Houses burned | 0 | 0 | 1,334 |

A war thinned the next harvest by about a fifth and the next year's births by over a third before
this item too, from the dead and the hands taken; now it also burns, spoils and empties places.
A default year (eight seeds, at war about half of it), before → now: starved 47 → 72, villages taken
11 → 25, killed in battle 113 → 122, births 147 → 151, harvest the same (919,000 → 924,000 days of
food); 395 houses burned, 391 people fled and 38 came home within the year (most wars there do not
end inside a year). Villages are taken twice as often because a place whose crop is spoiled goes
hungry and its people leave for food, so it falls: switching off each part in turn (fleeing, the
sack, the plunder, the spoiling) left 22–31 taken in every case, and switching all off gave the old
worlds exactly. Cost: only villages with enemies at them do any work; the bench is unchanged.
Test: `test/war.test.mjs`, "What a war leaves".

### Wartime effort, not only fear (2026-11-19)

TODO item 14a. Ric: "wartime fear should be bad but that should also make people do stuff as well
like try harder for more supplies and stuff". Until now a war anywhere raised `p.fear` for everybody
in the faction, however far off, until it was full; fear only ever counted against work, so a
faction at war sat at home and grew poorer. Measured on forced wars (600 people, 40 km, three
factions, two at war for 60 days, six seeds): grown-ups of the two sides at war who were nowhere
near the fighting were afraid 96% of their hours and at work 23% of them, against 51% in the
faction at peace.

Now the two are apart:

- **Danger near is fear** (`live`). A siege on the village they live in; enemy soldiers at its
  edge (`v.foes`, counted each day with the siege); a raid on it in the last three days; a blow
  just taken. It empties the fields, closes the market and keeps people in, as before, but only
  there.
- **A war on is effort** (`urgency`). Everybody grown in a faction at war wants to provide up to a
  fifth more (the loyal most: `0.6 + 0.4 × loyal` of it), wants rest up to 12% less, and their
  village aims for a store a quarter bigger than the winter alone asks — a store against a siege.
  The army raised, the levy taken from the farms and the leader's tax to pay it already grow in a
  war (items before), so its cost is hands away and what is taken, not idleness.

Why: a medieval war burned a band 20–40 km wide along an army's march, and people in its path fled
to walls while those away from it saw little ([John of Gaunt's chevauchée of 1373](https://EN.wikipedia.com/wiki/John_of_Gaunt%27s_chevauch%C3%A9e_of_1373);
[the chevauchée](https://historyskills.com/classroom/year-8/chevauchee)); towns asked for murage to
mend walls when the enemy was near ([murage](https://www.wikipedia.org/wiki/Murage)); and a nation
at war grew more at home — Britain 1939–45, vegetables up about 55%, potatoes about 80%
([history.co.uk](https://www.history.co.uk/article/how-brits-utilised-allotments-during-two-world-wars-the-era-of-growing-your-own)).
Walls raised in wartime are item 14c.

Measured, the same forced wars, old engine and new:

| | Old | New |
|---|---|---|
| At war, away from the fighting: hours at work | 23% | 51% |
| — afraid | 96% | 5% |
| Enemies at the door: hours at work | 28% | 28% |
| — afraid | 86% | 92% |
| The faction at peace: hours at work | 51% | 51% |
| Food held by the two sides at war after 60 days (six worlds) | 28,700 | 39,100 |

So a faction at war, away from the fighting, now works as hard as one at peace while it also fields
a bigger army, and stores a third more than it did; a place with enemies at its door still works
about half as much. A default world is at war about half its first year, so this reaches it too: a
year, eight seeds, old → new, starved 116 → 47, alive at the end 2,822 → 3,017, killed in battle
176 → 113, villages taken 19 → 11, births 122 → 147. Cost: whether a faction is at war is worked out once an hour (`atWarAnywhere`, kept off the faction so reading it changes nothing visible) instead
of looked up through every faction at every choice; nothing per person.
Test: `test/war.test.mjs`, "Fear where the danger is".

### Leaders and factions that deal with each other (2026-11-18)

TODO item 13. Ric decided nothing up front. Until now factions either left each other alone or
went to war, and a leader was the boldest person with the most friends.

- **How the factions start** (a new setting under War: old friends, strangers, old enemies).
  Old friends start allied, and trading free of tax if there is money. Old enemies start with a
  feud: an old wrong (a village burned, fields taken, herds stolen) that every grown-up "grew up
  knowing", held as long as a grudge (half gone in five years) and passed to their children.
  Between the factions there is now an old **bond** as well as today's opinion: the opinion
  drifts toward it, and it fades by half in about ten years. A war's dead deepen it.
- **A new preset, "Two old enemies"**: two factions, old enemies, a coin a head. Ric's "two
  tribes that hate each other with almost no money", from the setup page alone.
- **Short of war.** A leader who wants something of a weaker neighbour may demand tribute
  instead of fighting: the more patient the leader, the likelier. The other side pays if it is
  outmatched and its leader is neither bold nor hot-tempered enough to refuse. Tribute is a
  share of its stores and treasury each day, carried to the nearest village of the other side,
  and resented; it stops when the payer feels strong enough. A refusal is an insult, and the
  threatened side keeps more soldiers. A war lost can end in tribute.
  **Alliances** form against a common enemy or between old friends; warm leaders make them.
  When an ally is attacked, its allies are called: each comes as its leader is bold and as it
  likes the attacked, or the alliance is over. **Trade deals**: no tax on each other's people,
  between neighbours who think well enough of each other; honest leaders make them.
- **What a leader does depends on who they are.** A hot temper makes a leader quicker to war and
  slower to make peace, a patient one the opposite and readier to demand tribute instead, and
  what the leader holds in mind counts: grudges against the other side's people (less any close
  friend there), and news of wars, villages taken and old feuds between the two sides, as the
  leader holds it. A leader who can be voted out shows half their own nature, a chief or the
  richest all of it. At the middle of both traits it is what it was before.
- **Who becomes leader.** The bold and the well supported as before, and now also those known
  for being generous, honest and hardworking. In a vote, people want somebody bold in a war or
  under threat, and somebody honest otherwise. A people who vote and have mostly turned on their
  leader (loyalty under 30%) call a vote early, at most once a year.
- **On the page.** The faction list says who is allied, friendly, wary or hostile, who trades
  free of tax and who pays tribute. Ruling a faction, you can offer an alliance or a trade deal,
  demand tribute and stop paying it; the other side answers as its own leader would. A feud on
  the person panel reads "Grew up knowing", and its trail ends "grew up knowing it".
- **Fixed on the way.** A feud did not last: the thousands of sales and friendly words between
  two neighbouring factions every day lifted what they thought of each other from −0.6 to +1
  within a year, and old enemies became allies. Now an old feud is all but deaf to everyday
  goodwill, an old friendship to everyday ill will, and traders do not carry goods to a people
  theirs is hostile to. And liking alone no longer makes an alliance: everyday talk leaves most
  neighbours liking each other, and with that every faction in a default world was allied to
  every other within a year and nobody fought.

Sources.
- Who leads in small societies: dominance and prestige both: physical strength and kin support,
  and generosity, skill and trustworthiness (von Rueden et al. 2008, 2014, the Tsimane of
  Bolivia; [2014 paper](https://www.gurven.anth.ucsb.edu/sites/secure.lsit.ucsb.edu.anth.d7_gurven/files/sitefiles/papers/vonruedenetal2014hn.pdf)).
- How they are removed: ridicule, disobedience, desertion and in the end the end of their
  leadership (Boehm 1993, "reverse dominance hierarchy";
  [paper](https://www.Gwern.net/doc/sociology/intrasexual-aggression/1993-boehm.pdf)).
- Why neighbours keep the peace: trade, intermarriage and shared ceremonies (the Upper Xingu
  peace system; Fry and others, [review](https://pmc.ncbi.nlm.nih.gov/articles/PMC4250129));
  tribute as a cost weighed against the cost of war.
- A leader's own nature in war: measurable traits of leaders predict how warlike their states
  are, more so where nobody can check them (Horowitz, Stam and Ellis, *Why Leaders Fight*, 2015;
  [summary](https://cambridgeblog.org/2016/03/what-motivates-leaders-to-go-to-war/)).

Measured.
- *Hot-tempered against patient* (two old-enemy factions of 150, chiefs, a year and a half, six
  seeds each, every leader of both factions set the same): hot-tempered, 5 wars, 1,790 days at
  war, 32 killed in battle, no tribute demanded; patient, 2 wars, 426 days, 8 killed, 2 demands,
  one paid.
- *Old enemies* (the preset): after 150 days every grown-up still held the feud and the factions
  still thought −0.63 of each other.
- *Old friends* (three factions, a year): allied and trading free of tax throughout, no war.
- *A default world* (sixteen seeds, a year, against the world just before): 364 alive against
  359, 10 starved against 12, 20 killed in battle against 22, 4.4 wars against 5.3; and now each
  world-year 1.6 alliances, 6 trade deals, 2.4 demands for tribute, 0.7 paid.
- *Speed* (`test/bench.mjs`, alternated twice): the same, every row (5,000 people 3.10 and 3.06
  s a day before, 3.16 and 3.09 after; the machine was loaded throughout, so slower than item
  12's figures).

### Talking as passing what you hold (2026-11-18)

TODO item 12. Until now news was an event's number: everybody on its side, or within 6 km, knew
it within hours, and chats passed on the newest. Now talking passes what people hold, and what
they hold can be wrong. Ric chose: a tale changes in the telling **"1 in 20"** times; gossip **"Yes,
cools only"**; children start with **"a mix of both"** (decided earlier).

- **Seeing and hearing.** Only those within 3 km of where something happened see it. Everybody
  else hears it from somebody: in a chat, whoever holds the newer news tells it, and the hearer
  believes it as far as they trust the teller (60% for a stranger, more for a friend or family,
  as little as 30% for somebody they dislike). What is said is what the hearer then holds, word
  for word.
- **Changed in the telling.** Each time it is passed on, there is a 1 in 20 chance (the "How often
  a tale changes in the telling" slider, never to 1 in 3) that it comes out changed: a number
  grows, or a harvest's share shrinks (sharpening), or a village or a side is swapped for another
  (assimilation; Allport and Postman 1947). The changed telling then travels as the true one did,
  so two villages can believe different things about the same event.
- **Acting on it, right or wrong.** News of a war or a village taken that names your side and
  another is a grievance against the other side as told: a wrong telling blames the wrong side.
  Somebody turned away when hungry is told where there is food ("Try Hesk, they had plenty") and
  goes to ask, whether or not Hesk still has it.
- **Gossip** (one chat in four between grown-ups, when nothing else came up). The teller says what
  they think of somebody they feel strongly about; the hearer moves toward it as far as they
  trust the teller. Bad words cool, but hearsay never makes an enemy (no lower than the snub of
  being turned away); good words warm a little and never talk anybody out of a grudge of their
  own.
- **Children** start with a weaker copy of up to four of each parent's strongest things: the
  parent's news, a larder they know of, and their feelings about others (a fifth to a third as
  strong; a parent's grudge no deeper than a snub).
- **Following it.** Every hearing is kept on the event, who told whom and when, for a year (up to
  400 an event). The person panel lists each piece of news with who told them, and opens to the
  whole trail back to whoever saw it, marking any telling where it changed. In a default world,
  news of a famine reached a village three away in four days, through nine people.
- **Also fixed on the way:** a full mind could forget the news it had heard a moment before, when
  the hearer then greeted the teller; what was taken in this hour is now never the first to go.

Sources.
- How rumours change as they are retold: leveling, sharpening and assimilation (Allport and
  Postman, *The Psychology of Rumor*, 1947; summary at
  [Wikipedia, Rumor](https://en.wikipedia.org/wiki/Rumor)). Field studies find much less
  distortion than the laboratory chains, and rumours in organisations mostly accurate (DiFonzo
  and Bordia, *Rumor Psychology*, 2007; [RIT summary](https://www.rit.edu/news/truth-about-rumors-and-why-we-believe-them)),
  hence 1 in 20.
- Spreading between people: the Daley–Kendall model of ignorants, spreaders and stiflers (1965;
  [overview](https://www.emergentmind.com/topics/daley-kendall-rumor-model)). Here a person
  passes the newest thing they hold to whoever they meet who has not heard it, and stops when
  they forget it.
- Gossip is what people pass on best (Mesoudi, Whiten and Dunbar 2006,
  [abstract](https://research-portal.st-andrews.ac.uk/en/publications/a-bias-for-social-information-in-human-cultural-transmission/)).
- Children taking on their parents' conflicts: beliefs about conflict correlate strongly between
  parents and children ([Psihologija 2021](https://doaj.org/article/6f74e2ee67174a7e8b9d2729a97ae7af)).

Measured.
- *A year, twenty-four worlds, against the world just before item 12*: 362 alive a world
  against 355, 11 starved against 13: being told where food is fed people no worse. Grudges 1.6
  an adult against 1.2, and fights 66 a world-year against 55, from children taking on their
  parents' (no deeper than a snub, but a fight deepens them).
- *News over distance* (four seeds, 120 days): the farthest village each event reached was 36 to
  54 km away, 1.5 to 4 days after it happened; in three of the four worlds two villages believed
  different tellings of the same event.
- *Speed* (`test/bench.mjs`, two runs each, against the world before item 12): 400 people 0.15 →
  0.15 s a day, 2,000 0.70 → 0.71, 5,000 2.09 → 2.28, 20,000 16.4 → 15.1, 400 on 500 km 0.20 →
  0.16. The 5,000 row, alternated four more times alone: 1.92 → 1.84 (the bench drifts 10%).
- *Memory*: 0.15 KB a person more right after a world is made (who told them, and which telling,
  for every slot); 0.27 KB more by day 120 (5,000 people: 4.42 against 4.15 KB), the record of
  who told whom.
- *Settings felt*: the decisions check now reads six seeds, not four; with four, "How much it
  grows" read 2.8% where ten other seeds read 4.1%.

### The mind: a fixed number of things a person holds (2026-11-17)

TODO item 11. A person had a list of up to ten friends and grudges, one piece of news and one
number for what they think about sharing. Ric: "a person can hold a certain number of bits of
information". He chose **20** things by default; people differing **"A little"**; and **"Grudges
last longest"**.

- **Slots.** Each person holds a fixed number of things (the "How much a person can hold" slider,
  6 to 60, 20 by default; it was "How many people they remember", 10). Each is one of: a feeling
  about somebody (a friend, or below nothing a grudge), the same about family, a piece of news, a
  larder they have seen with food to spare, a debt for food given them, and what they think about
  sharing (always held: what was `views`). A slot is a kind, who or what it is about, how strong,
  and when it was last refreshed. A full mind forgets its weakest thing to make room; a grudge or
  a family tie counts double there, so a soldier who calls twenty people close friends does not
  forget first the one man he hates.
- **People differ a little.** Each holds the number set, a quarter either way, taken after the
  parents (`p.mcap`), drawn from a random stream of its own.
- **Fading.** Nothing is worked out as time passes: how much is left of a thing is read off its
  age whenever it is read, halving over its kind's half-life. A friendship not kept up, a year;
  family and grudges, five years; a debt, five; news, a season; a larder seen, a month.
- **Decisions read the mind.**
  - *Asking for food* goes to somebody they know of: a larder they have seen with food to spare,
    by how much, or family and friends whose larders they have not seen, as worth a try; another
    village only for coin and only somebody seen to have plenty. Before, it was whoever in the
    village had most put by, read off every neighbour's larder, which nobody could know. Larders
    are seen by talking with somebody and by asking at the door.
  - *A debt is paid back*: somebody who owes the asker for food gives more readily, and the debt
    is then gone. Food given, in a hungry chat or at the door, is owed.
  - *A grudge* turns a chat cold: a cold word, and nothing warms between them. Until now every
    chat warmed any two people, and a grudge in a village of sixty was gone in a year of passing
    the time of day. The hot-tempered still go to have it out, now at most once a month at an
    ordinary patience (weekly, while grudges did not last, made a feud of every grudge: ten times
    the fights); half the quarrels that stay words leave things better.
  - Friends, family, news and belief are read from the mind wherever they were read before:
    visiting, moving house, voting, leaders, the friends of the battle dead, mood.
- **Storage.** Every mind is a block in four flat arrays shared by the world (kind, about,
  strength, when), not an object of its own; the dead give their block to the next born.
- **The person panel** lists what somebody holds, strongest first, in plain words, with how long
  ago: "Holds a grudge against Corl — 2 years ago", "Hesk had food to spare", "Heard: …".

Sources.
- How many people a person keeps track of, and in layers: about 5 closest, 15, 50 and 150
  (Dunbar 1993; Zhou et al. 2005). Twenty slots hold the inner two layers and a few things known.
- How ties fade: emotional closeness falls without contact, friendships much faster than family
  (Roberts and Dunbar 2011). Forgetting follows a falling curve with age (Ebbinghaus; Wixted
  2004); halving at a fixed rate is the simplest such curve.
- Bad things weigh more and are remembered longer than good ones (Baumeister et al. 2001), hence
  a grudge counting double when something must be forgotten.
- Fixed-size storage: struct of arrays, as data-oriented engines lay out many small records, so
  nothing is allocated per person and nothing need be copied or scanned beyond one person's block.

- **Five close at most** (2026-11-18). Ric, on friendships piling up: "do 5". Nobody is close
  (above half) to more than five people, family and partner among them, the closest layer in the
  studies. One more, and whoever of them is least close drops back to an ordinary friend.
  Twelve worlds a year, against the mind without it: 358 alive a world against 356, 15 starved
  against 18; close ties 3.1 an adult on average against 5.0, the most anybody had 5 against
  16 to 18. Fights rose, 313 a world-year against 220: the slots friends gave up hold grudges a
  little longer (5.1 an adult against 4.6). It saves no memory: minds stay full (20.4 slots used
  of 21), with grudges, news, larders seen and debts in the room. A smaller mind does not help
  either: at 12 things, people keep under two close ties, crowded out by the rest.
- **Turned away is not an enemy** (2026-11-18). Ric, on five grudges an adult: "fix the
  grudges". Nearly all of them came from being refused food: some 100,000 refusals a world-year,
  each a little bad feeling kept as long as a grudge. A refusal still cools things, so the
  hungry try somebody else next time, but on its own never below −0.3, short of the −0.35 at
  which people have it out or turn a chat cold. Enemies come from fights, theft, killing and
  bitter argument. Twelve worlds a year, against five-close alone: 357 alive against 358, 14
  starved against 15; grudges 1.1 an adult against 5.1 (half of adults hold none; 5% hold five
  or more, against 50%); 83 quarrels and 51 fights a world-year against 536 and 313. The chance
  a fight kills set again from the medieval rate (one in about 600 fights; about one killing in
  4,000 people a year). Tried and dropped: cooling only when the other had food to spare (42
  starved), and remembering who had none so as not to ask again (40): the hungry did worse
  without being pushed on to somebody new.

Measured.
- *A year, twelve worlds* (the same twelve seeds as item 10), against item 10: 356 alive a world
  against 359, 18 starved against 19: asking only those one knows of fed people no worse. People
  move house more, 248 moves a world against 168, with friendships fading when not kept up. With
  grudges lasting, about 360 quarrels and 220 fights a world-year (140 and 87 before), and the
  chance a fight kills set again from the medieval rate: one killing in about 4,400 people a year.
- *First tries, and what they taught*: with every chat warming any two people, a grudge of −0.9
  was a friendship of +1 two years later; then a soldier with twenty-two "close" friends forgot
  the one man he hated first, as the weakest thing he held; then, with grudges kept for years and
  the hot-tempered having it out weekly, ten times item 10's quarrels.
- *Hours* (`test/behaviour.mjs`, "How much a person can hold" 20 against 40): 2.0% of an adult's
  hours over four days, 2.8% over sixty.
- *Speed* (`test/bench.mjs`, two runs each, against item 10): 400 people 0.13 → 0.13 s a day,
  2,000 0.67 → 0.68, 5,000 2.08 → 1.92 (asking no longer reads every neighbour's larder), 20,000
  16.2 → 16.3, 400 on 500 km 0.14 → 0.14.
- *Memory*: in a world that has run a few days, less than before (5,000 people, the whole world:
  3.42 against 4.13 KB a person on day 3, 4.00 against 4.69 on day 30), the friends lists having
  grown and the minds not. Right after a world is made, which is what the bench's column reads,
  more: 0.80 → 1.29 KB a person by the bench (2.61 against 2.44 KB for the whole world), since the
  minds are there from the start.

### The ten traits, and what happens moving them (2026-11-17)

TODO item 10. People had five traits (bold, warm, greedy, stubborn, loyal), set at birth and never
moved by anything. Ric chose: a hard event changes a person **"A little"**; what people are like at
the start is **"Ten sliders"**; and a fight between neighbours kills **"Rarely, as in history"**.

- **Five more traits**: patient, hot-tempered, hardworking, curious and honest, each 0 to 1, drawn
  like the first five about the slider's middle by "How much they differ", and taken after the
  parents with the same stray. They are drawn from a random stream of their own, so each person's
  bold, warm, greedy and stubborn come out exactly as before (`test/traits.test.mjs` holds them).
- **What each changes**, every one a choice in `choose` and at its middle the old choice:
  - *Hardworking*: the wish to earn when nothing forces it is ×0.7 to ×1.3, and resting and
    visiting weigh 0.1 more for the idle and 0.1 less for the keen.
  - *Curious*: work outside their trade counts ×0.6 to ×0.84 against ×1.35 at their own (0.72 for
    everybody before); moving to another village and scouting a market weigh up to 0.15 more.
  - *Patient*: a household keeps back for the winter ×0.6 to ×1.4 of what it did (so sells less
    to the store and at market), and while the larder is short of the winter the patient weigh
    the fields, fishing, herding and hunting up to 0.25 higher and the impatient lower. They wait
    longer before having it out with somebody.
  - *Hot-tempered*: somebody who cannot stand a neighbour (feeling below −0.35) goes to have it
    out with them, at most once a week at an ordinary patience (once a month since item 11). Words, or between two tempers
    blows (a chance of 1.2 × their mean temper squared): bruises, both thinking worse of each
    other, and one fight in a thousand kills (one in 2,500 since item 11, when grudges began to
    last and fights grew to some 220 a world-year). The family of somebody killed holds it against the
    killer. Hot temper also counts toward soldiering and patrolling.
  - *Honest*: somebody hungry with nothing to pay with may steal from a neighbour's house with a
    fortnight put by, best by night, a third of what is over ten days (at most three days' food),
    at most every three days; weighed at (1 − honest)² × 2 of asking, and not at all above 0.7.
    Seen (most likely if they are home and awake), it is held against the thief. The old theft of
    another faction's grain by the starving and bold is now 0.6 × (1 − honest), 0.3 as before at
    the middle.
- **What happens moves them** (`shaken`), each a few hundredths of the range; half of it wears off,
  half again every two years (`settle`, every six hours), and half stays. Children start from what
  their parents have become.
  - *A raid* (enemies striking in the village, after a month without; a siege is one raid):
    temper +0.04, warm +0.02, patient −0.02, bold +0.01.
  - *Three days without food*: greedy +0.03, patient +0.03, honest −0.02, warm −0.02.
  - *A death in the family* (not of old age): bold −0.02, temper +0.02; a killing in battle or a
    fight, temper +0.03 more.
  - *Robbed and seeing it*: warm −0.02.
  - *A year without want or raids*: warm +0.01, temper −0.01, greedy −0.01, curious +0.01.
  Loyalty is not moved this way: it already follows how life goes, every six hours.
- **Settings.** A new group, "Their nature", with a slider for each of the ten (the stubborn and
  loyal sliders moved there, unchanged) and "How much they differ". The person panel shows all ten.

Sources.
- How much is inherited: about 40% of the differences between people in personality (Vukasović
  and Bratko 2015, a meta-analysis of twin studies; Polderman et al. 2015 find about half for
  human traits in general). The engine keeps its old rule, the parents' mean and a stray.
- Which traits decide which choices: honesty-humility predicts cheating and stealing when it
  pays (Hilbig and Zettler 2009; Ashton and Lee's HEXACO); conscientiousness effort at work;
  openness moving away (Jokela 2009) and changing work; trait anger aggression when provoked
  (Bettencourt et al. 2006).
- How events change people: small changes, partly lasting (Bleidorn, Hopwood and Lucas 2018;
  Jeronimus et al. 2014 on bad events and neuroticism). War: people exposed to violence cooperate
  more within their own group (Bauer et al. 2016) and in Burundi became more impatient and more
  ready to take risks (Voors et al. 2012). Hard times make people more careful for life
  (Malmendier and Nagel 2011).
- Killing: about 20 to 25 a year in 100,000 in 13th- and 14th-century England, one in about
  4,000 (Given 1977; Eisner 2003). Measured over twelve world-years at ordinary tempers, about 83
  fights a year among some 350 people, which with one fight in a thousand killing is one in about
  4,200.

Measured.
- *A year, twelve worlds* (seeds 11, 3, 5, 4, 2, 7, 13, 17, 19, 23, 29, 31), against the engine
  before item 10: 359 alive a world against 352, 19 starved against 15 (a single world swings by
  more than that from run to run), 16 dead in battle against 24. Each world-year about 140
  quarrels, 87 fights, 11 raids and 340 larders robbed; no killing in the twelve (about one was
  to be expected). Tempers rise over a year of war, to about 0.56 on average from 0.5.
- *First tries, and what they taught*: counting every day of fighting at a village as a raid
  pushed tempers to 0.97 in a year; letting the hungry steal from anybody with a day's food over,
  and as readily as they asked, took 13,000 larders a world-year and spread hunger from house to
  house (39 starved a world); patience first raised the wish to earn in general, which sent the
  patient to the bench instead of the fields.
- *Hours* (`test/behaviour.mjs`, four days, three seeds, each slider at 0.25 against 0.5): greedy
  7.7%, curious 7.3%, hardworking 6.7%, bold 6.1%, warm 5.7%, hot-tempered 5.3%, stubborn 4.6%,
  loyal 4.5%, patient 4.4%, a reseed 12.6%. Honest 0.0% in four spring days, since nobody is
  hungry; over 200 days 0.8%, and in a hungry winter 26 larders robbed in two worlds against 2
  (`test/traits.test.mjs`).
- *A raid* (`test/traits.test.mjs`): the same village a month on, raided against not, is quicker
  to anger by about 0.04, warmer to its own by 0.02 and less patient by 0.02, half of it set to
  wear off.
- *Speed* (`test/bench.mjs`, two runs each, against before): 400 people 0.13 → 0.13 s a day,
  2,000 0.66 → 0.66, 5,000 1.98 → 2.06 (+4%), 400 on 500 km 0.19 → 0.14; **20,000 on 80 km 14.6 →
  16.0 (+9%), over the 5% budget**: the time is the old search for a neighbour with food to spare
  (`choose`, "ask"), with more people short at that moment in that world, not the new code; item 11
  replaces that search. Calling `settle` for everybody every six hours had cost 8% at 5,000 by
  itself, though hardly anybody had anything to wear off; it is now called only for those who do. Memory at 5,000 people 3.4 → 4.1 MB, 0.67 → 0.80 KB a person: five
  traits, and what of the last hard times is still to wear off, when to look for a quarrel, when last
  stolen, the last lean year.

### Wood, stone, ore, herds and game (2026-11-17)

TODO item 9. There was farming, fishing, one kind of "goods" and a figure for the ore under a
village. Ric chose materials "Few and clear", and firewood "Yes, as a setting".

- **Wood, stone and ore** (9a). Cutting wood in a forest, quarrying in hills or mountains and mining
  where the ground has ore, within 4 km, are ways to spend a day weighed beside the fields and the
  bench. A day at good ground is a load: about a cord of wood (a woodcutter cut and split a cord a
  day), a cubic metre or so of rough stone, some hundreds of kilograms of ore, less where the ore is
  poor. A forest square holds sixty loads and grows twenty back a year (managed woodland, 3 to 5 m³ a
  hectare a year); stone and ore do not run out. The load is sold to the village store at what the
  store pays, which is dear when the village wants more than it holds: houses being built, what
  crafters work, gear. Houses take loads of wood or stone where they took goods; a crafter's batch is
  bigger with wood and ore in the store, and uses them; a tool or a weapon takes ore, a cart wood.
  Traders carry each from where it is cheap to where it is dear. Woodcutter and miner are trades
  people take up as they take up any other.
- **Herds and game** (9b). Herding on grassland, dry land and hills that no household holds: about
  forty days of food a square a year in milk, cheese and meat (herders lived some 2 to 10 to the km²
  where farmers lived 20 to 60), a day with the herd up to two days' food, with wool and a hide now
  and then. Hunting in the forest: about eight days of meat a square a year (a tenth of a person to
  the km² for hunters alone), a good day two and a half days' food and a hide, and hunted hard the
  game is gone for years. Both less in the cold. Wool goes into what crafters make and into packs,
  hides into shields where wood is short.
- **Firewood** (9c, a setting). In the cold a village burns wood from its store, about
  three-quarters of a load a person over a winter, more in a hard one; the store wants a winter's
  worth before the cold, so wood is dear in autumn. A village with none is cold, and the very young
  and the old die of it first: over a hard winter unwarmed about one grown-up in twenty, more of
  them. On treeless land people burned dung, turf and peat: a village with no forest within reach
  burns no wood.
- **"Materials"** (a setting): "Wood, stone, ore, herds and game", or "One kind of goods (as
  before)", which leaves a world exactly as it was. Firewood needs materials on.
- **The village panel** shows wood, stone, ore, wool and hides in the store; woodcutter, miner,
  herder and hunter are in the occupation filter.

Measured: the default world, six seeds, a year: 356 alive a world and 12 starved, against 367 and 16 before item 9; about 7 a world died of cold, which is what Firewood is for, and 137 died in battle in all six against 124. Over twenty days a forest village (282 forest squares within 4 km) spent its hours cutting wood and hunting where one with hardly any forest did not; villages by water fish and those without do not; wood cost up to 6 in villages with no forest near, about 1 in those with it. Over sixty days grown-ups' hours went field 10.7%, the bench 9.5%, cutting wood 7.9%, mining 5.9%, fishing 4.3%, herding 4.2%, hunting 3.2% (with one kind of goods: field 12.7%, the bench 16.7%, fishing 9.8%). `test/behaviour.mjs`: Materials moves 24.9% of an adult's hours, nearly twice what rerolling the world does (13.0%); Firewood 2.4% in a short spring probe, since nothing burns until the cold. Found on the way: seed 4's land has no forest at all, and with wood only within 2 km, and shields only of wood, its soldiers went without and died five times as often in battle: now wood, stone and ore within 4 km, shields of hide where wood is short, hides from herds as well as game, and turf and dung on treeless land. Speed (`test/bench.mjs`, against the engine before item 9, two runs each): 2,000 people 0.60 → 0.68 s a day, 5,000 1.80 → 1.96, 20,000 14.95 → 14.55 (within noise), 400 on 500 km 0.13 → 0.19: people walk out to forests, hills and grazing up to 4 km and back, and moving people is the cost (the step that moves people went from 13% to 23% of that world's time).

### Villages, towns and cities (2026-11-17)

TODO item 8. A village was a village for ever, split when it passed "A full village".

- **A size, not a type.** A place is a town from 400 people (England's small medieval towns held
  about 300 to 2,000, Dyer) and a city from 5,000; it falls back below four-fifths of that. Each change
  is in the news.
- **A place lives on what is brought into it.** Beside what its rule for a full village allows, a
  place has room for as many as the food brought into it feeds, a running average over about half a
  year (a town lives on a whole harvest). Food comes in by the carrying already in the world, from
  a store where it is cheap to one where it is dear, by grain traders, and on market day:
  households with more than their winter's food take it to the biggest place within 10 km that is
  short of it. So a place grows where the land round it has a surplus, and stays a village where it
  has not. Pre-industrial towns rarely held more than a tenth to a fifth of a people (Bairoch; de
  Vries), and a capital drew its grain from far round (London about 1300 from some 60 km by land and
  further by water, Campbell and others, 1993).
- **Crowded places were graveyards.** About one more death a hundred a year in a town than in the
  country and a little over two in a city: London's burials outran its baptisms for two centuries
  and it grew only by those who came in (Wrigley, 1967). *Since 15.5r that is no longer a fixed toll
  but its causes (below, "Dirt and foul water"); the fixed toll is kept as a setting.*
- **Where they live at first** (a setting; Ric: "all of this being choices"): hamlets of about
  fifteen, villages as before, villages and a market town with two-fifths of each faction, or a city
  with half of everybody. A town or city made at the start is trusted to be fed by its villages for
  those its own rule would not hold; if the food does not come, the trust runs out and it shrinks,
  or starves.
- **Drawn** (Ric: "Houses, then a block"): every house close in; further out, where houses are too
  small to tell apart, a town or city is one block, the outline round its houses, edged in its
  faction's colour, with a bigger marker and "town" or "city" by its name.

Measured: a year of 5,000 people on 40 km, from villages: on rich land ("How much it grows" 1.7) the biggest place reached 444 people by the year's end and was a town, 21 starved; on poor land (0.7) the biggest held 53 and the world starved by more than half; with a city of 2,500 at the start on rich land, its villages could not feed it, it shrank to 416 and 532 starved. Almost no food was carried into any place in these runs: after the harvest every place has food and prices barely differ, and households keep their harvest at home; towns grew by keeping their people, not by imports. The default world, six seeds, a year: 372 alive on average and 101 starved in all six (17 a world), against 364 and 138 (23) at item 7. Speed (`test/bench.mjs`, against item 7): 400 people 0.12 → 0.12 s a day, 2,000 0.62 → 0.57, 5,000 2.12 → 1.72, 20,000 15.1 → 14.2, 400 on 500 km 0.10 → 0.12. A crafter looking for a paid building job had looked through every house in the world at each decision, a tenth of a 20,000-person world's time since 7b; now only the open sites.

**Feeding a town (2026-11-17, Ric: "Fix food supply").** Measured first, on a city of 2,500 at the
start on rich land: after the harvest the villages round it held about 36,000 days of food beyond
their own winter, while the city's households were 10,000 days short with 7,000 to 12,000 coins to
pay. Yet over 300 days no grain was carried in and three households went to market. Three things
stopped it, and are changed:

- **Every price was the same.** A price reads a village's store, and every store was empty, so
  every price sat at its top (7) and the city looked no dearer than home. Market day now goes by
  how short the town's households are, and only to a town whose households are going short.
- **Nobody to sell to.** A load brought to market could only be sold to the town's store, whose
  till was empty. It is now sold door to door to the households going short, at 1.2 coins a day's
  food, the most short first; what nobody buys goes to the store if it can pay, and the rest home.
- **Too small, and too frightened.** A household carried five days in a pack; now a handcart or
  packhorse load, as a grain trader carries (fifteen days). And a war anywhere frightens a whole
  faction, which stopped every market day from the harvest to spring though the fighting was
  nowhere near; on the road to one's own town, not under siege, fear now counts half. (Since
  2026-11-19 a war elsewhere does not frighten anybody at all: "Wartime effort".)

This world had no grain traders at all, so market day is the town's supply. Measured, a year each
way, 5,000 people on 40 km, rich land: with a city at the start, 15,000 days of food were sold into
places (none before), 363 starved against 511, and the city held 524 against 479. From villages, 12,200
days were sold, 57 starved against 122, and the biggest place was a town of 415 at the year's end
against a village of 251 (the same seed under item 8 had once grown a town of 444; one run each
way). The default world, six seeds: 367 alive and 16 starved a world, against 372 and 17. **Still
open:** a city of half the people cannot be fed. After keeping their own winter the villages
round it had about 40,000 days to spare and the city needed about 150,000, and at a coin a day its
households' money would buy about 10,000. Historically a town of that share of a people lived on
grain from far away by water.

### Building houses (2026-11-16)

TODO item 7b. A house stood from the start or appeared at once for somebody who moved. Now:

- **Who needs one.** A married couple living with other grown-ups sets up a house of its own, as
  north-west European couples did at marriage (Hajnal's household pattern); so does a household
  too many for its house (about 10 m² a person). The youngest couple goes. An empty house in the
  village is taken first, one whose household died out or moved away.
- **What it takes.** About two hours' work a square metre of floor (a 54 m² cottage 14
  person-days, a 168 m² house 42), and goods for timber and thatch, one for every 20 m² and six
  besides, bought from the village; where there are none, or no coin for them, gathered by hand,
  eight hours each, as most peasants did. No clean medieval figure for the work was found (Dyer's
  peasant buildings were put up by carpenters in weeks); these are said as a guess.
- **Who builds.** The family itself, five hours at a time, or a builder they pay, a crafter of the
  village, at a wage and a half (Ric: "Sometimes a family sometimes a builder"). A household pays
  for a builder or goods only out of what is left after a winter's bread. Building gives way to
  hunger, the harvest and an empty larder, as building waited for the slack of the year.
- **Newcomers** take an empty house, or put up a hut at once, the smallest house there is.
  (Lodging them with a neighbour while they built was tried: hungry newcomers built instead of
  farming and a year starved half as many again.) A child that moves goes with its parent; until
  now each had been given a house of its own.
- **Drawn** as a timber frame, its roof thatched by quarters as the work goes on.
- In a first year few couples marry into a crowded house, so few houses are built; they come
  with the generations.

### Who holds the land (2026-11-16)

TODO item 7c. Ric: "It should be a setting for each tribe. And the leader decides that or
sometimes the people. Like different governments". Every faction has a land rule:

- **Families**: every household that farms holds fields of its own near its house, a square
  (6.25 ha) for every two or three of them, so a family of five about a virgate (nominally 30
  acres, 12 ha). It works its own first, unless picked so bare that other land would give it much
  more; anybody may work another household's field for half of what it gives, the other half going
  to that household, as harvest work was paid in sheaves. A household that has not farmed for three
  months running gives its fields back.
- **The village**: the fields are common; anybody of the village works any (as before).
- **The leader**: everybody works the leader's land and a third of every harvest goes to the
  leader's barn, the village store.
- **Who chooses.** A chief or the richest by their own leanings (who believes in sharing chooses
  common fields, a greedy one their own land, anybody else families); a faction that votes by what
  most of its grown-ups lean to, changing only when 55% want it; you, for a faction you rule (the
  ruling panel has a button for it); or the world setting "Who holds the land" fixes one rule for
  everybody. A change is in the news.
- **Drawn**: hedges round each household's fields from 20 pixels a square.
- Measured, a year on six seeds: families' holdings starve as many as common fields (124 against
  119). The first tries starved twice as many: holdings nobody else could touch, holdings for
  households that did not farm, and families going back every day to a bare field of their own.

### Land as property (2026-11-23)

TODO item 15.7, all six parts. Ric: "can we look at owned land? how realistic is the proipertyy side of
things?", then, of the six gaps found, "all 6 of those things need to go somewhere right?" Setting **Land
as property** under Power: *Held, inherited, sold and pledged* (the default), *Held and inherited, never
sold*, or *Shared out by need each month (as before)*, which is the old land exactly
(`test/property.test.mjs` holds a families' world fingerprinted before this). It works under families'
own fields; common and leader's land are as they were.

- **Held, not allotted by need (15.7a).** A household keeps its fields however many or few it is, and
  however little it works them; idle land is worked by others for half, as any household's field could be
  already. A household takes up more of the village's unheld land as it grows. An empty house keeps its
  fields for a year, and whoever moves into it has them. The old way — fields that grow and shrink with
  the family every month and go back after three idle months — is a repartitional commune, and it stays
  as a fifth way to hold land under **Who holds the land**: *The village, shared out by need*. The Russian
  mir repartitioned by law no oftener than every twelve years after 1893, in practice every six or more
  often, and a third of Simbirsk's communes never did ([Repartition](https://en.wikipedia.org/wiki/Repartition);
  [Obshchina](https://en.wikipedia.org/wiki/Obshchina)).
- **Passing on (15.7b).** When the last of a couple dies, their fields pass by their people's custom
  (15b's `match.inherit`): to every child, each child's share going to the house they live in — split, as
  Kentish gavelkind split it ([Kent Archaeology](https://www.kentarchaeology.org.uk/journal/142/gavelkind-ground-1550-1700)) —
  or whole to the eldest (the eldest son where men and women differ). Shares of children still in the house
  stay with it. No child: the fields stay with the house.
- **Pledging and selling (15.7b).** Once a month, a household with under two weeks of food and the coins
  for no more pledges a field to the household with the most coin to spare (beyond three months of its own
  bread), for a season's bread: the lender holds and reaps it — the "dead pledge" — until the borrower can
  pay it back with half as much again to spare; after three years the lender keeps it. A household with
  more fields than twice its grown-ups, short of a month's coin, sells one for two seasons' bread. Land is
  cheap in coin because coin is scarce in these worlds; that is also how distress sales went: smallholders
  sold to wealthier neighbours in bad harvest years, and the volume of sales followed the harvests in the
  English court rolls and feet of fines (Davis and Kissock 2004 on 1315–22, cited in
  [a reappraisal of the late medieval freehold market](https://centaur.reading.ac.uk/83824/9/reappraisal_of_the_freehold_property_market_in_late_medieval_england.pdf);
  Harvey, *The Peasant Land Market in Medieval England*, 1984). *Held and inherited, never sold* turns
  pledging and selling off.
- **Estates under the ruler (15.7c).** An official paid in land (15c's "land" pay) is granted three fields
  near their house for as long as the office; they go back when the office does (a benefice, a timar). A
  people's own faith with a priest holds a glebe of two fields, for good, moving to each new priest's
  house. This replaces the food an official paid in land used to draw from the store. Great households are
  not granted land: they buy it, as above.
- **Bounds that stay put (15.7d).** A village's reach grows as it grows and no longer shrinks when its
  people do; a square once a village's stays that village's while it stands, and a neighbour's growth does
  not take it. Land goes only when a village is abandoned.
- **The land between (15.7e).** A people claims the land within three kilometres of its villages' fields
  (the nearest village's people), woods, pasture and hunting grounds; foragers' and herders' camps claim
  their ranges the same way. Somebody of another people who cuts wood, quarries, mines, herds or hunts there
  pays that people a tenth of what it gave, in coin, or — with no coin, or in a shared-store world — it is
  held against their people (a little grievance and ill will each time). At war nobody asks. Armies ask
  leave to cross it (15.6f).
- **Records and disputes (15.7f).** Without writing, an inheritance split between several heirs is
  quarrelled over three times in ten; a judge (15c) settles it, otherwise the heirs fall out. A greedy,
  dishonest head may move a boundary — take a neighbour's field — about once in thirty months; a judge
  with a written record puts it back. A greedy chief or rich ruler (sooner where the great families have
  the say) may enclose a village's commons: whoever works the land nobody holds then pays a third to the
  barn, as on a leader's land. Enclosure is the ruler's call only, pushed by a council of the great (my
  choice in Ric's absence, 2026-11-23; his to change).
- **Measured** (seed 2, families' fields, a year): 37 pledges, 3 sales, 5 boundaries moved, 281 tolls and
  741 trespasses on claimed land; nobody starved either way (0 against 0), births 25 against 22. After a
  month, 2% of households held no land, the most any held was 5 fields, and the share of land was spread
  with a Gini of 0.25. The question the item asks — does a landless class grow of itself, and how fast —
  needs generations, and is left to the long runs (the speed of a year, below, is unchanged).
- **Read** with `landView()` (households, landless share, mean and largest holding, Gini, pledges, grants,
  enclosed villages).

### Paths and roads, carts and boats (2026-11-16)

TODO item 7d, with what Ric added to it ("Write them in"): carts and better boats come with roads;
cars wait for eras (item 15).

- **Paths are worn in, not laid down.** Every time somebody walks onto a square it is trodden once
  more; under 1% of that wears off a day, so a path outlasts a winter. A square trodden about 25
  times a day for weeks becomes a path, about 95 a road; one nobody uses goes back to grass. This
  is the active walker model (Helbing, Keltsch and Molnár, 1997): walkers wear the ground, worn
  ground is easier and draws them, wear fades. A path is walked at least at the pace of open
  ground, a road 15% faster, and the way-finding prefers them. In a default world about 150 squares
  of path and 30 of road wear in over a year, mostly the lanes of villages, as trips between
  villages are few on a 17 km land. Drawn as lines from square to square, roads wider and paler.
- **Carts** are owned: a trader starts with one, and buys or mends one (three goods) out of what is
  left after a winter's bread. Grain goes eight packs to a cartload, five by handcart and packhorse
  without. Laden, a cart goes at a walk on a road, 85% on a path or a village's lanes, 60% over
  open ground. Drawn behind a laden trader. (Farmers' carts for the harvest were tried: dragged
  home over the fields they starved more than twice as many in a year; not kept.)
- **Boats carry goods**: a load for a village along the same coast or a big river goes by boat
  when that is at least a tenth quicker than the road, at about 6 km an hour under sail and oar.
- **Boats are lost**: about one crossing hour in 500 at sea and one in 1,500 on a lake or river;
  the load goes down with it and half of those aboard drown; the village is without a boat until
  it builds another. Built, lost and afloat are counted (`boatsBuilt`, `boatsLost`, `boats`).

### Asking a neighbour, made cheap (2026-11-16)

Left by 7a: when a village store was empty every hungry person looked through all their neighbours
for grain, a fifth of a 20,000-person world's time. Now they run down a list, made once an hour,
of who in the village has grain, most first, and stop where nobody further down could do better;
grain somebody brought home within the hour is known of the next hour. The same world plain or
fast (`test/walking.test.mjs`, `dozing.test.mjs`). 20,000 people 13.4 → 10.8 s a day.

Measured, item 7 as a whole (six seeds, a year each, against item 6): 364.5 alive on average against 365.5, 138 dead of hunger in all against 110 (within what six seeds vary by run to run: 119 to 138 between runs of the same engine with small changes), and about 150 squares of path and 30 of road a world by the year's end. Speed
(`test/bench.mjs`, against item 6): 400 people 0.125 → 0.125 s a day, 2,000 0.62 → 0.62, 5,000 1.96 → 2.05 (5% slower), 20,000 on 80 km 14.3 → 14.9 (4% slower), 400 on 500 km 0.145 → 0.10 (31% faster); the cheaper neighbour search pays for most of what houses, land and paths cost.

### Rain and dry years (2026-11-16)

TODO item 6b. Every year grew the same everywhere but for one number for the whole land. With
"Rain" on (the default):

- **A year's rain differs by place.** Each square's usual rain is how wet its place is (the same
  map that makes forest or dry land); a year's rain there is that times 1 + cv·z, with z drawn
  from the seed and the year for the whole land and for regions about 100 km across (not the
  world's dice, so asking about a year changes nothing). cv is how much one year differs from the
  next: larger on dry ground than wet, as in life (yearly rain varies by about 15 to 20% in wet
  country, 30% and more in dry), and scaled by "Year to year"; at "every year the same" there are
  no dry years.
- **A dry year thins the crop** by about as much as the rain fell short (FAO's yield response
  factor for wheat, about 1.05; FAO Irrigation and Drainage Paper 66), and a wet year adds a
  little. Divided by its own average, so a run of years grows what it did without rain: 100% on
  average over thirty years, with a land-wide dry year (under 85%) about one year in five at the
  usual setting.
- **River flats are spared**: ground beside a river or lake loses nothing in a dry year, ground
  500 m off a quarter of what it would, a kilometre off three quarters, which is why villages sat
  there.
- **Word of a dry year** comes in the news when a faction's villages get under 80% of a usual
  crop.
- **Rain fills the pots**: with thirst on, on a rainy day every house of a village catches about
  40 litres off its roof; a wet place has rain on about half its days, a dry one on a sixth, a dry
  year fewer.

### Fishing (2026-11-16)

TODO item 6c. With "Fishing" on (the default), a village within 2 km of a river, lake or the sea
fishes the water nearest its middle and every water square within 750 m of it. A square of water
(6.25 ha) gives what natural waters give, 30 kg a hectare a year in the sea, 40 in a lake, 60 in a
river (FAO puts natural waters at about 20 to 50), a kilogram being about a third of a day's food;
it holds at most a year of that, fished down it comes back at that rate. A day's fishing brings
in up to about 6 kg, under half that in the cold. A fisher is a living like a farmer, chosen the
same way: by what a day there would bring. Measured: over a year on six seeds a 400-person world caught about 6,800 days of food, roughly 6% of what it ate.

### Fords, bridges and boats (2026-11-16)

TODO item 6d. Every river could be waded, and nobody could cross the sea or a lake at all. With
"Crossing water" at "real" (the default):

- **Big rivers** (draining over about 300 km², tens of metres wide) cannot be waded, except at a
  **ford**, about every 2.5 km (every 7.5 km on the biggest), from the seed. Nobody steps from
  corner to corner across one either. A default 17 km land has none; 100 km lands have a few, 200
  km lands hundreds of squares of them.
- **A bridge**: a village within 2 km of a big river with no ford within 1.5 km builds one, about
  75 person-days of timber work, four hours at a time; it is walked at full pace, and land it
  joins is one. On a 200 km land the first took about three weeks.
- **A boat**: a village within 2 km of a lake or the sea whose people keep wanting to cross it
  builds one, about 15 person-days; then its people walk to its landing, are rowed over at 4 km an
  hour to the nearest shore of the land they are going to, and walk on.
- **An army does not go by boat**: soldiers sent over water they cannot walk round stay where
  they are, and the news says so.
- **Drawn** from close enough to see houses: a big river wider, a ford as a pale shallow with
  stepping stones, a bridge as timber across, a boat at its landing.

Each part has its own setting, and with each off ("off", "off", "wade") the world is exactly as
before: checked against the engine before that part on three seeds after eight days, identical.

Measured, the three together (six seeds, a year each, against 6a): 365 alive on average against 352, 110 dead of hunger in all against 162, 4 of thirst against 26 (rain fills the pots); seed 3 had a dry year, its villages' crops at 63% of usual, and 15 starved there against 1. Speed
(`test/bench.mjs`, against 6a): 400 people 0.14 → 0.13 s a day, 2,000 0.62 → 0.60, 5,000 1.80 → 1.75, 20,000 on 80 km 12.6 → 13.5 (**7% slower**: walking round a big river to its ford), 400 on 500 km 0.09 → 0.16 (**slower**: a land that size has hundreds of squares of big river, and a walker at a bend in one still sometimes falls back on the slow search for a way round). Part of what made 6a slow was found on the way: fields first set during a life (hours without water, what is carried home) gave people different shapes in memory, which the engine's notes already warned of; declared at birth, 20,000 people with all three parts off run 11.2 s a day against 6a's 12.6.

### Water to drink (2026-11-16)

TODO item 6a. People needed only food. Now, with "Thirst" on (the default, Ric: "Real, on by
default"):

- **A household keeps water at home**, up to 300 litres in a few large pots, and every one of them
  uses 20 litres a day from it (about WHO's basic access). Anybody at a river or a lake shore
  drinks there instead. (160 litres was tried first: a big family ran dry every night, 13,000
  dry person-hours a year in one world.)
- **Without water** a person weakens and does not heal, and dies in about three days, up to half
  as fast again on the warmest days (three to five days is the usual range, one to two in heat);
  "Gentler" is about two weeks.
- **Fetching.** With about two days left, somebody goes to the nearest river or lake shore (the
  sea is salt; `freshNear`, a map made once a world) and carries 40 litres home. Children from
  six fetch too, as children did: measured, every early death of thirst was a child alone in a
  house; and a younger child whose house is dry is given water from the village's fullest house,
  as it is fed from the village's store.
- **Wells.** A village whose fresh water is more than a kilometre off (WHO's line) digs a well in
  its middle, about thirty person-days of work, four hours at a time; then its houses fetch from
  it where it is nearer. Wells are drawn as a ring of stone with water in it.
- **Where villages are.** At the start villages are put within 2 km of fresh water where the land
  allows, and people founding a new village weigh how far the water is.
- **Off is off**: nothing of it runs and nothing is drawn from the dice; checked against the
  engine before this item on three worlds after eight days, identical.

Measured. Six seeds, a year each, water on against off: 372 alive on average against 382, 82 dead
of hunger in all against 25, 14 of thirst; wells dug in 8 to 12 villages of every world. Villages
start 1.2 km from fresh water on average against 2.2 km with it off; villages founded during the
year 2.1 km against 2.3, a weak pull once a world runs. Fetching takes under 1% of grown-ups'
hours. Speed (`test/bench.mjs`, against 7a): 400 people 0.12 → 0.14 s a day, 2,000 0.55 → 0.62,
5,000 1.72 → 1.77, 20,000 10.5 → 12.6 s: **over the 5% budget** on three rows, the cost of a new
daily task (counting who lives where at every decision had made it 28 s; that is now done once an
hour). **Not explained yet:** with water on, no trader went prospecting in sixteen seeds in the
travel test, against two of sixteen with it off; the cause was not found.

### War has to be fed (2026-11-14)

Ric: military reach should depend on *"food carried and access to resupply, distance from
friendly settlements, equipment replacement, agricultural labor lost to recruitment, recovery
after losses"*. Before this an army was raised whole the day a war began, marched on nothing and
could sit under a village's walls through a hard winter. At this map's scale a walk between
villages takes hours, so reach here is **how long an army can stay in the field**, not how far it
can walk — and a village falls only to four unbroken days of besiegers with no defenders.

- **Rations.** Before marching a soldier draws `CAMPAIGN_DAYS` (ten) of rations at a village of
  their own, paid by the treasury: from the store, then from houses with more than their winter,
  at each house's price (`provision`). Coins are conserved; no house is stripped below its winter.
  Under three days in the pack, they do not march.
- **Resupply only at home.** In the field they eat what they carry; under a day left, they walk to
  the nearest village of their own (`nearestOwn`), and the siege loses them.
- **Equipment.** A soldier refits before marching (`outfit`, which costs goods), and without a
  working weapon does not march.
- **Labour.** Every soldier is a field hand lost; the Factions tab says so beside the count.
- **Recovery.** The badly wounded (health under 0.45) go home to heal rather than fight, and an
  army is raised — or rebuilt — at about two in a hundred adults a week, not all at once.

Measured on wars forced on day one between two factions (`declare`), 240 people, forty days,
three seeds: in spring, battle deaths 22–26 and 0–1 villages taken (before: 26–32, 0–2); in a hard
winter, battle deaths 6–10 and no village taken (before: 26–53 dead and villages taken as readily
as in spring). The winter worlds starved heavily either way — a hard winter started with nothing
put by starves 52–199 of 240 with no war at all, old code and new alike; in the old code war only
looked kinder because battle left fewer mouths. `test/war.test.mjs` checks the pieces.

### Equipment: a first connected set

Added 2026-11-12 as the next readability milestone in the People vision. Items are in each
person's `gear`, with condition from 0 to 1. Nobody starts with free gear. At a village, an adult
with at least 0.6 food fits the equipment for their occupation using owned goods or goods bought
through the existing market. Children do not outfit themselves. Coins transfer through the same
till/tax paths as any purchase; shared stores supply actual goods without coins.

| Item | Goods for a new item | Use | Condition used per completed use |
|---|---:|---|---:|
| Work tool | 0.6 | Farmers take up to 2.25 food rather than 1.8 from a day in the fields, deducted from actual fields; crafters make 20% more goods per batch. | 0.003 |
| Trade pack | 0.8 | Traders can buy/carry up to 5 rather than 3 units, still limited by stock and money. | 0.004 per delivered load |
| Weapon | 1 | Soldiers deal 25% more damage on a successful hit. | 0.01 per successful hit |
| Shield | 1 | Soldiers take 25% less damage on a successful hit. | 0.01 per hit received |

These costs and effects are implementation choices for this first set, not requirements Ric
specified. Generic goods already produced by crafters provide the material; there are no new
metal, textile or recipe chains yet. The weapon and shield are generic equipment, not a chosen
historical technology progression.

At 25% condition or below, a person seeks repair when next shopping. Repair consumes the item's
cost times its worn fraction and restores condition to 1; no material means no repair. Working
condition gives the listed benefit until it reaches zero. Gear stays owned when a person changes
occupation but is stored and inactive if unsuitable. On death, remaining usable material returns
to the home village's goods; worn material does not. This is salvage, not inherited named items.

At close zoom the renderer reads equipped items to draw the work tool, pack, weapon and shield;
an actual trade load adds a crate. People-list rows name gear in use. Person inspection distinguishes
Equipped, Stored and Broken, reports condition and the active benefit, and shows loose goods and
trade cargo. Selecting someone now zooms to 48 pixels per tile to make equipment readable. This
is a first inventory/work connection. Following someone limits labels and speech to that person
and their conversation partner so text does not hide carried gear; bubbles sit above the items.
Individual item provenance, specialist equipment makers,
player equipment choices and the larger production system remain future work.

## The page

### The People page, rebuilt (TODO 21b to 21g, 2026-11-25)

Ric, 2026-11-24: "it needs a complete revamp this is a high quality simulater and the ui needs to
show it". The analysis is `UI-REVAMP.md`; what each screen shows first is its section 6 (21a,
agreed); the order of work and Ric's answers are `TODO.md` item 21. The mock-ups Ric chose from are
`docs/mockups/world-builder/people-ui.html` (direction A). No engine change: everything new is read
by the keeper (`people-host.js`), and `test/watching.test.mjs` holds a world watched every way the
page now watches it equal to the world unwatched.

- **Colour has jobs.** `:root` names them: `--edge` for what must be seen (3.57:1, against the
  divider's 1.47), `--urgent` for a need now, `--trait` for lasting nature, `--mind` for what
  someone heard or believes, `--follow` for the person followed; the accent is for controls and
  links only. Five type sizes, `--t1` to `--t5`, none under 12 px. A fact is plain, an estimate is
  dotted and marked ≈, what is in someone's mind is in its own colour.
- **Faction colours are the page's** (Ric: "Okabe–Ito + marks"): eight that stay apart for the
  common colour blindnesses (closest pair ΔE 14.6 under deuteranopia), each faction's letter on its
  villages and in every legend, so a ninth and beyond are told apart by more than colour; a colour
  is not handed to a new faction while a living one holds it unless all eight are. The engine's own
  `COLOURS` are untouched and simply not used.
- **Setup is three layers**: Start (the starting points and fourteen Essentials, help behind ⓘ),
  Customise (six tabs) and Model (switches that turn a newer part of the engine back, said plainly
  for what they are), with one search over labels, help and choices. The faith parts fold under the
  one Faith switch. A link names settings by key, so every link made before opens the same world.
  Which setting is where, and why, is TODO 21c.
- **One bar**: Setup, Pause, 1× · 16× · Max and every speed behind ▾, the date and season, the people
  and their change since day 1, what it is waiting for, how many things are going wrong, the layer,
  Rules and ⋯. Two rows on a phone, every control 44 px, the layer and Rules inside ⋯.
- **Eleven layers**, each with a legend in a corner (folded on a phone): Factions, Mood, Beliefs,
  Wealth, Hunger, Sickness, Loyalty, Faith, Who holds the land, Roads and trade, War. A person's
  colour is a number the keeper works out (`tint`); land, roads and war also change what is drawn
  under the people, from what the frame already carries.
- **Run, then pause**: a day, until the next season, a year — the keeper hands the engine only the
  time that reaches that day's first minute (`setUntil`, `cut`), so the world takes every step it
  would have and stops exactly there. And, if ticked, pause when something happens to what is pinned.
- **Four tabs**: Overview (what is going wrong, what happened since you last looked with the
  engine's "because" in body type, the counts that moved, your pins, six graphs with axes and days
  and a dashed line per change you made, firsts, the peoples, every count behind a fold), People
  (pins and people worth a look, A to Z behind a tap), News (problems on top, repeats folded,
  Everything · Big · Pinned · Talk) and the Inspector.
- **Everything drawn answers a tap**: a person, a village, a unit (with Units shown), a boat, a
  house, another building or a ruin, a held field, a road, and the land, which opens its people; a
  news item from any list. The tap is 16 pixels round the finger at any zoom, and a village answers
  only as near as its marker reaches, so close in a house or a field can be tapped beside the people
  in it. A people's page says what it knows and why a thing is not in use, only as `techView`
  records it.
- **Pins and the keeper's memory.** People, households, villages and peoples can be pinned. The
  keeper keeps a row a day for each from when it was pinned, every event about it, and the first
  event of each kind, so the record dropping its smallest events cannot lose them. A person is
  matched to an event by the event naming them: the engine records an event's faction and place,
  not its people. Headlines go one at a time along the map's top edge — big or pinned, ranked apart,
  because a famine is weighed 2.5 — and ⋯ chooses what may show.
- **The Rules drawer** has the live rules with what each began at, and the list of every change the
  visitor made, with its moment and before and after. That list is the one record of changes item 19
  and 21h will save.
- **Measured**: the keeper's frame no slower (5,000 people 0.56 ms against 0.59; 20,000 people 3.30
  against 3.50; medians, three runs); a person's panel under 3 ms at 20,000 people. Standing
  problems are worked out once an hour of the world's time.
- **A bug found on the way**: the Beliefs view stopped every frame — the keeper's `tint` read the
  world through a name it did not have in scope.

The older notes below describe the page before this; where one says otherwise, this section is what
is true now.

- **The settings screen is panels, not one long list** (2026-11-13). The starting points wrap
  into a grid instead of the row that scrolled sideways — a card off the end of a strip nobody
  thinks to drag may as well not be there — and each group is a panel, laid out in columns where
  there is room, so thirty-six settings are about two screens rather than six. A row is its label
  and its value on one line, the slider under that and the help under that; a value that only
  repeats the number in the box beside it is left out. A shut group carries a turned-down corner,
  which it had nothing of on a phone, where the first two open and the rest do not. Two starting
  points to a row there, with their notes held to two lines.
- **The running world's bar wraps rather than scrolling sideways**, and the clock sits in the
  corner of the world to keep it to one row. Below 1,150px the title goes first — the world under
  it says what it is — and the group captions follow at 1,100px. On a phone the bar goes down a
  size, because every row it takes comes straight off the world. (The physics tools' rail went
  with the Physics Sandbox.)
- **A world opened from a link fits itself once the stage has a size.** `fit()` scaled the camera
  to a canvas the browser had not laid out yet, which left the scale at zero and drew nothing at
  all — and every link "Copy link" makes opens that way, so a shared world was a black rectangle
  until you found "Whole world". It now reports failure on a stage with no size, retries on the
  next frame, and re-fits when the stage changes size unless the view has been taken hold of.
- **Two screens in one file** (three, with the chooser, until 2026-11-25). The address carries
  only the settings that differ from the defaults (`#people?people=900&rich=0.5`), so a link stays
  short and still opens after a setting is added. `&run` goes straight to the world; "Copy link"
  makes one. The `#people` stays so links made before the split still open, and an old `#physics`
  link is sent on to `../physics-sandbox/` before anything else runs.
- **Settings that another setting switches off are greyed**, not hidden, so the list never jumps.
- **"Surprise me" draws every setting from its own range.** Most of those are bad worlds. That is
  the point.
- **A frame advances at most a tenth of a second of real time** rather than owing a growing
  backlog, so a slow phone runs slower instead of freezing; a note says when it is behind. For
  People that is the keeper's rule now (`people-host.js`, `run`), and "behind" means the world is
  getting less than nine tenths of the time that passed.
- **The People world is not on the page** (2026-11-15, `TODO.md` item 3; "Off the page's thread"
  above). The page holds the land as it was made, the last frame, the villages and factions as
  last sent and what the open panel needs; it asks for one frame and one panel at a time. A panel's
  answer for a tab, person or search that has since been left is not drawn, and the routine
  refresh is not drawn over a finger that has come down on the panel. Tapping a name takes the view
  to them when the next frame says where they are.
- **"How many people" has a box as well as a slider**, and under it one line saying how fast this
  computer runs the world as set ("What this computer can run" above).
- **People has a searchable population list** (2026-11-12, Ric: "Build the next features
  from the vision"; since TODO 21f it is behind "Everybody, A to Z", and the tab opens on pins and
  people worth a look). Name search combines with settlement, faction and occupation filters.
  Each row shows age, job, settlement, faction and current activity; selecting it locates and
  follows that person. Back to People preserves filters, page and scroll position; a new world
  resets them. Results are alphabetical, sixty per page, with live counts and an empty state.
  Search/filter controls stay outside the live result redraw so typing and focus survive updates;
  filters collapse to leave room for results on a phone. Living parents, children, partners and
  the current conversation partner are linked in inspection. Either name in Talk can be selected;
  people who have died are labelled rather than linked. A selected person's death has a way back
  to the living population. There is still no archive of the dead or saved bookmarks.
- **People are boxes, with smaller children and a white ring on leaders.** Ric, 2026-11-13:
  "people can be boxes". The square diagonal fits the body clearance; equipment still reads
  actual ownership. The miniature uses boxes too. Roles are
  written beside them at close zoom, rather than encoded as triangles or dots. Tapping a person
  selects them and the Inspector states their current activity; "Follow" keeps the camera with them
  (since TODO 21e a tap no longer follows on its own). The map key is a fold on the Overview, and
  the corner of the map holds the legend of the layer showing.
- **Harvesting takes five seconds at 1×**, on the field where food is actually collected; a crop
  outline and stalks mark it. Walking to a field, bringing food home, making goods, trading and
  guarding have separate activity labels.
- **Read exchange holds one conversation still while the world continues** (2026-11-12,
  next milestone from the People vision). Talk lists the latest forty exchanges; selecting one
  keeps its transcript, participants, time, original circumstances and before/after effects.
  Inspect either participant and return to the selected exchange, return to the live recent list,
  or locate where it happened. Gold rings identify the living participants on the map while
  reading. This does not pause the world; Pause remains explicit.
- **Conversation effects are receipts, not interpretations of the dialogue.** `converse()`
  snapshots both people before calling the unchanged interaction logic and attaches actual
  changes after it returns, including changes made after `said()`. Food, possessions, beliefs,
  loyalty, the relationship toward the other participant, home, faction, occupation, partner,
  learned news, sickness and faction relations can be recorded. The observer makes no RNG calls
  and writes no model state. The rolling history remains capped at 160, with monotonic exchange
  IDs; the page holds just one selected record outside it until cleared or a new world starts.
  These are facts from that exchange, not current beliefs, a saved world or a full life history.
- **Conversations stop both people for six seconds at 1×.** A gold line joins the actual pair,
  and speech bubbles name speaker and listener. Work is not interrupted by a new conversation
  while harvesting or making goods.
- **People occupy space.** Bodies stay at least 0.42 tiles apart, including starting crowds and
  newborns. Each movement checks a spatial hash and tries to slide round a blocked neighbour;
  if no step fits, the person waits. Destinations choose a free nearby spot, and a person who
  stops getting closer than they have already been tries a bounded half-tile A* route around
  the crowd, including paths that first move away from the destination. Every route edge and
  footstep checks body spacing. The search stops after 800 expansions and retries at most
  every thirty activity ticks. Starting residents wait where they fit instead of all heading
  for the village centre. Markets and fields accept arrival within half a tile so a shared
  destination does not require sharing a position. Local tasks within 2.5 tiles retain the daily engine’s existing nearby-arrival rule:
  after twenty-five stalled ticks they retry a free nearby spot, up to three retries, then
  work from the nearby spot they occupy. Eating/outfitting also require proximity to home. Inter-village scouting, loading and
  delivery never use that shortcut; an enclosed courier still needs a real opening.
- **Traders may prospect for a market when prices are equal.** Ric, 2026-11-13: "people dont
  travel to other places much seems like they get stuck at vilages". This is a choice in
  `choose()`, competing with feeding, rest, safety and useful work. Fed traders can visit the
  least recently checked safe market within the existing 34-tile reach, preferring closer
  places on ties. Shared-store carriers stay within their faction. Arrivals are remembered;
  prospecting creates no cargo or profit. All purchases still need real stock and coins;
  a person away from the source walks back to load rather than buying from a distant store.
  Hostile and abandoned markets are excluded. Activities name the destination; `test/day.mjs`
  groups names back into stable activity categories for the existing day-shape measurements.
  Other occupations retain the newer engine's work, family and migration choices.
- **Speech is drawn as words only when zoomed in**; farther out a small mark shows somebody is
  talking. The Talk tab has the last forty exchanges either way.
- "← Setup" is the way out of a running world; the site's "← Ric's Terminal" control is on the
  other two screens and hidden while a world runs, because it would sit on the map. On the
  settings screen it sits in the bar along the bottom, in a slot kept clear for it — floating
  above the bar it covered whichever panel of settings happened to be there. On a phone there is
  no room beside the buttons, so that bar grows a second storey and the control sits in it.
- Typed egg: `genesis` (in `relay-return.js` and `EASTER_EGGS.md`). Space pauses a world, so the
  word has no space in it.

## Not done

- The front door and `latest.js`, as above.
- A share card. `assets/og/build-og.py` draws them with Windows' own fonts, and this page was
  built in a cloud session that has none, so a card drawn there would not match the others. Add
  a row to that script's manifest and run it with `--tags` from the Windows machine.
- Nobody remembers a dead friend, there is no trade in more than two goods, and soldiers
  never attack anyone but soldiers.
- No sound.

## 2026-11-14 — boxes and journeys around crowds

Ric asked for boxes and found people staying around villages. This update preserves the newer
need-based decisions, homes, work durations and migration from `76c68dcd`; it adds route finding
and a scored prospecting choice rather than restoring the older fixed job loops. The existing
wrapping toolbar, folding key, camera fix and physics work are retained.

Before/after check of the new decision baseline (`behaviour.mjs --days=1 --seeds=2
--only=rich,talk`, 220 people, small map, seeds 11 and 108): identical seeds stayed identical.
Sleep occupied 36.7% → 36.8% of adult hours, making goods 20.7% → 20.5%, harvesting
13.7% → 13.3%, and talking 9.6% → 9.9%. Changing richness moved 9.3% → 9.2% of a day;
changing talk moved 3.8% → 6.2%; reseeding moved 7.5% → 8.2%. These are short daily
measurements, not seasonal or generation-scale validation. Targeted travel fixtures separately
check physical market arrivals, distant deliveries and a crowd detour that must first retreat.
