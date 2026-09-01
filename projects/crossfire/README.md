# CROSSFIRE

CROSSFIRE is a dependency-free canvas game for one to five ships. Play co-op
against asteroid waves, fight a no-time-limit Battle Royale inside a closing
wall, or run the three-mission Campaign — escort a transport, raid an enemy
convoy, and break a mothership in an all-out fleet war. It runs as static HTML,
CSS and JavaScript with no build step.

## Run locally

From the repository root:

```sh
python3 -m http.server 8000
```

Open `http://127.0.0.1:8000/projects/crossfire/`.

## Modes

| Mode | Players | Rules |
|---|---:|---|
| Survival | 1-5 | Co-op asteroid waves, shared lives, optional friendly fire, wrapping arena |
| Battle Royale | 2-5 | Three lives each, two-hit hulls, stationary gravity hazards, closing wall, no time limit |
| Campaign | 1-2 | Three scripted missions, sides instead of a free-for-all, an allied fleet flying with you, a shared reserve of lives |

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

## Controls

- Amber: `A` / `D` turn, `W` thrust, `Space` fire.
- Green: arrow keys turn and thrust, `Enter` fire.
- `O`: open the online panel from the title screen.
- `P` or `Escape`: pause locally or open the online game menu.
- `Tab`: watch another active ship in Battle Royale, or your own side in a Campaign.
- `1` / `2` / `3`: in a Campaign, order the allied wing to focus fire, defend, or regroup.
- `N`: on a cleared-mission screen, fly straight into the next mission.
- `C`: open Settings from the title or pause menu.

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
| `index.html` | UI, settings, simulation, rendering, bots, campaign and match rules |
| `net.js` | WebRTC links and compact session-description encoding |
| `server/rooms-core.mjs` | The room service: every rule, no plumbing |
| `server/worker.mjs` | Runs it on Cloudflare, in one Durable Object |
| `server/rooms.js` | Runs it on a laptop, with nothing installed |
| `server/wrangler.jsonc` | Deploy configuration |
| `test/smoke.js` | Dependency-free syntax, transport and service checks |
| `test/campaign.js` | Headless play-through of all three missions to a verdict |

The game intentionally remains self-contained. Do not add a framework, bundler or
runtime dependency for changes that fit the existing static architecture.

## Verification

```sh
node projects/crossfire/test/smoke.js
node projects/crossfire/test/campaign.js
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

For visual changes, also test the title, Settings, each mode, the pause menu and a
375px-wide phone layout. For online changes, run the room service locally and
point the game at it with `?rooms=http://localhost:8787`; two browser tabs are
enough to test the list, a password, ready-up and a start. Add `?debug=1` locally to expose `window.__cf` for browser
test harnesses; normal production loads do not expose mutable game state.
