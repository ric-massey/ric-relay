# CROSSFIRE

CROSSFIRE is a dependency-free canvas game for one to five ships. Play co-op
against asteroid waves, fight a no-time-limit Battle Royale inside a closing
wall, run the three-mission Campaign — escort a transport, raid an enemy convoy,
and break a mothership in an all-out fleet war — or take a Survey, alone, of the
endless space all of that happened in. It runs as static HTML, CSS and JavaScript with
no build step.

## Run locally

From the repository root:

```sh
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000/projects/crossfire/`.

## The menu

The front page asks one question — **solo or multiplayer** — and the modes for
that answer are the next page. It used to be five rows with a line of small print
under each, all competing for one glance, and it got a row longer every time the
game grew.

The second page is a row of cards. Point at one and it opens: the card takes the
room the others give up, the paragraph fades in, and the picture at the top is
the mode *moving*. Those pictures are drawn, not filmed — see `menu.js` for why —
and the same mode reads differently in each lane, because Battle Royale against
bots is not the same proposition as Battle Royale against the person next to you.

Solo flies straight in, since there is only one answer to "how many". Multiplayer
stops at the count screen first. Both reach the same modes and the same match.

## Modes

| Mode | Players | Rules |
|---|---:|---|
| Survival | 1-5 | Co-op asteroid waves, shared lives, optional friendly fire, wrapping arena |
| Battle Royale | 2-5 | Three lives each, two-hit hulls, stationary gravity hazards, closing wall, no time limit |
| Campaign | 1-2 | Three scripted missions, sides instead of a free-for-all, an allied fleet flying with you, a shared reserve of lives |
| Survey | 1 | No edges and no losing. Something to build, six parts to find and a clue for each, endless procedural space, a chart you pin yourself, a thirty-three entry almanac, salvage, a refit and a derelict you fly inside |

Battle Royale shows hull strength only for ships controlled on the current device.
First hits stay quiet; losing a life adds a short entry to the feed beneath the
minimap. Battle Royale resolves when one ship remains, no matter how long the
match takes. A winner screen shows kills, deaths, environmental deaths and time
survived for every ship.
Each spawn can take two bullet or asteroid hits before losing a life. The first
hit leaves one hull point and a brief impact shield; suns and black holes remain
immediately lethal.

The shrinking Battle Royale wall deactivates a stationary gravity hazard after
its center is outside the playable arena.

A spawn has three rules and only one of them bends. It is always inside the
current wall, and always outside every live hazard's *pull* — not merely outside
the lethal core, because a ship spawned inside a well is dragged into it while
still invulnerable and dies the moment that runs out. Those two are absolute.
Being clear of asteroids is the third, and when no point satisfies all three the
asteroids are destroyed to make room rather than the ship appearing inside one.
The opening spawn ring is re-checked once hazards and rocks exist, since it is
laid out before there is anything to avoid.

The wall pushes but cannot hold. A bounce returns at least the wall's own
closing speed, so anything the wall overtakes is moved ahead of it instead of
being carried along its face for the rest of the match.
The result screen can immediately replay the same local setup; online, the host
starts the next round for every connected player.

## Campaign

The campaign is three scripted missions, played local — one or two pilots at the
keyboard, no online. It reuses the Battle Royale engine but adds two ideas the
free-for-all modes don't have: a ship has a *side* (yours flies teal, the enemy
red), and a ship has a *kind* — most are fighters, but a transport, a turret and
a mothership are not. Friendly fire is off, so a shot only ever bites the other
side, which is what keeps a crowded battle readable.

You never fly alone. An allied fleet flies with you, and both sides field more
ships than are ever alive at once: a downed fighter is a slot its side refills
from a reserve, so a fifty-ship roster stays a thirty-ship battle and holds frame
rate on a phone. The pilots draw their respawns from one shared pile, the way
co-op Survival does; when it runs out and the last pilot falls, the mission is
lost.

Each mission is a **run of phases** with a shifting objective, not one long
fight:

| # | Mission | The acts |
|--:|---|---|
| 1 | **Convoy** | A transport crosses from one side of the map to a planet on the far side at a steady, unwavering speed — your job is to keep it alive the ~fifty seconds that takes. Three worsening threats travel with it: three waves, an ambush, then a blockade gunship. Reaching the planet is the win; losing the transport is the loss. |
| 2 | **Raid** | Hunt down three fleeing enemy transports and their guards · then ride out the counterattack they scramble in revenge. Lose if every pilot falls. |
| 3 | **Mothership** | Breach the picket line · knock out the hangar bays that keep launching fighters · destroy the three shield generators sealing the core · kill the exposed core, which comes apart in a slow-motion death sequence. An allied flagship pushes in with you and can be lost. |

