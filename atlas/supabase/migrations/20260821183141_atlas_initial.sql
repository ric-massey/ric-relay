-- ATLAS — database schema
-- Run this once in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- Safe to re-run: everything is guarded.

-- ---------------------------------------------------------------------------
-- profiles: the human name behind an account, so a pin can say who dropped it
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  username     text unique not null,
  display_name text,
  created_at   timestamptz not null default now()
);

-- A new account gets a profile automatically. The username is the part of the
-- synthetic email before the @, which is exactly what they typed at login.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    split_part(new.email, '@', 1),
    coalesce(new.raw_user_meta_data->>'display_name', initcap(split_part(new.email, '@', 1)))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any accounts created before this ran.
insert into public.profiles (id, username, display_name)
select id, split_part(email, '@', 1), initcap(split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- pins: the whole point
-- ---------------------------------------------------------------------------
create table if not exists public.pins (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references auth.users on delete cascade,
  name        text not null default '',
  description text not null default '',
  lat         double precision not null,
  lng         double precision not null,
  accuracy_m  double precision,          -- GPS accuracy radius at capture, metres
  kind        text not null default 'spot',
  park_lat    double precision,          -- where you actually left the truck
  park_lng    double precision,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists pins_created_at_idx on public.pins (created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pins_touch_updated_at on public.pins;
create trigger pins_touch_updated_at
  before update on public.pins
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security. This is the actual lock on the door.
-- Without a valid login the database returns nothing, no matter who is asking.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.pins     enable row level security;

drop policy if exists "crew reads profiles" on public.profiles;
create policy "crew reads profiles" on public.profiles
  for select to authenticated using (true);

drop policy if exists "own profile is editable" on public.profiles;
create policy "own profile is editable" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Every signed-in crew member sees every pin. That is the point of the thing:
-- you can go to a spot your brother found without your brother.
drop policy if exists "crew reads pins" on public.pins;
create policy "crew reads pins" on public.pins
  for select to authenticated using (true);

drop policy if exists "crew drops pins" on public.pins;
create policy "crew drops pins" on public.pins
  for insert to authenticated with check (auth.uid() = created_by);

-- You can edit and delete your own pins. Not anyone else's.
drop policy if exists "own pins are editable" on public.pins;
create policy "own pins are editable" on public.pins
  for update to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists "own pins are deletable" on public.pins;
create policy "own pins are deletable" on public.pins
  for delete to authenticated using (auth.uid() = created_by);

-- A view that joins the dropper's name on, so the app gets it in one request.
create or replace view public.pins_with_author
with (security_invoker = true) as
select p.*, pr.username, pr.display_name
from public.pins p
left join public.profiles pr on pr.id = p.created_by;
