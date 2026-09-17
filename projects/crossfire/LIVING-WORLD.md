# Crossfire: Survey — Living World System

**Status: a brief. Not built as this document — but the ground under it moved.**
Written by Ric. See `SURVEY-DONE.md` for what Survey actually has; the estimate at
the foot is mine, and it is now optimistic by one sweep rather than pessimistic.

*One of Survey's eight documents — `SURVEY-PLAN.md` → "The Survey documents" says how they relate, and its "What is left" is the one list of what is not built.*

> **Re-checked 17 September 2026, and two things in here are out of date.**
>
> 1. **"Nothing in this document is implemented" is no longer true.** The
>    substrate section near the foot ("What Survey already has that this needs")
>    was right when it was written and has since grown: reputation persists per
>    power, stations hold shortages that convoys move, five roles have colliding
>    wants, battles leave named memorials, ships you saved come back and pirates
>    you hurt return as themselves. That is §15's causal chain and the bottom of
>    §11's ladder, running.
> 2. **Territory is no longer "genuinely new".** "Who holds the sky" landed on
>    17 September: a coarse political grid stored in the book and applied over
>    what the seed generates, exactly the shape this document predicted, with
>    borders that move on events the player could have seen — which is this
>    file's own rule. Read that section of `SURVEY-DONE.md` before re-estimating
>    the first sweep; most of its work is done.
>
> What is still unbuilt is the part this document is actually for: faction state
> and the evaluate-act loop, distant abstract resolution, the event record with
> importance, threads, news templates, and then laws, leaders, elections and
> civil war creating a new faction.

## Simple first version

## 1. Goal

The universe should continue creating history, conflict, relationships, and
reasons to travel even after the player has all the equipment they want.

The player should not be following prewritten storylines.

Instead:

Rules create pressures → pressures cause actions → actions create events →
events change the world → the game remembers important events.

The player participates in the same system and can change what happens.

---

## 2. Core rule

Do not generate stories directly.

Generate:

- factions
- people
- needs
- relationships
- territory
- laws
- resources
- conflicts
- actions
- consequences

Then remember what actually happened.

The story is the history created by those systems.

---

## 3. World structure

The political simulation does not need to simulate every person or every ship.

Keep it small.

A world could initially contain:

- 5–8 major factions
- 20–50 political sectors
- important worlds/stations inside those sectors
- a handful of major resources
- important named NPCs
- anonymous background NPCs
- active wars
- laws and political issues
- faction relationships
- historical events

Most of this is just numbers and IDs, so CPU and memory use should remain very
small.

---

## 4. Factions

Every faction has a persistent state.

Example:

```
Faction: Federation
Territory:
  18 sectors
Resources:
  fuel: 0.48
  food: 0.81
  metals: 0.35
Military:
  strength: 720
  readiness: 0.74
Society:
  stability: 0.71
  war_support: 0.45
  government_support: 0.62
Traits:
  expansionism: 0.72
  militarism: 0.54
  authoritarianism: 0.66
  trade_preference: 0.38
Laws:
  slave_labor: LEGAL
  piracy: ILLEGAL
  privateering: ILLEGAL
Relationships:
  Coalition: -0.61
  Frontier Union: +0.18
  Pirates: -0.91
Current pressures:
  fuel shortage
  border dispute
  pirate attacks
```

**Important**

The faction does not get commands like:

```
START_WAR
```

Instead, the faction evaluates its situation.

Example:

```
Need fuel
+ Neighbor owns fuel-rich territory
+ Relations are bad
+ Military is strong
+ Neighbor military is weak
= Invading becomes an attractive option
```

Possible actions might include:

- trade
- raise prices
- increase production
- claim territory
- threaten another faction
- sanction another faction
- raid
- blockade
- invade
- negotiate peace
- form alliance
- issue bounty
- change law
- increase policing
- support rebels
- withdraw military
- build infrastructure

Actions have costs and consequences.

---

## 5. Territory

Space is divided into political sectors.

A sector stores something like:

```
Sector: Vega
Owner:
  Federation
Claimed by:
  Federation
  Coalition
Control:
  0.81 Federation
Resources:
  fuel: HIGH
  metals: MEDIUM
Population support:
  Federation: 0.55
  Coalition: 0.31
  Independent: 0.14
Security:
  0.63
Unrest:
  0.22
```

Possible sector states:

- controlled
- weakly controlled
- contested
- occupied
- independent
- unclaimed
- rebel-controlled

Territory should matter because it contains actual things:

