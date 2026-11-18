# People sandbox — master vision

Started 2026-11-12 from Ric's discussion of the first People sandbox.
Status: living design draft, to refine together. Implementation baseline reviewed 2026-11-12.

This is the master record of the whole conversation about what the People sandbox should
become. It describes the destination and possible ways to reach it. It is not a claim that
these features exist, and it does not authorize implementing every proposal at once.
The [README](README.md) describes the implementation; this document describes the vision.
Several sessions have worked on the two sandboxes. Check the implementation baseline below
and the current code before starting a milestone; preserve work that has already shipped.

**Start with the last section, "2026-11-14 — The simulator, whole".** It is Ric's statement of
the whole simulator in plain words, and where an older section disagrees with it, it is the newer word.

## Current implementation and the next piece

Reviewed 2026-11-12 against `people.js`, `index.html` and the README, following the readability
update in commit `88890e2e` and the population-browser milestone authorized by Ric: "Build the
next features from the vision". This table records implementation, not approval of all proposals.

| Area | What exists | What remains from this vision |
|---|---|---|
| Recognizing people | Boxes (Ric’s 2026-11-13 preference), smaller children, a leader ring and faction/mood/belief/wealth colour views. | Individual appearance and more varied equipment. |
| Understanding actions | Close-up role/activity labels, an activity line in inspection, visible harvesting patches. | Reasons for choices, blocked-action explanations and lasting work sites. |
| Selecting and following | People list with name search, settlement/faction/job filters, pagination and preserved list position; select and follow on the map; living-family links and either Talk participant selectable. | Bookmarks, durable family histories and navigation to the dead. |
| Conversation | Real exchanges with a paired reply; named speech bubbles, a connection between participants, a recent Talk list, a held exchange with original context and before/after effects, participant navigation, map location and a short pause while speaking. | Longer interaction sequences, agreements and remembered follow-through. |
| Pacing and bodies | Five-minute days at 1× since 2026-11-14 (twenty before), 250 m squares, walking at 4.5 km/h; one clock for frames/headless/fast-forward, hourly daily food needs, age-based child rations, reserve estimates, slower walking and body separation. Since 2026-11-13 a day has a shape: work costs hours, people sleep at night in houses of their own. | Long-term balance, faster generation-scale runs, persistence and reliable navigation through very dense crowds. |
| Why somebody does something | Needs (food, rest, company, fear), one appraisal over every option a person has, occupations that read the same figures as the daily choice, and a person panel that names the need that won. | Plans that outlive the moment, remembered commitments, skills that grow with practice. |
| Work and society | Farming, generic goods, trade, families, leaders, factions, conflict and breakaways. | Seasonal cultivation, buildings, learning and deeper production chains; a first set of useful tools and equipment now exists. |
| Continuity and control | A running world lives in the current page; copied links reproduce settings. | Saved worlds, durable family histories and player control. |

The readability work is a first pass. A visible harvesting marker is not seasonal farming,
and a line between speakers is not a system of agreements. Keep those distinctions in progress
reports and future README edits.

**Delivered on 2026-11-12: find and follow anyone.** The People tab opens with the living
population. Name search combines with settlement, faction and occupation filters. Results show
name, age, occupation, settlement, faction and current activity. Selecting a result locates and
follows that same person on the map. Returning to People keeps the search, filters, page and list
position; a new world resets them. Sixty results per page keep the live list bounded, with every
matching person reachable through pagination. Empty results and a selected person's death have
explicit messages. Person inspection links to living parents, children, partner and the current
conversation partner; each Talk exchange lets the visitor select either participant.

This milestone uses existing identities and actions. It does not introduce resources or change
people's decisions. Bookmarks, a permanent record of the dead, equipment and direct control remain
future work.

**Delivered on 2026-11-12: read and understand an exchange.** Ric asked to continue with the next
piece. Read exchange holds the chosen transcript and original circumstances still while the
world continues. It records actual before/after changes around the whole interaction, including
changes that happen after speech. Both participants can be inspected, with a way back to that
exchange. The original location is reachable and the living participants are marked on the map.
A selected exchange survives the bounded recent history rolling past it; it is not a permanent
archive and resets with a new world. Pause is explicit. No new decisions or dialogue outcomes
were added to make the inspector interesting.

**Delivered on 2026-11-12: visible equipment with real effects.** The next continuation added
work tools, trade packs, weapons and shields. Adults obtain them at villages from actual goods;
coin worlds require payment for purchased material. Tools change harvest/crafting output, packs
change actual cargo capacity, and weapons/shields change combat damage. Items wear with use,
need materials for repair and stop helping when broken. Gear remains owned but inactive when
unsuitable for a new occupation. Inspection reports ownership/use/condition and People rows show
items in use. The map draws equipped gear and actual trade loads. Generic goods remain the
material source; detailed recipes, specialist makers, weapon types and named-item inheritance
are not implemented.

**Delivered on 2026-11-12: a shared clock and daily food.** Ric asked for food "closer to how
food works in real life". One unit now represents an adult-day ration; consumption happens
hourly, children's needs grow with age, families share meals and inspection shows days of food.
Crop stocks replenish on a sixty-day scale. Browser frames, hourly headless calls and batched
fast-forward produce the same world. Lifespan no longer defines hunger. The README records
assumptions and cadence choices. This is a simplified food model; variety, spoilage, water,
seasonal cultivation, long-term balance and generation-scale performance are still future work.

The next proposed village piece is seasonal farming and storage decisions, using this shared
clock, with planning and a visible reason to maintain reserves. Multi-step agreements and
remembered follow-through remain separate social-system work.

## 1. What Ric wants

The sandbox should support both rich individual lives and the development of villages into
towns, cities and civilizations. Watching people should be engaging, and the reasons for
what happens should be understandable. The visitor should also be able to participate by
taking control of a person and making decisions.

Ric's feedback on 2026-11-12:

- Farming and the existing activities need more complexity.
- Asked whether the focus was richer village lives or eventual cities and civilizations:
  "im imagining both".
- "watching it was lackluster" and "the clarity of what was happening was pretty low".
- "even the comunication was pretty lackluster".
- "you cant even tell who they are talking to".
- The visitor should be able to choose to watch, and potentially take control of people
  and their decisions.
