# Garmin → Claude

A button on the training page pulls the whole useful Garmin history, meaning sleep,
HRV, resting heart rate, stress, Body Battery, training readiness, training
status and every activity's numbers. It puts that history behind the site password on
the Worker, where a Claude session can read it in one request. No Mac is
needed: the pull runs on GitHub Actions.

```
phone: training.html, signed in → "pull Garmin"
  → Worker POST /garmin/_pull (site password)
    → GitHub repository_dispatch "garmin" → .github/workflows/garmin.yml
      → pull-garmin.py → Worker POST /garmin (private)
Claude: GET /garmin with GARMIN_READ_TOKEN (read-only)
```

| what | where | public? |
|---|---|---|
| The button | "pull Garmin" in the owner bar on `training.html` | only when signed in |
| The job | `.github/workflows/garmin.yml` | the code is; nothing it pulls is |
| The puller | `pull-garmin.py` | same |
| The reader | `recent.py`: the last few weeks, one line a day | same |
| The export | the Worker's `GET /garmin`, in R2 at `garmin/export.json` | **no** — token only |
| Garmin's session | the Worker's `/garmin/session`, in R2 at `garmin/session.json` | **no** — site password only |
| The Mac route | `Garmin.command`, which keeps its state in `~/.ric-garmin/` | optional |

**Nothing Garmin says goes in this repo.** Sleep times are a nightly record
of when the house is asleep, and HRV and resting heart rate are health data.
Ric decided on 2026-09-29 to keep them behind the password. `/garmin` is the
only route on the Worker that is private to read as well as to write.

The repo is public, and so is the Actions log. The job commits nothing,
uploads no artifact and uses no cache (a cache on a public repo can be
restored by someone else's pull request). The script prints only counts and
dates. Its memory between runs is the last export plus Garmin's parked
session, both on the Worker.

## Setting it up (once, all from a phone)

1. **GitHub secrets.** On github.com, go to ric-massey/ric-relay → Settings →
   Secrets and variables → Actions → New repository secret, and add:
   - `GARMIN_EMAIL`: the Garmin Connect login
   - `GARMIN_PASSWORD`: its password
   - `LOG_TOKEN`: the site password
   - `CLOUDFLARE_API_TOKEN`: for step 3. Make it in the Cloudflare dashboard
     under My Profile → API Tokens → Create Token → "Edit Cloudflare Workers".
     Also add `CLOUDFLARE_ACCOUNT_ID` if the token covers more than one
     account.
2. **The reader token, on the Worker.** In the Cloudflare dashboard, go to
   Workers & Pages → training-log → Settings → Variables and Secrets → Add. Choose
   type Secret, name it `GARMIN_READ_TOKEN`, and use any random string of 24+
   characters (a password manager's generator is fine). While you're there,
   check that `GH_TOKEN` exists. It's what lets the Worker press GitHub's
   button, and the Entertainment room already uses it.
3. **Deploy the Worker.** On GitHub, go to Actions → Deploy Worker → Run workflow.
4. **Give Claude the reader token.** In claude.ai/code, open the environment's
   settings (the environment menu in a session's title bar, then Edit):
   - add the environment variable `GARMIN_READ_TOKEN` with the same string
   - under network access, allow `training-log.rmbuster82.workers.dev`

## Pressing it

Sign in at the foot of the training page and press **pull Garmin**. The run
shows up under Actions → Garmin. The first one walks back through the whole
history, newest first, at five requests a day, paced so Garmin doesn't lock
the account. That can take up to an hour. It stops after sixty days in a row
with nothing on them, which is where the watch hadn't been bought yet. Later
runs re-read the last three days and any new activities, so they take about
a minute.

If Garmin rate-limits partway, what's in so far is still uploaded, and the
run ends yellow rather than red. Press again in an hour and it carries on.

**Two-step verification.** If the Garmin account asks for a code at login,
a GitHub machine can't type it, so the run stops and says so. Run
`Garmin.command` once from a Mac and type the code there. The session it makes
lasts for months, and after that every GitHub run reuses it. The Mac run parks
it on the Worker only if you run it with `GARMIN_REMOTE=1`. The alternative is
to turn two-step off for Garmin.

**When it breaks.** Garmin has no API for individuals. This uses the unofficial
`garminconnect` library, which the workflow installs fresh on every press, so
a fix published upstream is picked up by pressing again.

## From a Mac instead

`Garmin.command` runs the same script locally. It reads the Garmin login from
the Keychain (`security add-generic-password -s garmin-connect -a EMAIL -w`)
and the site password from the `training-log` entry the board sync uses. It
builds its own venv in `~/.ric-garmin`. Make an alias of it on the Desktop to
turn it into a double-click button.

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
