# How the cars behave, and where each number came from

Written 2026-08-09, alongside the data pull. Everything here is either
**measured** off published vehicle trajectories — in which case it is in
`behaviour.json` and the script that derived it is named — or **cited**
from a field study, in which case there is no dataset and the citation
is the whole of the evidence. Nothing in this file is a number somebody
felt was about right.

The distinction matters because the game is going to be judged on
whether the traffic feels real, and the honest position is that about
four fifths of it can be measured and the rest cannot.

---

## 1. The three sources, and why there are three

Traffic behaviour is not one thing. A driver on empty rural I-40 at
three in the morning and a driver in the Nashville evening peak are
running different programmes, and no single dataset covers both. So:

| Source | What it is | Mean speed | Stands for |
|---|---|---|---|
| **TGSIM I-294 L2** | drone video, 2024, 10 Hz | 62 mph cars, 56 trucks | free-flowing — about 2,300 of I-40's 2,551 miles |
| **TGSIM I-294 L1** | drone video, 2024, 10 Hz | 44 mph cars (median) | busy but moving — the approach to a city |
| **NGSIM I-80 / US-101** | camera mast, 2005, 10 Hz | 12–21 mph | jammed — Nashville, Memphis and Raleigh at five |

TGSIM is the important one and it is new. Until it was published there
was no public trajectory set of a freeway running at freeway speed —
NGSIM was filmed deliberately during the peak, which is why every
microsimulation calibrated on it is really a model of congestion. For a
road that is empty desert for a thousand miles that would have been the
wrong evidence entirely.

All three are USDOT releases on `data.transportation.gov`, fetched by
`fetch_traj.py` (TGSIM, downloaded whole) and `ngsim.py` (NGSIM, asked
for as server-side histograms — it is 9.4 million rows and every
question of it is "how often does this value occur", so downloading it
would have been silly).

---

## 2. Measured: what a car does

All figures below are from `behaviour.json`. SI throughout — TGSIM
publishes metres and m/s, NGSIM feet and ft/s, and the conversion is
done once in the derivation.

### Speed, free-flowing (I-294 L2)

| | p5 | p15 | median | p85 | p95 |
|---|---|---|---|---|---|
| cars | 48 mph | 53 | **62** | 71 | 75 |
| lorries | 46 mph | 49 | **57** | 63 | 67 |

Two things fall straight out of that and both matter for the game.
Lorries run about **5 mph slower** than cars at the same place and time,
and the spread within a class is **±10 mph at the 15th–85th percentile**
— so a traffic model where every car does the same speed is wrong in a
way that will be visible immediately.

### Following distance, free-flowing (I-294 L2, 114,781 pairs)

| | p5 | p15 | median | p85 | p95 |
|---|---|---|---|---|---|
| gap, bumper to bumper | 12.9 m | 18.9 | **40.5 m** | 99 | 159 |
| time headway | 0.49 s | 0.71 | **1.50 s** | 3.57 | 5.83 |

A median of **1.5 seconds** at 62 mph, and a fifteenth percentile of
0.71 s — a seventh of the traffic is inside three quarters of a second
of the vehicle in front. That is the number that makes a freeway feel
like a freeway, and it is much tighter than a rule-of-thumb two seconds.

Congested, from NGSIM, the same measurement per class:

| I-80, jammed | p5 | median | p95 |
|---|---|---|---|
| cars | 1.41 s | **2.94 s** | 8.83 |
| lorries | 1.83 s | **4.28 s** | 12.48 |
| space gap, cars | 7.0 m | **14.4 m** | 35.4 |

Note the direction: time headway goes **up** in congestion while space
gap goes **down**, which is what a speed–density relationship is. A
model that uses one fixed following distance cannot produce that.

### Lane discipline (I-294 L2, four lanes, lane 2 leftmost)

Share of each class's vehicle-seconds spent in each lane:

| lane | 2 (left) | 3 | 4 | 5 (right) |
|---|---|---|---|---|
| cars | 31.7% | 24.3% | 19.2% | 24.8% |
| lorries | **1.2%** | 26.1% | 48.1% | 24.7% |
| median speed, cars | 69 mph | 64 | 58 | 54 |

