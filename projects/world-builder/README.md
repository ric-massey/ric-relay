# World Builder

One page, two sandboxes. You pick one, set how its world works, and run it.

Ric, 2026-11-12: *"One page. It opens. It gives two options. Physics sandbox. People sandbox. You
choose one. You then can choose options for the worlds. Like how many people. How strong gravity
is how the physics works. How the money works how long the people's lives are. Like tons of
settings. Then you hit run it opens the world."*

It grew out of two things already on the site — KONDRITE's living world and the Universe project —
but it is neither. Ric again: *"this is not going to open Kondrite. Those were just the already
written code that you could look at to get an idea of what I wanted."* So it is its own code, in
this folder, and it imports nothing from either.

Linked from Exploration (MODULE 004) and the terminal (`worlds`). Not on the front door or in
`latest.js` yet; that waits on Ric having looked at it.

## Files

The [People sandbox master vision](PEOPLE-VISION.md) records Ric's 2026-11-12 feedback and the
full direction being refined: individual lives and civilizations, deeper work and relationships,
communication, clarity, selection, following, control and equipment. It separates stated goals
from proposed mechanics; its implementation baseline and next-deliverable proposal distinguish
what has shipped from future direction, including the unresolved long-term timing model.

| File | What it is |
|---|---|
| `index.html` | The page: choose a sandbox → settings → the running world. Styles and page script inline. |
| `physics.js` | The physics sandbox's engine. No DOM; runs the same in node. |
| `people.js` | The people sandbox's engine. No DOM; runs the same in node. |
| `PEOPLE-VISION.md` | Living master design for the People sandbox; goals, proposals and open questions. |
| `test/world-builder.test.mjs` | Both engines, headless. Several minutes; in the slow lane of `.github/checks.mjs` (`--only world-builder --slow`) and in `simulations.yml`. |

No build step and no dependencies. `python3 -m http.server 8912 --bind 127.0.0.1`, then open
`/projects/world-builder/`.

## The three rules

1. **Every setting does something.** Each engine exports a `SCHEMA` — the groups, the settings,
   their ranges, the words shown beside a slider (`say`), and which other setting switches one off
   (`when`). The page builds its controls from that list and the engine reads the same keys, so a
   control cannot exist without an engine behind it. The test walks every setting and fails if
   changing one leaves the world identical. **To add a setting:** add it to `SCHEMA`, read
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

## The physics sandbox (`physics.js`)

A hexagon is a body with a mass, a position, a velocity and some heat. Whether that is an atom or
a planet is the visitor's settings — "Hexagons as planets" is a preset, not a mode.

32 settings in seven groups: the world (size, edge, seed), matter (how many, kinds, layout, spin),
gravity (strength, reach, a steady "down"), collisions (bounce, fusing), chemistry (what bonds, how
strongly, how many bonds each, whether a bond changes what it holds), heat (shaking, spreading, leaking, a heater) and space and time
(drag, a speed limit, the clock).

How it works, briefly:

- **Bodies are free particles, not lattice sites.** They start on a hexagonal lattice so nothing
  overlaps, and equal bodies pack back into one when they clump, but positions are continuous.
- **Gravity** is every pair exactly up to 500 bodies; above that, a 16 × 16 grid — neighbours
  exactly, farther cells as one lump — with the world's net force removed afterwards so it does
  not push itself across the screen. It is worked out once per frame and held through that
  frame's substeps, which is most of why 1,500 bodies run. "Far" falls as 1/distance and "near"
  as 1/distance²; `FAR_MATCH` makes them equal at 40 hexagons so one slider serves both.
- **Collisions** are impulses with the bounce setting as restitution; what a collision does not
  give back becomes heat, split by mass.
- **Bonds** are springs at touching distance. Forming one gives off its energy as heat; heat
  shakes one loose only if the pair has that much heat to pay for it.
- **Heat becomes motion** as a random shove charged for exactly the kinetic energy it made.

### Making emergence possible

Ric, 2026-11-13: *"how do we make it so emergence is something thats possible?"* The first version
could not get past clumps, because a bond meant only "these two stick": nothing a hexagon was
joined to changed what it did next. Three things were added for that, and none of them puts an
outcome in:

