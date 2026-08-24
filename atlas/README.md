# ATLAS

A private map for a crew of three. Pins carry a name, a description, photos, a
running log of notes, and who dropped them and when.
Anyone in the crew can add one; everyone can find it again, which is the whole
point — you can go to a cave your brother found without your brother.

The app lives in the public site repo and is served from `/atlas`, but the only
thing committed here is code. Every coordinate, note and photo lives in Supabase
behind row-level security, and nothing that identifies a place is ever in git.

---

## Setup (once)

### 1. Run the migrations

```bash
supabase link --project-ref ljnwclgjfctotkmqdlqh
supabase db push
```

Schema changes are migrations in `supabase/migrations/`, not copy-paste.

### 2. Custom SMTP

Supabase's built-in email sender does **2 messages per hour** and is explicitly
not for production. Invites and password resets both need email, so wire up a
real provider (Resend) under Authentication → Emails → SMTP Settings.

The SMTP password is an API key and lives in the dashboard only — never in this
repo. Note that `supabase config push` can clear it; check after any push.

### 3. Lock the door

Authentication → Sign In / Providers → Email:

| Setting | Value | Why |
|---|---|---|
| Allow new users to sign up | **OFF** | Invite-only. Nobody can register, ever. |
| Confirm email | OFF | Invites confirm the address by themselves. |

Set **Site URL** and **Redirect URLs** to wherever ATLAS is actually served, or
the links in invite and reset emails will point at the wrong place.

### 4. Invite the crew

Authentication → Users → **Add user → Send invitation**, with their real email.

They get an email, click it, land on ATLAS, and **choose their own password**.
You never pick or text anyone a password. That flow doubles as the reset path —
"forgot my password" on the sign-in screen sends the same kind of link.

To add a fourth person later, that's the whole process: one invitation.

---

## Running it

Locally:

```bash
python3 -m http.server 8920 --directory ~/RicsWebsite/atlas
```

Then <http://localhost:8920>.

Geolocation needs a **secure context** — `localhost` counts, a bare IP on your
LAN does not. On a phone it has to be served over HTTPS or **◎** will never get
a fix.

---

## Using it

A pin's sheet takes the bottom half of the screen and the map keeps the top
half, with the pin centred in the part you can still see — so the ground is in
front of you while you write about it. The sheet scrolls inside itself and
**save pin** is stuck to the bottom of it, so filling one in is something you go
down through rather than something that buries the map.

Getting that right is a camera setting rather than an offset: the map is given
bottom padding equal to the sheet, which moves the map's own idea of its centre
up into the visible half. The crosshair, the eased flight, and anything later
that asks the map where the middle is all follow from that one number instead of
each carrying its own correction.

Inside, it is groups rather than a list: **photos**, **whose land**, **notes**.
Every button sits under the heading that says what it is for, because the
question in the field is rarely "what does this button do" — it is "which of
these do I want", and that gets answered by what a button is *near*.

- **Press and hold the map** — the only way a pin is made, and there is no
  button for one, because a button would be a slower way of saying the same
  thing. Hold without dragging; drag and it is a pan, which is the whole
  distinction. 12px of drift is still a press, because nobody holds a phone
  still. Name and description are optional — drop it now, fill it in at home.
  While the map has nothing on it, it says so on screen: a gesture leaves no
  trace, so it gets told to you once, when you have nothing else to look at.
