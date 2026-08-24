# ATLAS

A private map for three people. Pins carry a name, a description, photos, a
running log of notes, and who dropped them and when.
Any of them can add one; all of them can find it again, which is the whole
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

Nothing goes out until this is done, and that is the trap: Supabase's built-in
sender does **2 messages an hour** and delivers only to addresses belonging to
the project's own organisation — which is to say, to you. Invite your brother
without SMTP and the invitation goes nowhere and says nothing about it.

Resend is free at this scale (100 a day) and takes ten minutes.

**Verify a subdomain, not the domain.** `ricmassey.com` already has MX records
pointing at Namecheap's email forwarding; aiming those somewhere else would
quietly stop mail to `ric@ricmassey.com`. Resend's default —
`send.ricmassey.com` — puts its MX on a subdomain and leaves the forwarder
alone. Take the default.

1. resend.com → **Domains → Add Domain** → `send.ricmassey.com`.
2. It hands back three records — MX, SPF (TXT), DKIM (TXT). Add them at
   Namecheap under **Advanced DNS**, putting in the *host* field exactly what
   Resend gives (`send`, `resend._domainkey.send`, …) and not the full name;
   Namecheap appends the domain itself, and a host of `send.ricmassey.com`
   becomes `send.ricmassey.com.ricmassey.com`. Verification takes minutes.
3. **API Keys → Create**, sending permission only. It is shown once.
4. Supabase → Authentication → **Emails → SMTP Settings**:

   | Field | Value |
   |---|---|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | the API key |
   | Sender email | `atlas@send.ricmassey.com` |
   | Sender name | `ATLAS` |

   The sender has to be on the verified domain. It does not have to be a mailbox
   that exists — nobody replies to an invitation.
5. Authentication → **Rate Limits** → emails per hour: **2 → 30**. Turning SMTP
   on does not raise it for you.

The API key lives in the dashboard and nowhere else. `supabase config push`
overwrites live auth settings wholesale, so `[auth.email.smtp]` in `config.toml`
reads the key back out of `env(RESEND_API_KEY)`:

```bash
RESEND_API_KEY=re_... supabase config push
```

Push without it and SMTP is cleared — no error, just invitations that stop
arriving.

### 3. Lock the door

Authentication → Sign In / Providers → Email:

| Setting | Value | Why |
|---|---|---|
| Allow new users to sign up | **OFF** | Invite-only. Nobody can register, ever. |
| Confirm email | OFF | Invites confirm the address by themselves. |

Set **Site URL** and **Redirect URLs** to wherever ATLAS is actually served, or
the links in invite and reset emails will point at the wrong place.

### 4. Invite the others

Authentication → Users → **Add user → Send invitation**, with their real email.

They get an email, click it, land on ATLAS, and **choose their own password**.
You never pick or text anyone a password. That flow doubles as the reset path —
"forgot my password" on the sign-in screen sends the same kind of link.

Straight after the password they get the **first run** (below): what to call
them, what they look like, whether ATLAS may ask the phone where they are, and
the town the map should open on. Nothing on it is compulsory and all of it is
in settings afterwards.

To add a fourth person later, that's the whole process: one invitation.

---

## Running it

From anywhere in the terminal:

```bash
atlas
```

`map` does the same thing. It starts a server if one isn't already up and opens
the app; `atlas live` opens the deployed one at ricmassey.com instead, `atlas
stop` shuts the local server down, `atlas log` follows it.

The function is `atlas.zsh` in this directory, sourced from `~/.zshrc`. It
serves the **whole site repo** on 8912 rather than this folder on its own,
which matters more than it looks: in production the app is at `/atlas/`, and
`http://localhost:8912/atlas/` is the one local address in Supabase's redirect
allowlist. Serve this folder as a site root on some other port and every invite
and password-reset link bounces — which is exactly the flow you most want to
test locally.

