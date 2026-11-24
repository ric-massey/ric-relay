# People sandbox — the UI, taken apart before it is rebuilt

Ric, 2026-11-24: "i want to do a revamp on the ui and looks … first analize what the sim
actually does not what it says it does … what would be the settings that most people would
want to change or the most used. and then advanced settings would have all of them … this is a
high quality simulater and the ui needs to show it."

This file is the analysis, and a proposal built on it. **Nothing here is built yet, and the
proposal is not agreed** — the questions at the end are Ric's to answer before any of it is.
Everything below was read off the code on 2026-11-24 (commit `7dd70a2c`) or measured on that
date; the measurement and how to re-run it are in "How the settings were measured".

## 1. What the page is today

### The setup screen

- **157 settings in 12 groups**, every one on one page, every group open on a desktop. The page
  is **14,467 px tall** at 1,024 px wide, and carries **about 7,000 words of help** — one
  paragraph under every setting.
- Eight starting points sit above it (An ordinary country, Too many people, No money, Chiefs and
  soldiers, Short lives, One people, Two old enemies, A quiet world).
- Groups by size: Minds 38 · War 29 · Lives 27 · Their nature 12 · Money 11 · The land 10 ·
  How it starts 9 · The year 6 · Power 8 · The people 4 · Detail 2 · Time 1.
- "How many people" — the one setting most people touch first — is the first item of the
  **fourth** group, below the land, the year and the era.

### What those 157 settings actually are

Read one by one, they fall into six kinds, and only the first three are choices a visitor makes
about *their world*:

| Kind | How many | What it is | Examples |
|---|---|---|---|
| **The world** | ~10 | How big, how many, when, where | land size, people, factions, villages each, era, where they live at first, seed |
| **Dials** | ~30 | A number that tilts how things go | how rich the land, winter, births, life, talk, aggression, deadly, rebel, the ten traits |
| **Real alternatives** | ~15 | Two or more ways a society can genuinely work | money (coins / shared store), who leads, who holds the land, how factions start, sickness, thirst, marriage, inheritance |
| **Engine versions** ("as before") | **38** | Switch a newer mechanism off and run the engine as it was before that item shipped | `ruins: real/old`, `battle: choice/old`, `armies: march/trickle`, `tills: both/old`, `discovery: builds/roll` … |
| **Mechanism layers** | ~33 | Turn one piece of a system off; default on | 26 faith toggles (Prophets, Pilgrims, Martyrs, Sacred land …), Caravans, Feuds, Built roads, Armies meet … |
| **Running the page** | 3 | Not the world — the computer | Bodies (real / spaced), Conversations (full / light), Clock |

The 38 engine-version switches are the biggest single finding. They exist for a good reason —
every item since 15 was shipped "with the old way kept and fingerprinted", and the tests use
them to prove a new part changed nothing when off — but on the page they read as 38 decisions a
visitor is being asked to make, with option labels like "As before" that only mean something to
somebody who read the TODO. They are a developer's comparison tool, not world settings.

### The running screen

- **The top bar is two rows at 1,024 px** and **four rows on a phone**: ← Settings, Pause,
  ten speed buttons (0.5× to Max), four colour views (Factions, Mood, Beliefs, Wealth), Units,
  Whole world, Start again, Copy link.
- **The key covers the map.** It opens over the top-left of the canvas; on a phone it hides about
  half of the map strip.
- **The side panel has six tabs**: People, Factions, News, Talk, Person, World. It opens on
  **People: an alphabetical list of everybody**, 60 at a time — the least telling thing in the
  world to land on.
- **Factions** is a stacked population chart with no axes, then one long card per faction
  (up to a dozen lines of text each: rule, tax, loyalty, land, law, marriage customs, research,
  armies, faith, dealings) and the "Rule … yourself" controls.
- **World** is seven line graphs with no axes or time scale, the 13 live settings, and 22
  lifetime counters.
- **News** is the last 80 events, each with its "because" and "after" chain. A tap jumps the map.
- **Talk** is the last 40 exchanges.
- **Person** (also used for a village) is the inspector.

### What can be clicked

| On the map | Today |
|---|---|
| A person | Opens Person, zooms, can follow |
| A village marker | Opens the village |
| Faction territory, a house, a field, a road, a ruin, a boat, a caravan, an army, a unit, a battle | **Nothing** — all drawn, none selectable |

