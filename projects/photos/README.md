# The photographs

`photos/` is 1,325 web-optimised JPEGs — climbing, trips, machines, dogs. The
Captures room draws them and Climbing rotates a few as a hero banner.

**The album is served from Cloudflare R2, not from GitHub Pages.** On
2026-11-12 the photographs were 432 MB of a site that was about 740 MB against
the gigabyte Pages allows, and the album still grows — the same wall the CS
replays hit in October, and `projects/cs/upload-replays.py` is what this is
modelled on.

**Only `website-*.jpg` moves.** That is 1,287 files and 417 MB of the 432 — the
album, and all of the problem. The 38 `climbing-NN.jpg` are 15 MB and are page
furniture rather than album: `climbing.html` paints two of them as its hero and
its band, the front door deals them into two of its moving tiles, and
`projects/climbing/photos-data.js` is a generated index of all 38 read by path.
Moving them would save 15 MB and put four more pages behind a network hop, so
`upload-photos.py` ignores them and `--move` leaves them tracked.

| | |
|---|---|
| Bucket | `photos` (shared — `climb/`, `cs/replays/`, `universe/` live there too) |
| Prefix | `captures/` |
| Moves | `photos/website-*.jpg` only — 1,287 files, 417 MB |
| Stays in git | `photos/climbing-*.jpg` — 38 files, 15 MB |
| Read | `GET https://training-log.rmbuster82.workers.dev/photo/<name>` — public, `immutable`, cached a year |
| Write | `PUT` the same URL with the site password (`LOG_TOKEN`) |
| Code | `worker/worker.mjs`, `photosRoute`; rules in `worker/test.mjs` |

`photos/` on this machine stays the source. Nothing reads from R2 except a
browser on the site.

## Why `/photo` and not `/photos`

`worker/dev.mjs` serves the repo and the Worker on one origin, so a route named
after a folder in the repo shadows that folder's files. `photos/` is exactly
the folder the page falls back to, so the route is singular. Don't rename it.

## The fallback, and why it has to stay

`captures.html` asks R2 first and, on an `error`, retries once against the
repo's `photos/<name>`. That is what makes every step below safe on its own:
the page is correct whether R2 has the file, the repo has it, or both do. It
also means a failed deploy shows photographs rather than 1,163 broken frames.

## Moving them (once), in this order

Each step is safe to stop after.

1. **Deploy the Worker**, so `/photo/` exists. Actions → **Deploy Worker** →
   Run workflow, or `cd worker && npx wrangler@latest deploy`. Until this is
   done every upload answers 404.
2. **Store the password once**, if it isn't already:
   ```
   python projects/cs/creds.py set ric-terminal/log-token
   ```
   (type it, press Enter, then Ctrl+Z and Enter). Never put it in a file here.
3. **Upload.** About 417 MB, so give it a while; it checks each file reads back
   byte for byte, records what it sent in `.uploaded.json`, and picks up where
   it left off if you stop it.
   ```
   python projects/photos/upload-photos.py
   ```
4. **Check**, which asks R2 for every file and compares:
   ```
   python projects/photos/upload-photos.py --check
   ```
5. **Only then, untrack them.** This writes `photos/.gitignore` (ignoring
   `website-*` and nothing else), runs `git rm --cached` over those 1,287 paths
   and keeps every file on disk. It refuses unless step 4 is clean. It does not
   commit — you do.
   ```
   python projects/photos/upload-photos.py --move
   ```

`--pull` fetches them all back into `photos/` on a machine that has none.

**The files stay in git's history.** That is the one thing that cannot be taken
back out without rewriting history, and it is not worth it: what matters is
that the *published site* stops carrying them, and nothing new is added.

## Adding a photo afterwards

Optimise it (~1600px, HEIC→JPG), **strip its metadata** — a phone photo carries
the coordinates it was taken at, and hard rule 1 in `AGENTS.md` is not
negotiable — drop it in `photos/` as `website-NNNN.jpg`, then run
`upload-photos.py` again. It only sends what is new or changed, and it only
looks at `website-*`: a photograph added under another name stays in git. Add its date to `captures-data.js` and, if it
deserves the front of the room, its name to `SELECTED` in `captures.html`.

A **replaced** photograph needs a **new name**: `/photo/` answers `immutable`,
so a browser that has the old one will keep it for a year.