Every mission is fought across a real battlefield: drifting **asteroids** for
cover and **suns and black holes** whose gravity bends shots and swallows the
careless — placed clear of the ships' starts, the convoy's lane, and the
mothership itself, so a well never does your job for you. The bots fly around
them; so should you.

In a campaign the pilot picks a **difficulty** on the setup screen that sets both
the trigger and how many hits a ship takes. On **Easy** ships take five hits and
the gun **fires continuously** — hold the trigger for a steady stream. **Hard**
(three hits) and **Impossible** (one hit for *everything that flies*, you and the
enemy both) drop back to the three-round burst the free-for-all modes use, so
harder runs ask you to pick every shot as well as survive on less. Difficulty only
ever touches fighters; the transports, the mothership
and its subsystems always keep their own hulls, so a mission is never decided by a
single lucky shot on the objective. Easy is the default — a gentle way in.

Two things make you a commander, not just a pilot. **Squad command** — `1` focus
fire on your target, `2` defend the objective, `3` regroup on you — orders the
whole allied wing at once. And **salvage**: an enemy that dies sometimes leaves a
canister, an ace always does, and flying through one patches your hull, raises a
shield, or loads rapid or heavy rounds. Named **aces** — tougher, near-perfect,
worth the salvage — drop into the harder fights and show up in the kill feed.

The missions climb: Convoy hands a new player three wingmates that screen the
transport and weak opening waves, and Mothership is deliberately hard — the
allied fleet can crack it on a good run, but it is built to want a person tipping
the balance with orders and salvaged guns. A cleared mission offers the next one
straight away (`N`), a retry, or the mission list.

The three missions are **one war, not three loose fights**. A few of your
wingmates fly with callsigns and a forward chevron; the ones who **live** carry
into the next mission by name as veterans, flying a shade sharper. A strong
showing banks a **fleet-strength** rating and a **reserve of extra lives** that
top up the next mission's reinforcements, and the enemy aces you down are tallied
across the campaign. The debrief spells out exactly what you're carrying forward,
and `NEXT`/`RETRY` continue that war while a fresh pick from the mission list
starts a clean one — so winning matters past the result screen. All of it is
campaign-only; Survival and Battle Royale never build a fleet ledger.

## Survey

Survey is the mode with nothing shooting at you. It borrows Battle Royale's
camera-followed view and its gravity wells and drops the wall, the enemies and
the losing. There is no score, no timer and no result screen. The only thing
that accumulates is the almanac.

### It has no edges

Survey does not have an arena. Space is generated in **chunks** as you reach it
and thrown away behind you: what a chunk contains is a pure function of the seed
and the chunk's coordinates, so flying back to somewhere you left an hour ago
finds the same stars where you left them without any of it having been kept.
Nothing is stored for space you have not visited, which is the only way an
endless map costs less than endless memory.

Two consequences shape everything else. Ships never bounce off anything, because
there is nothing to bounce off — the wall code is **skipped**, not moved far
enough away to be unreachable; a `bounds` big enough to look infinite is still a
box. And "percent charted" is meaningless, since every fraction of an infinite
plane is zero, so the player is given a **count of cells** and the three
CARTOGRAPHER entries are thresholds on that count.

Rocks are deliberately *not* part of a chunk. They drift, so a chunk that
regenerated them would snap them back to where they started every time you flew
away and returned; instead a population is kept around the ship and topped up at
the edge of it, the way Battle Royale tops up its field.

### What you are doing

Survey shipped without a goal. It had an almanac — a record of what you happened
to see — and that is not the same as a reason to go anywhere. You could fly for
an hour without the mode ever asking you for anything.

So there is **the yard**, just off the origin, and it is short of six parts.

| Part | Where its clue sends you |
|---|---|
| Drive spar | a wreck field — somewhere a lot of ships stopped at once |
| Fusion core | a binary pair, where nothing is ever dark |
| Ranging lens | a rogue world, with no star to warm it |
| Jump coil | wound around a gate |
| Signal beacon | a wreck still calling, long after anyone stopped listening |
| Ablative plate | deep inside the Leviathan, past its sentries |