- It should be easier to see everyone and select a particular person.
- People should have visible weaponry and equipment.
- "1x should be a 20 minute day" and "the people should move slower".
- "i need to be able to see if they are farming who they are talking to".
- "the people are walking inside of each other they shouldnt be able to".

These are the stated directions. The mechanisms and development order below are proposals
from the discussion, still open to refinement. Preserve that distinction when editing.

## 2. The experience we are aiming for

A visitor can open the world and understand what people are doing. They can find someone
interesting, follow that person's work and relationships, watch their family across
generations, or take over their decisions. Zooming out shows how those lives shape trade,
settlements, institutions and conflict.

The world accumulates history: fields, homes, roads, workshops, inherited possessions,
learned skills, friendships, obligations and grievances. Returning to a place should reveal
what its people have changed and why.

Complexity should create connections and consequences. A new resource, occupation or belief
should change decisions elsewhere in the world. Adding more sliders or dialogue variations
alone does not satisfy this vision.

## 3. Foundations to keep

Carry forward the project's existing rules in the README:

- Every setting has a real effect. A control must have a corresponding system.
- Society develops through people's circumstances and decisions. Wars, famines, rebellions
  and advances must have causes within the simulation; they are not scheduled plot events.
- Dialogue expresses actual exchanges, information and decisions recorded by the engine.
  A sentence does not invent an event or create resources.
- Structured interactions can change the world: an accepted offer can transfer food or
  establish an obligation. The displayed words report that interaction faithfully.
- Keep dialogue local and template-based under the existing rule against wiring in an AI
  model. Richness comes from context, memory and consequences.
- Keep the static, dependency-free project architecture and browser performance constraints.
- Keep this sandbox independent of KONDRITE and the Universe engine. This vision concerns
  the People sandbox; the Physics sandbox retains its own scope.

Player decisions fit these rules: a controlled person makes an explicit choice using the
same underlying actions and constraints as autonomous people.

## 4. Ways to watch and participate

Proposed structure: three ways to experience the same continuing world.

| Experience | What the visitor does | What the person does |
|---|---|---|
| Watch | Explore freely, inspect settlements and observe society. | Acts autonomously. |
| Follow | Select a person or family; keep their life, conversations and changes in view. | Acts autonomously. |
| Control | Make a selected person's decisions while the rest of the world continues. | Uses player choices for the decisions under control. |

- Moving between these experiences should be clear and easy.
- Releasing control returns the person to autonomous life.
- Following someone should keep them identifiable through movement and crowded scenes.
- Following a family should allow moving between relatives and later generations.
- The world remains interesting when the visitor gives no instructions.

Possible controlled decisions discussed:

- Where to work, travel or settle.
- Who to approach, and what to ask, offer or propose.
- What to buy, make, equip, carry or give away.
- Whether to accept a proposal, enlist, flee or support a leader.

Choices should respect the person's possessions, knowledge, relationships, ability and
available time. The exact control scheme remains undecided: movement, action menus,
longer-term intentions and the boundary between manual and autonomous decisions need design.

## 5. Finding, selecting and recognizing people

- A People browser makes the population accessible beyond clicking moving dots.
- Search by name; filter by settlement, faction, occupation and family.
- Selecting a list entry locates and highlights that person on the map.
- Bookmarks let the visitor return to particular people and families.
- A person's panel connects to their partner, parents, children, friends and rivals.
- Clear selection marks distinguish the person being inspected, followed or controlled.
- At close zoom, appearance, carried items and activity help distinguish people.
- The map and list stay connected, including when someone moves or changes occupation.
- Death should leave a meaningful history and a route to surviving relatives.

Selection and essential information must work on a phone as well as with a mouse.
The exact visual style, including whether people have portraits or detailed sprites, is open.

## 6. Communication that can be followed

### Make the participants obvious

- Highlight both participants when inspecting an exchange.
- Show their names and give a clear visual connection between speakers.
- Keep the exchange together in a readable conversation panel.
- Allow selecting either participant from that panel.
- Preserve a readable history so understanding a conversation does not depend on catching a
  brief speech bubble on a moving map.
- Use enough context to explain what the people are discussing and why it matters.

### Give conversations purpose, memory and follow-through

People should communicate about their own circumstances. Proposed interaction types:

- Asking for food, help, work or shelter.
- Bargaining over goods, payment or labor.
- Teaching and arranging apprenticeships.
- Coordinating work and shared construction.
- Warning others and passing on useful information.
- Recruiting support for a leader, cause or military service.
- Apologizing, settling disputes or refusing reconciliation.
- Making proposals, agreements and promises.

Relationships should carry shared history. Someone can remember who fed their family,
refused help, kept a promise, betrayed them or harmed someone they loved.

An exchange can leave an agreement, obligation, changed belief, changed relationship or
information that affects a later decision. People can return to unresolved matters.
Conversation should support more than an isolated statement and automatic reply.

Personality and trust should influence what people disclose, whose reports they believe,
which proposals they accept and how they respond. A sibling's warning and a rival's
accusation should be evaluated in the context of those relationships.

Illustrative future exchange, dependent on systems still to be built:

> Mara: "My harvest won't feed us through winter. Can I work in your workshop?"
>
> Tovin: "I need timber. Bring two loads and I'll teach you."
>
> Later, Mara: "I brought it. When do we start?"

The engine would track the actual offer, acceptance, delivery and teaching. Illness could
delay the work; refusal to honor the agreement could damage trust. The exact promises,
negotiation and conversation-memory models remain open.

## 7. Richer individual lives and families

- People have recognizable homes, work, possessions, relationships and developing goals.
- Experience and practice change what a person can do.
- Family circumstances influence opportunities, responsibilities and decisions.
- Life histories record meaningful experiences and explain current behavior.
- Relationships persist through consequences: gratitude, trust, resentment and grief.
- Dead relatives and friends remain part of the history of the living.
- Families can pass on property, skills, obligations and rivalries.
- A visitor can follow an individual story into the next generation.

The design of ambitions, grief and inherited obligations needs refinement. They should
connect to behavior rather than exist only as descriptive labels.

