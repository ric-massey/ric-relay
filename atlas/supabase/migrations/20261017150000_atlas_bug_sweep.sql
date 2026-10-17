-- ATLAS bug sweep, 2026-10-17 — the database half (findings A3a-1 … A3a-8 and
-- the pin_photos path lead from A3b). Each section names its finding. Nothing
-- here loosens anything; every change is a refusal, a narrowing, or a grant the
-- live project already has by default, written down so the repo is the schema.
--
-- Applied with `supabase db push`. Safe to apply before or after the app
-- update that goes with it: the app falls back to the old reads when the new
-- function is not there yet.


-- ===========================================================================
-- A3a-6 · The grants live in the migrations, not in seed.sql
--
-- The live project gives anon and authenticated full table privileges on public
-- by default, and every table here was written against that, so nothing in the
-- migrations granted anything — the local stack only worked because seed.sql
-- put the default back, and in doing so undid the one column lock below
-- (profiles' UPDATE). A project rebuilt from these migrations under the new
-- "nothing exposed by default" rule would have been a dead map.
--
-- So: exactly what each table needs, to authenticated, here. Row-level security
-- still decides which rows; these only say which verbs. anon keeps SELECT, as
-- the live default gives it: no ATLAS policy is written `to anon`, so a
-- signed-out request is answered with nothing rather than an error, the same
-- answer live and local.
-- ===========================================================================
grant select, insert, update, delete on public.pins           to authenticated;
grant select, insert, update, delete on public.pin_notes      to authenticated;
grant select, insert,         delete on public.pin_photos     to authenticated;
grant select, insert, update, delete on public.parcel_sources to authenticated;
grant select, insert, update, delete on public.groups         to authenticated;
grant select, insert,         delete on public.group_members  to authenticated;
grant select on public.pins_with_author, public.pin_notes_with_author,
                public.pin_photos_with_author to authenticated;
grant select on public.pins, public.pin_notes, public.pin_photos, public.parcel_sources,
                public.groups, public.group_members, public.pins_with_author,
                public.pin_notes_with_author, public.pin_photos_with_author to anon;
grant all on all tables in schema public to service_role;


-- ===========================================================================
-- A3a-2 · Another member's profile is a name and a face, never their settings
--
-- The draw set lets a member read the profiles of everyone in their own
-- groups, and anyone may be put in a group — so the narrowing to "people you
-- can draw" could be walked one person at a time, and each row carried that
-- person's prefs (home town, with coordinates), and the must_* flags. The
-- design (docs/audiences.md) gives a stranger a display name and an avatar by
-- exact username and nothing more. That is now what a profile row IS to
-- anyone but its owner: the columns below, and no others.
--
-- Your own private columns come from my_profile(), which reads only your row.
-- (Column privileges cannot depend on the row; a function can.)
-- ===========================================================================
revoke select on public.profiles from anon, authenticated;
grant select (id, username, display_name, avatar_path, created_at)
  on public.profiles to anon, authenticated;

-- UPDATE stays exactly as usernames_are_chosen.sql left it — restated, because
-- seed.sql used to undo it locally (A3a-6).
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_path, prefs, setup_done)
  on public.profiles to authenticated;

create or replace function public.my_profile()
returns table (
  id uuid, username text, display_name text, avatar_path text,
  must_change_password boolean, must_choose_username boolean,
  prefs jsonb, setup_done boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_path,
         p.must_change_password, p.must_choose_username, p.prefs, p.setup_done
    from public.profiles p
   where p.id = auth.uid();
$$;
revoke all on function public.my_profile() from public, anon;
grant execute on function public.my_profile() to authenticated;

-- …and the avatars bucket. Every folder in it is a user id, and the bucket was
-- readable whole, so listing its root was a roster of everyone who had ever set
-- a picture. Now a face is readable only for someone you can already draw — the
-- same set the app shows faces for — and not at all once the account is gone
-- (A3a-5: a deleted account is in nobody's draw set).
drop policy if exists "crew reads avatars" on storage.objects;
create policy "crew reads avatars" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and public.uuid_segment(name, 1) = any (public.people_i_can_draw())
  );


-- ===========================================================================
-- A3a-3 · Being in somebody's group no longer tells you who they are
--
-- The draw set included the owners of groups you are in. Since the set is
-- one request away (it has to be: the policy runs as you), subtracting
-- everything else you can see from it left exactly the people who had filed
-- you — which groups.sql says is not a thing you are told. Nothing in the app
-- draws a group's owner for its members (groups are private to their owner),
-- so that line goes and nothing else changes.
-- ===========================================================================
create or replace function public.people_i_can_draw()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct who), '{}')
  from (
    select auth.uid() as who
    union all
    select gm.user_id
      from public.group_members gm
      join public.groups g on g.id = gm.group_id
     where g.owner = auth.uid()
    union all
    select p.created_by from public.pins p
     where not p.is_private or p.created_by = auth.uid()
    union all
    select n.created_by from public.pin_notes n where public.can_see_pin(n.pin_id)
    union all
    select ph.created_by from public.pin_photos ph where public.can_see_pin(ph.pin_id)
  ) s
  where who is not null
    and (who = auth.uid() or public.has_page_access('atlas'));
