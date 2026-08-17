# Training — the public feed

Public read, private write. Everyone sees the sessions; only Ric ticks them off
and writes notes.

## The pieces

| what | where | public? |
|---|---|---|
| The planning app | `projects/training/index.html` | **no** — gitignored |
| Its rule harness | `projects/training/test/rules.js` | **no** — gitignored |
| The exporter | `projects/training/export.mjs` | yes |
| The generated plan | `assets/training-plan.json` | yes |
| The log service | `projects/training/server/` | yes (no secrets in it) |
| The Strava wiring | `projects/training/server/strava-setup.mjs` | yes (run once, keys in the Keychain) |
| The feed page | `training.html` | yes |

## Why it is split this way

GitHub Pages is static and this repo is public, so **there is no such thing as a
secret in the page**. Any "is this Ric" check written in JavaScript is
decoration — anyone can open devtools and flip it.

So the gate lives in the one place the public cannot read: a Cloudflare Worker
holding a token. The page is free to render whatever controls it likes. A write
without the token gets a 401 and nothing happens. That is why the client is
allowed to be naive, and why owner mode is a *rendering hint* rather than a
security boundary.

`index.html` stays off Pages entirely. Not because sessions are sensitive — they
are published — but because it holds the work rota, the free-hours table, the
sleep window and the Apex schedule, which together are a weekly timetable of
when the house is empty. That is a different thing from a training log.

The exporter is an **allowlist** (`PUBLIC_FIELDS`). A new field added to the
planning app is private until somebody deliberately publishes it, because the
planning app gets edited far more often than the exporter does. It also runs a
leak guard over its own output and refuses to write if anything private appears.

## Publishing a change to the plan

```bash
node projects/training/export.mjs
```

Regenerates `assets/training-plan.json`. Commit it. Pages serves it. Nothing
about the schedule lives in the Worker, so nothing needs redeploying.

## Deploying the log service

Once:

```bash
cd projects/training/server
npx wrangler@latest secret put LOG_TOKEN
```

Pick something long and random. It never goes in this repo. Then:

```bash
npx wrangler@latest deploy
```

That prints `https://training-log.<subdomain>.workers.dev`. It is already wired
into `training.html` as `LOG_HOST`; change it there if the subdomain differs.

## Signing in

Type the password into the box at the bottom of `training.html`, or on
`projects/climbing/add.html`. Either one signs you in on both — they share the
same origin and the same stored key.

`POST /auth` checks it the moment you type, so a wrong password says so straight
away rather than failing silently on the first tick an hour later.

The one-tap link still works if typing on a phone is the friction you are trying
to avoid:

```
https://ricmassey.com/training.html?key=THE_TOKEN
```

The key is stored in `localStorage` and stripped from the address bar
immediately. It does pass through browser history on the way in, which is why
there is a sign-out button.

## Marking things done

Signed in, the whole session row is the button — not a small checkbox, because
this gets used one-handed after five hours of climbing. The tick paints
immediately and the network catches up behind it; if the write fails the tick
rolls back and says so.

`Did all of it` marks the whole day in one tap, which is the common case.

Notes: type and hit Enter to post publicly, or the **Private** button to keep
one to yourself. Private notes are visible to you when signed in and to nobody
else, ever — there is a test for it.

## Runs tick themselves off

A run finishes, the watch syncs to Strava, Strava POSTs the Worker, and the run
session on the plan for that date is ticked before you have taken your shoes
off. Nobody opens the site. The run also shows up on the day as a card —
distance, time, pace — linking to the activity on Strava.

The webhook body carries only `{aspect_type, object_id, owner_id}`: no date, no
sport, no distance. So every fact used is read back from the API afterwards with
Ric's own token, never from the body. That is what makes the endpoint safe to
leave open, which it has to be — Strava does not sign its events. A forged POST
can only choose which activity id gets looked up, and the token returns
activities belonging to the person who issued it.

### The rules it follows

- **Only runs tick anything.** `Run`, `TrailRun`, `VirtualRun`. A
  `WeightTraining` is not evidence the morning practice happened, and board
  sessions already have a real source on the climbing page — a watch ticking
  those too would double-count the one thing on this site that is properly
  pulled. Everything else is still recorded and shown; it just ticks nothing.
- **A run on a day with no run session ticks nothing** and appears as a card
  anyway. Unplanned is not the same as unrecorded.
