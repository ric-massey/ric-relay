---
name: board-sync
description: Pull Ric's Kilter and Tension board logbooks into the website. Use when Ric asks to sync the boards, update the board stats, refresh the woodshed, or says a board session should show up on the site. Also use when the weekly auto-sync reports a problem.
---

# Sync the boards

Pulls the Kilter and Tension logbooks out of the board apps and regenerates
`projects/climbing/board-data.js`, which `projects/climbing/board.html` (the
woodshed) reads. Tension comes through boardlib and Aurora; Kilter has its own
path (see below). Both land in the same file.

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

## Kilter runs on its own stack

Kilter left Aurora in 2026 and boardlib still can't speak the new API
([BoardLib #78](https://github.com/lemeryfertitta/BoardLib/issues/78) is open),
so `projects/climbing/kilter_v2.py` does it instead and `pull-boards.py` routes
the `kilter` board there. It works — Kilter entries are live in `board-data.js`
and on the page. Sync it like any other board; nothing needs fixing.

Three services, all spoken in `kilter_v2.py`:

- **Keycloak** `idp.kiltergrips.com` — password grant on the public `kilter`
  client. The token stays in memory and never reaches `board-data.js`.
- **PowerSync** `sync1.kiltergrips.com` — one-shot drain of every bucket for the
  board geometry (hold coordinates, placement colours, layouts, grade table),
  replayed into in-memory tables. No local database, unlike the Aurora path.
- **REST** `portal.kiltergrips.com/api` — `/logs` for the logbook,
  `/climbs?name=…` for a climb's holds and community stats, `/users/<uuid>` for
  the profile.

Only Ric's own history is there: what didn't survive the migration is gone from
the source, not missing from the sync.

### Credentials

Same rules as Tension, with one wrinkle: the new Kilter signs in with an
**email**, so kilter's entry in `board-accounts.json` carries a `login` (the
email) next to `username` (the display handle). The Keychain entry is still keyed
on the handle:

```bash
security add-generic-password -s board-sync-kilter -a <username> -w
```

So `Kilter login failed for <email>` is the `login` field or the stored password
being wrong, while `no Keychain password for kilter (<handle>)` names the handle.
Don't swap one for the other. As always: never ask Ric to paste a password into
the chat, and never put one in a file or a command you run.

### When Kilter fails

Upgrading boardlib fixes none of this — Kilter never touches boardlib. A Kilter
failure exits 1 like any other, so the weekly job still runs its
upgrade-and-retry; that part of the log is noise here.

- **`Kilter login failed …`** — Keycloak rejected the grant. Check the `login`
  email first, then the Keychain password.
- **`PowerSync refused the stream: HTTP …`** — 401 is the token not being
  accepted (PowerSync wants `Authorization: Token`, the REST API wants `Bearer`;
  they differ on purpose). Anything else means the sync protocol moved.
- **`Kilter API /logs → HTTP …`** or **`/logs did not return a list`** — the REST
  shape changed. Report it honestly; don't hand-edit `board-data.js` around it.
- **`no usable Kilter layout in the geometry`** — PowerSync returned no
  `product_layouts` with a positive width, i.e. the drain came back empty.
- **Blank grades or a board with no holds, and no error at all** — the table
  names in the PowerSync payload changed. `kilter_v2.py` reads `mounting_holes`,
  `difficulty_grades`, `placement_types`, `product_layouts` and `hold_placements`
  out of a defaultdict, so a renamed table gives empty rather than raising. Same
  symptom if the drain ever hits its 120-round cap.
- **A single climb with no holds, setter or crowd stats** — `/climbs` is a *name*
  search matched back by UUID, so a climb renamed since Ric logged it drops out
  of the search. The entry still appears, just bare. Not a broken sync.

### What Kilter doesn't have

No **"All climbs" library** — that view is built from the Aurora SQLite database,
which Kilter no longer has; its catalogue would have to come from the REST search
instead. And the geometry carries no **benchmark or mirror** flags, so those chips
never show on Kilter entries. Neither is a bug to chase.

A normal `--catalogue` run already skips Kilter. `--catalogue-only` does **not** —
and a stale 198 MB `.board-cache/kilter.db` from the Aurora era is still on disk,
so it would happily run and write a nonsense library. Name the board when
rebuilding:

```bash
projects/climbing/.board-venv/bin/python projects/climbing/pull-boards.py tension --catalogue-only
```

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