Lorries essentially do not use the left lane — 1.2%, and I-294 has no
lane restriction. That is voluntary, and it is one of the strongest
signals in the whole dataset. The **15 mph gradient from left lane to
right** is the other: the lanes are not interchangeable and a car
choosing one is choosing a speed.

Same picture congested (NGSIM I-80, lane 1 is an HOV lane, hence the
motorcycles): lorries take 52% of lane 3 and 3% of lane 2.

### Changing lanes (I-294 L2 free-flowing, I-294 L1 busy)

| | free-flowing | busy |
|---|---|---|
| rate, cars | **0.37 per vehicle-km** | 0.25 |
| rate, lorries | 0.32 per vehicle-km | 0.12 |
| duration, median | **4.24 s** | 5.74 s |
| duration, p15–p85 | 2.9 – 5.6 s | 3.7 – 7.9 s |

0.37 per vehicle-km is roughly **one lane change every 1.7 miles per
car**, and it is *higher* in free flow than in congestion, which is the
opposite of the intuition — when there is room, people use it.

Measuring the duration was the one genuinely hard thing in this pull and
two attempts were wrong before the third. Lateral position in the raw
data is in the drone flight's own frame and I-294 curves through it, so
a vehicle holding its lane perfectly still shows a lateral velocity over
0.6 m/s; anything thresholded on that returns the whole time the vehicle
was on screen. The working method builds each lane's **centreline** per
flight, expresses the vehicle's lateral position as progress from the old
lane's centre to the new one's, and takes the monotonic stretch through
the halfway point. `_manoeuvre` in `behaviour.py` does it, and the
comment there says why.

### Acceleration — and a warning

Both datasets **clamp** acceleration: TGSIM at ±5 m/s², NGSIM at
±3.414 m/s² (11.2 ft/s² exactly, which is a give-away). The 1st and 99th
percentiles sit exactly on those clamps, so **they are the clamp, not
the drivers**. What is usable is the middle: I-294 L1, unclamped,
gives p5 −1.1 and p95 +1.0 m/s² for cars, and −1.16 / +1.07 for lorries
— ordinary driving is inside **±1.1 m/s²**, about a tenth of gravity.

### Vehicle length

Cars, median 6.0 m. Lorries, median 20.0 m (both datasets round to that,
so treat it as "a tractor-trailer", not a measurement). Fifth percentile
lorry 9.8 m, which is a rigid box van.

---

## 2b. Measured, on I-40 itself: what speed people actually drive

Added 2026-08-09. Everything in §2 is another motorway standing in for
this one. This section is not — it is I-40, from the counters that are
bolted into it.

Tennessee DOT publishes, per permanent counter, per day, an hour x
speed-bin table. `tcds.py` pulls it and `speeds.py` turns it into
`observed.json`. **4.45 million vehicles across five counters**, 60 days
sampled at each, weekday and weekend kept apart.

| counter | corridor mile | posted | p15 | p50 | p85 | p95 | over the limit |
|---|---|---|---|---|---|---|---|
| 78 | 1772 | 70 | 70.6 | **78.1** | 86.2 | 92.1 | 87% |
| 39 | 1815 | 70 | 56.6 | **65.9** | 76.3 | 82.8 | 34% |
| 70 | 1875 | 70 | 65.4 | **72.5** | 79.4 | 83.9 | 65% |
| 80 | 2120 | 55? | 65.5 | 72.9 | 79.7 | 84.0 | 98% |
| 82 | 2121 | 55? | 64.0 | 72.4 | 81.8 | 87.5 | 96% |

Four things, and the fourth is a bug in our own data.

**The limit is a floor, not a target.** Pooled over a weekday the median
is **+3 mph over a posted 70** and the 85th percentile is **+12**. About
**63%** of daytime traffic is over the sign. A game where the AI traffic
obeys the limit is not a simulation of this road.

**Night is slower, not faster.** The intuition is that an empty road at
three in the morning is where people open it up. Measured, it is the
opposite — the median at 02:00 is 69.2 and at 15:00 it is 73.4, and the
85th percentile moves the same way, 79.5 against 82.8. **The fastest
hour of the week is the morning peak**, 07:00, p50 73.8 and p85 83.7.