Each part is placed the way a landmark is — its own bearing, its own distance —
and **brings its own scenery with it**, so the clue is a promise the generator
keeps rather than flavour text laid over whatever the chunk happened to roll. The
distances interleave with the landmark ladder, so filling the manifest walks you
past most of the almanac on the way out.

Nothing hands you a position. The clue says what kind of place to look for, the
HUD carries a bearing and a range band, and the rest is flying. Parts do not go
in the hold, cannot be sold, and are not dropped when your hull goes — the
manifest is the spine of the mode, and a part lost in deep space would be a run
you could not finish.

### The scan is a scan now

It used to return a compass bearing to the nearest unlogged almanac entry and
print it in the message feed, which is a fine thing to have and a terrible thing
to press a button for: the answer was a number, and nothing on screen ever said
what it was a number about.

It sweeps a radius now and tells you what is inside it — salvage, caches,
stations, gates, components, sentries — each one a tagged echo that sits on the
world and the chart for twenty seconds and then fades. That is something you can
see the result of, and the scanner refit makes the circle bigger, which is
something you can feel.

Direction to the thing you are looking for is not on that key at all. It lives on
the HUD, permanently, next to the clue. A button you have to press to be told
what you are doing is a button doing the interface's job.

### The chart is yours to mark

Endless space has no place names. Nothing out here is called anything and the
chart labels sectors by chunk coordinate, which is not a memory. So you pin it
yourself: six kinds — salvage, cache, station, gate, part, danger — because "I
found something here" and "do not come back here" are different notes, and a
chart covered in identical dots is a chart you stop reading. Pins are drawn on
the flight panel too, and they are kept in the book.

Tapping a pin lifts it. The same gesture marks and unmarks, so there is no eraser
mode to be in.

### It is a world, not a backdrop

Survey shipped as a sector you flew *through*: the only thing that could touch
you was a gravity well, and every planet, wreck and marker was painted on. An
endless sector still felt small, and this is why — nothing in it pushed back.

Everything is solid now. Planets, drifting hulks and the Leviathan's plates all
resolve against one collision, and the rule they are drawn by is that **the shape
you can see is the shape that stops you**: the first time a player clips a hull
they could clearly see, they stop trusting every other edge in the sector. A slow
brush is free and only a real impact costs hull, because a world that charges a
hull point for every graze is a world you fly through the middle of.

Four things were added to have somewhere to go:

- **Wormholes.** Falling into one throws you tens of thousands of units. There is
  nothing to press — the same way there is nothing to press to arrive anywhere
  else out here. A gate's far side is a pure function of the gate, so it is a
  route rather than a random teleport.
- **Guarded caches.** Sealed while anything is standing over them. The guard is
  the point: a cache you can dash past is a pickup with decoration around it.
  Sentries are *posted*, never roaming — Survey's promise was that nothing hunts
  you, and a guard that never leaves its post keeps it.
- **Stations.** Where salvage becomes a better ship. One is planted at the origin
  so the first refit is not a scavenger hunt.
- **The Leviathan.** The eighth landmark, 112,000 units out, and the only one
  with an *inside*. Two flanks of hull discs with the stern quarter left open,
  a bow cap that makes the corridor a dead end rather than a tunnel, and three
  caches down the spine — the deepest worth the other two together.

### Two inversions

**The chart starts blank.** The minimap every other mode hands you complete is,
here, a record of where you have actually been — objects appear on it only in
cells you have charted.

**A gravity well is a tool as much as a hazard.** A star is the one place a hull
repairs, so it is a destination rather than only a way to die, and a black hole
is the fastest way across open space if you are willing to fall into one on
purpose. The cores of both still kill; in Survey that costs the climb back out
rather than the run, so the risk stays real without anything ending.

### The almanac

Twenty-five entries. Seventeen are conditions on telemetry the simulation
already computes every frame, seven are **landmarks** placed out in the dark,
and one is inside a rock. Every entry has a **picture** — a small vector drawing
of the thing it is asking you to find, which is what makes it a field guide
rather than a checklist: a name tells you what you have not got, a picture tells
you what to go and look for. Two entries keep their picture and lose their name
until found.