## 8. Farming, food and the environment

Develop farming into an activity with planning, investment and risk. Possibilities discussed:

- Planting, growing and harvesting over seasons.
- Soil fertility and exhaustion, with ways to maintain or improve land.
- Tools and learned farming skill affecting productivity.
- Expanding and improving fields through labor.
- Food storage, reserves, spoilage and surviving poor harvests.
- Households and settlements deciding between immediate consumption and future security.

Fields and food reserves should be legible on the map and in settlement inspection.
Exact crop types, seasonal timing and environmental detail are not settled.

## 9. Production, buildings and infrastructure

Give labor lasting physical results. Proposed assets include homes, granaries, wells,
workshops and roads. Construction requires real labor and materials. Useful assets provide
specific benefits and require upkeep where appropriate.

Replace the shallow generic-goods loop progressively with useful production chains, such as:

> Gather or mine materials → make tools → improve farming → create a surplus → support
> specialists and apprentices.

- Tools and carts affect what work and transport are possible.
- Storage changes how long food lasts and how much a community can reserve.
- Roads make some journeys and trade routes more worthwhile.
- Workshops connect materials, skilled labor and useful finished items.
- Buildings and equipment can wear out, creating maintenance decisions and dependencies.

The resource list, recipes, building footprints, ownership and construction decisions remain
open. Choose a small connected set first, then expand where it creates useful consequences.

## 10. Skills, learning and the survival of knowledge

- People learn through practice and improve at particular work.
- Teaching and apprenticeships transfer skills between people.
- Children can learn from parents and other members of the community.
- A settlement can develop expertise over generations.
- Losing an expert matters if nobody else knows their craft.
- Knowledge can spread through migration, trade relationships and teaching.
- Progress should have causes within people's opportunities and activities.

The distinction between personal skill, a known technique and a new discovery needs design.
There is no agreed technology tree, invention schedule or final technological era yet.

## 11. Geography, trade and economic dependence

- Settlements have different access to fertile land, timber, ore and other useful resources.
- Those differences create reasons to specialize and trade.
- Transport requires time and carrying capacity; distance and spoilage matter.
- Routes become visible connections between places, with recognizable traders and loads.
- Trade relationships influence prosperity, diplomacy and migration.
- Interrupted trade has concrete consequences for the people and industries relying on it.
- Wealth can accumulate in productive assets and inherited property as well as coins.

Continue supporting the existing economic settings, including coins and shared stores.
Exact property rules, employment, debts and market institutions need refinement.

## 12. From villages to civilizations

Both individual lives and large-scale development are part of the destination.

- A settlement's growth rests on food, housing, transport, skills and occupations that can
  actually support its population.
- Towns develop identities from their history and circumstances: agricultural centers,
  market towns or places known for particular crafts.
- Several generations of decisions visibly change settlement layouts and connections.
- Trade and migration connect local lives to regional development.
- Political beliefs and disagreements can grow beyond the current sharing-versus-keeping
  question as new interests and institutions develop.
- Leadership, public spending, inequality and conflict affect actual households and work.
- Collective action and opposition grow through people's relationships and communication.

The form of cities, institutions, wider cultures and the eventual scope of civilization are
open questions. Do not assume a particular historical progression from this draft.

## 13. Equipment, weapons and conflict

Ric explicitly wants to see people's weaponry and equipment.

- At a readable zoom, show what someone is carrying or using: a farming tool, trade load,
  weapon or shield, for example.
- Inspection shows owned, carried and equipped items, with their condition where modeled.
- Equipment has real effects on work, transport or combat.
- Materials, makers, trade and maintenance determine equipment availability.
- Military service draws people and resources from the same economy everyone depends on.
- Conflict should be understandable through participants, equipment, causes and consequences.

The first implementation uses generic weapons and shields supplied through village goods.
Exact weapon types, additional armor, detailed supply arrangements and the player's combat
controls remain undecided. Visible items must correspond to actual simulation state.

## 14. Clarity, pacing and understanding causes

Every major system needs a way for the visitor to see its state and understand changes.

- Map activity should reveal work, construction, travel, trade and conversations.
- Inspection explains what someone is doing, their immediate goal and what is blocking them.
- Settlement panels explain shortages, prosperity and population changes using actual causes.
- History links important changes to the people, places and earlier events involved.
- Information connects the individual, household, settlement and wider-world views.
- Observation speed supports following daily life as well as skipping through generations.
- Pause and speed controls make conversations and important decisions readable.
- Optional pauses or notifications for consequential events are a proposal to refine.

Example of the kind of explanation wanted, once the relevant systems exist:

> Food reserves are falling. Six farmers joined the army, and imports from Westbank stopped
> when the border closed. About two months of food remain.

The map should support that account with reduced farming activity, the interrupted route and
the changing reserve. Explanations and estimates must be derived from recorded state and
qualified when uncertain.

## 15. How these systems connect

Illustrative chain from the discussion:

> Better tools increase harvests → a surplus supports apprentices → workshops grow → the
> village depends on imported ore → a dispute interrupts trade → tools wear out → harvests
> decline → people question their leader.

Another connection: a farmer wants a better home, creating demand for building work. Their
child becomes an apprentice, linking the family's opportunities to the town's development.

These are examples of possible outcomes. Their value is that each link has an actual cause;
they are not scenarios the engine must force to happen.

### Time must support the activities

The twenty-minute day at 1× was a settled requirement from 2026-11-12; on 2026-11-14 Ric made it five minutes so generations can be watched. The rest of the daily
schedule is still a design question. At that pace, a 365-day year takes about 121 hours and
40 minutes of uninterrupted real time; at the current 16× maximum, about 7 hours and 36 minutes.
Watching generations therefore needs a deliberately designed fast-forward experience or a
continuing saved world. Neither is implemented by merely adding a calendar label.

The former engine separated frequent actions from 200 demographic updates per year and ran a
shortened economy in headless experiments. That discrepancy was removed on 2026-11-12. All entry
points now execute the same walking/work steps, hourly needs and daily decisions. Equivalence
checks compare full state for the same simulated day. No events are inserted to make that day
interesting, and fast-forward does not shorten lives or multiply harvests.