- **◎** — centres on you. Press and hold your own dot to pin where you stand.
- **what kind of place it is** — cliffs, caves, trails, tunnels, abandoned
  buildings, mountains, towers, other. Chosen on the pin, and it is what the
  pin's **colour** means: eight colours, each measured to stand clear of the
  halo drawn around it in both themes and to be unmistakable for any of the
  other seven at 28px on satellite imagery. `test/contrast.test.mjs` holds both
  of those.

  Colour used to say whose pin it was. It says what the place is now, because
  only one thing can be encoded in a colour and still be read at a glance, and
  on a shared map of finds the kind is what you are scanning for — who dropped
  it is written on the pin's own sheet and on every row of the list. Yellow
  still outranks everything: a pin that has not synced yet is not a place
  anyone else can go to.

  The `kind` column has been on the pins table since the first migration and
  nothing ever wrote to it, so this needed no migration. Deliberately **not** a
  check constraint: an unrecognised kind falls back to "other" in the app and
  still draws, lists and filters, where a constraint would turn a future rename
  into a write that fails on a phone in a canyon.
- **filtering** — the chips at the top of **☰ places** turn kinds on and off,
  and they filter the map as well as the list. Turning the last one off turns
  them all back on rather than leaving you a blank map with no way to read why.
  While a filter is on, ☰ carries a dot — a filtered-out pin should never look
  like a lost one.
- **your monogram** — opens settings. It used to sign you out on a single tap,
  which is a destructive action on the smallest target on screen behind a
  tooltip nobody reads on a phone.
- **☰ places** — the closest thing here to a feed, and it is built for the
  question it actually gets asked: somebody has handed you a place, do you want
  to go. So a row is a photo of it, one line of what it is, who found it, how
  many notes it has picked up since, and how far it is from you — rather than a
  name and a pair of coordinates. Nobody ever decided to drive somewhere
  because of its longitude.

  Sorted by the last thing that *happened*, not the day it was dropped: a note
  left on a two-year-old pin means somebody just went there, and that is news.
  Distance only appears once the app knows where you are — opening a list is
  not a reason to ask.
- **⤓** — save maps for offline (below).
- **⚙ settings** — you, colour, light and glass. Reachable from ⚙ or by tapping
  your own monogram.
  - **you** — the name the crew sees, which is the byline on every pin you drop
    and every note you leave. Until now it was whatever the invite trigger made
    of your email address, title-cased, with no way to change it. Your sign-in
    address and username are shown but not editable: the username is derived
    from the address and other rows point at it. Signing out is a labelled
    button here rather than a hidden consequence of tapping your own name.
  - **light** — day and night. Day is the default and it is not a preference:
    outdoors in bright sun a dark UI is a mirror, so everything is opaque
    white, near-black and heavy-weight. Night is for caves and dusk.
  - **colour** — five accents: ember, signal, moss, sky, plum. Each one is a
    hand-picked pair, one for day and one for night, rather than one hex with a
    "darker" computed off it at runtime — that is how a palette ends up with a
    pressed state nobody can see. All five are measured by
    `test/contrast.test.mjs`, in both themes.
  - **glass** — frosted panels, the map showing through the sheet and the
    buttons. **Off by default, and that is not timidity.** This is read at
    arm's length in direct sun, where a translucent panel washes out and takes
    its text with it, which is why every surface in here is opaque. The setting
    says as much in the app. It is pinned at 72% opacity, which is the level
    that keeps body text past 7:1 even over black satellite imagery at night —
    the test holds that number, and a device that cannot blur falls back to
    solid rather than to see-through.
- **add photo** — camera or library, one or several. Photos are shrunk to
  1600px on the phone before they go anywhere, which is small enough for cell
  data and still reads a rock face. Re-encoding strips EXIF on the way through,
  so the camera's embedded GPS never leaves the phone — the pin already knows
  where the place is, under a rule the database enforces. Tap a photo for full
  size. You can delete your own, and anything on a pin of yours.
- **notes** — the description is what the place *is*, written by whoever found
  it. A note is what happened when someone went: gate locked, wash dry, second
  entrance easier. Anyone can leave one on any pin, including someone else's.
  That is the point — the map gets better every time one of you goes out.
  Tap **✎** on one of yours to reword it. The note keeps the day it was
  written and says "edited" separately, because on a log of "gate was locked in
  March" the date is half the meaning.