The seven landmarks sit at increasing distances from the origin — the graveyard
is a short flight, the supernebula is an expedition, and NODE 01 is out past
anywhere you would reach by accident. That ladder is what endless space is
*for*. Each takes one equal slice of the compass with a little play inside it,
so no seed can put the whole ladder down one corridor.

A **scan pulse** returns a bearing to the nearest landmark you have not logged,
at any range — direction only, never a position. In endless space that is the
whole navigation system: there is always somewhere to go, and no scan ever hands
you the way there.

Configurations that used to be placed by hand — a binary pair, two wells whose
pulls overlap — are now rolled per chunk, roughly one in eight. That is the
endless-space answer to a problem the fixed arena solved by hand: an entry that
needs a configuration cannot depend on a single lucky spot when there is no
single sector, so both are always somewhere ahead of you.

### Two kinds of progression

They are deliberately separate, and they pay in different currencies.

**Salvage buys numbers.** Break a rock, strip a hulk, crack a cache, and it goes
in the hold — one number with one cap. Spend it at a station across four tracks
of three tiers: hull plating, drive, cargo hold, scanner. Losing your hull spills
half the hold where you lost it, and it is still lying there when you get back:
Survey has no fail state and inventing one would only punish going and looking,
but a hold you can drop is what gives a long haul home its nerve.

**The almanac buys verbs.** Three things the ship simply could not do, handed
over for looking rather than for money, at six, twelve and eighteen entries:

| Entries | Unlock | What changes |
|---:|---|---|
| 6 | Tractor beam | Salvage comes to you. A pass over a broken rock stops being six manoeuvres |
| 12 | Warp tuning | A gate drops you at the nearest thing you have not logged, which is what puts the far end of the ladder inside an evening |
| 18 | Running dark | Cut the engine and sentries lose you — every cache becomes a choice between shooting in and drifting in cold |

A station shows both tracks side by side even though only one is for sale there.
The player staring at a price list is exactly the player who should be able to
see what *looking* would buy instead.

### The chart and the almanac are pages

Not overlays. They take the whole screen, the world is not drawn behind them,
and they are reached and left the way the title and settings screens are — a map
you read through a half-transparent asteroid field is a map you squint at. The
chart pans and zooms over the infinite lattice, draws the line you actually flew,
labels sectors by chunk coordinate and carries a scale bar; the almanac is a grid
of illustrated cards.

### Starting over

Settings carries **RESET SURVEY**. It wipes the almanac, the chart and the flown
line, the hold, the refit, the yard's manifest, every pin, and the record of
which caches and hulks had been worked over — then rolls a new sector and drops
you into it. Preferences are not progress, so the zoom, the keys and the sound
all stay.

It asks twice, with four seconds to answer. This is the only button in the game
that destroys hours of work, there is no undo, and it sits near one that resets
the keyboard — a much smaller thing wearing a much similar word.

The new seed beats a `?seed=` in the address bar as well as the saved one.
Somebody who opened a seeded link and then asked for a new world means it, and
handing back the same sector would look like the button did nothing.

### Seeds and saving

A **seed** makes a sector, so a sector is a place you can go back to and a link
you can send someone: `?seed=1234`. Without one, your sector, the chart you have
made of it and the line you flew are remembered between visits. Both big
structures are run-length encoded and packed rather than written as JSON — a
survey's charted cells are the shape of the path that made them, so long
horizontal runs compress hard — and written both when an entry ticks and every
fifteen seconds of flying.

### Coming back

A survey is kept in one key — the book — and resuming reads it: the sector's
seed, the chart, the almanac, the hold, the refit, the manifest, the pins, and
**where you were**.

That last one is new, and it took something away. Survey used to resume at the
origin whatever you had done, which read as tidy and was in fact the cheapest
ride home in the game: fly to the abyss with a full hold, close the tab, open it
next door to the shop. Coming back where you actually were is what a save is
for, and it makes the light drive and the gates the ways home rather than the
reload. Two places are exempt, and both resume at the origin as every book used
to: a book written while you were dead, and a book from a different seed.

### The door

Survey opens on the account question rather than straight into a sector,
because it only has a good answer *beforehand*. Asked after two hours, either
answer is bad news: sign in and there are two surveys to reconcile, stay a guest
and you have already built something one cleared history will take.

