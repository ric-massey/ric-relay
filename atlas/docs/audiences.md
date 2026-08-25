# Audiences — groups, connections, and chat

**Status: design, not built** — with one exception, below. It is here so the
argument gets settled before the migrations do, because every mistake in the
audience model becomes two mistakes once chat can move pins around.

**Built so far:** usernames are chosen rather than cut off the front of an email
address — `20260825150000_usernames_are_chosen.sql`, the `public.usernames`
table, `set_username()`, and the settings field that drives it. That one had to
go first: it was leaking half of everybody's sign-in address onto every byline,
and it gets harder to fix with every account that joins. Everything else in this
file is still an argument.

---

## What changes, and why it is a different app

ATLAS today is three people who see everything. One boolean, `pins.is_private`,
is the only exception, and the README says the quiet part out loud: *you can go
to a cave your brother found without your brother.*

The target is hundreds of people, each with their own named groups, each pin
visible only to the people its finder chose. That is not a bigger version of the
same app. "The crew" stops existing as a thing — the word is in the schema
comments, the policy names, the README and the interface copy, and all of it has
to go. What replaces it is a network of overlapping private circles that never
touch unless somebody deliberately makes them.

Two functions currently bake in the old assumption and both have to be rewritten:

| Where | Today | Has to become |
|---|---|---|
| [`loadPins()`](../app.js) | fetches **every pin**, mirrors the lot to IndexedDB | fetches what the audience check returns, which is now a small set per person |
| [`loadPeople()`](../app.js) | fetches **every profile** on launch | your connections, plus whoever shares an audience with you |

The good news is structural. Every privacy decision in ATLAS already funnels
through one function — `can_see_pin(pin_id)` — and notes, photos, the storage
bucket's read policy and parking pins all gate on it. Widening the definition of
"who can see this" means rewriting **that one function** and the pins SELECT
policy. Everything downstream follows for free, without being touched.

That is the whole reason this is affordable. Protect it: nothing new may
reimplement the check.

---

## The three tiers

The design collapses if these get conflated, so they are named once here and
used consistently everywhere below.

### 1. Stranger

