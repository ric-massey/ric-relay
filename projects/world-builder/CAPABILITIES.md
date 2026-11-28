# What the People engine does and works out

A list of everything `people.js` simulates and calculates, as of **2026-11-28**. It is a map, not
a spec: the reasons, measurements and history for each part are in `README.md` (the heading named
in brackets), and the order of future work is `TODO.md`. Part 1 is grouped by subject. Part 2 is
every setting the engine takes (158 of them), generated from `SCHEMA` in `people.js`.

Ric asked for it on 2026-11-28: *"make a file that has a list of everything people sim the engine
can doo and calculates"*.

If you add a part to the engine, add a line here too. To check Part 2 against the code, see the
command at the top of that part.

---

## Part 1 — what it does, by subject

### Time and the clock  *(README: "One clock and food measured in days", "A five-minute day …")*
- One clock for everything. At 1× a day is five real minutes; 365 days make a year.
- 5 actions per playback second, 250 per simulated hour, 6,000 per day. Walking and work happen
  every action; food, ageing and needs every hour; thinking and markets every six hours; villages,
  land, factions and the graphs' samples once a day.
- `advance(seconds)` and `step(hours)` go through the same code, so splitting time differently
  never changes the world. Speeds from 0.25× to 1000× only hand it more time; nothing is skipped.