The first daily quantities are documented in the README: adult-day rations, age-scaled child
needs, sixty-day crop-stock replenishment and daily wage units. They are implementation choices
following Ric's food direction, not claims of medical/agricultural accuracy. Stock replenishment
is not seasonal cultivation. Before adding crops or storage, decide growth stages, planting labor,
yields and spoilage using these units.

A real clock makes century-long runs computationally expensive. Routine tests cover bounded
daily presets and controlled imminent lifecycle/leadership boundaries. Old generation experiments
remain opt-in and have not validated this new economy. Faster generation-scale observation,
persistence and long-term balance remain open; do not reintroduce a different simulation to
make a headless century cheap.

## 16. Proposed development order

This order was suggested during the conversation; Ric has not settled it.

1. **Finish making the existing people readable.** The first pass of figures, activity labels,
   conversation connections, following, pacing and body separation has shipped. The population
   browser and living-family navigation have now shipped too. The conversation
   inspector has shipped with recorded effects, and the first equipment set is backed by actual
   goods, ownership, condition and effects. Continue reviewing visual clarity; detailed equipment
   production remains part of the next village systems.
2. **Make one village worth watching.** Households, seasonal farming, storage, tools,
   construction, learned skills and explanations of growth or shortages.
3. **Deepen social interaction.** Shared memories, teaching, purposeful conversations,
   agreements and follow-through, developed alongside the activities they concern.
4. **Add control over meaningful activities.** Use the same actions as autonomous people;
   decide the first controllable activities and release-to-autonomy behavior.
5. **Connect communities across generations.** Specialization, trade dependence, migration,
   inheritance and the growth of distinct towns and larger societies.

Initial suggested milestone: one village that is engaging to watch for ten minutes, where
the visitor recognizes people and understands what is changing. The systems above overlap;
this is a discussion aid, not a fixed implementation schedule.

## 17. Experiences to use when reviewing progress

- Find a particular person from the population, select them and follow them through a crowd.
- Immediately identify both participants in a conversation and read the whole exchange.
- Understand a person's current work, destination and reason for an important decision.
- Follow an agreement from request through fulfillment, delay or refusal.
- Recognize equipment on the map and understand its practical effect in inspection.
- Follow a skill from an experienced worker to an apprentice and into the next generation.
- Explain a village's shortage using actual labor, reserves and trade conditions.
- Take control of a person, make a meaningful choice, then return them to autonomous life.
- Revisit a family or town and understand what changed and which events contributed.
- Observe distinct settlements developing from different resources and histories.

These are design review goals, not claims about tests or current feature support.

## 18. Questions for refinement

- What should controlling a person feel like: direct movement, action choices, setting goals,
  or a combination? Which decisions stay autonomous?
- What visual style makes individuals and equipment recognizable at the intended scale?
- With the five-minute day at 1× (2026-11-14), what daily schedule and fast-forward experience
  support both individual lives and generations? Should reading an exchange pause automatically?
- Which farming, materials, building and production systems form the first connected set?
- How should people choose projects, own property and coordinate shared work?
- How much conversation history, personal memory and family history should persist?
- How should skills, teaching and discoveries differ?
- How far should civilization develop, and which institutions should emerge along the way?
- How detailed should weapons, combat and military supply become?
- How should a continuing world be saved and resumed? Persistence is a supporting proposal;
  its scope and storage approach were not settled in the conversation.

## 19. Keeping this master file useful

Refine this document as Ric makes decisions. Record the date and reason when a proposal is
accepted, changed or dropped. Keep his stated requirements distinct from suggested solutions.
Update the README when features actually ship; a feature's presence in this vision does not
make it implemented. Keep all of the connected themes here as the design develops.

**2026-11-12 baseline review:** added the shipped readability work, Ric's explicit pacing and
body-separation requirements, a bounded proposal for finding people, and the unresolved timing
problem that must be addressed before treating long-term economic outcomes as validated.
**2026-11-12 population milestone:** Ric chose implementation of the next features. Built the
People browser, preserved filtered-list navigation, living-family/current-partner links and
selection of either conversation participant. At that milestone the timing redesign, equipment
and the larger village/civilization systems remained future work.

**2026-11-12 conversation milestone:** built the held exchange inspector and observational receipts,
with a return from participant inspection and original-place navigation. Checks cover real grain
transfers, effects made after speech, stable IDs and retention after history eviction. A comparison
against the pre-change engine found identical trajectories for the same seeds and elapsed time;
recording conversations must remain observational.

**2026-11-12 equipment milestone:** implemented the first useful equipment set after Ric's
"continue". Costs, capacity/damage modifiers and wear rates are initial implementation choices,
recorded in the README. Checks cover actual transfers and effects, repair costs, inactive/broken
states, coin conservation and salvage. At that milestone the compressed-century/preset checks
still applied; the daily-clock milestone below supersedes that evidence.

**2026-11-12 timing/food milestone:** unified frame, headless-hour and batched advancement; made
food an hourly-consumed daily supply with age-scaled child needs and store coverage estimates.
Retained the old long experiments explicitly, replacing routine compressed-century claims with
same-world parity and seven actual days per preset. Long-term balance remains unmeasured.

**2026-11-13 decision milestone — the one thing under all of section 15.** Ric: *"what you change
doesn't change a lot for the people day to day... i want to make it a more realistic sim"*, and
*"lets make that work right first"*. This is the piece section 16 did not have as a numbered step:
it was folded inside item 3, and items 2 and 3 cannot work without it.

Measured first (`test/behaviour.mjs`, a measurement and not a check). Of thirty-one settings,
twenty moved an adult's day less than half as much as rerolling the seed did; the median moved
0.6% of an adult's hours and twelve moved none at all. The causes were structural, not a matter of
tuning: a day was five fixed scripts chosen by job title, a day's field work took six simulated
minutes and fed a household three times over, and "how much it grows" only changed how fast a
field refilled — never its ceiling, so thin and rich land fed a farmer the same. 54% of an adult's
hours went on walking and 0.1% on harvesting.

