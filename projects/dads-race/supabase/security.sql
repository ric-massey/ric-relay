-- HERMISCUS authentication and Row Level Security
-- REVIEW FIRST. Run in the existing Supabase SQL editor only when the local app is ready.
-- This file intentionally creates no users and contains no passwords.

begin;

create table if not exists public.race_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.link_hermiscus_member()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  matched_profile uuid;
  account_slug text;
begin
  if split_part(lower(new.email), '@', 2) <> 'hermiscus.local' then
    return new;
  end if;

  account_slug := split_part(lower(new.email), '@', 1);
  select p.id into matched_profile
  from public.profiles p
  where regexp_replace(lower(p.name), '[^a-z0-9]+', '', 'g') =
        regexp_replace(account_slug, '[^a-z0-9]+', '', 'g')
  limit 1;

  if matched_profile is not null then
    insert into public.race_members(user_id, profile_id, active)
    values (new.id, matched_profile, true)
    on conflict (user_id) do update
      set profile_id = excluded.profile_id, active = true;
  end if;
  return new;
end;
$$;

drop trigger if exists on_hermiscus_user_created on auth.users;
create trigger on_hermiscus_user_created
  after insert or update of email on auth.users
  for each row execute function public.link_hermiscus_member();

-- Link any matching accounts that were created before this script ran.
insert into public.race_members(user_id, profile_id, active)
select u.id, p.id, true
from auth.users u
join public.profiles p
  on regexp_replace(lower(p.name), '[^a-z0-9]+', '', 'g') =
     regexp_replace(split_part(lower(u.email), '@', 1), '[^a-z0-9]+', '', 'g')
where split_part(lower(u.email), '@', 2) = 'hermiscus.local'
on conflict (user_id) do update
  set profile_id = excluded.profile_id, active = true;

create or replace function public.is_race_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.race_members m
    where m.user_id = auth.uid() and m.active
  );
$$;

create or replace function public.current_race_member_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.name
  from public.race_members m
  join public.profiles p on p.id = m.profile_id
  where m.user_id = auth.uid() and m.active
  limit 1;
$$;

create or replace function public.is_race_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.race_members m
    join public.profiles p on p.id = m.profile_id
    where m.user_id = auth.uid() and m.active and lower(p.role) = 'manager'
  );
$$;

revoke all on function public.is_race_member() from public, anon;
revoke all on function public.current_race_member_name() from public, anon;
revoke all on function public.is_race_manager() from public, anon;
grant execute on function public.is_race_member() to authenticated;
grant execute on function public.current_race_member_name() to authenticated;
grant execute on function public.is_race_manager() to authenticated;

alter table public.race_members enable row level security;
alter table public.profiles enable row level security;
alter table public.checklist_items enable row level security;
alter table public.splits enable row level security;
alter table public.timeline_events enable row level security;
alter table public.notes enable row level security;
alter table public.config enable row level security;

-- Remove earlier permissive policies so an old anonymous policy cannot bypass this lock.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'race_members','profiles','checklist_items','splits',
        'timeline_events','notes','config'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I',
      policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

revoke all on table public.race_members from anon;
revoke all on table public.profiles from anon;
revoke all on table public.checklist_items from anon;
revoke all on table public.splits from anon;
revoke all on table public.timeline_events from anon;
revoke all on table public.notes from anon;
revoke all on table public.config from anon;

grant select on public.race_members to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.checklist_items to authenticated;
grant select, insert, update, delete on public.splits to authenticated;
grant select, insert, update, delete on public.timeline_events to authenticated;
grant select, insert, update, delete on public.notes to authenticated;
grant select, insert, update, delete on public.config to authenticated;

create policy "members read own membership"
  on public.race_members for select to authenticated
  using (user_id = auth.uid() and active);

create policy "members read profiles"
  on public.profiles for select to authenticated
  using (public.is_race_member());
create policy "managers add profiles"
  on public.profiles for insert to authenticated
  with check (public.is_race_manager());
create policy "managers update profiles"
  on public.profiles for update to authenticated
  using (public.is_race_manager()) with check (public.is_race_manager());
create policy "managers delete profiles"
  on public.profiles for delete to authenticated
  using (public.is_race_manager());

create policy "members read checklist"
  on public.checklist_items for select to authenticated
  using (public.is_race_member());
create policy "members add checklist"
  on public.checklist_items for insert to authenticated
  with check (public.is_race_member());
create policy "members update checklist"
  on public.checklist_items for update to authenticated
  using (public.is_race_member()) with check (public.is_race_member());
create policy "members delete checklist"
  on public.checklist_items for delete to authenticated
  using (public.is_race_member());

create policy "members read splits"
  on public.splits for select to authenticated
  using (public.is_race_member());
create policy "managers add splits"
  on public.splits for insert to authenticated
  with check (public.is_race_manager());
create policy "members update splits"
  on public.splits for update to authenticated
  using (public.is_race_member()) with check (public.is_race_member());
create policy "managers delete splits"
  on public.splits for delete to authenticated
  using (public.is_race_manager());

create policy "members read timeline"
  on public.timeline_events for select to authenticated
  using (public.is_race_member());
create policy "members add timeline"
  on public.timeline_events for insert to authenticated
  with check (public.is_race_member());
create policy "members update timeline"
  on public.timeline_events for update to authenticated
  using (public.is_race_member()) with check (public.is_race_member());
create policy "managers delete timeline"
  on public.timeline_events for delete to authenticated
  using (public.is_race_manager());

create policy "members read notes"
  on public.notes for select to authenticated
  using (public.is_race_member());
create policy "members write own notes"
  on public.notes for insert to authenticated
  with check (public.is_race_member() and author = public.current_race_member_name());
create policy "authors update notes"
  on public.notes for update to authenticated
  using (author = public.current_race_member_name() or public.is_race_manager())
  with check (author = public.current_race_member_name() or public.is_race_manager());
create policy "authors delete notes"
  on public.notes for delete to authenticated
  using (author = public.current_race_member_name() or public.is_race_manager());

create policy "members read config"
  on public.config for select to authenticated
  using (public.is_race_member());
create policy "members add config"
  on public.config for insert to authenticated
  with check (public.is_race_member());
create policy "members update config"
  on public.config for update to authenticated
  using (public.is_race_member()) with check (public.is_race_member());
create policy "managers delete config"
  on public.config for delete to authenticated
  using (public.is_race_manager());

commit;
