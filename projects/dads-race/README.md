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

## Two versions of the app, on purpose

The crew app is the sister's. Ric's changes are for Ric and Sydney only, so:

- **Ric and Sydney** run Ric's version: `shared/app-shell.html`, `shared/styles.css`,
  `shared/app.js` (the race-day dashboard, pacing, prep, messages).
- **Everyone else, and the crew directory,** run her original app, unchanged in look:
  `shared/original/` holds her screens, styles and code, imported from her deployed
  `index.html` by `scripts/import-original.py`. Don't edit those files by hand.
- Both sit on one data layer, `shared/data.js` (sign-in headers, offline queue, demo
  store). That replaced her data layer, which is where her database key lived.
- `shared/bootstrap.js` picks the version from who is signed in (on the website, which
  page you opened) and loads it.
- Ric and Sydney can tick **Use Victoria's version** in Settings to run her app instead.
  It is remembered per device (`hermiscus_use_original_<name>` in localStorage), and
  `bootstrap.js` adds the same box to her Settings screen so they can untick it — her
  code is not touched for it.

When she ships a new version, download her `index.html` (or the deploy zip) and run:

```sh
python3 scripts/import-original.py ~/Downloads/hermesco-deploy.zip
```

It refuses to write anything if a patch no longer fits or a key would survive.

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
