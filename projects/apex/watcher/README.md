# The Apex watcher

Reads Apex's own screens while Ric plays and pushes each match to the site the
moment it can see it. No API, because EA does not have one worth the name.

```
watch-apex.py   the loop: grab, gate, identify, read, send
screens.py      which screen is this, and where are its numbers
ocr.py          pixels to integers, and the vote that makes it reliable
regions.json    where every number lives, as fractions of the 16:9 safe area
spool.py        the queue that means a match is never lost to a dropped wifi
calibrate.py    how regions.json stops being a guess
```

## Why this exists

Apex publishes almost nothing about a player. The community APIs all read the
same keyhole — the three stat trackers on the banner of the legend you happen
to be playing — and the endpoint that would return real match history is behind
an API key tier Ric does not have. Career totals are on no API at all, which is
why they have been typed in by hand.

But every one of those numbers is on his monitor for several seconds after each
match. The screen is the API. Reading it is not a workaround for a missing
feature so much as the only place the data has ever existed.

## What it does to the game: nothing

It captures the desktop through the Desktop Duplication API — the same path OBS
uses — at four frames a second, on a process pinned below normal priority. It
never opens Apex's process, never reads its memory, never sends it an input,
never draws an overlay, and loads nothing into it. From anti-cheat's side this
is a screen recorder, which is exactly what it is.

Almost every frame is discarded by a brightness check on a 64-pixel thumbnail
before anything expensive runs. Tesseract only sees frames dark and flat enough
to be a menu — a few seconds after each match, not the whole session.

**Apex must be in borderless or windowed fullscreen.** In exclusive fullscreen
Windows hands the display to the game and duplication returns black frames.
That is not a bug to fix; it is a thing the operating system will not do.

## Why the numbers can be trusted

Not preprocessing — repetition. A summary screen sits still for seconds, so the
reader gets five or six looks at the same unchanging number. OCR errors scatter
differently each time; the truth repeats. The value that repeats is the one
that gets sent, and a number that never repeated is sent as `null` rather than
as a guess. That is `ocr.vote()`, and it is worth more than everything else in
the file put together.

On top of that the Worker checks arithmetic that is true of Apex regardless of
how well anyone played: kills can never exceed knocks, damage can never sit
below 100 per kill, a win cannot happen in under four minutes. A match failing
one of those is stored anyway — a rejected match is a match gone forever — but
flagged `review`, and the page renders it differently until a human looks.

Every read carries the confidence Tesseract gave it, all the way onto the page.

## Setup

```bash
winget install UB-Mannheim.TesseractOCR     # once, if not already there
py -3.12 -m venv .venv
.venv\Scripts\pip install -r requirements.txt
copy config.example.json config.json        # then fill in the worker URL + token
```

The token is the one set on the Worker with
`npx wrangler@latest secret put APEX_TOKEN`.

## Calibration — the one step that is not done

**Every box in `regions.json` is an estimate.** They were written from the
standard 1080p Apex layout without a real frame to check against. The pipeline
around them is finished; these four numbers per field are not, and a box that
is close is a box that reads the digit next to the one it wanted.

Ten minutes, once:

```bash
python calibrate.py --shot                          # after a match, grab the summary
python calibrate.py --draw shots/shot-001.png       # see how wrong the boxes are
python calibrate.py --pick shots/shot-001.png --screen match_summary
python calibrate.py --test shots/shot-001.png --screen match_summary
```

`--pick` walks the fields one at a time: drag a box round the number, press
ENTER. It writes fractions of the 16:9 safe area, so the measurement holds at
1080p, 1440p and on an ultrawide, and never has to be taken again.

`--test` runs the real reader over the real still and prints what came back. If
`damage` reads 1284 on a screenshot where the game said 1284, it is done.

Repeat for `career` and `legend_banner`. Then set `"calibrated": true` — `--pick`
does this for you — and the startup warning goes away.

> `--draw`, `--pick` and `--test` open a window and wait for a keypress. Do not
> run them mid-match. `--shot` is the only one safe to use while playing: it
> grabs a frame and exits without drawing anything.

## Running it

```bash
.venv\Scripts\python watch-apex.py           # for real
.venv\Scripts\python watch-apex.py --dry     # read and print, send nothing
```

`--dry` is the right way to spend a first session: it prints every screen it
recognises and every number it reads, and posts none of it. Play a few matches,
read the output, then take the flag off.

## What it sends

| Screen | Endpoint | What it carries |
|---|---|---|
| Match summary | `POST /apex/match` | kills, assists, knocks, damage, place, survival, revives, respawns, legend |
| Champion | *(none)* | remembered, so the next summary is recorded as a win rather than trusting an OCR'd `#1` |
| Career panel | `POST /apex/career` | account-wide kills, wins, games, damage — the numbers no API returns |
| Legend banner | `POST /apex/legend/<name>` | that legend's three equipped trackers |
| Any / none | `POST /apex/status` | playing, lobby, away |

The columns match the spreadsheet Ric kept by hand for two months. What the
machine can see, it fills. **Death category and death note it never touches** —
those are judgements about why a fight was lost, they were the actual value of
that spreadsheet, and they arrive later as an edit through the same endpoint.

## When the network drops

Nothing is ever sent and forgotten. Every record is appended to `spool.jsonl`
before it goes and removed only once the Worker says yes. A dropped wifi, a
Worker mid-deploy, a lid closed between games — the queue survives it and
drains on the next send or the next run.

This matters more here than anywhere else on the site: a match read off the
screen exists in exactly one place, this process's memory. Apex will never
mention it again. A record sent twice is harmless — the Worker deduplicates on
the numbers, not just the id. A record sent zero times is gone.