Built: needs beyond food (rest, time alone, fear); hours that cost hours; one appraisal where
every option a person has is scored against what they need, what the walk and the risk cost and
what they are good at; occupations that read the same figures as the daily choice, so a label and
a life cannot disagree; and houses, because bodies cannot overlap and a village whose whole
population aims at one tile at bedtime jams solid. The person panel now shows the need that won
alongside what they are doing, read off the same `urgency` the engine decided with.

What this does **not** do, and should not be claimed: there are no agreements, no promises, no
memory of an unresolved matter, no skills that grow with practice and no buildings. (Seasons came on 2026-11-14 — see below.)
A person compares the options in front of them *now*; they do not plan, and nothing they decide
today is remembered as a commitment tomorrow. Sections 6, 7, 9 and 10 are untouched. What changed
is that those systems now have somewhere to plug in: each would be a new need, a new option or a
new term in a cost, rather than a sixth script.

**2026-11-14 follow-up.** Three fixes on top, all measured with the same harness. The walk code
never counted somebody sliding round a neighbour as stuck, so a fifth of a default world starved
within twenty days beside full, cheap stores; fixed, starvation in those worlds is zero and walking
fell to about 4% of adult hours. The land now sets how long a day in the fields takes rather than
how much it brings, so `rich` and `uneven` move a day within three days. And moving house is an
option in the same comparison, so `switch`, `crowd` and `memory` have a decision to enter — which a
fed, peaceful world almost never takes, correctly. README, "What a person decides to do".

The same day, sickness was brought down from a 22% death rate for everybody to about 3% for a fed adult, with children, the old and the hungry far more at risk; default worlds stopped shrinking. README, "Sickness is a village fever".

**Seasons (2026-11-14).** The year is now four settings — distance from the equator, how cold winter gets, when the world starts, and year to year — and with them came a harvest, putting by, asking neighbours for food, orphans taken in and famine migration, each because a year-long run starved without it. A hungry household can buy from the next village; grain trade by traders is still open, since traders read an empty store. README, "The year".

Ric's framing for why this came first: the Apocolips idea (a 3D apocalypse sandbox, city and
rural, choose the conditions and follow the people) is the same engine under different pressures.
With job scripts an apocalypse would have had to be a sixth script; with an appraisal it is new
pressures and new affordances fed to the same machine.

## 2026-11-14 review — boxes and market journeys

Ric: "people can be boxes" and "people dont travel to other places much seems like they get
stuck at vilages". People and the miniature now use boxes, retaining smaller children, colour
views, equipment and leader rings. Blocked walkers can take bounded routes around crowds;
nearby daily tasks retain bounded arrival allowances, while enclosed couriers still need an opening. Fed traders may choose to check another safe
market when there is no profitable cargo. That choice competes with the newer daily needs
and work system; it never schedules a journey for everybody or invents a load or profit.
The existing decisions, household work sites and migration are preserved. Seasonal cultivation,
roads, persistence and direct control remain separate future work.

## 2026-11-14 — Ric's next list

Ric, after ruling, graphs and grain trade went in. Recorded whole so later work builds toward it;
the order is the one agreed in that conversation, each a piece of its own, measured on year-long
runs before it is called done.

1. **Military reach.** Make it depend on food carried and access to resupply, distance from
   friendly settlements, equipment replacement, the farm labour lost to recruitment, and
   recovery after losses. **First version built 2026-11-14** (README, "War has to be fed"):
   rations, resupply only at home, refitting, slow raising, the wounded go home. Still open:
   foraging and plunder in enemy country, and supply lines that can be cut.
2. **Production and accounting.** Actual inputs: materials become goods, goods become equipment.
   Demand tied to household needs and equipment replacement. Occupations that change on whether
   the work actually supports the household. A clear ledger of production, consumption, stocks
   and shortages.
3. **What people know, not what exists.** Traders remember prices from their last visit;
   travellers bring reports about other villages; reports go out of date; experience teaches
   which routes, jobs and neighbours are dependable; people sometimes make reasonable decisions
   on wrong information.
4. **Relationships and memories with consequences.**
(2026-11-14, before the list was begun: the world went still — no expansion, no ambition, no
wars — and that was fixed first; README, "A world that does not go still".)
5. **Households and politics, joined** — what a tax, a conscripted son or a lost harvest does to
   one household, and what that household then does about it.

## 2026-11-14 — The simulator, whole

Ric described the whole thing in one conversation and then asked for it "on paper in clear
words". This section is that paper. It sits above the numbered sections in authority: where an
older section disagrees with what Ric said here, this is the newer word. As everywhere in this
file, what he said, what was measured and what is only proposed are kept apart.

### What it is

A simulator of people. You choose the settings, press start, and it goes. It should be able to
start "essentially any scenerio you can think of", and then you watch the little people live it.

His example of the kind of question it should answer — an example only, not something to build
for: "what if money was almost nonexistant and there were two tribes next to each other tht
hated each other." And the kind of story it should be able to produce by itself: two tribes two
kilometres apart "fighting a war that was decided a couple years prior and a new chief gets
chosen and ends the war daplomacly."

"i want the ability for antything to be able to happen and your able to see and follow all of it."

### What Ric said it must have

**Land.**
- You choose how big the land is. The smallest is about 2 km². The largest is about the size of
  a state, measured as land, in km².
- You can choose to make the land "more involved with cities or towns". All of it is a choice.

**People.**
- You choose what the people are "kinda like", and they must be able to be "pretty realistic".
- Every person is real, always. Nobody far away is replaced by a total.
- A person should be small: "each person only needs like 10 traits that can be a number 1-10
  and those numbers can change based on cercumstances that happen in a area that would effect
  them." And: "a person can hold a certain number of bits of information."
- How many people there are has no fixed limit: "the number of people should be infinite just
  based on can your computer run it."

**Time and era.**
- "old times new times". Probably older times first. Modern counts, but "the money can be simple
  the stores can be simple. just the building and weapons and travel really change more."

**War.**
- "i want war to be accurate to the time and i want the aftermath of war to be accurate too."

**Catastrophes and control.**
- "nukes apocolypses". You can change things while it runs: "you can be in control", and also
  "drop a nuke start a zombie apocolypse. or any other apocolyps astroid volcano erupts. or
  anything."

**Communication.**
- "i think comunication needs to be fixed probably or at least improved."

