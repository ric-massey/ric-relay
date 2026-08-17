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