- **A run lives inside the session it answered.** One chevron, on the session
  you tick, opening the workout you were meant to do and then the run you
  actually did: distance, elapsed, average and best pace, elevation, average and
  max heart rate, temperature, and the route on a map. A run the plan has no
  slot for — an unplanned one, or a ride — keeps a card of its own, because
  there is no session to fold it into.
- **Most of what Strava sends is stored but not drawn.** Splits, cadence,
  calories, relative effort, kudos, PRs, the watch model. Each is one line in
  `runDetail()` to put back, with no re-ingest and no Worker deploy — the page
  draws only the fields it asks for.
- **The week's mileage is what you ran**, summed from Strava and shown against
  the plan's target: "7 of 10 mi". Only runs count, so a ride does not flatter
  it. Signed in, private runs count too — see below.
- **Under 500 m ticks nothing.** Starting a watch by accident in a car park
  makes a 40-metre activity, and without a floor that would tick off the long run.
- **The route is published; nothing else about where is.** The encoded polyline
  is kept and drawn on a real map in the run detail — Ric's decision on
  2026-08-17, reversing what this file used to say. `start_latlng`, city,
  address and timezone are still refused, the leak guard still runs over the
  result, and the route comes in through one named field rather than by copying
  Strava's `map` object whole. Everything else is still rebuilt from
  `ACTIVITY_FIELDS`, the same direction as `PUBLIC_FIELDS` in `export.mjs`.
- **A visitor cannot see the route for five minutes.** Long enough that the map
  is never up while he is still standing at the trailhead, short enough to be
  invisible otherwise. Counted from when the Worker took the activity in, not
  from when the run started — `start_date_local` is a local time wearing a `Z`
  and a five minute hold cannot survive a timezone of error. Signed in, Ric
  sees his own route immediately.
- **The map is OpenStreetMap tiles, drawn by hand.** No Leaflet, no API key, no
  script from anywhere: the page does the Web Mercator arithmetic itself, places
  `<img>` tiles, and draws the route over them as SVG. This is the only external
  host the site talks to. If the tiles fail the route still draws.
- **Private on Strava stays private here — from visitors.** A run marked "Only
  You" or followers-only still ticks its session, but it is not republished, its
  name is not even written to storage, and no splits are kept for it. Signed in,
  Ric gets it back: the card appears labelled "only you", and its distance
  counts towards the week. Withholding it from its own author was the wrong
  reading of the rule — it made his own mileage wrong on his own page, with
  nothing on screen to explain the gap. The page asks with his token, and the
  reply on that path is `cache-control: private, no-store`, so nothing in the
  middle can hold his copy and hand it to somebody else.
- **A tick you touched is yours.** Ticks placed by Strava are marked `auto` and
  the page says "via Strava" on them. Touching that session clears the mark, and
  deleting the run on Strava then leaves your tick alone. Delete a run you never
  touched and its tick goes with it.
- **And it stays yours in both directions.** Strava fires a webhook again every
  time an activity is edited, so renaming a run hours later replays the whole
  path. If you unticked the session in between — the watch counted a warm-up as
  the workout, say — the replay leaves it unticked. Deciding it did not happen
  is a decision, and the rename is not an argument against it.

### Wiring it up, once

Make an API application at <https://www.strava.com/settings/api> with
**Authorization Callback Domain** set to exactly `localhost` — that is for the
one-time authorize below; the webhook callback is a different field and is not
checked against it. Then:

```bash
echo '{"client_id":"YOUR_ID"}' > projects/training/server/strava-account.json
```
```bash
security add-generic-password -s strava-api -a YOUR_ID -U -w
```

The second prompts for the client secret without echoing it. Never pass `-w` a
value on the command line — that puts the secret in your shell history.

```bash
node projects/training/server/strava-setup.mjs authorize
```

Opens a browser, catches the code on localhost, and prints the exact `wrangler
secret put` commands with the values filled in. Run those, then deploy, then:

```bash
node projects/training/server/strava-setup.mjs subscribe
```

Strava validates the callback during that request and expects an answer in two
seconds, so the Worker must already be deployed with `STRAVA_VERIFY_TOKEN` set.
`status` shows the current subscription; `unsubscribe` removes it. One
subscription per application — a second is an error, not a second feed.

