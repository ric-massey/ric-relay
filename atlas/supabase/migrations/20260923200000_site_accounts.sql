-- One account for the whole site, and Ric decides who sees what.
--
-- Until now ATLAS was invite-only: nobody could sign up, so "signed in" meant
-- "one of us" and every policy could say `to authenticated` and stop there.
-- Ric reversed that on 2026-09-23. Anybody may now make an account, the account
-- arrives as a REQUEST, and Ric approves it and picks which pages it opens:
-- ATLAS and HERMISCUS today, more later.
--
-- That makes `authenticated` worthless as a lock — a stranger who signed up a
-- minute ago is authenticated. So the real lock moves here:
--
--   has_page_access('atlas')   is the question every ATLAS table now asks,
--
-- as a RESTRICTIVE policy on each one. Restrictive policies are ANDed with the
-- permissive ones already written, so none of ATLAS's existing rules had to be
-- rewritten or even re-read: whatever they allowed, they now allow only to
-- somebody Ric has let in. The SECURITY DEFINER functions read past policies,
-- so the three that return other people's data or claim shared names are
-- guarded by hand at the bottom.
--
-- Adding a page later is one row in site_pages. Whether that page is really
-- private depends on where its content lives: a page whose words are in the
-- public repo is only curtained by this, and only data held in this database
-- behind has_page_access() is actually locked.

-- ---------------------------------------------------------------------------
-- The pages, the admins, who may open what, and the requests
-- ---------------------------------------------------------------------------
create table if not exists public.site_pages (
  key   text primary key check (key ~ '^[a-z][a-z0-9-]{1,30}$'),
  label text not null check (length(btrim(label)) between 1 and 40),
  blurb text not null default '',
  -- Where the page lives, relative to the site root, so the account page can
  -- link to it. Adding a page is this one row and nothing else.
  path  text not null default '' check (path !~ '^(/|[a-z]+:)'),
  sort  integer not null default 0
);

insert into public.site_pages (key, label, blurb, path, sort) values
  ('atlas', 'ATLAS', 'the crew map', 'atlas/', 10),
  ('hermiscus', 'HERMISCUS', 'the crew app for Dad''s race', 'projects/dads-race/login.html', 20)
on conflict (key) do nothing;

create table if not exists public.site_admins (
  user_id  uuid primary key references auth.users on delete cascade,
  added_at timestamptz not null default now()
);

create table if not exists public.site_access (
  user_id    uuid not null references auth.users on delete cascade,
  page_key   text not null references public.site_pages on delete cascade,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users on delete set null,
  primary key (user_id, page_key)
);

create table if not exists public.access_requests (
  user_id     uuid primary key references auth.users on delete cascade,
  email       text not null default '',
  name        text not null default '' check (length(name) <= 60),
  note        text not null default '' check (length(note) <= 500),
  pages       text[] not null default '{}',
  status      text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid references auth.users on delete set null
);

create index if not exists access_requests_pending_idx
  on public.access_requests (created_at) where status = 'pending';

alter table public.site_pages      enable row level security;
alter table public.site_admins     enable row level security;
alter table public.site_access     enable row level security;
alter table public.access_requests enable row level security;

-- ---------------------------------------------------------------------------
-- The two questions
-- ---------------------------------------------------------------------------
create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.site_admins a where a.user_id = auth.uid());
$$;

create or replace function public.has_page_access(page text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.site_admins a where a.user_id = auth.uid())
    or exists (
      select 1 from public.site_access s
       where s.user_id = auth.uid() and s.page_key = page
    )
  );
$$;