- stations
- resources
- shipping routes
- gates
- populations
- military positions

---

## 6. Political issues and laws

Factions have laws that can change.

Examples:

- slavery
- taxation
- trade restrictions
- privateering
- weapons restrictions
- border policy
- conscription
- piracy enforcement
- refugee policy

Changing a law affects real systems.

Example:

```
Slave labor abolished
↓ labor availability falls
↓ production drops on dependent worlds
↓ industrial groups become angry
↓ some regions support abolition
↓ other regions resist
↓ government stability changes
```

A law is therefore not flavor text.

It affects the world.

---

## 7. Leaders and elections

Important factions can have political leaders.

Keep leaders simple.

```
Mara Vale
Role:
  Governor
Traits:
  ambition: 0.68
  empathy: 0.82
  aggression: 0.31
  corruption: 0.09
  risk_tolerance: 0.44
Beliefs:
  abolition: +0.91
  expansionism: -0.22
  trade: +0.71
Popularity:
  0.62
Relationships:
  Federation military: +0.21
  Industrial bloc: -0.66
```

Political systems can initially be very simple:

```
Election every X years
Candidates gain support based on:
  current problems
  their beliefs
  their reputation
  economic conditions
  wars
  regional support
```

Example:

War goes badly.

Current president loses popularity.

A governor who opposed the war becomes popular.

She wins the election.

She changes policy.

Those changes cause new consequences.

---

## 8. Rebellion and civil war

Civil wars should not be random special events.

They should come from pressure.

Example:

```
President abolishes slavery
↓ Several regions depend heavily on slave labor
↓ Economic output drops
↓ Regional leaders oppose the government
↓ Government orders enforcement
↓ Military commanders refuse
↓ Regional loyalty collapses
↓ SECESSION
```

The game creates a new faction:

```
Halden Separatists
```

They receive:

- territory from rebelling sectors
- ships whose crews defect
- resources inside their territory
- leaders from the rebellion
- political beliefs based on the dispute

Now there is an actual civil war.

No scripted storyline was required.

---

## 9. NPC generation

Most NPCs begin extremely simple.

Generate them using numbers and world context.

```
Captain Mara Voss
Faction:
  Independent
Role:
  Trader
Home:
  Vega
Traits:
  aggression: 0.18
  caution: 0.74
  loyalty: 0.81
  greed: 0.31
  empathy: 0.77
  ambition: 0.38
  vengefulness: 0.42
  risk_tolerance: 0.46
  lawfulness: 0.39
Beliefs:
  Federation: -0.71
  Coalition: +0.12
  slavery: -0.94
Current needs:
  money
  fuel
  safe route
```

No biography needs to be written.

Their background can come from the actual world.

If Mara was born on Vega and Vega experienced a Federation occupation ten years
earlier, that can influence her starting beliefs.

---

## 10. NPC history

NPC history should mostly consist of events that actually happened.

```
Mara Voss — History
Day 31   Attacked by pirate Rask.
Day 42   Player rescued Mara after engine failure.
Day 71   Delivered medicine during Vega shortage.
Day 88   Smuggled refugees from Federation territory.
Day 91   Federation issued bounty.
Day 105  Encountered player again.
```

This is her actual life.

Not generated lore.

---

## 11. NPC importance

Do not permanently simulate thousands of detailed characters.

Use an importance ladder.

```
ANONYMOUS
↓ RECURRING
↓ NAMED
↓ IMPORTANT
↓ HISTORICAL
```

**Anonymous** — very little stored. `Federation Trader 381`

**Recurring** — player or simulation has encountered them multiple times. Store
basic traits, role, faction, short history.

**Named** — something important happened involving them. Generate a persistent
identity.

**Important** — they affect other people or major events: famous pirate, admiral,
governor, major trader, rebel leader.

**Historical** — their actions materially changed the world: started a rebellion,
won a war, killed a major leader, player killed them during a famous battle.

Only important characters receive deeper simulation.

---

## 12. Relationships

Characters can have relationships with:

- player
- factions
- other important NPCs

Keep the data simple.

```
Mara → Player      +0.74
Mara → Rask        -0.91
Mara → Federation  -0.72
```

Relationships change because of events.

```
Player rescues Mara            + relationship
Player attacks Mara's faction  - relationship
Player kills Mara's friend     - large relationship
Player saves Mara again        + relationship
```

---

## 13. Trouble system

When the player encounters someone meaningful, the game should immediately
communicate whether they are:

**In trouble** — low fuel, damaged, pursued, stranded, blockaded, wanted,
starving, trapped, carrying refugees.