$$;


-- ===========================================================================
-- A3a-4 · A deleted account's usernames stay off the market
--
-- usernames.user_id cascaded on delete, so deleting an account deleted every
-- name it had worn and any of them could be claimed the next minute — the
-- exact thing that table exists to stop. SET NULL keeps each row, and a NULL
-- user_id already means "reserved, never claimable".
-- ===========================================================================
alter table public.usernames drop constraint if exists usernames_user_id_fkey;
alter table public.usernames
  add constraint usernames_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;


-- ===========================================================================
-- A3a-5 · A deleted account's photos stop being readable
--
-- Objects in the bucket outlive their rows (the app removes them; an account
-- deleted from /admin did not). A photo is now readable only while its row
-- exists, so a photo with no row behind it — a deleted account's, or one whose
-- row never landed — is nobody's to download. (The admin function also removes
-- the objects now; this holds even when that fails.)
--
-- Lead from A3b: nothing tied a row's path to the row. A member could write a
-- row naming somebody else's object, and the app downloads — and on delete,
-- removes — whatever path a row says. The path is {pin}/{uploader}/{id}.jpg
-- and now has to say so. NOT VALID: checked on every new row, existing rows
-- are left as they are.
-- ===========================================================================
drop policy if exists "crew reads pin photos" on storage.objects;
create policy "crew reads pin photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pin-photos'
    and public.can_see_pin(public.uuid_segment(name, 1))
    and exists (select 1 from public.pin_photos r where r.path = name)
  );

alter table public.pin_photos drop constraint if exists pin_photos_path_is_its_own;
alter table public.pin_photos add constraint pin_photos_path_is_its_own
  check (path = pin_id::text || '/' || created_by::text || '/' || id::text || '.jpg') not valid;


-- ===========================================================================
-- A3a-7 · Sizes
--
-- Nothing bounded what an account writes, and a waiting account — anybody who
-- signs up — can write its own profile. Every member's app downloads profiles,
-- pins and notes at start, so one multi-megabyte value is everybody's problem,
-- and the database is shared with HERMISCUS and Studies. The limits are far
-- above anything the app writes (its own inputs stop at 40–60 characters; a
-- note is a paragraph). NOT VALID so an existing row is never the reason a
-- migration fails; new writes are checked.
-- ===========================================================================
alter table public.profiles drop constraint if exists profiles_sizes;
alter table public.profiles add constraint profiles_sizes check (
  coalesce(length(display_name), 0) <= 80
  and coalesce(length(avatar_path), 0) <= 200
  and pg_column_size(prefs) <= 16384
) not valid;

alter table public.pins drop constraint if exists pins_sizes;
alter table public.pins add constraint pins_sizes check (
  length(name) <= 200 and length(description) <= 10000 and length(kind) <= 40
  and length(kind_other) <= 80
) not valid;

alter table public.pin_notes drop constraint if exists pin_notes_sizes;
alter table public.pin_notes add constraint pin_notes_sizes
  check (length(body) <= 10000) not valid;

alter table public.parcel_sources drop constraint if exists parcel_sources_sizes;
alter table public.parcel_sources add constraint parcel_sources_sizes check (
  length(label) <= 120 and length(url) <= 600
  and coalesce(length(site_url), 0) <= 600
  and coalesce(length(owner_field), 0) <= 80 and coalesce(length(apn_field), 0) <= 80
  and coalesce(length(address_field), 0) <= 80 and coalesce(length(acres_field), 0) <= 80
) not valid;

alter table public.groups drop constraint if exists groups_sizes;
alter table public.groups add constraint groups_sizes
  check (length(name) <= 80) not valid;

