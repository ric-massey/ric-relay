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
| Ramp builders `makeRamp` / `makeLink` | `road.js` | keep — these build the loop-backs |
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

**Still to do**, all in `world.js`:



- `CITIES` — 20 fictional metros (L288)
- `ROUTES` — 16 fictional corridors (L315)
- `RING`, `BELT_R`, beltways, the perimeter loop (L334)
- `buildRegionalMap()` and its seat-offset / waypoint machinery (L349)
- `ellipse()` (L495)
- `crossings()` — spatial-hash crossing detection (L511)
- `plantInterchange()` (L584)
- `planDiamonds()` / `plantDiamond()` — the cloverleaf-quadrant
  workaround (L735, L744)
- `flyover()` / `flyoverSpan()` — **no longer needed if nothing crosses
  over the mainline** (L1100, L1127)

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

## 7. Housekeeping, outstanding

- **`projects/offramp/` is untracked in git.** No baseline, no undo, and
  another session has been editing the same folder. This should be
  committed before the rebuild starts, because the rebuild deletes ~450
  lines.
- **Not in the README project table.** Every other project in
  `projects/` is listed; this one is not.
- `.claude/launch.json` gained a `site-alt` entry (port 8913) so two
  sessions can serve the site at once.

---

## 8. Order of work

1. Commit current state ← **do this first**
2. Phase 1 — corridor model, drivable bare road
3. Phase 3 invariants (before features, so features are checked as built)
4. Phase 2 — feature builders, one at a time, each with a test
5. Phase 4 — real Knoxville geography
6. Phase 5 — traffic, signals, scoring
7. Extend the corridor; add a second one (Cincinnati = I-71/I-74/I-75)