**The computer.**
- "i want there to be a way that i can see what my limit will be because of my computer. but if
  a friend has a better one i want them to be able to push those limits."
- It should not cost much to run: "i feel like right now im running it inefficiantly."

**How it looks.**
- "the visuals shouldnt be phenominal." People are "tiny dots (or squares)". Zoomed in you see
  "the green land their farming and the brown box of a house they live in". Zoomed out you
  "barely even see them or not see them at all."

**How good it has to be.**
- "decently accurate and complex. and working well all around."

### What was measured the same day

On Ric's computer (Apple M1, 8 GB), with the engine as it stood. The script was run by hand and
is not in the repo; rerun the measurement before quoting these as current.

| People | Land | Memory | One day takes | Fastest speed |
|---|---|---|---|---|
| 400 | 17 km | 3 MB | 0.7 s | 408× |
| 2,000 | 17 km | 3 MB | 12.6 s | 24× |
| 5,000 | 40 km | 6 MB | 24 s | 13× |
| 20,000 | 80 km | 33 MB | 129 s | 2× |
| 400 | 500 km | 89 MB | 0.5 s | 625× |

- **Memory is not the limit.** A person is 61 fields and about 1.5 KB. That matters near a
  million people, not before.
- **Land costs almost no time.** 400 people run as fast on 500 km as on 17 km.
- **Time is the limit, and most of it is wasted.** About three quarters of the time goes on the
  check that stops people walking through each other, yet a person moves in under 3% of their
  steps. The rest of the time they are asleep, making something, idle or eating, and the engine
  still visits each of them 1,440 times a day.
- With that check switched off (the "bodies" setting), 5,000 people go from 13× to 58× and
  20,000 from 2× to 8×. After that, choosing and working are the next cost.
- Starting a 20,000-person world takes 24 seconds, nearly all of it finding everybody a place
  to stand.

### How to build it — proposed, not agreed

Ric's answer to these was "im not sure". Nothing below is decided. Do not build from it without
asking him.

**One rule.** An era, a catastrophe and a scenario are all made the same way: as numbers, and as
things put into the world. Nothing ever says "now a war starts". This is the rule the sandbox
already keeps ("nothing is scripted"), carried to everything new.

1. **An era is numbers.** How many people one farmer feeds. How far a weapon reaches and how
   deadly it is. How fast people and news travel. What a house is made of and how many it
   holds. Old to modern is those numbers changing.
2. **A catastrophe on the land is one tool.** A place, a size, what it does to people, buildings
   and soil, and for how long. A nuke, an asteroid and a volcano differ only in their numbers.
3. **A catastrophe in people is one tool.** A condition somebody carries, that spreads, and that
   changes their body and what they want. Plague, radiation sickness and zombies are the same
   mechanism. A zombie is the same real person, turned.

**A person in three parts.**
- *Nature:* about ten traits, each a small number, inherited, moved slowly by what happens to
  them.
- *Body:* hunger, rest, health, age, where they are.
- *Mind:* a fixed number of slots, set by the visitor. One slot is one thing known or felt: who
  or what it is about, what kind it is (friend, grudge, debt, news, skill), how strong, how old.
  When the mind is full the weakest goes.