Geolocation needs a **secure context** — `localhost` counts, a bare IP on your
LAN does not. That is why the server binds to 127.0.0.1 and doesn't offer
itself to the network: pointing a phone at your laptop's LAN address would only
produce an app that can never find you. Test on a phone against the live site.

---

## Using it

A pin's sheet takes the bottom half of the screen and the map keeps the top
half, with the pin centred in the part you can still see — so the ground is in
front of you while you write about it. The sheet scrolls inside itself and
**save** is stuck to the floor of it, so filling one in is something you go down
through rather than something that buries the map.

**Take the grip at the top of the sheet and it moves.** Up goes to full height,
which is what you want at home with a keyboard and eleven things to type; down
goes back to half, which is what you want standing at the gate; further down
closes it. It lands on one of those three, never between them.

Getting that right is a camera setting rather than an offset: the map is given
bottom padding equal to the sheet, which moves the map's own idea of its centre
up into the visible half. The crosshair, the eased flight, and anything later
that asks the map where the middle is all follow from that one number instead of
each carrying its own correction — and since the sheet now moves, that number is
one custom property, `--sheet-frac`, that the drag writes and the rest reads.

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
- **the crosshair button**, bottom left — centres on you, and its ring turns
  accent once the app has a fix. Press and hold your own dot to pin where you
  stand. It is only there while **use my location** is on.
- **use my location**, under **settings → my location** — off and ATLAS never asks
  the phone where you are: no blue dot, no crosshair button, no distances in the
  list, and no call made on boot or on a tap. This is a different switch from
  the browser's permission, and both of them exist for a reason: the permission
  answers "may this site ask", and this one answers "does ATLAS want to know".
  Having only the first is what makes people deny location forever rather than
  dig through Safari's settings to take it back.
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
- **filtering** — the kind chips in the foot of the search screen turn kinds on
  and off, and they filter the map as well as the list. Turning the last one off
  turns them all back on rather than leaving you a blank map with no way to read
  why. While a filter is on, the search bar carries a dot — a filtered-out pin
  should never look like a lost one.
- **your monogram** — opens settings. It used to sign you out on a single tap,
  which is a destructive action on the smallest target on screen behind a
  tooltip nobody reads on a phone.