-- The app only ever uploads JPEGs it has redrawn itself: photos at 1600px are
-- well under 2 MB, avatars far less.
update storage.buckets
   set file_size_limit = 8 * 1024 * 1024, allowed_mime_types = array['image/jpeg']
 where id = 'pin-photos';
update storage.buckets
   set file_size_limit = 1024 * 1024, allowed_mime_types = array['image/jpeg']
 where id = 'avatars';


-- ===========================================================================
-- A3a-8 · Parking is one level, and privacy always follows it
--
-- The trigger checked that a parking spot's parent had no parent, never that
-- the pin being given a parent had no children of its own — so a pin with a
-- parking spot could be re-parented under a personal pin, take that pin's
-- privacy, and leave its own parking spot shared. And the cascade fired only
-- when is_private was in the UPDATE's SET list, which a value forced by the
-- BEFORE trigger is not.
-- ===========================================================================
create or replace function public.pins_child_follows_parent()
returns trigger
language plpgsql
as $$
declare
  parent public.pins%rowtype;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'a pin cannot be its own parking spot';
  end if;

  select * into parent from public.pins where id = new.parent_id;
  if not found then
    raise exception 'parking spot points at a pin that does not exist';
  end if;

  if parent.parent_id is not null then
    raise exception 'parking spots do not get parking spots';
  end if;

  if exists (select 1 from public.pins c where c.parent_id = new.id) then
    raise exception 'a pin with its own parking spot cannot become one';
  end if;

  if parent.created_by <> new.created_by then
    raise exception 'only the person who dropped a pin can park at it';
  end if;

  new.is_private := parent.is_private;
  return new;
end;
$$;

-- Every update, and the function compares old and new itself — so a change the
-- BEFORE trigger made is cascaded like one the client asked for.
drop trigger if exists pins_privacy_cascades on public.pins;
create trigger pins_privacy_cascades
  after update on public.pins
  for each row execute function public.pins_privacy_cascades();


-- ===========================================================================
-- A3a-1 · A county source is asked only about its own county, and a shared
-- source has to be approved before it reaches anybody else
--
-- Before: any approved account could add a "county" — a URL — and every other
-- member's phone sent it the exact point of every pin they looked up, anywhere
-- in the country, personal pins included. Three changes:
--
--   county / state  — which county a source answers for. The app asks a source
--                     only about pins inside that county (it already knows
--                     the pin's county from the Census lookup beside it).
--   approved        — a source you add is yours alone until Ric approves it.
--                     Ric's own are approved as they are added. Sources added
--                     before sign-ups opened (2026-09-23, when the only
--                     accounts were the original crew) are approved as they
--                     stand; anything since waits for him.
--   personal pins   — the app sends a personal pin only to sources its owner
--                     added (app side; nothing here can see the pin).
-- ===========================================================================
alter table public.parcel_sources add column if not exists county text;
alter table public.parcel_sources add column if not exists state text
  check (state is null or state ~ '^[A-Z]{2}$');
alter table public.parcel_sources add column if not exists approved boolean not null default false;

update public.parcel_sources set approved = true
 where created_at < timestamptz '2026-09-23 00:00:00+00'
    or created_by in (select user_id from public.site_admins);

-- Only Ric sets `approved`. Anyone else's insert arrives unapproved, and an edit
-- to where a source points (or what it links to) takes the approval away again.
create or replace function public.parcel_sources_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_site_admin() then
    if tg_op = 'INSERT' and new.created_by = auth.uid() then
      new.approved := true;
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.approved := false;
  elsif new.url is distinct from old.url or new.site_url is distinct from old.site_url
     or new.county is distinct from old.county or new.state is distinct from old.state then
    new.approved := false;
  else
    new.approved := old.approved;
  end if;
  return new;
end;
$$;

drop trigger if exists parcel_sources_approval on public.parcel_sources;
create trigger parcel_sources_approval
  before insert or update on public.parcel_sources
  for each row execute function public.parcel_sources_approval();

drop policy if exists "crew reads parcel sources" on public.parcel_sources;
create policy "crew reads parcel sources" on public.parcel_sources
  for select to authenticated
  using (approved or created_by = auth.uid() or public.is_site_admin());

drop policy if exists "ric approves parcel sources" on public.parcel_sources;
create policy "ric approves parcel sources" on public.parcel_sources
  for update to authenticated
  using (public.is_site_admin()) with check (public.is_site_admin());
