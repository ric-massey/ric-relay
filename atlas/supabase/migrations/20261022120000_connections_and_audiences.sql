-- Connections, and who sees a pin.
--
-- docs/audiences.md, migration path steps 1–7, less chat. Until today a pin
-- was either the whole crew's or nobody's but its finder's, and one boolean
-- (pins.is_private) said which. From here a pin is seen by its finder and by
-- whoever the finder granted it to — groups of theirs, or named people — and
-- by nobody else. No grant means nobody. There is no "everyone on ATLAS".
--
-- And you can only grant to, or group, somebody you are CONNECTED to: a
-- mutual, deliberate friendship, asked for by exact username and accepted by
-- the other person. Being put in front of strangers is something only somebody
-- you agreed to be reachable by can do to you.
--
-- The backfill keeps today exactly as it is for everybody already here: every
-- approved account is connected to every other, each person gets a group
-- called "the crew" holding everybody else, and every pin that was shared is
-- granted to its finder's crew. A personal pin gets no grant, which is what
-- personal now means. Somebody approved AFTER this lands sees nothing old until
-- somebody connects with them and shares it — which is the new model working.
--
-- pins.is_private is dropped, not left behind. An old cached app that still
-- writes it then fails loudly instead of believing it made a pin personal
-- (docs/audiences.md, "where this will actually break", item 2). Run this and
-- push the app together; the app's service worker version moves the same day.


-- ===========================================================================
-- 1 · Connections
-- ===========================================================================
create table if not exists public.connections (
  a          uuid not null references auth.users on delete cascade,
  b          uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)                  -- one row per pair, so a pair cannot be stored twice
);
create index if not exists connections_b_idx on public.connections (b, a);

