# Garmin → Claude

One button on the Mac pulls the whole useful Garmin history, meaning sleep, HRV, resting
heart rate, stress, Body Battery, training readiness, training status and
every activity's numbers. It puts the history behind the site password on the
Worker, where a Claude session can read it in one request.

| what | where | public? |
|---|---|---|
| The button | `Garmin.command` | the script is; nothing it pulls is |
| The puller | `pull-garmin.py` | same |
| The reader | `recent.py`: the last few weeks, one line a day | same |
| The export | the Worker's `GET /garmin`, stored in R2 at `garmin/export.json` | **no** — token only |
| Local state | `~/.ric-garmin/` (venv, Garmin session, day cache, a copy of the export) | **no** — outside the repo |

**Nothing Garmin says goes in this repo.** Sleep times are a nightly record
of when the house is asleep, and HRV and resting heart rate are health data.
Ric decided on 2026-09-29 to keep them behind the password. `/garmin` is the
only route on the Worker that is private to read as well as to write.

## Setting it up (once, on the Mac)

1. **Garmin login into the Keychain.** The command prompts for the password,
   so it never lands in shell history:
   ```sh
   security add-generic-password -s garmin-connect -a YOUR@EMAIL -w
   ```
2. **Site password.** This is already in the Keychain if the board sync runs,
   because it uses the same entry. If it isn't there:
   ```sh
   security add-generic-password -s training-log -a rmbuster82 -w
   ```
3. **Deploy the Worker** so it has the `/garmin` route:
   ```sh
   cd worker && npx wrangler@latest deploy
   ```
4. **Make the reader token.** This token can read the export and do nothing
   else, and it's what a Claude session is given instead of the site password:
   ```sh
   cd worker
   T=$(openssl rand -hex 24)
   echo "$T" | npx wrangler@latest secret put GARMIN_READ_TOKEN
   echo "$T" | pbcopy        # now on the clipboard for step 5
   ```
5. **Give it to Claude's cloud environment.** In claude.ai/code, open the
   environment's settings (the environment menu in a session's title bar, then
   Edit):
   - add the environment variable `GARMIN_READ_TOKEN` and paste the token in
   - under network access, allow `training-log.rmbuster82.workers.dev`
6. **Put the button on the Desktop.** In Finder, right-click
   `projects/training/garmin/Garmin.command`, choose Make Alias, and drag the
   alias to the Desktop. The first time you open it, macOS may say it can't
   verify it. Right-click it, choose Open, then Open again.

## Pressing it

The first run builds its Python venv. It then logs in (Garmin may text a code,
so type it into the window) and walks back through the whole history, newest
first. That's five requests per day, paced so Garmin doesn't lock the account,
so a few years of history takes a while. The walk stops after sixty days in a row
with nothing on them, which is where the watch hadn't been bought yet.

Later runs re-read the last three days and any new activities, so they take
seconds.

If Garmin rate-limits partway through, what's in so far is still uploaded.
Press the button again in an hour and it carries on. Stopping it with ⌃C
loses nothing either.

If it breaks after working, Garmin has probably changed its login. Run
`Garmin.command --upgrade`, from Terminal, to pull the newest `garminconnect`.
Garmin has no API for individuals, and this unofficial library is what
everybody uses.

## What's kept

`trim()` in `pull-garmin.py` keeps every value Garmin returns up to six levels
deep, plus short lists (readiness updates). It drops time series, such as
per-minute heart rate and sleep movement, because they're most of the bytes and
none of the answers. It also drops every key that names a place or an identity
(`latitude`, `locationName`, `ownerFullName`, …). Hard rule 1 says coordinates
don't travel, and nothing about fatigue needs them. `test.mjs` runs the real
script against a fake Garmin (`test/fake/`) and fails if any of that survives.

## Reading it (for Claude)

```sh
curl -sS -H "authorization: Bearer $GARMIN_READ_TOKEN" \
  https://training-log.rmbuster82.workers.dev/garmin -o garmin.json
python3 projects/training/garmin/recent.py garmin.json --days 21
```

Save it to the scratchpad, never into the repo. The response has an
`x-uploaded` header with when the button was last pressed. A `404` means it
hasn't been pressed yet. A `401` means the token is missing or wrong. A `403`
from the host (not the Worker) means the network allowance in step 5 is
missing.