Three ways through it — **sign in**, **create account**, **play as a guest** —
and a fourth that goes back to the modes having started nothing. It is asked
once: sign in and you are signed in, choose guest and that is remembered and the
door stops appearing. Both are reversible from SETTINGS, where SIGN IN and SIGN
OUT sit beside SOUND and FULLSCREEN, because an account is a setting of *you*
rather than of a mode. Signing out puts the question back.

A guest who later signs up keeps their run: the survey on the device goes up to
the new account.

### An account, which is optional

Survey saves to this browser whether anybody signs in or not, and that has not
changed. What an account adds is a *second* copy: the same book in a row of a
table, so the sector charted on the laptop is the sector that opens on the
phone, and clearing site data stops meaning an afternoon is gone.

It is a mirror and never the source. The run reads and writes local storage at
full speed; the account is told afterwards, and the game never waits for a
network to draw a frame. Writes are coalesced — Survey saves every fifteen
seconds and at about thirty events besides, and a row written that often would
spend the free tier's budget on a number that changed by one — so the newest
book goes up at most every twenty-five seconds, plus whenever the tab is hidden,
the player signs out, or the SAVE button is pressed.

Two saves that disagree are never resolved silently. Both sides are somebody's
hours, and the panel says what each one is — sector, cash, catalogue, when and
from what — and lets the player pick.

`cloud.js` talks to Supabase over plain HTTP with no SDK: sign in, refresh, read
a row, write a row is the whole of it, and 120 KB of CDN script to make four
fetches would cost the game its two actual properties — no build step and no
third-party script on the page. `config.js` holds the project URL and the
publishable key; blank there means no accounts, no request is ever made, and
everything else works exactly as before. `supabase/schema.sql` is the one table
and its policies, every one of which names `auth.uid()`.

The save button is not what keeps a run — autosaving already does that. It is
for the two things autosaving cannot do: send it to the account *now* rather
than at the end of the coalescing window, and say out loud that it worked.

### Where it lives

`index.html` is already 8,000 lines, and a fourth mode's interface — a fog chart,
an illustrated almanac, contact bearings, a station screen — is not a small
tenant. `survey-hud.js` is loaded the way `net.js` is and handed the engine's
drawing primitives at boot. `menu.js` is loaded the same way for the same reason.

Both must be loaded **before** the inline script, which captures each global
once. Loading either late is silent: the mode would play with no chart and no
almanac, and the menu would draw cards with nothing moving inside them. Both
orderings are asserted in `test/smoke.js`.

## Controls

- Amber: `A` / `D` turn, `W` thrust, `Space` fire.
- Green: arrow keys turn and thrust, `Enter` fire.
- `O`: open the online panel from the title screen.
- `P` or `Escape`: pause locally or open the online game menu.
- `Tab`: watch another active ship in Battle Royale, or your own side in a Campaign.
- `1` / `2` / `3`: in a Campaign, order the allied wing to focus fire, defend, or regroup.
- `N`: on a cleared-mission screen, fly straight into the next mission.
- `C`: open Settings from the title or pause menu.
- In a Survey: `F` sweeps a scan, `M` opens the sector chart, `L` opens the
  almanac, `E` docks at a station you are sitting in, and `Escape` leaves
  whichever page you are on. On the chart, drag or arrow to pan, `±` zooms, `C`
  recentres, `P` cycles the pin kind and a click drops or lifts one — the wheel
  zooms through nine steps, from 690,000 units across down to 8,300, and the
  widest fits any world the generator can roll; in the
  almanac the wheel and a drag both scroll, and clicking an entry opens it full
  size — arrows then page through entries without closing it. At a station the
  arrows move and `Enter` buys. On a phone every one of those is a tap or a drag,
  and the almanac counter is itself the button.

  The almanac was on `L` from the first day and almost nobody found it. A
  keybinding with nothing on screen pointing at it is a keybinding that does not
  exist, so the counter names its key and is itself the button.

Every weapon fires three-round bursts, except the campaign pilot on **Easy**, who
holds the trigger for a continuous stream; Hard and Impossible put the pilot back
on the burst. Keyboard bindings and the Battle Royale camera
preference are editable in Settings and saved in local storage. On a campaign
setup screen `E` / `H` / `I` pick Easy, Hard or Impossible. The mouse operates
menus only.

The menus are not still: asteroids drift behind them and two ships fly around
taking the occasional shot. That field is its own small world in screen
coordinates — it never touches the match's rocks, ships or arena — and it is
drawn only on screens that have no world of their own, so a paused match and a
result screen still sit over the real thing. It is deliberately faint enough for
menu text to read over, and it stops moving under `prefers-reduced-motion`.