revoke all on function public.is_site_admin() from public, anon;
revoke all on function public.has_page_access(text) from public, anon;
grant execute on function public.is_site_admin() to authenticated;
grant execute on function public.has_page_access(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reading: the page list is the sign-up form's menu, so everybody sees it.
-- Your own access and your own request are yours; Ric sees everybody's.
-- Nothing here is written directly — the functions below are the only doors.
-- ---------------------------------------------------------------------------
create policy "anyone reads the page list" on public.site_pages
  for select to anon, authenticated using (true);

create policy "you know if you are an admin" on public.site_admins
  for select to authenticated using (user_id = auth.uid());

create policy "your access, or everybody's for an admin" on public.site_access
  for select to authenticated
  using (user_id = auth.uid() or (select public.is_site_admin()));

create policy "your request, or everybody's for an admin" on public.access_requests
  for select to authenticated
  using (user_id = auth.uid() or (select public.is_site_admin()));

-- Said outright rather than left to the project's default privileges, which a
-- local stack does not share with the live one.
grant all on public.site_pages, public.site_admins, public.site_access, public.access_requests to service_role;
grant select on public.site_pages to anon, authenticated;
grant select on public.site_admins, public.site_access, public.access_requests to authenticated;
revoke insert, update, delete on public.site_pages, public.site_admins,
  public.site_access, public.access_requests from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Asking. A new account files one request; asking again only edits it while it
-- is still pending, so a denied account cannot nag its way back into the queue.
-- ---------------------------------------------------------------------------
create or replace function public.request_access(who text, why text, wanted text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_pages text[];
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select coalesce(array_agg(p.key order by p.sort), '{}') into clean_pages
    from public.site_pages p where p.key = any(coalesce(wanted, '{}'));

  insert into public.access_requests (user_id, email, name, note, pages)
  values (
    auth.uid(),
    coalesce((select u.email from auth.users u where u.id = auth.uid()), ''),
    left(btrim(coalesce(who, '')), 60),
    left(btrim(coalesce(why, '')), 500),
    clean_pages
  )
  on conflict (user_id) do update
    set name = excluded.name, note = excluded.note, pages = excluded.pages
    where public.access_requests.status = 'pending';
end;
$$;

-- A new account asks for nothing until it says so — but it does exist as a
-- pending request from the moment it is made, so Ric sees every account, not
-- only the ones that finished the form. An account Ric INVITED from the
-- dashboard was already chosen by him and walks straight into ATLAS, which is
-- how invites worked before this and keeps working.
create or replace function public.file_access_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Auth stamps invited_at just AFTER it inserts the user, so an invite shows up
  -- here as an update. Either way, the first time invited_at is set, Ric chose
  -- this person himself.
  if new.invited_at is not null and (tg_op = 'INSERT' or old.invited_at is null) then
    insert into public.access_requests (user_id, email, pages, status, decided_at)
    values (new.id, coalesce(new.email, ''), array['atlas'], 'approved', now())
    on conflict (user_id) do update
      set status = 'approved', decided_at = now(),
          pages = (select array(select distinct unnest(public.access_requests.pages || array['atlas'])));
    insert into public.site_access (user_id, page_key)
    values (new.id, 'atlas')
    on conflict do nothing;
  elsif tg_op = 'INSERT' then
    insert into public.access_requests (user_id, email)
    values (new.id, coalesce(new.email, ''))
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.file_access_request() from public, anon, authenticated;

drop trigger if exists on_auth_user_request on auth.users;
create trigger on_auth_user_request
  after insert or update of invited_at on auth.users
  for each row execute function public.file_access_request();

-- ---------------------------------------------------------------------------
-- Deciding. One call sets a person's status and exactly which pages they open.
-- Approve with pages, change pages later, or deny (which removes everything).
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_access(target uuid, new_status text, grant_pages text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_site_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if new_status not in ('pending', 'approved', 'denied') then
    raise exception 'status must be pending, approved or denied' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users u where u.id = target) then
    raise exception 'no such account' using errcode = '22023';
  end if;

  insert into public.access_requests (user_id, email)
  values (target, coalesce((select u.email from auth.users u where u.id = target), ''))
  on conflict (user_id) do nothing;

  update public.access_requests
     set status = new_status, decided_at = now(), decided_by = auth.uid()
   where user_id = target;

  delete from public.site_access s
   where s.user_id = target
     and (new_status <> 'approved' or not (s.page_key = any(coalesce(grant_pages, '{}'))));

  if new_status = 'approved' then
    insert into public.site_access (user_id, page_key, granted_by)
    select target, p.key, auth.uid()
      from public.site_pages p where p.key = any(coalesce(grant_pages, '{}'))
    on conflict do nothing;
  end if;
end;
$$;

-- Everybody with an account, with what they asked for and what they have.
create or replace function public.admin_people()
returns table (
  user_id uuid, email text, name text, note text, requested text[],
  status text, created_at timestamptz, last_sign_in_at timestamptz, pages text[],
  username text, is_admin boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select u.id,
         coalesce(u.email, ''),
         coalesce(r.name, ''),
         coalesce(r.note, ''),
         coalesce(r.pages, '{}'),
         coalesce(r.status, 'pending'),
         u.created_at,
         u.last_sign_in_at,
         coalesce((select array_agg(s.page_key order by s.page_key)
                     from public.site_access s where s.user_id = u.id), '{}'),
         p.username,
         exists (select 1 from public.site_admins a where a.user_id = u.id)
    from auth.users u
    left join public.access_requests r on r.user_id = u.id
    left join public.profiles p on p.id = u.id
   where public.is_site_admin()
   order by (coalesce(r.status, 'pending') = 'pending') desc, u.created_at desc;
$$;

revoke all on function public.request_access(text, text, text[]) from public, anon;
revoke all on function public.admin_set_access(uuid, text, text[]) from public, anon;
revoke all on function public.admin_people() from public, anon;
grant execute on function public.request_access(text, text, text[]) to authenticated;
grant execute on function public.admin_set_access(uuid, text, text[]) to authenticated;
grant execute on function public.admin_people() to authenticated;

-- ---------------------------------------------------------------------------
-- Everyone already here was let in by hand, so they keep ATLAS.
-- ---------------------------------------------------------------------------
insert into public.access_requests (user_id, email, pages, status, decided_at)
select u.id, coalesce(u.email, ''), array['atlas'], 'approved', now()
  from auth.users u
on conflict (user_id) do nothing;

insert into public.site_access (user_id, page_key)
select u.id, 'atlas' from auth.users u
on conflict do nothing;

-- Ric runs the place. His handle is already public on this site; his email is
-- not, and is deliberately not written here. If the handle ever changes, this
-- finds nobody and he adds himself in the SQL editor — see atlas/README.md.
insert into public.site_admins (user_id)
select u.user_id from public.usernames u
 where u.username = 'rmbuster82' and u.retired_at is null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- The lock on ATLAS. One restrictive policy per table, ANDed with every rule
-- already there. Your own profile and username stay readable so a waiting
-- account can still be told it is waiting.
-- ---------------------------------------------------------------------------
create policy "atlas is for approved people" on public.pins
  as restrictive for all to authenticated
  using ((select public.has_page_access('atlas')))
  with check ((select public.has_page_access('atlas')));

create policy "atlas is for approved people" on public.pin_notes
  as restrictive for all to authenticated
  using ((select public.has_page_access('atlas')))
  with check ((select public.has_page_access('atlas')));

create policy "atlas is for approved people" on public.pin_photos
  as restrictive for all to authenticated
  using ((select public.has_page_access('atlas')))
  with check ((select public.has_page_access('atlas')));

create policy "atlas is for approved people" on public.parcel_sources
  as restrictive for all to authenticated
  using ((select public.has_page_access('atlas')))
  with check ((select public.has_page_access('atlas')));

create policy "atlas is for approved people" on public.groups
  as restrictive for all to authenticated
  using ((select public.has_page_access('atlas')))
  with check ((select public.has_page_access('atlas')));

create policy "atlas is for approved people" on public.group_members
  as restrictive for all to authenticated
  using ((select public.has_page_access('atlas')))
  with check ((select public.has_page_access('atlas')));

create policy "atlas is for approved people" on public.profiles
  as restrictive for all to authenticated
  using (id = auth.uid() or (select public.has_page_access('atlas')))
  with check (id = auth.uid() or (select public.has_page_access('atlas')));

create policy "atlas is for approved people" on public.usernames
  as restrictive for all to authenticated
  using (user_id = auth.uid() or (select public.has_page_access('atlas')))
  with check (user_id = auth.uid() or (select public.has_page_access('atlas')));

drop policy if exists "atlas files are for approved people" on storage.objects;
create policy "atlas files are for approved people" on storage.objects
  as restrictive for all to authenticated
  using (bucket_id not in ('pin-photos', 'avatars') or (select public.has_page_access('atlas')))
  with check (bucket_id not in ('pin-photos', 'avatars') or (select public.has_page_access('atlas')));

-- ---------------------------------------------------------------------------
-- The DEFINER functions read past every policy above, so they ask for
-- themselves. Bodies are the latest definitions, unchanged except for the guard.
-- ---------------------------------------------------------------------------
create or replace function public.lookup_username(handle text)
returns table (id uuid, username text, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.username, p.display_name, p.avatar_path
    from public.usernames u
    join public.profiles  p on p.id = u.user_id
   where u.username = lower(btrim(coalesce(handle, '')))
     and u.retired_at is null
     and public.has_page_access('atlas')
   limit 1;
$$;

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
    select g.owner
      from public.group_members gm
      join public.groups g on g.id = gm.group_id
     where gm.user_id = auth.uid()
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

create or replace function public.set_username(want text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  norm       text := lower(btrim(coalesce(want, '')));
  current_name text;
  must       boolean;
  last_claim timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  -- Names are a namespace the whole crew shares; an account still waiting for
  -- Ric must not be able to sit on one.
  if not public.has_page_access('atlas') then
    raise exception 'your account is waiting for approval' using errcode = '42501';
  end if;

  if norm !~ '^[a-z][a-z0-9_]{2,19}$' then
    raise exception '3 to 20 characters: lowercase letters, numbers and underscores, starting with a letter'
      using errcode = '22023';
  end if;

  select p.username, p.must_choose_username into current_name, must
    from public.profiles p where p.id = auth.uid();

  if norm = current_name then
    return norm;
  end if;

  if not must then
    select max(u.claimed_at) into last_claim
      from public.usernames u where u.user_id = auth.uid();
    if last_claim > now() - interval '30 days' then
      raise exception 'you can change your username once a month'
        using errcode = '22023';
    end if;
  end if;

  if exists (select 1 from public.usernames u where u.username = norm) then
    raise exception 'that one is taken' using errcode = '23505';
  end if;

  update public.usernames set retired_at = now()
   where user_id = auth.uid() and retired_at is null;

  insert into public.usernames (username, user_id) values (norm, auth.uid());

  update public.profiles
     set username = norm, must_choose_username = false
   where id = auth.uid();

  return norm;
end;
$$;

revoke all on function public.lookup_username(text) from public, anon;
revoke all on function public.people_i_can_draw() from public, anon;
revoke all on function public.set_username(text) from public, anon;
grant execute on function public.lookup_username(text) to authenticated;
grant execute on function public.people_i_can_draw() to authenticated;
grant execute on function public.set_username(text) to authenticated;
