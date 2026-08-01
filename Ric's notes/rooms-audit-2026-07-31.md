# Room pages audit — 2026-07-31

Companion to `terminal-audit-2026-07-31.md`, which covered `index.html`. This one
covers the nine room pages plus `map.html` and `404.html`.

Every page was loaded from a local server and inspected live — console, network,
rendered DOM, computed styles, contrast maths, and resource weight — not just read.

**Nothing is broken.** No console errors on any page, no failed requests, every
local link on every page resolves, `aria-current="page"` is correct everywhere, and
no page overflows horizontally at 375px. The GitHub feed on `/orrin` is live and
pulling real data.

The two biggest issues are structural rather than broken code: the room navs still
advertise all nine rooms when the front door now shows six (**A1**), and there is
no mobile menu anywhere on the site (**A2**).

Severity: **A** = actually wrong / visitors hit it · **B** = worth fixing · **C** = polish.

---

## A — real problems

### A1. Every room's nav still lists all nine rooms — the front door lists six
The home directory was cut to the six rooms with real depth (`/orrin`, `/mind`,
`/climbing`, `/exploration`, `/workbench`, `/captures`). But **all nine room pages
still carry a 10-item nav** — `terminal` plus every room including `training`,
`apex` and `log`.

Verified: 10 nav items on each of the nine pages.

So the site now says two different things about what it contains. A visitor lands
on the terminal, sees six places, clicks into `/climbing`, and is suddenly offered
nine. The thin rooms that were deliberately taken off the front door are
re-advertised at the top of every single page — which is most of the pages they
appear on.

**The room navs should show the same set the terminal lists**: terminal, orrin,
psyche, climbing, exploration, workbench, captures. `training`, `apex` and `log`
come out of the nav for the same reason they came out of `#dir`, and stay reachable
exactly the same way — by URL, by `ls` / `tree` / `find`, by typing the room name,
and by `open <room>`.

Note the knock-on: a room that isn't in the nav can't render its own `.here` span,
so `/training`, `/apex` and `/log` would show the nav with nothing marked current.
That's fine and is what `map.html` already does — it carries no room nav at all.
Decide whether those three keep a nav (with nothing highlighted) or drop it like
map does; carrying it with no `.here` is the less jarring of the two.

This touches all nine pages, and `AGENTS.md`'s "identical label set on every page"
rule needs rewording to match — the set stays identical, it just gets shorter.

### A2. There is no mobile menu — the nav wraps or hides instead
At 375px every page dumps the full 10-item nav into the layout. Two failure modes,
both measured:

| Page | Behaviour at 375px |
|---|---|
| `climbing.html` | wraps to **3 rows**, 90px tall — **11% of the screen** before any content |
| `apex.html` | scrolls sideways with **516px hidden off-screen** — over a full screen-width of rooms invisible, no visible affordance that more exists |

**Every nav item on both pages is under 44px tall** (10 of 10), which is below the
minimum touch target size — they're small, tightly packed links meant for a mouse.

These are the two extremes and the other rooms sit between them. Neither is good:
one eats the top of the screen, the other hides half the site behind a horizontal
scroll nobody will discover.

**This wants a hamburger on mobile** — a single button that opens the room list as
a proper menu, with full-size tap targets, leaving the header to show just the room
name. Cutting the nav to six items (A1) shrinks the problem but doesn't solve it;
six items still wrap, and they'd still be sub-44px targets.

Worth doing once as a small shared pattern rather than nine separate ones — but per
the house rule the *styling* must stay native to each room, so the shared part
should be the behaviour (a checkbox/`<details>` toggle or a few lines of JS), not a
shared stylesheet.

### A3. Three rooms announce the sitewide "latest" item as something it isn't
Each room prefixes the shared latest banner with its own themed label. There is one
global newest item, so right now every room describes *How Speed Affects Time* — a
relativity explainer — in its own vocabulary. Three of those are simply false:

| Page | Renders | Problem |
|---|---|---|
| `climbing.html` | **new route** // interactive | It is not a route |
| `training.html` | **new activity** // interactive | It is not a workout |
| `captures.html` | **fresh frame** // interactive | It is not a photo |

The other seven are fine because their prefixes are generic (`new signal`,
`late edition`, `revision notice`, `incoming transmission`, `new on the terminal`,
`new finding`, `NOTIFICATION`).

This is the most visible content bug on the site — a family member reading
`/climbing` is told a physics page is a new route. The prefix mechanism assumes the
banner shows *that room's* content, but it deliberately shows sitewide content.

Fix direction: either give those three rooms neutral prefixes too, or only apply a
room-flavoured prefix when the item's `room`/`kind` actually matches, falling back
to `NEW ON THE TERMINAL` otherwise.

`latest.js:78-80`, `climbing.html:309`, `training.html:170`, `captures.html:131`

### A4. `apex.html` has no `<h1>`
Its headings are `H2,H2,H2,H2,H2` — the page never declares a top-level heading.
Every other room has exactly one. Screen readers and search engines get no page
title in the document structure.

### A5. Setup instructions for *you* are published to visitors
Two rooms print notes-to-self on the live public page:

