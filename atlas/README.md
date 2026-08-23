# ATLAS

A private map for a crew of three. Pins carry a name, a description, photos, a
running log of notes, and who dropped them and when. Anyone in the crew can add
one; everyone can find it again, which is the whole point — you can go to a cave
your brother found without your brother.

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

- **PIN HERE** — grabs a GPS fix and opens the sheet. Name and description are
  optional; save an untitled pin now, fill it in at home. That is the design.
- **Long-press the map** — drops a pin somewhere you are not standing.
- **◎** — centres on you.
- **☰** — every pin the crew has dropped, newest first.
- **⤓** — offline maps (below).
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
- **directions** — hands the pin to Apple Maps or Google Maps.
- Green pins are yours. Orange pins are someone else's. Yellow means not synced
  yet. You can only edit and delete your own.

Base maps under **layers**: satellite (Esri), satellite + topo, USGS topo,
contour topo (OpenTopoMap), and street. Over the top of those, eight overlays in
four groups — place names, roads, trails, railways; terrain shading and water;
public land and property lines. All free, no keys, nationwide.

---

## Offline

The places worth pinning have no signal, so none of this depends on having any.

**Before you go**, open **⤓ offline maps**, move the map over the area, pick a
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
```

The tile maths — which square of the planet gets downloaded. Worth having tested,
because the wrong answer only shows up somewhere with no signal.

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

- Owner lookup by parcel — no free nationwide source exists. Parcel boundaries
  and public land are already on the map; putting a *name* to a parcel means
  per-county assessor adapters, added as they're actually needed.
- Editing a note after you've left it. The policy allows it; there's no button.
- "Park here" second point on a pin (the column exists, nothing writes to it yet)

Ruled out, on evidence, so they don't get re-proposed: Strava's heatmap (503s to
anyone unauthenticated, and their terms forbid republishing), AllTrails (no
public tiles at all), and real 3DEP lidar hillshade (no tile cache, only
per-request rendering, so it can never be saved for offline).