Reachable only by **exact username** — never by name, never by email address.
The lookup gets you display name and avatar, enough to confirm you found the
right person, and nothing more. See [Finding people](#finding-people).

### 2. Co-visible

You are both on a pin's audience. You see each other **on that pin** — name and
face — so you know who you can talk about it with. It unlocks nothing else.
Seeing "Alice can see this too" does not get you to Alice's pins, Alice's
profile, or Alice.

### 3. Connected

A mutual, deliberate friendship. Unlocks the profile, and is the **prerequisite
for group membership**.

### Why connection has to gate group membership

Being on an audience list is a form of exposure: your name and face shown to
people you have never heard of. If anyone who knows your handle can drop you
into a group, then any stranger can put you in front of other strangers without
asking.

Requiring a mutual connection first means: **you can only ever be shown to
people via someone you agreed to be reachable by.** That is the guarantee. It is
one sentence long, which is how you know it is the right one.

### Why trust must not be transitive

You put Alice and Bob in a group. *You* know both of them. They may have never
met. Bob does **not** get Alice's profile because you grouped them — if he did,
you would be introducing people to each other by accident, at scale, forever.

The vouching runs through the pin's owner and stops there. Alice and Bob are
co-visible (tier 2), never connected (tier 3), unless they do it themselves.

---

## The audience is not the group

This is the resolution to "I want to see who can see this pin" and "nobody can
see my groups," which sound contradictory and are not.

> **The group is your private tool. The audience is a public fact about the pin.**

Your group's name, its existence, and the fact that these particular seven
people are grouped together in your head — nobody ever sees any of that. But the
pin says plainly: *these seven people can see this.* Faces, names, tap to
expand. **The same list for everyone who can see the pin, owner or not.**

Showing it is safer than hiding it. If I can see your pin I need to know who
else can, because that is how I know who I can mention it to. The leak was never
going to be the database; it was going to be somebody saying the wrong thing in
the truck.

It also solves a problem that does not exist at three people and bites hard at
hundreds: **contributed content travels with a pin its owner controls.** Alice
puts a photo on your pin when nine people can see it; you later add a group and
forty can. Alice never agreed to that. Because the audience is visible, she can
at least see how far her photo reaches — and widening an audience should be a
deliberate, visible act in the interface, never a side effect.

---

## Tables

### Connections

Mutual, one row per pair, canonical order so the pair cannot be stored twice.

```sql
create table public.connections (
  a          uuid not null references auth.users on delete cascade,
  b          uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);

create table public.connection_requests (
  from_id    uuid not null references auth.users on delete cascade,
  to_id      uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
```

**Neither table is written by the client.** Sending is an RPC that takes a
*username*, resolves it, and inserts — never a `to_id` from the caller, because
an id you saw on somebody's pin must not become a way to contact them; see
[The id identifies](#the-id-identifies-it-never-authorizes). Accepting is an RPC
that verifies `auth.uid() = to_id`, inserts the connection and deletes the
request in one transaction — two round trips would leave a window where the
request is gone and the connection is not.

### Groups

```sql
create table public.groups (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (owner, name)
);

create table public.group_members (
  group_id uuid not null references public.groups on delete cascade,
  user_id  uuid not null references auth.users on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id, group_id);
```

RLS on both: **the owner, and nobody else, for every operation including
SELECT.** A member cannot read the row that says they are a member. That is the
requirement — groups are unlisted — and it creates exactly one problem, solved
in the next section.

### Audience

A pin's audience is a union of grants: any number of groups, plus any number of
named individuals. One table, with a check that a row is exactly one of the two.

```sql
create table public.pin_audience (
  pin_id   uuid not null references public.pins  on delete cascade,
  group_id uuid          references public.groups on delete cascade,
  user_id  uuid          references auth.users    on delete cascade,
  granted_at timestamptz not null default now(),
  check (num_nonnulls(group_id, user_id) = 1)
);

create unique index pin_audience_group_uniq
  on public.pin_audience (pin_id, group_id) where group_id is not null;
create unique index pin_audience_user_uniq
  on public.pin_audience (pin_id, user_id)  where user_id is not null;
create index pin_audience_pin_idx on public.pin_audience (pin_id);
```

**No rows means nobody but you.** There is no enum, no `visibility` column and
no `is_private` boolean — the absence of a grant *is* privacy, which means the
default state of a brand-new row is closed and cannot be got wrong.

Note what the two `on delete cascade`s buy: deleting a group, or an account,
silently **narrows** every pin that referenced it. Failing closed is not extra
code here, it is the foreign key doing its job.

---

## The read check

### `my_groups()` — the one justified SECURITY DEFINER

Group membership is unreadable even to the member, so a reader cannot ask "am I
in this group?" through RLS. This function answers it and nothing else:

```sql
create or replace function public.my_groups()
returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(group_id), '{}')
    from public.group_members where user_id = auth.uid();
$$;
```

**The rule for DEFINER in this codebase**, which the README half-states already
and should state fully:

> A SECURITY DEFINER function may return only facts about the caller, or facts
> it has itself authorized. `my_groups()` takes no parameters, so there is
> nothing to point it at somebody else — it can only ever describe you.
> `can_see_pin(pin_id)` takes an id and performs no check of its own; it **is**
> the check, and marked DEFINER it would hand out exactly what it exists to
> withhold. That one stays INVOKER, permanently.

### `can_see_pin()`, rewritten

```sql
create or replace function public.can_see_pin(p_id uuid)
returns boolean
language sql stable
set search_path = public as $$
  with target as (
    -- A parking spot resolves to the pin it serves. Its visibility IS the
    -- parent's, computed rather than copied, so the two can never diverge.
    select coalesce(p.parent_id, p.id) as id, p.created_by from public.pins p
     where p.id = p_id
  )
  select exists (select 1 from target where created_by = auth.uid())
      or exists (
        select 1 from public.pin_audience a, target t
         where a.pin_id = t.id
           and (a.user_id = auth.uid()
                or a.group_id = any ((select public.my_groups())))
      );
$$;
```

Two things worth not losing:

**`(select public.my_groups())`, parenthesised.** That forces Postgres to
evaluate it once as an InitPlan instead of once per row. Written bare it is a
function call for every pin in the query and the map gets slow at exactly the
size this whole design exists for.

**Children resolve through `parent_id` rather than copying.** This deletes
`pins_privacy_cascades()` and the privacy half of
`pins_child_follows_parent()` — see
[`20260824180000_parking_is_a_pin.sql`](../supabase/migrations/20260824180000_parking_is_a_pin.sql).
Nothing to keep in sync is strictly better than a trigger that keeps it in sync.
The ownership half of that trigger stays.

### The recursion trap

`pin_audience` needs RLS. The obvious policy — "readable by anyone who can see
the pin" — calls `can_see_pin`, which reads `pin_audience`, which calls the
policy. Postgres will not save you from this.

The way out is that the **policy** answers only about your own grants, and never
calls `can_see_pin`:

```sql
create policy "your own grant, and your own pins" on public.pin_audience
  for select to authenticated using (
    user_id = auth.uid()
    or group_id = any ((select public.my_groups()))
    or exists (select 1 from public.pins p
                where p.id = pin_id and p.created_by = auth.uid())
  );
```

That is enough for `can_see_pin` to work, and it is not enough to draw the
audience list. The list comes from a separate function that gates first and
returns profile-lite fields only:

```sql
-- SECURITY DEFINER, legitimately: it authorizes before it answers, and it
-- returns people — never group ids, never group names.
create or replace function public.pin_audience_people(p_id uuid)
returns table (id uuid, username text, display_name text, avatar_path text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_see_pin(p_id) then return; end if;
  return query
    select distinct pr.id, pr.username, pr.display_name, pr.avatar_path
      from public.profiles pr
     where pr.id = (select created_by from public.pins where id = p_id)
        or pr.id in (
             select a.user_id from public.pin_audience a where a.pin_id = p_id
              and a.user_id is not null
             union
             select gm.user_id from public.pin_audience a
               join public.group_members gm on gm.group_id = a.group_id
              where a.pin_id = p_id
           );
end;
$$;
```

Deduped, and it never says which group anybody came from. Two of your groups
both containing Alice produce one Alice.

### Everything downstream is unchanged

`pin_notes`, `pin_photos`, `pin_note_photos` and the `pin-photos` storage
policies all gate on `can_see_pin`. They do not get touched. That is the payoff
for having had one chokepoint.

---

## Finding people

There is exactly one way to find somebody: **their exact username.** Not their
name, and not their email address.

No display-name search, no prefix matching, no fuzzy match, no "people you may
know," and no result that is a *list*. A search that takes a real name and hands
back people is the thing that makes Instagram browsable, and it is the single
feature that would turn this app into that one.

### The lookup

At most one row, exact match, through a narrow SECURITY DEFINER function
returning username, display name and avatar. Nothing else, ever.

That is safe to answer because a username exists **only inside ATLAS**.
Confirming one exists tells an outsider nothing they did not already bring with
them — and you need the card to check you have the right person before you send
a request, because sending it is what puts your name in front of them.

### Why there is no search by email

An email address exists out in the world and is frequently guessable —
`firstname.lastname@gmail.com`. A lookup that answered them would be an oracle:
anybody could test addresses and learn **which of the people they know are on
this app**, about people who never agreed to be findable.

You can still reach somebody at an address. That gesture is called an
**invite**, it lives in the mail flow, and it is not a search: it queries
nothing and reports nothing back. You type an address, mail goes to it, and you
learn absolutely nothing unless a person chooses to turn up. Whether there was
already an account there is not something the app will tell you.

So there is one email path and one username path, and they do different jobs —
the invite brings a stranger *in*, the username lookup finds somebody already
here. Cap pending outbound requests and invites per account; it is a count check
in the same function, it is the only abuse either one opens, and there is no
server to rate-limit with later.

### The username is a handshake, not an identity

Nothing in this design is keyed on a username. Every relationship — connections,
group membership, pin audiences, thread members, who dropped a pin, who wrote a
note — references `uuid references auth.users`, and the username is rendered at
draw time from whatever the person is called *now*.

That is what makes the name safe to change: **your friends hold you by id, so
renaming loses nobody.** The username has exactly one job, and it is the first
handshake — the string you type to find somebody you have not met yet. After
that first moment it is presentation, permanently.

### The id identifies. It never authorizes.

The uuid cannot be hidden and does not need to be. The app needs a stable key to
hang an avatar off a byline and to draw an audience list, and a v4 uuid is not
guessable, so exposing one discloses nothing.

What matters is that it is **inert**: it is never an input, and seeing one never
lets you do anything to the person it belongs to.

That rules out one thing directly. `connection_requests.to_id` is a uuid, and if
the client were allowed to insert rows itself, then anybody who had seen your id
by being **co-visible with you on a pin** could send you a request without ever
knowing your username — which turns tier 2 into a contact channel, exactly what
it must never be.

So requests go through an RPC that takes a **username**, resolves it server-side
and inserts the row. The client never writes `connection_requests` directly, and
there is no route from an id you happened to see to an action against a person.

### Usernames are chosen, and changeable

**Chosen at signup — done.** `handle_new_user()` used to set
`username = split_part(new.email, '@', 1)`, and `display_name` to the same thing
title-cased. It **published the local part of your email address** to anybody who
could see your name on a pin, and it made guessing a username and guessing an
email the same attack, which defeated this whole section through the back door.

An account now arrives with an opaque placeholder off its own user id, and the
person picks a real name in settings. Everybody who predates the migration is
flagged `must_choose_username` and asked. See
[`20260825150000_usernames_are_chosen.sql`](../supabase/migrations/20260825150000_usernames_are_chosen.sql).

**Changeable afterwards**, with two rules:

1. **Old usernames are retired permanently and are never reassignable.** You
   release `ric`, a stranger claims `ric`, and everybody who was told "add ric"
   adds a stranger instead — and adding is what exposes you to their circles.
   That is not a cosmetic problem, so a name never comes back on the market.
2. **A retired username resolves to nothing.** Not to its old owner, not to
   anybody. The lookup says no such user, because the only thing a username was
   ever for was the first handshake, and everybody who already shook your hand
   holds you by id. The name dies with the change.

Rule 2 is what makes a rename a real escape: somebody who only ever had your
handle loses you, deliberately. It is a blunt substitute for blocking, but it is
a real one, which is why blocking is a gap and not a hole.

**Rate-limited anyway — one change a month or so.** Not for stability; nothing
depends on the string. Every rename permanently burns a name out of a shared
namespace, so the limit is there to stop one account hoarding a hundred of them.

```sql
-- Every username anybody has ever worn, current ones included. The claim check
-- runs against this table rather than profiles.username, which is why a name can
-- never come back once it has been let go.
create table public.usernames (
  username   text primary key,
  user_id    uuid references auth.users on delete cascade,  -- NULL = reserved
  claimed_at timestamptz not null default now(),
  retired_at timestamptz          -- null while it is the one in use
);

create unique index usernames_current_uniq
  on public.usernames (user_id) where retired_at is null;
```

The lookup matches only rows where `retired_at is null`. Retired rows exist to
refuse a claim, and for nothing else — they are never read on the way to a
person. A row with a NULL `user_id` is a reserved word — `admin`, `atlas`,
`support` — held by nobody and claimable by nobody, which falls out of the same
check for free.

The table has row-level security on and **no SELECT policy at all**, so nothing
reads it directly; `set_username()` is SECURITY DEFINER and is the only door.
`profiles.username` is a denormalised copy so `pins_with_author` can join a name
in one query, and `revoke update on public.profiles` plus a column-level grant is
what stops the client writing it behind the function's back.

### Consequences

- **Email lives only in `auth.users`.** Never copied to `profiles`, never
  returned by any function, never in a view, and compared nowhere except by the
  auth system itself.
- [`crew reads profiles ... using (true)`](../supabase/migrations/20260821183141_atlas_initial.sql)
  has to die. Profiles become readable to you, your connections, and anyone
  co-visible with you on a pin.
- **Display names need not be unique**, and two Daves in an audience list is
  fine — you only ever see people you are connected to or co-visible with, and
  the avatar settles it.
- **ATLAS will never grow on its own**, and that is deliberate. Every account
  arrives because somebody deliberately handed over a username, or deliberately
  mailed an invitation.

The paused invite work is now load-bearing rather than optional: it is the only
door into the app, and an invite link that creates the account **and** the
connection in one step makes joining and being vouched for the same act.

---

## The picker

When you drop a pin it asks who sees this. Options are any number of your
groups, any number of named individuals, and **no one**, which is the default
and the pre-selected state.

The picker must **show the resolved headcount before you save.** Groups overlap.
"Group 1 + group 2" is not two things, it is eleven people, and you will lose
track. Show the deduped number with faces, expandable — the same component as
the pin's audience display, fed by the same function. You should never save a
pin without having seen exactly who that means.

---

## Chat

The feature that can quietly undo all of the above.

### The forwarding hole

If I can see your pin and I can send pins in chat, I can forward your pin to
person 6. Either the forward works — and now anyone in your audience can widen
your audience, and the model is dead — or it does not, and your friend gets a
message they cannot open.

The rule that resolves it:

> **Sending a pin grants access only if you own the pin.** Your own pin, to
> anyone, because adding to your own audience is your right. Someone else's pin,
> only to people already in its audience. Anything else becomes a *request* to
> the owner — "Bob wants to show this to Dave" — and the owner decides.

That is the existing rule, *the pin is the finder's*, extended by exactly one
step. Enforce it in a trigger on message insert, not in the interface: for a
message carrying a `pin_id`, either every thread member can already see the pin,
or the sender owns it and individual grants are written for the members who
cannot. Otherwise reject the insert.

### Tables

```sql
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.thread_members (
  thread_id uuid not null references public.threads on delete cascade,
  user_id   uuid not null references auth.users     on delete cascade,
  primary key (thread_id, user_id)
);

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.threads on delete cascade,
  sender     uuid not null references auth.users     on delete cascade,
  body       text not null default '',
  pin_id     uuid references public.pins on delete set null,
  created_at timestamptz not null default now(),
  check (length(btrim(body)) > 0 or pin_id is not null)
);
```

`in_thread(thread_id)` is the chokepoint, the same shape as `can_see_pin` and
subject to the same discipline. Threads only form between connected people.

Attachments go in a private `chat-photos` bucket at
`{thread_id}/{sender_id}/{photo_id}.jpg`, with policies that read the permission
out of the path — the same trick as `pin-photos`, and for the same reason: an
object's name is ours and cannot be renamed underneath us by a storage release.

---

## On "phenomenally secure"

Row-level security is a genuinely strong boundary and it is already being used
correctly: the database refuses to return the row, so a bug in the interface
cannot leak what the query never returned. Keep everything gated on the one
audience check and chat inherits that for free.

Be straight about what it does and does not cover. The threat it stops is
**another user of the app seeing something they should not** — which is the
actual threat model, and it stops it cold. It does not stop somebody with
database access. End-to-end encryption would, and it is the wrong trade here: it
means key management, multi-device sync, and losing your phone meaning losing
your history — and it would be theatre while the pins, photos and coordinates
sit in the same database unencrypted.

Where this will actually break, in order of likelihood:

1. **The offline mirror.** Every pin you can see already sits unencrypted in
   IndexedDB on the phone, and chat would put every message there too. The
   device lock is the only thing protecting it. Decide deliberately whether chat
   is mirrored at all.
2. **The write queue replaying a stale audience.** An old cached build that
   still writes `is_private` could widen a pin it does not understand. Dropping
   the column outright is the defence — an old client's write then fails loudly
   instead of succeeding wrongly. Bump `SHELL_VERSION` in
   [`sw.js`](../sw.js) the same day.
3. **Orphaned storage objects** when rows cascade away. Already been bitten by
   this once in `pin_photos`; chat attachments are the same trap again.
4. **A new view missing `security_invoker = true`, or using `select p.*`.** Both
   mistakes are already in the git history. Name every column.

---

## Migration path

1. Create `connections`, `groups`, `group_members`, `pin_audience`.
2. Backfill: give each existing account a group containing the other two, and
   grant it on every pin where `is_private = false`. Pins where it is true get
   no rows. Existing connections: everybody to everybody, three people, done.
3. Rewrite `can_see_pin`. Everything downstream picks it up untouched.
4. Drop `pins.is_private`, drop `pins_privacy_cascades()`, strip the privacy
   half of `pins_child_follows_parent()`.
5. Rebuild `pins_with_author` naming every column.
6. Tighten the `profiles` SELECT policy; replace `loadPeople()`.
7. Bump `SHELL_VERSION`.

Steps 1–3 are additive and reversible. Step 4 is the point of no return, and
should land only once the interface no longer sends the column.

---

## Open questions

- **Does "everyone on ATLAS" survive as an option?** Recommend no. At hundreds
  of people that is publishing, and the widest a pin should go is a group you
  actually assembled.
- **Is chat mirrored offline?** Pins have to be — that is the product. Messages
  do not, and every message on the phone is a message on a lost phone.
- **Can you leave somebody else's group?** Recommend yes. You should be able to
  stop being shown to their people without having to break the connection.
- **Does removing somebody from a group notify them?** Recommend no. Silence is
  kinder and leaks less.
- **Does revoking a connection pull the person out of your groups?** It has to —
  and out of individual grants too. Trigger on `connections` delete, fail
  closed, same discipline as the parking trigger.
- **Blocking.** There is none. It matters less than it did — a rename now
  genuinely loses somebody who only had your handle, and connections can be
  revoked — but "make the lookup answer as though I am not here, to one specific
  person" is still not expressible, and one day somebody will want it.
- **Does a rename get announced to your connections?** They do not lose you, but
  they will see a different name on the same face with no explanation. Probably
  a quiet line in the thread rather than a notification.