Ric's explanation, and it is the right one: **the night traffic is
long-distance traffic and it is on cruise control.** A driver who has
set 72 and is eight hours into a haul is not the same animal as a driver
running errands at four in the afternoon, and cruise control does the
one thing that shows up here — it removes the top of the distribution
without touching the middle. The mix data (§2c) corroborates it
independently: at two in the morning this road is more than half
articulated lorries, which are the vehicles most likely to be on cruise
and are governed besides. Two datasets pulled for different reasons, and
one explanation covers both.

**For the game that means the night is not just quieter, it is
tighter.** Cruise-controlled traffic has almost no speed variance, which
means very little overtaking, which means the `blocked` motive barely
fires — but when a lorry doing 63 catches one doing 62, the pass takes
forever and there is nothing else moving to dissolve it. Long dead calm,
occasional immovable dam.

**But not empty of fast traffic, and here the counters go blind.** Ric's
second observation — that the small hours also have people going *very*
fast — is half measurable and half not, and the split is worth being
exact about.

Measurable: **5.0% of night traffic is over 85 mph** in a posted 70,
against 10.0% mid-afternoon. So proportionally there are fewer fast
vehicles at night, not more, and the p95-minus-median spread is very
slightly narrower too, 15.5 against 16.5. The folklore is wrong about
the shape.

Not measurable: **how fast the fast ones are going.** TDOT's top bin is
`85+` and it is open, so a motorcycle doing 130 and a saloon doing 86
are the same row. Everything above roughly the 95th percentile is
censored, and no amount of care with this dataset recovers it.

So `src/traffic.js` measures the curve to p95 and **decides** beyond it:
an exponential tail, scaled per class, marked DECIDED in the source with
the reasoning. About 1 car in 1,000 over 100 mph and 1 in 10,000 over
110; motorcycles roughly three times fatter than that. The scale does
not change with the hour, because the data does not support widening it
— what makes somebody quick noticeable at three in the morning is the
empty road around them, and the model gets that from the flow. If it
reads wrong in play, that scale is the knob, and it should be turned
deliberately rather than discovered.

Lorries go the opposite way and are **governed**: fleet tractors run an
ECU limiter, in practice 65–70 mph, so their tail is cut off rather than
fat. Three quarters carry one in the model; the quarter that do not are
what you see at the top of the artic distribution.

**Where you are matters as much as the sign does.** Counters 78 and 39
are 43 miles apart at the same posted 70 and their medians are **78.1
and 65.9** — a 12 mph difference with nothing in the profile to explain
it. Whatever sets speed on a stretch, the number on the sign is only
part of it.

**Generalising it.** All five counters are in Tennessee, so a table of
absolute speeds would only ever be right for 260 miles. `observed.json`
therefore carries the **offset from the posted limit** as well as the
absolute — median +3, p85 +12, p15 −7 — on the assumption that speed
choice tracks the design of the road and the limit is set from the same
design. That is the only assumption in this file and it is written down
so it can be argued with.

**And the fourth thing, which was a bug in our own data and is now
fixed.** Counters 80 and 82 came out 98% and 96% "over the limit"
because `traffic.js` had them posted at 55, from HPMS. The survey said
65. The drivers said the median was 73 and the *fifteenth percentile*
was 65 — a distribution that cannot happen under a 55 sign.

Auditing the whole corridor, HPMS and the OSM survey agreed exactly over
2,212 of 2,551 miles and differed by 10 mph or more over **67 miles in
36 stretches**. The first theory was ramp contamination — a section bin
swallowing a C-D road and the median going with it — and it was wrong.
Each of the worst offenders is a single mainline section with four to
six through lanes and twenty thousand vehicles a day: **Tennessee
reported 40 mph for 7.6 miles** of the Pigeon River Gorge and 45 through
downtown Memphis, New Mexico reported 50 where the survey says 75. HPMS
`speed_limit` is an optional field and the states simply put bad numbers
in it. It is the dirtiest field in the return.

`reconcile()` in `emit.py` now settles it, in three rules: more than 10
mph apart, take the survey; outside 50–75, clamp, because nothing on
I-40 is posted outside that; not a multiple of five, round to one,
because signs are. Under 10 mph apart HPMS keeps it — it is the state's
own return and it has 4,197 runs against the survey's 70, so it is where
the resolution lives.

**66 miles moved. The 10-mph disagreement went from 67 miles to 1.8**,
and what is left is the two sources putting a transition on opposite
sides of the same 0.1-mile bin. Counters 80 and 82 now read 87% and 83%
over a posted 65, which is the same figure as counter 78 on the other
side of the state. The gorge reads 55.