create table if not exists public.connection_requests (
  from_id    uuid not null references auth.users on delete cascade,
  to_id      uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists connection_requests_to_idx on public.connection_requests (to_id, created_at);

alter table public.connections         enable row level security;
alter table public.connection_requests enable row level security;

-- Neither table is written by the client. A request goes in through
-- request_connection(), which takes a USERNAME — never an id, because an id you
-- saw on somebody's pin must not become a way to reach them. A connection goes
-- in through accept_connection(), which only the asked person can call. Either
-- side may end either one, which is a plain delete.
drop policy if exists "your own connections" on public.connections;
create policy "your own connections" on public.connections
  for select to authenticated
  using (auth.uid() in (a, b));

drop policy if exists "either of you can end it" on public.connections;
create policy "either of you can end it" on public.connections
  for delete to authenticated
  using (auth.uid() in (a, b));

drop policy if exists "requests you sent or got" on public.connection_requests;
create policy "requests you sent or got" on public.connection_requests
  for select to authenticated
  using (auth.uid() in (from_id, to_id));

drop policy if exists "withdraw or decline" on public.connection_requests;
create policy "withdraw or decline" on public.connection_requests
  for delete to authenticated
  using (auth.uid() in (from_id, to_id));

create policy "atlas is for approved people" on public.connections
  as restrictive for all to authenticated
  using ((select public.has_page_access('atlas')))
  with check ((select public.has_page_access('atlas')));

create policy "atlas is for approved people" on public.connection_requests
  as restrictive for all to authenticated
  using ((select public.has_page_access('atlas')))
  with check ((select public.has_page_access('atlas')));

grant select, delete on public.connections, public.connection_requests to authenticated;
grant select on public.connections, public.connection_requests to anon;

-- ---------------------------------------------------------------------------
-- Asking. SECURITY DEFINER: it has to resolve a username (usernames has no
-- SELECT policy) and write a row the client may not write. It takes a handle,
-- the one thing a stranger is allowed to bring, and returns only what became
-- of the ask:
--   'requested'  — they will see it
--   'connected'  — they had already asked you, so this was a yes
--   'already'    — you are connected
--   'nobody'     — no such person here: a name nobody wears, a name somebody
--                  let go, or an account that is not on ATLAS, all the same
--                  answer, as lookup_username() gives. Returned, not raised —
--                  it is an ordinary outcome, not a server error.
-- ---------------------------------------------------------------------------
create or replace function public.request_connection(handle text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  me     uuid := auth.uid();
  them   uuid;
  lo     uuid;
  hi     uuid;
  asking int;
begin
  if me is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not public.has_page_access('atlas') then
    raise exception 'your account is waiting for approval' using errcode = '42501';
  end if;

  select u.user_id into them
    from public.usernames u
   where u.username = lower(btrim(coalesce(handle, '')))
     and u.retired_at is null;

  if them is null
     or not (exists (select 1 from public.site_admins a where a.user_id = them)
             or exists (select 1 from public.site_access s
                         where s.user_id = them and s.page_key = 'atlas')) then
    return 'nobody';
  end if;
  if them = me then
    raise exception 'that is you' using errcode = '22023';
  end if;

  lo := least(me, them);
  hi := greatest(me, them);
  if exists (select 1 from public.connections c where c.a = lo and c.b = hi) then
    return 'already';
  end if;

  -- They asked first: asking back is the yes.
  if exists (select 1 from public.connection_requests r
              where r.from_id = them and r.to_id = me) then
    delete from public.connection_requests
     where (from_id = them and to_id = me) or (from_id = me and to_id = them);
    insert into public.connections (a, b) values (lo, hi) on conflict do nothing;
    return 'connected';
  end if;

  -- The only abuse this opens is one account asking everybody. There is no
  -- server in front of it to rate-limit with, so the cap is here.
  select count(*) into asking from public.connection_requests r where r.from_id = me;
  if asking >= 25 then
    raise exception 'you have 25 requests waiting — withdraw some first' using errcode = '22023';
  end if;

  insert into public.connection_requests (from_id, to_id) values (me, them)
  on conflict do nothing;
  return 'requested';
end;
$$;

-- ---------------------------------------------------------------------------
-- Saying yes. Takes the asker's id, which is safe for one reason: the request
-- row is the authorization, and only a row addressed TO the caller is looked
-- for. Delete and insert are one statement's worth of transaction, so there is
-- no moment where the request is gone and the connection is not.
-- ---------------------------------------------------------------------------
create or replace function public.accept_connection(requester uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or not public.has_page_access('atlas') then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  delete from public.connection_requests
   where from_id = requester and to_id = me;
  if not found then
    raise exception 'no such request' using errcode = 'P0002';
  end if;
  delete from public.connection_requests where from_id = me and to_id = requester;
  insert into public.connections (a, b)
  values (least(me, requester), greatest(me, requester))
  on conflict do nothing;
end;
$$;

revoke all on function public.request_connection(text) from public, anon;
revoke all on function public.accept_connection(uuid) from public, anon;
grant execute on function public.request_connection(text) to authenticated;
grant execute on function public.accept_connection(uuid) to authenticated;


-- ===========================================================================
-- 2 · Connection gates group membership
--
-- The seam groups.sql left for exactly this. Still SECURITY INVOKER: the
-- caller can read their own connections, and nothing further.
-- ===========================================================================
create or replace function public.can_add_to_group(who uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select who is not null and who <> auth.uid()
     and exists (select 1 from public.connections c
                  where c.a = least(auth.uid(), who) and c.b = greatest(auth.uid(), who));
$$;

comment on function public.can_add_to_group(uuid) is
  'Whether the caller may put this person in one of their groups, or grant them
   a pin: only somebody they are connected to. Must stay SECURITY INVOKER.';


-- ===========================================================================
-- 3 · The audience
-- ===========================================================================
create table if not exists public.pin_audience (
  pin_id     uuid not null references public.pins   on delete cascade,
  group_id   uuid          references public.groups on delete cascade,
  user_id    uuid          references auth.users    on delete cascade,
  granted_at timestamptz not null default now(),
  check (num_nonnulls(group_id, user_id) = 1)
);

create unique index if not exists pin_audience_group_uniq
  on public.pin_audience (pin_id, group_id) where group_id is not null;
create unique index if not exists pin_audience_user_uniq
  on public.pin_audience (pin_id, user_id)  where user_id is not null;
create index if not exists pin_audience_pin_idx   on public.pin_audience (pin_id);
create index if not exists pin_audience_user_idx  on public.pin_audience (user_id)  where user_id is not null;
create index if not exists pin_audience_group_idx on public.pin_audience (group_id) where group_id is not null;

alter table public.pin_audience enable row level security;

-- ---------------------------------------------------------------------------
-- my_groups(): the groups the caller is IN. group_members is owner-only, so a
-- member cannot ask this through RLS. No parameters — it can only describe you.
-- ---------------------------------------------------------------------------
create or replace function public.my_groups()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(gm.group_id), '{}')
    from public.group_members gm
   where gm.user_id = auth.uid()
     and public.has_page_access('atlas');
$$;

-- ---------------------------------------------------------------------------
-- pins_shared_with_me(): every pin somebody has granted the caller, by name or
-- through a group. No parameters. It is what the pins policy reads, and it has
-- to be DEFINER for the same reason as my_groups(), and for one more: the pins
-- policy cannot read pin_audience through RLS, because pin_audience's own
-- policy reads pins, and the two would call each other forever (the recursion
-- trap in docs/audiences.md). Through this function the loop is broken on the
-- pins side, once.
-- ---------------------------------------------------------------------------
create or replace function public.pins_shared_with_me()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct a.pin_id), '{}')
    from public.pin_audience a
   where public.has_page_access('atlas')
     and (a.user_id = auth.uid()
          or a.group_id in (select gm.group_id from public.group_members gm
                             where gm.user_id = auth.uid()));
$$;

revoke all on function public.my_groups() from public, anon;
revoke all on function public.pins_shared_with_me() from public, anon;
grant execute on function public.my_groups() to authenticated;
grant execute on function public.pins_shared_with_me() to authenticated;

-- ---------------------------------------------------------------------------
-- THE check. Who may read a pin: its finder, and anybody it is shared with. A
-- parking spot is seen exactly when the pin it serves is — resolved through
-- parent_id at read time rather than copied, so the two cannot disagree and no
-- trigger has to keep them in step.
--
-- The `array[...] <@ (select ...)` shape is deliberate: the subquery runs once
-- per statement as an InitPlan, not once per pin.
-- ---------------------------------------------------------------------------
drop policy if exists "crew reads pins" on public.pins;
drop policy if exists "who can see a pin" on public.pins;
create policy "who can see a pin" on public.pins
  for select to authenticated
  using (
    created_by = auth.uid()
    or array[coalesce(parent_id, id)] <@ (select public.pins_shared_with_me())
  );

-- can_see_pin() is now "is this row visible to me" — the policy above is the
-- one rule, and everything that gates on a pin (notes, photos, the photo
-- bucket) asks it through here, unchanged. SECURITY INVOKER forever: it has no
-- logic of its own, so run as anybody but the caller it would say yes to every
-- pin there is. That includes being CALLED from a DEFINER function — inside
-- one, RLS is off, so no DEFINER function may use this as its gate.
create or replace function public.can_see_pin(p_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (select 1 from public.pins p where p.id = p_id);
$$;

comment on function public.can_see_pin(uuid) is
  'True if the current user may read this pin — i.e. the pins SELECT policy
   returns it. Notes, photos and the photo bucket gate on this. Must stay
   SECURITY INVOKER, and must never be the gate inside a DEFINER function
   (RLS is off in there, and it would answer yes for every pin).';

-- pin_audience's own policies. Reading: your own grants (so you know a pin was
-- shared with you), and every grant on your own pins (so you can manage them).
-- Never somebody else's grants on somebody else's pin — the list of who can see
-- a pin comes from pin_audience_people(), which says people and never groups.
drop policy if exists "your grants, and grants on your pins" on public.pin_audience;
create policy "your grants, and grants on your pins" on public.pin_audience
  for select to authenticated
  using (
    user_id = auth.uid()
    or array[group_id] <@ (select public.my_groups())
    or exists (select 1 from public.pins p
                where p.id = pin_id and p.created_by = auth.uid())
  );

-- Granting: only on your own top-level pin (a parking spot follows its pin and
-- carries no grants of its own), and only to a group of yours or somebody you
-- are connected to.
drop policy if exists "you share your own pins" on public.pin_audience;
create policy "you share your own pins" on public.pin_audience
  for insert to authenticated
  with check (
    exists (select 1 from public.pins p
             where p.id = pin_id and p.created_by = auth.uid() and p.parent_id is null)
    and (
      (group_id is not null and exists (select 1 from public.groups g
                                         where g.id = group_id and g.owner = auth.uid()))
      or (user_id is not null and public.can_add_to_group(user_id))
    )
  );

-- Un-sharing is immediate and total. There is no update: a grant is made or gone.
drop policy if exists "you unshare your own pins" on public.pin_audience;
create policy "you unshare your own pins" on public.pin_audience
  for delete to authenticated
  using (exists (select 1 from public.pins p
                  where p.id = pin_id and p.created_by = auth.uid()));

create policy "atlas is for approved people" on public.pin_audience
  as restrictive for all to authenticated
  using ((select public.has_page_access('atlas')))
  with check ((select public.has_page_access('atlas')));

grant select, insert, delete on public.pin_audience to authenticated;
grant select on public.pin_audience to anon;

-- ---------------------------------------------------------------------------
-- Who can see this pin — the same list for everybody who can see it, owner or
-- not. People only: never which group anybody came from, and two of the
-- finder's groups both holding Alice give one Alice.
--
-- SECURITY DEFINER because it reads group membership, which nobody but the
-- group's owner can. It takes a pin id, and it authorizes before it answers —
-- with the visibility rule written out here, NOT can_see_pin(), which under
-- DEFINER would see every pin.
-- ---------------------------------------------------------------------------
create or replace function public.pin_audience_people(p_id uuid)
returns table (id uuid, username text, display_name text, avatar_path text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  target uuid;
  finder uuid;
begin
  if not public.has_page_access('atlas') then return; end if;

  select coalesce(p.parent_id, p.id), p.created_by into target, finder
    from public.pins p where p.id = p_id;
  if target is null then return; end if;

  if not (finder = auth.uid()
          or target = any (public.pins_shared_with_me())) then
    return;
  end if;

  return query
    select distinct pr.id, pr.username, pr.display_name, pr.avatar_path
      from public.profiles pr
     where pr.id = finder
        or pr.id in (
             select a.user_id from public.pin_audience a
              where a.pin_id = target and a.user_id is not null
             union
             select gm.user_id from public.pin_audience a
               join public.group_members gm on gm.group_id = a.group_id
              where a.pin_id = target
           );
end;
$$;

revoke all on function public.pin_audience_people(uuid) from public, anon;
grant execute on function public.pin_audience_people(uuid) to authenticated;


-- ===========================================================================
-- 4 · Ending a connection takes back everything it allowed
--
-- Out of each other's groups, and out of each other's individual grants, in
-- both directions. DEFINER because the person ending it cannot see the other
-- side's groups — which is the half that matters to them.
-- ===========================================================================
create or replace function public.connections_unwind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.group_members gm
   using public.groups g
   where g.id = gm.group_id
     and ((g.owner = old.a and gm.user_id = old.b)
       or (g.owner = old.b and gm.user_id = old.a));

  delete from public.pin_audience pa
   using public.pins p
   where p.id = pa.pin_id
     and ((p.created_by = old.a and pa.user_id = old.b)
       or (p.created_by = old.b and pa.user_id = old.a));
  return old;
end;
$$;

drop trigger if exists connections_unwind on public.connections;
create trigger connections_unwind
  after delete on public.connections
  for each row execute function public.connections_unwind();


-- ===========================================================================
-- 5 · Whose face the app may draw, widened by exactly what this adds
--
-- Your connections and anybody with a request between you (tier 3, and the
-- person on the other end of an ask); and everybody on the audience of a pin
-- you can see (tier 2 — a name and a face on that pin, nothing more, which is
-- all a profile row is to anyone but its owner since the bug sweep).
--
-- Every "can I see this pin" in here is spelled out, not asked of
-- can_see_pin(): this is DEFINER, and in here that function sees everything.
-- ===========================================================================
create or replace function public.people_i_can_draw()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select p.id from public.pins p
     where p.created_by = auth.uid()
        or array[coalesce(p.parent_id, p.id)] <@ (select public.pins_shared_with_me())
  )
  select coalesce(array_agg(distinct who), '{}')
  from (
    select auth.uid() as who
    union all
    select gm.user_id
      from public.group_members gm
      join public.groups g on g.id = gm.group_id
     where g.owner = auth.uid()
    union all
    select case when c.a = auth.uid() then c.b else c.a end
      from public.connections c where auth.uid() in (c.a, c.b)
    union all
    select case when r.from_id = auth.uid() then r.to_id else r.from_id end
      from public.connection_requests r where auth.uid() in (r.from_id, r.to_id)
    union all
    select p.created_by from public.pins p where p.id in (select id from visible)
    union all
    select n.created_by from public.pin_notes n where n.pin_id in (select id from visible)
    union all
    select ph.created_by from public.pin_photos ph where ph.pin_id in (select id from visible)
    union all
    select a.user_id from public.pin_audience a
     where a.pin_id in (select id from visible) and a.user_id is not null
    union all
    select gm.user_id from public.pin_audience a
      join public.group_members gm on gm.group_id = a.group_id
     where a.pin_id in (select id from visible)
  ) s
  where who is not null
    and (who = auth.uid() or public.has_page_access('atlas'));
$$;

revoke all on function public.people_i_can_draw() from public, anon;
grant execute on function public.people_i_can_draw() to authenticated;


-- ===========================================================================
-- 6 · Backfill: today, kept
-- ===========================================================================
create temporary table _atlas_people as
  select user_id from public.site_access where page_key = 'atlas'
  union
  select user_id from public.site_admins;

insert into public.connections (a, b)
select x.user_id, y.user_id
  from _atlas_people x join _atlas_people y on x.user_id < y.user_id
on conflict do nothing;

-- A crew for everybody who is here, and for anybody whose shared pins the crew
-- can read today even if their own access has since gone.
insert into public.groups (owner, name)
select o.who, 'the crew'
  from (select user_id as who from _atlas_people
        union
        select created_by from public.pins where not is_private and parent_id is null) o
 where exists (select 1 from _atlas_people m where m.user_id <> o.who)
on conflict do nothing;

insert into public.group_members (group_id, user_id)
select g.id, m.user_id
  from public.groups g
  join _atlas_people m on m.user_id <> g.owner
 where lower(btrim(g.name)) = 'the crew'
on conflict do nothing;

insert into public.pin_audience (pin_id, group_id)
select p.id, g.id
  from public.pins p
  join public.groups g on g.owner = p.created_by and lower(btrim(g.name)) = 'the crew'
 where not p.is_private and p.parent_id is null
on conflict do nothing;

drop table _atlas_people;


-- ===========================================================================
-- 7 · is_private goes
-- ===========================================================================

-- The parking trigger keeps its ownership half; the privacy half is now the
-- policy's coalesce(parent_id, id).
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

  return new;
end;
$$;

drop trigger if exists pins_child_follows_parent on public.pins;
create trigger pins_child_follows_parent
  before insert or update of parent_id, created_by on public.pins
  for each row execute function public.pins_child_follows_parent();

-- A pin that becomes a parking spot stops carrying grants of its own: it is
-- seen through its parent now, and a stale grant would come back to life if
-- it were ever detached.
create or replace function public.pins_parking_drops_grants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is not null and old.parent_id is null then
    delete from public.pin_audience where pin_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists pins_parking_drops_grants on public.pins;
create trigger pins_parking_drops_grants
  after update of parent_id on public.pins
  for each row execute function public.pins_parking_drops_grants();

drop trigger if exists pins_privacy_cascades on public.pins;
drop function if exists public.pins_privacy_cascades();

drop view if exists public.pins_with_author;
alter table public.pins drop column is_private;

-- Every column named — `select p.*` is expanded once at creation.
create view public.pins_with_author
with (security_invoker = true) as
select
  p.id,
  p.created_by,
  p.parent_id,
  p.name,
  p.description,
  p.lat,
  p.lng,
  p.accuracy_m,
  p.kind,
  p.kind_other,
  p.created_at,
  p.updated_at,
  pr.username,
  pr.display_name
from public.pins p
left join public.profiles pr on pr.id = p.created_by;

comment on view public.pins_with_author is
  'Pins joined to the name of whoever dropped them. security_invoker = true, so
   row-level security on public.pins applies to reads through this view.';

grant select on public.pins_with_author to authenticated, anon;