- **a photo on a note** — **add photo** next to the note box attaches to what
  you are writing; **photo** on one of your existing notes adds to that one.
  They draw smaller than the pin's, under the line they belong to, and the
  difference is the whole point: a photo on the *pin* is what the place is —
  the entrance, the crack, the thing you are looking for. A photo on a *note*
  is what it looked like the day someone went, under a line that is dated and
  signed. A new lock on the gate belongs to that Tuesday. It is not a truth
  about the place, and filing it as one is how a map starts lying to you. A
  note's photos are the note author's, and they go when the note goes.
- **check who owns this land** — see below.
- **directions to this place** — hands the pin to Apple Maps or Google Maps.
- Green pins are yours. Orange pins are someone else's. Yellow means not synced
  yet. You can only edit and delete your own.

Base maps under **layers**: satellite (Esri), satellite + topo, USGS topo,
contour topo (OpenTopoMap), and street. Over the top of those, eight overlays in
four groups — place names, roads, trails, railways; terrain shading and water;
public land and property lines. All free, no keys, nationwide.

---

## Who owns it

The property-lines overlay draws the boundary. **check who owns this land** on a
pin answers
the question the boundary raises. Three sources, all free, all keyless, all
nationwide:

| | from | what it tells you |
|---|---|---|
| surface management | BLM's national SMA layer | BLM, forest, park, state, tribal, military, private |
| the legal description | BLM's PLSS cadastral survey | `NE¼NW¼ Sec. 23 T19N R44E`, and the meridian |
| county and state | US Census TIGERweb | which office to ask |

For most places worth pinning the first row **is** the answer — it is the one
that decides whether you can walk in. The second is the string every rural
assessor's office searches on, so it turns "who owns it" from a dead end into a
lookup you can actually do; there's a button to copy it. PLSS states only: Texas,
Hawai'i and the original colonies were never surveyed into a township grid, and
ATLAS says nothing there rather than inventing a description.

An answer is kept on the phone once you have asked for it, so a spot you looked
up at home still answers in the canyon.

### Putting a name to a private parcel

There is no free nationwide source for an owner's **name**. That has been checked
more than once and it is still true — names live with county assessors, and every
county publishes differently. Most of them publish through ArcGIS, though, so one
generic adapter covers a lot of them.

**look up the owner's name** does that for you, and it is the button to reach
for. It appears under the answer whenever ATLAS knows which county you are in
and has no adapter for it. It searches the public ArcGIS catalogue for that
county and for its state, then *asks each candidate about the point this pin is
on* — that last part is what makes it honest rather than clever. Nothing is
accepted on the strength of its name. A service is only offered once it has
answered about your ground.

It shows you what it found before it changes anything: which service, how many
parcels are in it, and what it just read off the ground under the pin. **yes,
use this** saves it, and from that moment the county answers instantly,
for everyone, and offline afterwards. **no, skip it** falls back to the form.

Two things it is deliberately careful about:

- **Statewide layers.** A dozen states run one parcel service better maintained
  than any of their counties', and a search naming the county will never find
  it. So the state is searched too.
- **Partial layers.** The nastiest wrong answer available is a real parcel layer
  from the right county, with a beautiful `OWNERNAME` column, that only contains
  the ninety-five lots the county itself owns — everywhere else it answers
  "nothing here", which reads exactly like the truth. So candidates are counted:
  a county's real parcel fabric has tens of thousands of rows, and coverage
  outranks having an owner column at all.

**layers → counties with owner names** is the same thing by hand, for a
county nothing is published for. A layer URL and the names of the fields holding
the owner, the parcel number, the address and the acreage. Find it by searching
"*&lt;county&gt; GIS REST services parcels*"; you want a single layer, so the URL
ends in a number. Optionally give it the county's parcel page with `{apn}` where
the number goes, and the answer gets a link straight through to it.

With no adapter at all the lookup still works — it just stops one step short, at
the legal description and a link to find that county's assessor.