**`apex.html`:**
> "Showing hand-read seed data. The daily pull needs a free API key from
> apexlegendsapi.com in the Keychain and a gamertag in apex-account.json."
>
> "rank and RP arrive with the API key — or type rank into apex-data.js to light up
> the ladder now"

**`training.html`:**
> "Two ways to wire it up when you're ready: the quick Strava embed widget, or a
> small serverless function hitting the Strava API (Garmin syncs into Strava
> automatically)."

These name internal filenames and your credential store to an audience of family.
They belong in `README.md`, not on the page. (No actual secret is exposed — but
"the API key lives in the Keychain" is not a sentence a visitor should read.)

### A6. Literal placeholder copy is live on two rooms
- `training.html` — "Example morning run", "**Replace me · someday**, 7:12 AM", and
  a THIS WEEK panel reading **0 mi / 0h 0m / 0 ft / 0 Activities**.
- `workbench.html` — "ITEM 002 · Your next random project · **Replace me.** Anything
  goes here… When it's done, flip the tag to 'shipped.'"

Workbench has exactly one real item (Siege Conductor) and one "replace me" card.

Both of these are why unlisting `/training` from the home directory was the right
call. Workbench is *still listed* and still shows a Replace-me card.

### A7. Photo alt text is a serial number
All 38 images on `captures.html` have `alt="FRAME 001"`, `alt="FRAME 002"`… The
attribute is present, so automated checks pass, but the gallery conveys nothing to
anyone using a screen reader or with images disabled — it reads as 38 numbers.

`AGENTS.md` asks that `alt` be preserved; it's worth making it mean something.
These are your photos, so the captions probably already exist in your head.

### A8. `climbing.html` downloads 3.0 MB on load
Measured from the resource timings: **2,755 KB of images + 274 KB of JS = 3,029 KB.**

All six hero photos are fetched immediately, because they're inline
`background-image` styles on six always-present divs — even though only one is
visible at a time:

```
climbing-01 404 KB · 02 474 KB · 03 416 KB · 05 427 KB · 06 388 KB · 07 646 KB
```

The photos are correctly sized to 1600px per the house rule, so this isn't a
resizing miss — it's that the rotation preloads its whole deck up front. Loading
the first eagerly and the rest on an idle callback would cut the initial load by
~2.3 MB. WebP would roughly halve what's left.

