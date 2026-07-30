---
name: board-sync
description: Pull Ric's Kilter and Tension board logbooks into the website. Use when Ric asks to sync the boards, update the board stats, refresh the woodshed, or says a board session should show up on the site. Also use when the weekly auto-sync reports a problem.
---

# Sync the boards

Pulls the Kilter and Tension logbooks out of the Aurora apps and regenerates
`projects/climbing/board-data.js`, which `projects/climbing/board.html` (the
woodshed) reads.

## Run it

```bash
projects/climbing/.board-venv/bin/python projects/climbing/pull-boards.py
```

Add a board name (`kilter`, `tension`) to sync only that one. The script keeps
whichever board it didn't touch, so a single-board sync never drops the other.

Exit codes: `0` synced, `1` the pull failed (worth an upgrade + retry), `2` a
username or Keychain password is missing (upgrading won't help).

## The "All climbs" library

`board.html` has two views: **Mine** (the logbook, in `board-data.js`, always
loaded) and **All climbs** (every climb on Ric's board with at least 30 ascents,
in `board-catalogue-<board>.js`, fetched only when he opens that view).

The library is **not** rebuilt by a normal sync — it's ~2.4 MB and moves slowly,
and rewriting it weekly would bloat git history for nothing. Rebuild it only
when Ric asks, or when he says something he expected to find is missing:

```bash
projects/climbing/.board-venv/bin/python projects/climbing/pull-boards.py --catalogue-only
```

That needs no login — the climb database is public and already cached — but it
does need a previous logbook sync, because it builds the library for **his**
board layout and size and only includes climbs that physically fit his wall.

`--catalogue` (rather than `--catalogue-only`) does a normal sync and rebuilds
the library in the same run.

**Rebuild it after the first-ever sync**, or after any sync that changes which
board size was inferred — otherwise the library is framed for the wrong wall.
The threshold lives in `CATALOGUE_MIN_ASCENTS` in `pull-boards.py`; lowering it
grows the file fast (10 ascents ≈ 6 MB, 1 ascent ≈ 43 MB).

Use the venv's python, not the system one — boardlib lives in the venv.

## Keeping boardlib current

boardlib is unofficial and tracks an API Aurora can change without notice, so a
stale copy is the usual cause of a broken sync. Check it:

```bash
projects/climbing/board-upgrade.sh
```

It prints the installed version and the one on PyPI. Exit `0` means up to date,
`10` means there's something newer, `1` means it couldn't reach PyPI. To take the
newer one:

```bash
projects/climbing/board-upgrade.sh --install
```

That upgrades boardlib (and Pillow, which boardlib imports but doesn't always
declare), then confirms boardlib still starts — so a bad release gets caught
here rather than halfway through a sync.

**When to run it:** any time a sync fails for a reason that isn't credentials,
and as a quick check if Ric asks whether the board tooling is current. Don't
upgrade on every routine sync — a working sync needs no new dependencies. The
weekly job already upgrades-and-retries by itself on a non-credential failure.

Report the version change to Ric when you upgrade. If a new version breaks the
sync that previously worked, say so plainly and offer to pin the old one
(`pip install boardlib==<version>` in the venv) rather than leaving it broken.

## What to tell Ric afterwards

The script prints the numbers. Report the part he can't see from a diff:

- how many **new** entries appeared since the last sync (`git diff --stat` on
  `board-data.js` is not enough — compare the printed entry counts, or look at
  the new dates near the end of the file)
- anything **notable** in the new rows: a hardest-yet send, a project that
  finally went, a first session in a while
- any line under `unmatched` or `undated` in the report

Then ask whether to commit and push. **Never push without being asked** — on
this repo a push is a publish. The sync itself is safe and local.

## When it fails

- **`no Keychain password for <board>`** — Ric hasn't stored that board's
  password yet. Give him the exact command the error prints, and let him run it.
  Never ask him to paste a password into the chat, and never put one in a file
  or a command you run.
- **`no board-accounts.json`** — copy `board-accounts.example.json` to
  `board-accounts.json` and ask Ric which username belongs to which board.
- **`boardlib logbook failed` / login errors** — usually the Aurora API changed
  under boardlib. Run `projects/climbing/board-upgrade.sh --install`, then sync
  again. If it still fails, report that honestly — do not fabricate or hand-edit
  `board-data.js` to paper over a failed pull.
- **Empty logbook** — check the account actually logs ascents in the app. A
  Tension Board 1 without app logging has nothing to give.
- **`KeyError: Index(['is_mirror', 'angle', 'climb_name'])`** — pandas 3 got
  installed. boardlib groups by those columns and then reads them back, and
  pandas 3 drops grouping columns from `groupby().apply()`. Fix:
  `.board-venv/bin/pip install "pandas>=2.2,<3"`. The venv is pinned below 3 for
  this reason; don't "helpfully" upgrade it.

## Kilter is not currently syncable

Kilter left the Aurora platform. `kilterboardapp.com` is a dead domain (no TLS
cert, IONOS placeholder on port 80) and the new app uses Keycloak at
`idp.kiltergrips.com` with an API at `portal.kiltergrips.com` — which has **no
user logbook endpoints** (`/api/ascents`, `/api/logbook`, `/api/users/me` all
404, and the published `openapi.json` is an empty stub). Ric's Kilter history
did not survive the migration; his app shows only climbs logged since.

Tracked as [BoardLib issue #78](https://github.com/lemeryfertitta/BoardLib/issues/78).
Don't try to "fix" the Kilter sync — it isn't broken code, the data isn't there.
Leave `kilter` in board-accounts.json; the page renders whatever boards have
data, so it stays hidden until it works. Re-check when that issue closes.

## Rules

- Credentials: usernames in `board-accounts.json` (gitignored), passwords in the
  macOS Keychain only. Both files stay out of git; that's already in `.gitignore`.
- `board-data.js` **is** committed — it's what the live site reads.
- The `.board-cache/` databases are ~260 MB and gitignored. Don't commit them,
  don't delete them either: the next sync only downloads the delta.
- Don't hand-edit `board-data.js` or `board.html`'s data assumptions. If the shape
  of the data needs to change, change `pull-boards.py`.

## Related

The outdoor log is a different pipeline entirely — `climbs.md` +
`build-data.py`. Board grades and rock grades don't mix; keep them in their own
pages and their own stats.