**Those adapters live in the database, not in this repo, and that is deliberate.**
The repo is public. Which counties this crew looks parcels up in is location data,
and rule 1 says location data does not go in git. Same split as everything else
here: the code is the mechanism, the database holds the places.

PAD-US was tried for richer unit names and **rejected**: the public ArcGIS
service runs on a shared 60-requests-per-minute quota that other people have
already exhausted, so it answers `429` more often than not. A source that fails
most of the time is worse than one you never call.

---

## How it looks

Day is the default and it is not a preference. Outdoors in bright light a dark UI
is a mirror, thin type disappears and translucent panels wash out — so: opaque
white, near-black text, heavy weights, hard borders, big targets. Night mode is
for caves and dusk and is a deliberate choice.

That constraint rules out the usual route to looking professional (dark, glassy,
hairline, low contrast), so `styles.css` gets there the way an instrument does:
**nothing arbitrary**. Every size comes off one seven-step type scale, every gap
off one four-pixel rhythm, and radius, border weight and elevation are short
lists with names. What reads as amateur in an interface is almost never the
colours — it is fourteen text sizes between 11px and 17px, each one picked on the
day it was needed.

The pieces:

- **A box means you can press it.** That one rule decides every container in the
  file. Information gets type and a hairline, never a box. Before it, the pin
  sheet had a grey well holding white buttons beside an outlined card beside
  grey note cards — all at the same level, all saying "I am a thing" equally
  loudly, which is why it read as busy even after every label was fixed. Notes
  became a log separated by hairlines, and the ownership answer lost its box
  entirely. The one exception earns it: a discovered county is a
  proposal with two buttons in it, so it gets a wash and an accent edge.
- **A fill alone cannot mark a control here.** `--panel-2` on white is 1.05:1 —
  indoors it reads as a subtle grouping, in glare it is simply not there. So
  the pressable things keep a real border, and that is also why removing the
  boxes from everything else costs nothing outdoors.
- **Three line weights by meaning, not thickness.** `--edge` is where a surface
  meets the map and has to survive glare; `--rule` divides things inside a
  surface; `--hair` is a whisper.
- **Three inks.** Two of them stay past 7:1 on every surface. The third is for
  detail — a timestamp, a hostname — and never carries a value or a warning.
- **Words, not glyphs**, on anything you have to find in a hurry: a note's
  controls read `photo · edit · ✕`. The pencil went because nobody is sure what
  it means at arm's length, and it rendered a weight lighter than the ✕ beside
  it, so the row looked like three unrelated marks.
- **One focus ring**, keyboard-only, on everything.
- **44px minimum on anything you have to hit outdoors.**

`node test/contrast.test.mjs` enforces the floors.

---

## Offline

The places worth pinning have no signal, so none of this depends on having any.

**Before you go**, open **⤓ save maps for offline**, move the map over the area, pick a
detail level and download. Tiles land in a cache that survives app updates —
shipping a new version does not wipe your canyon. Rough is a big area cheaply;
good reads individual trees; max is slow and heavy. The estimate updates as you
move the map, so you can see the cost before committing.

**Out there**, with no signal:

- The app opens. The shell is cached.
- Downloaded areas draw. Anything you never downloaded shows as blank tiles
  rather than errors.
- Every pin the crew had last time you were online is still on the map, and so
  is every note on it — both are mirrored into IndexedDB.
- Photos you have opened are still there; photos you never opened are not. Tap
  **get all photos for offline** in ⤓ before you leave and it pulls the rest.
- **Finding yourself still works.** GPS is a radio receiver; it needs no network. New
  pins, notes, photos and edits all queue up and show yellow. A photo taken with
  no signal is written to the phone before anything else is attempted, so the
  only copy is never the one in flight.
- A badge counts what hasn't synced. Tap it to force a sync attempt.