- **the search bar**, along the bottom next to the crosshair — the way into
  everything the app can list. There is no separate list button any more,
  because the list of places and the results of an empty search are the same
  list. It is a button rather than a live field: a text box sitting on the map
  is a keyboard waiting to cover the map, and there is nothing to type into
  until you have said you want to search.

  Pressing it does not take you to a screen. The field moves to the top with a
  back arrow beside it, and the answers come up as a sheet from the bottom with
  the **map still live in between** — searching is nearly always about ground
  you can already see, so covering that ground in order to ask about it was
  backwards.

  The sheet takes the same grip as a pin's, and lands on the same kind of
  stops: **full** for reading a long list, **half** to start, and **peek** —
  pushed down out of the way, which is what you want the moment a result makes
  you look at the map. Taking hold of the grip also puts the keyboard away,
  because a push downwards is a request to see the ground and answering half of
  it is worse than not answering. Shove it well past peek and the search closes
  altogether; the arrow in the corner does the same thing on purpose rather
  than by accident.

  With nothing typed it is the old feed, and it is built for the question it
  actually gets asked: somebody has handed you a place, do you want to go. So a
  row is a photo of it, one line of what it is, who found it, how many notes it
  has picked up since, and how far it is from you — rather than a name and a
  pair of coordinates. Nobody ever decided to drive somewhere because of its
  longitude. Sorted by the last thing that *happened*, not the day it was
  dropped: a note left on a two-year-old pin means somebody just went there, and
  that is news.

  Type, and it is **two questions in one box**, kept apart on purpose. Your own
  pins are already on the phone, so they are searched on every keystroke, for
  free, in a canyon: name, description, kind, who dropped it, and the words in
  every note. A name match outranks a note match at every grade, every word you
  type has to land somewhere (two words narrow, they never widen), and when a
  note is the only reason a pin is in the list, that note is quoted back — or a
  search for "locked" returns a list of names with nothing to do with it.

  Everywhere else — towns, creeks, peaks, forest roads, wilderness areas — is
  **Nominatim**, the same OpenStreetMap data the street base map and the trail
  overlay are drawn from, so a road you find is a road you can see underneath.
  It costs a request over cell data, so it waits for you to stop typing and for
  there to be a real word to ask about, one request a second at most, and the
  request in flight is aborted the moment the query moves on. Every state says
  which it is: "no signal", "could not reach the index" and "nothing by that
  name" are three different answers that all look like an empty list.

  **Where you are asking** is three chips under *areas & roads*, because the
  three questions are genuinely different and nothing in the words you type
  tells them apart:

  - **near me** fences the search to a 160 km box around you. This is the
    default and it is what makes a brand name work at all: unbounded, `rei`
    comes back as a town in Brazil, one in Catalonia and a peak in Japan —
    every one of them a better "place named Rei" than a shop. Fenced, there
    are no such towns to beat the shops, so the shops are the answer. If it
    finds nothing it asks the world instead, and says so.
  - **in this view** fences it to the piece of ground on screen. Pan over a
    canyon, search "spring", get the springs in that canyon. Nothing there is
    nothing there — this one does not widen, or the control would be doing
    nothing.
  - **anywhere** is the whole index, for the trip you have not taken yet.

  Results are ranked by importance *plus* how close they are, capped so a
  national park still outranks a hardware store in the next town but two shops
  of equal standing are decided by distance — which is the case where distance
  is the whole question. The same object listed three times by the index (a
  building, its entrance, its address point) is listed once. An area is flown to
  as a box and a point as a point: a wilderness area framed as a point drops you
  in the middle of it at street zoom with no idea how big it is.

  What the map found stands on it with its name beside it until you look for
  something else or tap it away. Deliberately not a pin — a pin is somewhere the
  one of you has been and written up.

  Distances appear once the app knows where to measure from, which is your own
  position, or your home town, or failing both the middle of the map. The near
  chip is named after whichever it got — "near me" is a promise the app cannot
  keep with location switched off. `test/search.test.mjs` holds the ranking and
  the bounding-box conversion, which are the two things in here that go wrong
  without throwing.
