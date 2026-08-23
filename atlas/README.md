# ATLAS

A private map for a crew of three. Pins carry a name, a description, photos, a
running log of notes, where you left the truck, and who dropped them and when.
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
LAN does not. On a phone it has to be served over HTTPS or the PIN HERE button
will never get a fix.

---

## Using it

A pin's sheet is groups, not a list: **photos**, **getting there**, **whose
land**, **notes**, and one bar stuck to the bottom holding **save**. Every
button sits under the heading that says what it is for, because the question
in the field is rarely "what does this button do" — it is "which of these do I
want", and that gets answered by what a button is *near*.

- **PIN HERE** — grabs a GPS fix and opens the sheet. Name and description are
  optional; save an untitled pin now, fill it in at home. That is the design.
- **Long-press the map** — drops a pin somewhere you are not standing.
- **◎** — centres on you.
- **☰** — every pin the crew has dropped, newest first.
- **⤓** — save maps for offline (below).
- **☀ / ☾** — day and night. Day is the default: outdoors in bright sun a dark
  UI is a mirror, so everything is opaque white, near-black and heavy-weight.
  Night is for caves and dusk.
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
- **parking** — a pin is the thing you came for, and it is usually not
  somewhere you can drive to. So a pin carries a second point: the pull-off, the
  gate, the wide spot on the forest road. Tap **use my location** standing at
  it, or **pick on the map** for a pull-off you can see on the imagery, and
  **directions to parking** hands *that* to Apple or Google Maps instead of sending
  you at a cave mouth up a hillside. The sheet shows how far out the pin is and
  the map draws a dashed line between the two. It is also the thing you want on
  the walk out in the dark. Saving is immediate — you set this with the truck
  door open, about to walk away from the phone.
- **check who owns this land** — see below.
- **directions to this place** — hands the pin itself to Apple Maps or Google
  Maps. It sits directly under **directions to parking** on purpose: side by
  side it is obvious that they are not interchangeable. One drives you to the
  pull-off; the other points at a cave up a hillside.
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
- **PIN HERE still works.** GPS is a radio receiver; it needs no network. New
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