- Run until the next day, season or year, stopping on the exact minute (done by the page's keeper).
- Each decision-maker has its own dice (a hash of the seed, who decides, the step and the draw),
  so the same seed and settings always give the same world.

### The land  *(README: "Land from the seed", "Crossing the land", "Land that changes")*
- Height in metres, generated from the seed, from about 2 km² up to 1,000 km across.
- Sea coming in over the lowest ground; lakes in hollows; ponds in wet ground.
- Rivers worked out by rain running downhill; how much land each river drains; river width; which
  way each stretch flows (eight directions).
- Eleven kinds of ground: sea, lake, river, beach, marsh, grassland, forest, hills, mountain,
  dry land, snow and ice. Each has its own fertility and ore.
- Soil that tires when farmed year after year (down to about half), recovers when rested or
  manured; forest cleared for fields and growing back.
- Fords and bridges; rivers too deep to wade; boat routes worked out by time with the current,
  across it and against it.
- Paths and roads worn by walking, plus roads built on purpose (about a kilometre a day, paid for).
- Ruins: empty buildings wear (roof, then walls, then a mound), and what was left in them rots.
- Sacred groves and peaks that nobody cuts or hunts.
- Each village's land is measured as a walk over the real ground. A people's land outside its
  villages goes through stages: a range, reach with a frontier, written border, surveyed border.

### The sky, the year and the climate  *(README: "One clock …", "Rain and dry years", "Climate over centuries")*
- Day length from the real sunrise equation (with the almanac's −0.833°), by latitude and date.
- A warmth curve over the year, a frost line, growing and not-growing seasons.
- Each year's own spring (up to three weeks early or late), warmth and yield (±30%), from the seed.
- Rain by place and by year; dry years; river flats spared.
- Climate drifting over decades and centuries (warmer or colder, wetter or drier).
- Sleep that follows the night, including two sleeps in long northern winters.

### Food, water and fuel  *(README: "One clock …", "Water to drink", "Fishing", "Grinding and baking")*
- Food is counted in adult-day rations. Children need 0.35 a day at birth, rising to 1 when grown.
- Fields hold growing crops up to a limit set by fertility, grow back, ripen at harvest and are
  lost to the frost if they are not brought in.
- How long a day in the fields takes, set by the land (five hours on ordinary ground, at most nine).
- The harvest, and putting food by for winter (`winterAhead`): the lean days ahead, the cold, the
  hungry gap, and each child's need.
- Hunger hours building up and hurting health; starving over weeks (set by "Going hungry").
- Water kept at home and fetched; wells dug where fresh water is more than a kilometre off; thirst.
- Fishing from rivers, lakes and the sea (with real yields per hectare), and fishing boats.
- Grinding by hand (saddle quern, rotary quern) or at the mill, and baking at home or the oven,
  paying a share.
- Firewood: households or the village burn it in the cold, buy it or cut their own.
- Irrigation ditches dug after a dry year.
- Asking a neighbour: family, then friends, then whoever has the most; buying from the next
  village; orphans taken in.
- Spoilage, grain stores, the government's grain, rationing, relief.
- News of plenty passed by word of mouth, which draws traders and the hungry.

### Bodies and lives  *(README: "Babies, children and mothers", "Men and women", "Wounds and old age")*
- Every person is a real individual, half a metre wide at real size, who can't walk through others.
- Ageing, a lifespan, growing up, men and women, pregnancy (nine months), lying-in, birth.
- Babies' and children's deaths from fevers, the flux, hunger, cold and accidents; deaths in
  childbirth.
- Children working from about seven, more as they grow.
- Sickness: a seven-day village fever passed on in conversation (15% a time). It kills about 3% of
  fed adults, about three times that for the young, the old and the hungry. Surviving gives lasting
  immunity.
- Dirt in towns: waste fouls wells and the river below a town, which kills.
- Wounds that heal over months, lameness, the old slowing down.
- Need for rest, company and safety (`rest`, `alone`, `fear`), turned into 0–1.4 wants.
- Experience in each kind of work: gained by doing it, fading when unused, and changing work costs.

### What a person decides  *(README: "What a person decides to do", "Working together, and friends")*
- One comparison over every option: sleep, eat, the fields, the bench, carry a load, stand guard,
  find somebody, fit tools, rest, move house, scavenge, and others. Each is scored by needs, the
  walk, the risk and what the person is good at.
- A job is what somebody is good at, not a script. `chooseJob` and the daily choice read the same
  figures.
- Working together in the fields beside housemates, friends and neighbours.
- Moving house, weighed against partner, children, friends and the flag.
- Walking: routes around crowds (A*), routes around water, rough ground is slower, impossible
  journeys refused, remembered dead ends.
- Taking to the road when poor and hungry; bands moving camp; strangers arriving from beyond the
  edge of the map.

### Nature and the mind  *(README: "The ten traits …", "The mind …", "Talking as passing what you hold")*
- Ten traits per person (bold, warm, greedy, stubborn, loyal, patient, hot-tempered, hardworking,
  curious, honest), passed down from parents with variation.
- A mind with a fixed number of slots: friends, grudges, debts, news, who has food to spare,
  opinions. When it is full, the weakest thing goes.
- Talking passes on news, opinions, friendship, loyalty and sickness. Each conversation is written
  down along with what it changed.
- Tales that change as they are retold (a number grows, the wrong village, the wrong side).
- One argued question (share what is grown, or keep your own), and opinions moving through talk.
- Loyalty to a faction, worn down by hard times, taxes and leaders a person disagrees with.
- Friends, grudges, family feuds, revenge for a killing, wergild.

### Households, houses and towns  *(README: "Building houses", "Where houses stand", "Villages, towns and cities")*
- Households as one purse and one pot. Couples, children, carers.
- Houses built by the family or by a paid builder, sized by wealth; the family sleeps inside.
- Village layouts read from the land and from custom: a street, along water, round a green, a
  cluster, scattered farms, a grid, a ring of huts.
- Villages fill up and split; new ones are founded; a village grows into a town or a city by the
  food brought into it.
- Workplaces and livings a place needs and can pay for: healers, teachers and more.
- Housework: cooking, minding small children, spinning.
- Working animals: oxen for the plough and horses for carts, bred, worn out, eaten in famine,
  driven off.

### Work, goods and equipment  *(README: "Wood, stone, ore …", "Made to order", "Equipment …")*
- Farming, herding, hunting, fishing, cutting wood, quarrying stone, mining ore, wool and hides.
- Crafters make to order (orders, plus about a season's stock), not into an empty store.
- Real equipment in each person's `gear`: work tools, trade packs, weapons, shields. It is bought,
  worn, repaired, stored, broken and salvaged, and helps only while it is fit for the job.
- Traders, carts, boats, caravans on pack animals, grain by river.

### Money and markets  *(README: "Where money comes from", "Where the coins go", "Treasuries …")*
- Coins and markets, or a shared store with no money at all.
- Prices that move with shortage, or are fixed by law.
- Silver mined with ore, coins struck, worn, lost, hoarded, debased. Every coin made or lost is
  counted (`count.minted`), so the total always adds up.
- Taxes on people and on the harvest, tithes, tolls, rent, tribute, tariffs.
- Treasuries that pay soldiers and officials and push spare coin back into the villages.
- Soldiers' pay with deductions for food and kit; spending at the village store; alms and loans for
  the penniless; inheritance by children, the faction or the village.
- Land as property: held, inherited, sold, pledged, worked for half, and quarrels over land.

### Know-how and eras  *(README: "Know-how …", "How technology moves", "Eras")*
- 27 kinds of ordinary know-how, each with the know-how it needs first: farming, wells, boats,
  carts, bridges, the plough, ditches, smithing, weaving, writing, crop rotation, the water mill,
  the horse collar, herbs, steam, iron, horses, printing, gunpowder, the railway, the telegraph,
  the engine, medicine, radio, the telephone and its towers, striking coins, and the telephone.
- 18 kinds of war know-how: bronze, the chariot, the composite bow, steel, the crossbow, the
  stirrup, cannon, drill and volleys, the bayonet, rifled breech-loaders, high explosives, the
  machine gun, lorries, the tank, the aeroplane, the jet, the helicopter, guided weapons.
- Discovery built up through work (faster for the curious and the hard-pressed); hearing of a thing
  is not the same as knowing how to do it; learning beside somebody who does it; apprentices.
- Know-how lost and found again; writing and readers keeping it.
- Nine eras (foragers to the information age). The era is read from what a people knows and never
  decides anything itself.

### Power and government  *(README: "Government …", "Leaders and factions that deal with each other")*
- Factions with a leader, a treasury, a tax and a view of every other faction.
- Leaders who are elected (every N years), chiefs for life who pass it to their child, or simply
  the richest; revolutions against chiefs or the rich.
- Councils, officials and laws; letting the ruler be the player (tax, army, relief, war or peace,
  marriages).
- Breakaway villages, civil war that comes out of loyalty (never scripted), people changing sides.
- Food riots, bandits on the roads and in bands.
- Alliances, peace by marriage, trade deals, tribute, letting others cross your land.

### War  *(README: from "Why wars start and end" to "Coming to a place")*
- Wars that need a grievance or hunger, and a leader bold enough who thinks they can win. Peace
  when a side is tired of it.
- Armies gathered, fed from what they carry, led by generals who scout and choose their ground.
- Units in formation with real officers; only the front ranks strike; a battle is over in a day.
- Battle given by choice when the odds suit; armies resting after a battle; armies meeting on the
  march.
- Weapons and armour by what a people knows and can pay for: bows, chariots, horsemen, guns,
  armies spreading out as weapons grow deadlier, tanks, aircraft, blasts and what is left in the
  ground afterwards.
- Raids that take and go; sieges, walls, ramps, rams, trebuchets, cannon; starving a place into
  surrender; demands to surrender; armies camping outside before they go in.
- Sickness in camps, wounds that kill later, deserters, mutiny, prisoners and ransom, parole, war
  loans, the unfree, conscription, the fighting season, people at home working harder.
- Quarrels between villages; piracy and boats lost at sea.

### Faith  *(README: "Faith", "What faith does", "Faith, deeper")*
- Folk belief from the start (ancestors, spirits of places). Faiths made up after hard times;
  prophets; sects; faiths that meet, borrow from each other and change.
- What a faith can hold: rites, rules, foods, the sacred, the afterlife, who may lead it.
- Heaven's favour held against a ruler; blaming a neighbour (witch hunts); faith passed down from
  the ruler; fleeing for faith.
- Effects on children, trade trust, health, reading, war (truces, martyrs, holy wars), oaths and
  courts, sanctuary, rank.
- Feasts, the day of the dead, rites of a life, pilgrims, shrines, great temples, tithes.
- Zeal fading with reading, towns and other faiths nearby.

### The record: what it counts and shows  *(README: "Why things happen", "The People page, rebuilt")*
- **369 counters** (`count.*`): births, starved, sick, battle deaths, wars, peaces, harvests,
  thefts, riots, roads built, coins minted, prophets, pilgrims, and so on.
- A sample once a day for the graphs (up to the last 600): population by faction, food per head,
  price, share hungry, loyalty, births, deaths by cause, moves, people changing sides, grain, wars.
- An event log that says *why* (the numbers behind each decision), and chains of "because" between
  events. These only report and are never read back into a decision.
- A transcript of every conversation and what it changed.
- What each person can be asked: needs, food in days, traits, what they hold in mind, ties, gear,
  experience, where they are going and why.
- A village's food in days, its wealth, spare and short food, its water foulness.
- Eleven map views: factions, mood, beliefs, wealth, hunger, sickness, loyalty, faith, land,
  roads and trade, war.

### Speed and scale  *(README: "A crowd that costs what it should", "Off the page's thread …")*
- No upper limit on people; the setup page measures this computer and tells you what it can run.
- Runs in a Web Worker. The page is sent only what it draws.
- Short cuts that are only ever faster: people with nothing to do are passed over, blocked steps
  and dead ends are remembered, kept lists stay up to date. Tests hold the world identical with
  every short cut off.

### Not done yet  *(README: "Not done"; `TODO.md`)*
- Nobody remembers a dead friend. Soldiers attack only soldiers. No sound.
- Saving a world (TODO 19 and 21h). Detailed production chains. Zooming in to fine detail worked
  out from the seed.

---

## Part 2 — every setting (158)

Generated from `SCHEMA` on 2026-11-28. Format: **key** — label (range or choices; default; *live*
if it can be changed while the world runs). To list them again:

```
node -e "const P=require('./projects/world-builder/people.js');for(const g of P.SCHEMA){console.log(g.title);for(const i of g.items)console.log(' ',i.key,'-',i.label)}"
```


### The land

- **map** — How much land (1.5–1000; default 17). Measured in kilometres, east to west, from a village's own land (about 2 km², one village watched house by house) up.
- **rich** — How much it grows (0.2–2; default 1; *live*). How fast food grows, and grows back.
- **uneven** — How uneven it is (0–1; default 0.6). Uneven land gives some villages more than others.
- **sea** — How much sea (0–0.7; default 0.15). The sea comes in from the edges over the lowest ground.
- **rivers** — How many rivers (0–1; default 0.5). Rain runs downhill to the sea or a lake.
- **forest** — How much forest (0–1; default 0.4). Forest grows where it is wet.
- **hills** — How hilly (0–1; default 0.4). Steep ground is hills; steep and high is mountain.
- **edge** — Beyond the edge (Nothing — nobody comes or goes / More of the world — strangers come, and some leave; default Nothing — nobody comes or goes). Open, the land is a piece of a bigger world: now and then a stranger walks in from beyond the edge looking for a place, more when the land is short of people, and the hungry who live near the edge may leave it for good, taking what they have.
- **landchange** — Land that changes (Soil tires and rests; forest is cleared and grows back / The land never changes (simpler); default Soil tires and rests; forest is cleared and grows back). A field farmed year after year gives less, down to about half, and comes back when it is left to rest or is manured by the herds.
- **seed** — Seed (1–9999; default 11). The same seed and settings start the same world.

### The year

- **latitude** — Distance from the equator (0–70; default 45). How long the days are, worked out from the real sun: twelve hours all year on the equator, and at 60° about eighteen in June and six in December.
- **winter** — How cold winter gets (0–1; default 0.5; *live*). Crops grow in the warm months and stop in the cold.
- **start** — The world starts in (Spring / Summer / Autumn / Winter; default Spring). What is in the fields and the houses on that day is set under How it starts.
- **weather** — Year to year (0–1; default 0.4; *live*). Each year draws its own spring, warmth and harvest — early or late, warm or cold, plenty or want.
- **rain** — Rain (By place and year — dry years thin the harvest / The same everywhere, every year; default By place and year — dry years thin the harvest). Each year's rain differs from place to place, more on dry land than wet, by as much as Year to year says.
- **climate** — Over the centuries (0–1; default 0.5). Under the year-to-year weather the climate itself drifts over decades and centuries, warmer and colder, wetter and drier, drawn from the seed: a cold spell of a few generations brings longer winters and poorer harvests, as the Little Ice Age did.

### How it starts

- **era** — Era (Foragers: bands, no farming / Early farmers / Bronze Age: writing / Ancient: iron, horses, mills / Medieval: the horse collar / Early modern: printing, gunpowder / Industrial: steam, rail, telegraph / Modern: engines, medicine, radio / Information: phones and towers; default Early farmers). Where every people starts: what it knows, its weapons, its wars, its medicine and its houses.
- **firstEra** — The first people's own era (The same as the rest / Foragers / Early farmers / Bronze Age / Ancient / Medieval / Early modern / Industrial / Modern / Information; default The same as the rest). One people of another age beside the rest: rifles against spears, a telegraph beside a village that has never heard of writing.
- **onward** — Eras move on by themselves (on / off; default off). On, anything can be found by somebody who knows its parts — gunpowder, the railway, the telephone — at How often new things are found.
- **foragers** — Peoples who forage (0–6; default 0). A people that does not know farming lives by hunting, herding and fishing from a camp, shares what it brings in, has a headman who cannot tax, and moves camp when the food round it runs down.
- **stored** — Food put by (0–1; default 0). What every household has in the house on the first day, and the village store with it.
- **standing** — Crops in the fields (0–1; default 0.5). What is growing in the fields on the first day.
- **ages** — How old they are (0–1; default 0.5). A young world has many mouths and few hands for years; an old one works now and dies off.
- **places** — Where they live at first (Hamlets — a few families each, scattered / Villages / Villages, and a market town for each faction / A city, and villages round it; default Villages). A town takes two-fifths of its faction's people and a city half of everybody; whether it is a town or a city by size depends on how many people there are (400 for a town, 5,000 for a city).
- **settled** — How settled they are (0–1; default 0.5). How many start in couples, and how many friends — and so who they will ask for food or follow — they already have.

### The people

- **people** — How many people (20–20000; default 400). How many are alive when it starts.
- **factions** — How many factions (1–8; default 4). They may not stay this many.
- **villages** — Villages each (1–4; default 2). How many villages each faction starts with.
- **crowd** — A full village (20–205; default 70; *live*). Past this, some leave — for a village with room or food, or to found a new one if there is land left.

### Lives

- **life** — How long they live (20–120; default 60). Short lives turn generations over fast: nobody remembers the last war.
- **grown** — Grown up at (6–25; default 14). Until then they work at nothing and eat from their parents' share.
- **births** — Children (0–1; default 0.5; *live*). How readily a fed, paired couple has a child.
- **hunger** — Going hungry (0.2–3; default 1). How long somebody with nothing to eat lasts.
- **thirst** — Thirst (Real — about three days without water / Gentler — about two weeks / Off — nobody needs water; default Real — about three days without water). A household keeps water at home and fetches it from a river or lake (the sea is salt), or digs a well when fresh water is far.
- **fishing** — Fishing (On — villages by water fish / Off; default On — villages by water fish). A village within two kilometres of a river, lake or the sea can fish it.
- **materials** — Materials (Wood, stone, ore, herds and game / One kind of goods (simpler); default Wood, stone, ore, herds and game). Wood is cut in the forest, stone quarried in the hills and ore mined where the ground has it, a day's work a load, and sold to the village store.
- **firewood** — Firewood (Needed in the cold / Off; default Needed in the cold). In the cold a village burns wood from its store, about three-quarters of a load a person over a winter (a household in a cold land burned some tonnes a year), more in a hard one; the store wants it before the winter, so wood is dearer in autumn.
- **hearth** — Whose firewood (Each household's own, fetched or bought / The village store's, for everybody (simpler); default Each household's own, fetched or bought). Each household keeps its own wood and burns it in the cold: it buys from the village store while it has coins, and otherwise goes out and cuts its own in the village's woods, as the right of firebote let a holding take wood for its fire.
- **lakes** — Lakes and ponds (Lakes in the hollows, ponds in wet ground / Only the deepest hollows (as before 2026-11-27); default Lakes in the hollows, ponds in wet ground). Water stands wherever the ground holds it: a hollow more than a few metres deep in wet country is a lake, and a shallow one a pond, too small to stop anybody but somewhere to drink.
- **crossing** — Crossing water (Rivers deeper than a person need a ford, bridge or boat / Only the biggest rivers need one (as before 2026-11-27) / Every river can be waded; no boats; default Rivers deeper than a person need a ford, bridge or boat). A river too deep to wade — anything much over ten metres across — can only be crossed at a ford, or where a village has built a bridge; a village by a lake or the sea builds a boat once its people keep wanting to cross, and ferries them over.
- **plague** — Sickness (None / Now and then / Often; default Now and then; *live*). A sickness starts in one person and passes to whoever they talk to.
- **dirt** — Dirt in towns (From its causes: waste and foul water / A fixed toll in towns and cities; default From its causes: waste and foul water). Where many live, their waste fouls the water they drink: a well among the houses, a river below a town.
- **health** — Wounds and old age (Bad wounds can last, and the old slow down / Full strength until the day they die (simpler); default Bad wounds can last, and the old slow down). A bad blow in a fight or a battle heals over months, and now and then leaves somebody lame for good: slower, weaker at heavy work, no soldier.
- **sexes** — Men and women (Men and women, and each people's customs / Nobody is either (simpler); default Men and women, and each people's customs). Each person is a man or a woman.
- **roaming** — People on the road and in camps (Bands move camp; the hungry poor may take to the road / Everybody keeps to their village (simpler); default Bands move camp; the hungry poor may take to the road). Somebody grown with no coins, hungry, in a village gone hungry, and with no small children may take to the road, going from village to village for bread and settling where there is food and work.
- **works** — Work and workplaces (Livings a place needs and can pay for, and workplaces / Farming, crafts and trade only (simpler); default Livings a place needs and can pay for, and workplaces). Households spend on bread first and on other things with what is left.
- **marriage** — Who marries whom (Each people's customs, from its nature / Whoever likes each other (simpler); default Each people's customs, from its nature). Each people works out from the nature of those with the say how much families arrange marriages, what passes between them (a dowry, a bride-price, nothing), where a couple lives, how old they marry, whether cousins may, and who inherits.
- **infancy** — Babies and mothers (As in the past: many babies die, some mothers too / Nearly every child grows up (simpler); default As in the past: many babies die, some mothers too). About a quarter of babies died in their first year and nearly half of children before fifteen, of fevers, the flux, hunger, cold and accidents, more in foul towns and without a mother.
- **childwork** — Children working (From about seven, light work, more as they grow / Nothing until grown but fetching water (simpler); default From about seven, light work, more as they grow). From about seven children help: minding the herd near home, and in the fields beside a parent, weeding, scaring birds and gleaning, above all at the harvest.
- **housework** — Work in the house (Cooking, minding the little ones and spinning take hours / No house work but fetching water (simpler); default Cooking, minding the little ones and spinning take hours). Every household owes hours a day of cooking and of minding its children under five, and spinning to keep everybody clothed; whoever their people's custom expects does most of it.
- **beasts** — Animals that work (Oxen pull the plough, horses the carts / None (simpler); default Oxen pull the plough, horses the carts). Each village keeps oxen and horses, counted, not walking about: bred where there is grazing, worn out in about ten years, eaten in a famine, driven off when a village is sacked.
- **irrigation** — Irrigation (Villages by a river dig ditches after a dry year / None (simpler); default Villages by a river dig ditches after a dry year). A village within two kilometres of a river that has had a dry year digs a ditch from it, about a hundred days' work, and the fields along the ditch are spared in a dry year as river flats are.
- **sleep** — Sleep (As long nights make it: two sleeps far north in winter / From dark to dawn in one piece (simpler); default As long nights make it: two sleeps far north in winter). Grown-ups go to bed a few hours after dark (longer by firelight, which burns the village's wood) and sleep what they need, about six and a half hours and an hour more in winter.
- **ruins** — Buildings left alone (Fall in time; what was left stays and rots / Stand as built, and an empty place keeps all (simpler); default Fall in time; what was left stays and rots). A building nobody lives or works in wears: its roof first, then its walls, then it is a mound in the grass — timber in decades, stone walls in centuries.
- **scavenge** — Scavenging (on / off; default on). People who know of a ruin with something left in it may go and carry it off, weighed against any other work.
- **startRuined** — Places empty at the start (None / About a third of them / All but one place a people; default None). The world is made as usual, then some places are left standing empty, nobody knows since when or why.
- **bread** — Grinding and baking (By hand at home, or at the mill and the oven for a share / Part of cooking (simpler); default By hand at home, or at the mill and the oven for a share). Grain is ground before it is bread: by hand at home, about an hour a day for a household with a rotary quern and four times that with a saddle quern before it, or at a mill for a sixteenth of the grain.

### Money

- **money** — How they trade (Coins and markets / No money — a shared store; default Coins and markets). With a shared store everybody puts in what they grow and takes what they need.
- **coins** — Coins to start, on average (0–40; default 8). Everybody's own, children's too — but a household spends as one, so whoever feeds a child can spend its coins on the family.
- **unequal** — Who starts rich (0–1; default 0.3). How the starting coins are spread: evenly, or most of them in a few hands.
- **prices** — Prices (Rise when things run short / Fixed by law; default Rise when things run short; *live*). A fixed price cannot tell a farmer the village is hungry.
- **tax** — Tax at the start (0–0.6; default 0.12). What each faction takes to pay its soldiers to begin with.
- **harvestTax** — Tax on the harvest at the start (0–0.5; default 0.1). A share of every harvest goes into the village store and is paid for to the faction, as tithes and land taxes were.
- **mint** — Where coins come from (Mined, struck, lost and debased / A fixed stock from the first day (simpler); default Mined, struck, lost and debased). One money, reckoned the same everywhere.
- **soldierPay** — Soldiers' pay (Stopped, sent home and spent / Kept whole (simpler); default Stopped, sent home and spent). What the army feeds and arms a soldier with is stopped from their pay, as Rome's and Britain's armies did, leaving them at least a tenth of it.
- **tills** — The village store (Sells to whoever has coins to spare / Mostly buys (simpler); default Sells to whoever has coins to spare). Somebody holding more than a season's bread in coins spends some of it at the store on goods for the house — pots, cloth, tools — or orders them from the crafters, so coins come back to the till that paid them out.
- **poor** — The penniless (Alms and loans as well as kin / Kin, neighbours and the ruler only (simpler); default Alms and loans as well as kin). Somebody hungry with no coins at the store is helped first by alms from a neighbour of their own faith, who gives a fortieth a year of what they hold beyond a season, then by a loan from kin or a neighbour, paid back when they can — a tenth a year on top, nothing between kin.
- **inherit** — When somebody dies (Their children get their coins / Their faction takes them / Shared round the village; default Their children get their coins). Who gets a person's coins.

### Minds

- **talk** — How much they talk (0–1; default 0.6; *live*). News, opinions, friendships and sickness all travel by talking.
- **divided** — How far apart they start (0–1; default 0.5). The one thing they argue about: should what is grown be shared out, or does each keep their own?
- **memory** — How much a person can hold (6–60; default 20). Each friend, grudge, debt, piece of news, who has food to spare, and what they think about sharing takes one.
- **wrong** — How often a tale changes in the telling (0–0.3; default 0.05). Each time something is passed on, the chance it comes out changed: a number grows, the wrong village, the wrong side.
- **finds** — How often new things are found (0–1; default 0.2). What a people can do is what its people know: digging wells, building boats and bridges, the plough, ditches.
- **tech** — How know-how moves (By need, the land, practice and meeting / As before: some things only by era; default By need, the land, practice and meeting). Anything can be found once its parts are known; a people's age is only a name for what it knows.
- **heardOf** — Hearing of a thing (on / off; default on). Hearing of a thing is not knowing how.
- **experience** — Experience (Each person's own / As before: each people's; default Each person's own). Everybody keeps years of experience in each kind of work they have done, which makes them better at it and slowly fades when unused.
- **discovery** — How things are found (Built up by work / As before: a lucky day; default Built up by work). Somebody working at a thing builds toward what is next to it — a smith near ore toward iron, a farmer toward the plough — faster for the curious, the hard-pressed and those who have heard of it.
- **faith** — Faith (on / off; default on). After something hard they cannot explain — a famine, a sickness, a drought, a war lost — now and then somebody makes up what lay behind it and what must be done.
- **favour** — Heaven's favour (on / off; default on). Where a people's faith says the gods stand behind its ruler, every famine, sickness, drought and war lost is held against the ruler — the more, the more the faith ties the gods to them — and loyalty falls with it, until the risings a people already has follow.
- **prophets** — Prophets (on / off; default on). Where hard times keep coming to one place, somebody may come forward promising the world will be put right: a new faith, or a new reading of the old one.
- **witches** — Blaming a neighbour (on / off; default on). After a famine, a sickness or a drought, frightened people may blame somebody among them — likelier the old, the poor, the disliked, somebody of another faith, a healer — and shun them, drive them out or kill them.
- **faithKids** — Faith and children (on / off; default on). The devout have a few more children, more where their faith bids it and fewer where it bids restraint; a faith may have its people marry young; and a faith whose teachers keep apart has them, and its most zealous, marry no one.
- **faithTrade** — Trust in trade (on / off; default on). Traders trust those of their own faith further: they would sooner carry to a place that holds it and go further to reach one, and are warier of a place that holds another.
- **folk** — Belief before faiths (on / off; default on). Every people starts with a belief of its own, kept house by house: its ancestors, the spirits of places, or both.
- **faithRules** — What a faith can hold (Many things / As before: a rite, a rule, war, its days; default Many things). A faith holds much more than a rite and a rule: what is sacred, what comes after death, foods and drink, harm to animals or anyone, who may lead it and who may join, pilgrimage, those who leave the world, healing, how it stands toward others, giving and lending.
- **fading** — How faith fades (With the times / As before: with a good year; default With the times). Zeal wears down with reading, towns and other faiths near, and when a faith's offerings fail to keep the hard times off; where nobody reads, belief mostly lasts.
- **fromTop** — Faith from the ruler (on / off; default on). When a ruler holds a faith, those who look up to them lean toward it over the years, their household and officials first.
- **faithsMeet** — When faiths meet (on / off; default on). A faith held by two rulers splits into sects that know they were one, and tolerant sects may join back.
- **faithDrift** — Faiths that change (on / off; default on). A faith comes to hold what its holders now are: its rite and days drift toward their nature, slower once written down; grown large, a faith of rites turns to teaching; and a dead faith that was written down can be found and taken up again.
- **faithWealth** — What a faith owns (on / off; default on). A people's faith may take a tithe for its keeper, a village raises a shrine, and a greedy ruler who does not hold a rich faith may take what its keepers hold.
- **faithYear** — Feasts and the dead (on / off; default on). Feasts at the harvest, midwinter and the start of spring, and a day for the dead where the ancestors are kept: the store pays, and everybody gathers.
- **comfort** — Comfort (on / off; default on). Belief makes fear and life's blows smaller, so the devout recover sooner; and hard times make those with no faith hold their old beliefs harder.
- **faithLaw** — Oaths, courts and sanctuary (on / off; default on). An alliance between peoples of one faith holds through more; where there is no judge a teaching faith's priest hears an accusation; and a shrine that shelters takes in somebody the village would kill.
- **faithRank** — Who is above whom (on / off; default on). A faith that holds all equal frees the unfree who hold it and will not hold them; one that keeps each in their place weighs a match across stations heavily.
- **lifeRites** — Rites of a life (on / off; default on). A birth, coming of age and a wedding are each a gathering: the household spends a little food, and those who come grow closer.
- **faithSchools** — Faith and reading (on / off; default on). A faith that wants its holders to read teaches its children, and some grown-ups, to read where its keeper can.
- **faithKeeps** — Keeping and forbidding (on / off; default on). A faith's readers keep what their people knew, and give it back after it is lost; a faith that turns from new things has its zealous holders refuse what was not known when it was made.
- **truce** — Days without war (on / off; default on). A faith may forbid war on its holy days or in a month of the year; its people's armies keep it as hard as their zeal holds.
- **martyrs** — Martyrs and morale (on / off; default on). Soldiers who hold their people's faith hard hold longer in battle, more where it promises a reward after death; and a death in battle makes the friends who shared it hold it harder.
- **flight** — Fleeing for faith (on / off; default on). Somebody pressed hard for their faith may leave with their household for a place that lets them be.
- **greatWorks** — Great temples (on / off; default on). A people that holds its faith hard and can spare the food may raise a great temple at its first village over years of its people's work, fed from the store; it stands after, and pilgrims come to it.
- **pilgrims** — Pilgrims (on / off; default on). Once a year the zealous of a faith with a pilgrimage go to its holy place: they spend at its market, meet strangers and may bring a sickness home.
- **sacredLand** — Sacred land (on / off; default on). Where a people's faith or its old belief holds the land holy, one grove or peak near each village is not cut or hunted.
- **faithHealth** — Faith and health (on / off; default on). A faith of washing keeps its holders a little safer from foul water, one that heals tends its sick, and pilgrims can carry a sickness.
- **plenty** — News of plenty (on / off; default on). A village with grain to spare after the harvest becomes news, passed on by word of mouth like news of a famine.
- **switch** — Changing sides (0–1; default 0.4; *live*). How readily an unhappy person joins the faction of somebody who is doing better.

### Their nature

- **own** — Each faction's own nature (on / off; default none). A faction set here starts from its own ten; the others from the ten for everybody.
- **bold** — Bold (0–1; default 0.5). Whether to take a risk: fight or run, steal when starving, move to a new place, march as a soldier.
- **warm** — Warm (0–1; default 0.5). Whether to give, share and help: a neighbour asking for grain, somebody hungry met on the road.
- **greedy** — Greedy (0–1; default 0.5). How much is enough: keep working, trading and putting by until they stand above their neighbours, or stop.
- **stubborn** — How stubborn they are (0–1; default 0.5). On average.
- **loyalty** — How loyal they are (0–1; default 0.5). How far people stand by their faction: how loyal they start, and how far hard times, taxes and a leader they disagree with wear it down.
- **patient** — Patient (0–1; default 0.5). Now or later: how much they keep back for the winter rather than sell, whether they fill the larder before the cold or leave it, and how long they bide their time before having it out with somebody.
- **temper** — Hot-tempered (0–1; default 0.5). How fast a quarrel becomes a fight.
- **hardwork** — Hardworking (0–1; default 0.5). How much they work when nothing forces them to, against resting and seeing people.
- **curious** — Curious (0–1; default 0.5). Whether to try the new thing: work that is not their trade, a new village, the road to a market they have not seen.
- **honest** — Honest (0–1; default 0.5). Whether to steal from a neighbour's larder when short, or from another faction's store when starving.
- **differ** — How much they differ (0–1; default 0.5). How far one person's nature — each of the ten — is from the next, and how far a child strays from its parents.

### Power

- **rule** — Who leads, at first (Whoever they vote for / A chief for life, then their child / Whoever is richest; default Whoever they vote for). Each faction starts this way.
- **land** — Who holds the land (Each faction decides / Families, each its own fields / The village, in common / The leader, worked for a share / The village, shared out by need; default Each faction decides). Each faction's own rule, as Ric asked: a chief or the richest chooses by their own lights, a people who vote choose by what most of them want, and you choose for a faction you rule.
- **property** — Land as property (Held, inherited, sold and pledged / Held and inherited, never sold / Shared out by need each month (simpler); default Held, inherited, sold and pledged). A family's fields stay with it however many they are, and are worked by others for half when it has too few hands; they pass by its people's custom, to all the children or the eldest, split up as they go.
- **govern** — Government (Councils, officials and laws / The leader alone (simpler); default Councils, officials and laws). A ruler must carry those with the say: the great families, the elders, or everybody.
- **term** — A vote every (1–20; default 6). Wherever leaders are voted for — from the start, or after a revolution brings in votes.
- **rebel** — Breaking away (0–1; default 0.5; *live*). How unhappy a village has to be before it declares itself its own faction.
- **riots** — Food riots (on / off; default on). When enough of a village's hungry can see food that is not theirs — a full store, a rich family's larder, a cart leaving — they take it together and pay what they think fair, as most food riots did.
- **bandits** — Bandits (on / off; default on). In hard times the hungry, the landless and the dishonest may take to robbing for a living: lying in wait for carts on the roads, and as a band, raiding the store of a weakly held village.

### War

- **neighbours** — How the factions start (Old friends / Strangers / Old enemies; default Strangers). Old friends start allied, and trading free of tax if there is money.
- **armies** — Armies (Gathered, fed and led / Each soldier marches alone (simpler); default Gathered, fed and led). An army gathers at its own village nearest the enemy and marches when enough have come in; it goes only as far as the bread it carries takes it there and back, further with carts; its leader picks the enemy place worth most against what defends it; enemy soldiers across the road it is fed by make it fall back.
- **campaign** — Soldiers on campaign (Live with the army; some desert / Come home to eat and sleep (simpler); default Live with the army; some desert). A soldier in an army that is gathering or marching eats what they carry or draw where it gathers, sleeps where it is, and keeps to their duty.
- **caravans** — Caravans (on / off; default on). Traders who go for weeks to places far beyond a village's own traders, with goods dear for their weight (finished goods, ore, wool) on pack animals: twice a pack on foot, four times with horses.
- **armySick** — Sickness in armies (on / off; default on). An army's camp is crowded and fouls its water as a town does, so sickness starts and spreads there, and kills more of its tired men; soldiers carry it to the places they pass and home.
- **oldArms** — Bows, armour and chariots (By era / Hand weapons alone (simpler); default By era). Before guns, a share of every army shoots: simple bows among early peoples, composite bows in the Bronze Age and antiquity, crossbows and longbows in the Middle Ages.
- **generals** — Generals (Led, scouted, and they break / No general (simpler); default Led, scouted, and they break). The captain leads the army, or the leader if there is no captain or the leader is bold.
- **siegecraft** — Siegecraft and service (By era / Numbers alone (simpler); default By era). Besiegers build what takes a wall (ramps and mining, rams, trebuchets, cannon, by era) and a place held shut can be starved into giving up.
- **ransom** — Prisoners, mutiny and war loans (Taken, ransomed, borrowed for / None of it (simpler); default Taken, ransomed, borrowed for). Soldiers struck down, most of all from an army that has broken, may be taken and held for ransom, paid by their family or their people to the soldier who took them; unransomed after two months they are exchanged, killed or let go, by the captor's nature.
- **smallWar** — Wounds, small wars and the sea (As found / As before; default As found). Some badly wounded soldiers die days later, fewer with healing herbs, a healer or medicine.
- **homeFront** — Working harder at war (on / off; default on). Those left at home take up the slack of the hands gone to the army: the more have gone from a village, the harder the rest work and the less they rest.
- **feuds** — Quarrels between villages (on / off; default on). Somebody hot-tempered may have it out with somebody they cannot stand from another village: met near at market or the fields' edge, or, if the grudge is deep, sought out in a village within 5 km.
- **builtRoads** — Roads built on purpose (on / off; default on). Once a year at peace a people builds a road along its most walked way between two of its places, or along a caravan route: a kilometre a day, paid from the treasury, or levied work fed by the village store when there are no coins.
- **waterWork** — Fishing boats and road bridges (on / off; default on). A village by the sea, a lake or a big river whose people go fishing builds a boat, and its fishers catch a third more from it; with a boat, grain can go by water.
- **meeting** — Armies meet (on / off; default on). An army sees an enemy army on the march within 5 km of its soldiers or places (10 km with horsemen); if it is coming for one of its places, its leader marches to meet it when the numbers are well in its favour, by nature, and keeps clear otherwise.
- **dispersion** — Armies spread out (on / off; default on). As weapons grow deadlier armies spread out and take cover, so a blow lands less often: muskets 70%, rifles 35%, machine guns 20% as often as hand weapons (Dupuy's dispersion).
- **warBooks** — Parole, deserters and the books (As each leader decides / As before; default As each leader decides). A soldier let go on their word stays home until that war is over.
- **warBy** — What war follows (What each people knows and can pay for / By era label (simpler); default What each people knows and can pay for). Weapons, bows, armour, chariots, horsemen, siege guns, walls, how an army is raised and the fighting season come from what a people knows and can pay for, never from the era it started in: a people that finds gunpowder fights with guns, and walls are built low and thick to stand cannon.
- **formations** — Where soldiers stand (Units in formation, on ground the general chooses / Every soldier for the nearest enemy (simpler); default Units in formation, on ground the general chooses). An army forms units, each led by an officer chosen as the people choose (birth and wealth, bought, by service, or by vote), sized by how orders travel.
- **raids** — Raids (Strike the weakly held, take and go / A band stays and fights for days (simpler); default Strike the weakly held, take and go). A band is sent only where a place is held by fewer than it brings.
- **battle** — Battle (Given when the general chooses / Whenever armies meet (simpler); default Given when the general chooses). A general gives battle only when the odds suit them (the bolder, the worse the odds they take, and better on ground they chose), or when caught too close to slip away; otherwise the army draws off.
- **taking** — Taking a place (Surrender is demanded first / Stormed as soon as the enemy is strong enough (simpler); default Surrender is demanded first). An army strong enough to take an open place demands its surrender before it attacks.
- **column** — Coming to a place (The army camps outside and goes in together / Each soldier walks straight in (simpler); default The army camps outside and goes in together). An army marching on a place halts at a camp outside its fields, on the side it came from, and waits there until most of it has come up — or three days have passed — before it goes in together.
- **pursuit** — Chasing an enemy home (Not alone into their own fields / Wherever they run (simpler); default Not alone into their own fields). A soldier on their own does not follow an enemy back into that enemy's own village fields, where its people are waiting, unless that place is what their army came for or others of their side are with them.
- **passage** — Crossing another people's land (Leave is asked first / Armies go where they please (simpler); default Leave is asked first). An army whose road crosses the land of a people it is not at war with asks that people's leader first.
- **war** — Wars (on / off; default on; *live*). Off, no leader may start one, whatever is done to them.
- **aggression** — How quick to fight (0–1; default 0.5; *live*). How readily leaders go to war over old wrongs, land or hunger.
- **soldiers** — Soldiers at the start (0–0.4; default 0.08). After that each leader keeps as many as their neighbours' armies, their old wars and their treasury call for.
- **deadly** — How deadly a fight is (0.1–3; default 1; *live*). How often a blow lands in a battle, how hard it is, and how often a bad wound kills later.

### Detail

- **bodies** — Bodies (Real size — half a metre, nobody in the way / Spaced out — everyone keeps 100 m apart; default Real size — half a metre, nobody in the way). At real size a person is half a metre wide, so nobody is ever in anybody's way, as in life, and zoomed right in they stand beside their house at its true size.
- **records** — Conversations (Every one written down / Only what happens — faster; default Every one written down). Written down, the Talk tab shows each exchange, word for word, and what it changed.

### Time

- **rate** — Clock (0.25–1000; default 1). At 1× one day takes five minutes.
