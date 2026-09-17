# Survey — player history + political change

**Status: a brief, mostly not built — but §4 is, and §1 is half.** Written by Ric,
as a companion to `WORLD-IDEAS.md` and `LIVING-WORLD.md`. It used to say nothing in
it was implemented; that stopped being true, and what changed is recorded in
"Where this already half-exists" at the foot, checked 17 September 2026. See
`SURVEY-PLAN.md` for what Survey has.

*One of Survey's seven documents — `SURVEY-PLAN.md` → "The Survey documents" says how they relate, and its "What is still open" is the one list of what is left.*

The goal is to make the universe feel like the player's universe, not just a
simulation happening in the background.

---

## 1. The player enters the same causal system

The player should not get a separate "influence meter."

Their actions should change the same systems that NPCs and factions already use.

Examples:

- Destroy pirate ships on a water route → deliveries recover → shortage weakens →
  security pressure falls.
- Attack haulers → shortage worsens → hardliners gain support → inspections and
  patrols increase.
- Repeatedly save ships from one faction → certain captains and organizations
  become more tolerant of the player.
- Kill an important commander → that person stays dead → somebody else replaces
  them with different priorities.
- Break a blockade → trade resumes → prices and political pressure change.
- Help a rebellion survive → it may eventually become a real faction with
  territory.

The player should often see the consequences later through news, prices, traffic,
territory, laws, and recurring people.

**Rule:** the player changes history by doing things in the world, not by clicking
abstract political choices.

---

## 2. Internal politics should produce real change

Faction politics should eventually affect laws, leadership, territory, and
behavior.

A simple chain could be:

```
material pressure → political support → leadership → policy → consequences → opposition
```

Example:

A faction relies heavily on slave labor.

An abolitionist movement grows.

An election puts an abolitionist leader in power.

Slavery is abolished.

Production drops in regions that depended on it.

Some groups support the change.

Others lose wealth and influence.

Certain governors refuse enforcement.

Military leaders choose sides.

If the conflict becomes severe enough, regions can revolt or secede.

A civil war can emerge without a scripted "civil war event."

---

## 3. Factions need multiple sources of pressure

Do not let every event reduce to:

```
shortage → convoy → pirates → escorts
```

That is a good first loop, but the full simulation should eventually include
several interacting pressures:

- resources
- territory
- trade
- security
- ideology
- laws
- leadership
- crime
- migration
- public unrest
- disputed ownership
- exploration and discoveries

These should create chains across systems.

Example:

```
discovery → territorial claim → migration → political tension → leadership change
→ new law → trade disruption → piracy → military response
```

The interesting part is that the outcome is not predetermined.

---

## 4. Things can earn permanence

Most background activity can remain anonymous.

Some things should become historically important because of what happens to them:

- captains who repeatedly survive
- commanders who win major battles
- politicians who rise in importance
- pirates with large bounties
- stations involved in major events
- player-owned ships that are destroyed
- important battles
- rebellions
- treaties
- famous discoveries

The universe should slowly accumulate names, grudges, victories, disasters, and
unfinished stories.

That is how a generated world becomes personal history.

---

## 5. Long-term goal

Gear gives the player control over **how** they travel.

The living-world system gives them reasons for **why** they travel after their
ideal ship already exists.

Late-game motivation should become:

> "I want to see what happened."

and then:

> "I have something I want to do about it."

The universe does not need infinite authored content. It needs enough interacting
systems that its history keeps producing new situations.

---

## Where this already half-exists  ·  *my note, not Ric's brief*

Section 4 is the one with code behind it. The importance ladder's bottom two rungs
are built: a ship you saved keeps its name, comes back and repays you; a pirate
you hurt and let go is written down with the damage you did and returns as
itself; a battle that ends leaves a named memorial; anything that dies in front of
you leaves a hull you can come back and strip. All of it is on **WHO KNOWS YOU**
on the ship's page, and all of it survives the tab.

Section 1 is half-built for one loop only — the water one. Killing a convoy
deepens a station's shortage, the shortage moves the price, the price pulls
traffic, and a hauler that gets through eases it again. What is missing is
everything §3 warns about: that is the *only* chain, so every situation in the
sector is ultimately about freight.

Sections 2 and 5 need the political layer from `LIVING-WORLD.md` and are not
started — but half of what they were waiting for arrived on 17 September. There is a
territory map now: three powers hold cells, fronts grind toward the stronger side,
a battle won flips a cell, ships the player kills wear a power's strength down,
both sides declare a ceasefire when worn out, and a long peace ends in a new war.
So "the player pushes on the same variables the factions use" (§1) has a second
chain besides freight, and a border that moved is a thing you can fly to. What is
still missing for §2 is *internal* politics — the pressures inside a faction, the
laws, the leaders who refuse — which has no code at all.