The refresh token you paste into Cloudflare is a **seed**. Strava rotates it and
kills the old one immediately, so from the first refresh onward the live token
lives in the Worker's storage. Getting that wrong is the failure that breaks the
integration silently, weeks later, on a token that used to work.

### Seeing it work without a Strava account

`dev.mjs` fakes the Strava API, so the whole path — webhook, token refresh,
allowlist, match, tick — runs locally against an invented activity:

```bash
curl -s -X POST 'localhost:8799/strava?date=2026-08-17' -H 'content-type: application/json' -d '{"aspect_type":"create","object_type":"activity","object_id":900001,"owner_id":7}'
```

The invented activity carries coordinates and a polyline on purpose, so the
local page proves they never arrive.

## Logging a climbing day

`projects/climbing/add.html` — date, where, routes, done. No markdown, no build
step, no help required. It is live on both pages before you have driven home.

Three things it does on its own:

- **Tells you what it will do before you save.** Pick a date and it names the
  training session scheduled for it.
- **Ticks that session off.** If you logged the climb, you climbed — making you
  go and say so again on the other page is exactly the friction worth removing.
- **Links the two pages.** The training day grows a link to the climbing entry,
  because the dates match. Nothing to configure.

`climbs.md` is still the archive and is still edited by hand. Days added here go
to the log service and are merged into the climbing page at render time, tagged
`source: "web"`. If a date exists in both, the markdown wins — it is the
considered record and the web entry was the note scribbled in a car park.

## Regenerating the two static files

```bash
node projects/training/export.mjs
```
```bash
node projects/climbing/build-climb-days.mjs
```

The first rebuilds the sessions; the second rebuilds the small date index the
training page uses to spot a climbing day. Run the second after `build-data.py`.

## Tests

```bash
node projects/training/server/test.mjs
```

Asserts the part that actually matters: writes without the token change nothing,
private notes never reach a public read, the owner can still re-read his own
private notes, and two devices ticking the same day do not erase each other.

The Strava half is asserted there too, with a fake Strava and a fixture plan, so
none of it needs an account or a network: no coordinate reaches storage, a
forged webhook achieves nothing, a run only ticks a session that matches it, a
private run ticks without being republished, and the rotating refresh token is
kept rather than the seed.

`node projects/training/test/rules.js` runs the planning app's own rules, but
only if you have the private `index.html`.

## Local development

```bash
node projects/training/server/dev.mjs
```

Serves the site and the log API on one origin at `localhost:8799`, using the
real Worker class with an in-memory Map for storage. Owner mode with
`?key=local-dev-token`. Nothing persists; nothing touches Cloudflare.

## What is published, and the consequence

Sessions publish **on their scheduled date, with venue names**, and notes are
**public by default**. Those were deliberate choices.

The consequence, recorded here rather than discovered later: the published file
is a forward-looking calendar of where this person will be. `2026-11-08` says
Obed, and it says so in advance. If that ever stops being the intent, the
switches are `PRIVATE_SESSION` and `PUBLIC_FIELDS` in `export.mjs`, and the
`publicView` filter in `server/worker.mjs`.

Runs from Strava publish **the route** — the actual line, on a map, five minutes
after the run lands here. Ric chose this on 2026-08-17 knowing what it means: the
routes he runs most, including the point he starts and finishes at, are readable
by anyone who opens the page. Strava's own privacy zones do not help, because
this is fetched with his token and Strava returns the real line to its owner. The
switches are `polyline` in the `LEAKY` guard and the `route` block in `trim()`;
turning them off stops new runs, and old ones keep their route until re-ingested.

They also publish **the name you gave the activity**, plus distance, time and
elevation. A title is free text, and "Sharp's Ridge repeats" is a place — though
next to a map of the place, that hardly matters now. Runs marked private on
Strava are exempt from all of it: they tick their session and publish nothing.

They also publish **heart rate** — average and max — along with cadence,
calories, temperature, relative effort and the watch model.
That is health data about a named person on a page anyone can read, and it is a
larger disclosure than the distance beside it: a resting-to-max range and its
drift week over week say something about a body that "7 mi" does not. It is
published because the point of the detail panel is to be the run, and because
this site is already a public training diary. If that ever stops being the
trade you want, the switch is the same one line — drop `average_heartrate`,
`max_heartrate` and `average_heartrate` in `SPLIT_FIELDS` from the allowlists in
`server/worker.mjs` and the cells disappear on their own, because the page draws
only the fields that arrive.