| In the panel | Today |
|---|---|
| A faction card | Jumps the map to its biggest village |
| A news item | Jumps the map to where it happened |
| A name (family, friends, Talk) | Opens that person |
| The faction chart, the graphs, the counters | **Nothing** |

### What the engine knows that the page never shows

The world object exposes about 330 functions and tables. The page reads a small slice. Among
what is simulated and invisible or nearly so:

- **Buildings and ruins** — every house's stage and worth, what is left in a ruin (drawn as
  shapes; no inspector).
- **Armies** — units, officers, formation, plan, scouting, the general and their skill, camps,
  supply lines, sieges, prisoners and ransom, desertion, war loans. The panel shows one line
  per army ("marching on X").
- **Faith** — each faith's rules, holy days, wealth, schools, courts, pilgrims, sacred land,
  martyrs. The panel shows its name and a few clauses.
- **Know-how** — every technique, who knows it, what is within reach (one collapsed
  "Research" line).
- **Trade** — caravan routes, boats, prices by village, what is on order, who carries what.
- **Households** — one purse and one pot, what they hold, who works where.
- **Causes** — `because`, `chainNote`, `why` on decisions: shown only as small grey lines
  under a news item.

## 2. What the sim actually does

Not what the labels say: what a default world (seed 11, every setting as it comes) did over its
first two years, run headless with the same engine, read every three months.

| Month | People | Born | Died (sick · battle · old · starved) | Wars going on | Soldiers | Hunters | Farmers |
|---|---|---|---|---|---|---|---|
| 3 | 382 | 3 | 18 · 0 · 3 · 0 | 0 | 32 | 111 | 116 |
| 6 | 381 | 2 | 0 · 0 · 0 · 0 | 0 | 32 | 103 | 122 |
| 9 | 376 | 1 | 1 · 2 · 1 · 0 | 2 | 31 | 93 | 128 |
| 12 | 374 | 7 | 1 · 1 · 1 · 0 | 5 | 55 | 88 | 97 |
| 15 | 370 | 3 | 7 · 0 · 0 · 0 | 5 | 54 | 70 | 104 |
| 18 | 380 | 16 | 3 · 0 · 0 · 0 | 5 | 28 | 65 | 132 |
| 24 | 383 | 6 | 2 · 0 · 0 · 0 | 5 | 53 | 56 | 106 |

(400 people, 4 factions, 8 villages at the start; 10 villages after; 136 remembered events in two
years, about five a month; one election.)

What that says for a UI:

1. **A world is mostly a working day.** Nearly everybody farms, hunts, herds, cooks, fetches,
   sleeps and talks, and that is what the map shows nearly all the time. The UI's first job is
   to make *a day* legible — who is doing what, where the food is, who is hungry — not to wait
   for a battle.
2. **Big change is slow and rare.** Population moved 5% in two years. By month 12 five of the
   six pairs of factions were at war and stayed so for the next year, while war killed three
   people in two years. A visitor watching at 1× would never see a war "happen"; they would need
   to be *told* that it began, why, and what it is doing. Headlines, the "because" chain and
   graphs with real time on them carry that, not the map.
3. **The first weeks are the busiest.** 18 of the 22 sickness deaths in two years came in the
   first three months. A visitor's first minutes are exactly when the most is happening and the
   least is explained.
4. **The economy turns over underneath.** Hunters fell from 111 to 56 while herders went from 6
   to 22 and crafters, miners and woodcutters appeared — the early era changing its livings.
   None of that is visible on the page except by scrolling the People list.

(Five wars that run a year and kill nobody is worth a look on its own — possibly armies that
never meet, possibly right for wars "for land" between peoples this small. It is noted here, not
investigated: this is a UI analysis, and Ric decides whether it is a bug.)

## 3. Which settings change a world, measured

Every setting but the seed and the clock was set half way to its far end (the same "other value"
`behaviour.mjs` and `world-builder.test.mjs` use) and run against the default world on the same
seed: 220 people, 3 factions, small land, **60 days**, two seeds each. Two things were read:

- **Days** — what share of adults' hours were spent differently, divided by how much rerolling
  the seed moves them (17.4%). 1.0 means "as different as a whole new world".
- **Outcomes** — people, births, deaths by cause, wars, elections, thefts, coins and who holds
  them, mood, hunger, villages, factions — each in units of the spread between reseeded worlds.