Sound effects are synthesized in the browser with Web Audio, so there are no
audio files to load. Sound starts on the first keypress or tap and can be muted
from the title, Settings or pause menu; that preference is saved locally.
Fullscreen is available from those same screens when the browser supports the
Fullscreen API. The whole page enters fullscreen so phone controls remain visible.

Phones support one ship per screen. Players can choose a directional stick or
left, right and acceleration buttons, resize and move every control, and enable
automatic fire. The arrow layout always fires automatically.

## Online play

Online matches are host-authoritative WebRTC matches, one screen per player.
`net.js` uses one reliable data channel for control messages and one unreliable
channel for current world state.

`ONLINE` on the title screen opens one panel for both sides. It shows the lobbies
open right now — name, mode, host, players, and whether the lobby is open or
locked. Joining an open lobby is a click; joining a locked one is a click and a
password. `host your own lobby` names a lobby, picks the mode, optionally locks
it with a password, and puts it in that same list.

The mode is chosen when the lobby is made, not when it starts, so it travels in
the list and everyone knows what they are joining. Guests ready up and can see
what they are waiting to play; the host's start button appears only once
everyone has, and starting takes the lobby out of the list immediately.

That list is the whole of online play — there are no invite codes to copy or
paste. Session descriptions still cross between browsers, but the room service
carries them, so nobody handles one. Online therefore needs a room service: with
none configured, or none answering, the panel says so instead of offering a list.

The host must keep the Crossfire page open, but it can be in a background tab. An
inline worker keeps the simulation stepping when animation frames are throttled.
Brief connection interruptions get a recovery window; a player who fully leaves
is removed without awarding a kill or environmental death.

`net.js` contacts the configured STUN and TURN servers only while making an
online connection. There is no external request during page load or local play.
The host has a small shooting-latency advantage because guest inputs resolve when
they reach the authoritative simulation.

### When players cannot connect to each other

Most pairs connect directly and never touch a relay. STUN is enough for that: it
tells each end what its own address looks like from outside, and the two then
reach each other. It is not enough for everybody. Carrier-grade NAT on mobile
data, and most office and school networks, refuse inbound connections outright,
and no amount of describing your address helps. Those players can only be
connected by relaying the traffic through a third machine, which is TURN.

The relay is not configured in the page, because its credentials expire. The
room service mints short-lived ones and the lobby collects them from `GET /ice`
when it opens; see "A relay" below. With no relay on offer the game falls back
to its own STUN-only list and plays as it always has — the difference is only
ever visible to the players who could not have connected at all.

A relay is the last resort, not the default: the browser tries every direct
route first and falls back only when they all fail. So the cost is paid for the
minority who need it, and a relayed match still never involves the room service.

Two things in `net.js` exist entirely because of this. Relay addresses are
carried through the compact session-description encoding as their own kind — a
dropped one fails silently, since the browser gathers it, the encoding discards
it, and the pair that needed it simply goes on not connecting. And gathering
waits longer when a relay has been promised but has not yet arrived: a TURN
allocation is an authenticated round trip where a STUN binding is one packet, so
the old three-second cut would have spent the whole cost of a relay and then
left without it. When no relay is configured, that longer wait never applies.

## Room service

The room service is what makes online play work: it holds the list of open lobbies
and hands each guest's offer to the host and the host's answer back. It carries
those descriptions only; gameplay remains peer-to-peer, and it sees no gameplay
at all. All state is held in memory and expires automatically.

It runs in two places from one set of rules. `server/rooms-core.mjs` is the
service itself, written against nothing but `Request`, `Response` and Web
Crypto. `server/worker.mjs` runs it on Cloudflare for everybody;
`server/rooms.js` runs it on a laptop for whoever is working on it. The two
runners hold plumbing only — no limits, no origins, no password rules — so
there is no second copy to fall out of step with the first.

`GET /rooms` returns what the list shows: id, title, mode, host name, player
count and whether a room is locked. The mode is an opaque label here — the game
decides what it means. A room's password never leaves the service — only a
salted hash is kept, comparison is constant-time, and a room stops answering
guesses after eight wrong ones in a minute. A correct password clears that
count, so one person fumbling cannot shut their own friends out. The host takes
its room down with `POST /room/<id>/close` when a match starts, rather than
leaving it in the list until it expires.

