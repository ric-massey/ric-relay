# CROSSFIRE

CROSSFIRE is a dependency-free canvas game for one to five ships. Play co-op
against asteroid waves or fight a one-minute Battle Royale inside a closing
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
| Battle Royale | 2-5 | Three lives each, two-hit hulls, stationary gravity hazards, closing wall, one-minute limit |

Battle Royale shows hull strength only for ships controlled on the current device.
First hits stay quiet; losing a life adds a short entry to the feed beneath the
minimap. Battle Royale resolves immediately when one ship remains. At the time limit it
ranks surviving ships by kills, then lives; equal records draw. A winner screen
shows kills, deaths, environmental deaths and time survived for every ship.
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
- `P` or `Escape`: pause locally or open the online game menu.
- `Tab`: watch another active ship in Battle Royale.
- `C`: open Settings from the title or pause menu.

Every weapon fires three-round bursts. Keyboard bindings and the Battle Royale
camera preference are editable in Settings and saved in local storage. The mouse
operates menus only.

Sound effects are synthesized in the browser with Web Audio, so there are no
audio files to load. Sound starts on the first keypress or tap and can be muted
from the title, Settings or pause menu; that preference is saved locally.
Fullscreen is available from those same screens when the browser supports the
Fullscreen API. The whole page enters fullscreen so phone controls remain visible.

Phones support one ship per screen. Players can choose a directional stick or
left, right and acceleration buttons, resize and move every control, and enable
automatic fire. The arrow layout always fires automatically.

## Online play

Online matches are host-authoritative WebRTC games with one screen per player.
The default connection route has no signalling server: the host sends each guest
an invite code and pastes back that guest's reply. `net.js` uses one reliable data
channel for control messages and one unreliable channel for current world state.

The host must keep the Crossfire page open, but it can be in a background tab. An
inline worker keeps the simulation stepping when animation frames are throttled.
Brief connection interruptions get a recovery window; a player who fully leaves
is removed without awarding a kill or environmental death.

`net.js` contacts the configured public STUN servers only while making an online
connection. There is no external request during page load or local play. The host
has a small shooting-latency advantage because guest inputs resolve when they
reach the authoritative simulation.

## Optional room service

`server/rooms.js` replaces manual code passing with short room words. It carries
WebRTC offers and answers only; gameplay remains peer-to-peer. All state is held
in memory and expires automatically.

Run it with:

```sh
PORT=8787 node projects/crossfire/server/rooms.js
```

Publish that port, put its HTTPS origin in `ROOM_HOST` in `index.html`, and add
the site's origin to `ALLOWED` in `server/rooms.js`. If the service is unavailable,
the game automatically keeps the manual-code route.

When the service is behind one trusted reverse proxy, such as Tailscale Funnel,
start it with `TRUST_PROXY=1`. Leave that setting off when the Node process is
exposed directly; otherwise clients can forge the address used by the room-word
guessing throttle.

## Files

| File | Responsibility |
|---|---|
| `index.html` | UI, settings, simulation, rendering, bots and match rules |
| `net.js` | WebRTC links and compact invite-code encoding |
| `server/rooms.js` | Optional in-memory room-word signalling service |
| `test/smoke.js` | Dependency-free syntax, transport and service checks |

The game intentionally remains self-contained. Do not add a framework, bundler or
runtime dependency for changes that fit the existing static architecture.

## Verification

```sh
node projects/crossfire/test/smoke.js
```

For visual changes, also test the title, Settings, each mode, the pause menu and a
375px-wide phone layout. Add `?debug=1` locally to expose `window.__cf` for browser
test harnesses; normal production loads do not expose mutable game state.