---

## 2c. Measured, on I-40 itself: how much of it is lorries, hour by hour

Added 2026-08-09, and this is the gap §5 used to say could not be
closed from any public source. It could — TDOT publishes an hour x
vehicle-**length** table beside the speed one. `trucks.py` turns it into
`mix.json`. Length is not the FHWA 13-class scheme, but it splits the
three things the game must draw differently, and unlike an axle count it
cannot mistake a pickup towing a boat for a lorry:

    moto  under 8 ft   car  8-23 ft   rigid  23-50 ft   artic  over 50

**Six counters, 10.1 million vehicles.** A seventh was dropped: counter
86 reports 0.1% artics where HPMS says 24%, because its loop spacing
sizes a 5-axle semi at about 45 ft and every bin above 50 comes back
empty. The rule that caught it is the same shape as the one guarding the
volume join — compare the counter's own year against the HPMS section
beside it — and the six that survive have a **median ratio of 0.91**,
which is agreement.

The daily average across them is **21.7% artics**. That number is true
at no hour of the day:

| | 02:00 | 07:00 | 16:00 | 22:00 |
|---|---|---|---|---|
| weekday artic share | **54.9%** | 20.8 | 18.7 | 34.3 |
| weekend artic share | 38.4% | 22.4 | 12.2 | 19.8 |

**Rural I-40 at two in the morning is more than half lorries.** On a
Saturday afternoon it is one in eight. That is a **4.6× swing** in the
mix — 0.55 to 2.54 as a multiplier on the section's daily average — and
it is the single largest thing in this pull that a hand-tuned model
would never have guessed. Three in the morning in the Mojave is not a
quiet version of three in the afternoon; it is a different road with
different vehicles on it.

`mix.json` carries it in the same grammar as the week and month profiles
beside it, so it travels to the stretches with no counter:

    articShare(px, when) = combo(px)/aadt(px) x mult(weekend, hour)

Applied to the Mojave, whose daily average is 33% combination, that puts
the small hours at roughly **three quarters lorries** — on the stretch
where California also posts them 15 mph slower than you (§4). The
western end of the game at night is a queue of lorries doing 55 in a
70, and both halves of that come from measurement.

### Motorcycles, which run the other way

Pulled out of `car` as a fourth class 2026-08-09, on Ric's observation
that the night has motorcycles in it. It does, and the direction of the
effect is the opposite of the lorries':

| | 03:00 | 16:00 | over a year |
|---|---|---|---|
| motorcycle share | **1.17%** | 0.78% | 0.89% |

**A bigger share of a much emptier road.** Both halves of that matter
and they point opposite ways: relatively they are half again as common
in the small hours, and absolutely there are about **four times fewer**
of them, because everything else falls away faster than they do. On the
Mojave at three in the morning it works out at under two an hour, which
is the right answer — you see one, and it is an event.

This is the one figure in the file with **no second source**. HPMS does
not count motorcycles at all, so there is nothing to check it against
the way the artic share was checked. And the per-counter spread is wide
— 0.2% at counter 78 against 2.4% at counter 80 — which is more than a
real motorcycle population varies and says part of the 0-8 ft bin is the
loop rather than the road. The hourly *shape* is consistent across all
six counters, which is why the shape is what gets emitted and the level
comes from the pooled average. Treat the level as the soft number.

TDOT never crosses its length table with its speed table, so there is no
measured motorcycle *speed* on I-40 either. They are drawn as cars,
except in the censored tail (§2b), where they carry the fattest one in
the model — and that is a decision, not a measurement.

---

## 3. Cited: the blinker

**This one cannot be measured from any public trajectory dataset.** None
of them record lamp state — the vehicles are tracked as boxes from above
and a lit indicator is not visible at that resolution. So the numbers
below come from field studies where an observer watched, and they are
the whole of the evidence:

- **48% of lane changes are made with no signal at all.** Ponziani,
  *Turn Signal Usage Rate Results: A Comprehensive Field Study of 12,000
  Observed Turning Vehicles*, SAE 2012-01-0261, presented at the 2012
  SAE World Congress. 12,000 vehicles observed. The same study puts
  turn-signal neglect at 25% for turns, as against 48% for lane changes
  — people signal turns and do not signal lane changes.