**Making trouble** — attacking civilians, raiding traders, smuggling, blockading,
hunting someone, invading territory, transporting slaves, fleeing authorities.

The interpretation depends on the player.

```
MARA VOSS
Friendly
IN TROUBLE
Hull: 43%
Fuel: Critical
Federation patrol pursuing
History:
  You rescued her at Vega.
  She helped you during the Arken shortage.
```

```
RASK
Hostile
MAKING TROUBLE
Currently attacking civilian convoy.
Federation bounty: 31,200.
History:
  Escaped you twice.
  Destroyed Captain Renn's ship.
```

This lets the player quickly understand why an encounter matters.

---

## 14. Events

Everything important produces an Event object.

```
Event #8217
Type:            SHIP_DESTROYED
Actor:           Player
Target:          CNS Horizon
Location:        Vega
Faction actor:   Independent
Faction target:  Coalition
Cause:           Battle of Vega
Consequences:
  Coalition fleet strength -120
  Coalition morale -0.08
  Federation control Vega +0.12
Importance:      0.91
```

Events are the foundation of the entire history system.

---

## 15. Event consequences

Events should be allowed to create future pressures.

```
Convoy destroyed
↓ fuel shipment never arrives
↓ fuel shortage
↓ prices increase
↓ traders begin traveling there
↓ pirates notice increased traffic
↓ patrols increase
↓ battle occurs
↓ wreck field created
```

This is how Survey generates continuous situations without quests.

---

## 16. Player impact

The player participates in exactly the same world.

```
Player destroys military ships.     Military strength decreases.
Player supplies starving colony.    Shortage improves.
Player rescues politician.          Politician survives.
Player kills politician.            Election changes.
Player attacks slave transports.    Transport costs increase.
Player helps rebels.                Rebel military strength increases.
Player destroys blockade.           Trade resumes.
Player kills famous pirate.         Bounty ends.
```

The game should avoid arbitrary `+10 politics`.

Whenever possible, player actions should change actual world variables.

---

## 17. Distant simulation

The universe does not need full physics everywhere.

Use different simulation resolutions.

**Far away** — abstract simulation.

```
Federation fleet: 720
Coalition fleet: 590
Battle calculation
Federation losses: 180
Coalition losses: 260
Federation wins.
```

Very cheap.

**Nearby** — create actual fleets, traders, patrols, convoys, named ships.

**Player present** — use full Survey physics and combat. The player can directly
change the result.

This allows enormous events without enormous CPU usage.

---

## 18. Historical importance

Not every event needs permanent storage.

Calculate an importance score.

Factors:

- important person involved
- major ship destroyed
- territory changed
- many deaths
- caused political change
- player involved
- affected faction relationships
- caused shortage
- caused rebellion
- changed war outcome

Low-importance events can eventually be deleted or summarized. High-importance
events stay forever.

---

## 19. Story threads

Events that share causes, people, factions or locations can be grouped into
threads.

```
THREAD: Vega Crisis
Federation claims Vega
↓ Coalition rejects claim
↓ Border fighting
↓ Federation invasion
↓ CNS Horizon destroyed
↓ Coalition retreats
↓ Federation captures Vega
```

The game does not know how this story will end.

The thread simply connects related events.

Possible thread types could eventually include: wars, rebellions, political
movements, pirate careers, economic crises, exploration mysteries, faction
rivalries, personal vendettas.

---

## 20. News

For now, no LLM.

News is generated using templates based on real events.

Event: Federation captured Vega from Coalition.

```
Federation template:
FEDERATION SECURES VEGA
Federation forces have taken control of Vega following fighting with Coalition
forces.

Coalition template:
VEGA FALLS TO FEDERATION OFFENSIVE
Coalition forces have withdrawn from Vega following sustained Federation attacks.

Neutral template:
CONTROL OF VEGA CHANGES
Federation forces now control Vega after fighting with Coalition units.
```

The facts remain identical. Only framing changes.

Each news network can have vocabulary preferences.

```
Federation might say:
  rebels → separatists
  attack → security operation
  retreat → strategic withdrawal
```

Pirates might use casual language. Neutral news might use uncertain language.

---

## 21. News should report the simulation

**Critical rule: news cannot create world events.**

The world creates `WAR_STARTED`. News reports it.

The world creates `BOUNTY_CREATED`. News reports it.

The world creates `WORLD_COLLISION_DETECTED`. News reports it.

This prevents the news system from becoming a disguised random quest generator.

---

## 22. Player news feed

