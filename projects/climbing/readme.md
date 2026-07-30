# Climbing

The climbing section of the site. `climbing.html` at the site root is the front
door; the deep log lives in here.

## The files you write

- **`climbs.md`** — all of my trips, by date. Some days and climbs have been
  missed, but this is the record. Keep writing it the way you always have.
- **`todo.md`** — climbs I want to do. A `⭑` means I've since done it.
- **`photos.md`** — one line per photo or video: `file | date | route | caption`.
  New files get a line added automatically; you fill in the route and caption.
- **`photos/`** — drop photos and videos here.

## The files that get generated

Don't hand-edit these — they're overwritten.

- `climbs-data.js` — from `climbs.md` + `todo.md`
- `photos-data.js` — from `photos.md` + the files in `photos/`

## After you edit anything

```bash
python3 projects/climbing/build-data.py
python3 projects/climbing/import-photos.py
```

`build-data.py` also prints anything it couldn't read — usually a route line
missing its grade, or a typo'd crag name. Fixing those in `climbs.md` is the only
maintenance this needs.

`import-photos.py` converts HEIC to JPG, shrinks anything over 1600px, keeps the
untouched original in `_photo-originals/climbing/` (gitignored), and reads the
EXIF date so a photo can find its own trip.

## The pages

| Page | What it is |
|---|---|
| `../../climbing.html` | The room. Most recent day out, current projects, objectives, recent ticks. |
| `index.html` | The full log — search by route, crag, partner, date or grade; most-climbed; people; tick list. |
| `gallery.html` | Photos and video, filtered by year, crag and route. |
| `board.html` | The woodshed — Kilter and Tension logbooks, dressed as the app. Deliberately not in the menus. |

## The boards

`board.html` is the one climbing page nobody writes by hand and nobody edits.
The Kilter and Tension apps already know every session; `pull-boards.py` asks
them and writes `board-data.js`.

```bash
projects/climbing/.board-venv/bin/python projects/climbing/pull-boards.py
```

Or just ask Claude to sync the boards — there's a `board-sync` skill for it.
A launchd timer (`board-sync.plist`) also runs it every Sunday morning and
commits the result locally, never pushing.

**Tension** goes through boardlib and Aurora. **Kilter** no longer can: it left
the Aurora platform in 2026 (the old `kilterboardapp.com` is dead) and stood up
its own stack at **kiltergrips.com**, which boardlib doesn't speak yet (see
[BoardLib #78](https://github.com/lemeryfertitta/BoardLib/issues/78)). So Kilter
has its own module, `kilter_v2.py`, and `pull-boards.py` routes the `kilter`
board to it. Both boards end up in the same `board-data.js` and the page can't
tell them apart.

The new Kilter stack is three services, and `kilter_v2.py` speaks all three:

- **Keycloak** (`idp.kiltergrips.com`) — logs in via the public `kilter` client's
  password grant. The new Kilter signs in with an **email**, not the old handle,
  so `board-accounts.json` carries a `login` field for it (`username` stays the
  display handle). The password is still Keychain-only.
- **PowerSync** (`sync1.kiltergrips.com`) — replicates the board's geometry
  (hold coordinates, colours, layouts, grade table) and Ric's own logs to the
  client. `kilter_v2.py` drains every bucket in one shot and rebuilds the tables
  in memory — no local database, unlike the Aurora path.
- **REST API** (`portal.kiltergrips.com/api`) — `/logs` for the logbook (with
  climb name and grade), `/climbs?name=…` for a climb's holds (`climbConcat`),
  setter and community stats, `/users/<uuid>` for the profile.

A climb's holds come back as `climbConcat`, a run of `h<mounting_hole>p<type>`:
the number after `h` is a mounting-hole id that PowerSync's `mounting_holes` turns
into an (x, y); the number after `p` is a placement-type `short_ref` that
`placement_types` turns into a role and colour. That's the render.

Two caveats. There's **no "All climbs" library** for Kilter yet — that view is
built from the Aurora SQLite database, which Kilter doesn't have; its catalogue
would have to come from the REST search instead. And the geometry has no
benchmark or mirror flags, so Kilter entries never show those chips.

The venv pins **pandas below 3.0**: boardlib groups the logbook by
climb/angle/mirror and reads those columns back, and pandas 3 drops grouping
columns from `groupby().apply()`, killing the download with a `KeyError`.

The logbook itself comes from boardlib's Python API rather than its CLI, because
the CLI strips the climb UUID out of its CSV — and without the UUID there's no
reliable way to tell which climb a row is, so no holds to draw.

The data comes out of [boardlib](https://github.com/lemeryfertitta/BoardLib),
which is unofficial. When Aurora changes their API it breaks, loudly, and the
fix is usually a newer boardlib:

```bash
projects/climbing/board-upgrade.sh            # what's installed vs what's out
projects/climbing/board-upgrade.sh --install  # take the newer one
```

The weekly job does that upgrade-and-retry on its own, but only when the failure
could plausibly be boardlib's fault — a missing password just gets reported.

**Credentials never live in this repo.** Usernames go in `board-accounts.json`
(gitignored, copy the `.example` one); passwords go in the macOS Keychain:

```bash
security add-generic-password -s board-sync-kilter -a <username> -w
```

The page has two views. **Mine** is the logbook — `board-data.js`, a few hundred
KB, always loaded. **All climbs** is the board's own library: every climb that
fits Ric's wall with at least 30 ascents, about 9,200 on Kilter and 1,500 on
Tension. That lives in `board-catalogue-<board>.js` (~2.4 MB total) and is only
fetched when someone opens that view. Ones he's already done are ticked as he
browses.

The library is deliberately **not** rebuilt on a normal sync:

```bash
projects/climbing/.board-venv/bin/python projects/climbing/pull-boards.py --catalogue-only
```

Shipping every climb on the board isn't an option — Kilter alone has 252,000, and
even filtered to Ric's board size that's a 43 MB file regenerated into git every
week. Thirty ascents is the line where the library stops being one-offs nobody
has repeated. `CATALOGUE_MIN_ASCENTS` in `pull-boards.py` moves it.

The page opens on a profile row — handle, display name, first session, and a
button through to the board's own app. Note that **neither board has a public
profile page**: every `/users/<id>` route wants a session, so that button opens
the app (or its web version, which will ask Ric to log in). It isn't a link
strangers can follow to his profile, because no such link exists. The avatar is
baked into `board-data.js` as a data URI rather than hotlinked, so the page still
makes no outside requests.

The board render is real: hold positions, board size and the exact hold colours
come out of the boards' own public databases, so a climb on the page is lit the
way it is lit on the wall. Board grades are kept in their own pages and their
own stats — they are not the outdoor grades and don't convert.

## How the log reads climbs.md

Headings nest as area → region → wall, and the depth varies (`## Red River Gorge`
→ `### PMRP` → `#### The Gallery`, but also just `## Dierkies Lake` → `### Roman
Wall`). The parser works both out.

A route line is `Name - Grade (whatever else)`. It picks up repeats (`x2`), style
(`onsight`, `flash`, `redpoint`, `trad`, `top rope`, `free solo`), and whether it
went clean.

**A route only counts as a send if it went clean.** An explicit onsight, flash,
redpoint or "sent it" counts, and so does a bare line with nothing else on it. A
note mentioning falls, takes or bailing at a clip does not — that's a project,
not a tick. If a line reads as a send but wasn't, add `(attempt)` to it.

`⭑` marks a favourite or a project — the climbs that mattered, sent or not.
