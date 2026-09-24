# HERMISCUS · Yeti Going Together

This is a static, multi-page race crew app backed by the family's shared Supabase database.

**AI assistants: read [`AGENTS.md`](AGENTS.md) first.** It is written to travel — Victoria
keeps a copy next to her `index.html` so any AI she works with gets the same rules.
The private entrance is `login.html`; the public terminal opens it with the undocumented
`hermiscus` command.

## Security status: the website runs a demo

The website never has the database key, so it can't reach the family's data:

- `shared/config.js` is committed and has **no key**. It loads `shared/config.local.js`
  only when the app is served from this computer (`localhost` / `127.0.0.1`).
- `shared/config.local.js` holds the real Supabase address and key. It is **git-ignored**
  (see `.gitignore`) and exists only on Ric's machine.
- With no key, `auth.js` switches to demo mode: no sign-in, the login page opens onto a
  "look around" door, and the app runs on the made-up race in `shared/demo-data.js`,
  stored only in the visitor's browser and re-seeded every few hours so it always looks
  mid-race. A yellow DEMO strip sits on every app page.
- `tests/auth-security.test.cjs` fails if a key, a JWT or a `*.supabase.co` project
  address appears in any file here other than `config.local.js`, or if that file stops
  being ignored. `.github/checks.mjs` runs it on every push.

On the website, seeing the demo takes an account on Ric's site with HERMISCUS switched
on — the same account as ATLAS, asked for and approved at `/account/` (see "The door"
in `atlas/README.md`). The demo's data is made up and its files are public, so that
decides who is shown it; it is a curtain, not a lock. Locally with the real key, the
old name-and-password sign-in against the sister's project is unchanged.

On localhost, add `?demo=1` to any page to see what the website shows; `?demo=0` goes back.

Never paste real race data (lodging, addresses, notes, the plan) into `demo-data.js`.

The real app's database lock (`supabase/security.sql`, `supabase/SETUP.md`) is still
unapplied. It is only needed if the real app is ever hosted somewhere public; running it
locks every copy that doesn't sign in, including the sister's own app.

Passwords are never stored in this project.

## Pages

- `index.html` is the crew directory.
- `profiles/<name>/index.html` is that person's physical entry page.
- `profiles/view/index.html` is a fallback for profiles added later through the app.

The current profile URLs are:

- `/profiles/victoria/`
- `/profiles/michelle/`
- `/profiles/auston/`
- `/profiles/grady/`
- `/profiles/silas/`
- `/profiles/ric/`
- `/profiles/sydney/`
- `/profiles/aubrey/`

## Her app, with Ric's layers on top

The crew app is Victoria's, and **everyone runs it**. Two layers of Ric's load on top:

- `shared/original/` is her app — screens, styles and code — imported from her deployed
  `index.html` by `scripts/import-original.py`. Don't edit it by hand.
- `shared/notes-layer.js` + `shared/notes.css` — **Ric's Notes screen, for everyone.**
  Victoria liked it and wanted it on every profile. It replaces her Notes page and the
  functions behind it. Its "For Ric" filters and pinned note only appear on the race-day
  dashboard (`usesMissionShell()`, which is true only while Ric's layer is running).
- `shared/ric-layer.js` + `shared/styles.css` — **Ric's race-day version** (Overview, Crew
  Stop, Pace Dad, Prep, More, his Settings additions and his versions of a few of her
  functions). **Off by default**: Ric and Sydney start on Victoria's version and switch it
  on in Settings ("Ric's race-day version", remembered per device in
  `hermiscus_use_ric_<name>`).
- `shared/bootstrap.js` always loads her shell, styles and code, captures her `goPage`,
  `loadAppData` and `liveSyncTick` (as `HER.*`), loads the Notes layer, then Ric's layer if
  it is switched on, and only then lets her start-up run — her `init` waits on
  `window.HermiscusBeforeStart`.
- **What she adds reaches everyone.** A new page and nav button in her app appears under
  **More** in Ric's bar; a new function, or a fix to any function the layers don't
  redefine, is simply live. Only the functions the layers redefine hide hers — keep that
  list short, and call `HER.<name>()` where her behaviour will do.
- Never redeclare one of her top-level `let`/`const` names in a layer (or one layer's in
  the other): they share one global scope and that is a load-stopping error. Tested.
- Everything sits on one data layer, `shared/data.js` (sign-in headers, offline queue, demo
  store). That replaced her data layer, which is where her database key lived.

When she ships a new version, download her `index.html` (or the deploy zip) and run:

```sh
python3 scripts/import-original.py ~/Downloads/hermesco-deploy.zip
```

It refuses to write anything if a patch no longer fits or a key would survive, and it
stamps a new cache version into `bootstrap.js` and every page so phones fetch her new files.

## Victoria's open website (the export)

Victoria's live site is one `index.html` she uploads herself: no sign-in, you open it and
pick your name. `scripts/build-open-site.py` makes that file from hers:

```sh
python3 scripts/build-open-site.py ~/Downloads/hermesco-deploy.zip
```

It writes `~/Desktop/HERMISCUS for Victoria/` (index.html plus AGENTS.md and CLAUDE.md for
her AI) — **outside the repo, because it holds the real key** (the same one her page always
published). Her code stays hers; the top of her script becomes this repo's connection
(`data.js`, `ric-dashboard-logic.js`), and Ric's two layers ride in `data-ric` blocks: the
Notes layer for everyone, the race-day layer when Ric or Sydney switches it on. Picking Ric
or Sydney on the name screen reloads the page so it is set up for them. Her built-in copy of the race data
is not carried over. `--demo` builds a keyless copy on the made-up race for testing.

When she sends a file back, `import-original.py` takes it as usual: it drops the `data-ric`
blocks and everything above STATE, so only her part lands in `shared/original/`. Rebuild
the export from her latest file whenever Ric's layer changes, and send it back to her.

Each profile page declares its identity with a `data-profile` attribute on `<body>`. This allows a page to be customized independently while the common race features remain shared.

Each person's Settings screen also has a dashboard color picker. That choice is stored locally per profile and does not alter the original colors on the crew directory.

Ric's Home screen is a dedicated race-day dashboard. It stages his next crew stop with location, stop gear, arrival/departure controls, the live stop timer, questions, and outgoing pace guidance. It also builds his pacing assignment from per-stop `RIC PACING` notes and shows the route, leg distances, target paces, and run gear.

## Data safety

The local pages still connect to the existing Supabase project. Editing local files does not alter shared data, but using save, delete, check-in, or other editing controls in the running app can change the family's live database. Do not enter a real password or make race edits until the RLS setup has been reviewed and applied.

## Local preview

Serve the directory through a local web server rather than opening the HTML files directly
(the real data only loads on localhost, from the git-ignored `shared/config.local.js`):

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Then open `http://127.0.0.1:4173/`.

## Tests

Run Ric's race-day logic and screen-contract tests with:

```sh
npm test
```

The suite covers stop order, next-stop distance and ETA, live pace adjustment,
crew-stop states, active pacing, note filters, and automatic headlamp rules.