`test/settings-impact.mjs` re-runs it (about nine minutes on 11 cores).

### Felt within the first two months

| Setting | Days | What moved |
|---|---|---|
| How many people (×2) | 0.60 | everything, by size |
| Coins to start | 0.28 | the money in the world ×3 |
| How they trade (shared store) | 0.48 | coins gone, nobody rich |
| Where they live at first (hamlets) | 0.53 | three times the villages |
| How many factions | 0.55 | villages, a first election |
| Peoples who forage / Era (foragers) | 0.70–0.73 | wealth spread flat, mood up |
| Food put by | **1.22** | hunger down, wealth flatter |
| Materials (one kind of goods) | **1.92** | the most different days of any setting |
| Places empty at the start | 0.36 | people −6σ |
| Villages each | 0.57 | villages, wealth |
| Prices (fixed) — live | 0.29 | wealth flatter, mood down |
| Animals that work (none) | 0.38 | hunger +5σ |
| How much it grows — live | **1.16** | how the day goes |
| The world starts in (summer) | 0.44 | wealth |
| Who starts rich / Tax at the start | 0.26 | coins, mood |
| How much land, how uneven, forest, hills | 0.35–0.63 | villages, hunger, sickness |
| Experience | 0.98 | days |
| Bodies (spaced out) | 0.95 | days — a page setting that changes the world |
| How old they are, crops in the fields | 0.65–0.71 | talk, hunger |
| How much they talk — live | 0.67 | conversations −2.5σ |
| How cold winter gets — live | 0.74 | days, wealth |

### Not felt in two months: **60 settings made a byte-for-byte identical world**

All of **War** but 3, all of **Power**, and **all 26 faith settings** — plus Thirst (gentle),
People on the road, Irrigation, Ruins, Scavenging, The penniless, How often new things are found,
Hearing of a thing, and Conversations (light). In those two months there was no war, no election,
no faith founded and no famine, so nothing that reads those settings ever ran.

That does not mean they do nothing: `world-builder.test.mjs` already proves each one changes a
world within 7 to 30 years. It means **they are slow settings** — they shape the story of a world
watched for an hour, not its first minutes — and it is the single strongest reason to split the
page into layers.

**Run again for a whole year** (one seed each, three reseeded base worlds), they split:

- **Felt within a year (19):** Wars (off: no wars, −4σ; the largest effect of any), Working harder
  at war, The penniless, How often new things are found, Comfort, News of plenty, Land as property,
  Soldiers on campaign, Sickness in armies, Generals, Siegecraft, Prisoners and ransom, Battle,
  Taking a place, How quick to fight, How deadly, Chasing an enemy home, Wounds and small wars,
  Raids — and, barely, Bandits and Changing sides.
- **Still byte-identical after a year (41):** 24 of the 26 faith settings, Who holds the land,
  A vote every, **Breaking away (live)**, Food riots, Caravans, Built roads, Armies meet, Armies
  spread out, What war follows, Where soldiers stand, Coming to a place, Crossing another people's
  land, Thirst (gentle), People on the road, Irrigation, Ruins, Scavenging, Hearing of a thing,
  and Conversations (light).

So **a quarter of the page's settings do nothing a visitor can see in the first year** of a
default world. One of them, Breaking away, is a live control on the running screen, and another
live one, Changing sides, barely moves a year. That is not a fault in the engine — faiths, breakaways and
elections are rare by design and nothing forces them — but a UI that puts those controls in
front of a visitor promises an effect they will not see for a long time. On the running screen
they should say so: "nothing has called on this yet in this world".

### Which settings people reach for

There is no record of what visitors change (the setup page sends nothing), so the closest
evidence is what the eight starting points change: How many people (4), factions (4),
aggression (3), breaking away (3), how much it grows (2), how much land (2), how far apart they
start (2), who leads (2), tax (2), how loyal (2), who starts rich (2), and once each money, life,
grown up at, children, clock, villages, how the factions start, coins, wars and sickness.

### The Essentials, from both

What a visitor sees before Customise — the settings that change a world soonest, plus the few
that decide what a world *is about* even though they act slowly (who leads, how the factions
start, war):

1. Starting point (the eight presets)
2. How much land
3. How many people
4. How many factions
5. Era
6. Where they live at first
7. How much it grows — *live*
8. How cold winter gets — *live*
9. How they trade (coins or a shared store)
10. Who leads, at first
11. How the factions start (friends, strangers, enemies)
12. Wars, and How quick to fight — *live*
13. Sickness — *live*
14. Seed