- **A bond changes what it holds** (`shift`, off by default). A hexagon bonds as its kind moved on
  by `shift` for every bond it already has, so what it is joined to decides what it joins next.
  `react()` re-reads each standing bond off its two ends as they are now: worth more, the
  difference comes out as heat; worth less, the pair's heat pays; worth nothing, it lets go. So a
  newcomer can knock an old neighbour off, and chains of that are reactions. It is still
  arithmetic on two kinds — no table of which reactions exist. Off, a world is byte for byte what
  it was before the setting existed.
- **A census** (`census()`, "What it has made" in the World tab). Every bonded thing named by the
  kinds in it, counted, with how many different things exist now and how many this world has ever
  made. Without it a world that keeps inventing looks the same as one stuck making pairs. Read
  off the bonds when asked; never stored.
- **Energy going through.** Reactions need heat arriving and leaving, so the "Things that react"
  preset has a hot middle and a leak. A sealed cold world reacts until it runs out and stops.

What this does **not** do, and should not be claimed: bonds have no direction, so a thing has no
shape — a chain and a ring of the same kinds are one entry in the census. Nothing copies itself,
and nothing here says it will. Bonds that hold an angle are the next step if this is taken
further, and they need each hexagon to have a facing.

### Hands

Ric, same day: *"i need a way to place them like place hexigons or give them stuff and modify
hexigons."* A running physics world has a tool row: **Look**, **Place** (tap or drag), **Throw**
(drag and let go), **Erase**, **Heat**, **Cool** and **Pin**. Place and Throw use a palette: a kind
and a typed mass multiplier. Tapping a hexagon in Look opens it in the Hexagon tab, where exact
mass, temperature and X/Y velocity can be typed; its kind, weight and
heat can be changed, it can be stopped, pinned, have its bonds broken, or be removed. "A blank
world" starts empty for building from nothing. The tools work while paused.

- A **pinned** hexagon is held where it is: collisions treat it as having no end of mass, heat
  still moves through it, and gravity still pulls on everything else from it. That is what makes
  walls, floors and anchors.
- A world has room for 3,000 hexagons added by hand on top of what it started with; a removed
  one's place is reused.
- **None of it is physics.** It is somebody reaching in, and the World tab counts how many were
  put in and taken out. Hand edits are not in a copied link — the link is the settings.

**What it conserves, and what it does not.** Mass exactly (fusing adds the two). Energy to nine
digits when nothing is meant to take it — the test holds motion + heat + leaked to 1e-6 — and
momentum exactly through collisions and fusing. Three known limits, on purpose:

- Heat's shoves are one body at a time, so they keep energy exactly and momentum only on average.
- Gravity's potential energy is not tracked, so the energy bar says so when gravity is on.
- The speed limit is a clamp, which does not conserve anything.

This is a toy and says so. It is **not** the Universe project: that one runs on integers, asserts
conservation to the unit, and refuses to run on a constant nobody chose. Do not port code between
them in either direction.

**Credit.** Two ideas are borrowed from `projects/universe/` (and through it from the sources in
`projects/universe/SOURCES.md`): the bonding rule that reads a strength off two kinds by
arithmetic rather than from a table — "pairs that add up" is its law 2, `B = M − |v₁ + v₂ − M|` —
and "matter is the sum of kinds", which is what lets two bodies fuse into one.

## The people sandbox (`people.js`)

A map of land that grows food, villages, and a few hundred people who each need to eat. At 1×, one day takes **twenty real minutes**, and 365 days make a year (Ric, 2026-11-12:
"1x should be a 20 minute day" and "the people should move slower"). The visible clock shows
day, time and year. Pause freezes both activity and calendar; the speed buttons scale both.

Walking and work run five action ticks per simulated real second, at 0.15 tiles per action tick
(six times slower than the old 30-tick playback). The calendar advances independently: the old
200 demographic ticks per year remain for eating, aging, elections and other long-term decisions.
`advance(seconds)` is the page's real-time API; `days` is its elapsed calendar. `step(ticks)` is
the accelerated headless experiment API: each demographic tick allows eight action ticks, to
allow the new work and speech pauses during compressed runs. Those experiments test long-term
rules and settings; they do **not** reproduce the real-time economy, which allows far more activity
per year. The real-time tests separately check the first day, money, movement and crowded spawns.
This distinction matters when interpreting a century-long test result.