News gives the player reasons to travel.

```
BREAKING
FEDERATION CIVIL WAR
Three eastern sectors have rejected federal authority following the abolition of
slave labor.
Known fighting:
  Halden
  Vega
  Arken
Federation bounty:
  Governor Halden — 45,000
Travel warning:
  Military activity extremely high.
```

The player can ignore it. Or travel there. The situation continues either way.

---

## 23. World history

Important events build a history of the player's universe.

```
YEAR 18
THE VEGA WAR
Tensions between the Federation and Coalition over Vega's fuel reserves
eventually escalated into open warfare. The destruction of the CNS Horizon
severely weakened Coalition forces in the region. Federation forces captured
Vega shortly afterward.
```

These summaries can initially be produced through templates and event analysis.

Every seed eventually creates a different history.

---

## 24. Basic simulation tick

A political tick could look roughly like:

1. Update resources.
2. Update trade.
3. Update shortages.
4. Update regional unrest.
5. Update faction pressures.
6. Factions evaluate possible actions.
7. Resolve distant actions.
8. Update wars.
9. Update territorial control.
10. Update faction relationships.
11. Update leaders/elections.
12. Evaluate rebellions.
13. Update important NPCs.
14. Record events.
15. Connect related events into threads.
16. Determine which events are newsworthy.
17. Generate news articles.
18. Save world state.

Political ticks do not need to run every frame. They could happen every few game
minutes, or some equivalent world-time interval.

---

## 25. Preventing nonsense

The system needs inertia. Otherwise factions will constantly change their minds.

- **Cooldowns** — a faction cannot declare war and then immediately reverse itself.
- **Costs** — war costs money, ships, trade, stability, lives.
- **Memory** — past betrayals affect future decisions.
- **Thresholds** — rebellion requires substantial unrest.
- **Momentum** — successful policies gain support; failed policies lose support
  gradually.
- **Logistics** — large empires become harder to defend.
- **Risk** — factions should consider whether an action could destroy them.

---

## 26. Preventing one empire from winning forever

Expansion should create advantages and problems.

```
Large empire:
+ resources
+ population
+ military production
BUT
+ more borders
+ longer supply routes
+ more regions to defend
+ more political differences
+ more piracy
+ more rebellion risk
+ more enemies fearing them
```

This allows empires to naturally rise, peak, stagnate, fracture, collapse and
recover without an artificial balancing rule.

---

## 27. Minimum version to build first

**Do NOT build everything above immediately.**

Start with:

**Three factions**, each with territory, resources, military strength,
relationship values, aggression, expansionism, stability.

**Ten sectors**, each with owner, resources, security, unrest.

**Five actions**: `TRADE`, `CLAIM`, `RAID`, `INVADE`, `MAKE_PEACE`.

**Events** — record everything meaningful.

**One simple news screen** reporting wars, captured territory, shortages, major
battles.

Run this world without the player. Speed it up. Watch what happens.

---

## 28. First major expansion

Once the basic system produces understandable history, add: leaders, elections,
laws, political beliefs, rebellions, civil wars, bounties, important NPCs.

Then run it again.

---

## 29. Second major expansion

Add deeper NPC simulation: relationships between NPCs, families, friendships,
grudges, careers, political advancement, criminal careers, military promotions.

An anonymous patrol captain might eventually become:

```
Captain → Admiral → War hero → Governor → President
```

because of events that actually occurred.

---

## 30. Third major expansion

Add deeper society: political blocs, economic classes, regional cultures,
ideological movements, migration, refugees, propaganda, revolutions, coups,
corruption, organized crime.

Only add these when the simpler system is already working.

---

## 31. Later improvement: information travel

Eventually news does not need to be instant. Information could physically
propagate through stations, communication relays, traders, patrols, faction
networks.

Something happening deep in space may take time to reach civilization. Different
factions might know different things. Rumors might be incomplete.

This would fit Survey extremely well, but it is unnecessary for the first version.

---

## 32. Later improvement: imperfect knowledge

Factions eventually should not know the entire simulation state.

The Federation may estimate `Coalition fleet strength: 500–800` rather than
knowing exactly `637`.

Scouting, spies and sensors could improve knowledge. This creates mistakes and
surprises naturally. Again: later feature.

---

## 33. Later improvement: procedural culture

Different factions could eventually develop naming styles, ship styles, political
vocabulary, laws, traditions, military doctrine. These can evolve slowly over
history. Not needed initially.

---

## 34. Later improvement: generated mysteries

