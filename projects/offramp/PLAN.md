# OFFRAMP — the corridor rebuild

Working plan. Written 2026-08-05, after deciding the game is one real
freeway rather than a fictional region.

---

## 1. The idea, stated back

Correct me where this is wrong — everything below is built on it.

**It is not a map of places. It is a map of one freeway.**

The current map is a fictional region: twenty invented metros, sixteen
invented corridors, crossings found by spatial hash. That produces a
*network*, and a network is a thing you navigate. This game does not
navigate. It drives.

So instead: **one real corridor, end to end.** I-40 first. You choose
**WEST or EAST** at the sign, and then you are on that road.

### The rule that makes it work

**You never turn.** Not left, not right, not at a ramp terminal, not
anywhere. Every ramp you take eventually puts you back on a through
road.

This is not a limitation being worked around — it is the design. The
current code apologises for it at length in `world.js`, explaining that
a diamond interchange "cannot be built on this engine" because you turn
at the terminal, and building cloverleaf quadrants instead as a
workaround. Under the new framing the workaround becomes the point: the
whole vocabulary of a real Interstate is things that peel off to the
right and come back.

**"No turning" does not mean "no stopping."** You said exits with stops,
and that is compatible: you can sit at a red light and then continue
*straight through* it. What you cannot do is turn at one. This matters
because the traffic-signal implementation was complete and correct, and
is worth rebuilding the same way (see §3).

### The two topologies, and there are only two

Everything on a real Interstate that you can traverse without turning is
one of:

1. **Loop-back** — leaves the mainline on the right, runs its own
   course, merges back. Rest area, truck stop, weigh station, cloverleaf
   loop, folded diamond.
2. **Through-braid** — a parallel roadway alongside the mainline with
   several transfer points. Collector–distributor road, express/local
   lanes, frontage road.

That is the entire structural vocabulary. Nothing else is needed.

### The specific things you named

- **Papermill** — *"an exit that leads to exits with stops, or you can
  just get back on."* That is a **collector–distributor road**: you
  leave the mainline onto a parallel roadway which has its own exits,
  some signalised, and one of which returns you. Through-braid.
- **Truck stops and rest areas** — *"you can drive straight through."*
  Loop-back with no decision point. Safe.
- **Lots of lanes, lots of exits, sometimes** — the corridor varies.
  Rural I-40 is two lanes each way; through Knoxville, Nashville and
  Memphis it is far more, with exits far closer together. That variation
  is read off the real road, not invented.

### What "simulation" means here

Confirmed 2026-08-05: **the road is simulated, the driving is not — yet.**

> *"the road just needs to have exits in the same place at the right
> distances. like if i traveled 30 minutes at 45 mph between two points
> and in game we would get off on the same exit"*

That is **metric fidelity**, and it is a testable spec rather than a
taste: 30 min at 45 mph is 22.5 miles, so the exit reached at that point
must be the exit that really is 22.5 miles along.

And **real curves too** — the shape of the road is part of it, not just
the spacing. That retires the earlier worry about real curves being
tighter than `FREEWAY_CURVE` (1/3400, ~609 m): that constant constrains
the *generator*, and imported geometry must not be smoothed to fit it.

The driving model — speeds, scoring, whether leaving the tarmac is
fatal — is explicitly deferred. Do not touch `V_MAX` or the score yet.

### Nothing goes over I-40

Anything that would cross above the mainline is removed or sent
underneath. This is the direct fix for *"you can't tell what's over or
under"* — if nothing is ever above the road you are on, the view is
never occluded and the question never arises.

### Later corridors

Knoxville is I-40. **Cincinnati is not on I-40** — it is I-71/I-74/I-75.
So the engine must take *a corridor* as data, not hardcode I-40.
Everything below is written that way.

---

## 2. What the game becomes

You asked me to work on how the game itself works around this. Here is
the shape, with a recommendation. **These are decisions for you, not
settled facts.**

### The problem to solve

If every exit returns you to the freeway, then every exit is *optional*.
Staying on the mainline always works. So the exits need a reason to
exist, or the game is a straight line.

### Recommended: the exits are the score

Make taking an exit and returning cleanly the scoring action, weighted
by how demanding the structure is:

| Structure | Risk | Why you would |
|---|---|---|
| Mainline | none | safe, low score |
| Rest area | very low | small bonus, restores something |
| Truck stop | low | refuel / restore, small bonus |
| Cloverleaf loop | medium | tight radius at speed |
| C-D road | high | multiple exits, signals, queues |

That makes *"or you can just get back on"* a real choice with a real
cost, which is what your Papermill description is actually describing.
And it earns the title: **one leads to the next.**

### Supporting systems

- **Traffic has been deleted** (2026-08-05, never committed). It is
  what makes lane choice matter and what makes a signal queue
  dangerous, and it comes back once the corridor is right. Rebuild it
  after Phase 4, not before — cars that choose exits are worth nothing
  until the exits are the right exits in the right places.
- **A range meter** that only truck stops refill would force the
  pass-through structures into the loop instead of leaving them
  decorative. Optional, but it is the cheapest way to make them matter.
- **Signals** should be rebuilt the way they were: a red light as a
  stopped car of zero length, so ordinary car-following makes the queue
  assemble itself and overflow backwards up a ramp with nobody writing
  that. Arriving at the back of one at speed is the best hazard this
  game has ever had and it was never once used in play.

### Open questions for you

1. Is there an **end**? A run down all of I-40 is ~2,555 miles. Does the
   run end at a state line, at a city, or only when you wreck?
2. Does **direction** change anything beyond geometry — different exits,
   different difficulty?
3. Is there **fuel/range**, or is distance the only resource?
4. Should the player be able to **stop** voluntarily, or is this always
   a forward-motion game?

---

## 3. What survives

Verified against the code — this is the good news, and it is most of it.

| Component | File | Status |
|---|---|---|
| Rasteriser | `raster.js` | untouched, pixel-exact |
| Road model (`s`/`u`, cross-section, lanes, aux) | `road.js` | untouched |
| `deck` height field, `layer` paint order | `road.js` | new, keep |
| Ramp builders `makeRamp` / `makeLink` | `road.js` | ~~keep — these build the loop-backs~~ **deleted 2026-08-09.** They did not, in the end. The corridor's three builders — `buildRealRamp`, `buildStop`, `buildLeftExit` — all go through `makeRoute`, and neither of these was called once after the survey arrived. See the note left in their place. |
| `makeStreet` | `road.js` | keep — **this is already a C-D road**; it was deliberately built with its own `exits` array |
| Surface classification, handover, rescue | `world.js`/`offramp.js` | keep |
| Level-by-level rendering, parapets, deck shadow | `draw.js` | keep |
| ~~Traffic~~ | ~~`traffic.js`~~ | **deleted.** It did not depend on the mesh — it only used `World.nextExit`, `road.merge`, `road.exits`, `road.meter` — so it would have survived the rebuild. Removed anyway, to be rewritten against the finished corridor. |
| `road.meter` hooks | `road.js`/`world.js` | the field and its per-frame phase update survive; the signal head, stop bar and queue behaviour went with traffic.js. |
| Test harness (`?debug`) | `offramp.js` | keep, extend |
| Arcade cabinet, WEST/EAST | `index.html`/`offramp.js` | done |

---

## 4. What gets deleted

**Already done (2026-08-05):** `traffic.js` deleted entire, plus its
call sites — the separating-axis box test, contact detection and pass
scoring in `offramp.js`, and `vehicleBmp`/`vehicle` in `draw.js`.
`crash()` survives, so the barrier, the gore and the verge still end a
run; there is simply nothing left to hit that moves. Score currently
comes from distance and from taking exits.

**Done.** `CITIES`, `ROUTES`, `RING`/`BELT_R` and the perimeter loop,
`buildRegionalMap()`, `ellipse()`, `crossings()`, `plantInterchange()`,
`planDiamonds()`/`plantDiamond()` all went with the fictional map.

**Done 2026-08-09**, the last of it, found by audit rather than by
plan — each of these was defined, exported and never called:

- `flyover()` / `flyoverSpan()` — this list had them down as "no longer
  needed if nothing crosses over the mainline", and nothing does. The
  bridges this road has are measured where they are built.
- `W.cities`, `W.exitNo`, `W.trunks`, `W.longOverlaps` — fields nobody
  wrote and nobody read.
- `MAP_SEED` / `seeded()` — the deterministic generator for a map that
  is now surveyed. `hashBlock()` does the one remaining job.
- `World.nextExit()` — traffic's, and traffic will write its own.
- `road.makeRamp()`, `road.makeLink()`, `road.growBack()`,
  `road.changeLanes()`, `road.setRandom()`, `road.nearBounds()`.
- `difficulty()` in `offramp.js`.

`R.LANE_CHANGE` survives `changeLanes()` because `World.applyLanes`
still eases the surveyed counts over it.

Also deleted: the `I-79 / I-81` duplicate-corridor defect, which cannot
exist when there is one corridor.

**Kept from the map layer:** the spatial index (`index`/`nearby`/
`locate`), `dress()`, `overlapRanges()`, `raise()`, `clearance()`,
`classify()`, `surface()`, `freeze()`, `stats()`.

---

## 5. What gets built

### Phase 1 — the corridor data model

Replace the mesh with a mile-indexed feature list.

```js
const CORRIDOR = {
  id: "I-40", name: "INTERSTATE 40",
  geometry: [...],                  // real centreline
  lanes: { E: [[mi0, mi1, n], …],   // per direction, per mile range
           W: [...] },
  features: [
    { mile, dir: "E"|"W"|"both", kind, name, … },
  ],
};
```

- `road.makeRoute()` already turns waypoints into stations — it takes
  the geometry as-is.
- `road.changeLanes()` already tapers lane counts over 172 m — it takes
  the lane profile as-is.
- Build becomes a single linear pass. No crossing detection.

**Deliverable:** a corridor loads and is drivable end to end with no
features on it.

### Phase 2 — the feature vocabulary

One builder per structure. Each returns roads that merge back.

| Kind | Topology | Notes |
|---|---|---|
| `rest` | loop-back | parallel, parking stubs, no decisions |
| `truckstop` | loop-back | wider, through lane past the pumps |
| `weigh` | loop-back | short, signed |
| `loop` | loop-back | existing `makeRamp` 270° |
| `folded` | loop-back | exit → **signal** → return |
| `cd` | through-braid | `makeStreet` + its own exits, some signalised |
| `split` | branch | mainline divides, both sides through routes |

**Deliverable:** each builder has a test in `?debug` that drives it and
proves you come back onto a through road.

### Phase 3 — the invariants

Both assertable at build, in the same place `clearance()` lives:

1. **No turn required.** Every ramp terminates in a merge onto a through
   road. No ramp ends at a stop line you cannot leave.
2. **Nothing above the mainline.** For every road, at every station,
   `deck <= mainlineDeck` wherever it is over the mainline's footprint.

`clearance()` already works (it found 569 real overlaps once the
`layer`/`deck` split let it see). Extend it rather than replace it.

### Phase 4 — geography  ← *data pipeline built, 2026-08-05*

**Source: OpenStreetMap via Overpass**, fetched in longitude slices
across 33.8–37.0 N, −117.3 to −77.5 W. Files in `data/osm/`, extractor
in `data/osm/extract.py`, corridor emitter in `data/osm/corridor.py`.

What OSM gives, per way: real geometry, `lanes`, `maxspeed`, `ref`. Per
`highway=motorway_junction` node: the **exit number**. Tennessee alone
came back with 428 junction nodes and lane counts running 2–7.

Three things learned the hard way, all worth keeping:

1. **The ref regex must not require a space.** OSM writes concurrencies
   as `I 24;I 40`, so a pattern of `(^|; )I 40($|;)` silently drops every
   stretch where I-40 is not the first ref — which is most of Nashville
   and Knoxville. Correct pattern: `(^|;)I 40(;|$)`.
2. **Exit numbers reset at every state line.** A chain running TN into
   NC jumps from exit 451 to exit 7. Any check on exit numbering has to
   split into runs at those drops.
3. **Foreign exit numbers inside concurrencies.** `motorway_junction`
   nodes on shared carriageway carry whichever route owns them, so I-35's
   numbers appear on I-40 through Oklahoma City (a 25-mile phantom skip)
   and I-85's through Greensboro (95 miles). The geometry was right both
   times; only the labels were foreign. Filter on the fact that
   `number − miles` is constant within a state and may only change where
   numbering **restarts low** — every I-40 state begins at exit 0, 1, 3,
   7 or 8. A local-median filter is not enough: the Greensboro block is
   17 exits long and outvoted an 8-neighbour window.
4. **Distance evidence must be able to overrule the heading rule.** I-40
   turns 61° through downtown Nashville, so a heading test split the
   corridor in two. When exit numbers either side agree with the gap
   distance to within a mile, trust that instead.
5. **Chain fragments by heading, not by first match.** Ways link
   head-to-tail, but at a fork (the I-75 split, the end of a
   concurrency) several ways start at the same node. A motorway does not
   turn 60° at a fork — the ramp does — so take the continuation that
   best keeps the current heading.

**The projection is not a projection.** I-40 spans 39° of longitude and
no flat projection survives that. What the game needs is local shape and
along-route distance, not global position, so the route is *developed*
onto the plane: walk it point to point taking the true geodesic distance
and true bearing of each step and integrate those. Arc length comes out
exact, every curve keeps its real shape, and what drifts is global
orientation. You never see more than 660 px of it, so the drift is
invisible in play — but the overview map must be drawn from lat/lon, not
from world coordinates.

**Storage is not the problem; stations are.** ~36,000 waypoints for the
whole corridor is about 1 MB of JSON. Expanding those to 8 px stations
is 2.87M stations and 160 MB+, which is not going on a phone. So ship
waypoints and generate stations for a sliding window of road around the
player — see §5a.

**Result, 2026-08-05.** `data/osm/i40.json`, 0.63 MB:
2551 mi · 27126 waypoints · 739 exits · 732 lane changes · 70 speed zones.
Real I-40 is ~2,555 mi. Every state's numbering lands within 1.23 mi:

| State run | Implied | Measured | Error |
|---|---|---|---|
| CA  1 → 153 | 152 mi | 152.22 | +0.22 (0.15%) |
| AZ  1 → 359 | 358 mi | 357.58 | −0.42 (0.12%) |
| NM  8 → 369 | 361 mi | 360.32 | −0.68 (0.19%) |
| TX  0 → 176 | 176 mi | 174.83 | −1.17 (0.66%) |
| OK  1 → 330 | 329 mi | 329.73 | +0.73 (0.22%) |
| AR  3 → 280 | 277 mi | 277.10 | +0.10 (0.04%) |
| TN 1E → 451 | 450 mi | 451.23 | +1.23 (0.27%) |
| NC  7 → 420 | 413 mi | 412.85 | −0.15 (0.04%) |

**The check that proves the spec.** I-40 exit numbers *are* mile
markers, so measured distance between two exits must equal the
difference in their numbers. First run against Tennessee:

| Run | Implied | Measured | Error |
|---|---|---|---|
| TN exit 213 → 451 | 238 mi | 237.46 mi | 0.5 mi (0.2%) |
| NC exit 7 → 112 | 105 mi | 104.59 mi | 0.4 mi (0.4%) |

This assertion lives in `corridor.py` and should run on every rebuild.

### Phase 5a — the sliding window

`road.js` indexes stations as a plain array and divides `s` by `STEP`
everywhere, so lazy per-station generation would be invasive. The
cheaper shape: materialise a **20-mile window** of corridor as a real
Road (≈22,500 stations, 1.8 MB) and rebuild it when the player nears an
edge, carrying an `sOffset` so `s` stays continuous. Exits, lane counts
and mile markers all come from the corridor file and are known for the
whole route regardless of which window is live — so the map screen and
"the whole road exists before you start" both survive.

### Phase 4b — signs and destinations

- Real centreline from OpenStreetMap; I-40 has full geometry, exit
  numbers and names.
- Real lane counts per segment.
- Exit numbers follow mile markers, and **mile markers reset at each
  state line** — worth capturing if we do the whole route.
- Destination names on the signs (`draw.js` already draws sign sprites;
  they carry no text yet).

**Superseded 2026-08-05: fetching all of I-40, Barstow to Wilmington.**
The original recommendation was Knoxville first; the corridor is being
taken whole instead. Knoxville remains the segment to *tune* against,
because it is the one with a known-good answer to hand.

Earlier reasoning, kept because the tuning argument still holds: Say Watt
Road through the I-75 split to Papermill. Every exit a place you would
recognise, every structure one of the two topologies. That proves the
feel, and the vocabulary it needs is the same one the rest of the route
needs.

### Phase 5 — the game

Turn traffic back on. Implement scoring per §2. Signals on the C-D
roads. Whatever resource model you pick.

### Phase 5b — the traffic, as counted  ← *data pulled 2026-08-09*

Traffic was deleted in §4 to be rewritten against the finished corridor.
This is the evidence for that rewrite, and it arrived before the code
did on purpose: the confirmed direction is that **time of day, day of
week and where you are will all be fed by real information**, and that
the cars themselves have to behave — indicators included.

Everything is in `data/traffic/`, emitted as `data/traffic.js` (0.28 MB),
keyed by corridor px exactly like `i40.js`. `data/traffic/README.md` is
the rebuild instructions and `data/traffic/BEHAVIOUR.md` is the
behaviour parameter set with a citation against every figure.

**Where you are.** HPMS 2024, each state's own annual return to FHWA,
pulled per state from `geo.dot.gov` as one section per run of road over
which nothing reported changes. **34,824 sections placed on the
corridor, 98.6% coverage.** Carries AADT, single-unit and combination
lorry AADT separately, through lanes, posted limit, K and D factors,
urban/rural and terrain. Run-length encoded it is 4,197 runs for
2,551 miles, because the road really is that uniform between cities.

**Time of day and day of week.** TMAS 2025, a full year of hourly counts
from FHWA's permanent counters. **88 of them stand on I-40**, 41,561
direction-days, each one 24 hourly numbers. Each counter carries a week
as 168 numbers averaging 1.0, a year as 12 averaging 1.0, and the share
of its direction's traffic in each lane. Multiply, never add — the
magnitude lives in `aadt` and the shape lives here, so they cannot drift
apart.

    flow(px, when, dir) = aadt(px) x dirShare x week(dow, hour)/24
                                              x month(month)

**The /24 is not decoration**, and this line was wrong until 2026-08-09.
`week` averages exactly 1.0 over its 168 cells and `month` over its 12,
so their product with AADT is a *day* of traffic, not an hour of it —
the formula as first written was twenty-four times out. It was caught by
`src/traffic.js` reproducing the worked examples below and missing them
by a factor of 24, and `test/traffic.test.js` now asserts the round trip
directly: average the model over every hour of a week and every month of
a year and it must come back to AADT/24.

**The two sources agree.** Sum a counter's two directions, compare with
the HPMS AADT beside it: **median ratio 1.02**, tenth-to-ninetieth
0.93–1.16. Two federal datasets collected by different means, and they
say the same thing about the same road to within two per cent. That is
the check that says the geometric join is right, and it is also what
caught two counters that turned out to be standing on I-540 and NC 24.

Worked examples, regenerated 2026-08-09 by `src/traffic.js` itself so
they are what the game will actually see:

| | AADT | lorries | lanes each way | Fri 17:00 | Sun 03:00 |
|---|---|---|---|---|---|
| Mojave, rural CA | 16,500 | 35% | 2 | 541/h/dir | **189/h/dir** |
| Amarillo | 56,600 | 18% | 3 | 1,844 | 356 |
| I-40 Crosstown, OKC | 114,800 | 13% | 5 | 4,194 | 426 |
| Papermill, Knoxville (exit 383) | 203,200 | 29% | 4 | **7,476** | 1,058 |

(`lanes` in the file is the whole cross-section, both directions — HPMS
codes these sections two-way — so it reads 4 across rural I-40 and the
table above is half of it.)

These differ from the first pass by up to 60% in the small hours,
because they take the hourly shape from the **nearest counter's own
week** rather than from the corridor average. The corridor average is
documented as the fallback for stretches with no counter on them, and
Knoxville has one 33 miles away; using it was leaving measurement on the
table. The Mojave still borrows, from 127 miles east in Arizona.

Knoxville at five on a Friday works out at **1,917 vehicles per hour per
lane**, which is capacity — the road is full, and the game should show
that. The Mojave at three on a Sunday morning is **one vehicle every 29
seconds**. Those are the two ends of what this corridor has to be able
to feel like, and they are 2,000 miles apart on the same road.

**Speed limits change with where you are**, and that is in the profile
straight from the states' own returns — 142 runs of it, 75 across the
desert, 55 through Memphis. Two states also post a *lower limit for
lorries* and HPMS does not record it: **California 55 against 70** for
the whole Mojave crossing, on a stretch that is a third lorries by
count, and Arkansas 70 against 75. That single fact should make the
western end of the game read differently from anywhere else on it.

**What the cars do.** No public dataset has ever filmed I-40, so the
behaviour comes from trajectory sets that stand in for it, chosen to
bracket the corridor rather than to average it: TGSIM I-294 L2 (2024,
drone, median 62 mph — free-flowing, which is 2,300 of the 2,551 miles),
TGSIM I-294 L1 (44 mph, the approach to a city) and NGSIM I-80/US-101
(12–21 mph, Nashville at five). Measured from them: time headway median
**1.50 s** free-flowing against 2.94 s jammed, lorries **5 mph slower**
than cars, **1.2% of lorries in the left lane** with no restriction
requiring it, a **15 mph gradient** from left lane to right, one lane
change per **1.7 miles** per car, and a lane change taking **4.2 s**.

