-- Groups.
--
-- A group is a list of people you keep, so that saying who may see a place is
-- one tap instead of picking names one at a time. It belongs to you and to
-- nobody else: its name, the fact that it exists, and who is in it are all
-- yours, and the people in it are never told.
--
-- That last part is not politeness, it is the design. What a group is FOR is
-- deciding an audience, and an audience is a fact about a pin — "these seven
-- people can see this" — which everybody who can see the pin gets to know. The
-- group is the tool you built the audience with, and the tool stays private, so
-- that two of your people never learn how you have them filed. See
-- docs/audiences.md.
--
-- Nothing here touches pins yet. This is the list; what it can be pointed at
-- comes next.

-- ---------------------------------------------------------------------------
-- The groups
-- ---------------------------------------------------------------------------
create table if not exists public.groups (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

create index if not exists groups_owner_idx on public.groups (owner, created_at);

-- Two groups called the same thing, or called the same thing in different
-- capitals, is a picker you cannot read. Scoped to the owner: your "hunting" and
-- your brother's "hunting" have nothing to do with each other.
create unique index if not exists groups_owner_name_uniq
  on public.groups (owner, lower(btrim(name)));

create table if not exists public.group_members (
  group_id uuid not null references public.groups on delete cascade,
  user_id  uuid not null references auth.users    on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- The index the audience check will read: "which groups is this person in",
-- asked once per query and never per pin.
create index if not exists group_members_user_idx
  on public.group_members (user_id, group_id);

-- ---------------------------------------------------------------------------
-- Row-level security: the owner, and nobody else, including the members
--
-- There is deliberately no policy that lets you read a group you are IN. Being
-- in one is not a thing you are told, and a member who could read the row could
-- read its name and the rest of its membership — which is every person you have
-- ever grouped, handed to every person you have ever grouped.
-- ---------------------------------------------------------------------------
alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

drop policy if exists "your groups are yours" on public.groups;
create policy "your groups are yours" on public.groups
  for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- ---------------------------------------------------------------------------
-- Who may be put in a group
--
-- Today: anybody with an account, other than you. There are three of us and we
-- are brothers, so that is the true answer right now.
--
-- It is a function anyway, because it is the seam. docs/audiences.md says a
-- mutual connection has to gate this before the app grows — being added to a
-- group is being shown, by name and face, to people you may never have heard
-- of, and nobody should be able to do that to you just because they know what
-- you are called. When connections exist, the check goes HERE, in one place,
-- and every route into group_members is gated by it at once.
--
-- SECURITY INVOKER, like can_see_pin() and for the same reason: it is the check
-- itself, so it must not be able to see further than its caller.
-- ---------------------------------------------------------------------------
create or replace function public.can_add_to_group(who uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select who is not null
     and who <> auth.uid()
     and exists (select 1 from public.profiles p where p.id = who);
$$;

comment on function public.can_add_to_group(uuid) is
  'Whether the caller may put this person in one of their groups. The seam where
   the mutual-connection check lands — see docs/audiences.md. Must stay SECURITY
   INVOKER.';

drop policy if exists "members of your own groups" on public.group_members;
create policy "members of your own groups" on public.group_members
  for select to authenticated
  using (exists (select 1 from public.groups g
                  where g.id = group_id and g.owner = auth.uid()));

drop policy if exists "you add to your own groups" on public.group_members;
create policy "you add to your own groups" on public.group_members
  for insert to authenticated
  with check (
    exists (select 1 from public.groups g
             where g.id = group_id and g.owner = auth.uid())
    and public.can_add_to_group(user_id)
  );

-- Taking somebody out has to be immediate and total. There is no update policy:
-- a membership is not edited, it is granted or it is gone.
drop policy if exists "you remove from your own groups" on public.group_members;
create policy "you remove from your own groups" on public.group_members
  for delete to authenticated
  using (exists (select 1 from public.groups g
                  where g.id = group_id and g.owner = auth.uid()));

-- ---------------------------------------------------------------------------
-- Finding somebody to add
--
-- Exact username, at most one row, and nothing that is not already on a byline.
-- No prefix match, no fuzzy, no list — a search that takes a name and hands back
-- people is the one feature that would turn this into a place you can be browsed
-- in. There is no lookup by email at all, deliberately: an address exists out in
-- the world and is often guessable, so answering them would be an oracle for
-- which of the people you know are here.
--
-- SECURITY DEFINER for exactly one reason: public.usernames has no SELECT policy
-- and this has to read retired_at from it, so that a name somebody has let go
-- finds nobody rather than finding them. Every column it returns is already
-- readable from profiles by any signed-in person.
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
   limit 1;
$$;

revoke all on function public.lookup_username(text) from public, anon;
grant execute on function public.lookup_username(text) to authenticated;