The same history architecture could eventually track nonpolitical stories:
unexplained signals, strange worlds, missing expeditions, unusual wormholes,
recurring anomalies.

These can create story threads alongside wars and politics. That would connect the
living-world system directly back into Survey's exploration game.

---

## 35. The main design philosophy

Crossfire should generate **people from rules**, then **their lives from events**,
then **relationships from shared history**, then **politics from competing
needs**, then **wars and crises from political consequences**, then **stories by
remembering what actually happened**.

The player exists inside all of it.

The player does not consume generated quests. The player discovers situations.

---

## 36. What success looks like

After playing for a long time, a player should be able to say:

> I hate the Federation because of what I've watched them do.
>
> I helped Mara before she became president.
>
> Rask has escaped me three times.
>
> I accidentally helped start the Vega War.
>
> That station used to belong to the Coalition.
>
> I remember when the Federation abolished slavery and half the eastern sectors
> rebelled.
>
> I was there when the Horizon was destroyed.

Those statements should describe things that actually happened in that player's
universe.

That is the system.

The world does not need infinite authored stories. It needs enough interacting
rules that it can create a history neither the player nor the developer knew
beforehand.

---

# What it would take to build  ·  *my estimate, not Ric's brief*

## What Survey already has that this needs

More than it looks. The substrate is most of the first version:

- **Five powers with a war between them**, and opinions of you that persist per
  power (`FACTIONS`, `REP`, `standingOf`).
- **An economy that reacts to events** — stations hold shortages, a convoy
  destroyed near one deepens it, the shortage moves the price and pulls traffic.
  That is §15's causal chain already running.
- **NPCs with wants that collide** — trader, pirate, escort, patrol, scavenger.
- **Consequences that persist and are named** — battles end and leave memorials,
  ships you saved come back, pirates that got away return as themselves, wrecks
  stay where things died. That is the bottom two rungs of §11's ladder built.
- **A save book with a validated whitelist**, a rule that a chunk is a pure
  function of its coordinates, and a headless harness that can run the sector for
  minutes of game time and assert on the result — which is exactly the tool §27
  asks for when it says *run this world without the player and watch*.

## What is genuinely new

- **Territory.** Survey's space is infinite and procedural; political sectors are
  *mutable state over space*. They have to meet. The shape that works here is the
  one `surv.wrecked` and the market already use: a coarse political grid, one
  sector per large block of chunks, stored in the book and applied over what the
  seed generates. Getting this right is the first sweep's real work.
- **Faction state and the evaluate-act loop**, distant abstract resolution, the
  event record with importance, threads, and the news templates.
- **Laws, leaders, elections, rebellion** — and civil war *creating a new faction*
  touches ship colours, reputation, territory, the chart and the save at once.

## Sweeps

A "sweep" = one working session like the ones that built 6.3 or the parts rebuild:
designed, built, tested, audited, committed, pushed.

| | |
|---|---|
| **§27 minimum version** — 3 factions, ~10 political sectors, 5 actions, the event record, a news page, and a fast-forward mode to watch a century run without a player | **2** |
| **§16 player impact** — your kills, deliveries and rescues moving the real variables rather than a score | **1** |
| **§28 first expansion** — laws, leaders, elections, rebellion, civil war, bounties | **2–3** |
| **Territory on the chart** — owner colours, borders, contested sectors, and the news feed reading as a place you can fly to | **1** |
| **§29 NPC depth** — careers, promotions, NPC-to-NPC relationships | **1–2** |
| **§30 society** — blocs, classes, movements, coups | **2** |
| **§31–32** — information travel, imperfect knowledge | **1–2** |
| **§33–34** — procedural culture, generated mysteries (this one merges with Phase 6.6) | **1–2** |

**Minimum playable: 2 sweeps. The version that feels like the brief: 5–6. All of
it: 11–15.**

## One recommendation

Do not ship the §27 minimum on its own. Three factions trading and invading over
ten sectors produces history that is *legible but bland* — "Federation took Vega"
— and the magic in this document is all in the first expansion: the law that
passes, the regions that depend on it, the commanders who refuse, the secession.
Budget **§27 + §16 + §28 together as the target — about four to five sweeps** —
and only then decide whether the rest is worth it.

The other honest note: this competes with the rest of Phase 6. When that was
written, **6.4** (parts that are verbs) and **6.6** (authored mysteries) were the
two things left there; 6.4 has since closed, so **6.6 is the only one** — and 6.6
is *the same idea pointed at exploration instead of politics*. If the living world
gets built, 6.6 should probably be built inside it — §34 says so too.