- **NHTSA's naturalistic lane-change study** independently found signals
  used on **44%** of lane changes. Two studies, different methods,
  44% and 52% — call it **half**.
- **Of the drivers who do signal, about half are late.** Signal on at
  the moment the manoeuvre starts: ~50%. Reaching 90% only 1.5–2 s
  *after* onset. So "signalled" does not mean "signalled first".

What that means for the game, stated plainly so it is a decision and not
an accident: **half the traffic should change lanes with no indicator,
and half of the half that does indicate should light it after the car
has already started moving.** That is not a difficulty setting, it is
what the road is like, and it is the single most-noticed detail in any
driving game that gets it wrong in either direction.

Lamp behaviour once lit is regulated rather than observed: FMVSS 108
requires **60–120 flashes per minute**, so 1–2 Hz, conventionally 1.5 Hz
with a duty cycle near 50%.

---

## 4. Cited: the speed limits, including the one for lorries

The posted limit is in `traffic.js` as a run-length profile straight
from each state's own HPMS submission, so it changes where it really
changes — 21 of its 142 runs had to be filled from the corridor's OSM
survey where HPMS reported nothing, and California reported only 17 of
its 155 miles.

What HPMS does **not** record is that in two of the eight states a lorry
may not go as fast as you may. From the IIHS state table:

| | cars, rural | cars, urban | lorries |
|---|---|---|---|
| California | 70 | 65 | **55 everywhere** |
| Arizona | 75 | 65 | same |
| New Mexico | 75 | 75 | same |
| Texas | 75 | 75 | same |
| Oklahoma | 75 | 70 | same |
| Arkansas | 75 | 65 | **70 rural** |
| Tennessee | 70 | 70 | same |
| North Carolina | 70 | 70 | same |

California is the striking one: **a 15 mph differential** for the whole
155 miles of the Mojave crossing, on a stretch that is a third lorries
by count. Get that right and the western end of the game will read
completely differently from the rest of it — a slow, dense right lane
with everything streaming past.

---

## 5. What is still missing

Listed rather than papered over.

Two of the four things this list used to say were unreachable are now
§2b and §2c. What is left:

- **Only Tennessee is observed.** §2b and §2c are 260 miles of a 2,551
  mile road, and they carry the whole corridor by assumption. Every
  state on I-40 runs the same MS2 software behind the same bot filter,
  so the other seven are the same job seven more times with a different
  `agency_id` — `ncdot.public.ms2soft.com`, `adot.`, and so on. The
  Mojave is the one that matters most and the one with no counter at
  all. Same for FHWA's NPMRDS, which has probe speeds for the whole
  corridor and is behind a registration rather than a filter.
- **Speed by vehicle class, on I-40.** TDOT publishes the speed table
  and the length table separately, never crossed. So §2b's distribution
  is cars and lorries together, and at two in the morning that is a
  distribution of mostly lorries — which is why the night looks slow.
  The 5 mph car-lorry difference in §2 is still I-294's.
- **Gap acceptance when merging.** ~~Derivable from the TGSIM data
  already downloaded — the ramp merges are in frame — but not derived
  yet.~~ **Checked 2026-08-10, and it is not derivable.** The auxiliary
  lane in the busy flight is lane 6, and over 1.02 million frames and
  1,165 tracked vehicles it holds **493 frames — four vehicles**. All
  four merge in frame; none is still on the ramp when its track ends. In
  the free-flowing flight no vehicle enters it at all. Four merges
  cannot carry a critical-gap distribution. The one thing they do say,
  weakly: the lane runs 593–1,442 m and the median merge point is
  1,007 — about half way along the road available. So merging gap
  acceptance is a DECISION, and PLAN.md §5d is where it is written down.
- **Why anybody changes lane.** Everything measured here is the *rate*
  and the *duration* of a manoeuvre, never its motive. A model that
  changes lane at 0.37 per vehicle-km at random reproduces every number
  in §2 and still looks wrong, because on a real motorway almost every
  lane change has a reason — an exit coming, something slow ahead, a
  faster car behind. The motives are a design decision, not a
  measurement, and they are the next thing to write down.
- **What happens in the wet.** Nothing here is weather-conditioned.