(`climbs-data.js` is 202 KB of that JS total — fine, it's the actual ledger.)

### A9. The full-screen canvases render at half resolution on Retina
`orrin.html:307` and `exploration.html:212` both do:

```js
function resize() { W = canvas.width = innerWidth; H = canvas.height = innerHeight; }
```

The backing store is set in CSS pixels, so on a 2× display the canvas is upscaled.
Measured on `/exploration`: backing store 375×812, CSS size 375×812, `devicePixelRatio`
2 — the dust renders at **half the resolution the screen can show**, so it looks
soft on every Mac and iPhone in the family.

Multiplying by `devicePixelRatio` and scaling the context fixes it.

Same two lines use `innerWidth`, which *includes* the scrollbar. Where a classic
(non-overlay) scrollbar is present, the canvas is wider than the content box and
adds horizontal overflow. I reproduced this at a ~280px-wide window;
`document.documentElement.clientWidth` is the correct source.

---

## B — worth fixing

### B1. The dim-accent body text pattern fails contrast on every page
Same finding as the home page, but it's systemic: every room defines a dimmed
variant of its accent colour and uses it for supporting copy on a near-black or
near-white ground. Measured against real rendered text nodes:

| Page | Failing text nodes | Worst offender |
|---|---|---|
| `captures.html` | 50 | room nav links — **3.82:1** at 11.5px |
| `climbing.html` | 33 | `projecting` tag — **2.89:1** at 9.3px |
| `map.html` | 4 | body paragraph (`--red-dim`) — **2.24:1** |
| `index.html` | — | `--phosphor-dim` **3.61:1**, `--phosphor-faint` **1.47:1** |

AA wants 4.5:1 for text this size.

The climbing one is the worst in practice, because the failing text is the
*meaningful* text: the `sent` / `projecting` status tags are how you read the page,
and they're the lowest-contrast, smallest thing on it.

### B2. Type gets very small — down to 8px
Sub-12px `font-size` declarations, per page (computed against each page's base):

| Page | Smallest declarations (px) |
|---|---|
| `apex.html` | **8.0**, 8.5, 9.0, 9.5, 10.0, 10.5, 11.0, 11.5 |
| `climbing.html` | **8.7**, 9.0, 9.9, 10.2, 10.8, 11.7 |
| `orrin.html` | **9.0**, 9.9, 10.4, 10.9, 11.0, 11.3, 11.6, 11.9 |
| `psyche.html` | 9.0, 10.0 |
| `exploration.html` / `workbench.html` | 9.6, 10.4, … |
| `training.html` | 9.8, 9.9, … |

8px is smaller than almost any UI ships. Combined with B1 — small *and* low
contrast on the same elements — this is the thing most likely to make an older
relative give up on a page. Raising the floor to ~11px would cost very little of
the look.

### B3. `orrin.html` has five sections and only one heading
Its regions — START HERE, WHAT MAKES IT DIFFERENT, LIVE PROJECT STATUS, RECENT CODE
CHANGES, RECENT PROJECT EVENTS — are all `div.region-head`, not `<h2>`. The document
outline is a single `h1`. `captures.html` has the same shape (H1 only).

Purely a markup swap; the styling can stay identical.

### B4. `/orrin` makes three unauthenticated GitHub calls per view, and the error message is wrong advice
Unauthenticated GitHub API is 60 requests/hour **per IP**. Three calls per page
load means ~20 views per hour from one address before everything 403s — and a
household or office behind one NAT shares that budget.

When it does fail, the page says:

> "GitHub could not be reached. Refresh to try again."

Refreshing is exactly what you must not do when rate-limited; it extends the block.
Worth distinguishing a `403` with `X-RateLimit-Remaining: 0` and saying "GitHub is
rate-limiting this address — try again in a few minutes."

`orrin.html:400-404`, `413`, `432`, `448`, `483`

### B5. RECENT PROJECT EVENTS renders empty
Live right now: *"No recent public GitHub events for Orrin."* The events endpoint
only retains ~90 days of public events, so this section will read as empty
whenever there's a gap. A whole labelled section showing nothing suggests the page
is broken rather than that the window is quiet. Consider folding it into RECENT
CODE CHANGES, or hiding the section when there's nothing to say.

### B6. `psyche.html` is missing a favicon and two `og:` tags
Every other page has `rel="icon"` and five `og:` properties; psyche has no icon and
three. It'll show the browser's blank-page default in a tab strip next to nine
siblings that don't.

### B7. `captures.html` images have no width/height
None of the 38 images declare dimensions. They're correctly `loading="lazy"`, but
without an intrinsic size the grid reflows as each one arrives — the page jumps
under you while scrolling. Adding `width`/`height` (or a CSS `aspect-ratio`) fixes
the shift without changing the layout.

---

## C — polish

### C1. British and American spellings are mixed
`exploration.html` uses "colours" and "neighbourhood"; the rest of the site and both
docs use American forms ("optimized", "visualization"). Pick one.

### C2. `AGENTS.md` says the Apex gamertag stays out of the repo — it doesn't
> "The gamertag lives in `projects/apex/apex-account.json` (gitignored)"

`apex-account.json` *is* correctly gitignored. But `RicGoneCrazy` is written into
`projects/apex/apex-data.js:13`, which **is** committed, and is rendered on the
page. That's harmless — a gamertag is public by nature — but the rule as written
doesn't do what it claims, and someone trusting it later might assume more privacy
than exists. Worth correcting the wording.

### C3. `404.html` has no `og:` tags or canonical
Every room has both. Low stakes for an error page, but it's the one page most
likely to be hit from a mistyped shared link.

### C4. `/log` largely restates `/psyche`
Three of the log's four entries are the same three psyche projects, with similar
copy. Not a bug — but if the log is meant to be the long-form corner, it currently
reads as a second index of work that already has a room.

---

## Checked and clean

- **No console errors and no failed network requests on any page.**
- Every local `href`/`src` on all eleven pages resolves to a real file.
- Room menus are internally consistent — identical label set on all nine, `.here`
  span present with `aria-current="page"` on each, `map.html` correctly excluded.
  (Consistent with *each other*; see **A1** for the mismatch with the home page.)
- Home links are `index.html` in markup everywhere (including `map.html` and
  `404.html`), with `effects.js` normalising to `./` at runtime — the direct-file
  rule is being honoured.
- No horizontal overflow at 375px on any page.
- **No spelling errors in room-page copy** — a full sweep of visible text found
  none. (The four typos are all on `index.html`, already logged.)
- Script loading is consistent: every room loads `effects.js`, `latest-climb.js`
  and `latest.js`; only climbing and apex add their own data file.
- `captures.html` lazy-loads all 38 images correctly.
- Generated data is fresh — apex `2026-07-30`, board `2026-07-29`, latest climb
  `2026-07-27`.
- Pages with no animation (`training`, `workbench`, `captures`, `log`) correctly
  have no reduced-motion block — there's nothing to suppress.
- `map.html` is a clean, deliberate stub: no coordinates, no map, no location data
  of any kind, one link home.
- No location data, no extra repos, no build step, no external dependencies
  anywhere.

---

## Suggested order

1. **A1 + A2** together — one pass over all nine navs: cut them to the terminal's
   six rooms and add the mobile hamburger at the same time. They touch the same
   markup on the same nine files, so doing them separately means editing every page
   twice.
2. **A3** — the false "new route" / "new activity" / "fresh frame" labels. Visible,
   wrong, and cheap to fix.
3. **A5 + A6** — get the setup notes and "Replace me" cards off the public pages.
4. **A8** — 3 MB on climbing is the slowest thing on the site.
5. **B1 + B2** together — one pass raising the dim colours and the type floor fixes
   the readability of every room at once.
6. **A4, B3, B6, A7** — markup and metadata cleanup.
7. **A9, B4, B5** — the canvas and GitHub robustness work.