- **save maps for offline** — at the bottom of **layers** (below).
- **settings** — you, my location, home, colour, light and glass. Reachable
  from the sliders button or by tapping your own monogram.
  - **the first run** — the first time a phone signs in, settings *is* the
    screen: it opens itself, wearing the word **welcome**, with everything but
    what is worth setting at the start hidden and no close button — there is
    nothing to escape from, and the button on the floor is the way on.

    It is this panel rather than a wizard of its own for three reasons. Every
    control on it is one you will want to change later, and the room you will
    have to find to change it is this one, so you have already been. A wizard
    would be a second name field and a second avatar picker that can drift out
    of step with the real ones. And a wizard has to be *finished*, where this
    can be walked out of at any point with nothing set.

    What it is really for is the location question. ATLAS asks the phone where
    you are unless told not to, and the honest moment to say that it is
    optional — and to make saying no one tap — is *before* the browser's own
    permission box appears, not after. So while this screen is up the map does
    not call for a fix and the opening camera waits; the button at the bottom
    releases it, which means the map immediately opens the way the choice just
    made says it should. That is the shortest possible proof it took.

    Nobody reads a paragraph standing up with a car door open, so the screen
    is a five-second read: a heading and a control at a time — your face and
    your name, location, home town, accent colour — and one line saying
    location is optional. Settings keeps its full prose — the first run hides
    those hints and shows a short version, which is why the copy only exists
    once. The save button under the name is hidden too, because walking out of
    the door saves it, and if it cannot be saved the door stays shut with the
    reason on screen.

    Shown once per phone, and only to a phone that has never been used: a
    device with a last map position on it has been here before, whatever the
    flag says, and nobody who has been dropping pins for a month should be
    handed a welcome screen.
  - **you** — your picture and the name everybody else sees, which together are the
    byline on every pin you drop and every note you leave.

    A face turns up in five places: your own button in the top bar, the corner
    of the picture of the place on every row of **places**, the line that says
    who dropped a pin, and the top of every note. Anyone who has not set one
    gets their initial on the accent colour, and so does everybody, offline,
    before a face has been downloaded — the monogram is the answer, not a grey
    circle waiting for something.

    Pictures are **square, cropped from the middle** rather than letterboxed,
    because they are drawn in a circle everywhere and a 16:9 photo fitted into a
    circle is a horizontal slice of somebody's chin. 256px, re-encoded on the
    phone like every other photo here, which strips the EXIF and lands at about
    7 KB. All three are pulled down at sign-in so the bylines still have faces
    in a canyon.

    Stored in a second private bucket, `avatars`, the same shape as pin photos
    and for the same reasons — the object name `{user_id}/{avatar_id}.jpg` *is*
    the permission model, read by the storage policies through
    `public.uuid_segment()`. The one difference is who may look: a face is not
    filed under a pin, so anybody signed in reads any avatar. That is
    the point of it.

    The avatar id is minted fresh for every picture rather than the object being
    written over, which makes the path its own cache key — a phone holding the
    old face cannot draw it under the new name, and there is no version number
    for anything to get wrong. The cost of that is old objects, so setting or
    removing a picture deletes the one it replaces, and every phone drops cached
    faces nobody wears any more on the next sign-in.

    Faces are looked up **by id at the moment of drawing**, from one mirrored
    copy of `profiles`, rather than joined into `pins_with_author` and
    `pin_notes_with_author` and every view added after them. That is not just
    less plumbing, it is the right answer: a name belongs to the row it was
    written with — a note says who wrote it, that day, and stays true if they
    are renamed — but a face is whoever that person is *right now*.

    Neither the name nor the picture is queued for later the way a pin is: both
    change what everybody else sees, so they either reach the server or they
    have not happened. The app says "this one needs signal" rather than
    pretending. Until now it was whatever the invite trigger made
    of your email address, title-cased, with no way to change it. Your sign-in
    address and username are shown but not editable: the username is derived
    from the address and other rows point at it. Signing out is a labelled
    button here rather than a hidden consequence of tapping your own name.
  - **home** — one town, named once, doing two jobs. It is where the map opens
    when the phone will not say where you are: off on the sofa, off indoors, off
    before the fix comes in, off for anybody who would rather not be asked. A
    map that opens on the middle of the country is a map you fly out of every
    morning. And it is what "near me" measures from with location off, which is
    the difference between a brand-name search working and returning a town in
    Brazil.

    Your own position always wins when there is one, so naming a town costs you
    nothing. The order is a confidence ranking rather than a preference: being
    told where you are beats a town you typed in once, which beats wherever the
    map happens to be pointing — that could be somewhere you were only looking
    at. Everything that shows a distance says which of the three it measured
    from, because a list in distance order is a lie if it does not say distance
    from what.

    Looked up in the same index as everything else, and it is the one search in
    the app that is *not* biased by where you are standing — you might be
    setting it from a hotel three states away, and "which Springfield" is
    exactly the question the index's own ranking answers. A town is opened as a
    town: its bounding box, capped so a county-sized boundary cannot pull you
    out to nothing and a single node cannot drop you into four blocks of it.
    Picking one deliberately does not fly the map there — you could be standing
    at a gate with a live fix, and a settings screen that throws the map three
    counties away while you are using it is a setting you would not touch twice.
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
  Tap **edit** on one of yours to reword it. The note keeps the day it was
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
- A pin's **colour is what kind of place it is** — eight kinds, eight measured
  colours. Yellow outranks all of them and means not synced yet. A hollow pin
  is a personal one. The pin whose sheet is open stands up out of the others
  with a ring under it. You can only edit and delete your own.

