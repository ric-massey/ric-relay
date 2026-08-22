# ATLAS

A private map for a crew of three. Pins carry a name, a description, who dropped
them and when. Anyone in the crew can add one; everyone can find it again, which
is the whole point — you can go to a cave your brother found without your brother.

Lives entirely separate from the public website. No coordinates ever touch that repo.

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
python3 -m http.server 8920 --directory ~/Atlas
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
- **directions** — hands the pin to Apple Maps or Google Maps.
- Green pins are yours. Orange pins are someone else's. Yellow means not synced
  yet. You can only edit and delete your own.

Base maps: satellite (Esri), USGS topo, and OpenStreetMap. All free, no keys.

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
- Every pin the crew had last time you were online is still on the map — they
  are mirrored into IndexedDB.
- **PIN HERE still works.** GPS is a radio receiver; it needs no network. New
  pins and edits queue up and show yellow.
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
```

Covers the tile maths — which square of the planet gets downloaded. Worth having
tested, because the wrong answer only shows up somewhere with no signal.

---

## Security

`config.js` holds the publishable key, and that is correct — it's designed to sit
in public JavaScript. The actual lock is **row-level security** in Postgres: with
no valid session the database returns nothing to anyone.

The **service_role** key must never appear in this repo. It bypasses every
policy.

---

## Not built yet

- Photos on pins (Cloudflare R2)
- Layer toggles: lidar hillshade, trails, parcel boundaries, public land
- Owner lookup by parcel
- "Park here" second point on a pin (the column exists, nothing writes to it yet)
