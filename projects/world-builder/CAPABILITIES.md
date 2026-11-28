# What the People engine does and works out

Everything `people.js` simulates and calculates, as of **2026-11-28**. It is a map, not a spec. The
reasons, measurements and history for each part are in `README.md` and in the comments beside the
code; the order of future work is `TODO.md`. Part 1 goes subject by subject, with the numbers the
engine uses and where they come from. Part 2 lists all 158 settings, generated from `SCHEMA`.

Ric asked for this on 2026-11-28: *"make a file that has a list of everything people sim the engine
can doo and calculates"*, then *"do the full pass"*. Part 1 was written from a pass over the whole of
`people.js`: every function and every comment, all 14,300 lines. It names a number wherever the code
names one. Where the code says a number is a guess, this file says so too.

**Keeping it true.** If you add, change or remove a part of the engine, change its line here in the
same commit. A line here that the engine no longer does is worse than no line.

**Two rules hold for everything below.** Nothing happens on a timer: no function starts a war, a
famine, a rebellion or a faith on a clock. Each comes out of what people did and what a leader
weighed. And anything said, logged or explained only reports what happened; it never makes it
happen. (The opening comment of `people.js`, and Ric's rule from KONDRITE: *"Nothing forced or
faked."*)

---

## Part 1 — what it does, by subject

1. [Time, the clock and the dice](#1-time-the-clock-and-the-dice)
2. [The land](#2-the-land)
3. [The sky, the year and the climate](#3-the-sky-the-year-and-the-climate)
4. [Food, fields and the harvest](#4-food-fields-and-the-harvest)
5. [Water, fuel, fish, herds and materials](#5-water-fuel-fish-herds-and-materials)
6. [Bodies, birth, sickness and death](#6-bodies-birth-sickness-and-death)
7. [Sleep, rest and house work](#7-sleep-rest-and-house-work)
8. [What a person decides](#8-what-a-person-decides)
9. [Walking and getting through crowds](#9-walking-and-getting-through-crowds)
10. [Nature, the mind and what people hold](#10-nature-the-mind-and-what-people-hold)
11. [Talking, news and rumour](#11-talking-news-and-rumour)
12. [Friends, quarrels, theft and feuds](#12-friends-quarrels-theft-and-feuds)
13. [Households, houses and building](#13-households-houses-and-building)
14. [Villages, towns, cities and their land](#14-villages-towns-cities-and-their-land)
15. [Land as property](#15-land-as-property)
16. [Work, livings and workplaces](#16-work-livings-and-workplaces)
17. [Goods, orders, equipment and animals](#17-goods-orders-equipment-and-animals)
18. [Trade, carts, boats and caravans](#18-trade-carts-boats-and-caravans)
19. [Money](#19-money)
20. [Know-how, experience and eras](#20-know-how-experience-and-eras)
21. [Marriage and inheritance](#21-marriage-and-inheritance)
22. [Leaders, government and law](#22-leaders-government-and-law)
23. [Unrest: riots, bandits, breakaways, revolution](#23-unrest-riots-bandits-breakaways-revolution)
24. [Peoples dealing with each other](#24-peoples-dealing-with-each-other)
25. [War: why it starts, how it ends](#25-war-why-it-starts-how-it-ends)
26. [Armies, soldiers and battle](#26-armies-soldiers-and-battle)
27. [Sieges, raids, and what a war leaves](#27-sieges-raids-and-what-a-war-leaves)
28. [Weapons by what a people knows](#28-weapons-by-what-a-people-knows)
29. [Faith](#29-faith)
30. [Bands, wanderers and the edge of the map](#30-bands-wanderers-and-the-edge-of-the-map)
31. [Ruins and scavenging](#31-ruins-and-scavenging)
32. [The watcher ruling a people](#32-the-watcher-ruling-a-people)
33. [What it records and reports](#33-what-it-records-and-reports)
34. [Speed: short cuts that change nothing](#34-speed-short-cuts-that-change-nothing)
35. [Not in the engine yet](#35-not-in-the-engine-yet)

### 1. Time, the clock and the dice
- At 1× a day lasts five real minutes; a year is 365 days. Each game hour is 60 steps (250 before
  2026-11-14). `TK` converts counts that were tuned at the old rate, so they last the same game time.
- Walking, work and talk happen every step. Food, ageing and needs are worked out every hour.
  Thinking things over (`reflect`) and markets happen every six hours. Villages, land, leaders,
  dealings between peoples and the graphs' sample happen once a day.
- `advance(seconds)` and `step(hours)` run the same code, and splitting time differently gives the
  same world. Speed only hands the engine more time. Nothing is skipped, and no cheaper model is
  ever swapped in.
- **Each one's own dice.** A random draw is a hash of the seed, who is deciding (a person, a
  village, a people or the world), the step, which of their draws it is, and the kind of draw. This
  is counter-based randomness of the kind used by Philox and Threefry, with MurmurHash3's
  finaliser. So one person's extra draw never moves a stranger's luck. The same seed and settings
  always give the same world.
- A person's random personality, sex, babies, wounds and foul-water deaths each have their own kind
  of draw. The land, house layouts and ponds come from hashes of the seed, not from the dice at all.

### 2. The land
- **Height** in metres, from smooth noise in lumps from 300 km down to 1.5 km across, each as tall
  as its size allows. A lump wider than the land is only a tilt, so a small land is a valley and
  only a big one has ranges. The "hills" setting makes the middle sizes taller, and the land dips
  toward the edges so that any sea is a coast.
- **Sea level** is set by a histogram so that the chosen share of the land is sea.
- **Drainage** uses Priority-Flood (Barnes, Lehman and Mulla 2014) with a bucket queue. Water always
  has a way out: to the sea, off the edge, or over the lip of a hollow.
- **Lakes** form in hollows 3 m deep where the country is wet enough to keep them full, and deeper
  where the land has thousands of metres of height in it. A shallow wet hollow becomes a **pond**:
  about one wet, level square in ten, roughly 0.5 ponds a km² across a whole land. Ponds come from a
  hash of the seed (Downing et al. 2006; Britain's pond count).
- **Rivers** form where the drained area passes a threshold (O'Callaghan and Mark 1984): 60 km² at
  the fewest-rivers setting, 5 km² usually, 0.5 km² at the most. Each river square records which of
  eight ways it flows.
- **River width** grows with √flow (Leopold and Maddock 1953): about 4 m at 5 km² drained, 35 m at
  300 km², 80 m at 1,600 km². Width is used for drawing the map only.
- **Too deep to wade.** Depth grows as flow^0.4. From 56 km² drained (a river about 15 m wide and a
  metre deep; Dunne and Leopold 1978) a river can only be crossed at a ford, a bridge or by boat.
  There is a ford about every 2.5 km, or every 7.5 km on rivers past 3,000 km².
- **Steepness** is the rise over half a kilometre either way. Hills are steep ground; mountains are
  steep and high.
- **Warmth** comes from latitude, the winter setting and height. Snow and ice lie above a line that
  falls as the world gets colder: about 2,400 m at 45° with a real winter, 900 m at 70° with a hard
  one.
- **Eleven kinds of ground:** sea, lake, river, beach, marsh, grassland, forest, hills, mountain,
  dry land, snow and ice. Each has a fertility (the whole table is scaled by 1.15) and an amount of
  ore. Ground within 1 km of a river or lake grows better, most at the bank, as flood plains do.
- **Walking pace** on each kind of ground follows Tobler's hiking function, with three-fifths off a
  path, plus Soule and Goldman's figures for brush and bog. Sea and lakes can't be walked.
- **Separate landmasses** are numbered by one flood fill, so a journey between two of them is
  refused at once instead of searched for.
- **Paths and roads wear in** (the active walker model of Helbing, Keltsch and Molnar 1997). Each
  step onto a square treads it once; under 1% of that wears off a day. About 25 crossings a day for
  weeks makes a path and about 95 makes a road. Paths are walked at least at open-ground pace, roads
  a little faster, and carts go best on roads.
- **Soil tires.** Each harvest wears a square toward half its strength. A full field's worth takes
  15% of what is left above that floor, which comes to about a tenth a year of steady reaping and a
  third in five years. A square not reaped for six months recovers: half its loss in a fallow year,
  most of it in two. Herd dung goes onto reaped fields, and beans (crop rotation) rest them
  (Campbell; Rothamsted's Broadbalk).
- **Forest clearing.** A village short of land clears the nearest forest beside its fields, about
  1,200 hours for a 6 ha square (a guess). Cleared land left unreaped turns to scrub in 25 years and
  back to forest in 50. Shifting cultivation comes out of this with no rule of its own.
- **Sacred land.** Where a people's faith or folk belief holds land holy, one grove, spring or peak
  near each village is never cut or hunted.
- **Big maps.** On land over 40 km across, growth is worked out only within 4 km of a village. Wild
  land that comes into reach for the first time arrives fully grown.

### 3. The sky, the year and the climate
- **Day length** comes from the sun's declination and the sunrise equation with the almanac's
  −0.833°. Polar day and night are clamped. Examples: 12 hours all year on the equator; 15.6 and 8.8
  hours at 45°; 18.7 and 5.9 hours at 60°.
- **A warmth curve** peaks at the solstice plus the lag of land and sea, in mid-July. Below a frost
  line nothing grows. It is normalised so that a year with seasons grows what a year without them
  would: all of it in one half.
- **Each year's own weather**, from a hash of the seed and the year: spring up to three weeks early
  or late, a warm or cold year, and a yield up to 30% better or worse.
- **Rain by place and year.** A place's rain is its usual rain × (1 + cv·z). z is drawn for the
  whole land and for regions about 100 km across. cv is larger on dry ground (yearly rain varies
  15–20% in wet country, 30%+ in dry). The crop loses about as much as the rain fell short (FAO's
  yield response for wheat, about 1.05). Fields at a river bank are spared entirely, a quarter of
  the loss is felt 500 m off, and all of it past a kilometre. On a rainy day every house catches
  about 40 litres off its roof; a wet place has rain on about half its days, a dry one on a sixth.
- **A dry year** at a village means under 85% of a usual crop. It becomes news.
- **Climate over centuries:** three slow waves of about 70, 210 and 600 years, with phases from the
  seed. At the default strength a cold age is about 1 °C colder, with harvests a tenth worse (the
  Little Ice Age).
- **The harvest** comes about two months after the warmest day. A day's reaping then brings in up to
  four times a day's gathering. A late year has a late harvest, and grain still standing at the
  frost is lost a little at a time.

### 4. Food, fields and the harvest
- Food is counted in **adult-day rations**. An adult eats one a day, in hourly portions. A child
  needs 0.35 at birth, rising evenly to 1 at the "grown up at" age. People eat up to a quarter more
  in a hard winter.
- **A field square** holds standing crop up to 48 rations × its fertility, growing back over about
  60 days. With seasons it holds a season's growth instead.
- **A day in the fields** brings back 1.8 rations (2.25 with a tool). How long it takes depends on
  the land: about five hours on ordinary ground, divided by how fast that ground gives, capped at
  nine hours and by daylight. The land decides the hours, not the load, which is how farm labour
  really differs. A good patch is quicker, so how uneven the land is decides who finishes early. A
  day's work takes from the square stood on and the eight round it.
- **Working together** (2026-11-27). A farmer joins a housemate, then a friend, then a neighbour
  already working within a square, about 3 m apart in a line. They work along a 200 m row in pieces,
  turning at the field's edge. Rows run the way the field was ploughed. A line only forms where the
  ground can give each of them a full stint.
- **Fields near home.** On a street, green or waterside village a household's land lies behind its
  house, so a square across the street counts as 2.5 times as far and one to the side nearly twice.
- **Putting by** (`winterAhead`). A household holds back food for every day ahead that grows less
  than the yearly average, weighted by the shortfall and the cold, plus a month for the hungry gap
  while stripped fields grow back. It adds a quarter for a long winter (more for patient people) and
  each child's real need, split between the parents at home. People with coins buy ahead, spending
  at most half their coins.
- **Going short.** A hungry person first goes to someone they know has food: whoever they've seen
  with food to spare, then family and friends. The seller asks a price that climbs as their own store
  falls, and never sells into their own winter. Kin, friendship or a warm nature may give instead.
  Food given is owed back, as days of the receiver's need, up to five. Strangers in another village
  sell only for coin.
- **Eating.** A child eats from whichever parent has more. A couple eats from one pot, and from the
  children's surplus beyond their next few days. People too old or lame to work are fed by their
  grown children from what those hold beyond a week. Any village feeds its own children, orphans
  included. Meals that aren't cooked go to waste.
- **Orphans** are taken in by a grown brother or sister, or else by whoever in the village has the
  most put by.
- **Starving** costs health every hour. At the default setting a fed adult with water lasts about
  six weeks with no food.
- **Taxes in grain.** A share of every harvest goes to the village store as the people's grain, sold
  for the treasury and used to feed and pay soldiers. On a leader's land, or enclosed commons, a
  third goes to the leader's barn. On another household's field half goes to that household.
- **The government's grain** (Florence 1329; England's Books of Orders 1587; China's ever-normal
  granaries). A leader who can spare it sets coins aside for a village going short, and any carrier
  sees them as buyers. Warm leaders spend more and greedy ones less. The treasury pays the share of
  the price by which the leader is warmer than greedy; at 1 it is a free dole. Bold leaders make
  households with more than their winter sell the rest at a fair price. Patient leaders lay grain in
  during the three months after the reaping.
- **Relief.** The treasury buys bread for anyone who can't, starting with the people's own grain at
  no cost.
- **News of plenty.** After the harvest, a village with more than half a year's food a head, sold
  cheap, becomes news (at most once a village a year). Traders go there to load and the hungry go to
  buy, if it's within a day's walk.

### 5. Water, fuel, fish, herds and materials
- **Water.** Each person uses 20 litres a day (WHO basic access) from the house, or drinks at a
  river, lake shore or pond. Fetching starts with about two days left; a trip carries 40 litres, and
  the sea is salt. Without water a person dies in about three days, up to half again faster on the
  hottest days, or in about two weeks on the "gentler" setting. Children fetch from age six, and
  neighbours give small children water. A child in a dry house drinks from the fullest house in the
  village. A village whose fresh water is over a kilometre off digs a well.
- **Foul water** (the urban penalty). A village's water is fouled by the waste of everyone round it:
  all of them where it drinks from a well among its houses, half where it drinks from a lake or
  river, plus the waste of every place upstream within 10 km, less the further up. Foulness is
  load / (load + a half-way figure), so a hamlet's water is nearly clean and a city's very foul. Foul
  water kills the frail first; a town of 1,000 loses about one in a hundred a year to it. Sickness
  starts up to four times as often where the water is foulest (English market towns 1675–1749).
- **Irrigation.** After a dry year, a village within 2 km of a river digs an 800-hour ditch (a
  guess) from the nearest river square. It waters farmland within 1.25 km of that line, which then
  loses only 15% of what a dry year would take. The ditch needs 320 hours of cleaning a year or it
  silts up (Bali, Nepal, Hohokam).
- **Firewood.** About three-quarters of a load (a cord, nearly two tonnes) per person over a cold
  winter, none in summer (Hatcher). A household buys from the village store while the store holds
  more than a third of what it wants and the household has coins. Otherwise someone spends half a day
  in the village's woods (firebote; Warde 2019). With no forest in reach, people burn dung and turf.
  Staying up after dark burns wood too. Unwarmed over a hard winter, about one adult in twenty dies,
  more of the very young and old.
- **Fishing.** Natural waters give 20–50 kg a hectare a year (FAO), more in rivers and shallow
  lakes; a kilogram of fish is a third of a day's food. A village's fishing ground is the water
  nearest its middle within 2 km, plus all water within 750 m of that. A day's fishing brings up to
  about 6 kg, less in the cold. A boat adds a third.
- **Herding.** Sheep and cattle graze unfarmed or fallow grassland, dry land and hills within 4 km.
  A square (about a dozen sheep) gives 40 days of food a year and grows back over a year. A day with
  the herd brings in up to two days of food, plus wool (a load in about four days) and dung for the
  fields.
- **Hunting.** About 0.1 person per km² can live by hunting, so a forest square holds about eight
  days of meat a year. A good day is 2.5 days of food and a hide. Overhunted game is gone for years.
- **Wood, stone and ore.** A day's work is a load: about a cord of wood, roughly a cubic metre of
  stone, or some hundreds of kilograms of ore (less where the ore is poor). A forest square holds 60
  loads and grows back 20 a year; stone and ore never run out. Each goes to the village store, which
  pays more when the village wants more (for houses, crafts, tools, weapons, carts). Rich ore also
  carries a little silver.

### 6. Bodies, birth, sickness and death
- **Size.** At real size a person is half a metre wide and can't walk through anyone. On the
  "spaced out" setting bodies keep 0.42 squares apart.
- **Men and women.** Women have about two-thirds of men's strength at the heaviest work, varying by
  person (Miller 1993: 52% upper body, 66% lower). That strength (`brawn`) counts for ploughing,
  reaping, cutting, quarrying, mining and fighting. Each people decides from its own nature how far
  it keeps women from heavy trades and the army (the plough pushes this way; Boserup; Alesina,
  Giuliano and Nunn 2013), and how far it accepts same-sex couples. A few in a hundred are drawn to
  their own sex (a guess).
- **Pregnancy** lasts nine months. A woman works lighter in the last weeks and lies in after the
  birth: a month if the household can spare her, under a fortnight if not. About one mother in a
  hundred dies of a birth (England 1650–1800), more when starving or over 35.
- **Births.** Each year a fed couple at home has a chance of a child, scaled to the six-hourly
  cadence. It depends on age, food, how crowded the village is, faith and the Children setting. There
  has been no cap on world size since 2026-11-20. While she nurses a baby under 18 months, a woman
  conceives at 0.15 of her usual rate, which keeps births two to three years apart.
- **Children dying.** A fed child's yearly chance of dying is 0.2 in the first year, 0.04 up to
  five, and 0.008 up to grown. That is ×2.5 when hungry, more with foul water, and ×2 if the mother
  is dead. So about a quarter of babies die in their first year and nearly half of children before
  fifteen (Volk and Atkinson 2013). In modern eras it falls to a few in a hundred.
- **Children working.** Nothing before seven, then rising evenly to 0.7 of an adult's day by the
  year before they're grown (Horrell and Humphries). They help in the fields beside a parent, above
  all at harvest, and mind the herd near home.
- **Sickness.** A seven-day village fever starts in one person and passes on in 15% of
  conversations. It kills about one fed, rested adult in 33 who catches it, and several times that
  for the young, the old and the hungry (`frailty`). That is how a bad harvest and an outbreak become
  one disaster. Survivors are immune for good. It passes more readily with foul water or in an army
  camp.
- **Fleeing sickness.** A household with close family in another village goes there until a week
  after the sickness has gone (London 1665), and some carry it with them. People also avoid trading
  with, or moving to, places they've heard are sick.
- **Wounds.** A blow of a tenth of a life or more leaves a wound that heals over months, halving in
  about two months. The worse the blow, the likelier some of it stays for good as lameness: about a
  fifth of the heaviest battle blows, almost no village-fight bruises (Dittmar et al. 2021: 44% of
  medieval Cambridge's working people had a healed break). Nothing heals without water.
- **Old age** takes strength from about three-quarters of the lifespan onward, down to a fifth.
  People too frail to work sit by the fire and are fed by family. The old can hand what they own to
  a grown child in return for keep (medieval maintenance agreements).
- **Towns are deadlier** than the country (Wrigley 1967), through foul water and crowding, or by a
  fixed toll of about one more death a hundred a year in a town and two in a city on the simpler
  setting.
- **Death.** A person's coins and goods pass by the inheritance setting and their people's custom;
  usable gear goes back to the village. Coins they buried and nobody knows of stay in the ground. A
  lender loses what was owed. Family members are shaken by it, more by a killing and most by losing a
  parent. Friends of someone killed hold it against the faction that did it.

### 7. Sleep, rest and house work
- **Sleep** (Yetish et al. 2015; Ekirch). An adult needs 6½ hours, plus up to an hour more as the
  night grows past 12 hours. Bedtime is three hours after dusk where the village has firewood to sit
  by, an hour and a half where it hasn't. Where the night is more than six hours longer than the need
  (far north in winter, never near the equator), people sleep in two pieces: half their need, an hour
  awake at home, then until dawn. A sleep in daylight is one whole sleep.
- **Needs besides food.** `rest` rises with hours awake, faster at heavy work, and a night in a bed
  clears it. `alone` counts hours since anyone spoke to them, and only a conversation clears it.
  `fear` comes from danger at their own door: a siege, enemies at the edge, a raid in the last three
  days, a blow just taken. A war elsewhere is effort, not fear. Rest is squared, so a second night
  without sleep outranks everything except hunger.
- **House work** (guesses, stated as such). Two hours a household a day, plus a quarter-hour per
  mouth and an hour per child under five. Clothes wear out in a year and a half and take 300 hours of
  spinning, weaving and sewing per person to replace; they matter only in the cold. A household too
  far behind wastes a seventh more food, and its small children come to more harm. Whoever their
  people's custom expects does most of it.
- **Grinding and baking.** A household's daily bread takes about an hour at a rotary quern (which
  comes with the iron age), and 4.3 times that at a saddle quern. A water mill cuts it to about a
  ninth of the time for a sixteenth of the grain as toll (Chester). A common oven takes a
  twenty-fourth of each household's daily bread.

### 8. What a person decides
- **One comparison** (`choose`) over every option: sleep, eat, the fields, the bench, fishing,
  cutting, quarrying, mining, herding, hunting, carrying a load, a caravan, market day, standing guard,
  going to find somebody, fitting tools, house work, fetching water, digging a well, firewood,
  building a house, digging a ditch, clearing forest, building a bridge or boat, scavenging, a
  service, building a workplace, faith (shrines, temples, feasts, pilgrimage), moving house, asking a
  neighbour, stealing, robbing on the road, taking to the road, quarrelling, or sitting out the day.
- Each option is scored against needs (0 to about 1.4; food may go past 1), the cost of the walk and
  the risk, and what the person is good at, plus a little noise. There is no job script, and no
  option that the person couldn't actually carry out.
- **Wanting more.** People measure their household against the neighbours'; the greedy want to be
  above the middle of the village. Wanting more is capped, and a full larder only takes the edge off
  once it covers the winter ahead. Hardworking people work more without being forced to.
- **A war anywhere** makes people work and put by more and rest less, the loyal most. When hands
  have gone to the army, those left at home work harder.
- **The harvest.** Everyone helps; ripe grain left standing is lost.
- **Building waits on food.** A house waits until nobody is hungry, the harvest is in, and the
  larder holds at least half of what's wanted.
- **Children** stay near whoever feeds them and sleep at night. **Free time** is spent near a friend
  within 750 m, otherwise round the village middle.
- **A job** (`chooseJob`) is what someone is good at, worth about a third again at that work, and
  reads the same figures (`livelihood`) as the daily choice. The land counts for what a day could
  carry off and how fast it gives. The bench counts only for what has been ordered. The road counts
  for whether anywhere reachable wants what's here. Greed boosts the paid trades, and the curious try
  other work. A minority faith leans toward trade, and only people who write can teach.
- **Moving house** weighs how fed and how full somewhere reachable is (its houses as well as its
  store) against what holds a person: a partner, children, friends, the flag. A couple moves
  together. After a move people settle for a season before weighing it again. After moving for food
  they stay at least a week. Nobody moves to a place they've heard is sick or starving.

### 9. Walking and getting through crowds
- People walk 4.5 km/h, which is 18 squares of 250 m an hour. Strides longer than a body are taken
  in checked pieces, so nobody walks through anyone.
- **Across the land:** A* over the squares, each costing its length divided by its pace. Sea and
  lakes are closed. The answer is kept for that pair of squares, and corners are cut along dry
  straight lines (checked more closely beside big rivers). People walk village ground at open pace,
  since villages have paths.
- **Through crowds:** a sidestep round a neighbour first. Once progress stops, a bounded half-square
  A* (800 looks) round the bodies, with its waypoints kept. A fully enclosed person waits for a real
  opening.
- **Arriving.** A local errand that has stood within a stone's throw of its end for most of an hour
  counts as arrived. A long journey must really arrive. Going to bed means going inside the house.
- **Water in the way.** A journey over sea or lake by land is refused. A village with a boat rows
  its people across at 4 km/h from its landing (a ferry search up to 50 km).

### 10. Nature, the mind and what people hold
- **Ten traits** per person: bold, warm, greedy, stubborn, loyal, patient, hot-tempered,
  hardworking, curious, honest. They're set from the world's or the faction's sliders, spread by
  "how much they differ", and children take after their parents with some variation.
- **Life changes people** (`shaken`). A hard event moves a trait by a few hundredths. Half of that
  wears off (halving every two years) and half stays, so children start from what their parents
  became. How far someone moves depends on age: 0.31 in childhood, 0.54 around twenty, 0.64 at
  thirty, 0.74 from fifty, nothing before six (Roberts and DelVecchio 2000; Bauer et al. 2014). It
  also depends on size: losing a parent counts twice, a burned house counts as a raid, each week
  without food is another famine.
  - A raid makes people quicker to anger, closer to their own and less patient (Bauer et al. 2016;
    Voors et al. 2012).
  - A famine makes people put more by and be less scrupulous (Malmendier and Nagel 2011).
  - A death in the family makes people more fearful, and a killing more bitter.
  - A good year softens people, and faith softens every blow.
- **A war lost** shakes the whole people as a raid would, in proportion to the share of its places
  it lost.
- **The mind holds a fixed number of things** (20 by default): friends, grudges, debts, news, who
  has food to spare, what they've heard of ruins, and their view on sharing. Each slot records its
  kind, who or what it's about, its strength and when it was last refreshed. A slot fades by its
  kind's half-life, and grudges last longest. When the mind is full, the weakest thing is forgotten.
  Grudges and family are harder to forget, and something heard this hour is kept.
- **Children start with** a weaker copy of a parent's newest news, a larder they know of, and their
  strongest feelings (grudges no deeper than a snub), and their parents' faith.
- **Loyalty** is reconsidered every six hours from how life is going, how far the leader thinks
  differently, and whether this flag was ever theirs. Taxes, forced grain sales, riots broken up, and
  what their faith blames the ruler for all weigh on it.

### 11. Talking, news and rumour
- People talk to whoever is standing on the same ground; a friend is picked up to five times as
  readily as a stranger (1 + 4 × feeling). When someone next tries to speak is drawn once, as a
  wait, instead of rolled every step. The odds are identical.
- **What a conversation can be.**
  - A grudge gives a cold word, and nothing warms between them.
  - Someone hungry asks and the other gives or sells, or at least says where food is.
  - Word of a ruin with something left in it.
  - Two single people pair up.
  - News passes from whoever has the newer.
  - Across a border, whoever is doing better says so, which is how people change sides.
  - Opinions of the leader, meeting between, weighted toward whoever cares more.
  - The one argument everybody has, about sharing (children keep out of it). People too far apart
    dig in and like each other less.
  - Gossip about a third person moves the hearer as far as they trust the teller. It only cools;
    hearsay alone never makes an enemy (Mesoudi, Whiten and Dunbar 2006).
  - Small talk.
  - Know-how, faith and sickness all pass through talk too.
- **Every conversation has a receipt:** what each was before and after, and what changed. Reading it
  draws no dice and changes nothing.
- **News** is an event plus a telling. Each retelling has a chance (1 in 20 by default) of coming out
  changed (Allport and Postman 1947): a number grows or a harvest shrinks (sharpening), or a village
  or side is swapped (assimilation). Every telling and who told whom is kept, so a piece of news can
  be traced back to whoever saw it. Written news passes word for word.
- Only those who were there see an event; everybody else hears it from somebody. News travels at
  the speed of what is built: a telegraph line to every place of the people, a tower to everyone
  within 35 km (GSM's timing limit), a radio to all powered places.
- **People act on what they hold, right or wrong.** A wrong telling sends them the wrong way.
  - News of a war or a village taken becomes a grievance against the side as told.
  - News of a famine sends food to family there (Kagera; the Dinka).
  - News of sickness keeps traders and movers away.
  - News of dear food or a dry year makes food go there half again as readily.
  - Seeing or hearing of another people looting their own people's ruins becomes a grudge.
- **Dear-food news** comes when one household in seven is hungry with money to pay, at most once a
  people every four months.

### 12. Friends, quarrels, theft and feuds
- **Feeling** runs from −1 (a bitter grudge) to +1 (closest friend). At most five people are close
  (Dunbar 1993; Zhou et al. 2005), and one more pushes the least close back.
- **Who people go to see:** whoever they're closest to who is near, and a close friend in another
  village up to 2 km away, less the further.
- **Quarrels.** Two people who can't stand each other: words mostly, blows between the hot-tempered.
  The hot-tempered go looking for it at most about once a month, at ordinary patience; it can be
  someone from another village met at market or at the fields' edge. About one fight in 600 kills,
  calibrated to one homicide per 4,000 people a year in 13th–14th-century English villages (Given
  1977; Eisner 2003). A council or judge may hear it.
- **Being turned away when hungry** cools a friendship but never makes an enemy on its own. Enemies
  come from fights, theft, killing and bitter argument.
- **Theft.** Someone hungry with nothing to pay with may take from a house with plenty, best at
  night (0.5 at ordinary honesty). Whoever sees it holds it against the thief: likely someone at home
  and awake.
- **Feuds.** Old feuds between peoples are held as long as a grudge and passed on to children.

### 13. Households, houses and building
- **A household** is one purse and one pot: own coins first, then the children's, then the
  partner's. A married couple living with other adults, or a household too big for its house, looks
  for its own; the youngest couple goes (Hajnal's north-west European pattern).
- **Houses** have a place, a size in metres and a facing, and the family sleeps inside. A peasant
  house is 14–23 m by 4–6 m (Houndtor), sized by wealth from 12 × 4.5 m for the poorest to 24 × 7 m
  for the richest, about 10 m² a person. Walls are stone where stone lies within 2 km and the
  household is better off, else timber. The shape follows the era: round huts, longhouse and hall,
  Roman courtyard house, industrial terraces, modern blocks.
- **Village layouts** are read from the land and the people's custom, never from dice (Ric: "custom
  leans, land decides"). A people founds new villages in its first village's form where the land
  allows it.
  - Street: houses both sides, land behind.
  - Water: one row about 25 m from the bank, facing the water.
  - Green: 17 plots round an 80 × 30 m green, then out along the ways from its ends.
  - Cluster: lanes winding out from an open middle, bending up to a third of a right angle per 100 m.
  - Farms: about 7 ha each, long side along the contour.
  - Grid: blocks of 120 × 60 m with sixteen 15 m lots and 15 m streets. Only for a people that writes
    and is ruled. A surveying people lays it to north. A town of a writing people grows a grid beside
    its old core.
  - Camp: foragers' huts in rings 9 m apart (Yellen 1977).
- **Building** takes about 2 hours of work per m² of floor (a 54 m² cottage is about 14 person-days,
  a 168 m² house about 42). It also takes one good per 20 m² plus six, or eight hours of gathering by
  hand for each good. The family builds it, or pays a builder 1.5 times a wage. An empty house is
  taken first. A ruined one is mended for a share of the cost of new. A newcomer gets an empty house
  or a hut at once. A household always keeps back a winter of bread money.
- **Animals belong to houses:** a bred beast goes to the household best able to keep it; a lost one
  is the poorest household's.

### 14. Villages, towns, cities and their land
- **Founding the world.** Villages are spaced by livable ground, never in sea, marsh or mountain,
  within 2 km of fresh water where possible. A faction's villages start as neighbours. "Hamlets"
  means a place for about every fifteen people. A town takes two-fifths of its faction and a city
  half of everybody. A quarter of adults start paired, some women already pregnant, and every child
  starts with parents. Starting coins are a long tail.
- **A full village** is a number, or "as many as the fields within a day's work feed", worked out
  daily. Past it, some leave for a village with room, or found a new one.
- **Land hunger.** A village whose fields feed fewer than two a head, with good land open, sends
  its bolder families to break new ground. Founding weighs land, distance to water and ruins to
  reuse. No land left becomes a reason to fight.
- **Town and city by size:** a town from 400 people (Dyer: small medieval towns 300–2,000), a city
  from 5,000, falling back below four-fifths of that. A place has room for what its land feeds plus
  what the grain brought into it feeds, averaged over about half a year.
- **Market day.** Food beyond the winter goes to the biggest place within 10 km that is at peace,
  at least half again as big, and short of food. It's sold door to door (London c. 1300 drew grain
  from 60 km round).
- **A village's land** is a flood out from its middle at walking pace. Forest, marsh and hills slow
  it; paths and roads speed it; unwadeable water stops it. On open grass it reaches what a disc of
  2.6 + 0.55·√people squares used to. Neighbours meet where each is an equal walk away, a Voronoi
  diagram by travel time (Chisholm 1962; Vita-Finzi and Higgs 1970: an hour's walk for farmers, two
  for foragers). Under property, bounds never shrink.
- **How a people holds land** goes by what it knows and how it rules, never by its era:
  1. A range: bands, two hours round camp, shared, no line.
  2. By use.
  3. By reach: an hour beyond its fields (more with a wall or garrison), divided by a weight that
     grows with population, so big places reach further (the mandala; Kristof 1959). Where two
     peoples' reach meets is a frontier three squares deep.
  4. Written: once it writes, a square is recorded and moves only with its village (charters,
     beating the bounds).
  5. Surveyed: with rail or the telegraph, a straight claim three hours out over anything but sea
     (the Land Ordinance of 1785).
  Village land is worked out daily and a people's weekly.

### 15. Land as property
- **Who holds the land** is each faction's own rule, or one setting for all.
  - Families: a square (6.25 ha) for every two or three people, so a family of five holds about two
    (a virgate). Others work it for half of what it gives.
  - The village in common.
  - The leader: a third to the leader's barn.
  - The commune: shared by need.
  Chiefs and the richest choose by their leanings; voters change it only when 55% want to.
- A household holds fields only if it farmed twice or more in the past month, and keeps them through
  a winter, losing them after three months without farming.
- **Holdings stay with families.**
  - They pass by custom when the last of a couple dies: to all the children, each share to the house
    they live in (gavelkind), or whole to the eldest.
  - A household in want pledges a field for a season's bread. The lender reaps it until repaid and
    keeps it after three years (the dead pledge).
  - A household with more land than hands sells a field for two seasons' bread.
  - An official paid in land holds it for the office's term (a benefice, a timar). A faith's glebe is
    held for good.
- **Claims round villages.** A stranger cutting, grazing or hunting there pays a tenth of what it
  gave, or is held to have wronged that people.
- **Without writing**, inheritance split between several heirs may be quarrelled over, and a greedy,
  dishonest neighbour may move a boundary. Only a judge with a written record puts it right. A
  greedy ruler, sooner one pushed by great families, may enclose the commons.

### 16. Work, livings and workplaces
- **Livings exist only where a place needs and can pay for them.** Households spend on bread first
  (Engel's law). A village with coins to spare keeps a healer where people are sick, a teacher where
  the people write and there are children, and a miller where a mill stands. A service is half a
  day's work, paid by those it serves.
- **Workplaces** are buildings with a method. A water mill needs the know-how and a river; it takes
  about as long to build as a bridge. A power works needs the steam engine, takes twice that, and
  burns two loads of wood a day. Works beside a running power works make three times what a bench
  does. Knock down the power works, or let it run out of wood, and the works is a bench again.
- **Experience.** People keep years of experience in each kind of work. A beginner does four-fifths
  of what a three-year hand does, and the gain flattens after that (Wright 1936; Arrow 1962). Unused
  experience fades about 3.6% a year, never to nothing. Changing work costs something in the first
  season.

### 17. Goods, orders, equipment and animals
- **Made to order.** A crafter makes what has been asked for, plus about a season's stock
  (`v.used`, a running sum that falls by e⁻¹ over 90 days), less what is on the shelf. Each person
  holds one order, the largest they've wanted; an order unfilled for two months is dropped. Goods
  are dear while orders wait and cheap while the shelf holds more than a season's use. Household
  goods wear out in about a year and a half.
- **Crafting** uses wood and ore bought from the store, or makes a little by hand without them. It
  is slower for the lame and the old.
- **Equipment** in each person's `gear`: work tools, trade packs, weapons, shields, armour. It is
  paid for in real goods, fitted or repaired only at a real village after the household is fed, worn
  by use, and helps only while it suits the job and is unbroken. Tools take ore and carts take wood.
  Where there's no forest, shields are hide and wicker. A cart is bought only from what is left after
  a winter's bread.
- **Wartime gear is never free.** It comes from what people gave for the war, then the treasury
  buying from the store, then an order to the crafters.
- **Working animals** are counted per village and per house, not walking about. A village starts
  with an ox for every three people and a horse for every twenty. A full plough team is an ox for
  every four people, giving full-speed reaping; with none, reaping is at hoe speed. Animals breed
  where there's grazing, wear out in about ten years, and are eaten in a famine (an ox is about 150
  days of food; the plough team goes last) or driven off when the village is sacked. Horses speed
  carts, and a collared horse ploughs like an ox (Domesday's ~650,000 oxen; Langdon).

### 18. Trade, carts, boats and caravans
- **A trader** buys where a thing is cheap and carries it to where it's dear: one number decides
  both the route and the reason. Goods go only where they're asked for and can be paid for.
  Materials go from cheap to dear villages. Grain goes from houses with more than their winter to
  houses going short, never while it's still standing, and only as much as the short households can
  pay for. Grain is sold door to door, most short first, at cost plus the carrying. A public grain
  order counts as buyers. With no money, traders carry food from the fullest store to the emptiest.
- **Carts** carry eight packs of grain, a handcart or packhorse five. They go at a walk on roads,
  slower on paths and village lanes, and much slower over open ground. Horses make carts faster, and
  a car (once a people knows the engine) is fast on a road while it has fuel.
- **Boats.** A village within 2 km of a lake or the sea whose people have wanted to cross builds
  one (about 15 person-days). One by a big river with no ford or bridge within 1.5 km builds a bridge
  (about 75 person-days). A boatload is ten carts (a cart carried half a tonne to a tonne; Thames
  boats 13–45 tonnes). Goods go by boat along a coast or big river when that's a tenth quicker; a
  boat makes about 6 km/h along a coast.
- **River routes** are found by time, not distance: full speed with the current, two-thirds across
  it, a third against it (boats were towed upstream 15–20 km a day). Routes go eight ways, past fords
  and under bridges, so A to B isn't the same as B to A.
- **Boats are lost** in about one crossing-hour in 500 at sea and one in 1,500 on a lake or river.
  The load goes down, along with half of those aboard.
- **Caravans** go beyond a village trader's reach (34 squares) out to about 150 km, at 35 km a day,
  with pack animals (each carries what two people would; a horse or camel 160 kg, what four would).
  They carry goods dear for their weight (finished goods, ore, wool), never grain, only to peoples at
  peace with them, and further to places of their own faith. A route travelled before pulls more. The
  road is taken by days rather than walked, and caravaners live on the road from market to market.
  Caravans exist only from the Bronze Age (donkeys, Kanesh c. 1900 BC; camels from c. 1000 BC)
  through the early modern era.
- **Taxes on trade.** Tax is taken on both sales and purchases, at the village's own rate if its
  ruler set one, else its faction's. There's no tax between peoples with a trade deal, and nobody
  carries goods to a hostile people.
- **Trade builds goodwill** between peoples, and a cross word builds ill will. An old feud or an old
  friendship is all but deaf to the opposite while it lasts.

### 19. Money
- **Money is conserved.** Every coin is always in a pocket, a till or a treasury. The only coins made
  or lost are counted in `count.minted`, and the test adds it all up. The alternative is no money at
  all: one shared store per village.
- **Where coins come from** (Ric: one currency). Silver comes out with ore, more in rich ground. A
  people that knows coin-striking (Lydia, c. 600 BC) buys silver into its mint and keeps a twentieth
  as seigniorage; otherwise silver passes by weight. Coins wear out and are lost at about 2% a year
  (Hopkins). People fleeing an army bury half of what they have and dig it up if they come home.
- **Debasement.** A greedy, dishonest ruler who can't pay a month of soldiers strikes coins with no
  silver in them, and the coin is trusted less for years.
- **Money can fail.** In a famine, a siege, or under repeated debasement, sellers stop taking coins
  for food in that place; food is only shared, given or asked for until trust returns (Germany 1923
  and 1945–48; Radford's prisoner-of-war camp). It fades as trust does, not by a rule.
- **Soldiers' pay** has stoppages for food and kit, leaving at least a tenth (Masada; the British
  Army to the 1890s). A soldier sends half of what they hold beyond a week's pay to a parent at home,
  and spends a seventh of a day's pay plus a tenth a day of anything beyond two weeks' pay at the
  village's inns (a guess). Soldiers can be paid in grain instead.
- **Spending.** Anyone holding more than a season's bread in coins spends a sixtieth of the rest a
  day on goods for the house.
- **The penniless** get alms first, from someone of their own faith, at most a fortieth a year of
  what that person holds beyond a season (zakat). Then a loan from kin, a friend or a neighbour, at
  most a month's bread, at a tenth a year with nothing between kin, repaid when they can (Briggs
  2009). A debt to the dead goes to nobody.
- **Gini.** Coin inequality was measured at 0.22 → 0.81 in a year before these were added; it is
  measured over decades (`test/gini.mjs`).
- **Treasuries.** A treasury must spend: spare coins go back into the villages' tills, or every coin
  would end up in a chest. A leader keeps a chest of about a year's wages, more if greedy.

### 20. Know-how, experience and eras
- **A technique is held by a person**, not flagged on a people. 27 ordinary techniques: farming,
  wells, boats, carts, bridges, the plough, ditches, smithing, weaving, writing, crop rotation, the
  water mill, the horse collar, herbs, steam, iron, horses, printing, gunpowder, the railway, the
  telegraph, the engine, medicine, radio, the mobile telephone and towers, coin-striking and the
  wired telephone. Each needs its parts first, as the historical record has them.
- **Finding.** Somebody at work may find a technique whose parts they hold; the curious, the fed
  and a village going short are likelier (Muthukrishna and Henrich 2016; Allen). At the default it's
  about one find in a few years among 400 people, 200 times as often at the top of the slider.
- **Need points the finding:** the hungry toward farming tools, the sick toward herbs and medicine,
  the thirsty toward wells and ditches, traders toward carts, boats and rail. So does work: a smith
  near ore, a farmer at the field.
- **Practice comes first.** A thing is found only by someone with 100 hours at that kind of work.
  Headway comes in steps of a third of the way at a time, so the progress can be read: who was close,
  and why.
- **Materials.** Iron, rail and the engine need ore in reach or bought in; steam needs fuel; boats
  need timber.
- **Big places and towns find more** (Bettencourt et al. 2007), and a ruler with money to spare
  keeps scholars.
- **Passing it on.** People hear of a thing through talk, which isn't the same as knowing how. They
  learn beside somebody who does it as their work (apprentices), or slowly by seeing it done. Writing
  must be taught. Children inherit what their parents know, copied a little imperfectly, and reading
  only where the family can spare a child to learn.
- **Losing it.** A technique is lost when the last person holding it dies (Henrich 2004, Tasmania),
  unless it was written down and someone can read it again.
- **A new thing is done poorly** and improves as more of a people do it. A whole people only changes
  (its arms, its medicine) once one in ten holds it, or one in twenty for war know-how.
- **Bans.** A stubborn ruler, or one whose faith keeps to old ways, may forbid a new thing (the
  Ottoman printing ban, 1485–1727). A war with a people that has it ends the ban.
- **Eras** are only starting points: what a people knows, its war numbers, its weapons, medicine,
  and house shapes. There are nine, from foragers to the information age, and one people can start
  in a different era from the rest. The era label is read off what a people knows and never decides
  anything.
- **Built things:** telegraph lines, towers and cars are built, owned, fuelled and knocked down.

### 21. Marriage and inheritance
- **Pairing.** A man and a woman, or two of one sex who are both drawn to it, where their people
  accepts it.
- **Each people's marriage customs** are worked out daily from the traits of whoever has the say.
  - How much families arrange marriages (stubborn, patient and greedy peoples arrange; the curious
    leave it to the couple; about 70% arranged in 190 foraging societies, Apostolou 2007).
  - What passes between the families: a dowry where wealth is unequal and the plough is used, a
    bride-price where they are greedy, nothing otherwise (Anderson 2007).
  - Where a couple lives: their own household for the bold and curious, otherwise his family's.
  - Late marriage for patient peoples (Hajnal: women at 24 or more, men about 26).
  - Cousins forbidden under a teaching faith (Schulz et al. 2019).
  - Who inherits: all children alike, the eldest son, or the kin, with a widow's third.
- **Matching.** Families say no to a big gap in wealth (twice as well off is a third of the way to a
  flat no), a different faith or a different people, as far as the families decide. Families arrange
  matches between people of like standing within 6–16 km (Perry 1969). How well spouses' family
  wealth correlates is measured.

### 22. Leaders, government and law
- **Who leads:** elected (every N years), a chief for life followed by their child, or the richest.
  In a vote each adult picks whoever thinks most like them, leaning toward a friend and a leader
  they're content with; at war they want somebody bold, otherwise somebody they trust. People follow
  the bold, the well supported, the generous, the trustworthy and the skilled: both dominance and
  prestige (von Rueden et al. 2008, 2014).
- **A leader's decisions** carry the leader's nature in full for a chief or the richest, and half
  for an elected leader (Horowitz, Stam and Ellis 2015). The other half is the people's average, or
  the council's.
- **Councils:** nobody, the great families, the elders, or all adults, picked by the traits of those
  who already have the say (Flannery and Marcus). A small council is paid in gifts and a large one in
  relief (Bueno de Mesquita). A council that turns on its ruler replaces them (North, Wallis and
  Weingast).
- **Officials** only appear when the ruler can't see to it alone:
  - a headman past the three villages a ruler can see to;
  - a tax collector past about 480 people's tax (the Han ratio);
  - a judge past a dispute a day;
  - a captain for a war or a held place;
  - a governor over subject peoples (an Ur III ensi).
  They're paid a wage, by a tax farm, in land (a timar), or not at all, chosen by lot (Athens). The
  honest take little and the rest skim. An audit at the end of a term (the euthyna) catches some,
  who pay back half and lose the office.
- **Tax collection** reaches only as far as somebody can collect it, and the collector keeps a
  share. The tax rate moves only as far as paying the soldiers needs. The **harvest tax** is set
  once a year, as reaping begins, to fill the chest from what the fields gave last year. Nothing
  stops a greedy leader taking half the harvest except the people's loyalty.
- **Laws** outlast a leader:
  - theft: paid back twice, or a fine;
  - killing: wergild of 40 days' bread paid by the killer's kin, a fine, or death;
  - whether people may be held unfree.
  Laws change monthly, only on a clear lean, and written laws last longer.
- **The unfree** (about one in eleven in Domesday): their coins beyond a day's go to whoever holds
  them, and the bold and most wronged run to another people. A faith that holds all equal frees
  them.
- **Titles** are read off what the ruler holds.

### 23. Unrest: riots, bandits, breakaways, revolution
- **Food riots** (Thompson's moral economy; Granovetter's threshold model 1978). Riots happen only
  where the hungry can see food that isn't theirs: a full store, rich larders, carts leaving. Each
  hungry person comes out once enough of the village already has. That threshold is higher for the
  patient, the loyal and where soldiers are ready, and lower for the hot-tempered, the well
  friended, those who buy their bread, and where the food is plainly being kept from them. People
  half-starved stay home (Ó Gráda). The crowd takes from carts, then the store, then larders, and
  pays a coin a day's food. Riots are bruises, not killings. A bold leader sends soldiers (half the
  grain taken back, the leader blamed for two months); a warm one feeds the crowd for a week; the
  rest do nothing. Either way it weighs on loyalty.
- **Bandits** (Hobsbawm). The hungry, landless, war-ruined and dishonest weigh robbing against
  honest work, by how hard their times are and what there is to take. At most about one adult in
  twenty becomes a bandit. A bandit lies in wait a third of the way along the most used road, at
  least 2 km out, and robs passing carts within half a kilometre (taking food and most of the purse,
  or half a caravan's load). Three or more ride out together to the best weakly held store within
  15 km (never a walled one, at most every twenty days), are driven off by two soldiers to their
  three, and take at most a third of it. Only bandits of a place with a boat turn pirate, and a port
  is shut while an enemy place with a boat is near.
- **Breakaway.** A village whose people's average loyalty falls below the "Breaking away" setting
  declares itself a new faction. If the leader lives there, it's a coup instead. A prophet is first
  in line to head it.
- **Revolution.** A people ruled by a chief or the rich, whose disloyal outnumber the loyal soldiers
  two to one, fights a civil war in which as many fall on each side as the smaller side can manage.
  The winners then choose by their own leaning: people who believe in sharing vote; others follow
  whoever led them. People who vote and have mostly turned on their leader don't wait for the next
  vote (Boehm).

### 24. Peoples dealing with each other
- **Between every two peoples** the engine tracks an opinion that drifts toward an old bond
  (friendship or feud), which fades by half in about ten years. It also tracks alliance, trade deal,
  tribute (who pays whom), marriage ties and cross-border trade (a running sum that halves in about
  70 days).
- **How they start:** old friends are allied and trade without tax; old enemies start with a feud
  every adult knows.
- **Alliances** form against a common enemy or between old friends with warm leaders, and end when
  the liking does. Defenders call their allies in, who come as their leader is bold and likes them,
  or the alliance ends.
- **Trade deals** only where real trade already flows both ways: half a day's food per person of the
  smaller side over about 100 days. They lapse when trade falls below half that, unless the deal is
  an old friendship's (the Hanse).
- **Tribute.** A demand: pay, or there will be war. The share comes from bargaining theory (Fearon
  1995): if r is how many times stronger the taker is, its chance of winning is r / (1 + r), so twice
  as strong takes a sixth of a year's stores and three times as strong a quarter. It's paid daily.
  The payer resents it and stops when it feels strong enough.
- **Marriage between ruling families** (Benzell and Cooke 2021). While the couple lives and stays
  together, a leader's wish for war against the other side counts for less, never nothing.
- **Leave to cross.** An army whose road crosses a third people's land asks first. Friends, allies,
  trading partners, enemies of the target, and weak peoples facing the strong say yes; others sell
  it for a tenth of a season's pay of the army. Refused, a bold, strong general forces the way,
  strips the fields along the road, and is held to have wronged that people (Belgium 1914).
- **What a people holds against another** is measured over about thirty of its adults, from their
  grudges and the news they hold of wars, villages taken and feuds, as they heard it. A wrong
  telling names the wrong side.

### 25. War: why it starts, how it ends
- **Starting a war** takes a real grievance (thefts, killings, a lost village, news held), or
  running out of land, or hunger, or (for a greedy leader) a richer neighbour. It also takes a leader
  bold enough who thinks it can be won. A hot temper is quicker to it, a patient one slower. A faith
  that calls for war on unbelievers adds to it. Tribute coming in is what a war would have taken.
  Family on the other side counts against it. Allies don't fight each other; the alliance ends
  first. With the Wars setting off, no leader may start one.
- **Short of war**, a patient leader demands tribute first, and a patient, warm one may offer a
  marriage instead (up to six times in ten for the most patient and warmest).
- **Rivals** can take up arms again eighteen months after a peace.
- **War weariness** builds with the dead, the years and the hungry. A leader who isn't to blame for
  the war stops sooner; the leader who started it, or their family, fights on (Croco 2011, the
  culpable leader). A leader's own grudge, or the people's, keeps them at it.
- **Who is winning:** places lost tire a side and places taken keep it going, each as a share of
  its places, plus crops spoiled as a share of a year's food.
- **Peace** takes two: the other side accepts only if it's weary or outmatched. A side that is losing
  can ask for terms; the winner takes them with tribute once it has taken more than it lost. A warm
  leader near weariness may offer a marriage to seal a peace.
- **A war lost** shakes the whole losing people.

### 26. Armies, soldiers and battle
- **How many soldiers.** In peace a leader keeps half the biggest neighbour's share plus a base,
  more for old wrongs and boldness, fewer when the treasury can't pay. The number moves a little each
  day. At war, in the fighting season, up to the most that can be called for a season. Soldiers are
  raised about two in a hundred adults a week (twice as fast with a captain): farmers first, then
  crafters, then anyone. Lame and old soldiers are sent home.
- **How an army is raised** (ACOUP): a levy where nothing is written; owed service where the land is
  the leader's or the great families have the say (a knight's 40 days, with scutage paid instead);
  paid where the treasury can keep a month's wages, staying paid while it can keep a week's.
  Mercenaries are the poor and bandits nearby at twice a soldier's wage, and go back to robbing when
  unpaid for a week or let go (Thomson 1994).
- **Unpaid, a soldier may mutiny.** When two in five of a people's soldiers (at least four) are
  unpaid five days or more, they take their arrears from the till and grain where they are, hold
  there, and scatter after a month (Antwerp 1576).
- **War loans** (Slantchev). At war with under a fortnight's wages, a people borrows from the
  richest of its own and of peoples at peace with it, up to twice its population in coins, halved for
  each past default. Interest is about a tenth a year, repaid at a fiftieth a day in peace. Owing
  more than three times its credit, or two months' interest unpaid, it defaults: lenders get what's
  left in proportion, and nobody lends for years.
- **Gathering and marching.** An army gathers at its own village nearest the target and marches
  when enough have come in (more for a patient leader, fewer for a hot-tempered one, or after a
  fortnight). Lanchester: soldiers arriving one by one are beaten one by one. It carries ten days'
  bread a soldier, half again with carts (Engels 1978), at about 20 km a day, and goes only as far as
  that takes it there and back. Soldiers in the field draw more only at their own villages, and walk
  back with under a day left. Nobody marches on an empty pack or a broken blade. Taking a village
  needs four unbroken days.
- **Where to strike** comes from an influence map of each side's soldiers in 2 km cells, kept daily:
  the enemy place in reach worth most against what stands near it. The bold weigh what it's worth;
  the patient weigh what defends it. If enemy soldiers stand across the supply line, the army falls
  back and waits.
- **Generals.** The captain leads, or the leader if bold. Skill comes from patience, curiosity,
  boldness and battles seen. A general knows the enemy only from scouts (horsemen see further) and
  nearby places, as of the day last seen, and otherwise guesses from size. They choose one of five
  plans by nature and knowledge, including raiding, waiting at home and lying in wait two-thirds of
  the way along the enemy's road.
- **Armies meet.** An army sees an enemy army within 5 km (10 km with horsemen). It relieves one of
  its own places under siege if strong enough, meets an army coming for one of its places if the
  numbers suit its leader, or keeps clear.
- **Battle by choice.** Weighed once, when the enemy comes within 3 km: bolder generals take worse
  odds, and they're a third better on chosen ground. Within 1 km, or outpaced by horse, they must
  fight; otherwise they draw off for a week. Armies rest after a battle. A battle lasts a day: after
  ten hours of daylight with nobody broken, the weaker falls back. At night the attacker draws off
  600 m. A walled place with food is surrounded, not stormed.
- **Units.** An army forms units, each with a real officer, sized by how fast orders travel (van
  Creveld): about 150 by voice and standard, 100 with writing, drums and riders, 60 with the
  telegraph, a dozen with radio. Officers are chosen as the people choose: by birth and wealth,
  bought (paying the treasury; the British sale of commissions), by service, or by vote.
  - **Shape** depends on kit and the enemy's kit (Dupuy: about 10 m² a soldier in antiquity, 250 m²
    1650–1871, 27,500 m² in WWII): ranks that strike, depth, spacing, whether it stops a charge.
    Options include pikes guarding slow muskets, a firing line, or spreading out and digging in.
  - **Ground:** height over the enemy's approach, a river or marsh in front, woods for cover, open
    ground for horse. A poor general reads it worse.
  - **The line:** units side by side, a reserve behind, horse on the wings. With the stirrup and a
    bold general, a flanking move to the enemy's side and rear.
  - **Cohesion:** a unit standing still pulls itself together; moving through woods, marsh or a
    river costs order. It's dug in after two hours still.
  - **Blows** from the side or rear land harder. Slope, crossing water, cover, tanks, order and a
    charge against something that can or can't stop it all count. Only the front ranks strike.
  - **Morale:** a unit holds while its losses are under what its morale bears, then withdraws in
    order if it's kept together and its officer stands, or breaks and runs. When half an army's
    units have gone, the army breaks (ACOUP; Krentz). The fleeing are cut down, worst by horsemen.
- **A blow** has about a one-in-four chance of landing per hour of close contact at "How deadly" 1,
  and wounds more often than it kills. A soldier is usually hit twice, falls under the line and goes
  home before a third blow. Armies spreading out lowers the chance of a hit. The wounded leaving the
  field are let go. One in five soldiers knocked out of the line dies within ten days, so three or
  four are wounded for each one killed. Herbs, a healer and medicine save some.
- **Desertion.** A fed, paid army at war loses about a fifth a year (2–7% in peace), more when
  hungry, unpaid, afraid, disloyal or losing. A forgiving leader takes deserters back. A hard one
  hunts and punishes them: fined, beaten, or killed where the law says death. One in between lets
  them be.
- **Prisoners** are taken to the captor's nearest place and ransomed by family, or by the treasury
  for leaders and officials, mostly to whoever took them (Ambühl 2013). After two months they're
  exchanged, killed by a hard and dishonest captor, or freed. Someone let go on parole stays out of
  the war.
- **Arming the unfree.** A badly short army may arm the unfree, the bold and ruthless sooner, the
  warm and honest freeing them for it (Rome's volones, 216 BC).
- **Camp sickness.** A camp of 150 is half as foul as a camp can get (a town needs 2,000 for that).
  Each soldier has about a 1-in-100 daily chance of fever (a fifth of Wellington's army was sick at
  any time), and it kills about one in ten. One sick soldier in twenty a day leaves it in a place
  they pass through. A Roman camp's ditch and latrines halve it.
- **The fighting season** runs from sowing to harvest; levies go home for the harvest while a
  garrison stays. Paid armies, and peoples with rail and engines, fight all year. Raids go in or out
  of season (the Border reivers rode in early winter).
- **Coming to a place.** An army camps two squares past the target's fields and goes in when three
  in five have arrived (at least three), or three days after the first came. A lone soldier doesn't
  chase an enemy into its own fields unless that place is the target or two of their own are within
  750 m.
- **Where the dead fall** is counted, never acted on: at a raid, a village, in the line or in the
  open. Also counted: who fell, on what errand, alone or not, and whether the striker was at home.
- **Bands** (peoples that don't farm) fight by raid and ambush only (Keeley; about 2% of deaths
  among bands, 8–9% among chiefdoms).

### 27. Sieges, raids, and what a war leaves
- **A place defends itself:** a quarter of its adults take up arms besides any soldiers. Besiegers
  only make headway outnumbering all of that by a fifth. A place holds out four days plus a day for
  every fifteen people living there. A wall multiplies the defence; a full wall doubles it against
  hand weapons.
- **Walls** are raised in wartime from the store (murage), after enemies at the edge in the last two
  months or a raid in the last year. Against guns a people builds a low, thick stone wall with
  bastions (the trace italienne, Parker 1976), at twice the work. Cannon break high walls, shells
  break bastions, and against tanks and bombers walls do little. A wall falls only once its place is
  empty.
- **Siegecraft.** Three or more besiegers working under a wall break it over a number of days set
  by what they know: ramps and mining, the Assyrian ramp and ram, the trebuchet, cannon. Mines dug
  with gunpowder take half the time. A broken wall is mended a twentieth a day once the besiegers
  leave. A place shut in for a fortnight, with its store under a third of a day a head and half its
  adults hungry, gives up (Kenilworth 1266). Guns shell a besieged place, a couple of shots a gun a
  day.
- **Surrender on terms.** An army strong enough asks an open place to surrender first. It gives up
  if outnumbered twice over (more under a stubborn leader) with few soldiers of its own: nothing
  burned, a quarter paid. An army that can't take a place goes elsewhere for two months.
- **Taking a place.** The winners take a share of the store and the till. Half the soldiers who
  took it stay as its garrison for a year (Curry). A storm is a sack: half the store taken or
  spoiled, a quarter of the houses burned, animals driven off. A winner who would sooner have tribute
  leaves a last place as itself, paying. Beaten people who won't live under the winner may go and
  break new ground beyond the winner's reach (Carneiro).
- **Raids** (Keeley; the Plains). A band goes only where it outnumbers what holds the place, and
  only to a place with no wall. It breaks off when met by as many soldiers or a quarter down. It
  burns and takes what it can carry, kills a few in its way and carries a few off (the young
  likeliest) to be held unfree where the law allows. Raiders going home fight nobody.
- **An army at a village's edge** spoils the crops on its square and the eight round it. While it
  has the upper hand, it burns about a house for every ten soldiers a day, outermost first. A
  household whose house burns loses half of what was in it and must rebuild from nothing.
- **Fleeing an army.** People run from a siege, a household at a time, the frightened first, to the
  nearest place of their own with no enemy. Soldiers and the leader stay. People come home a week
  after the last enemy has gone, if it's still theirs.
- **Blasts.** A shell or bomb hits everyone within its radius, soldier or not; helmets help a
  little. It breaks walls, houses and bridges. Duds fail about 1 in 5 times in WWI, 1 in 10 in WWII,
  a few in a hundred with modern fuzes, and lie in the ground with mines until somebody steps on
  them. A people that knows explosives clears its own land in peace, over decades. A blown bridge can
  be waded at a ford's pace and rebuilt.
- **Artillery.** Guns are bought, one for every forty soldiers. Solid shot ploughs a line through a
  close rank; shells hit everything near where they land. Poor gunners scatter, and guided shells
  land true. Half the guns are left on the field after a defeat, and the winner takes what it can
  use.
- **Tanks and aircraft** are built at a works with power, only when the treasury can bear it after
  wages. A tank burns half a load of wood in fuel and an aircraft a load. Tanks go with units, shield
  their soldiers, fire on the enemy's front, shake a line that can't stop them, break down, and are
  knocked out by guns and other tanks. Aircraft fly once a day (a jet twice) to scout, carry rations
  or ten soldiers to an army, or bomb an army, town, bridge or store. They scatter half a kilometre
  until guided weapons (the Butt report 1941) and are lost on about 2.3% of sorties (Bomber Command).
  Helicopters carry and scout.

### 28. Weapons by what a people knows
- **18 war techniques:** bronze, the chariot, the composite bow, steel, the crossbow, the stirrup,
  cannon, drill and volley fire, the bayonet, rifled breech-loaders, high explosives, the machine
  gun, lorries, the tank, the aeroplane, the jet, the helicopter and guided weapons. They're found
  mostly by smiths and soldiers, three times as often at war. A find opens an option and never
  switches an army over by itself (the stirrup debate).
- **Each people's kit** is worked out daily from what it knows and can pay for: weapon, bow and
  share of archers, armour, chariots, horsemen, siege guns, how its army is raised, the season, and
  the size of its standing and campaign armies.
- **Lethality** (Dupuy 1980): a sword 23, a bow 19, a crossbow 33, a longbow 36, a flintlock 43, a
  breech-loader 153, a WWII machine gun 4,973. Guns mean more hits, not harder ones: no single blow
  is more than 1.5 times a sword's. Weapons with reach let everyone in range strike anyone in it
  (Lanchester's square law); hand weapons fight one to one (his linear law).
- **Dispersion** (Dupuy): the ground held by 100,000 soldiers grew from about 1 km² in antiquity to
  20 under Napoleon, 250 in 1914 and 3,000 in WWII. So the chance of a blow landing falls as weapons
  get deadlier: muskets 70%, rifles 35%, machine guns 20% of hand weapons. That keeps modern war to a
  few in a hundred of a people a year at worst.
- **Archers.** At Crécy about half an army shot, at Agincourt about four in five. Who shoots is fixed
  per person.
- **Armour.** Mail alone doesn't stop arrows; mail over padding cuts the risk greatly; plate over
  mail was nearly arrow-proof by the late 1400s. Bullets get through, at under half a blow's share.
  Armour is bought from the soldier's own purse (a horseman's cost about twelve oxen), dropped when
  rifles go through it, and comes back as helmets.
- **Chariots:** a Bronze Age archer on a chariot, one soldier in ten. **Horsemen:** about one in
  seven where a people has horses, and horse archers among herding peoples.

### 29. Faith
- **Folk belief** comes first. Every people starts with its own, kept house by house, read from its
  adults' natures: the warm keep their ancestors, the curious see spirits in places.
- **A faith is made up by one person** after a hard event they can't explain: a famine, sickness,
  drought, a war lost, their village taken. That happens in about one such event in six, likelier for
  the curious, the bold and the frightened (Boyer). Its content comes from its maker's nature: a rite
  (a feast for the warm, a fast for the patient, an offering, a sacrifice for the hot-tempered and
  cold), a rule (no stealing; never turning the hungry away), whether it calls for war on
  unbelievers, whether it lives by rare rites or by teaching (Whitehouse), and how often its holy day
  comes round. With "many things" on, a faith can also hold views on the sacred, the afterlife, food
  and drink, harm, who may lead it, washing, healing, reading, rank and new things.
- **It spreads** by talk between people who trust each other (Stark), and to children. Holders trust
  and help each other more. A ruler's faith becomes the people's, with a priest. People pressed to
  convert keep the old faith hidden and go back to it once nobody presses them. People pressed hard
  may leave with their household.
- **Zeal fades** with reading, towns, other faiths nearby and failed promises; where nobody reads it
  hardly fades (Gore et al.). Disasters make people more devout (Bentzen 2019).
- **Heaven's favour.** Where a faith ties its gods to the ruler, hard times are held against the
  ruler and weigh on loyalty: fully for holders, half for others, fading over about a year (Jia 2014;
  Chaney 2013).
- **Prophets** (Wallace's revitalization movements: the Ghost Dance, the Xhosa cattle-killing, the
  Taiping). They appear where trouble keeps coming to one place; a famine counts 1.5 a month and
  trouble halves in about four months. Their movement spreads fastest among the hungry, frightened
  and unhappy, and turns them against a ruler who doesn't hold it. It burns out if the hard times
  return (Festinger: a stubborn few hold harder).
- **Blaming a neighbour.** After a famine, sickness or drought, a frightened village may blame
  someone: likelier the old, a woman, the poor, the disliked, someone of another faith, or a healer.
  It's likelier where two faiths compete (Oster 2004; Miguel 2005; Leeson and Russ 2018). A judge, or
  a teaching faith's priest, may acquit. A sheltering shrine gives sanctuary. Otherwise the person is
  shunned, driven out or killed.
- **Births:** the devout have a few more children (Kaufmann), more where their faith bids it. Some
  faiths marry young; a faith whose teachers keep apart has celibates.
- **Trade:** traders trust their own faith further (Greif's Maghribi traders) and go half again as
  far to reach it.
- **Rites and the year:** feasts at the harvest, midwinter and spring, and a day for the dead where
  ancestors are kept, paid by the store. Birth, coming of age, weddings and funerals cost the
  household food and bring people closer. A tithe of half a hundredth a month goes to the village's
  keeper of the faith.
- **Shrines** take 400 hours to build. **Great temples** take 30,000 hours over years, fed from the
  store, at a people's first village once its faith is held hard.
- **Pilgrims:** once a year the zealous within 30 km go to the holy place, spend there, meet
  strangers and may bring sickness home.
- **When faiths meet:** a faith held by two rulers splits into sects that know they were one, and
  tolerant sects may rejoin. Faiths side by side borrow each other's days. A faith drifts toward what
  its holders now are (a fifth as fast once written down), and a large faith of rites turns to
  teaching.
- **Rulers and faith.** A greedy ruler may seize a rich faith he doesn't hold (Henry VIII). A zealous,
  hard ruler may tax or force unbelievers.
- **Faith and war:** truces on holy days (kept as hard as the army's zeal), martyrs (zealous
  soldiers hold longer, and a death in battle makes friends hold harder), alliances sworn by shared
  gods holding longer.
- **Other effects:** faiths of washing protect a little against foul water, and healing faiths tend
  their sick. A faith that turns from new things has its zealous refuse them. A teaching faith runs
  schools, and its readers keep and give back lost knowledge or revive a dead faith from writings. A
  faith that holds all equal frees the unfree; one that keeps people in their place weighs matches
  across rank. Sacrifice in hard times takes, by preference, someone unfree or a stranger (Watts et
  al. 2016).

### 30. Bands, wanderers and the edge of the map
- **Bands** are peoples that don't farm. They hunt, herd and fish from a camp and share everything
  by need (Kaplan, Hill). Their headman can't tax (Boehm). They move camp when the food nearby runs
  down (central-place foraging; Marlowe 2005: 7.4 moves a year on average). They may never move where
  fish are rich. They settle once most of the band learns farming. A band that splits makes two camps.
- **Wanderers.** An adult with no coins, hungry, in a hungry village, with no small children and bold
  enough, may take to the road (at most one adult in ten). They go village to village asking for
  bread and settle where there is a fortnight of bread a head and few hungry.
- **Beyond the edge** (open setting; guesses). Strangers walk in weekly at about one a month per
  10 km of edge, more when the land is underpopulated and none when it's hungry. A stranger is 16–35
  years old with a week's food, and joins the nearest village. Hungry people within 2 km of the edge
  leave, a few in a hundred a week, taking their coins out of the world.

### 31. Ruins and scavenging
- **The unit is the building.** A building in use doesn't wear. An empty one goes through five
  stages (worn, roof holed, roofless, fallen, a mound) on a clock set by its material: timber in
  decades, stone walls in centuries. Mending costs a share of new, by stage.
- **What's left in a ruin rots:** grain half gone in three months, wool and hides in half a year,
  wood six years, goods eight, iron fifteen, stone never. Nothing is ever put into a ruin.
- **Scavenging.** People within a kilometre see what's in a ruin; neighbours within 5 km know when a
  place empties. Scavenging is weighed like cutting wood. One trip carries a back-load of 25–30 kg,
  and stone is never taken. Another people seen or heard taking from its ruins becomes news and a
  grudge, possibly against the wrong people.
- **A village founded on a ruin** takes its houses, store, buildings, wall, well, boat and layout.
- **Places empty at the start** (setting): a chosen share of places is emptied and set months to
  thirty years into decay, recent likelier. Survivors know of the empty places within 10 km.

### 32. The watcher ruling a people
- The watcher can rule any faction: its tax, harvest tax, soldiers, relief, war and peace, and a tax
  and relief per village. Everybody else still lives by the same needs, so a heavy tax is felt,
  resented and fled from exactly as a leader's would be.
- **Declaring war or peace.** Peace takes two: the other side accepts only if it's weary or
  outmatched, and nobody makes peace the week they were attacked unless badly outmatched.
- **Arranging a marriage** between any two adults of two peoples, which the other side doesn't
  refuse (Ric: "I should have ultimate power"). At war it seals a peace.
- **Live settings** can be changed mid-run, but only the ones the engine reads as it goes. A world
  nobody rules is byte-for-byte the same.

### 33. What it records and reports
- **369 counters** (`count.*`): births, starved, sick, battle deaths, wars, peaces, riots, thefts,
  coins minted, roads built, prophets, pilgrims, deserters, ransoms, and so on.
- **A daily row for the graphs** (the last 600 kept): people by faction, food per head, price,
  share hungry, average loyalty, births, deaths by cause, moves, changes of side, grain, wars.
- **An event log** that keeps the most important (least important goes first). Each event can carry
  the numbers the decision was actually made on, plus a "because" chain back up to five links (the
  newest 20,000 links kept). These are written where the decision is made and never read back.
- **The census** (daily): each faction's trait averages, who feeds whom, each village's spare and
  short food, wealth per head of household, village and faction.
- **What can be read off a person:** needs and urgency, days of food carried, traits, what they hold
  in mind in plain words, ties, gear, experience, faith, where they're going and why, and their
  life's chain of reasons.
- **For the map:** land codes, roads, held fields, buildings and their stage, house layouts' streets
  and greens, house fires lit, army camps, blasts and bombing runs, game in forests, machines, and
  what each person visibly carries (`mapLook`, read from the last worked-out kit so watching changes
  nothing).
- **Faction and village views:** government, land holdings and how unequal they are, know-how known,
  findable and lost.

### 34. Speed: short cuts that change nothing
- **No upper limit** on people. The engine runs in a Web Worker and sends the page only what it
  draws.
- **Short cuts that may only make it faster.** Tests run the engine with each one off and hold the
  two worlds identical.
  - People with nothing to do are passed over until their wait is up or room is made beside them
    (`wake`).
  - Blocked steps and failed searches for a way round are remembered until room is made (the
    "sleeping body" idea from physics engines).
  - Who-stands-where lists are kept up as people move instead of rebuilt.
  - A crowd is placed using a finer map of taken ground.
  - Every person has every field from birth (21 object layouts once made a third of the time go).
- **Reading never changes the world:** the keeper, the panels and `mapLook` all read without leaving
  a mark (`test/keeper.test.mjs`, `test/watching.test.mjs`).

### 35. Not in the engine yet
- Nobody remembers a dead friend. Soldiers fight only soldiers, though raids and blasts kill
  others.
- Saving a world (TODO 19 and 21h). Long production chains. Zooming in to fine detail worked out
  from the seed. No sound.
- Several numbers above are marked as guesses in the code, among them: house work hours, ditch
  hours, forest clearing, strangers over the edge, soldiers' spending, the composite bow, same-sex
  attraction, ruins' decay. TODO 15.13 is the reading still to be done for faith and lives.

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