**Back on signal**, the queue replays itself in order. Pin ids and timestamps are
generated on the phone, so a pin dropped Tuesday still says Tuesday when it syncs
on Thursday, and replaying twice cannot duplicate it.

The one thing that needs signal is the **first** sign-in. After that the session
persists.

### Installing it

Open the site on the phone and Add to Home Screen. It runs full-screen with no
browser chrome. On iOS that's Share → Add to Home Screen.

### Tests

```bash
node test/tiles.test.mjs
node test/photos.test.mjs
node test/owners.test.mjs
node test/contrast.test.mjs
```

The tile maths — which square of the planet gets downloaded. Worth having tested,
because the wrong answer only shows up somewhere with no signal.

And the ownership string-work, for the same reason: a legal description is
checked in a canyon, where nobody can tell a wrong one from a right one, and
pasting the wrong forty into an assessor's search returns somebody else's name
with no hint that it happened. Those tests also hold the line that private land
is never described as open, and that a source URL which isn't `https` is refused.

`owners.test.mjs` also covers going and finding a county: that a county's own
service outranks a republished national one, that the county-owned and
tax-delinquent layers get pushed below the full one they are named like, that
`OWNER_ADDRESS` is never read as an owner's name, and that the whole search runs
against a stubbed catalogue and picks the layer which answered about the pin
itself. No real county appears in that file — a fixture is still a list of the
places we look.

`contrast.test.mjs` guards the one rule the whole look is built on. It reads the
real tokens out of `styles.css` — not a copy of them — and measures every text
colour against every surface it can land on. Body and "dim" text must clear
**7:1**; the one tertiary tone allowed below that must still clear 4.5:1, and it
is only ever used for detail nobody has to read in the field. This is here
because that rule does not die in a redesign, it dies when somebody nudges a
grey one step lighter because it looked nicer on a desk at night. Nothing on
screen complains; the person checking a note at a gate in July finds out. One
token moved by that much fails the test with the number attached.

And the photo paths, which are not cosmetic: a photo's object name is
`{pin_id}/{uploader_id}/{photo_id}.jpg`, and the storage policies read the
permissions straight out of that shape. A path built wrong is either a photo the
database refuses or, worse, one it shouldn't have accepted.

---

## Security

`config.js` holds the publishable key, and that is correct — it's designed to sit
in public JavaScript. The actual lock is **row-level security** in Postgres: with
no valid session the database returns nothing to anyone.

The **service_role** key must never appear in this repo. It bypasses every
policy.

A **personal** pin is enforced in the SELECT policy, not in the interface — it is
never sent to anyone else, whatever they type into a network tab. Notes and
photos inherit that same rule through `public.can_see_pin()`, which is why they
gate on a function rather than each reimplementing the check. That function must
stay SECURITY INVOKER; marked DEFINER it would hand out exactly what it exists to
withhold.

The **pin-photos** bucket is private. Photos are read through short-lived signed
URLs, and an object's own name carries its permissions — the policies read the
pin and the uploader out of `{pin_id}/{uploader_id}/{photo_id}.jpg` rather than
out of `storage.objects.owner`, which has been renamed across storage releases.
A policy that silently stops matching is a policy that silently stops
protecting.

---

## Not built yet

- Owner **name** in a county that publishes no parcel service at all, or
  publishes one without names on it. Some counties genuinely do not put owner
  names online, and no amount of searching invents one — that is a shape of the
  problem, not a missing feature. What ATLAS can do is find whatever *is*
  published, in one tap, and say plainly what it got.
- A county's own parcel page (`{apn}` deep link) still has to be typed in by
  hand. The search finds the data service; it cannot find the public web page
  that goes with it.

Ruled out, on evidence, so they don't get re-proposed: Strava's heatmap (503s to
anyone unauthenticated, and their terms forbid republishing), AllTrails (no
public tiles at all), and real 3DEP lidar hillshade (no tile cache, only
per-request rendering, so it can never be saved for offline).