**Settings follow the person, not the phone.** The base map, the overlays, the
theme and accent, the kind filter, the search scope and your home town live on
your profile row in `prefs`, and the server's copy wins the moment it lands —
change the base map on the laptop and the phone has it next time it opens.
Local storage still gets written first and is what the app reads on the way up,
so none of this needs signal. What stays on the device is what is true of the
device: whether it may ask for your location, where it last had the map, and
what it has downloaded.

The same column pair is why **the first-run setup happens once per person, not
once per phone**. `setup_done` is on the profile. Sign in on a second device and
you get the map you already set up, not a welcome screen.

Base maps under **layers**: satellite (Esri), satellite + topo, USGS topo,
contour topo (OpenTopoMap), and street. Over the top of those, eight overlays in
four groups — place names, roads, trails, railways; terrain shading and water;
public land and property lines. All free, no keys, nationwide.

**State and county lines** are two switches off one Census service, which
publishes each boundary at half a dozen generalisations and picks the right one
for the scale — a clean line at state zoom, the real jagged river up close.

They are the one pair that cannot be *saved ahead* for offline. The service has
no tile cache, so instead of asking for a tile it is handed the bounding box of
the screen and asked to draw it, and the bulk downloader has nothing to put in
a box. It does still cache like anything else once you have looked at it — the
bounding box is worked out from the tile, so the same tile always produces the
same URL — which is also why `tigerweb.geo.census.gov` has to be in the service
worker's TILE_HOSTS. Left out of that list it falls through to the app-shell
cache and gets answered from there until the next deploy.

**The overlays only add.** Four of the five base maps have roads and place names
painted into their own tiles — everything except satellite — so turning *roads*
off while you are on the topo map does nothing you can see, and the switch
spends the rest of the day looking broken. It isn't: it owns one layer and that
layer is off. Satellite is the only base map that is bare ground. The switches
say which one you are on rather than leaving you to work it out on a mountain.

**How far in it is worth zooming.** Satellite + topo goes soft three zoom
levels before plain satellite does, and that is not imagination: it is a
different USGS product that fuses the contours into the imagery and stops the
whole thing at z16, 404ing above it.

It was briefly made to fade out past 16 and let plain satellite through. That
fixed the sharpness by deleting the map — at the zoom you actually use it,
"satellite + topo" became satellite. The two base maps mean opposite things:
one is bare ground and one has the information drawn on, and a map that quietly
turns into the other one is worse than a soft map. It stays itself now and
stops where its tiles stop; the card says so, and says what to do instead —
satellite, with whichever overlays you actually wanted. Every free transparent
contour service was checked for a deeper one and none of them goes past 16
either, so there is no third option to find.

Everywhere else, Esri's imagery is the deepest free nationwide picture there is
and it stops at z19 — past that the map is
enlarging the last real tile it has, which is why it goes soft. Asking Esri for
z20 over the Ozarks does not return a sharper picture; it returns a grey square
reading "Map data not yet available", which is why the cap is where it is. The
USGS maps stop harder still, at z16, and 404 above it. Those numbers are
measured against the live services, not copied off a wiki.

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
The repo is public. Which counties get parcels looked up in is location data,
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

That constraint rules out the usual route to looking current (dark, glassy,
hairline, low contrast) — every one of those is a legibility budget being spent
on a screenshot. So `styles.css` gets there the way an instrument does:
**nothing arbitrary**. Every size comes off one seven-step type scale, every gap
off one four-pixel rhythm, and radius, border weight and elevation are short
lists with names. What reads as amateur in an interface is almost never the
colours — it is fourteen text sizes between 11px and 17px, each one picked on the
day it was needed.