**The blinker cannot be measured** — no trajectory set records lamp
state — so it is cited instead, and the two field studies agree:
**about half of all lane changes are made with no indicator at all**
(Ponziani, SAE 2012-01-0261, 12,000 vehicles: 48%; NHTSA's naturalistic
study: 44% signalled). Of those who do signal, roughly half light it
*after* the car has started moving. So the rule for the game is: half
the traffic changes lanes unsignalled, and half of the rest signals
late. That is a decision, written down, not an accident.

**What people actually drive, and what they are driving** — added
2026-08-09, and these were two of the gaps this section listed as
unreachable. TDOT publishes, per permanent counter, per day, an hour x
speed-bin table and an hour x vehicle-length table. MS2's TCDS is behind
a bot filter rather than a permission, so a browser answers the
challenge once and everything after it is ordinary HTTP; `tcds.py` does
that, `speeds.py` and `trucks.py` derive from it.

**The limit is a floor.** 4.45 million vehicles across five counters:
the median driver is **+3 mph over a posted 70** and the 85th percentile
**+12**, with 63% of daytime traffic over the sign. **Night is slower,
not faster** — median 69.0 at 02:00 against 73.4 at 15:00, and the
fastest hour of the week is the *morning peak*. And two counters 43
miles apart at the same posted 70 have medians of 78.1 and 65.9, so
where you are matters as much as the sign does.

**Rural I-40 at two in the morning is more than half lorries** — 54.9%
articulated, against 18.7% at four in the afternoon and 12.2% on a
Saturday afternoon. A **4.6x swing** in the mix, held as a multiplier on
each section's own daily average so it travels to the Mojave, where it
puts the small hours at roughly three quarters lorries on the stretch
that also posts them 15 mph slower than you. The daily average HPMS
reports, 21.7%, is a number that is true at no hour of the day.

**Known gaps, listed rather than papered over.** California has no
permanent counter on I-40 at all — the nearest is on I-15 at Calico — so
its 155 miles borrow the corridor's average week, and the `states` block
flags `borrowed`. The observed speed and mix above are Tennessee only,
260 miles of 2,551, carrying the rest by assumption; the other seven
states run the same software behind the same filter and are the same job
again. TDOT never crosses the two tables, so there is no *speed by
class* on I-40 — the 5 mph car-lorry difference is still I-294's.

**One defect, found and fixed.** The posted-limit profile disagreed with
the corridor's own OSM survey by 10 mph or more over **67 miles in 36
stretches**. The first theory was ramp contamination and it was wrong:
each of the worst is a single mainline section with four to six through
lanes on it. **Tennessee reported 40 mph for 7.6 miles of the Pigeon
River Gorge**, and 45 through downtown Memphis; New Mexico reported 50
where the survey says 75. HPMS `speed_limit` is an optional field and it
is the dirtiest one in the return.

`reconcile()` in `emit.py` settles it — more than 10 apart, take the
survey; outside 50–75, clamp; not a multiple of five, round to one,
because signs are. Under 10 apart HPMS keeps it, because it is the
state's own return and it has 4,197 runs against the survey's 70. **66
miles moved and the disagreement fell from 67 miles to 1.8**, the
remainder being the two sources putting a transition on opposite sides
of one 0.1-mile bin. The counters arbitrate and they back it: at
Newport the profile said 55, the survey said 65, and the counter
standing on that stretch measures a fifteenth percentile of 65.

Worth recording that the first attempt at the fix was itself wrong, in a
way the corridor work has hit before — it compared HPMS against the
survey **per run** rather than per bin, so any run straddling a
transition was judged against the neighbouring survey value and flipped
whole. It turned the gorge into 70, which is a worse answer than the 40
it was fixing. Comparing bin by bin is the fix and the reason is in the
docstring.

`traffic.js` now also carries the two measured blocks directly, so the
game does not have to load a second file: `observed` (mph over the sign,
per hour) and `mix` (lorry share as a multiplier on the section's own
daily average). It is 0.29 MB.

---

### Phase 5c — why anybody changes lane

*Written 2026-08-09 against Ric's brief. Phase 5b is the evidence; this
is the model, and it is where the measurements stop and the decisions
start. Marked throughout: **measured** means there is a number in
`BEHAVIOUR.md` with a source; **decided** means I chose it and it can be
argued with.*

Ric's brief, restated so it can be checked off: cars do not all drive
the limit; lorries and some cars run slower; some indicate and some do
not; some weave; some see you coming and move over, indicating; two
lorries sit abreast and dam the road; passing is mostly on the left and
sometimes on the right; merging traffic causes its own jam; some move
right miles before their exit and some cross four lanes at the mouth of
it. **And the rule that ties all of it together: nobody does anything
for no reason.**

That last one is the whole architecture. Everything above is a
*consequence*, not a feature to be written. A model with a lane-change
probability produces all the right statistics and still looks wrong,
because the eye reads intent, and randomness has none.

#### The shape: motives compete, the strongest wins

Every vehicle, every tick, scores a small fixed set of motives. Each
returns **a lane it wants to be in** and **how badly**, on one scale.
Highest urgency wins; below a floor, nobody moves. A lane change is
never sampled — it is always something's answer.

| Motive | Wants | Urgency rises with | Produces |
|---|---|---|---|
| **exit** | the lane its exit leaves from | closing on the gore | moving over early, and crossing four lanes late |
| **blocked** | any lane where it can hold its speed | time spent below desired speed | overtaking; the elephant race; weaving |
| **keep right** | one lane right | time spent in a lane it does not need | the 15 mph gradient; lorries out of lane 1 |
| **merge** | the mainline | taper running out | the on-ramp jam |
| **yield** | one lane left | someone merging ahead, or closing fast behind | *moving over for you* |
| **lane drop** | out of a lane that ends | the same as exit, but forced | exit-only lanes doing their job |
| **avoid** | away from a hazard | proximity | wrecks making traffic, which is the game |

Seven motives. Every item in Ric's brief falls out of some pair of them,
and none of them is that item written down directly. That is the test of
whether the architecture is right.

#### Temperament: drawn once per vehicle, never re-rolled

A driver is a handful of numbers, sampled when the vehicle spawns and
kept for its life. This is where the variety comes from, and it is why
the same road produces a tailgater and a plodder at the same time.

| Trait | Drawn from | Status |
|---|---|---|
| desired speed | `observed.json` — p15 −7, p50 +3, p85 +12 on the posted limit | **measured** |
| headway it will hold | free-flow distribution, median 1.50 s, p15 0.71 | **measured** |
| gap it will accept to change lane | tighter than its own headway, by temperament | **decided** |
| patience | how long blocked before **blocked** outranks staying put | **decided** |
| lane discipline | how strongly **keep right** pulls | **decided** |
| politeness | whether **yield** exists for this driver at all | **decided** |
| signal habit | never 48% / late ~26% / properly ~26% | **measured** (cited) |
| exit lead | how far out **exit** starts to bite — miles, or metres | **decided** |

The four **decided** rows are the honest part of this document. They are
not measurable from anything public: no dataset records why a car moved.
They are also, together, the entire personality of the traffic — so they
should be tuned by looking at the road, and the numbers that come out
should be checked against §2's measured rates (0.37 lane changes per
vehicle-km, 4.2 s per manoeuvre). **If the motives are right, those two
numbers should fall out without being aimed at.** That is the validation
and it is worth building the harness for.

#### The specific things Ric named, and which motives make them

**Two lorries abreast, damming the road.** Not written. Lorry desired
speeds have a real spread — measured p15 to p85 is 49 to 63 mph — so
sooner or later one lorry is 1 mph faster than the one ahead. **blocked**
puts it out to pass; a 1 mph difference over two 20 m vehicles takes the
better part of a minute; **keep right** stays quiet while it is still
gaining. The dam assembles itself, and it dissolves itself. If this does
*not* emerge, the model is wrong somewhere.

**Passing on the right, but less.** Also not written. **blocked** should
be indifferent to side; **keep right** is not, and it is what makes the
left lane the fast one. A driver whose lane discipline is low and
patience short will undertake, and that should be uncommon rather than
forbidden — measured, lane 4 of I-294 still runs 58 mph against lane 2's
69, so the right lanes are not empty of quick traffic.

**Somebody sees you and moves over.** **yield**, and it is the motive
that makes the road feel inhabited rather than populated. It should fire
on a car closing from behind at a real speed difference, it should be
gated on politeness so that only some drivers have it, and it should
**signal** — a driver doing you a courtesy is exactly the driver who
indicates. That asymmetry is a decision and it is the right one: the
signal reads as *intent to help*, which is the thing Ric is describing.

**The on-ramp jam.** **merge** with urgency rising to infinity as the
taper runs out, against mainline drivers running **yield**. The jam is
what happens when there are not enough polite drivers and not enough
gaps, which is a function of flow — so it should appear on its own at
Knoxville at five and never in the Mojave at three. `traffic.js` already
knows which is which.

**Early or late for the exit.** One motive, one trait: exit lead. Draw
it wide — some drivers are over two miles out, some are still in lane 1
at the gore — and the same code produces the careful and the appalling.
This is also the motive that most affects the player, because the game
is *about* exits, and a car cutting four lanes in front of you is the
hazard the corridor was built to stage.

**The blinker.** Not a motive but the *output* of one, and the split is
measured: **half of all lane changes are unsignalled**. Of those that
are, half light after the car has started moving. Two consequences worth
stating: the AI should **read** other cars' indicators, so a signalled
change gets yielded to more often than an unsignalled one — which makes
the courtesy loop close — and the player's own indicator should do the
same thing. Nothing else in a driving game rewards using it.

#### What this does not include, and deliberately

- **No route.** A vehicle is given an exit when it spawns and that is
  its whole plan. It does not know where it is going after that.
- **No memory between motives.** Nobody bears a grudge, nobody is
  "getting back at" the car that cut them up. That is a different game.
- **No perfect information.** A driver should act on what it can see —
  the vehicle ahead, the two lanes beside it, indicators. Not on the
  simulation's state.

#### Settled