**Communication is passing a slot.** Whether it is believed depends on trust. It can arrive
weaker or changed. What appears on screen reports the slot that moved, so a rumour can be
followed from person to person. (This is item 3 of Ric's earlier list, "what people know, not
what exists", and it keeps the rule that speech reports what happened and never causes it.)

**War.** A leader decides from their people's grudges and their stores. Soldiers are real people
taken from the fields. Afterwards the dead are missing from their households, and the grudge
stays in the minds of the living. A new leader with a different nature can end it.

**Land.** Village, town and city are sizes a settlement grows into, not types. The visitor
chooses how settled the land is at the start.

**Drawing.** Three levels by zoom: settlements and borders, then fields and houses, then people.

**Speed.** Stop visiting people who have nothing to do; someone asleep until dawn should cost
nothing until dawn. Make the walking check cheap. Run the engine off the page's own thread.
Pack people into plain number arrays only when the count makes memory matter.

**The computer's limit.** Run a short hidden test world on the setup page and say what this
computer can carry at what speed. The sliders show the mark and do not stop anybody going past it.

### Decided since (2026-11-14, later the same conversation)

- **This is not a pivot.** Ric: "existing engine is good it just needs to be cleaned. eveything in
  the engine needs to be built to work smoother but alot fo the things in there i want." And:
  "this istn a pivot. its the things that this is missing." So the engine is kept. The work is
  making what is there run smoothly and adding what is missing. Do not rewrite it, and do not
  drop a mechanism it has without asking him.
- **Modern times are in, and so are the things they depend on.** Ric: "modern times sure but that
  meance cell towers must be a thing too". Instant news is not a switch. A phone works only within
  reach of a tower, and a tower is a building that can be built, lost in a war or flattened by a
  catastrophe. Where there is no tower, news goes back to walking speed. (The same rule is
  proposed for anything else modern: it exists as a thing in the world, never as a setting alone.)
- **Grudges reach children both ways.** Ric: "childern can eherit. or hear. it needs to be a mix
  of both". A child starts with some of what their parents feel, weaker, and also picks up more
  by being told, like anybody else.

### The ten traits — agreed 2026-11-14

He asked which ten matter most, "the ones that drive their decisions", and said yes to this list
("Yes, those ten"). Each is there because it decides a choice the engine already makes or needs
to make. Five are in the engine today; the other five are not built yet.

| Trait | What it decides |
|---|---|
| Bold | Whether to take a risk: fight or run, travel, settle new land. (In the engine now.) |
| Warm | Whether to give, share and help somebody else. (In the engine now.) |
| Greedy | How much is enough: keep working and hoarding, or stop. (In the engine now.) |
| Stubborn | How hard it is to change their mind. (In the engine now.) |
| Loyal | Their own group or themselves, when the two pull apart. (In the engine now.) |
| Patient | Now or later: store for winter, save, wait years for revenge. |
| Hot-tempered | How fast anger becomes an act: a fight, a feud, a killing. |
| Hardworking | How much they do when nothing forces them to. |
| Curious | Whether to try the new thing: a job, a place, a tool, an idea. |
| Honest | Whether to steal, lie, or keep a promise when breaking it would pay. |

Left out on purpose, and the first to swap in: **ambitious** (wanting to lead). For now, wanting
to lead is read from bold, greedy and loyal together. What somebody believes (`views` in the
engine) is not a trait: it is something held in the mind, and it moves by talking.


### The list — everything to figure out, then build

Ric, 2026-11-14: "you need to make a list of what to do. because i didnt see any mentioning of
the land and how it looks. i can barely tell whats livable whats a forrest. what is a beach. seeds
should decide all that. water, city... water isnt in there either. … there is alot to figure out
and i will have you do it when its figured out".

So this is a list of things to **settle with Ric first**. Nothing on it is to be built until he
says that item is figured out. "Now" is what `people.js` and `index.html` had on that date, read
from the code. Tick an item here, with the date and his words, when it is settled, and again
when it is built.

**1. The land**
- Now: each square has two numbers, how well it grows and how much ore. It is drawn as one
  brown-to-green wash. There is no water, no height, no forest, no coast.
- [x] What kinds of ground there are: sea, lake, river, beach, marsh, grassland, forest, hills,
  mountain, desert, and which of them people can live on. (2026-11-15, TODO 4a: eleven, with snow
  and ice, Ric's choice; dry land stands for desert.)
- [x] The seed decides all of it (Ric: "seeds should decide all that"): height first, water runs
  downhill into rivers and lakes, forest and grass follow from water and warmth. (2026-11-15, 4a.)
- [x] What each kind gives: wood from forest, fish from water, stone from hills, game, grazing.
  (2026-11-17, TODO 9.)
- [x] What each kind costs: slow to cross, can't be farmed, can't be crossed without a boat or
  a bridge. (2026-11-16, TODO 4a and 4b: paces by kind, nothing farmed on water, marsh, mountain
  or snow, the sea and lakes not walked; 6d: big rivers at fords and bridges, boats.)
- [x] How it is drawn so anybody can tell at a glance what is livable, forest, beach and water.
  (2026-11-16, TODO 5: colour, marks and relief; Ric named all eleven kinds on a new seed.)
- [x] How much of each the visitor chooses (mostly sea, one big river, all forest) and how much
  is left to the seed. (2026-11-15, 4a: how much sea, rivers, forest and hills; the seed the rest.)
- [ ] Size. The smallest is 5 km across now; Ric wants about 2 km². The largest is 500 km across;
  a state is roughly 500 to 1,200 km. A square is 250 m, which is too coarse for a 2 km² world:
  a house and its field would be one square. The square has to get smaller as the land does.
- [ ] Land that changes: cleared forest, worn-out soil, flood, fire, land that recovers.

**2. Water**
- Now: none. People need only food.
- [x] Drinking water as a need, and where it comes from: river, lake, well, rain.
  (2026-11-16, TODO 6a: rivers, lakes and wells; 6b: rain fills the pots.)
- [ ] Water as the reason places are where they are: villages by rivers, towns at crossings and
  harbours.
- [x] Water for crops: rain, dry years, irrigation.
  (2026-11-16, TODO 6b: rain by place and year, dry years, river flats spared; irrigation is not
  built by anybody yet.)
- [x] Water as road and wall: boats, fords, bridges, an army stopped by a river.
  (2026-11-16, TODO 6d.)
- [x] Fishing as a way to live. (2026-11-16, TODO 6c.)

**3. Places and buildings**
- Now: a village is a point with a store. A house is a spot where a family sleeps. There are no
  fields as things, no roads, no walls, and a village never becomes anything else.
- [x] Houses and fields as real things on the map, the brown box and the green land Ric described.
  (2026-11-16, TODO 7a: houses are buildings with a real size, by wealth, and a family sleeps
  inside; fields as land is 7c.) (2026-11-16, 7b and 7c: houses built by families and builders,
  fields held by each faction's own rule, hedged on the map.)
- [ ] Other buildings: store, workshop, market, wall, well, bridge, harbour, and in modern times
  the cell tower.
- [x] Roads and paths: built, or worn in by people walking. (2026-11-16, TODO 7d: worn in;
  nobody builds a road on purpose yet.)
- [x] How a village grows into a town and a city, and what a city needs from the land round it.
  (2026-11-17, TODO 8: by the food brought into it.)
- [x] The start: empty land, villages, towns, or cities already standing (Ric: "all of this
  being choices"). (2026-11-17, TODO 8: hamlets, villages, market towns, a city.)
- [ ] Ruins: what a dead or destroyed place leaves behind. Ric, 2026-11-14: "ruins... seems like it
  needs to be viable for scavengers as well". So a ruin still holds real things — food that keeps,
  tools, weapons, materials, shelter — and they run out as they are taken. Nothing is made up
  to be found: what is in a ruin is what was there when it fell, less what rotted and what
  others took first.
- [ ] A world that starts already ruined, as a choice at the start.

**4. A person**
- Now: five of the ten agreed traits (bold, warm, greedy, stubborn, loyal), set at birth and
  never moved by events. Needs for food, rest, company and safety. 61 fields, about 1.5 KB.
- [x] Add patient, hot-tempered, hardworking, curious, honest, and what each changes. (2026-11-17, TODO item 10)
- [x] How events move traits, and how fast (2026-11-17, TODO item 10: Ric, "A little") (Ric: "those numbers can change based on
  cercumstances").
- [x] The mind: how many slots, what kinds of thing a slot holds, how the weakest is forgotten. (2026-11-17, TODO item 11: Ric, 20, "A little", "Grudges last longest")
- [ ] Skills: learned by doing, taught, lost when the people who had them die.
- [ ] Health: wounds, sickness, old age, what a person can no longer do.
- [ ] What the visitor sets about people at the start ("what the people are kinda like").
- [ ] Making a person small in memory, once the count makes it matter.

**5. Talking and knowing**
- Now: two people who are close say a line picked from a short list. A person holds one piece
  of news. Friendships are a list.
- [x] Talking as passing something one person holds to another. (2026-11-18, TODO 12.)
- [x] Trust, and things arriving weaker or wrong. (2026-11-18, TODO 12: Ric, "1 in 20".)
- [x] People acting on what they know, not on what is true. (2026-11-18, TODO 12: news of war, and where food is; more is TODO 12b.)
- [x] Children: some inherited, some heard (decided: "a mix of both"). How much of each. (2026-11-18, TODO 12: up to four of each parent's strongest things, weaker.)
- [ ] News over distance by era: on foot, by rider, by letter, by radio, by phone within reach
  of a tower.
- [x] Following it on screen: who told whom, and where a rumour started. (2026-11-18, TODO 12: the person panel.)

**6. Making a living**
- Now: farming, one kind of "goods", ore, trade, coins or sharing, tools and packs made from
  goods.
- [x] Real materials: wood, stone, ore, cloth, and what is made from each. (2026-11-17, TODO 9:
  wood, stone, ore, wool and hides; Ric: "Few and clear".)
- [ ] Ways to live other than farming: fishing, herding, hunting, cutting wood, mining, and
  scavenging ruins — a living that lasts only as long as the ruins do.
- [ ] Money kept simple (decided). What "almost no money" means for how people trade.
- [ ] Who owns land and buildings.

**7. Eras**
- Now: one era, roughly a farming village with hand weapons.
- [ ] Which eras there are, from tribes to modern.
- [ ] What changes between them (Ric: "the building and weapons and travel really change
  more"): materials and size of buildings, weapons, travel, how many one farmer feeds, medicine.
- [ ] Whether a world stays in its era or can move on by itself over centuries.
- [ ] Modern things that must exist as things: towers, power, fuel, vehicles.

**8. War and after**
- Now: factions go to war and make peace, soldiers are real people, fights wear gear, armies
  need food from home (first version, 2026-11-14).
- [ ] War "accurate to the time": weapons, reach and deadliness by era, walls and sieges, raids,
  how far an army can go.
- [ ] Why a war starts and why it ends, from what the people and the leader hold in mind.
- [ ] After: the dead missing from households, widows and orphans, burned places, lost
  harvests, people fleeing, land taken, grudges that last.
- [ ] Peace: a new leader, a treaty, tribute, a marriage, and whether it holds.

**9. Leaders and factions**
- Now: chiefs, votes, the rich ruling, tax, relief, breakaways, the visitor ruling a faction.
- [ ] Factions that hate each other from the start, as a setting.
- [ ] Dealings between factions short of war: alliance, trade deal, tribute, threat.
- [ ] Who becomes leader, and how much their own nature decides what the faction does.

**10. Catastrophes and reaching in**
- Now: a sickness setting, and ruling a faction. Nothing can be dropped on the land.
- [ ] One tool for the land: nuke, asteroid, volcano, flood, fire, drought, earthquake, each a
  place, a size, what it does and for how long.
- [ ] One tool for people: plague, radiation sickness, zombies, each something carried that
  spreads and changes the body and what the person wants.
- [ ] How the visitor places one while the world runs, and whether one can also be set to
  arrive by itself.
- [ ] What else the visitor may change mid-run, and whether they can be one person.

**11. Watching**
- Now: one zoom range, people as boxes, a people list, follow a person, read a conversation,
  graphs, 400 remembered events.
- [x] Three levels by zoom: settlements and borders, then fields and houses, then people.
  (2026-11-16, TODO 5; the houses are drawn until item 7 makes them real.)
- [ ] A history that can be gone back through, so a war can be traced to what started it.
- [ ] Families and the dead: who somebody's grandparents were and what happened to them.
- [ ] Saving a world and coming back to it.

**12. The engine**
- Now: measured above. 20,000 people was the slider's top and ran at 2×.
- [x] Make the walking check cheap, with the same world coming out. (2026-11-15, `TODO.md` item 1:
  5,000 people 13× → 68×, 20,000 people 2× → 14×, identical worlds.)
- [x] Stop visiting people who have nothing to do. (2026-11-15, `TODO.md` item 2: asleep, at work
  or jammed, a person is passed over until their time is up or room is made; identical worlds;
  on the cloud machine it was built on, 20,000 people 6× → 19×, to be confirmed on the M1. The
  idle and people in conversation are passed over too since 2b the same day, which drew the
  dice for talking differently: a seed is a different world from before.)
- [x] Make choosing and working cheap as the crowd grows. (2026-11-15, item 2: who lives in each
  village is a kept list, so nothing a person chooses goes through the whole world; with bodies
  at real size 20,000 people 70 → 17 s a day. Asking a neighbour still grows with the village:
  now part of `TODO.md` item 11.)
- [x] Run the engine off the page's own thread. (2026-11-15, `TODO.md` item 3: a worker, kept by
  `people-host.js`, sent only what the page draws; the same keeper on the page's thread where a
  worker cannot be had. 20,000 people flat out: 7 frames a second → every frame.)
- [x] Starting a big world in seconds, not half a minute. (2026-11-15: 20,000 people, 25.7 → 2.6 s.)
- [x] No fixed top on the number of people. (2026-11-15, item 3: the slider sweeps to 20,000 and a
  typed number or a link goes past it. A very big world is still slow to *start* — four times
  the wait for twice the people. Item 3b, 2026-11-15: the same world starts 4 to 7 times sooner,
  100,000 people 102.6 → about 14 s.)
- [x] The readout: what this computer can carry, shown on the setup page, never a block.
  (2026-11-15, item 3: the world as set is made out of sight and run for three seconds, and one
  line under "How many people" says how fast it went — Ric's choice of three mock-ups. Right to
  about a third for a world's first days and not after. Item 3b, 2026-11-15: a world run on Max is
  remembered in the browser, and the line then says what it really held.)

**13. Being right**
- [ ] Where each real number comes from (yields, walking, weapons, sickness), written down
  with its source, as the README does for the year and for food.
- [ ] A year-long measurement for every new piece before it is called done, as now.

**Order.** Settled the same day: [TODO.md](TODO.md) is this list cut into twenty numbered items
in the order they are to be done, with the research, the questions for Ric, the speed budget and
the bug hunt each one needs. When Ric says "work on N", that file says what to do. Tick lines
here as that file's items ship.
