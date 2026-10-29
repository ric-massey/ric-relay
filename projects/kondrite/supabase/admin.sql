-- KONDRITE — Ric's view of the pilots
-- Run this once in the KONDRITE project's SQL editor, after schema.sql.
-- Safe to re-run: everything is guarded.
--
-- ── what this is for ───────────────────────────────────────────────────────
-- ricmassey.com/admin/ (its KONDRITE tab, admin/kondrite.js) lists
-- every pilot who made a KONDRITE account: the email they signed up with, the
-- name on the boards, whether there is a save in the cloud and what they have
-- on the boards — and lets him rename, wipe a save, clear scores, ban or delete.
--
-- ── why it is all functions ────────────────────────────────────────────────
-- Everything in schema.sql says `auth.uid() = user_id`, and nothing here
-- loosens a single one of those policies. Emails live in `auth.users`, which no
-- client can read at all. So every door is a SECURITY DEFINER function that
-- reads past the policies, and the first thing every one of them does is ask
-- `is_admin()` — a definer function without that line would hand every email
-- in the project to anybody who signed up a minute ago. test/admin-sql.js
-- refuses this file if any function loses it.
--
-- ── making Ric the admin ───────────────────────────────────────────────────
-- His email is not written here, on purpose. After running this file, once,
-- in the SQL editor, with the address his KONDRITE account uses:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = '<his address>';

create table if not exists public.admins (
  user_id  uuid primary key references auth.users on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- You may know whether you are one. Nobody writes this table from a browser:
-- with RLS on and no insert, update or delete policy, every write is refused.
drop policy if exists "you know if you are an admin" on public.admins;
create policy "you know if you are an admin" on public.admins
  for select to authenticated using (user_id = auth.uid());

revoke insert, update, delete on public.admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Everybody with an account. One row each, newest first.
-- ---------------------------------------------------------------------------
-- The name is the board name if they have one, else the name they signed up
-- with (user_metadata), which is the one the game shows them. Scores are the
-- best AGREED value per game — the same number the board prints — plus how
-- many reports were made about them at all, witnessed or not.
drop function if exists public.admin_pilots();
create or replace function public.admin_pilots()
returns table (
  user_id uuid, email text, name text, board_name text,
  created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean,
  banned_until timestamptz, is_admin boolean,
  has_save boolean, save_seed bigint, save_updated_at timestamptz, save_bytes integer,
  best jsonb, reports integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
  select u.id,
         coalesce(u.email, '')::text,
         coalesce(p.name, u.raw_user_meta_data ->> 'name', '')::text,
         p.name,
         u.created_at,
         u.last_sign_in_at,
         u.email_confirmed_at is not null,
         u.banned_until,
         exists (select 1 from public.admins a where a.user_id = u.id),
         s.user_id is not null,
         s.seed,
         s.updated_at,
         coalesce(length(s.book), 0),
         coalesce((select jsonb_object_agg(b.game, b.value)
                     from (select a.game, max(a.value) as value
                             from public.agreed_scores a
                            where a.subject = u.id
                            group by a.game) b), '{}'::jsonb),
         (select count(*)::integer from public.scores sc where sc.subject = u.id)
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join public.saves    s on s.user_id = u.id
   order by u.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Changing things. Each one says what it did by raising when it could not.
-- ---------------------------------------------------------------------------

-- A new board name, under exactly the rules a pilot naming themself meets: the
-- profiles constraint and its case-blind unique index still apply, because
-- this writes the same table. The signup name in user_metadata moves with it,
-- or the game would greet them by the old one on their next sign-in.
create or replace function public.admin_rename_pilot(target uuid, new_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  clean text := regexp_replace(btrim(coalesce(new_name, '')), '\s+', ' ', 'g');
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users u where u.id = target) then
    raise exception 'no such pilot' using errcode = '22023';
  end if;
  if clean !~ '^[A-Za-z0-9][A-Za-z0-9 _-]{1,14}[A-Za-z0-9]$' then
    raise exception '3 to 16 characters: letters and numbers, with spaces, - or _ between them'
      using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles p
              where lower(p.name) = lower(clean) and p.user_id <> target) then
    raise exception 'that name is taken' using errcode = '23505';
  end if;

  insert into public.profiles (user_id, name, updated_at)
  values (target, clean, now())
  on conflict (user_id) do update set name = excluded.name, updated_at = now();

  update auth.users
     set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', clean)
   where id = target;

  return clean;
end;
$$;

-- The cloud copy of their book. The copy on their own device is untouched and
-- will go back up the next time they play, which is what a pilot would want
-- after a bad sync and not what a cheat would; for the second, ban.
create or replace function public.admin_wipe_save(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  delete from public.saves where user_id = target;
end;
$$;

-- Every report ABOUT them, and every report they MADE. Both, because a forged
-- board entry is two accounts agreeing, and clearing one side of the lie
-- leaves the other side still vouching for somebody.
create or replace function public.admin_clear_scores(target uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  delete from public.scores where subject = target or reporter = target;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Supabase Auth refuses a sign-in or a token refresh while banned_until is in
-- the future, so a ban takes hold within the hour their current token has
-- left. Zero hours lifts it. Ric cannot ban himself, which is the one mistake
-- here that nobody could undo from the page.
create or replace function public.admin_ban_pilot(target uuid, hours integer)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  ban_end timestamptz;
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'you cannot ban yourself' using errcode = '22023';
  end if;
  if hours is null or hours < 0 then
    raise exception 'hours must be zero or more' using errcode = '22023';
  end if;
  ban_end := case when hours = 0 then null else now() + make_interval(hours => hours) end;
  update auth.users set banned_until = ban_end where id = target;
  if not found then
    raise exception 'no such pilot' using errcode = '22023';
  end if;
  return ban_end;
end;
$$;

-- The account and everything hanging off it: every table in schema.sql
-- references auth.users `on delete cascade`, so the save, the name and every
-- score row go with it. Not undoable. Not yourself.
create or replace function public.admin_delete_pilot(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if target = auth.uid() then
    raise exception 'you cannot delete yourself' using errcode = '22023';
  end if;
  delete from auth.users where id = target;
  if not found then
    raise exception 'no such pilot' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.admin_pilots() from public, anon;
revoke all on function public.admin_rename_pilot(uuid, text) from public, anon;
revoke all on function public.admin_wipe_save(uuid) from public, anon;
revoke all on function public.admin_clear_scores(uuid) from public, anon;
revoke all on function public.admin_ban_pilot(uuid, integer) from public, anon;
revoke all on function public.admin_delete_pilot(uuid) from public, anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_pilots() to authenticated;
grant execute on function public.admin_rename_pilot(uuid, text) to authenticated;
grant execute on function public.admin_wipe_save(uuid) to authenticated;
grant execute on function public.admin_clear_scores(uuid) to authenticated;
grant execute on function public.admin_ban_pilot(uuid, integer) to authenticated;
grant execute on function public.admin_delete_pilot(uuid) to authenticated;