**The player is not special. The driver is.** *(Ric, 2026-08-09:
"traffic treats everyone roughly the same although its dependent on the
driver".)* So `yield` takes no argument saying whether the thing behind
it is the player — it sees a vehicle closing at a speed difference and
that is all it sees. The variation the player experiences comes from
*whose mirror they are in*: politeness is a temperament trait drawn per
vehicle, so one driver waves you through and the next has no such motive
at all and never will. That is a better source of variety than a player
flag would have been, because it is consistent — the same car behaves
the same way twice, and you can learn to read it.

It also means the courtesy is earned rather than granted. Sit on
somebody's bumper and the polite ones move; the rest do not, and no
amount of being the player changes it.

**Mistakes are rare, and they are not a routine.** *(Ric, 2026-08-09.
For the avoidance of doubt this is the AI, not the player — the player's
mistakes are `impact.js`'s job and always have been.)*

The AI is allowed to be *bad at driving*, not merely varied at it, at
about one visible error every few minutes. But there is no `mistake()`
anywhere: an error is a temperament at the tail of its distribution
meeting a situation it does not fit — a gap acceptance drawn too tight
for the closing speed actually faced, a `merge` whose gap never came and
who is now out of taper. That is what a real mistake is, and it needs no
code of its own beyond letting the distributions have tails.

The consequence to hold on to: **a mistake must be survivable and
readable.** If the player cannot see it developing, it is not a mistake,
it is a random punishment.

**Lorries do drive the Californian 55.** *(Ric, 2026-08-09.)* So the
desired-speed draw is keyed on the limit that applies to *that vehicle*
— `truck_rural` / `truck_urban` in the `states` block, which only
California and Arkansas carry — rather than on the posted limit for the
section. Everywhere else the two are the same number and nothing
changes.

This is the one place the model follows the sign rather than the data,
and it is worth it: 155 miles of a slow, dense right lane with cars
streaming past it at 70, on a stretch that is a third lorries by count
and roughly three quarters of them in the small hours (§5b). No other
part of the game has that, and at night, in the desert, it should be the
most distinctive thing on the corridor.

It also creates the corridor's best natural hazard for free. A 15 mph
differential means the `blocked` motive fires constantly among the cars
and never among the lorries — so the right lane is a near-stationary
wall and everything else is doing 70 past it, which is exactly the
situation that makes an off-ramp on the right frightening. **That is the
Mojave's signature and it comes out of two measured facts and one sign.**

#### Nothing is open

Every question in this section has been answered.

#### What is built, 2026-08-09

**`src/traffic.js` — the population half.** How many vehicles, of what
kind, wanting to go how fast, driven by whom. Pure: corridor px and a
clock in, numbers out, no DOM and no game state, so that
`test/traffic.test.js` can check it against the counters rather than
against how it feels. **58 assertions, green.** It answers four
questions — `demand(px, when, dir)`, `mix(px, when)`, `limitFor(kind,
px, st)`, `driver(kind, px, when, st, rng)` — and it carries Ric's two
decisions: lorries take the Californian 55, and the tails of the
distributions are left long so a mistake can be a temperament meeting a
situation.

Writing the tests found two silent bugs, which is what they were for:

- **The documented flow formula was 24x out.** `week` averages 1.0 over
  168 cells and `month` over 12, so the product is a day of traffic and
  not an hour. Fixed in §5b above, in `emit.py`'s header, and asserted
  directly — average the model over a whole week and a whole year and it
  must return AADT/24.
- **26 of the 88 counters report one direction only**, and a direction's
  share of itself is 1, so those stretches were giving one carriageway
  the entire two-way AADT. Knoxville came out at exactly twice its
  documented figure, which is the only reason anyone noticed. Where the
  split cannot be measured it is a half; where it is measured as
  non-physical — one counter, 30 days of data, claiming two thirds of
  the traffic goes one way — it is also a half.

A third thing was learned rather than fixed: the **peak hour has a
direction and must keep it**. Amarillo runs 57% eastbound at eight in
the morning and 39% at five in the evening, the same people going home,
and an early version of the test wrongly called that a bug. The test now
asserts the asymmetry instead of tolerating it.

**Motorcycles, and the tail the counters cannot see.** *(Ric, 2026-08-09:
"night sometimes has cars going super fast too. including
motorcycles.")* Both halves checked against the data, and they land
differently.

Motorcycles were folded into `car` and are now a fourth class, because
the length table has a 0-8 ft bin and it says something: **1.17% of
traffic in the small hours against 0.78% mid-afternoon**. A bigger share
of a much emptier road — absolutely there are four times fewer of them
at three in the morning, which on the Mojave is under two an hour. You
see one, and it is an event. It is also the only figure in the pull with
no second source, since HPMS does not count motorcycles at all.

The fast ones are half measurable. The counters say **5.0% of night
traffic is over 85 mph** against 10.0% mid-afternoon — proportionally
*fewer* fast vehicles at night, which is the opposite of the folklore —
and then they stop, because the top bin is `85+` and open. A motorcycle
doing 130 and a saloon doing 86 are the same row. So the model measures
the curve to p95 and **decides** above it: an exponential tail, per
class, about 1 car in 1,000 over 100 mph and motorcycles three times
fatter. Marked DECIDED in the source, because a night with no outliers
in it is wrong in a way that shows, and this is the least evidenced
number in the file.

Lorries go the other way and are **governed** — fleet tractors run an
ECU limiter at 65–70, so their tail is cut off rather than fat. Three
quarters carry one; the quarter that do not are what you see at the top
of the artic distribution.

**The motive half is written** — see *What is built, 2026-08-10, part
two* below, and the section after it on the three roles the lanes have.
Four of the seven; the three junction motives wait on a harness with ramp
TRAFFIC in it (it now knows where the junctions are, which was enough for
`yield`'s merge half). Nothing is wired into `index.html` yet: the
model is judged headless, on the principle that traffic behaviour is
never debugged through the game viewport.

#### What is built, 2026-08-09, part two: the thing that will judge it

**`src/sim.js` — a motorway with nobody watching it.** N vehicles,
seeded, simulated hours, no canvas and no frame rate. Built BEFORE the
motive layer and for the same reason `impact.js` had its test file
before it was wired into the game: the difference between tuning by feel
and knowing.

It owns everything that is not a motive — the following model, the
manoeuvre, gap acceptance, arrivals, the counting — and none of the
deciding. `decide(veh, view, ctx)` returns the lane a vehicle wants and
how badly, or null, and the seven motives go behind that one call with
nothing else in the file changing. `view` is also the enforcement point
for *no perfect information*: a decider gets its own leader, the two
lanes beside it, and the corridor under it. It never gets the world.

It ships with three deciders and **not one of them is the model**:
`stay`, nobody ever moves; `random(0.37)`, the straw man this section
names by hand; and `mobil`, the standard lane-change model of the
literature, which is here so the scoreboard has a real opponent rather
than two straw men. The interesting question is not whether the motives
beat doing nothing. It is which of the measured numbers MOBIL already
gets — those the motives must not lose — and which arithmetic about
acceleration cannot reach.

**The scoreboard, at 1,585 veh/h/lane on four lanes of posted 70.**
None of these four is an input to any decider.

| | measured | stay | random | mobil |
|---|---|---|---|---|
| lane changes per vehicle-km | 0.37 | 0.00 | 0.12 | **0.49** |
| manoeuvre, median s | 4.24 | — | 4.19 | 4.08 |
| % of lorry-seconds in lane 1 | **1.2** | 20.5 | 23.1 | **8.5** |
| mph, lane 1 minus lane 4 | **15.0** | 0.1 | 0.1 | **5.7** |
| median car, mph | 62 | 57.3 | 57.8 | 60.5 |
| median lorry, mph | 57 | 57.1 | 57.5 | 57.5 |

Read the two bold rows. **The lane gradient and the lorry share are the
two the field's default model cannot reach** — MOBIL gets a third of the
gradient and seven times too many lorries in the left lane, and it does
it while changing lane 31% too often. That is the size of the job, and
it is now a number rather than an opinion.

The straw man is worth its own sentence. `random(0.37)` is aimed
straight at the measured rate and **achieves 0.12**, because two thirds
of what it proposes is thrown out by gap acceptance. A lane change is
not free, and a model that samples one has not noticed.

**Four faults it found, three of them in itself.** Every one produced a
plausible-looking motorway and none threw anything.

- Two vehicles released into one lane in the same tenth of a second, on
  top of each other, because the boundary checked both against an index
  built before either moved. The overlap was 21.5 m, which is the length
  of an articulated lorry, which is what named it.
- Two vehicles on opposite sides of the same gap both taking it in the
  same tick, one lane in, for the same reason.
- A boundary reading its entry speed off whichever vehicle was nearest
  however far away, so one slow lorry pulled everything behind it onto
  the road at 49 mph and the lane never recovered. The whole carriageway
  ran 13 mph under desired speed with 55 m of clear road in front of
  every driver. This is the one to remember: nothing was wrong that
  could be seen by looking.
- And the fourth is not in the harness. **`driver.headway` is not a
  desired following time.** It is drawn off BEHAVIOUR.md's 114,781
  measured pairs, and that distribution is *what the gaps on a motorway
  are* — a pair 5.83 s apart is not a driver who wants 5.83 s, it is a
  driver with nothing in front of it. Fed in as a desired gap it prices
  every vehicle as constrained: lane capacity came out at 1,300 veh/h
  against a real 1,900 and Knoxville at two in the afternoon settled at
  45 mph on a road the counters call free-flowing. `T_SCALE` in sim.js
  is the correction — one number, scaling the whole distribution so its
  shape survives — and the observed distribution then has to come back
  out of the run as the check. It does: p5 0.51 against 0.49, p15 0.74
  against 0.71, p50 1.62 against 1.50.

**Two anchors, both independent of BEHAVIOUR.md's four.** Lane capacity
against the Highway Capacity Manual — 1,885 veh/h/lane against a base
2,202 at this lorry share, 86%, and the shortfall is expected: HCM's
base conditions assume a driver population far more uniform than one
whose fifth percentile wants 59 mph in a posted 70. And the corridor
itself: every vehicle reads the posted limit at the pixel it is standing
on, which was *found* rather than written — the first speed profiles had
a clean step at 3,400 m that was chased as a harness artifact for an
hour and is Knoxville dropping from 70 to 60.

**One finding handed back to `traffic.js`.** In the Mojave the lorries
want a median of 53 mph and realise 45. That is the elephant race, which
§5c asked for, and there is probably too much of it: `desiredSpeed`
extrapolates linearly below its p15, so a lorry wanting 42 mph in a
posted 55 sits at the *fifteenth* percentile rather than out at the
edge, and on a two-lane carriageway one of those dams everything behind
it. Whether that tail is too fat is a question about the population
model and not about the sim, and it is the sort of question the harness
exists to raise.

**Not built yet, deliberately.** The stretch is straight, flat and has
no ramps on it, because every number in BEHAVIOUR.md §2 was measured on
mainline and adding geometry first would only hide which of the two was
wrong. `merge`, `lane drop` and `exit` need a corridor with junctions in
it and they are the second run of this harness. The lane count is also
held fixed for the length of a run, which is the same limitation wearing
a different hat.

#### What is built, 2026-08-10: cars that can hit each other

Ric's ask: *"the cars can wreck with each other too — the cars all need
to be aware of each other."* Both halves, and the second one is the one
that makes the first possible.

**Nobody could crash, and it was not because they were careful.** Every
driver knew exactly and instantly where the vehicle in front was and how
fast it was going. Give a car-following model perfect information with
no delay and it is *provably* collision-free — no motive layer would ever
have produced a crash, because motives are not where crashes come from.
So the work was in the perception, not the solver.

**What a driver now actually knows.** Four mechanisms, none of which is
a `mistake()` and none of which knows it is one:

- a **tracking delay**, per driver, drawn lognormal about 0.6 s. The
  delayed state is *extrapolated* forward at the speed last seen, so the
  delay costs nothing in steady state and bites only when the vehicle in
  front changes what it is doing — which is exactly when a crash happens.
- **brake lights**, the one thing a vehicle broadcasts. A driver watching
  lit lamps responds in two thirds the time.
- **anticipation past the car in front**, out to 300 m of sight.
- **glances away**, at a rate set by an attention trait, during which the
  picture simply stops updating.

Then contact is detected on the axis of least penetration — deeper
across than along is a rear-end, deeper along than across is a sideswipe,
and nothing has to be told which — and handed to `impact.js`, whose own
header says the four barrier cases were unified so that *"traffic needs
a fifth: car into car."* This is the fifth. A wreck is not deleted and
is not a scoring event: it is a stationary object in a live lane that
slides to a stop wherever the friction ran out, blocks every lane its
width overlaps, and clears in twenty minutes. §5c's `avoid` motive now
has something to avoid.

**The constant that was two constants, and cost five orders of
magnitude.** The first version used the textbook perception-reaction
time — 1.1 s median, AASHTO's 2.5 s at the 95th percentile — and built a
road that crashed **100,000 times** more often than a real one, every
crash the same low-speed shunt into the back of a queue. That figure is
not wrong, it is *the wrong quantity*: AASHTO's 2.5 s is the response to
an **unexpected object**, something the driver was not already watching.
Ordinary car-following is a driver tracking the one thing they have been
looking at for ten minutes, and the delayed-following literature puts
that at 0.4–0.8 s. Separating them fixed it — and the AASHTO number is
not discarded, it is *reassembled*: a driver 1.5 s into a glance with a
0.9 s tracking delay is 2.4 s behind the road. Same number, arrived at
rather than posted, and now true only of the drivers it is true of.

**Three more faults, all of the same family.** Each produced a
plausible-looking motorway and none threw anything.

- **`ANTICIPATE` was a vehicle count, not a distance.** Three vehicles is
  120 m of free-flowing motorway and **15 m of a stopped queue** — so the
  one situation where seeing a long way is the whole difference between
  braking early and dying was precisely where the driver was blinded.
  Park a wreck across a lane and the road did not queue behind it, it
  disintegrated: 82 wrecks in twenty minutes.
- **A vehicle beside you was a leader at zero gap.** A car halfway into
  your lane and level with you returned the full 9 m/s² and everything
  behind piled into the back of a car that was never going to hit
  anything — a shockwave manufactured out of a bookkeeping choice, worth
  1,866 → 268 veh/h/lane. What is beside you is a *conflict*, not a
  leader. But the fix has to distinguish beside from *inside*: skipping
  both meant a car that ran into a wreck stopped being able to see the
  wreck, came off the brakes and ground into it again every tenth of a
  second — **564,691 collisions in half an hour**.
- **Being in a crash and being stopped by one are different questions.**
  `impact.js` says how badly hurt somebody is; it does not say whether
  the vehicle still drives. Treating a 15 km/h bumper tap as a
  twenty-minute lane closure turned one staged wreck into sixty-five,
  each seeding its own queue and its own shunts. There is now a second
  threshold, about the vehicle rather than the person.

**What it gets right.** At the reference flow the road is quiet, which
is the correct answer and a boring one: a US freeway does **0.62
police-reported crashes per million vehicle-km**, the reference run
covers 12,000, so the honest expectation is **0.007 crashes** and zero is
right. A run that produced one would already be a hundred times too
dangerous. So crash *count* is not measurable in any run anybody will
wait for, and the tests do not pretend it is — they check the surrogates
the safety literature uses for exactly this reason (hard braking at
0.3 g, time-to-collision under 1.5 s), the machinery under deliberately
raised inattention, and the one behaviour the game is made of: a staged
wreck and the queue behind it.

**What it gets wrong, with the number.** *Stop-and-go behind a blockage
shunts far too readily* — four orders of magnitude too readily, and not
all of that is the denominator. The events are the right kind in the
right place (12–18 km/h taps at 3–8 m/s of closing speed; a real queue
does produce these) at nothing like the right rate. Two things are
missing and both are already on §5c's list: **nobody in this model
runs `yield`**, and **nobody leaves extra room because the traffic ahead looks
bad**. Free-flowing road: right. Queue: the shape is right and the rate
is not. `test/sim.test.js` §7 prints the gap rather than hiding it.

**The blind spot is built and defaults to OFF.** There is a region
alongside and just behind a car that no mirror covers, and it is the
best-documented cause of lane-change collisions — the vehicle is not
misjudged, it is *not seen*. It is implemented, with the abort that goes
with it (a driver who pulls out onto somebody usually gets a horn and
pulls back; conflicts are common, crashes are rare, and the abort is the
entire difference). It is off because it is **bistable**: at any value
producing crashes at all, the reference road ran clean on two seeds in
three and gridlocked on the third. Same missing motive — **`yield`**. In
dense traffic a lane change is not gap acceptance, it is a negotiation:
you put your nose in and the other driver lets you. Model the squeeze
without the yield and every merge is forced and nobody gives way, which
is a demolition derby with indicators. Pass `miss` to turn it on; turn
it on for real the day `yield` lands.

**Capacity is now measured with `miss: 0`, and that is not a dodge.**
HCM's 2,400 is defined under *base conditions*, which means incident-free
by construction. A capacity taken on a road that is also crashing is a
measurement of something else.

#### What is built, 2026-08-10, part two: the motive half

**`src/motive.js`** — the thing the harness was built to judge. Every
vehicle, every tick, scores a fixed set of motives; each returns a lane
and how badly it wants it, on one scale; highest wins, and below a floor
nobody moves. **A lane change is never sampled.** `test/motive.test.js`
is 40 assertions on the motives in isolation; the scoreboard is the
verdict.

**Four of the seven, and the other three are not oversights.** `exit`,
`merge` and `lane drop` are junction motives, and the harness is six
kilometres of straight mainline with no ramps on it — deliberately, since
every number in BEHAVIOUR.md §2 was measured on mainline. A motive nobody
can check is a guess with a docstring, so they are stubbed with the
signature they will have. Built: `blocked`, `keep right`, `yield`,
`avoid` — exactly the four the mainline scoreboard measures.

**The scoreboard, at 1,585 veh/h/lane on four lanes of posted 70.**

| | measured | stay | random | mobil | **motive** |
|---|---|---|---|---|---|
| lane changes per vehicle-km | 0.37 | 0.00 | 0.10 | 0.56 | **0.28** |
| manoeuvre, median s | 4.24 | — | 4.32 | 4.11 | **4.16** |
| % of lorry-seconds in lane 1 | **1.2** | 23.1 | 21.4 | 4.9 | **1.1** |
| mph, lane 1 minus lane 4 | **15.0** | 0.9 | 0.3 | 6.2 | **9.1** |
| median car, mph | 62 | 57.1 | 57.1 | 59.8 | 56.7 |

**Read those two bold rows across eight seeds, not one.** Lorry-seconds
in lane 1 is a small-sample statistic — artics are about 6% of the
traffic — so a single run is not evidence and it is very easy to write
an assertion that passes because of the seed:

| over 8 seeds | measured | mobil | **motive** |
|---|---|---|---|
| % of lorry-seconds in lane 1 | 1.2 | median 6.6, range 4.7–11.0 | median **1.7**, range **0.5–3.9** |
| mph gradient, lane 1 to 4 | 15.0 | median 5.6, range 5.1–6.5 | median **9.0**, range **8.2–9.1** |

**The ranges do not overlap on either.** That is the claim worth making,
and the suite now asserts the separation rather than the seed.

**The lorry share is the headline.** A median of 1.7% against a measured
1.2%, where the standard model of the literature sits at 6.6% and its
best run of eight is still worse than the motives' worst — and **no code
anywhere in `motive.js` mentions lorries.** It falls out of
`discipline`, which `traffic.js` draws high and tight for heavy
vehicles, meeting one idea used twice. The gradient is 1.6× MOBIL's and
still 40% short. The rate is now *below* the measured figure rather than
51% above it.

**One idea, used twice, is what did it.** *The further left a lane is,
the better your reason has to be for being in it.* `keep right` reads
that as how eagerly you come back; `blocked` reads it as how far out you
are prepared to go in the first place. Same constant, same trait, cubed
in the lane depth so that **lane 1 is qualitatively different and the
middle lanes are nearly interchangeable**. Before `blocked` knew about
depth, a lorry held up in lane 2 would move into lane 1 to pass — 193
lorry overtakes an hour in the outside lane, and 5.6% of lorry-seconds
there.

**Five faults, and four of them were two functions disagreeing.**

- **`free()` asked only about closing rate.** Right on open road,
  catastrophically wrong in a queue: nobody in a jam is closing on
  anybody, so every driver in one believed they were unobstructed.
  `blocked` fired 82 times against `keep right`'s 1,783, the whole
  carriageway migrated right and never came back — 3% of cars in lane 1
  against a measured 32%, and 647 veh/h/lane.
- **`prospect()` ignored distance while `free()` did not.** A lane whose
  only vehicle was 300 m up doing 54 was reported as *offering* 54 while
  `free` called it clear. Every lane comparison saw gains of nearly
  nothing: the rate fell to 0.216 and cars wanting a median of **73 mph
  sat at 56 on a road with the room to give it to them.**
- **`keep right` and `blocked` had independent thresholds**, so one moved
  drivers into lanes the other immediately wanted them out of. A limit
  cycle that looks like a plausible motorway from inside: 0.851 changes
  per vehicle-km and 470 veh/h/lane.
- **Linear lane depth let a disciplined driver dive back in front of the
  lorry they were overtaking** — §5c's "not while I am overtaking this
  lorry", which is the exact case it says a priority list cannot express.
  Cost the road about 5 mph.
- **`yield` fired zero times in 4,141 manoeuvres**, and the reason is a
  real fact about car-following rather than a bug: *nobody can be twenty
  metres behind you and still gaining*, because IDM already made them
  stop. A driver who wants past does not arrive closing — they arrive,
  and then they sit there. The cue a mirror gives you is a distance, not
  a velocity.

**What it does not get.** The gradient, at 9.0 against 15, and with it
lane 1's share — 16.6% against a measured **31.7%**, which is the
busiest lane on the real road. Both are the same shortfall: not enough
traffic is using the outside lane. There is headroom for it (cars want a
median of 73 mph and realise 57), so this is the motives being too
reluctant rather than the road being full. Printed in the suite as a
`todo` with the number beside it.

#### The lanes have three roles, not two — and the harness now sees junctions

*(Ric, 2026-08-10: "people stay in the right lane to cruise. people stay
in the middle lane to stay out of the way of mergers and the left lane is
for passing. most of the time.")*

Three roles, and the model had two. `keep right` pulled everybody as far
right as they could bear and `blocked` pulled them back out; **nothing
anywhere said the rightmost lane has traffic joining it**, which is the
reason a real driver does not treat it as home.

**The harness now knows where the interchanges are.** Not ramp geometry —
nothing merges, nothing leaves, the lane count still does not change —
just one sorted list of corridor pixels and a binary search, passed in as
`junctions`. It matters more than expected: the reference stretch is not
the empty motorway the harness had been treating it as. I-40 at mile 1897
has junctions at +1.1, +3.2, +4.2, +5.5 and +6.3 km — five inside a
six-kilometre run — and corridor-wide the median spacing is 1,420 m.

That is enough for the half of §5c's `yield` that is about merging
traffic, which had been stubbed as un-checkable. The two halves pull
opposite ways and both are right: **closing behind → move right and let
them past; merging ahead → move left, out of the lane they are joining.**
That is why §5c's table says "one lane left" against a trigger that reads
like "move right" — they are different triggers.

**Who shelters is in the data, and it is not everybody.** Read
BEHAVIOUR.md's two rows against each other:

| | lane 3 | lane 4 (right) |
|---|---|---|
| cars | 19.2% | **24.8%** |
| lorries | **48.1%** | 24.7% |

**Cars slightly prefer the rightmost lane. Lorries avoid it two to one.**
Lane 3 is quiet for cars precisely because it is full of lorries. So this
is not a majority behaviour with hold-outs — it is what the heavy traffic
does and the cars do not. Two wrong gates were tried first and each
failed in a way that named the next one:

- **`polite`** (0.55) — wrong rate *and* wrong meaning. Moving out of the
  merge lane is not a courtesy, it is self-interest: you are not letting
  anybody in, you are declining to spend the next ten miles being merged
  into. The gate was the binding constraint at 45% of lorries in the
  rightmost lane against a measured 24.7%.
- **`push`** (77% of everyone) — packed the middle lanes so hard that
  lorries which *spawned* in lane 1 could not get out. 6.1% of
  lorry-seconds there, with exactly **one** lorry manoeuvre INTO lane 1
  in the whole run. Nothing was driving there; they were stuck there.
- **`length`** — right, and physical rather than about the driver.
  Merging traffic takes the gap in front of you, and what that costs
  depends on how long you are and how badly you accelerate. A 21 m artic
  that has lost its gap spends the next mile getting it back; a car
  shrugs. `traffic.js` already draws length off a measured distribution,
  so **no code names a vehicle class.**

**Result, over six seeds:**

| lorry-seconds, over 6 seeds | measured | before | **after** |
|---|---|---|---|
| lane 3 (the shelter) | 48.1% | 38.8% | **52.4%** |
| lane 4 (rightmost) | 24.7% | 39.8% | **23.3%** |

**And the honest cost.** Lorries in lane 1 went from a median 1.7% to
2.8% and the gradient from 9.0 to 7.6 — both still cleanly better than
MOBIL (6.6% and 5.6), with disjoint ranges, but both worse than before.
That is a real trade and it is worth taking: the lane *roles* are now
right, which is a claim about what the road looks like, and it is
corroborated by a measured distribution the model was not aimed at.

It also gives the gradient shortfall a physical explanation rather than
leaving it a mystery. Measured, lane 4 is the SLOWEST lane (54 mph)
despite having fewer lorries than lane 3 — because it carries the
slowest cruising cars *and* the merging and exiting turbulence. This
harness has junction positions but no junction traffic, so the rightmost
lane never gets churned. **Part of the missing 15 mph may not be
reachable on a mainline-only harness at all**, and that is an argument
for the junction three rather than for more tuning here.

#### `exit`, and vehicles that actually leave

*(Ric, 2026-08-10: "ramps define some of the decisions by cars. people
will move lanes more around exits because they are trying to get off on
or give people room.")*

**The claim was tested against the raw drone data first, and the data
could not settle it.** The trajectories are still on disk, so: in the
busy set, an auxiliary lane 6 locates a junction at 593–1442 m, and the
lane-change rate near it is 0.225 per vehicle-km against 0.241 away from
it — **0.93x, no elevation**. That is not evidence against Ric. It is
284 events over 4.8 km, the auxiliary lane spans a fifth of the frame,
and the free-flow set has only 61 lane changes in total. There are
unexplained peaks at 4.0–4.1 km and 4.6 km that are probably another
junction the data does not label. So `exitLead` stays **DECIDED**, which
is what §5c always had it as.

**But it reframes a number this file reported as a failure.** The motives
ran 0.27 lane changes per vehicle-km against a measured 0.37, and that
was written up as the motives being too reluctant. The drone that
measured 0.37 was flown over road with ramps in frame — BEHAVIOUR.md
says so directly, "the ramp merges are in frame" — and the model had no
`exit` motive at all. A whole class of reason to change lane was missing.
With `exit` on: **0.266 without ramps, 0.463 with.**

**Vehicles now really leave.** Each is given an exit when it spawns
(§5c: "that is its whole plan"), geometric at `EXIT_SHARE` per junction,
so about a third of the traffic goes in six kilometres. `EXIT_SHARE` is
DECIDED at a tenth, and the corridor's own counts were tried first: the
demand steps across 204 junctions run −21% at p10 and +14% at p90, but
that is the NET exchange and half the steps read zero because AADT is
binned per mile. Gross exiting is strictly larger and this data cannot
see it.

**Three faults, and the third was mine coupling two things.**

- **`CROSS` is not the manoeuvre duration.** At 4 s a lane — the measured
  median — 47% of drivers missed their exit. The budget is not how long
  the crossing takes, it is how long it takes to *get across*: find a
  gap, be refused, find another. Six seconds a lane.
- **The last hop is the one that fails.** 428 of 751 missed exits were
  vehicles that had reached lane 3 and could not make the final move into
  the exit lane, which is the busiest lane on the road. Their ordinary
  gap standard said no. So `room` now takes a `nerve` multiplier, which
  is §5c's own account of where a mistake comes from — "a gap acceptance
  drawn too tight for the closing speed actually faced".
- **`nerve` must not be read off `urgency`.** Doing that handed MOBIL a
  courage bonus: its urgency is an acceleration gain in m/s², routinely
  above 1, and the motive layer's scale means something else entirely.
  It moved two numbers in a decider I had not touched. A decider that
  wants extra nerve has to ask for it.

Result: **86% of drivers who tried actually got off**, and the ones who
fail are a persistent few — 126 vehicles sailing past four gores each —
rather than bad luck spread thin. §5c wanted the driver still in lane 1
at the gore and gets one; it did not want half of them.

**And the honest cost, which is why the scoreboard runs keep exits off.**
There are no ON-ramps, so nothing replaces the leavers and the road
thins: 1,585 veh/h/lane at the boundary arrives at the far end as about
1,060. Compensating cannot work — delivering 1,585 four kilometres in
needs about 2,300 going in, which is above the road's own capacity, so
it queues at the entrance instead. Every density-dependent statistic on
a thinning road is taken at an unstated flow, and BEHAVIOUR.md is
explicit that the lane-change rate is *higher* in free flow than in
congestion. So the four scoreboard numbers stay on a road nobody leaves,
and `exit` gets its own section (§8) where what is measured is what the
motive does. **The on-ramp side is now the single biggest missing piece**
— it is what would let exits run in the reference measurement, and it is
the same thing `merge`, the on-ramp jam, and the switched-off blind spot
are all waiting for.

### Phase 5d — the merges that are not in the data

Before writing the on-ramp side I went to measure the one thing it
needed, because BEHAVIOUR.md says it is there:

> **Gap acceptance when merging.** Derivable from the TGSIM data already
> downloaded — the ramp merges are in frame — but not derived yet.

**It is not there, and that line is now wrong.** In the busy flight
(`i294_l1`, 1.02 million frames, 1,165 vehicles tracked) the auxiliary
lane is lane 6, and lane 6 holds **493 frames — four vehicles, in the
whole set**. All four complete their merge in frame; none is still on
the ramp when its track ends. In the free-flowing flight (`i294_l2`,
712 vehicles) **no vehicle is ever in it at all**.

Four merges cannot carry a critical-gap distribution, and no amount of
care with them will make one. What they do say, weakly and worth
keeping: the auxiliary lane runs from **593 to 1,442 m** and the median
merge point is **1,007** — about half way along the road available. That
is the only corroboration the model below has, and it is one number from
four events.

So merging gap acceptance is **DECIDED**, and it joins the four rows in
§5c's temperament table that are honest about being decisions rather
than measurements. BEHAVIOUR.md's "known gaps" entry should be rewritten
to say the data cannot answer it rather than that nobody has asked yet.

The good news is that it needed less deciding than expected: `room` in
`sim.js` already does two-sided gap acceptance with the delayed picture,
the blind spot and the follower's braking in it, and a merge is that
manoeuvre entered from the side rather than a new piece of physics.

### Phase 5e — the on-ramps, and the wall they ran into

Built, measured, and **it does the job it was built for**. It is also
not the default, and the rest of this section is why.

**What it is.** A vehicle is born at a junction instead of at the
boundary, in the rightmost lane because that is the only lane an on-ramp
joins. It gets `MERGE_LEN` — 250 m, AASHTO's thousand feet — of
acceleration lane to travel while it looks for a gap, and it is not in
`byLane` while it does, because it is on its own pavement and obstructs
nobody. Nerve rises with the fraction of that lane used up, which makes
§5c's line about `merge` literal rather than figurative — *urgency
rising as the taper runs out*. Reach the end without a gap and you stop,
and the queue behind you is the on-ramp jam.

**The headline, at 1,200 veh/h/lane with exits on:**

| | exits, no ramps | exits and ramps |
|---|---|---|
| flow at the detector | 803 veh/h/lane | **961** |
| everything in vs everything out | — | **0.947** |
| merged | 0 | 487 |
| vehicles driven through | 0 | 0 |

The road stops thinning, which is the whole point, and conservation is
not rigged: the ramps put in a tenth of what arrives at the boundary
while the exits take a tenth of whatever is actually passing, so the two
were free to disagree and did not.

**Two things went wrong on the way and both are recorded in the code.**
Merging at a POINT jammed the road at 6% per junction — 2% conserved
1.000, 4% fell to 0.901, 6% collapsed to 777 veh/h/lane. That is what
sent the acceleration lane in. Then merging without matching speed was
*worse* than the point version — 2% took the road from 1,156 veh/h/lane
to 596 — because a vehicle entering a 31 m/s lane at 22 finds a gap
nobody has to brake for *at that instant* and is then caught by the
lane. That is a speed-matching failure, not a gap-acceptance one, and an
acceleration lane exists to fix precisely it.

**And the wall.** A single on-ramp here delivers **304 veh/h against a
real 1,200–1,500**, so the ramps queue even at 1,200 veh/h/lane and the
merge point pins to the end of the lane. The cause is not in the ramps.
It is the lane they are joining:

| share of traffic in each lane | 1 (L) | 2 | 3 | 4 (R) |
|---|---|---|---|---|
| the model, at 1,585 veh/h/lane | 13% | 23% | 30% | **34%** |
| measured, BEHAVIOUR.md | 31.7% | 24.3% | 19.2% | **24.8%** |

`keepRight` puts a third of the traffic in the rightmost lane where the
drone saw a quarter, and starves the left lane at 13% where the drone
saw 31.7%. At the reference flow that is roughly **2,150 veh/h in lane
4 — at or over the capacity of a single lane** — before a single ramp
vehicle arrives. There is no gap to take because there is no room, and
the two `todo` lines in `sim.test.js` §9 are that number printed rather
than hidden.

`motive.test.js` has printed this mismatch since the motives went in and
it was read as a lane-*role* result — lorries in the right place, which
they are. The on-ramp side is what turns it into a blocking defect,
because it is the first thing that needs the rightmost lane to have
room in it.

**So the order changed.** The next piece is not `merge`'s remaining
half, the on-ramp jam's tuning, `lane drop`, or the blind spot. It is
`keepRight`, tuned against the lane shares BEHAVIOUR.md already
measured — and the rule from §5b applies exactly: *the lane gradient and
the 1.2% lorry share are the numbers no model can fake, so never tune
traffic by feel.* The target is on the table above.

---

### Phase 5f — `keepRight`, and why nothing was changed

§5e named `keepRight` as the blocker and this went to fix it. **No model
change survived, and that is the result.** What came out instead is that
the harness cannot currently tell a good change from a bad one on these
numbers, which has to be fixed first.

**First, a correction to §5e.** The table there put 34% of traffic in
the rightmost lane against a measured 24.8%, and called that the defect.
That number was contaminated by the `exit` motive. Turn the exits off
and the honest equilibrium is:

| cars, exits off, 24–30 km | 1 (L) | 2 | 3 | 4 (R) | gradient |
|---|---|---|---|---|---|
| model | 17.9% | 24.3% | 26.3% | 31.6% | 8.1 |
| measured | 31.7% | 24.3% | 19.2% | 24.8% | 15.0 |

Still wrong in the same direction — lane 1 under-filled, 3 and 4
over-filled — but lane 2 is exact and the gap is half what §5e claimed.
With exits ON over 30 km the rightmost lane reaches **60.7%**, because a
junction every 1.4 km means most traffic is always approaching a gore.
That is `exit` doing its job on a corridor the drone frame is nothing
like, not `keepRight` misbehaving.

**Second, the harness measures a transient.** `born()` picks its lane
UNIFORMLY at the boundary, and the standard zone is 2–6 km, so the
distribution the suite prints is the boundary still washing through.
Followed out with the exits off, cars run 16.6 → 17.9% in lane 1 between
6 km and 30 km and are still moving. BEHAVIOUR.md's figures come off a
5 km drone frame of vehicles that have been sorting for tens of miles,
so the two are not the same measurement, and **the 6 km zone is the
wrong place to compare them.**

**Three levers were tried, all measured, none kept.**

- **The habit curve** (`KR_MID`, `KR_STEEP`), swept nine ways. Car rms
  against the measured shares moves 11.3 → 8.8 at best, and every
  setting that helps cars hurts lorries. Driving the median car's
  discipline to essentially zero still leaves it at 17.7/23.1/26.6/32.6,
  so this is **not the lever** — which is worth knowing, because it is
  the obvious one.
- **Discipline as a gate rather than a dial** — a driver below a
  threshold has no keep-right motive at all, the way `polite` gates
  `yield`. Best car rms of anything tried, 8.5 → 5.7. Rejected: it takes
  the gradient from 8.1 to **4.0** and the lane-change rate from 0.29 to
  **0.20** against a measured 0.37. It buys one measured number with two
  others.
- **Judging the target lane by its traffic rather than by the hole**,
  in `keepRight` only. On seed 11 this looked like the answer: lorries
  in the rightmost lane 33.7% → 25.3% against a measured 24.7, gradient
  8.1 → 9.6, change rate unmoved. On seeds 23 and 37 the lorry error
  goes the other way, 5.3 → 7.2 and 4.5 → 8.7. **It was one seed's
  luck**, and it was nearly shipped on the strength of it.

**And the diagnosis, which is the useful part.** The gate collapsing the
gradient says where the model's gradient comes from: **keep-right
PRESSURE, not sorting.** Take the pressure away and the lanes equalise.
The measured road works the other way round — §5c's own note says so,
"fast drivers accumulate on the left and stay, slow drivers settle right
and are never blocked, and the lanes stay about equally full" — and the
model has nothing that makes a fast driver *prefer* the left lane, only
an absence of reasons to leave it. `blocked` reacts once you are already
held up; `keepRight` undoes it the moment a gap appears. A driver who is
faster than the traffic knows they will be blocked again in a minute,
and nothing in this model knows that. That is a missing mechanism, not
a mis-set constant, and it is why every constant tried failed.

**So the order changes again, and this comes first:**

1. **Seed the boundary from the equilibrium distribution** instead of
   uniformly, so a 6 km run measures the same thing a drone frame does.
2. **Compare over seeds, not on one.** The spread between seeds on these
   distributions is larger than any effect tried here — the lorry rms
   ranges 4.5 to 6.9 across three seeds of the *unchanged* model. Until
   the suite reports a spread, it cannot referee a change to this
   motive, and §5e's "tune it against the measured shares" was asking
   for something the harness could not yet do.
3. Only then, the missing mechanism: a reason to stay left that is not
   the absence of a reason to move right.

### Phase 5g — making the lane question decidable

Both of §5f's prerequisites, built. They are small and between them they
turn a measurement that could not referee a change into one that can.

**The boundary is seeded, optionally, from the measured shares.**
`born()` picked its lane uniformly, always; `laneMix: true` starts every
vehicle in the lane the drone found its class in. That changes the
question the run asks from *where does a random pile settle* to a
FIXED-POINT test — **begin where the real road is, and see whether the
motives hold it there**. `stat.drift` is how far each class moved from
where it was put, in percentage points per lane. It is not circular:
nothing about seeding a distribution makes a model preserve it.

Off by default, because every reference number in the harness was taken
on a uniform boundary — the mistake `RAMP_SHARE` made once already.
Four-lane only; anything else falls back to uniform rather than
pretending to know.

**It removed the transient outright.** Seeded, the 6 km zone and a
24–30 km zone agree — car rms 8.7/8.2/8.4 against 8.8/8.2/7.8 on the
same three seeds. The 30 km runs §5f needed were a workaround for the
boundary, not a fact about the road.

**And the suite now reports a spread.** `motive.test.js` runs three
seeds and prints every drift with a ±:

    drift        1 (L)         2         3     4 (R)
    lorries    -1.2±0.1  -9.9±3.1  +9.7±2.1  +1.3±1.9
    cars      -14.1±0.3  +0.9±0.4  +6.5±0.1  +6.7±0.5

**Cars became decidable and lorries did not**, and that is the useful
part. A 14-point drift against a ±0.3 spread is a ratio of about 47 to
one; the lorry lane-2 drift is 9.9 against ±3.1, which is three to one
and cannot referee anything. Lorries are a fraction of the traffic, so
the same run carries a fraction of the vehicle-seconds, and the fix is
more road-hours rather than a cleverer motive. The suite says so in
words rather than leaving it to be discovered again.

**Re-tried §5f's three candidates on the new instrument**, and it
settles all of them — the same numbers, now with error bars:

| | car L1 drift | car rms | lorry rms | gradient | rate |
|---|---|---|---|---|---|
| as it stands | −14.1±0.3 | 8.5±0.3 | 7.1±1.5 | 7.6±0.9 | 0.30 |
| judged by the lane | −13.7±0.3 | 8.2±0.2 | **9.1±0.8** | 7.4±0.5 | 0.30 |
| discipline gate | −12.1±0.1 | 7.2±0.1 | 8.9±2.0 | **5.5±0.3** | **0.20** |
| both | −11.8±0.2 | 7.0±0.1 | 7.2±1.1 | **4.7±0.6** | **0.20** |

The seed-11 result that nearly shipped — lorries improving under
"judged by the lane" — is now decisively the opposite: 7.1 → 9.1 with
spreads of 1.5 and 0.8, which do not overlap. The gate really does buy
car shares (12.1 against 14.1, far outside the spread) and really does
pay for them with the gradient and the change rate. Both rejections
stand, and neither is a coin flip any more.

What none of them does is move the gradient toward 15. That remains
§5f's missing mechanism, and it is now the only thing in the way.

---

### Phase 5h — cars on the screen

*(Ric, 2026-08-11: "can we add in the traffic?" — meaning the cars, not
more counted data.)*

Everything from §5b to §5g was judged headless on purpose, and none of it
had ever been seen. This is the wiring, and the rule it was built under
is the one in the memory file: **traffic behaviour is never debugged
through the game viewport.** Nothing below changes a motive. The
scoreboard is unmoved, and it is unmoved *provably* — see the
fingerprint.

#### The harness had no middle

`sim.js` exposed `run(opts)`: build a stretch of motorway in a closure,
step it to the end, close the books. A frame of OFFRAMP is 16 ms of
somebody driving, not an hour of nobody watching, so the loop had to
become somebody else's. `world(opts)` is the same closure with handles on
it — `step`, `advance`, `finish`, `live` — and `run` is four lines
underneath.

That is a refactor of the one file every number in this document comes
out of, so it was held to something stronger than the suite, which has
tolerances in it: **an eleven-configuration fingerprint of the entire
stat object at full precision, hashed.** Identical before and after, and
re-checked after every change below. The suite's tolerances would have
hidden a drift; this could not.

#### A stretch that travels

The harness models a fixed six kilometres with a boundary at one end and
a detector at the other. The game is 2,551 miles long. So the stretch
moves, and the moment it does the boundary stops being a boundary:
traffic crosses INTO a band at both ends, from behind when it is faster
and from in front when the band is faster.

The rate is not a decision. Vehicles wanting speed *u* stand at a density
*k(u) = q(u)/u*, so the flux across an edge moving at *vb* is *k(u)(u−vb)*
behind and *k(u)(vb−u)* in front. The property worth having is what that
does at *vb* = 0: the trailing edge accepts everything at exactly the
rate the fixed boundary uses and the leading edge accepts nothing. **A
parked band IS the harness**, which is the check `test/sim.test.js` §10
makes rather than a claim made here.

| band speed | veh/km/lane | vs the standing harness |
|---|---|---|
| parked | 16.5 | **98%** |
| 34 mph | 17.2 | 102% |
| 60 mph | 13.8 | 82% |
| 89 mph | 13.8 | 82% |
| 119 mph | 15.5 | 92% |

**Five faults, and four of them were the arithmetic being right about the
wrong quantity.** Every one produced a plausible-looking motorway.

- **Thinning on the driver's DESIRED speed.** At a band speed of 27 m/s
  among traffic wanting 30 but realising 25, every candidate was judged
  faster than the band and offered to the trailing edge while the
  vehicles actually falling out of the back went unreplaced. 45% of the
  corridor's density at traffic speed and **1% at 89 mph**.
- **Then thinning on the lane's realised MEAN**, which fails at precisely
  the interesting speed: E[(v−vb)⁺] is not (E[v]−vb)⁺, and when the band
  travels at the mean the difference is the whole quantity. Travelling
  *with* the traffic emptied the band as surely as outrunning it did.
- **Reading the density off the band itself.** *q = k·u* is the
  fundamental diagram, and 1,585 veh/h/lane is available both
  free-flowing at 15 veh/km and jammed at 29. Inferring the density from
  the band's own speed closes a loop around that identity: over-supply it
  once and its mean speed drops, which makes the inferred density rise,
  which supplies it harder. At 119 mph it walked onto the congested
  branch in two minutes and sat there — 28 veh/km at 15 m/s, exactly
  self-consistent and exactly wrong. The discount between wanting and
  getting is a property of the CORRIDOR, so it is measured once with the
  band standing still and then frozen.
- **Injecting and retiring on the same line.** That makes the edge
  absorbing: a vehicle travelling within a metre a second of the band
  drifts out, is deleted, and can only return as a fresh draw at the flux
  rate — a loss the flux does not price, worst exactly where the flux is
  smallest. Half the corridor's density at 60 mph with every other speed
  correct. The two lines are different lines now.
- **And one sign.** The oncoming carriageway is this same band with a
  NEGATIVE speed: seen from a car going the other way it sweeps backwards
  through its own traffic, so vehicles cross in over its trailing edge at
  the SUM of the two speeds. Clamped to zero once, the oncoming road was
  supplied at the wrong end and at half the rate. It held its density *on
  average* while the 900 m behind the band ran empty — which is why §10
  checks a profile and not a mean, and why the eye caught it first and
  the average would not have.

The dip at the traffic's own speed is real and stays: a band moving with
the traffic exchanges almost nothing with the road outside it, so it
holds what it was given. Printed in the suite rather than tolerated.

#### Onto the real road

`src/cars.js` is the only new file and it owns nothing about how anybody
drives — a band per carriageway, the mapping onto the corridor, and the
player. Everything meets at **corridor pixels**, which is the one
coordinate that survives a twenty-mile window being rebuilt underneath
both halves. `test/cars.test.js` asserts the consequence: across a
rebuild, **41 vehicles compared and the worst displacement is 0.000 px.**

Curves come free. A vehicle is an *(s, lane)* and the road frame does the
rest, so nothing here knows the corridor bends. Audited over 4,319
vehicle-frames: nobody off the sealed surface, nobody on a shoulder,
closest anybody came to the edge of the pavement 10.3 px.

`draw.js` gets its vehicles back — deleted with traffic.js in §4 and
rebuilt rather than restored, because the old ones took their dimensions
from a `Traffic.TYPES` that no longer exists. Every dimension is the one
the model is simulating, so a lorry is long on the screen because it is
long in the arithmetic that put it there. **The indicator is the only
place in this game where a measured behaviour is directly visible**: half
of all lane changes carry no lamp at all and half of the rest light it
after the car has started moving.

A glow on the oncoming headlights was tried and taken out, measured
rather than judged: `world()` lays 66% of a dark blue over the whole
buffer as the last thing it does, so the glow bought 5% of local
brightness — 42 against 40 luma — for a per-vehicle cost. The street
lamps and the player's own headlights live under the same tint. That is
the game's night, not a bug in it.

#### The player is a body

§5c settled that **the player is not special, the driver is**, and this
is that line made literal. The player does not get a flag anybody tests
for; they get a body — mass, length, width, a lane and a speed — in the
same index as everybody else. Every motive that reads the road reads them
without knowing what they are, and `yield` firing is a question about the
driver behind, not about the player.

Measured, with a car held stationary in lane 2 of the reference stretch:
**lane 2 runs at 2.2 m/s against lane 3's 6.5**, and what assembles
behind is twelve vehicles in 150 m, all of them under 5 m/s, the nearest
stopped. Nothing anywhere was told it was the player.

Contact goes through `sim.js`'s existing sweep — the same axis-of-least-
penetration test and the same `impact.js` fifth case the AI uses — and
is then **handed back rather than acted on**, because what a crash costs
the player is offramp.js's question and `land()` already answers it for
barriers, fences and blowouts. One model of what a crash does to a
person, not two. The impulse is computed with both real masses and
applied only to the car this file is driving; three places had to learn
to step around a body they do not own.

**And one fault that only a real run could find.** `fill()` populates the
whole band, including the stretch of lane the player is about to be put
down on, so a run could begin with a lorry already overlapping the car —
and did: holding the outside lane on rural I-40 ended in a rear-end 0.2
miles in, against traffic that had been there before the player was. The
space is cleared once, at the moment the body appears.

#### What it costs

Measured in the browser at Knoxville on a Friday at five — 2,178
veh/h/lane, 563 vehicles simulated across both carriageways:

| | |
|---|---|
| traffic update | **0.18 ms** per frame |
| `Draw.world`, traffic included | **1.8 ms** per frame |
| starting a run | 0.7–1.8 s, and it is the settle |

The frame cost is nothing against 16.7 ms. The start-up is the two bands
settling themselves against the corridor's own density before the first
frame, which is what lets a run begin on a full road rather than one that
seeps in over the following minute.

#### Seven things reported from play, and all seven were real

*(Ric, 2026-08-11: "the traffic is stuttery when I drive. And there is a
weird shadow on the car. And all the cars are dark, it's hard to see
them.")* None of these could have been found headless, which is the
other half of the rule: the model is judged off the screen, but the
PICTURE can only be judged on it.

**The shadow was the player, drawn twice.** The player's body lives in
`live` — that is the entire point of §5h's last section — and `collect`
walked `live`. So every frame painted a traffic car exactly on top of the
player, with the offset silhouette every vehicle gets, and what showed
was the shadow sticking out from under the real sprite. One line: the
drawing skips the body it does not own.

**The stutter was ten hertz against sixty.** The model steps at the rate
its evidence was published at and the game draws six times as often, so
each vehicle jumped 2.05 m and then stood still for five frames while the
player's own car moved smoothly past it. Measured over 89 frames at
Knoxville, before and after:

| a single vehicle | moves per frame | still frames | coefficient of variation |
|---|---|---|---|
| the model's position | 0.34 px | **74 of 89** | 2.22 |
| what is drawn | 1.89 px | **0** | **0.01** |

Carried forward by however much of a tick has elapsed, on the way out
only. It is extrapolated rather than interpolated between two ticks on
purpose: interpolating means holding the picture a tick behind the
simulation to have something to interpolate towards, and a tenth of a
second of latency on the car you are about to hit is worse than the
stutter was. Lateral is eased rather than extrapolated, because a lane
change is the one motion whose rate is not constant — running it forward
overshoots exactly as the car crosses the line in front of you.

**And the colours were honest and useless.** The first palette was the
colours cars are really painted, which on a `#3a3a44` road under a 66%
night tint is a dark shape on a dark shape. Lifted and saturated: vehicle
luma is now a median **154 against the road's 61**, and the darkest is
still twice the asphalt. This is the one deliberate departure from the
survey in the game — a road that is mostly white and silver, which is
what a real one is, is a road you cannot play on.

**And the cars were touching, which they were not.** *(Ric, 2026-08-11:
"the cars aren't really aware of each other and they touch each other a
lot.")* The awareness was never the problem — `stat.conflicts` is 0 in
the very runs it was reported from, and `sim.test.js` has asserted
nobody drives through anybody since the day the harness was built. The
DRAWING was wrong.

`s` in sim.js is the **front bumper**: `neigh` returns
`lead.s - lead.len - s` for a gap and `contact` takes `s - len/2` when it
wants the middle. Handed straight to the renderer, which centres a
sprite, every vehicle was drawn half a body-length too far forward. That
cancels exactly between two cars of the same size, which is why it
survived the first look, and does not cancel otherwise — the drawn gap
was wrong by **(lenLead − lenMe)/2**, measured live at −7.7 m to +7.8 m.
An articulated lorry following a car was drawn seven and a half metres
closer than it was, with its nose inside the car in front. Lorries are
6% of the traffic and the most visible thing on the road, so that is
what it looked like from the driver's seat.

Half a length back, and the player's own body gets the same correction
in the other direction — `S.s` is the middle of the car, so the sim is
handed the nose. Measured over a live run at Knoxville, **4,910
leader-follower pairs: worst disagreement 0.99 m, nothing drawn
overlapping anything.** The residual is the instrument — `project`
snaps onto a centreline sampled every 1.43 m — and `test/cars.test.js`
asserts it inside a metre, which is far tighter than the ±7.7 m it
exists to catch.

Two faults in the *test* on the way there, both worth naming because
they are the same mistake twice: it first measured the straight-line
distance between two drawn points, which on a curve is the chord and not
the arc (243 m of "disagreement" on a road whose worst is centimetres),
and then matched vehicles by id across BOTH carriageways, where the two
worlds number independently — so an oncoming car stood in for one of
mine and reported 394 m. Gaps are measured along `s`, on one
carriageway.

**And they were still touching, for two more reasons.** *(Ric,
2026-08-11: "there is a glitch where you can hit other cars still if you
drive in between the lanes. And I died because there was another car
doing it.")* Two separate faults, and the second one is the bigger of
the two by a long way.

**A driver caught the shove and never steered back.** `separate()` moves
two vehicles apart across the road after a contact, and `lane` is written
by nothing except the manoeuvre — so a vehicle that was NOT changing lane
when it was shunted kept its offset for the rest of its life. The code
already had the right idea and only half of it: `veh.vy = 0` carries the
comment *"a tap that did not wreck anybody still shoved the car sideways,
and the driver caught it. Nobody drifts a lane from a scrape."* Catching
the sideways VELOCITY is not undoing the sideways POSITION.

Measured on a road with one staged incident: **nine vehicles left
straddling a line while not changing lane, the worst a clean half-lane
out, two of them still there at the end of the run.** A vehicle at lane
1.5 sits in `byLane[1]` and `byLane[2]` — it obstructs two lanes, is hit
from both, and every one of those hits makes another one like it. That is
the car that was "driving between the lanes", and it is why one of them
killed somebody. They steer back now, at the rate that driver changes
lane at, because it is the same manoeuvre and deserves no second
constant. Still stuck at the end: **0**.

**And the road changed width without telling the traffic.** The harness
holds the lane count fixed for a run, which is honest on six kilometres
of chosen motorway and false on a corridor. Measured over ONE twenty-mile
window at Knoxville, against a world built with four lanes:

| the road is | share of the window |
|---|---|
| 3 lanes | **58%** |
| 4 lanes | 21% |
| 5 lanes | 20% |

**The first disagreement arrives 0.16 miles in.** A vehicle the model had
in lane 4, on a stretch with three lanes, was clamped into lane 3 to be
drawn — on top of whatever was already in lane 3 — while the model went
on believing the two were a lane apart. That is most of the road, not a
corner case, and it is both halves of the report at once: cars drawn
touching that the model thinks are apart, and cars that hit you from a
lane you cannot see them in.

`nLanes` is no longer a constant. Every per-lane array is sized once at
`MAX_LANES`, so changing the count resizes nothing, and `cars.js` hands
both worlds the road's own width every step. Vehicles in a lane that has
just ended are brought in — which is what a lane drop physically is, and
doing it as a proper merge with gap acceptance and a reason is still
`lane drop`, one of §5c's three stubs. Measured over a mile of real
driving afterwards: the count tracked the road exactly (4/4 then 5/5),
**0 vehicles in lanes the road lacks, 0 straddlers, 9,201 leader-follower
pairs and nothing drawn overlapping anything.**

**What it cost the scoreboard, which is the thing to check.** Nine of the
eleven fingerprint configurations are numerically identical — rate,
gradient and flow to six decimal places. The two that moved are the only
two with meaningful contact counts, and they moved the right way: the
ramps run's gradient went **13.26 → 7.58**, which is the model's ordinary
7.6 rather than a figure inflated by stuck vehicles blocking lanes, and
the incident run's 6.04 → 3.67 for the same reason. `motive.test.js` is
unchanged to the digit. The steer-back is inert where nothing is being
shunted, which is where every reference number was measured.

#### You could drive through the oncoming carriageway

Looking for a hitbox fault Ric reported, and this was the one worth
finding. The player was piloted into `mine` and only `mine`, so the
other carriageway could not see them at all. Measured by driving the
wrong way down it: **557 vehicle-frames with an oncoming car's body
inside the player's, and not one contact registered.**

Both worlds are told now, and which of them holds the body is decided by
the sign of `u` — the player's own carriageway is the positive-u side
when they are going the way the road runs, and the negative one when
they took the WEST sign. In the other world the same car is travelling
BACKWARDS: its `s` counts the other way and so does its speed, which is
what makes a head-on a head-on rather than a stationary obstacle. Zero
frames inside the car afterwards, and driving into oncoming traffic
ends the run at 79 km/h of delta-v.

It also needed a word of its own. In that world's frame the player is
going backwards, so a car coming straight at them arrives from behind
and `sim.js` honestly reports a REAR-END — the right answer to the
question it was asked and the wrong thing to tell the driver. Tagged
where the carriageway is known, which is `cars.js`.

**What was NOT wrong, measured rather than assumed:** the boxes match
the sprites on both sides. Contact fires at **0.33 m of overlap** along
the road and within **0.07 m** across it, and the player's body is the
same `PW`/`PL` the rest of the game has always used — it is now taken
from one place rather than declared twice. What remains is a question
about SIZE rather than about hitboxes: a model "car" is 6.0 m
(BEHAVIOUR.md §2, off the drone) and the car you drive is 4.65 m, so
other cars are 29% longer than yours. That is a real inconsistency and
changing either end moves a measured number, so it is Ric's call and
not a bug to be quietly fixed.

#### The car you drive was an immovable object

*(Ric, 2026-08-12: "i can push cars out of the way look at the crash
mechanic.")*

He could, and it was two separate holes in the same handoff. Neither was
a physics bug — `impact.js` was solving all of it correctly and the
answers were being thrown away.

**One: the player's half of every impulse was computed and dropped.**
`sim.js`'s `collide` solves both bodies, and then:

```js
if (!a.piloted) { a.v = ...; }      // applied
if (!b.piloted) { b.v = ...; }      // applied
                                    // and the player's? nothing.
```

The comment above it said the game owns the player's velocity, which is
true and is a good rule — but nothing then handed it to the game, so it
went nowhere. Measured: **229 contacts in sixty seconds of driving
through traffic at 108 km/h without losing a single km/h**, while every
car hit was shoved aside by `separate`. What it should have cost:

| | solver says | game did |
|---|---|---|
| 108 into a car doing 72 | −20.4 km/h | 0 |
| 108 into a stopped car | −57.1 km/h | 0 |
| 108 into an artic doing 72 | −39.3 km/h | 0 |
| 108 into a stopped artic | −109.6 km/h (stops dead) | 0 |

The fix is not to write the velocity in `sim.js` — that rule stands, and
`cars.test.js` still asserts it with "...nor wrote its speed". It is
handed over in the hit record as `dvAlong` and applied by `offramp.js`,
which is **exactly what `scrapeWall` has always done for the barrier**:
`S.speed = max(0, solver's answer)`. Car-into-car was the only one of
the five cases not doing it, and impact.js's own docstring says the four
barrier cases were unified precisely so that "traffic needs a fifth".

**Two: the player had no lateral velocity at all.** `pilot()` created
the body with `vy: 0` and never wrote it again, and `setPlayer` never
passed one. So every sideswipe was solved as though the player were
tracking dead straight: no lateral closing speed, therefore no lateral
impulse, therefore no injury roll and no cost — and `separate` moved the
other car out of the lane anyway. That is "push cars out of the way" in
its purest form, and it is the half that matches Ric's words most
literally. Wiring `S.vu` through took the contacts the game is told
about on a weaving player from **67 to 122**.

The conversion falls out of `laneAt` with no new constant: lane is
`(u − c)/R.LANE` signed by direction, a lane is `LANE_W` wide, and
`R.LANE × M_PER_PX` is that width to 0.8% — so it is `pxs2ms(vu)` with a
sign, and the sign turns over in the oncoming world exactly as `laneAt`
does. Both signs are pinned in `cars.test.js` rather than left to be
discovered from the driving seat.

**Verified in the game, not just in the model.** Accelerating down a
lane into traffic: 162 → 105 mph in one frame, and the run ended
"WRECKED · 58 MPH OF DELTA-V INTO IT" — the speed lost and the injury
model finally reading the same impact. Before, that drop was 0.

**Three: the driver caught every knock perfectly, in one tick.** The
integrator read `veh.vy = 0` for every surviving vehicle — the solver
worked out how hard a car had been knocked across the road and the next
line undid all of it, instantly, every time. Nothing could ever be
destabilised by a scrape: wrecked outright, or exactly where you
started, with no in-between. It now decays at that driver's own lateral
acceleration, which is the same argument the file already makes one
paragraph further down for steering back — same driver, same manoeuvre,
same constant, no new number. "Nobody drifts a lane from a scrape"
survives: the excursion is vy²/2a, so a 0.66 m/s knock moves you 18 cm,
and it takes about 3 m/s to reach the next lane.

Measured on a weaving player: **421 vehicle-frames with a live sideways
velocity and 578 frames where a car that was not changing lane got moved
across the road, against zero of each before.** It is inert in the
headless queue harness — a queue behind a stopped car is all rear-ends,
and a rear-end carries no lateral impulse — which is why none of §5e's
calibrated numbers move.

#### And why clipping a corner still does nothing much

*(Ric, same day: "i hit the cars and it never crashes. sometimes
clipping of my rear or front corners on their corners.")*

The boxes were the first suspicion and they are innocent: every drawn
box matches its model box to within one pixel — worst ±0.179 m on
length, +0.085 m on width — and the player's 26 × 11 px sprite is its
4.654 × 1.969 m body exactly.

There WAS a real bug next to it. `contact()` was using one axis to
answer two questions. Which way to push two overlapped boxes apart wants
the least-overlap axis, and that is right. Handing the same axis to the
solver as the impact normal is not: clip somebody's rear corner and you
overlap 2.65 m nose-tail against 0.27 m across, so the whole event
resolved as a flank hit, found nothing closing sideways, and returned no
impulse at all. The impulse now takes its own normal, chosen by the axis
the bodies are CLOSING on. Nose-on-tail-corner went 0.7 → 3.3 km/h and
was reclassified from flank to nose-tail. Where both axes close it picks
the harder one, which is the old answer, so ordinary rear-ends and
sideswipes are unchanged.

**But the honest answer is that a corner clip is not a crash.** Rebuilt
through the real solver at 70 mph, corner clips produce **1–4 km/h of
effective delta-v** — the only closing speed in a same-direction contact
is the lateral drift, however fast you are both going. `IM.SUPERFICIAL`
is 12 km/h and below it `land()` does nothing at all, by design and
correctly: the injury curves have a left tail that would otherwise kill
one driver in a thousand for a paint scrape.

So everything under 12 km/h was free, and that was a DESIGN question
rather than a defect: real corner clips are panels and mirrors.

#### Ric called that one too: a scrape costs you now

*(Ric, 2026-08-12: "cosmetic damage to me and the other vehicles,
sometimes a tyre blows out and totals you if you hit it just right. drag
sure.. but keep the damage so it feels realistic to a real car at those
speeds.")*

The delta-v was NOT inflated — it is measured and it is right. What
changed is that "nobody is hurt" stopped meaning "nothing happened".

**`scuff()`, for everything under `IM.SUPERFICIAL`.** `land()` still
refuses to roll injury down there, and it must: the injury curves read
outside their fitted range say a paint scrape kills one driver in a
thousand. But it now adds bodywork drag and paint, scaled by how far
below superficial the blow was — 0.012 of `dragK` at the ceiling, so it
takes a great deal of scraping to reach anything you would feel. That is
the real number at these speeds.

**The tyre is the one that can end you, and only on a CORNER.** A blow
across a door does not touch a wheel; one on the corner loads it, breaks
the sidewall internally, and it lets go later with no proximate cause —
which is exactly what `blowoutRate` already modelled and which nothing
under 25 km/h could previously feed. `sim.js` now reports whether only
the corners were engaged (small overlap on BOTH axes at once), so "if
you hit it just right" is a geometric fact about the impact and not a
dice roll.

**And it exposed a real discontinuity while wiring it up.** `damage()`'s
first band added no tyre damage at all, so an 11.9 km/h corner clip put
0.09 into a tyre through `scuff` and a 12.1 km/h one put in **zero** — a
harder blow doing less damage than a softer one. The band now
interpolates from `scuff`'s 0.09 up to the 0.35 of the band above, so
the whole curve from paint scrape to folded corner is continuous:

| effective delta-v | tyre damage, one corner hit |
|---|---|
| 3.3 km/h | 0.025 — eleven clips to arm a tyre |
| 11.9 | 0.089 |
| 12.1 | 0.092 ← was 0.000 |
| 20 | 0.250 — one good clip arms it |
| 40+ | 0.700 |

**Cosmetic damage on the traffic too.** `veh.scuff` is 0..1 of
accumulated scraping with the flank it landed on, and nothing in the
model reads it — not the hitbox, not the injury roll, not the speed. It
exists so a carriageway that has been shunted around for ten minutes
stops looking showroom-fresh. Drawn OVER the sprite like the lamps
rather than baked into `vehicleBmp`, whose cache is per shape and colour
and would otherwise multiply by every damage state.

The marks are **bare metal**, pale grey over a dark edge, which is both
what a scraped wing actually looks like and the only choice that reads
on this palette — a dark mark disappears on the dark half of the cars
and a light one disappears on the white lorries, and one of the two
always shows.

**What is still on rails, deliberately.** The player is still immovable
in `separate`. They now take a lateral NUDGE from an impact — the solver
puts them at 0.34 m/s across the road for a 1 m/s drift, about half an
ordinary lane change, and the wheel pulls it straight out — but they are
still never POSITIONED by the solver, which is the thing §8 rejected.

#### Ric called it: the vehicles are real sizes now

*(Ric, 2026-08-12: "can you make the sizes of the car real life
proportions?")*

The measured end was the one that moved, and the reason it could move
without losing a measurement is that **6.0 m was never a vehicle
length.** BEHAVIOUR.md §2 comes off overhead trajectory data, where the
thing measured is a tracked bounding box — and a tracker's box around a
moving blob is bigger than the sheet metal in it by a roughly constant
margin, because the margin belongs to the tracker and not to the car.
No car sold in America has a median length of 6.0 m. A Camry is 4.88, a
Civic 4.68, a RAV4 4.60; the longest ordinary thing in the light-vehicle
bin is a crew-cab F-150 at 6.2, and 6.0 was sitting at the *middle* of
the distribution rather than the top of it.

So `traffic.js`'s `LENGTH` is now real vehicles, and what is kept from
the measurement is its SHAPE — the classes in the same order, at the
same spacing, with the same relative spreads:

| | was | now | what the span is |
|---|---|---|---|
| moto | 2.2 ±0.3 | 2.2 ±0.3 | unchanged; already physical |
| car | 6.0 ±1.4 | **4.9 ±1.1** | Mini 3.85 → crew-cab pickup 6.0 |
| rigid | 11.0 ±3.5 | **9.3 ±2.9** | box van → the 40 ft single-unit limit |
| artic | 20.0 ±1.6 | **21.5 ±1.7** | 53 ft trailer, day cab 65 ft → sleeper 75 ft |

The artic went UP, which is the check that this is not just "make
everything smaller": 20.0 was the figure both datasets rounded to and
BEHAVIOUR.md already says to treat it as "a tractor-trailer" rather than
as a measurement. A real one is longer than that.

`MERGE_LEN` moved 8.0 → 6.2 with them. It is not a tuned number, it is
"longer than any car, shorter than any rigid", and the gap it has to sit
in is now 6.0 to 6.4 instead of 7.4 to 7.5. It is marginally *cleaner*
than it was: at 8.0 the band from 7.5 to 8.0 was short rigids being
waved through as cars, about a fourteenth of the rigid class, and at 6.2
no class straddles the line at all. Held at 8.0 against the old lengths
it changed nothing measurable in the parked-car harness, which is the
check that it is a classifier and not a tuning knob.

**What it cost, measured rather than assumed.** The free road does not
notice: 57 mph before and after with nobody parked in it, 56 with the
player cruising, and **zero contacts in 5,700 veh-km either way**.
Capacity, the lane gradient and the crash rate are where they were.

**What it exposed** is worth more than what it changed.

#### A test that had been passing on a coin toss

`cars.test.js` went red on the change: "A CAR STOPPED IN LANE 2 STOPS
LANE 2". The obvious reading is that real vehicle lengths broke
something, and the obvious reading was wrong in a way that is worth
writing down, because the same trap is set in several other files.

The test stood the player still in lane 2 of one seeded run and asked
for lane 2 to be running at under 60% of lane 3. Run over **40 seeds**
instead of one:

| | lane 2 slower, as asserted | pooled ratio |
|---|---|---|
| old lengths, 6.0 m car | 23 of 40 | 0.37 |
| real lengths, 4.9 m car | 22 of 40 | 0.37 |

It is a **fifty-fifty under both**, and the pooled number is identical to
two decimal places across a change that moves every trajectory in the
run. The test had never been measuring the model. It had been measuring
seed 23, and seed 23 stopped agreeing.

The 12-seed sample that was checked first said the opposite, and said it
confidently — mean contacts 8.6 against 98.3, which reads like a
catastrophic regression. Widened to 40 seeds the same measurement goes
**the other way**: median contacts 7 → 5, cascades (>30 contacts in a
run) 1 of 40 → 0 of 40, worst run 545 → 22. A dozen seeds was not a
small sample of a stable quantity, it was a sample of a **bimodal** one,
and the mean of a bimodal quantity is a number that describes nothing.
Sweeping car length 6.0 → 4.0 in steps shows it plainly: 6.6, 8.4, 73.6,
8.4, 61.4, 5.8, 75.0, 143.5. That is not a curve to read a trend off.

**Why lane 3 was never a control.** A stopped car at 1,585 veh/h/lane
puts the traffic that can no longer use lane 2 into lane 3, and that is
enough to put lane 3 into stop-and-go as well — pooled over 40 seeds it
runs 8.6 m/s on the old lengths and 10.6 on the real ones, against a
free road's 25. Asking the lane next door to be undisturbed is asking
the blockage not to have the effect a blockage has.

**The control is the same lane, on the other side of the car.** An
obstruction acts upstream and only upstream: it backs traffic up behind
and starves the road in front. Pooled over eight seeds that separates
**0.04 to 0.12 against a bar of 0.6**, on four different seed families
and on both the old lengths and the real ones — and the starved side is
the tell that no scripted "get out of the player's way" could fake,
because nothing gets past at all: 205 vehicles behind, 26 ahead.

The rule this leaves behind, and `motive.test.js` already works to it:
**a single-seed assertion on a congested run is not a test.** Either
pool it or report its seed spread, or it will pass until the day
somebody changes something unrelated.

#### And three more of them, in sim.test.js — NOT fixed, Ric's call

The same change put `sim.test.js` at **96 passed, 3 failed**. All three
are single-seed assertions and all three are the same trap, measured the
same way — by running them across seeds on the **old** lengths, where
they are supposed to be green:

**§9, the two on-ramp assertions.** Five seeds, both tables, and the
thing to look at is that the old lengths fail them *more* often:

| seed | old flow ×, conserved | new flow ×, conserved |
|---|---|---|
| 11 | 1.23 ✓ 0.995 ✓ | **1.04 ✗ 0.777 ✗** |
| 23 | 1.26 ✓ 1.002 ✓ | 1.25 ✓ 0.996 ✓ |
| 37 | **1.04 ✗ 0.883 ✗** | 1.28 ✓ 0.990 ✓ |
| 51 | **1.01 ✗ 0.778 ✗** | 1.26 ✓ 0.965 ✓ |
| 67 | 1.23 ✓ 1.011 ✓ | 1.29 ✓ 0.983 ✓ |

**2 of 5 fail on the old lengths, 1 of 5 on the real ones.** The suite
went red only because it runs seed 11, which is the one seed where the
new table is unlucky — and old seed 51 produces `conserved` **0.778**
against new seed 11's **0.777**, the same failure to three digits.

There is no middle of that distribution. The ramp either gets away
(×1.23–1.29, conserved ≈ 0.99) or it locks solid (×1.01–1.04, conserved
≈ 0.78), and nothing lands between. That is not a marginal measurement,
it is **a binary outcome being asserted as if it were a quantity** — and
§9's own comment already says why the road is on that knife edge:
`keepRight` has 34% of the traffic in the rightmost lane against a
measured 24.8%, so the lane the ramp joins is over capacity before a
ramp vehicle arrives. The test is faithfully reporting that defect. It
just reports it as a coin toss.

**§8, "the queue upstream grew".** Continuous rather than binary, and
just as undecided — seven seeds on the old lengths give ×1.32, ×1.75,
×1.95, ×2.24, ×2.44, ×2.77, ×2.96 against a bar of ×2.0. **3 of 7 fail
where they are supposed to be green**, and the test's own seed 51 clears
it by 12%.

**Left red on purpose.** Every honest way to green these costs something
somebody has to choose. Pooling them the way `cars.test.js` was pooled
is the right shape and is not affordable — one on-ramp seed is 0.8
simulated road-hours and the pair takes minutes, so five seeds would
turn a ten-minute suite into an hour. Moving the seed until it passes is
tuning the scoreboard to fit the run. Widening the bars hides the
lane-distribution defect that §9 is deliberately keeping visible. So the
assertions are untouched and this is the note that says the red is
older than the change that revealed it.

#### The traffic moved about too much, and the measured rate said so

*(Ric, 2026-08-11: "they need to not move out of the way so much, most
cars don't notice or stay still.")*

The first guess was `yield`, and it was wrong — measured with the player
sitting on somebody's bumper for thirty simulated minutes, the courtesy
fires **62 times in 3,816 manoeuvres, 1.6% of them**. Nobody is getting
out of the way. What is happening is ordinary lane discipline at
too high a rate: `blocked` and `keep right` are 88% of everything.

And the rate is measurable, which is the point — it is one of
BEHAVIOUR.md's four numbers that nothing in the model is told. In the
conditions the GAME runs, exits on and the corridor's own junctions:

| | lane changes per vehicle-km | vs the measured 0.37 |
|---|---|---|
| no exits (the scoreboard) | 0.252 | −32% |
| exits on, as the game had them | **0.490** | **+32%** |

`exitLead` was the obvious suspect and is not the lever: 3,000 m to
2,200 m moved the rate by 0.001. `EXIT_SHARE` is. It is DECIDED at a
tenth per junction — the usual planning figure for ramp volume against a
mainline — and that figure assumes an interchange every few miles. This
corridor has one every **1,420 m**, so a tenth means a tenth of the
traffic peeling off every 0.88 miles, every one of them crossing to the
outside lane to do it.

| exitShare | rate | vs 0.37 | got off, having tried |
|---|---|---|---|
| 0.10 | 0.509 | +38% | 85% |
| 0.06 | 0.431 | +17% | 87% |
| **0.05** | **0.392** | **+6%** | 81% |
| 0.02 | 0.320 | −14% | 83% |

So the game passes 0.05, and the value is not chosen by eye — it is the
one at which the emergent rate lands on the drone's. **A decided
constant pinned by a measured one**, which is the only way this project
is allowed to set it, and it is the answer to a complaint that was
otherwise about feel. The harness keeps its own 0.10: §8 passes it
explicitly and every number there was measured with it.

#### And you can choose when you are driving

*(Ric, 2026-08-11.)* Day of week and hour, on the sign next to WEST and
EAST, each with **Today/Now** and **Any** — and `Any` re-rolls per run
and re-rolls the two independently, because Sunday morning and Sunday
evening are different roads.

This is not a cosmetic setting. `traffic.js` keys the counters on day and
hour, so it decides how much traffic there is, how much of it is lorries
and how fast it is going. The panel says so before you press start,
reading the same counters the run will use — measured live at exit 383:

    Friday 5pm    2,050 veh/h/lane   nose to tail    611 vehicles
    Sunday 3am      169 veh/h/lane   quiet            40 vehicles

The month is deliberately not offered: it moves the counters by a few per
cent, where the hour moves them by a factor of twelve.

#### Known gaps, listed rather than papered over

- ~~**The lane count is fixed for the life of a sim world**~~ — fixed
  above, and it was not a gap, it was the defect behind two play
  reports. What remains is that a vehicle whose lane ends is brought in
  by fiat rather than by merging: no gap acceptance, no reason, no
  indicator. That is `lane drop`, and it is still stubbed.
- **Nobody is on a ramp.** The band is mainline only, so traffic leaving
  at a gore vanishes at it and traffic joining appears on the
  carriageway. That is `merge`'s remaining half.
- **The lane shares are still §5f's.** Lane 1 is under-filled and the
  gradient is short, and it is visible now rather than merely printed:
  the outside lanes carry more traffic than the drone measured. Seeing it
  changes nothing about what to do — the fix is still the missing
  mechanism, judged on §5g's table.

---

### Phase 5i — a menu, a garage, and points that are worth something

*(Ric, 2026-08-12: "i want to make a main starting screen main menu. the
menu should inclus some sort of prgression idea.")*

Three new files and no new physics. `data/garage.js` is ten vehicles,
`src/score.js` is what a run is worth, `src/progress.js` is what survives
it — and the menu is the place all three are visible at once.

#### The car was a constant in three files, and now it is a row

There was one car. `V_MAX` was 220 mph, the throttle pulled a flat 56
km/h/s, the brakes took 132, and `CAR_MASS` was 1500 in `impact.js` and
1500 again in `cars.js`. Two of those numbers are not possible: 56 km/h/s
is **1.6 g from a standstill in a family hatchback**, and 132 is **3.7 g
of braking**, which is about triple what any tyre has ever done.

A row in `data/garage.js` holds only figures a magazine printed — power,
kerb weight, 0–60, top speed, 60–0, skidpad g — and the rates the game
wants are derived from them. The longitudinal model is now

    a(v) = a0 · (1 − (v/vTop)²)

which integrates in closed form, so `a0` falls straight out of a
published 0–60 with no fitting loop:

    a0 = (vTop / t60) · artanh(v60 / vTop)

**The reason to derive rather than tune is that the answers can then be
checked against physics nothing aimed at.** No row asked for a
particular launch g; these are what the published 0–60s imply:

| vehicle | implied a0 | in g | is that possible? |
|---|---:|---:|---|
| Jetta 2.0 | 9.7 | 0.28 | yes — 115 hp |
| Corvette Z06 | 26.9 | 0.76 | yes — 505 hp, rear-drive |
| 911 Turbo, built | 35.5 | 1.01 | yes — awd, launches |
| S1000RR | 34.5 | 0.98 | yes — wheelie-limited |

Four drivetrains, four right answers, from arithmetic that was never
shown the target. A rear-drive car cannot beat about 0.8 g off the line
and an all-wheel-drive one just reaches 1.0; a superbike is held to the
same by the front wheel coming up rather than by grip.

`test/garage.test.js` then drives each one at 60 fps using the update
offramp.js actually runs — a forward Euler step, not the integral — and
stopwatches it. Worst error across the garage is **0.045%**, and it is
one-sided, because a forward step on a falling acceleration always
flatters the car. That assertion is in there deliberately: if it ever
goes the other way, the thing being measured has stopped being the thing
being run.

#### Everything got slower, and braking distances roughly tripled

The fastest thing in the garage now pulls 35.5 km/h/s against the old
car's 56, and the hardest-stopping one stops at 42.5 against 132. **60–0
goes from 0.73 s to between 2.3 and 3.1.** That is the single biggest
change to how the game plays and it is the one §2 has been waiting for:
"arriving at the back of one at speed is the best hazard this game has
ever had and it was never once used in play." It was never used because
you could stop from 150 mph in about forty metres.

Top speed also stopped being a clamp. The old car arrived at 220 mph
still pulling 15.7 km/h/s and simply hit a wall; the square term is
drag, so acceleration is now exactly zero AT the top speed and the last
few mph take real time to find — **23 seconds of them in the Jetta.**

#### Two things came free, because the model was already general

`impact.js` was already mass-general — it carries a BODIES table with a
1500 kg car, a 2270 kg SUV and a 36 tonne semi, and `solve()` takes the
masses it is handed. So the motorcycle needed **no bike-specific code at
all**. 197 kg against the pickup's 2,400 is a mass ratio of twelve, and
every consequence of that falls out of the solver.

And `cars.js` takes the vehicle's real length, so a 5.89 m F-150 does not
fit in a gap a 2.05 m bike does. Nothing had to be told that either.

The one trap: the defaults in `cars.js` are written `26 * M_PER_PX`, not
`4.65`. Every scoreboard figure in `sim.test.js` is held to an
eleven-configuration fingerprint and **4 mm of vehicle length is enough
to move one.**

#### V_MAX stayed 220 mph, and that is not an oversight

A dozen expressions normalise on it — barrier drag, wreck severity,
damage drag, the audio. Those are physical rates and must not become
car-relative: a Jetta scraping a barrier at 100 mph has to lose paint at
the same rate as a 911 scraping it at 100 mph. Normalised on each car's
own top speed the Jetta, at 83% of its maximum against the Porsche's
49%, would grind nearly twice as hard for the same collision. So V_MAX
is a fixed REFERENCE now, every existing use is untouched, and only the
throttle, the brakes, the ceiling and the steering scale read `S.car`.
This is why the crash suite and the sim fingerprints did not move.

#### The score is one pot, and the multipliers multiply

*(Ric: "essentially the more difficult and dangerous you make it the
more points you get. high risk high reward low risk low reward.")*

    earn = (distance + weighted exits) · traffic · night · pace

| term | source | range |
|---|---|---|
| traffic | local density off the band, veh/km/lane | ×1.0 → ×3.0 |
| night | hour of day | ×1.25 |
| pace | time held above a fraction of the car's top speed | ×1.0 → ×4.0 |

**The terms fight each other, and that is the good part.** `traffic`
rises with density and `pace` rises with the speed you can hold, and
heavy traffic is exactly where you cannot hold speed. So the maximum is
not "find the busiest hour" or "go fast on an empty road" — it is thread
fast traffic at speed, which is the most dangerous thing a person can do
on a freeway. Nobody designed that interaction; it falls out of
multiplying rather than adding.

Peak stack is ×15. **Realised over a run it is nearer ×10**, because
`pace` spends its first ninety seconds climbing, and the two figures are
asserted separately so nobody later closes the gap thinking it is a bug.

#### The pace threshold is a fraction of YOUR car's top speed

The one decision here that matters more than any constant. An absolute
bar — "above 130 mph" — and the Jetta, which tops out at 120, could
never earn the speed multiplier at all while the built 911 collects it
at a canter. The whole garage below the Corvette would be a strictly
worse choice and the ladder would collapse into "drive the fastest thing
you own."

As a fraction, 100 mph in the Jetta pays exactly what 165 pays in the
Porsche — and it is more frightening, because the Jetta is at 83% of
everything it has while the Porsche is loafing. Measured in
`test/score.test.js` §3a: at the same 100 mph the Jetta earns the full
×4 and the 911 earns ×1.

#### Checkpoints every tenth exit

*(Ric: "maybe its like every 10 exits are a checkpoint ... if you wreck
before the 40th exit you get the rewards for the first 30.")*

Better than the every-exit version that was proposed, because this
corridor has an interchange every 1,420 m — ten of them is about nine
miles of committed driving rather than a chance to lose your nerve at
each ramp. §4 of the score suite drives Ric's sentence literally: 39
exits, wreck, and the books show three checkpoints paying at exits 10,
20 and 30 with the last nine lost.

Quitting to the menu costs the pot too. If it did not, the optimal play
would be to build a ×15 and immediately quit, and every interesting
decision in the game would be replaced by that one.

#### Unlocks are a threshold, not a purchase — and never `skill.js`

Hanging unlocks off `Skill.E` was the first idea and it is wrong. E is a
ROLLING hundred-kilometre window, so it falls as well as rises, and
skill.js's own header says the 35% ceiling exists so that it "cannot
quietly become what the game is about". Unlocks off E would make it
visible, make it the point, and take a car away from you for one bad
night. The two systems stay separate: skill leans on the dice, progress
opens doors.

Nothing is deducted either. A spend can produce a state where you own
the Corvette and cannot afford the Civic, which is confusing to look at
and worse to explain on a menu.

#### There are no accounts, and there cannot be

*(Ric: "i guess at some point there will need to be accounts lol...
didnt think about that.")*

Static site, GitHub Pages, no server. Progress is per browser and per
device and dies with site data. The version a static site CAN do is a
**save code** — the ledger is one small serialisable object, so
`exportCode`/`importCode` turn it into a string you copy out and paste
in. Built now rather than later because the SHAPE of the state is what
makes it possible, and that is much harder to change afterwards. It is a
transfer you perform by hand, not sync and not backup.

#### What is measured and what is not

Green: 58 garage, 41 score, 45 progress, and the four suites that
predate this at 86/74/59/28 — **391 assertions, nothing failing**.
`sim.test.js` is 97 passed / 2 failed, which is the pre-change baseline
to the test, and the two reds are §5h's documented on-ramp coin toss
(`conserved` 0.799, the "locks solid ≈0.78" branch).

In the browser: the menu draws, the garage cycles, a locked vehicle
refuses to start and says what it costs, the score accrues live with a
visible multiplier, and the ledger survives a reload. Two per-vehicle
figures were confirmed in the running game — the Jetta's 60–0 at 3.1 s
against a derived 3.07 where the old car took 0.73, and the S1000RR's
two-second pull at 56.3 km/h against a predicted 56.4.

**Not measured in the browser: the other eight vehicles' acceleration.**
The pane runs hidden, so rAF is frozen and the loop has to be stepped by
hand, and the `blur` handler clears the key set — every attempt to drive
a third car through the harness measured the rig rather than the game.
The headless suite covers all ten at the real frame rate against the
real update, so this is a gap in the in-game confirmation and not in the
model. Worth ten minutes with the pane visible before trusting the feel
of any particular car.

---

## 6. Risks and things I expect to go wrong

Flagging these once, here, rather than in conversation.

- **Real curves are tighter than the engine assumes.**
  `FREEWAY_CURVE = 1/3400` is a ~609 m radius. Sections of real I-40 in
  the mountains are tighter. The camera rides the road's heading, so a
  tight curve at 190 km/h may feel wrong before it looks wrong.
- **Real interchanges are closer together than the spacing guards
  allow.** `nearFeature()` refuses to build within
  `exitApproach + 1400` px of another feature. Urban I-40 will trip
  this constantly. The guard will need to become advisory.
- **No elevation model.** `deck` is integer levels, not metres. Real
  grades are not represented and the "nothing over the mainline" rule
  makes that mostly moot — but not on a split.
- **Scale.** All of I-40 is ~23M world px of centreline, comparable to
  the current map's 20M, so it fits — but the build is already 1.5 s and
  a linear pass should be much faster. Watch it.

---

## 6a. The gore nose was in the middle of a lane

Reported from play, 2026-08-09: *"there is a barrel in the road, and if
you hit it you wreck — real highways don't have barrels in the middle
of the road."* Correct on every count.

A ramp's station zero is the **centre of the deceleration lane**. That
is the design at the top of `road.js` and it is what makes a gore need
no stitching — the two surfaces are contiguous because they were built
from the same number. What follows from it is that **at the junction
station there are not two roads**. Measured at exit 374: the ramp's
near edge sits 20.5 px *inside* the mainline's sealed surface and stays
inside it for the next two hundred pixels.

The crash cushion was drawn there, and the ±4 px test that ends a run
for straddling it was there too. So every exit on the corridor had a
solid, run-ending object standing in a lane at the one place a driver
is entitled to move across freely — moving in and out of it is what a
deceleration lane is *for*. Swept across 377 junctions, the object stood
**120 to 432 px too early, median 248 (about 44 m)**. Not "some exits":
all of them.

The nose is where the two **sealed surfaces part**, and that is a fact
about the built shapes, so `World.noseOf()` measures it the same way
every other relationship on this map is measured — walk the ramp's
parent-facing edge, project it back, stop where it clears the parent's
pavement. The record it returns carries `nearIsL` with it, because
which of a ramp's edges faces the road it left is a sign convention
that has to be right in three places and was being re-derived in each.

- `draw.js` puts the cushion at `j.nose`, so the object and the thing
  that hits you come from one number and cannot drift apart.
- `handovers()` no longer tests anything at the junction station. The
  handover there is bookkeeping: the same pavement, a different road to
  be tracked on, reversible by steering back.
- The collision is at the nose, asked of whichever road the car is on —
  past your own road's edge *there* is the neutral area, and the thing
  at the front of it is what you hit.

### In the end the object went away entirely

Third report: *"that buffer thing only happens on rails — it's not ever
on the pavement like that,"* then *"the box barrier thing needs removed
completely."* Right, and it is gone. An impact attenuator is bolted to
the **end of a barrier run**; the gore of an ordinary interchange has no
barrier in it, so there is nothing standing there. Moving it twice — to
the seam, then onto the ground — was answering the wrong question.

What a gore costs now is what it costs in life: hatching you may drive
over, and a verge past it. Split the difference and you end up on the
grass between two roads at speed, and `leftTheRoad()` decides what that
is worth — the same model that already answers for leaving the road
anywhere else. `hitNose()`, the two-stage crush arithmetic and the
`gore` wreck messages are deleted. `Impact.crushStop` stays, because
`hitWorks()` still uses it for the barrels across the closed ramp at
exit 368, which are really there and really signed.

`nose` is still measured and still used — it is where the deceleration
lane's edge line stops.

### The edge line was swinging out instead of splitting

*"The lines for the V look funny… the red lines are what the white lines
should look like — the direction and how they connect."*

A freeway's right edge line marks the edge of the **through lanes** and
does not move. When a deceleration lane opens it opens OUTSIDE that
line: the line carries straight on, the new lane appears beside it, and
the outside of that lane gets an edge line of its own which peels away
and becomes the ramp. **Two lines that separate.**

This was one line, drawn at the sealed edge with the auxiliary lane
included in it. So instead of splitting, the single edge line swung out
across the opening and came back after it — nothing marked the through
lanes through an exit at all, and the line appeared to wander sideways
and then vanish where the gore suppression took it. That is the *"line
turning a little invisible weirdly"* of the first photograph and the
wrong-direction arms of the second, and they were one bug.

`throughU` and `auxEdge()` in draw.js are the fix, and the old dotted
lane line is gone: it was drawn at exactly the through-lane offset, so
it *was* the missing edge line all along — it just only existed where a
lane happened to be open outside it.

### And the chevrons were reading as a dotted line

The gore hatching was a mark every 20 px down the neutral area. At this
scale a chevron is 1.6 px of diagonal, which cannot read as a chevron —
it reads as a third dotted white line between the two real ones, which
is what got circled. Removed. The neutral area keeps its darker asphalt,
which is what makes it read as a surface you are not meant to be on.

Measured after, at the nose of exit 373: every row carries exactly the
through-lane line, the ramp's left edge and the ramp's right edge. No
dots, no fourth line.

### And it stands on the ground, not on the tarmac

Second report, same session: *"that buffer thing only happens on rails —
it's not ever on the pavement like that."* Also correct. An attenuator
is a unit bolted to a pad at the **end of a barrier run**; it is never a
free-standing object out on the road. The first fix put it at the seam,
where the two sealed surfaces touch and the neutral area is zero wide by
definition — still on pavement.

So `NOSE_CLEAR = 12 px`: the nose is taken far enough along that the
neutral area is wider than the thing standing in it. In front of that
the gore is **paint**, which is all a driver meets — you may drive over
a painted gore, and what stops you afterwards is the verge.

### The four lines in the mouth of every exit

*"There are three white lines in the middle of the entrance to the exit
ramp that shouldn't be there, and the lines for the V look funny."*

The mainline's auxiliary lane does not end at the gore — it closes over
a wedge, so a tapering sliver survives a few hundred pixels past the
point where the ramp has taken the pavement. Marked as a lane, that
sliver drew a **dotted lane line and the mainline's edge line a few
pixels apart**, right where the ramp's own two lines are: four lines in
a mouth that has three, and the near arm of the gore doubled.

Past the nose that strip is not a lane and not the mainline's. The only
thing that belongs on it is the mainline's edge line tapering in, which
IS the near side of the gore. Measured at exit 374 after the fix, past
the nose: corridor edge, ramp left, ramp right — three, and a clean apex.

`test/corridor.js` asserts all of it, over every window: the cushion
stands clear of the pavement (`gap ≥ NOSE_CLEAR`), and the junction
station is still shared pavement so nothing may be put there. Either
alone could be satisfied by moving the nose nowhere.

One ramp gets no cushion: exit 211B/211A flies straight over the
mainline and never has a conventional gore inside 4,000 px. No nose is
better than one in the wrong place, and the suite reports the count
rather than failing on it.

### And the same four lines at the other end of every one

*"Well also look at the lines. They don't look right either."*

Everything above was measured at a **gore**. The merge had the identical
fault and nothing had ever asked about it, because the nose the whole
paint rule hangs off is a gore's nose and a merge had none.

`closeAux` opens the acceleration lane 150 stations — 1,200 px — before
the ramp arrives. That is deliberate and it is right: it is what makes a
merge feel like room to merge rather than a trapdoor. But for all of
that distance the freeway was painting the outer edge line of a lane
while the ramp converging on it painted its own two. Walked over 109
ramps in eight windows: **four white lines at 100% of them**, and at 70%
two of the four came within 4 px of each other and swapped sides. Real
exit 196, eight-px pieces through its merge:

```
    thru   aux   rampL  rampR
      99   108    167    187
      99   112    145    165
      99   115    126    147
      99   117    117    138   ← 0.4 px apart, and then they cross
```

So a merge gets a nose too. `mergeNoseOf` is `noseOf` walked from the
far end — same projection, same sign conventions, one shared
`partsFrom`. `auxTaken` gains its mirror clause, and the mainline stops
marking the strip upstream of it.

**The threshold is not `NOSE_CLEAR`.** That is 12 px because a crash
cushion needs ground under it, and this nose has no object on it — it is
only ever a paint boundary, and the paint on the far side of it belongs
to `noses()`, which hands the line over the moment the ramp's near edge
is outboard of the parent's. Built with the cushion's 12 px the two
disagreed across a 12 px band of separation, and inside it the mainline
had stopped suppressing while the ramp had already started painting: 93
stations with two solid lines a **median 0.8 px apart**, which is worse
than the crossing it replaced. Matching `noses()` is the fix, and the
comment on `mergeNoseOf` says so, because the two must move together.

Measured over eight windows, before and after:

| | before | after |
|---|---|---|
| aux-line stations painted | 5,590 | 4,381 |
| four lines at once | 1,083 (19.4%) | **0** |
| two lines within 4 px | 99 | **0** |
| closest any two lines come | 0.04 px | **16.4 px** |

`test/corridor.js` asserts the outcome rather than the rule: at every
station the mainline still marks, both roads' unsuppressed edges go onto
one axis and the closest pair must be at least a third of a lane apart.
That restates draw.js's suppression inside the suite on purpose — if the
drawing rule moves and this does not, they disagree and the suite says
so. It is anchored on `merge.s`, not on the merge nose, so removing the
fix makes it **fail** (248 stations) instead of skipping the ramps that
lost their nose and passing while asking nothing.

### The line you are allowed to cross, and the one that had a hole in it

*"Entrances still don't look right. The merge lane needs dotted lines,
then the ramp — the lines don't touch. Look at it yourself."*

Both correct, and they are two different things.

**The dotted line.** A freeway's right-hand boundary was drawn solid for
the whole window, auxiliary lane or no. On the road it is only solid
where the pavement stops there. Where a lane opens outside it — decel
before an exit, accel after an entrance — that boundary becomes a wide
dotted line for exactly the length of the lane, and the dotting is the
instruction: this lane is one you may move into, and it is going to
end. Solid, the game was saying the opposite of what the geometry meant,
at every junction on the corridor.

`dottedEdge` draws it, MUTCD 3 ft mark / 9 ft gap at double the width of
an ordinary lane line, on the scale `throughStripe` already fixes (10 ft
= 17 px, so a foot is 1.7 px). `edgeLine` gained an `omit` predicate so
the solid pass and the dotted pass divide one boundary between them on
the same test and neither draws over the other. The test is `auxOwn`:
the mainline has a lane of its own out there. Deliberately *not*
`auxEdge`'s test, which also stands down where the ramp is painting the
outer line — inboard of that the lane is still the mainline's and still
crossable. What the two share is `auxTaken`, which is what matters.

Measured at exit 181 eastbound, the dotted runs come out as two: s
31968–32912, the deceleration lane, ending at the gore at 32906; and s
38152–39552, the acceleration lane, starting at the merge nose at 38147.
Nothing dotted in the interior between them, which is right — that
ground is the ramp's. Read back off the rendered canvas: 18 marks of 14
px on a 57 px cycle (20.4 world px against `DOT_CYCLE` 20.5), 8 px wide
against the 4 px of a lane line, with the solid outer edge unbroken
beside it.

**The hole.** The mainline's outer line and the ramp's are one physical
line taking turns, and each is laid in 8 px pieces on its own road's
grid. Those grids do not align, so where the suppression starts is up to
8 px from where the ramp's first piece does. At exit 181 the mainline
stopped at s=32900 and the ramp began at 32906.3: a 6 px nick in the
outer line at the gore, at every junction on the road.

The pad on the parent's suppression range goes from 0 to **−1**, so the
mainline paints one piece *into* the suppressed zone at each end. There
the two lines are the same line — 121.0 against 121.0 — so the overlap
cannot be seen and the hole cannot happen. The gore now reads 121.0 at
32900 and 121.0 at 32908, continuous; the merge draws both for one piece
at 119.5.

That overlap is also why `test/corridor.js` now measures only the ramp's
**parent-facing** edge against the mainline's aux line. Its far edge is
the outer line of the whole pavement — the same line, taking turns — so
that pair reads zero apart by design, and asserting on it would fail on
the very overlap that stops the line breaking. The near edge is the one
with no business near anything, and it is the pair the merge fault was
made of, so the assertion still bites where it should.

What it does **not** fix, still outstanding and visible at the same
place: `openAux` and `closeAux` combine with `Math.max`, and the median
exit is 0.49 mi against the 1.05 they are sized for, so the decel lane's
closing wedge and the accel lane's opening taper overlap and max into an
M. Exit 181's acceleration lane runs 20.5 → 16.7 → 20.5 → 20.5 → 0, and
the edge line follows it exactly: a dent, then a cliff at 8.75 px per
100 px against the opening's 4.6. That is a geometry fault, not a paint
one, and it is next.

### The line that went out, came back, and went out again

*"The lines for the exits and entrances need to connect smoothly and
accurately."* Two things, and the second one turned out to be why the
first one happens at all.

**Smoothly.** The dent above, swept over the whole corridor rather than
looked at once: **283 of them in 64 windows**, 9% of every station of
open auxiliary lane, a median 4.1 px deep and the worst 13.5 — two
thirds of a lane pinched out of the side of the road and put back over
1,100 px, with the edge line following it exactly.

It is not a taper rate that is wrong, it is the premise. An acceleration
lane tapers away because there is nothing after it; where the next
interchange's deceleration lane starts before it has finished, the thing
actually built on the ground is **one auxiliary lane** running merge to
gore, full width, dotted on the inside. So no taper is sized against a
neighbour and no two are blended. Each is written as if it were alone,
and `settleAux` then fills the valleys between them: inside a run of
open lane every station is raised to the lower of the highest lane
behind it and the highest ahead. Rises and falls are untouched by
construction — a station on a genuine flank is already the running max
on that side — so a lane that really does open out of nothing still
opens over the full taper, and only the crossings go. The result is
unimodal per run: up, along, down, never back up.

One exception, and it is the reason this is not a smoothing pass:
`openAux` records the wedge it closes over at a gore in `auxHold`, and
the fill may not raise it. The wedge is where the pavement stops being
the freeway's and it has to reach zero whatever is downstream. Three of
the 331 dips would otherwise have erased a gore.

**Accurately.** The survey lists an interchange once per junction node,
and a diamond has two on a carriageway — where the off-ramp leaves and
where the on-ramp comes back. Taken at face value that is two exits.
Exit 373 was two structures 0.55 mi apart, both signed 373, each with
its own gore, its own merge and its own pair of tapers reaching into the
other's — which is what most of the 283 dips were made of. **225
duplicate structures in 64 windows**, and the `MIN_EXIT_LEN` thinning
never caught one of them because the closest pair on the road is 0.50 mi
apart.

`interchanges()` folds them, by number and by distance together: an exit
number is unique within a state and a state is hundreds of miles long,
so the same ref twice inside three miles is always one interchange —
measured, two nodes of one are 0.50 to 1.97 mi apart and the nearest two
genuinely different exits sharing a number are 153 mi. The pair is not
noise to be averaged away, it is the two **ends**, so the structure is
built to that span and its gore and merge land on the nodes the survey
put them at. Median 0.64 mi against the 1.05 the nominal length asks
for, which is why the nominal ran every second interchange through its
neighbour.

Measured over the corridor, before → after:

| | before | after |
|---|---|---|
| dips in an auxiliary lane | 283 | **0** |
| stations inside one | 27,235 (9.0%) | **0** |
| exit numbers built twice | 225 | **0** |
| signed exits (64 windows) | 634 | 425 |
| exit structures | 917 | 744 |

`test/corridor.js` asserts all three on the outcome: the aux profile is
unimodal per run outside the wedges, the wedge closes at every gore, and
no exit number is built twice on one carriageway. All 14 checks pass
over all 319 windows of the exhaustive pass.

#### Three things fell out of it

**The pumps were crowding out the exits.** With the spare copy of each
interchange gone, 38 eastbound and 53 westbound exits came back signed
CLOSED — behind a travel centre. The rule this file already stated is
that where a stop and an interchange want the same ground the stop
yields, and the build order said the opposite: stops went in before the
generated loop-backs and got there first. Nobody had seen it because the
interchange was being built twice and the second copy landed clear.
Reordered, and the closures fall to 16 and 18.

It costs the truck stops: **54 → 5** in 64 windows, because a travel
centre sits at an interchange and giving it its own gore and merge off
I-40 was only ever possible while the interchange next to it could be
crowded out. Rest areas are barely touched (23 → 20) — those genuinely
do stand alone between interchanges. The honest answer is to hang the
pumps off the interchange's frontage rather than off the freeway, which
is §7 item 3's territory; until then the exit wins, because the exits
are the score.

**`clearance()` was measuring the wrong half of both roads.** The gap is
`|u| − half(A) − half(B)`, and both halves were picked from `pr.u` —
which is A's centreline measured in B's frame. B's side came out back to
front and A's was inferred from B's sign, which is only right when the
two roads point the same way. It cost nothing for as long as a
carriageway was symmetric, because a road the same width either side of
its centreline returns the same number whichever half you ask for. An
auxiliary lane makes it asymmetric, and then the test measures a ramp on
the eastbound shoulder against the width of the *westbound* one. Exit
139B's surveyed ramp at mile 1194 is 3.2 px clear of the pavement beside
it and was reported as 17.2 px inside it, purely because a westbound
deceleration lane had opened across the median. Asked in each road's own
frame now, and the tightest clearance on the whole corridor is **+2.9
px** — no two roads share sealed surface anywhere.

**Six ramps were all signed EXIT 227.** The survey's ramps carry the
junction ref OSM tagged the link way with, and around a system
interchange every link in the complex gets the same one: six separate
ramps west of Greensboro, all tagged 227, all signed Danville /
Charlotte via I-85 south, spread over ten miles. Eight pairs of the 350
surveyed ramps are like this. The geometry is walked and real and it is
kept; the number comes off after the first one, and the ramp still signs
where it goes.

#### What this did not fix, and what later did

The gore's near arm was still the freeway doing all the work. Measured
over 115 junctions, the two roads are a median 25 px apart 320 px past
the gore — 4.5 m at 57 m, about four and a half degrees, which is a real
gore — but the freeway contributed the whole 20.5 px of it and the ramp
a median 4.9, and at the tenth percentile the ramp's near edge moved the
*wrong way* and the freeway opened the gore on its own. The comment on
`WEDGE` claimed the 320 px was close to the rate the ramp pulls away;
it is not, and it now says so. The total was right and the split was
wrong, and the split was a fact about the shape `stopBump` draws — §7
item 3, which subsumed it.

**§7b did most of it, 2026-08-11.** With the profile taken off the
survey and the nominal structure length halved to the surveyed median,
the ramp's own contribution over the first 640 px matches the walked
ones to within 1 px. Inside 320 px it is 6.2 against a surveyed 11.7,
and that gap is the spiral §7a put there on purpose — the surveyed
ramps' extra divergence in that stretch is a resampling artefact of the
survey's 497 ft fragments, not a road. Measured both ways in §7b.

---

## 7. Housekeeping, outstanding

- **The exits do not look like exits, and it is three faults.** Asked
  2026-08-09 (*"why do the exits and entrances look so dog shit"*).
  Nothing here is a broken invariant — the suite passed throughout —
  which is why none of it had ever surfaced. Measured, in the order
  they are worth fixing:

  1. ~~**375 exit numbers are built twice.**~~ Done — `interchanges()`
     folds the two junction nodes of an interchange into one structure
     spanning both. See §6, "The line that went out, came back, and
     went out again".
  2. ~~**`openAux`/`closeAux` combine with `Math.max`.**~~ Done —
     `settleAux` fills the valleys where two tapers cross, and the
     structures are now sized to the surveyed span rather than to a
     nominal mile. Same section.
  3. ~~**79% of exits are one shape.**~~ Done — §7b. 350 of 1,201 had
     surveyed geometry and the rest went through `buildStop`, which
     draws `stopBump`: rise, flat, fall, at one depth for every
     interchange on the road. The shape comes off the survey now, the
     ramp meets its cross road at a signalised junction, and the travel
     centres that had nowhere to stand are signed on the interchange
     that serves them.

- ~~`projects/offramp/` is untracked in git.~~ Committed.
- ~~Not in the README project table.~~ Listed, and the entry was
  rewritten 2026-08-09: it still said "mainline only so far — ramps,
  rest areas and truck stops are downloaded but not built", which had
  not been true for days.
- `.claude/launch.json` gained a `site-alt` entry (port 8913) so two
  sessions can serve the site at once.
- **Bump `?v=` in `index.html` when you change anything under `src/`.**
  `python -m http.server` sends no `Cache-Control`, so a browser
  heuristically caches both the scripts *and* `index.html` itself —
  which means a plain reload can serve the old HTML, which then asks for
  the old `?v=` scripts, and a change appears not to have worked. It
  cost real time this session: two rounds of "the guard is not firing"
  against code the page was not running. `performance.getEntriesByType
  ("resource")` with `transferSize: 0` is how you catch it.
- **A window rebuild is a synchronous freeze**, and it happens about
  every four miles of driving — roughly once a minute at top speed.
  Profiled and cut 2026-08-09, **−44%** measured A/B in one process
  (488 → 274 ms in node; in the browser the worst window went 268 → 91
  ms and a typical one is now about 30). `test/corridor.js` reports the
  worst rebuild it sees, so it stops being invisible again.

  What paid, in order of size:

  1. **`edges()` computed one station index for eight arrays** instead
     of making eight `sample()` calls that each recomputed it. `sample`
     was 31.6% of a rebuild; it is now 4%. This is the whole of the win
     — everything below is single digits.
  2. `dress()` lifting the station frame out of its probe closure, which
     was recomputing it for all four probes.
  3. `dressAll()` and `noses()` seeding their first projection from
     `junction.i` — the parent station the ramp's station zero sits on,
     which was already written down — instead of scanning all 22,477
     stations of the corridor to rediscover it.
  4. `dressAll()`'s projection window: ±12 stations → ±4. Instrumented
     across nine windows and every ramp in them, the largest gap that
     projection ever has to close is **two** stations.
  5. `angleDiff()` as one conditional wrap rather than two float
     modulos. Both arguments are always `atan2` output, so the range is
     known and the modulos were never needed.

  What did **not** pay, measured and reverted:

  - **Flat `Float64Array` centrelines** for `project()`. It is the most
    expensive function in the build and a station is an object, so the
    walk is a pointer chase — worth 1.5%, which does not pay for a
    second copy of every centreline plus a cache to invalidate. V8 keeps
    these packed and monomorphic already.
  - **Typed cross-section arrays.** Neutral; `new Array(n).fill(0)` of
    doubles is already a packed-double array. Kept anyway, because the
    fixed length is what lets `edges()` share one index.
  - **Restricting `noses()` to the ranges `dressAll()` already found.**
    The reasoning was that a station where the two edge lines have not
    parted must be a station where the two roads are near. Measured:
    139 of 18,612 are not, so this would have dropped paint
    suppression at the gore. The argument was wrong and the measurement
    is why it is not in the code.

  Every step was checked against a fingerprint of all nine sample
  windows — every station position, both sealed edges, deck, median,
  lane counts and every suppression range. The road is byte-identical
  to what it was before the pass.

- **And that pass has now given 18% of itself back**, deliberately, for
  the two geometry faults below. Measured the same way, best of three
  over the same fourteen windows in one process: **2,570 → 3,047 ms**
  total, worst window **360 → 470 ms**. Roughly half is the spiral and
  half the fold relaxation. It is a real cost against a real budget and
  it is worth it — a rebuild is once every four miles, the browser's
  typical window was about 30 ms and its worst 91, so this puts them at
  about 36 and 108, still well inside the 268 ms that made it a problem
  in the first place. If it ever needs clawing back, the diffusion is
  *not* where it is: 26 folded ramps over those windows burn 3,634
  passes between them, which is single-digit milliseconds. The cost is
  the convergence work on roads that genuinely moved.

## 7a. Why the ramps did not feel smooth

*(Ric, 2026-08-10: "also look into making the transition smoother for
exit ramps and on ramps".)*

Two faults, both found by measuring rather than by looking, and they
turned out to be unrelated to each other. Neither was a broken
invariant — the suite passed throughout, again.

### The join was continuous to look at and not to drive

`pinEnds` put a ramp's ends on the right points and pointed them the
right way, and that much was working: across **523 gores and merges the
residual heading error is a median 0.002°**. What nothing pinned was
the RATE of turn. The curvature stepped by a median 1.84e-4 /px at the
gore and 5.9e-4 at the ninetieth.

In the units the player feels, that is the whole story: the car's
heading is read straight off the road frame, so its yaw rate is the
road's curvature times its speed, and a step in curvature is a step in
lateral acceleration inside a single frame — **0.87 m/s² at the median
gore at 65 mph, 2.77 at the ninetieth, 11.38 at the worst**. Nothing
accelerates sideways that fast. It arrives as a tug on the picture.

Real roads do not do this, and the reason has a name. A ramp does not
leave a straight motorway on its final radius; it runs a transition
whose curvature grows from the mainline's to its own, and AASHTO sizes
that transition by limiting lateral jerk. The missing piece was a
spiral, so the fix was to build one: ease the ramp's curvature to its
parent's over a 40-station blend at each end.

| at the gore, 65 mph | median | p90 | p99 | worst |
|---|---|---|---|---|
| before | 0.87 | 2.77 | 3.31 | 11.38 m/s² |
| after | **0.09** | **0.22** | 0.46 | 1.37 m/s² |

Merges the same, 0.59 → 0.06 at the median. Heading error unchanged at
0.002°, which is the point — the new correction had to not cost the old
one.

**Two things went wrong on the way, and both are in the code as
comments.** The first version eased the curvature away one-sidedly,
which has a net area, which rotates everything past the blend — the
whole body of the ramp, out where it is furthest from the road — and
pinning the ends afterwards turned that rotation into a bulge. The
corridor sweep said so in one line: **clearance +2.9 px → −75.2 px** at
mile 2130, a ramp and the freeway sharing 75 px of sealed surface. The
correction has to integrate to zero, and `payback(t) = (1−t)²(1−4t)` is
the cubic that does it — full strength at the join, paid back by the
end of the blend, ramp body untouched. Clearance came back to +3.1.

The second: the spiral and the tangent correction were applied together,
added to one measurement of the road, and they fought — the spiral moves
the very segments the tangent error was read off. That cost the worst
join **1.155°**, a 24-fold regression on the thing the tangent pin
exists to guarantee. Correcting them in sequence put it back to 0.049°.
Three passes, not four; the fourth was measured and is idle.

### Eight ramps had a three-metre radius in them

Separate fault, much worse where it happens, found by the same sweep.
Peak curvature present anywhere inside each of 769 built ramps:

| tightest radius in the ramp | ramps | |
|---|---|---|
| over 800 px | 601 | 78.2% |
| 400–800 | 142 | 18.5% |
| 250–400 | 15 | 2.0% |
| 150–250 | 1 | 0.1% |
| 80–150 | 2 | 0.3% |
| **under 80 px** | **8** | **1.0%** |

A real cloverleaf loop is 45–60 m, which is 250–335 px. The worst here
is **exit 1 at 17 px — a three-metre radius**, and the distribution is
bimodal: there is a clean gap between 191 px and 250, and then a cluster
at 17, 23, 28, 30, 39, 42, 47, 60. Those are not roads.

**It is in the survey, not in the building of it.** The walked polyline
for exit 1 runs east to x=10524 and comes straight back **thirty pixels
— five metres — to the north of itself**: a 150.6° turn between two
segments about seven metres long. Seven of the eight are the same shape,
with raw turns of 153.7°, 162.8°, 156.8°, 145.7°. That is not the coarse
sampling §5 blames for the tangent problem — those fragments average
497 ft and these are 30–90 px. It is the walk going out to the cross
road and back, which is exactly what this corridor says every ramp is,
with nothing rounding the apex where the two legs meet at one node.

So the fix is not to smooth it — smoothing a fold moves it — but to say
what the apex has to be. `MIN_RAMP_R` is 150 px, the AASHTO minimum for
a 20 mph ramp (24.6 m at e=0.06, f=0.27, rounded up), and the measured
distribution leaves it unopposed: the tightest legitimate turn on the
corridor is 191 px, so nothing that is already a road is touched.

The turn is **redistributed, never discarded** — a hairpin genuinely
reverses direction and that 180° has to go somewhere. Excess above the
cap is pushed into the neighbouring stations until every station is
under it, which spreads the turn and bulges the apex outward. The U-turn
gets wider, which is honest, rather than shorter, which would leave the
ramp unable to reach its own far end.

**And it has to relax inside the pinning loop, not before it.** Relaxing
a fold moves the far end a long way, and `slide` then drags the ramp
back with a shear proportional to how far along you are — which lands
squarely on an apex at mid-length and re-tightens most of what was just
relaxed. Relaxing once before the pins took exit 1 from 17 px only to
**41**. Relaxing every pass, so the cap and the pins settle against each
other, holds it at **137**. Nothing on the corridor is under 80 px any
more and the whole former tail sits at 137–150.

One performance note worth keeping: the fold test runs on every station
of every ramp, and asking it with `atan2` cost 39% of a rebuild on its
own. It does not need an angle — between two segments the turn exceeds
the cap exactly when the cross product outruns the dot product by more
than its tangent, with an obtuse turn over the cap by inspection. That
took it to 18%, and the check latches off after the first clean look
because neither correction can bend a road past a 20 mph radius.

## 7b. Why the exits did not look like interchanges

*(Ric, 2026-08-09: "why do the exits and entrances look so dog shit".
§7 item 3 is the third and last of the three faults that answer came
back with, and it is the one the other two were said to be inside of.
Done 2026-08-11.)*

Three things, and they turned out to be one thing with three faces:
**nothing about a generated exit was measured against the exits this
corridor actually has.** The survey walked 349 of them. Every number
below is off those, and the fix in each case is to stop choosing and
start copying.

### 268 px was not a shape, it was the fifth percentile

The first measurement, taken over the whole corridor with one
instrument so the two kinds are comparable:

| | surveyed (349) | generated |
|---|---|---|
| furthest from the corridor | p05 **266**, p50 **497**, p95 **1,041** px | 264–271, p50 **268** |
| length spent within 10% of that | p50 **17.7%** | **57.8%** |

Read the first row twice. Every generated exit on this road was built
at the **fifth percentile of the real distribution** — half the real
interchanges are more than twice as deep as any of ours, and the
deepest is 1,733 px against our 271. The second row is the flat top:
`stopBump` holds a dead-flat plateau for 44% of its length and the
smoothing either side of it takes that to 58%, which is a truck stop's
parking apron and not a ramp. A real ramp has an **apex** — a terminal,
the junction with the cross road — and it spends a sixth of its length
near it.

**How deep a ramp goes correlates with nothing this map knows.**
Against the surveyed span between an interchange's two junction nodes
r = 0.02; against the corridor's width there 0.01; against the ramp's
own walked length 0.15. That is the honest answer rather than a
regression nobody found: how far out a ramp reaches is set by where the
cross road happens to be, and the survey maps ramps, not streets. So it
is **drawn** — `RAMP_REACH` is the measured distribution as its own
inverse CDF, hashed off the interchange's position and carriageway so a
given exit is the same depth every time you drive it, the property
`hashBlock` already gives the cable barrier. (It is very close to
lognormal, median 521 px and σ 0.442, quantiles agreeing within 6%. The
table is kept anyway: there is no reason to prefer two fitted constants
over the measurement they were fitted to.)

The shape is measured the same way. `RAMP_PROFILE` is the median
lateral profile of all 349, resampled to 41 points and normalised so
the apex is 1. Two things fall out of it rather than being aimed at:
the curve spends **17.1%** of its length within a tenth of its apex
against the 17.7% measured directly on the ramps, and its peak is at
**t = 0.475, not 0.5** — a ramp gets away from the freeway slightly
faster than it comes back, which is a deceleration lane and an
acceleration lane, so the asymmetry is real and is kept driver-forwards
on both carriageways.

**And the nominal length was twice the real one.** `EXIT_LEN` was
1.05 mi. Where the survey gives both junction nodes the span between
them is p05 2,723 px, p50 **4,883**, p95 6,652 — so every structure
that fell back on the nominal was a mile of interchange standing where
half a mile of one belongs. It is not only a length, because the
profile is walked as a fraction of it: a structure twice as long
diverges half as fast, and the near arm of every one of those gores
came out at a third of the measured rate for that reason alone.

Result, over the whole corridor, against the surveyed ramps measured in
the same pass:

| | surveyed | before | after |
|---|---|---|---|
| reach p25 / p50 / p75 | 377 / 496 / 705 px | 267 / 268 / 269 | **394 / 512 / 715** |
| length spent at the terminal | 17.2% | 57.8% | **19.4%** |

### The table is a curve and reading it as a polyline cost 599 ms

Linear interpolation between the samples was the first version, and a
straight line between two samples of a curve is a kink. The kinks are
not small: 41 samples across a 3,392 px structure 1,255 px deep put a
**17° turn into one 8 px station** at the apex, which is a
three-metre radius. `relaxTurns` — §7a's fold cap, built to catch the
eight surveyed hairpins on the entire corridor — then found one in **54
ramps of 73** and spent **599 ms of a 962 ms window rebuild** diffusing
them back out, bulging every apex outward while it did, which is why
the built reach came out above the distribution it was drawn from.

Catmull–Rom through the same samples. Four multiplies instead of two,
through every measured point, first derivative continuous: no kink to
find and nothing to relax. **962 → 294 ms** on the same window.

### A long interchange holds its terminal; it does not sag

The surveyed spans run to 1.97 mi. Stretched over 10,384 px, exit 235's
return leg came back to within 18.8 px of the freeway's sealed edge and
ran beside it — the corridor's tightest clearance went from +2.9 px to
**−6.1**, two paved shoulders overlapping by six.

That is the wrong emulation of a long interchange. A mile-long one does
not have gentler ramps, it has a longer **connector** out at the cross
road. So the profile is walked at its own scale — `PROF_SPAN`, the
surveyed p75 — and the apex is held for whatever is left over. Three
structures in four are shorter than that and get the table exactly as
measured; the 5% that are longer get a flat part that is a real
connector rather than the middle of every exit on the road. Tightest
clearance on the whole corridor: **+3.1 px**, which is better than the
+2.9 this file has been quoting since `clearance()` was fixed.

### The gore's near arm, which §7 item 3 said this would subsume

It did, most of the way. §6 recorded that the two roads are a median
25 px apart 320 px past the gore and that the freeway contributed all
20.5 px of it while the ramp contributed 4.9. Measured properly, in px
rather than in fractions, over 348 surveyed ramps and against the same
number of generated ones:

| px past the gore | 160 | 240 | 320 | 480 | 640 | 960 |
|---|---|---|---|---|---|---|
| surveyed | 3.3 | 7.6 | **11.7** | 29.4 | 47.4 | 93.3 |
| before | −0.5 | 0.6 | **5.1** | 21.8 | 44.4 | 97.7 |
| after | −0.1 | 1.5 | **6.2** | 23.8 | 46.8 | 100.8 |

Right from about 500 px on, and short inside that. **The residual is
the spiral, and the spiral is correct.** Two measurements say so. A
real ramp's near arm is a pure arc from station zero — u(640)/u(320) is
**4.05** against the 4.00 an s² curve gives, which is a constant radius
of about 4,360 px and admits no transition curve at all. And the
curvature of the surveyed ramps over their first 80 px spikes to
R = 1,360–2,000 and then falls away again, which is not a road, it is
the survey's 497 ft fragments resampled to 8 px. §7a spent a lot to put
a transition where a transition belongs and took the lateral step at
the median gore from 0.87 to 0.09 m/s²; matching an artefact of the
survey's resolution would give it straight back. Left as it is, with
the number printed.

### The cross road had no junction on it

`buildCross` has drawn a street over every interchange since it went
in, and the ramp has driven straight across it. Measured over 231
streets and 450 ramps: **447 of the pairs met at grade, a median 4.2 px
apart, and not one of them had a junction**. Two roads on the same
tarmac with no stop line, no break in anybody's markings and nothing on
the street to say a road joins here — which is why an exit read as a
bulge with a bridge near it.

`World.terminal` measures the meeting and then makes it one. It walks
the ramp, finds where it crosses the street's centreline, and from that
one measurement: the paint stops on **both** roads across the mouth,
the ramp's guardrail stands down, and the signal — which has been here
since the cross roads arrived — finally has something under it. The
paint gap is checked inside `seg`, which is the single funnel every
piece of marking in draw.js goes through, so there is no marking that
can be forgotten and no second copy of the rule to drift.

Two refusals, and both are real rather than defensive. A ramp that
passes **over** the street is a flyover and has no junction under it —
20 of the surveyed complexes on this corridor are — and a ramp that
never reaches the centreline has not met it. The ones that miss do not
miss by a little: p50 is 2.0 px and the failures are hundreds out.

**And a bug the measurement immediately found.** The streets were
grouped by "any exit within 0.3 mi of one already built is the same
interchange" — but half a mile is also the closest two genuinely
different exits stand on this road, so neighbours were quietly sharing
a street. The neighbour's ramp then met it **2,094 px from its own
terminal, 145 px off the pavement, while it was still up on the bridge
deck**: sixteen exits in a 64-mile sweep. Grouped by the terminals now,
which is what a cross road is positioned by, and squared on the
generated members because those are the ones this map chooses the shape
of. Result: every generated exit on the corridor has a terminal, at
grade, a median 0.85° off square, at 99.4% of its own apex depth or
better; no street is left with nothing on it; and the street is built
long enough — `2 × (reach + 900)` rather than a flat 3,200 px — that
the junction is not at the very tip of it.

### The travel centres got an address

Sizing the stops against the exits was right and it had a price this
file recorded and then left: **227 surveyed stop sites wanted to exist
and 69 were built.** The other 158 were not moved or shrunk, they were
dropped.

That is the wrong answer for a truck stop, and it is wrong in a way
that is obvious once said. A travel centre is not a thing off the
freeway, it is a thing **off the interchange** — the Petro at exit 407
is on the frontage road and you reach it by taking exit 407, which is
why it never needed a gore of its own. So where the ground is an
interchange's, the stop becomes that interchange's, and the blue panel
under the green guide sign says so, which is where a real one is
advertised.

A rest area is deliberately not treated the same. It stands between
interchanges by definition, so one whose ground an exit has taken is a
rest area this corridor does not have, and moving it to the exit would
be inventing one. Counted, not moved.

| over all 160 windows | before | after |
|---|---|---|
| surveyed stop sites | 234 | 234 |
| built with their own gore | 69 | **76** |
| signed on the interchange that serves them | — | **146** |
| dropped entirely | 158 | **1** |
| rest areas crowded out | — | 11 |

### One thing broke on the way, and it was a shared constant

`buildLeftExit` read `EXIT_LEN`. Resizing that to the surveyed median
halved the I-40/I-75 wye with it — and everything else in that builder
is counted in **stations**, so `WYE_GRADE`, `WYE_FLAT_OUT` and
`WYE_FLAT_IN` no longer covered the crossing and exit 368 went over the
eastbound carriageway 110 px at grade. The corridor sweep caught it at
mile 2050. A wye is not a diamond and has no business sharing a number
with one; it has its own length now.

### What this does not do

- **The near arm inside the spiral's own 320 px**: 6.2 px against a
  surveyed 11.7, for the reason above. Printed in the suite rather than
  smoothed over.
- **Eleven rest areas** still lose their ground to an interchange, and
  one travel centre of 234 finds nothing within three quarters of a
  mile to hang off.
- **The pumps are signed, not drawn.** A travel centre attached to an
  interchange gets its name on the blue panel and nothing on the
  ground. The frontage it would stand on is the ramp's apex and the
  buildings are not built.
- **Surveyed ramps are not squared up** and should not be: their
  terminals run to 60° off square, which is what walked geometry does.
  The assertion is on the generated ones.

`test/corridor.js` gained five checks for all of it — the reach
distribution against the surveyed one at three quartiles, the apex
fraction, a junction on every exit and every street, the skew, and that
no surveyed stop is silently dropped. **19 checks, 160 windows, 1,888
ramps, all passing.**

## 7c. A car resting against the barrier was grinding it

*(Ric, 2026-08-11: "if touching the rail and not moving there should be
no shake and sparks.")*

Right, and it is what a grind IS. The shake, the sparks and the metal
shriek are friction work; friction does no work at a standstill. All
three were gated on **contact** rather than on the rub, so a car stopped
against the median sat there shuddering, throwing sparks and screaming
for as long as you held the wheel into it. The drag was the only part
that was already honest — it is a rate on speed, so it goes to zero on
its own.

One number, `grindRate()`, and three call sites take it: the player's
`scrapeWall`, the wreck sliding down the same wall, and the fence at the
far side of the field. It is deliberately **not** the car's forward
speed. A wreck can be stationary and still spinning, and a corner of it
against the wall is moving at ω·r whatever the middle is doing — so the
rub is the sum of both terms in km/h, and the player and the wreck
cannot end up with different answers to the same question.

Faded rather than switched, and **DECIDED** at 12 km/h: nothing at rest,
everything by a slow crawl, which puts the whole fade inside the range
where a car is being nudged into a barrier rather than driven along one.
Measured against the median at mile 1154, holding the car on the face
for half a second at each speed:

| rub | in contact | peak shake | sparks |
|---|---|---|---|
| 0 km/h | yes | **0** | **0** |
| 3 | yes | 0.37 | 0 |
| 12 | yes | 1.49 | 4 |
| 60 | yes | 1.50 | 13 |

The audio takes the same gate and one thing more: below a twentieth of
the grind the band hands back to ordinary road noise rather than sitting
on the shriek's filter with the gain turned down, because what you hear
at a standstill should be the road and not a quiet scream.

Not reproduced: a **wreck** at rest against the wall. The gate there is
the same call and can only ever reduce what was drawn, but no scripted
crash in this session came to rest in contact, so that half is reasoned
rather than measured.

---

## 8. Order of work

1. ~~Commit current state~~
2. ~~Phase 1 — corridor model, drivable bare road~~
3. ~~Phase 3 invariants~~ (before features, so features are checked as built)
4. ~~Phase 2 — feature builders, one at a time, each with a test~~
5. ~~Phase 4 — real Knoxville geography~~
6. Phase 5 — traffic, signals, scoring ← **here**
   - ~~5b, the counted data~~ · ~~5c design~~ · ~~5c population half~~
   - ~~5c the headless harness~~ — `src/sim.js`, and the scoreboard it
     prints is what the motive half has to move
   - ~~5c car into car~~ — delayed, glancing, limited-sight perception,
     and `impact.js`'s fifth case. Free-flowing road right; queue right
     in shape and wrong in rate; blind spot built and off
   - ~~5c the motive half, mainline~~ — `src/motive.js`: `blocked`,
     `keep right`, `yield` (both halves), `avoid`. Lorry share median
     2.8% against a measured 1.2% (MOBIL 6.6%, ranges disjoint); lorries
     52.4% in the shelter lane against a measured 48.1%; gradient 7.6
     against 15, printed as the gap it is
   - ~~the harness knows where the junctions are~~ — positions only.
     Enough for `yield`'s merge half and for `exit`
   - ~~`exit`, and vehicles that really leave~~ — a third of the traffic
     goes over six km; 86% of those who try get off; rate 0.27 -> 0.46
   - ~~the ramps got smooth enough to drive~~ — §7a, and it is geometry
     rather than traffic, done because it was asked for: a spiral at
     every join (lateral step at the gore 0.87 → 0.09 m/s² at the
     median) and a 20 mph floor on the turning radius (nothing under
     R=80 px any more; exit 1 was 17). Costs 18% of a window rebuild
   - ~~the ON-ramp side~~ — §5e. Vehicles join at the junctions off a
     250 m acceleration lane, through the gap acceptance `room` already
     had. At 1,200 veh/h/lane with exits on the road stops thinning:
     803 → 961 veh/h/lane, in-against-out 0.947, nothing driven
     through. Off by default, because every reference number in the
     harness was measured on a road with no ramps
   - ~~and the merge data that is not there~~ — §5d. BEHAVIOUR.md says
     merging gap acceptance is derivable from the drone footage. It is
     not: the auxiliary lane holds **four vehicles in the whole set**
     and none at all in the free-flow one
   - ~~`keepRight`~~ — §5f. Three levers measured, none kept, and §5e's
     34% corrected to 31.6% once `exit` is taken out of it. The habit
     curve is not the lever; a discipline gate buys car shares with the
     gradient and the change rate; the best-looking fix was one seed's
     luck and died on three
   - ~~make the lane question decidable~~ — §5g. `laneMix` seeds the
     boundary at the measured shares, which kills the transient (6 km
     and 30 km now agree) and turns the run into a fixed-point test;
     the suite reports three seeds with a ±. Cars are decidable at 47:1,
     lorries are not at 3:1 and it says so. Both §5f rejections re-run
     and confirmed with error bars
   - ~~the exits look like exits~~ — §7b, and geometry again rather
     than traffic, done because §7 item 3 had been the outstanding one
     since the "dog shit" report. The generated shape comes off the 349
     surveyed ramps: reach p25/p50/p75 394/512/715 px against a surveyed
     377/496/705 where it used to be 268 for every exit on the road, and
     19.4% of the length at the terminal against 57.8%. The ramp now
     meets its cross road at a signalised junction with the paint broken
     on both roads, and the 146 travel centres that had nowhere to stand
     are signed on the interchange that serves them. Costs nothing: the
     worst window rebuild is unchanged and clearance improved to +3.1 px
   - ~~cars on the screen~~ — §5h, and it is wiring rather than model:
     `Sim.world()` is the harness with the loop taken out of it, a band
     of road travels with the player at the flux the corridor's density
     implies, `src/cars.js` puts it on the real geometry and `draw.js`
     draws it. A parked band reproduces the standing harness to 98% and
     holds 82–102% at every speed a player can drive at; a window
     rebuild moves nobody by 0.000 px; the player is a body in the same
     index, so a car stopped in lane 2 stops lane 2 and the crash comes
     back through `impact.js`'s fifth case. Costs 0.18 ms a frame. Every
     scoreboard number is untouched, held to an eleven-configuration
     fingerprint of the whole stat object rather than to the suite's
     tolerances
   - ~~a menu, a garage and points~~ — §5i, and asked for rather than
     sequenced, like §7a and §7b were. `data/garage.js` is ten vehicles
     derived from published figures (worst 0–60 error 0.045% at 60 fps,
     and the implied launch g lands in the right band for four
     different drivetrains without being aimed there); `src/score.js`
     is one pot multiplied by traffic × night × pace, banked every
     tenth exit and lost on a wreck; `src/progress.js` is the ledger,
     with a save code because a static site has no accounts. Braking
     distances roughly TRIPLED, which is what §2 wanted a queue to be
     worth. Costs nothing measured: sim is 97/2, the baseline to the
     test. Gap: eight of the ten vehicles are confirmed headless but
     not yet in the running game
   - ~~the menu, the points and the ledger~~ — §9. `score.js` is one
     pot multiplied by traffic, night and a pace term measured against
     YOUR car's top speed; `progress.js` is a threshold ledger with a
     save code, because a static site has nowhere to put an account.
     Banked every tenth exit, lost on a wreck. Two bugs fell out of
     building it: the left shoulder was being reported as lane 1, so
     traffic drove into a car that was not on the road (lane 1 now runs
     2.7× faster past a shoulder), and there is an overtake tally on
     the wreck panel. sim unchanged at 97/2
   - **next: the missing mechanism — a reason to STAY LEFT.** Nothing
     tried moves the gradient toward the measured 15, because the
     model's gradient comes from keep-right pressure rather than from
     drivers sorting by speed. A driver faster than the traffic knows
     they will be blocked again shortly; nothing in the model knows
     that. Build it, and judge it on §5g's table. Lorry statistics need
     more road-hours before they can referee anything either way.
     Then `merge`'s remaining half, the on-ramp jam, `lane drop` and the
     blind spot — the last three are now also what the CARS need, since
     the band is mainline only and nobody is on a ramp. Then signals,
     then scoring

---

## 9. The menu, the points, and two bugs the menu found

*(Ric, 2026-08-12, over several messages. The garage is §8's entry above;
this is everything that had to exist around it.)*

### The score is one pot, and the multipliers are the danger

`src/score.js`, and it replaces the placeholder whose own comment asked
for it — "score currently comes from distance and from taking exits —
see PLAN.md §2 for where it should come from once there is a corridor to
score."

    earn rate = (distance + exits) · traffic · night · pace

Nothing is a bonus you collect; every term multiplies every other, which
is why the top of the range is worth chasing. **×15 at the peak**,
against a Sunday-morning cruise's ×1. Realised over a two-minute run it
is nearer **×10**, because `pace` spends its first ninety seconds
climbing — both figures are asserted separately in `test/score.test.js`
§2 so that nobody later closes the gap thinking it is a bug.

The terms fight each other and that is the good part. `traffic` rises
with the density around you; `pace` rises with the speed you can hold;
heavy traffic is exactly where you cannot hold speed. So the maximum is
not "pick the busiest hour" or "go fast on an empty road", it is thread
fast traffic at speed. Nobody designed that — it falls out of
multiplying rather than adding, which is the reason they multiply.

**The pace threshold is a fraction of YOUR CAR's top speed**, and it is
the one decision here that is not obvious. An absolute bar — "above 130
mph" — and the Jetta at 120 could never earn it while the built 911
collects it at a canter; the whole garage below the Corvette becomes a
strictly worse choice and the ladder collapses. As a fraction, 100 mph
in the Jetta pays what 165 pays in the Porsche, and it is more
frightening, because the Jetta is at 83% of everything it has. Measured:
at 100 mph the Jetta earns the full ×4 and the 911 earns ×1.

### Banking, at every tenth exit

*(Ric: "maybe its like every 10 exits are a checkpoint ... if you wreck
before the 40th exit you get the rewards for the first 30.")*

Better than the every-exit version that was proposed, and for a reason
worth recording: this corridor has an interchange every 1,420 m, so ten
of them is about nine miles of committed driving rather than a chance to
lose your nerve at each ramp. `test/score.test.js` §4 drives thirty-nine
exits and wrecks: three checkpoints at 10, 20 and 30, and what is banked
is precisely the first thirty exits' worth **to the point**.

Leaving from a pause costs the pot too, and that is deliberate rather
than harsh — if quitting banked it, the optimal play would be to build a
×15 and immediately quit, and every decision the scheme exists to create
is replaced by that one.

### Progress is a threshold, never a purchase

`src/progress.js`. `total` is every point ever banked and only rises; a
vehicle is available when the total passes its cost and nothing is
deducted. Chosen over a spendable currency because a spend cannot
produce "owns the Corvette, cannot afford the Civic", and because the
thing being built is a progression rather than a series of decisions
about what to skip.

**It is deliberately not `skill.js`.** That was the first idea and it is
wrong: skill is a rolling hundred-kilometre window, so it falls as well
as rises, and its own header says the 35% ceiling exists so it "cannot
quietly become what the game is about". Unlocks off E would make it
visible, make it the point, and take a car away for one bad night.

**There are no accounts and there cannot be** — static site, no server,
so progress is per browser and dies with site data. The version a static
site *can* do is a save code, and `exportCode`/`importCode` are here now
rather than later because the shape of the state is what makes them
possible and that shape is hard to change afterwards. Checksummed, so a
code that lost a character in a chat window is refused rather than
silently importing as a fresh ledger.

`unlock` typed into the same box opens the whole garage. It grants the
total rather than setting a flag, so there is exactly one thing in the
file that decides availability and no second path a real save could
disagree with.

### The left shoulder was lane 1, and that was one clamp

*(Ric: "you also apparently cant drive on the left shoulder and pass
someone. you will crash into the car.")*

He was right. `laneAt` in cars.js returned `max(1, min(n, ...))`, so a
player out on the shoulder — whose true fractional lane is BELOW 1 —
arrived at the sim as exactly 1.0. `index()` files a body into every
lane its WIDTH overlaps, and a body at exactly 1.0 overlaps lane 1
squarely, so lane 1 read a car that was not on the carriageway as an
obstruction in its lane and drove into it.

Unclamped, `index()` needed no change of its own — the width test
already resolves every case. `pilot()` in sim.js stopped clamping too,
keeping only a range on `from`/`to` because those are array indices;
bucket 0 exists, is never iterated, and is exactly the right home for a
body beside the road rather than on it.

Measured over 2,500 ticks at 1,585 veh/h/lane, lane 1's speed behind the
player and the contacts it produced:

| player's lane | lane 1 behind | contacts |
|---|---|---|
| 1.00, squarely in it | 10.6 m/s | 2,298 |
| 0.85, inside the conflict width | 10.6 m/s | 48 |
| 0.40, outside it | 29.9 m/s | **0** |
| −0.50, on the shoulder | 28.7 m/s | **0** |

**Lane 1 now runs 2.7× faster past a shoulder than past an obstruction.**
The boundary between the middle two rows is not a tuned number: `ahead()`
treats a body as BESIDE rather than in front once centre-to-centre
exceeds the two half-widths, which for two 1.9 m bodies in a 3.7 m lane
is 0.51 of a lane. Both sides of that predicted boundary were measured
and both landed where the arithmetic said.

Costs nothing: sim is **97 passed, 2 failed**, the same two on-ramp
assertions at the same `conserved` 0.799 as the baseline.

### And they DO stop for you — that part was already true

*(Ric: "the cars should slow down and stop if there is a car in front of
them including me. they need to treat me like everyone else.")*

Checked before changing anything, and `cars.test.js` already pinned it:
a car stopped in lane 2 pools **216 vehicles in the 300 m behind doing
1.6 m/s against 25 in the 600 m ahead doing 25.1** — a ratio of 0.064 —
"and nothing was told it was the player". Ordinary car-following reading
an ordinary obstruction. What was actually broken was the shoulder case
above, where they treated you as being in a lane you were not in.

### Cars passed

*(Ric: "cars past should be a counter for a run thats showed on death.")*

Vehicles **overtaken**, on your own carriageway only, on the wreck
panel. The oncoming side is excluded on purpose: on a divided highway
you pass a thousand of those without doing anything, and a counter that
climbs while you sit still is not a counter about you. Counted as a
transition — genuinely ahead, then genuinely behind, nose to nose so a
lorry is not passed when its cab is level and thirteen metres of trailer
are not. Measured: 25 s at 123 mph through the stream is **29**; 25 s
parked while everybody overtakes you is **0**.

### Every button on a panel was being swallowed by the road

*(Ric, 2026-08-12: "leave the road button doesnt work when you hit
pause.")*

The panels sit INSIDE `#frame`, and the frame's `pointerdown` handler
treats a press anywhere in it as "get driving" — start the run on the
title, restart on a wreck, resume on a pause. `pointerdown` fires before
`click`, so pressing a button on a panel dismissed the panel first and
the click then arrived at nothing.

It was never only that button. The same handler was eating the three
tabs and the garage arrows (both of which started the run instead) and
BACK TO THE GARAGE (which restarted instead of returning). Stopping
propagation on each control is the fix you have to remember every time
you add one, so the test lives in the handler instead: anything matching
`button, input, select, textarea, label, a` is not the road, and the
road is what that handler is for.

**Worth recording how this got shipped.** It was "verified" by calling
`.click()` from a probe, which dispatches a click and no pointer events
at all — so the test exercised a path no mouse can take and passed while
every real press failed. A synthetic click is not a click. Re-checked
with real `left_click` at real coordinates: the pause button returns to
the menu and forfeits the pot, the tabs switch without starting a run,
and the garage arrow changes vehicle without starting one.


### What this does not do

- The day and hour are still ungated. Ric wants them unlockable
  eventually; the mechanism is a threshold on the same total and the
  place for it is `progress.js`, but nothing is gated yet.
- Eight of the ten vehicles are confirmed headless but have not been
  driven in the running game. The two that have — the Jetta's 60–0 at
  3.1 s against a derived 3.07, and the bike's two-second pull at 56.3
  km/h against a predicted 56.4 — are the two extremes of the table, so
  the wiring is confirmed at both ends rather than in the middle.
- The semi is still not built. See the note at the foot of
  `data/garage.js` for what it costs.

7. Extend the corridor; add a second one (Cincinnati = I-71/I-74/I-75)
