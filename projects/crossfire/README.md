# CROSSFIRE

CROSSFIRE is a dependency-free canvas game for one to five ships. Play co-op
against asteroid waves or fight a no-time-limit Battle Royale inside a closing
wall. It runs as static HTML, CSS and JavaScript with no build step.

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

Battle Royale shows hull strength only for ships controlled on the current device.
First hits stay quiet; losing a life adds a short entry to the feed beneath the
minimap. Battle Royale resolves when one ship remains, no matter how long the
match takes. A winner screen shows kills, deaths, environmental deaths and time
survived for every ship.
Each spawn can take two bullet or asteroid hits before losing a life. The first
hit leaves one hull point and a brief impact shield; suns and black holes remain
immediately lethal.

The shrinking Battle Royale wall deactivates a stationary gravity hazard after
its center is outside the playable arena. Respawns choose clear space inside the
current wall rather than clamping the original full-map spawn onto its edge.
The result screen can immediately replay the same local setup; online, the host
starts the next round for every connected player.

## Controls

- Amber: `A` / `D` turn, `W` thrust, `Space` fire.
- Green: arrow keys turn and thrust, `Enter` fire.
- `O`: open the online panel from the title screen.
- `P` or `Escape`: pause locally or open the online game menu.
- `Tab`: watch another active ship in Battle Royale.
- `C`: open Settings from the title or pause menu.

Every weapon fires three-round bursts. Keyboard bindings and the Battle Royale
camera preference are editable in Settings and saved in local storage. The mouse
operates menus only.

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

`net.js` contacts the configured public STUN servers only while making an online
connection. There is no external request during page load or local play. The host
has a small shooting-latency advantage because guest inputs resolve when they
reach the authoritative simulation.

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
| `index.html` | UI, settings, simulation, rendering, bots and match rules |
| `net.js` | WebRTC links and compact session-description encoding |
| `server/rooms-core.mjs` | The room service: every rule, no plumbing |
| `server/worker.mjs` | Runs it on Cloudflare, in one Durable Object |
| `server/rooms.js` | Runs it on a laptop, with nothing installed |
| `server/wrangler.jsonc` | Deploy configuration |
| `test/smoke.js` | Dependency-free syntax, transport and service checks |

The game intentionally remains self-contained. Do not add a framework, bundler or
runtime dependency for changes that fit the existing static architecture.

## Verification

```sh
node projects/crossfire/test/smoke.js
```

For visual changes, also test the title, Settings, each mode, the pause menu and a
375px-wide phone layout. For online changes, run the room service locally and
point the game at it with `?rooms=http://localhost:8787`; two browser tabs are
enough to test the list, a password, ready-up and a start. Add `?debug=1` locally to expose `window.__cf` for browser
test harnesses; normal production loads do not expose mutable game state.