Room ids are generated by the host's browser and never typed by anyone. The
room's *name* is display text, and the password is the only secret.

### A relay

`GET /ice` returns the ICE configuration the game should use, and an empty list
is a normal answer meaning "direct connections only". Everything about why a
relay is needed is under "When players cannot connect to each other" above; this
is how to turn one on.

The service holds a Cloudflare TURN key and mints short-lived credentials from
it on demand. The account token stays in the service and never reaches a
browser. Credentials are asked for with a six-hour life and stopped being handed
out after four, so the worst set anybody is given still has two hours on it,
against a match measured in minutes. One set is minted per four hours, not per
lobby.

Two bindings turn it on, both optional:

| Name | What | Secret |
|---|---|---|
| `TURN_KEY_ID` | The TURN key, from the dashboard under Realtime → TURN | no |
| `TURN_TOKEN` | That key's API token | **yes** |

On Cloudflare, put the id in `vars` in `wrangler.jsonc` and the token in with
`npx wrangler@latest secret put TURN_TOKEN`. Locally, both are environment
variables:

```sh
TURN_KEY_ID=… TURN_TOKEN=… node projects/crossfire/server/rooms.js
```

Nothing here is required and nothing fails loudly without it. A missing key, an
unreachable API and a malformed response all return the same empty list, and the
game plays on with direct connections — because a relay that cannot be minted
costs the few players who needed one, not everybody.

Anyone the origin allowlist admits can collect credentials and spend your relay
quota on their own traffic. The short life and the rate limiter bound that; they
do not eliminate it. Relay traffic is billed per gigabyte after a free tier, so
it is worth watching the first time this is switched on.

### Running it locally

No account, no network, nothing installed:

```sh
node projects/crossfire/server/rooms.js
```

Then point the game at it without editing anything — open
`http://localhost:8912/projects/crossfire/?rooms=http://localhost:8787`. Two
browser tabs are enough to test the list, a password, ready-up and a start.

When that process sits behind one trusted reverse proxy, start it with
`TRUST_PROXY=1`. Leave that off when it is exposed directly; otherwise clients
can forge the address used by the request and password throttles. On Cloudflare
none of this applies — the edge sets an address the caller cannot touch.

### Deploying it

The live service is a Cloudflare Worker with one Durable Object. From
`projects/crossfire/server`:

```sh
npx wrangler@latest deploy
```

That prints a `https://crossfire-rooms.<subdomain>.workers.dev` address. Put it
in `ROOM_HOST` in `index.html`, and make sure the site's origin is in `ALLOWED`
in `server/rooms-core.mjs`. Until `ROOM_HOST` is set, the online panel reports
that there is no room service rather than showing a list.

A Worker runs in many isolates in many places and two of them share no memory,
so the room list lives in a single Durable Object named `crossfire` — one list,
one place, everybody looking at the same thing. It never writes to that object's
storage: rooms are worth twenty-five seconds each and the host's next heartbeat
rebuilds them, so persisting them would spend the free plan's daily write
allowance on data that is already stale. Being evicted while idle costs an empty
list, which is what a restart has always cost. The class must still be declared
with `new_sqlite_classes` in `wrangler.jsonc` — that is what makes it free-plan
eligible, and the backend cannot be changed after the namespace is created.

## Files

| File | Responsibility |
|---|---|
| `index.html` | UI, settings, simulation, rendering, bots, campaign, survey and match rules |
| `net.js` | WebRTC links and compact session-description encoding |
| `cloud.js` | The account, and the book kept in it. No SDK, no request until asked |
| `config.js` | The account service's URL and publishable key. Blank means no accounts |
| `supabase/schema.sql` | The one save table and its policies. Run once in the SQL editor |
| `survey-hud.js` | Survey's interface: the flight panel, the chart page, the illustrated almanac, the station |
| `menu.js` | The mode cards' moving pictures — five dioramas, drawn rather than filmed |
| `server/rooms-core.mjs` | The room service: every rule, no plumbing |
| `server/worker.mjs` | Runs it on Cloudflare, in one Durable Object |
| `server/rooms.js` | Runs it on a laptop, with nothing installed |
| `server/wrangler.jsonc` | Deploy configuration |
| `test/smoke.js` | Dependency-free syntax, transport and service checks |
| `test/campaign.js` | Headless play-through of all three missions to a verdict |
| `test/survey.js` | Headless survey: chunk purity, endless space, almanac reachability, chart persistence, solidity, the economy, the Leviathan's corridor |
| `test/menu.js` | The two lanes, the card row's arithmetic, and that every card starts what it advertises |
| `test/ui.js` | Every control on every page, at four shapes of glass, on a desk and on a phone: on the screen, big enough to press, and not buried under something drawn later |