What does the rest of the work is the other four:

- **Icons.** One sprite at the top of `index.html`, one 24px grid, one stroke
  weight, all in `currentColor`, so an icon inherits the colour and the state of
  whatever it sits in. Markup built in JS goes through `icon()` in `app.js` and
  draws from the same set. The single loudest amateur tell in an interface is
  `☰ ⚙ ◎ ✕` borrowed out of the system font: four weights, four sizes, four
  vertical alignments, none of them yours — and none of them themeable.
- **Motion.** Two curves and three durations and that is the whole vocabulary:
  `--ease` for surfaces arriving and leaving, `--spring` — which overshoots
  slightly — only ever for something you touched, so the overshoot reads as the
  thing answering rather than as the layout being loose. Panels animate out as
  well as in, which is why they close through `closePanel()` rather than by
  having `hidden` set on them. One `prefers-reduced-motion` block at the end of
  the stylesheet switches all of it off.
- **Controls that are the shape of what they do.** A thing with two states is a
  switch. A choice of one out of three is a segmented control. A choice of a map
  is a picture of that map. All of them are still the same `<input>` underneath
  — the label still toggles it, the keyboard still finds it, and the JS still
  reads `.checked` — so nothing about the wiring changed.
- **Shape.** Radii off one list with a top end on it, and a four-step elevation
  ladder tinted with the ink rather than pure black, each step a tight contact
  shadow plus a wide soft one. A single blurred black `box-shadow` is what depth
  looks like when the answer to it was one number.

The rest:

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
- **Words, not glyphs**, on anything you have to find in a hurry — and that
  survived getting a drawn icon set: a note's controls still read
  `photo · edit · ✕`, because a pencil is not obvious at arm's length in the sun.
  Closing is the one pictogram everybody already knows.
- **One focus ring**, keyboard-only, on everything.
- **44px minimum on anything you have to hit outdoors.**

- **No `<fieldset>`.** A `<legend>` is rendered into the box's own border, so it
  cuts a hole in any rule drawn there and cannot be moved off it without a float
  — and a float pushes the grid rows under it sideways off the screen. The
  groups are plain sections with a heading; the three that are a choice of one
  carry `role="radiogroup"`, which is what the fieldset was really for.

`node test/contrast.test.mjs` enforces the floors.

---

## Offline

The places worth pinning have no signal, so none of this depends on having any.

**Before you go**, open **save maps for offline** at the bottom of **layers**, move the map over the area, pick a
detail level and download. Tiles land in a cache that survives app updates —
shipping a new version does not wipe your canyon. Rough is a big area cheaply;
good reads individual trees; max is slow and heavy. The estimate updates as you
move the map, so you can see the cost before committing.

**Out there**, with no signal:

- The app opens. The shell is cached.
- Downloaded areas draw. Anything you never downloaded shows as blank tiles
  rather than errors.
- Every pin there was last time you were online is still on the map, and so
  is every note on it — both are mirrored into IndexedDB.
- Photos you have opened are still there; photos you never opened are not. Tap
  **download all photos** in offline maps before you leave and it pulls the rest.
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
node test/search.test.mjs
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

`search.test.mjs` covers the two things in the search that go wrong quietly and
never throw. A ranking that puts the wrong pin first just looks like search not
working, and there is no way to tell by looking whether it is the scorer or the
data — so the weights are held to the rule they exist for: a name match at any
grade beats a note match at every grade. And Nominatim hands a bounding box back
as `[south, north, west, east]` while MapLibre wants `[[west, south], [east,
north]]` — the same four numbers in a different order with the pairs swapped,
which is exactly the kind of thing that survives a glance and then flies the map
somewhere confidently wrong. It also holds that the near box is square on the
ground rather than square in degrees, that each scope says which question it is
asking in the URL it builds, and that a home saved from a row with a missing
latitude comes back as *no home* rather than as 0,0 in the Gulf of Guinea.

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
