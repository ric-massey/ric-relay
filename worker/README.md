# The Worker

One Cloudflare Worker, deployed as **`training-log`**, is the site's only
back end outside ATLAS. It started as the training log and grew, so the name
is historical — every room that writes anything writes here:

| Route | Room | What it holds |
|---|---|---|
| `/log` | Training | ticks and notes against the plan |
| `/strava` | Training | runs pushed by Strava's webhook |
| `/board` | Training / Climbing | board-night dates from `projects/climbing/board-tick.mjs` |
| `/climb` | Climbing | days logged from `projects/climbing/add.html` |
| `/media` | Climbing | photos and clips for the media tab |
| `/todo` | Climbing | the route to-do list |
| `/movies` | Entertainment | edits on top of `projects/entertainment/entertainment-data.js` |
| `/auth` | all of them | Ric's sign-in (`assets/owner.js`) |

It lived in `projects/training/server/` until 2026-09-25. The deployed name
stays `training-log` because that name is in the live URL every page calls —
renaming it is a redeploy plus an edit to every client, not a tidy-up.

```sh
cd worker
npx wrangler@latest deploy          # from the Mac, straight to Cloudflare
node worker/test.mjs                # the rules: auth, strava, media, todo, movies
node worker/dev.mjs                 # serves the site and every route above locally
```

Secrets, the Strava wiring and the security rules are in
[`projects/training/README.md`](../projects/training/README.md) and at the top
of `worker.mjs` and `wrangler.jsonc`. **If you add a route, add it to the regex
in `dev.mjs` too**, or local testing quietly falls through to production.

Orrin's status service is a separate Worker in `projects/orrin/server/`.