33 settings in eight groups: the land, the people, lives (lifespan, childhood, children, hunger,
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

## The page

- **Physics numbers are editable beside their sliders** (Ric, 2026-11-12: "you can type one",
  after taking a particle above a billion in mass; "dont say this is a feature its intuitive").
  The page adds no announcement. Slider ranges and steps remain convenient sweeps; typed decimals
  retain their precision and can go beyond them. `SCHEMA.inputMin` / `inputMax` are the actual
  limits used by the fields and `clean()`, including when opening a shared link. Most physical
  quantities allow 0–10¹²; mass allows 10⁻⁶–10¹², fractions stay 0–1, and integral counts stay
  integral. World width is 4–1,000 and starting bodies 0–20,000 to bound browser work; kinds are
  1–64, bonds per body 0–255 (byte storage), seeds 0–2³²−1 and clock 0.001–100×. Layouts still
  place only as many bodies as fit. Invalid or unfinished setup fields block Run; changing
  presets or Reset replaces them. The particle inspector holds its fields while focused so
  the live redraw cannot eat an edit. Body kinds use float storage because a sun/fused body's
  kind follows its mass and must not overflow at 2³¹.
- **Three screens in one file.** The address carries the sandbox and only the settings that differ
  from the defaults (`#people?people=900&rich=0.5`), so a link stays short and still opens after a
  setting is added. `&run` goes straight to the world; "Copy link" makes one.
- **The two doors run their own engines** in miniature rather than showing a picture. With reduced
  motion they draw one still frame.
- **Settings that another setting switches off are greyed**, not hidden, so the list never jumps.
- **"Surprise me" draws every setting from its own range.** Most of those are bad worlds. That is
  the point.
- **A frame advances at most a tenth of a second of real time** rather than owing a growing
  backlog, so a slow phone runs slower instead of freezing; a note says when it is behind.
- **People are human figures, with smaller children and a white ring on leaders.** Roles are
  written beside them at close zoom, rather than encoded as triangles or dots. Tapping a person
  zooms in and follows them; the Person tab states their current activity. A map key explains this
  on the running screen.
- **Harvesting takes five seconds at 1×**, on the field where food is actually collected; a crop
  outline and stalks mark it. Walking to a field, bringing food home, making goods, trading and
  guarding have separate activity labels.
- **Conversations stop both people for six seconds at 1×.** A gold line joins the actual pair,
  and speech bubbles name speaker and listener. Work is not interrupted by a new conversation
  while harvesting or making goods.
- **People occupy space.** Bodies stay at least 0.42 tiles apart, including starting crowds and
  newborns. Each movement checks a spatial hash and tries to slide round a blocked neighbour;
  if no step fits, the person waits. Destinations choose a free nearby spot, and a person who
  stops making progress retries that choice. Starting residents wait where they fit instead of
  all heading for the village centre. Markets and fields accept arrival within half a tile so a
  shared destination does not require sharing a position. This is local avoidance, not a global
  route planner: very dense crowds can still queue.
- **Speech is drawn as words only when zoomed in**; farther out a small mark shows somebody is
  talking. The Talk tab has the last forty exchanges either way.
- "← Settings" is the way out of a running world; the site's "← Ric's Terminal" control is on the
  other two screens and hidden while a world runs, because it would sit on the map.
- Typed egg: `genesis` (in `relay-return.js` and `EASTER_EGGS.md`). Space pauses a world, so the
  word has no space in it.

## Not done

- The front door and `latest.js`, as above.
- A share card. `assets/og/build-og.py` draws them with Windows' own fonts, and this page was
  built in a cloud session that has none, so a card drawn there would not match the others. Add
  a row to that script's manifest and run it with `--tags` from the Windows machine.
- Physics: bonds have no direction (see above), and a hand-built world is not saved or shared.
- People: nobody remembers a dead friend, there is no trade in more than two goods, and soldiers
  never attack anyone but soldiers.
- Neither world has sound.