Everything else is on Customise; the engine-version switches and mechanism layers are on Model.

## 4. The proposal

Five rules the whole proposal keeps, all of them already Ric's:

- **Nothing is hidden that exists.** Every one of the 157 settings stays reachable, every one keeps
  doing what it does, and shared links keep working (a link names settings by key, so moving a
  control on the page changes no link).
- **Every setting does something** — and the page now shows how much (section 3), so a setting
  that moves nothing in a year is not on the front of the page.
- **Nothing scripted, nothing faked.** The UI reports what the engine decided, from the numbers it
  decided with. A chart, a badge or a headline never says more than the engine did.
- **No look of an AI build** (the front door's rule): no glowing pills, numbered headings,
  letter-spaced capitals, gradients. Words plain and few.
- **The page never reads the engine** (item 3): anything new it shows is added to what
  `people-host.js` sends.

### 4a. Setting up a world: three layers, not one wall

**Layer 1 — Start.** One screen, no scrolling on a laptop. The starting points as large cards
with a moving miniature of each (the page already runs one for the front screen), and beside
them the **Essentials**: about a dozen settings, chosen by measurement (section 3), each with a
one-line label and its value in words. Help moves behind an ⓘ on each row, not under it. The
"what this computer can run" line stays under How many people. One button: Run this world.

**Layer 2 — Customise.** The rest of the world and dial settings, in **tabs rather than one long
page** — Land & climate · People & lives · Economy · Society & power · War · Minds & faith — with
a short "changed from the usual" summary on each tab and a search box over every label and help
line ("plague", "tax", "boats").

**Layer 3 — Model** (Advanced). The 38 engine-version switches and the 33 mechanism layers, in
one place, said plainly for what they are: *"Each switch turns one part of the simulation off or
back to an earlier version. They exist to compare. A visitor never needs them."* The faith layer's
26 toggles collapse under one Faith switch with a "choose parts" fold. The page's own settings
(Bodies, Conversations) go to a small Performance fold here too.

The Surprise me, Reset, Copy link and "N settings changed" controls stay, in a bar that follows the
page.

### 4b. The running screen: map first, one bar, one panel that follows what you look at

- **One bar, one row**, at any width: ← Setup · ▶/❚❚ · a speed control (Slow 1× · 16× · Max, with
  the finer steps in a menu; it says the speed reached, as it does now) · the date and season ·
  population with its trend · **Layers ▾** · ⋯ (Whole world, Start again, Copy link, Units).
- **The map fills the window.** The key becomes a small Layers legend in a corner that explains
  only the layer showing, closed after the first look and never over the middle of the map.
- **Layers, not four colour buttons.** Today: Faction, Mood, Beliefs, Wealth. The engine already
  holds enough to add: Hunger, Sickness, Faith, Loyalty, Land ownership, Roads & trade,
  Armies & war. Each with a legend that says what the colours mean.
- **A world strip** along the bottom on a desktop (behind a tap on a phone): five or six
  sparklines with labelled axes and real time — People, Food in store (days), Hungry,
  Deaths a month, At war, Loyalty — each tap opening the full graph.
- **Headlines.** An event the engine weighs ≥ 3.5 (it already weighs them) appears briefly as a
  line at the top of the map — "Far Fold declares war on Stone Compact" — tap it to go there and
  pause. Never more than one at a time; the News list keeps all of them.

### 4c. Clicking: everything drawn can be looked at

One inspector, on the right on a desktop and as a sheet from the bottom on a phone, that shows
whatever was last tapped, with a back arrow through what you have looked at:

| Tap | The inspector shows |
|---|---|
| A person | As now, reorganised: a header (name, age, job, home, faction, what they are doing and the need that won), then folds for Needs, Nature, Mind, Family & friends, Possessions — with the family drawn as a small tree, the dead included once item 19 keeps them |
| A village | Population trend, food store in days, prices, what is on order, its houses and workplaces, its loyalty and what moved it, its tax and relief (with the ruler's controls when you rule) |
| A faction's land | The faction: leader, government, laws, faith, know-how, army, relations with each neighbour as a small diagram — and "Rule it yourself" |
| An army | Its general, units, plan, supply, what it is marching on, the battles it has fought |
| A house, ruin, field, road, boat or caravan | What it is, whose it is, what is in it, and how it came to be |
| A news item | The event, its "because" and "after" as a chain you can tap back through |

The six fixed tabs become four: **Overview** (the world strip in full, the counters, the live
rules), **People** (search and filters, but opening on *people worth looking at* — leaders, the
newly married, the hungry, the sick, soldiers in the field — rather than A to Z), **News**
(with the talk folded in as a filter, since both are "what just happened"), and the
**Inspector**.

### 4d. Changing a world while it runs

Today 13 settings can be changed while a world runs, and they are listed with steppers at the
bottom of the World tab. The proposal moves them into a **Rules** drawer reached from the bar,
grouped as the setup page is, each showing its value and the setting it started at. Which
settings may be live stays exactly the engine's rule (`live` in the schema and Ric's
2026-11-14 test: only what the engine reads as it goes, and never a person's nature or a
leader's decision). Ruling a faction stays where it is — on the faction — since it is a
leader's decision, not a world rule.

TODO items 17 and 18 (catastrophes dropped mid-run) will need a place on the running screen;
the Rules drawer is where they would go, as a second section, **Happenings**.

### 4e. Looks

The page already has a dark, map-coloured look and a good land painter (item 5). The proposal
keeps that and changes the furniture: one type scale, quieter panels with more space, real
legends and axes, colour that means something (the faction colours, a hunger red, a calm
accent) and nothing that decorates. Mock-ups would be made as still pages in `docs/mockups/`
first, the way the front door was, for Ric to look at before anything is built.

## 4f. Colour, style, research and saving — now in TODO.md

Ric, 2026-11-24 (the same day): "all of this needs to be added in todo.md … research for sims and
what makes them fun … what information can we show that is going to be intresting … we will have
a saving feature". **The work is item 21 of `TODO.md`, split 21a to 21h**, and the research lives
under it: what makes a simulation fun and brings people back (Sylvester, Koster, self-determination
research, Dwarf Fortress's Legends), how dense sims show information (Paradox, Cities: Skylines,
RimWorld), the colour measurements (21a: borders at 1.47:1, the first faction sharing the accent,
two faction colours identical under deuteranopia), what to show and what to put one tap away
(21g), and saving a run with all its data (21h: about 300 KB gzipped for the default world, a
recipe plus snapshots, a CSV export of the history). This file stays the analysis; TODO.md is
where the work and its research go from here.

## 5. Questions for Ric

1. **The Essentials list** (section 3's table) — keep it as measured, or are there settings you
   want on the front because they are what the sim is *about*, even if they move a short run
   less?
2. **The 38 engine-version switches** — move them to an Advanced → Model section (recommended),
   or take them off the page entirely and keep them for tests and shared links only?
3. **The faith toggles** — one Faith switch with its 26 parts folded under it (recommended), or
   keep each part a setting of its own on the Customise tabs?
4. **The panel** — four tabs (Overview, People, News, Inspector) with Talk folded into News, or
   keep Talk its own tab?
5. **Headlines over the map** for the biggest events — yes, or keep the map clear and let News
   carry them?
6. **Where to start** — mock-ups first (still pages in `docs/mockups/`, as the front door was), or
   go straight to the setup screen, which is the most self-contained part?
7. **A TODO item** — should this become an item in `TODO.md` (say 21, "The People UI"), split into
   parts — setup, run bar and layers, inspector, panel — so "work on 21a" works like every other
   item?

## How the settings were measured

- **Section 2**: `People.create({ seed: 11 })`, `step(24)` a day for 720 days, `stats()` and job
  counts read every 30 days and summed by quarter. Took about four minutes.
- **Section 3**: `node projects/world-builder/test/settings-impact.mjs` (60 days, seeds 11 and
  108 for each setting, four reseeded base worlds for the noise), and again with
  `--days=365 --seeds=1 --only=<the 60 silent ones>`. The world is `behaviour.mjs`'s small busy
  one (220 people, 3 factions, small land, a full village at 60), so a setting's effect in a
  big world can differ. The "other value" is `day.mjs`'s `other()`, shared with the existing
  tests.
- **Section 1**: counts read off `SCHEMA` with node; page height, row count and help-text words
  read in the browser at 1,024 px; screenshots of the run screen at 1,024 px and at 375 px.
- Measured on Ric's Windows machine, 12 cores, 2026-11-24.
