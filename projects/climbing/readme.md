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
