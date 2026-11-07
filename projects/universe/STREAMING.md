# Watching a run that is still happening

`snapshot.mjs` writes a run that has finished. This is the other thing: a World
running on the PC right now, on a screen somewhere else.

It is a transport, not physics. Nothing here decides anything; `world.mjs` runs
and this hands out what it did.

---

## The short version

On the machine with the run:

```bash
node world-stream.mjs
```

Open `http://localhost:8787/` on that machine, or the address it prints for the
wifi on a phone. The **Live World** tab is already watching.

---

## The two ways in

They are different routes, not a fallback chain, and the viewer offers both.

| | **This wifi** | **Website relay** |
|---|---|---|
| route | the browser talks to this process | the PC pushes to the Worker; the site reads it |
| where it works | the same network | anywhere |
| how far behind | a frame or two | as far as `--push-every` says, default 10s |
| needs | nothing | `--push`, and the site password in the shell |

The website is static — GitHub Pages, a CNAME, no server — and the PC is behind
a home router, so the site cannot reach in. The traffic has to go the other way.
That is what the relay is. It is the same shape the CS replays use, and it uses
the same Worker, the same bucket and the same password.

---

## Running it

```bash
node world-stream.mjs --size 150 --every 2          # smaller, more frames
node world-stream.mjs --eps 2e-5                    # gravity up 100x
node world-stream.mjs --eps 0                       # gravity off: the control
node world-stream.mjs --grow 200 --max 600000       # let the space grow
node world-stream.mjs --host 127.0.0.1              # this machine only
node world-stream.mjs --save runs/world             # also write frames to disk
```

```bash
node world-stream.mjs --temp0 9 --p0 6              # start hot and moving
node world-stream.mjs --gcap 500000                 # stop if gravity pumps
```

Every dial `world-run.mjs` has, this has, and they mean the same things. Three
are worth naming because they decide what the run can show at all:

- **`--temp0 N`** energy per unit of kind at tick 0, which is what temperature
  means here. At or above 8 no bond can form, because the deepest possible bond
  is the bond modulus. A World left at absolute zero bonds before it can fall.
- **`--p0 N`** momentum components drawn in ±N, then the whole World brought to
  exactly zero total momentum, so there is no preferred direction.
- **`--gcap N`** stops the run if gravity has paid out more than N units of
  kinetic energy. The counter it watches has no floor (README item 35), so
  without this a stream left open can pump energy for as long as it runs.

The two that are only here:

- **`--every N`** ticks between frames, default 5.
- **`--min-ms N`** and at most one frame every N milliseconds, default 200.

Both, because they are different limits. A 150×150 World runs at about 250
ticks a second, so `--every 3` on its own asked for eighty frames a second, each
one gzipping 400 KB, and the run slowed to 158 ticks/s **building pictures
nobody could see**. The viewer has the same floor on its own side. A frame
nobody can perceive costs the run that produced it.

Ctrl-C stops it. Nothing is saved unless `--save` was given — a run is
reproducible from its seed, and `snapshot.mjs` is what keeps one worth keeping.

---

## Pushing to the website

```bash
export UNIVERSE_TOKEN='<the site password>'
node world-stream.mjs --push https://training-log.rmbuster82.workers.dev/universe
```

PowerShell:

```powershell
$env:UNIVERSE_TOKEN = '<the site password>'
```

Then open the viewer anywhere, go to **Live World**, and leave it on **Website
relay**.

The token is the site password, the same one the training log and the CS
replays use. It is read from the environment, never printed, never written into
a frame, and never sent anywhere but the URL on the command line. Without it the
process runs exactly as before and says in its banner that it is not pushing.

**The Worker side needs deploying once**, because the `/universe` route is new:
the **Deploy Worker** workflow in the repo's Actions tab, which works from a
phone. Until then the relay answers 404 and the viewer says nothing is
streaming. No new secret and no new binding: it uses `LOG_TOKEN` and the
`photos` R2 bucket, both already there.

There is one live slot. A new frame overwrites the last one, and the frames are
not kept.

---

## What a frame is

The same six bytes per hexagon `snapshot.mjs` writes, in the same order, with a
header of the same shape — so the viewer reads a live frame with the code it
already has, and a `--save`d frame opens later as an ordinary run.

```
kind    u8   × cells      0 = not matter
energy  u16  × cells      heat, matter only
mx      i8   × cells      momentum, cube x
my      i8   × cells      momentum, cube y;  z = -x-y
bonds   u8   × cells      matter: neighbour bits · vacuum: in-flight slots
```

The header carries what a picture of a running world has to carry to be honest:

- **`space`** — the lattice, the size, and **which axes wrap**, measured by
  asking the engine where its own edges lead rather than asserted. The map draws
  exactly that. A World that grew says what it grew from.
- **`engine`** — a hash of `world.mjs` and `constants.mjs`. The viewer hashes
  the same two files where it is served and says plainly whether they match, so
  a frame from an engine that has since changed cannot pass as a current one.
- **`books`** — heat, kinetic, in flight, bond potential, gravity potential,
  expansion loss, net momentum, and the tick the conservation check last passed.
  If it ever fails the run stops and the frame says so in red.
- **`run.approximations`** — ticked time, and the number of relaxation sweeps
  the potential got. Neither is hidden.

Gravity's strength is a **dial**, typed on a command line. README item 20 put
its floor above its ceiling under a physics that stopped existing on 2026-11-06
and nobody has re-measured it. Every frame says so, and nothing read off one is
a result.

---

## The endpoints

Read-only, any origin, never cached.

| | |
|---|---|
| `/` | the viewer, straight off disk — no other server needed |
| `/frame.json`, `/frame.bin` | the latest frame (also `/live.*`, the relay's names) |
| `/events` | server-sent events, one line per frame, enough to drive the readouts |
| `/status` | is it running, what tick, do the books close, is it pushing |

`--host 0.0.0.0` is the default, which is what lets a phone on the same wifi
watch, and the banner says so every time it starts. `--host 127.0.0.1` keeps it
to the one machine. It serves files out of `projects/universe/` and nothing
else, reads only, and refuses a path that tries to climb out.
