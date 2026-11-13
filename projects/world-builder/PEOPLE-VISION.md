# People sandbox — master vision

Started 2026-11-12 from Ric's discussion of the first People sandbox.
Status: living design draft, to refine together. Implementation baseline reviewed 2026-11-12.

This is the master record of the whole conversation about what the People sandbox should
become. It describes the destination and possible ways to reach it. It is not a claim that
these features exist, and it does not authorize implementing every proposal at once.
The [README](README.md) describes the implementation; this document describes the vision.
Several sessions have worked on the two sandboxes. Check the implementation baseline below
and the current code before starting a milestone; preserve work that has already shipped.

## Current implementation and the next piece

Reviewed 2026-11-12 against `people.js`, `index.html` and the README, following the readability
update in commit `88890e2e` and the population-browser milestone authorized by Ric: "Build the
next features from the vision". This table records implementation, not approval of all proposals.

| Area | What exists | What remains from this vision |
|---|---|---|
| Recognizing people | Human figures, smaller children, a leader ring and faction/mood/belief/wealth colour views. | Equipment and personal appearance. |
| Understanding actions | Close-up role/activity labels, an activity line in inspection, visible harvesting patches. | Reasons for choices, blocked-action explanations and lasting work sites. |
| Selecting and following | People list with name search, settlement/faction/job filters, pagination and preserved list position; select and follow on the map; living-family links and either Talk participant selectable. | Bookmarks, durable family histories and navigation to the dead. |
| Conversation | Real exchanges with a paired reply; named speech bubbles, a connection between participants, a recent Talk list, a held exchange with original context and before/after effects, participant navigation, map location and a short pause while speaking. | Longer interaction sequences, agreements and remembered follow-through. |
| Pacing and bodies | Twenty-minute days at 1×, slower walking, separate body positions and local avoidance of neighbours. | One consistent time model for daily needs, production and long-term development; reliable navigation through very dense crowds. |
| Work and society | Farming, generic goods, trade, families, leaders, factions, conflict and breakaways. | Seasonal cultivation, useful tools, buildings, learning and the connected economic systems described below. |
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

The next proposed readability piece is visible equipment backed by real owned/carried/used
items, as described in section 13. Agree on a small connected set of useful tools and their
availability before expanding production or combat. Multi-step agreements and remembered
follow-through remain separate social-system work.

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

Exact weapon types, armor, combat detail, supply arrangements and the player's combat
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

The twenty-minute day at 1× is a settled requirement from 2026-11-12. The rest of the daily
schedule is still a design question. At that pace, a 365-day year takes about 121 hours and
40 minutes of uninterrupted real time; at the current 16× maximum, about 7 hours and 36 minutes.
Watching generations therefore needs a deliberately designed fast-forward experience or a
continuing saved world. Neither is implemented by merely adding a calendar label.

The current engine separates frequent walking/work/conversation actions from 200 demographic
updates per year. Its compressed headless experiments also allow a different number of actions
per year from real-time playback. This is documented in the README; a century in that harness
is not evidence that the browser's economy will develop the same way.

Before adding seasonal farming or balancing a civilization economy, propose consistent units
for meals, harvest yields, production, travel, growth, aging and political terms. Fast-forward
should advance the same rules as normal observation. Test equivalent elapsed simulated time
through both entry points. Do not silently shorten lives, increase harvests or schedule events
just to make an interesting scene appear during a short viewing session. Quantities and any new
fast-forward controls need an explicit design decision; this paragraph does not choose them.

## 16. Proposed development order

This order was suggested during the conversation; Ric has not settled it.

1. **Finish making the existing people readable.** The first pass of figures, activity labels,
   conversation connections, following, pacing and body separation has shipped. The population
   browser and living-family navigation have now shipped too. The conversation
   inspector has now shipped with recorded effects too. The next readability piece is equipment
   backed by actual inventory. Validate each piece before calling this milestone complete.
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
- With the settled twenty-minute day at 1×, what daily schedule and fast-forward experience
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
selection of either conversation participant. The timing redesign, equipment and the larger
village/civilization systems remain future work.

**2026-11-12 conversation milestone:** built the held exchange inspector and observational receipts,
with a return from participant inspection and original-place navigation. Checks cover real grain
transfers, effects made after speech, stable IDs and retention after history eviction. A comparison
against the pre-change engine found identical trajectories for the same seeds and elapsed time;
recording conversations must remain observational.
