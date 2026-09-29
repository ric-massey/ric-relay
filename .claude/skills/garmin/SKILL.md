---
name: garmin
description: Read Ric's Garmin history (sleep, HRV, resting heart rate, Body Battery, stress, training readiness, training status, every activity) from behind the site password. Use when Ric asks how he's recovering, why he's tired, to look at his Garmin/watch data, sleep or HRV, or to check his recent training against how his body is doing.
---

# Read the Garmin export

Ric presses `Garmin.command` on his Mac. That uploads his whole history to the
Worker's private `/garmin` route. This session reads it with a read-only token.
Everything about how it's built is in `projects/training/garmin/README.md`.

## Fetch

Save it to the scratchpad directory, **never into the repo**. It's health data,
and the repo is public.

```sh
curl -sS -D - -H "authorization: Bearer $GARMIN_READ_TOKEN" \
  https://training-log.rmbuster82.workers.dev/garmin -o "$SCRATCH/garmin.json" | grep -i '^x-uploaded\|^HTTP'
python3 projects/training/garmin/recent.py "$SCRATCH/garmin.json" --days 21
```

- `x-uploaded` is when he last pressed the button. If it's more than a day
  old, say so, because last night's sleep won't be in it.
- `404` means the button has never been pressed. `401` means
  `GARMIN_READ_TOKEN` isn't set in this environment or is wrong. A proxy
  `403` / CONNECT failure means the environment's network settings don't allow
  `training-log.rmbuster82.workers.dev`. Point him to steps 4–5 of the README
  for the last two.
- Ten wrong tokens lock the Worker for five minutes for everyone, Ric
  included, so don't retry a 401 in a loop.

## The shape

`days["YYYY-MM-DD"]` → `summary` (steps, `restingHeartRate`, Body Battery
high/low, `averageStressLevel`), `sleep.dailySleepDTO` (`sleepTimeSeconds`,
stages, `sleepScores.overall.value`), `hrv.hrvSummary` (`lastNightAvg`,
`weeklyAvg`, `status`, baseline), `readiness` (latest update of the day:
`score`, `level`, `recoveryTime`), and `status` (training status and acute/chronic
load, keyed by device id). `activities` is a list of Garmin activity summaries,
oldest first. Distances are in metres, durations in seconds, speeds in m/s.

## Reading it well

Compare against his own baseline, not population norms. HRV below its weekly
average for several nights, resting HR a few beats up, low sleep scores and
Body Battery not recharging are the pattern of accumulated fatigue. Put them
next to the plan in `assets/training-plan.json` so the advice is about his
actual week. Anything that looks like illness rather than training load (a
sustained RHR jump, a fever pattern) should be said plainly, with the
suggestion to rest or see someone.