The game intentionally remains self-contained. Do not add a framework, bundler or
runtime dependency for changes that fit the existing static architecture.

## Verification

```sh
node projects/crossfire/test/smoke.js
node projects/crossfire/test/campaign.js
node projects/crossfire/test/survey.js
node projects/crossfire/test/menu.js
node projects/crossfire/test/ui.js
```

The closing wall and the spawn rules cannot be checked by looking at them. With
`?debug=1`, `window.__cf.step()` advances one frame and `window.__cf.live()`
returns the live `ships`, `rocks`, `hazards`, `bounds` and `clock`. Overriding
`performance.now` with a clock you control turns that into a harness: a whole
match runs in a few thousand calls instead of a minute, and every frame can be
checked for a ship outside the wall, inside a rock, inside a gravity well, or
held against the wall. That is how the wall and spawn bugs were found and how
the fixes were confirmed — ten matches, ~22,000 frames, 96 respawns, no
violations. Do not debug these by watching them.

The campaign is checked the same way. `?debug=1` also exposes
`window.__cf.start(levelKey, pilots)` to begin a mission without the menus,
`window.__cf.campaign()` to read the mission controller, `window.__cf.squad()` to
issue a wing order, and `window.__cf.draw()` to force a frame.
`test/campaign.js` uses them to play all three missions to a win or a loss with
the pilots on autopilot — cycling squad orders, drawing every screen and capital
ship, and watching the phases advance. It asserts every frame that no ship leaves
the arena and no position goes non-finite; that salvage drops and radio chatter
fire; that every mission seeds asteroids and gravity wells; that the convoy has a
destination planet and crosses to it at a genuinely constant speed; and that the
hard mission stays winnable — the allied fleet, unaided, has to carve real
subsystems off the mothership. Because a real pilot only ever helps
— defending the objective, spending salvaged guns, commanding the wing — a
mission the autopilot can nearly finish is one a person certainly can. Convoy is
an escort, so its bar is that a passive run still carries the transport most of
the way home. Do not debug these by watching them either.

Survey is checked the same way, and for the same reason: a mode with no opponent
has no "did you win" to assert on. An endless sector cannot be checked by
enumerating it either, so what is checked instead is that generation is **pure**
— the same chunk built twice is identical, neighbouring chunks are not, and the
chunk you start in never holds a hazard — and that space really is endless: six
minutes of full burn must simply keep going, with rocks still around the ship
and hazards still being made 130,000 units out.

`?debug=1` exposes `window.__cf.survey()` (the controller), `.catalogue()`,
`.chunk(cx, cy)`, `.scan()`, `.find(key)`, `.hud()`, `.leave()`,
`.key(code)` and `.hold(code, on)` — which presses a key the way a player does,
because `readLocalInput` rebuilds every ship's input from the held-key set each
frame and Survey has no bot to fly itself.

Two things about that harness are worth knowing before writing another test with
it. **A ship that turns continuously orbits**: the turn radius at full burn is
about 110 units, so a "fly around and see" loop charts a smudge. **A ship that
turns by the same angle every leg closes a polygon** and comes back to where it
started. Both were written, both passed a `charted > 0` bar, and both were
measuring nothing; only a walk that does not close actually crosses a sector.

`test/survey.js` also proves all seventeen telemetry conditions can fire and
that none fire on an empty block, that every almanac entry has its own picture,
that all seven landmarks are placed at distinct bearings, and that the chart and
the flight path round-trip through local storage — including that a new seed
does not inherit the old sector's almanac.

For visual changes, also test the title, Settings, each mode, the pause menu and a
375px-wide phone layout. For online changes, run the room service locally and
point the game at it with `?rooms=http://localhost:8787`; two browser tabs are
enough to test the list, a password, ready-up and a start. Add `?debug=1` locally to expose `window.__cf` for browser
test harnesses; normal production loads do not expose mutable game state.
