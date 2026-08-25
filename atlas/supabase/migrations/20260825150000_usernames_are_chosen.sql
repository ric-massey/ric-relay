-- Usernames are chosen, not taken off the front of your email.
--
-- `handle_new_user()` has been setting `username = split_part(new.email,'@',1)`
-- since the first migration, and `display_name` to the same thing title-cased.
-- With three brothers that was a shortcut. It does not survive the app getting
-- bigger, for two reasons:
--
--   1. It PUBLISHES half your email address. Your username sits on every pin you
--      drop and every note you leave, so anybody who can see your byline can see
--      the local part of the address you sign in with, and most people's domain
--      is one of four guesses.
--   2. It makes guessing a username and guessing an email THE SAME ATTACK. The
--      whole point of finding people by username and never by address is that a
--      username exists only inside ATLAS and has to be handed to you. A derived
--      one is not handed to you, it is inferred.
--
-- So: an account is born with an opaque placeholder, the person picks a real one
-- the first time they open the app, and the name they pick is theirs — not the
-- address behind it.
--
-- See docs/audiences.md. This is the piece that had to land before anybody else
-- joins, because renaming people after they have handed their name around is a
-- much worse day than doing it while there are three of us.

-- ---------------------------------------------------------------------------
-- Every username anybody has ever worn
--
-- The claim check runs against this table rather than profiles.username, which
-- is the whole trick: a name that has been let go is still IN HERE, so it can
-- never be handed to somebody else. Release `ric`, a stranger claims `ric`, and
-- everybody who was told "add ric" adds the stranger — and adding somebody is
-- what puts your pins in front of them. That is not a cosmetic problem.
--
-- A retired row is never read on the way to a person. It exists to refuse a
-- claim and for nothing else.
-- ---------------------------------------------------------------------------
create table if not exists public.usernames (
  username   text primary key,
  user_id    uuid references auth.users on delete cascade,
  claimed_at timestamptz not null default now(),
  retired_at timestamptz
);

comment on column public.usernames.user_id is
  'Whoever wore this name. NULL means reserved — never anybody''s, and never
   claimable, which is how the words the app needs for itself are held back.';
comment on column public.usernames.retired_at is
  'NULL while this is the name in use. Set once it is let go; the row stays
   forever so the name never comes back on the market.';

-- One name in use per person. Retired rows fall out of the index entirely, so
-- you may have worn twenty and still only answer to one.
create unique index if not exists usernames_current_uniq
  on public.usernames (user_id) where retired_at is null;

create index if not exists usernames_user_idx on public.usernames (user_id);

-- Nobody reads this table. No SELECT policy is not an oversight — with RLS on
-- and no policy, the answer to every query is nothing, and the only way in is
-- through the SECURITY DEFINER functions below, which answer narrow questions.
alter table public.usernames enable row level security;

-- The names the app needs to be able to use for itself, and a few nobody should
-- be able to impersonate their way into. Reserved rows are retired on arrival:
-- they can never be claimed and they belong to no one.
insert into public.usernames (username, user_id, retired_at)
select w, null, now()
from unnest(array[
  'admin','administrator','atlas','support','help','system','root','owner',
  'me','you','everyone','nobody','staff','team','moderator','security'
]) as w
on conflict (username) do nothing;

-- Everybody who already exists keeps the name they have — their bylines are on
-- pins and notes going back to August and nothing should silently change under
-- them. They are asked to pick a real one below.
insert into public.usernames (username, user_id, claimed_at)
select p.username, p.id, p.created_at from public.profiles p
on conflict (username) do nothing;

-- ---------------------------------------------------------------------------
-- Who still owes us a name
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists must_choose_username boolean not null default true;

comment on column public.profiles.must_choose_username is
  'True until the person has picked a username themselves. Set for everybody who
   predates this migration, because what they are called right now came off the
   front of their email address.';

update public.profiles set must_choose_username = true;

comment on column public.profiles.username is
  'The name in use, denormalised here so pins_with_author can join it in one
   query. public.usernames is the authority. Only set_username() writes this —
   the column privilege below is what enforces that.';

-- ---------------------------------------------------------------------------
-- A new account gets a placeholder, and no trace of the address
--
-- The placeholder comes off the user id, which is already visible on every
-- byline in the app, so it discloses nothing that was not out. It is unique for
-- free, which means no retry loop, and it is obviously not a name a person
-- chose, which is the point — it should look like something to replace.
--
-- display_name loses the email too. It used to be initcap() of the local part,
-- which put "Rmbuster82" on every pin somebody dropped and told everybody where
-- their mail goes. An invitation may carry a real name in user metadata; if it
-- does not, the placeholder stands until they open settings.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  placeholder text := 'user-' || substr(replace(new.id::text, '-', ''), 1, 12);
begin
  insert into public.profiles (id, username, display_name, must_choose_username)
  values (
    new.id,
    placeholder,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), placeholder),
    true
  )
  on conflict (id) do nothing;

  insert into public.usernames (username, user_id)
  values (placeholder, new.id)
  on conflict (username) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Picking one
--
-- Everything a person is connected to points at their id, never at this string,
-- so changing it loses nobody: friends hold you by id and the name is drawn
-- fresh. The username has exactly one job — it is the string somebody types to
-- find you before you have met. After that first handshake it is presentation.
-- ---------------------------------------------------------------------------
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

  -- Lowercase only, deliberately. Two names that differ by case are two ways to
  -- write the same word, and a map where `Silas` and `silas` are different
  -- people is a map with an impersonation problem in it.
  if norm !~ '^[a-z][a-z0-9_]{2,19}$' then
    raise exception '3 to 20 characters: lowercase letters, numbers and underscores, starting with a letter'
      using errcode = '22023';
  end if;

  select p.username, p.must_choose_username into current_name, must
    from public.profiles p where p.id = auth.uid();

  if norm = current_name then
    return norm;
  end if;

  -- Nothing depends on the string, so this is not about being stable. Every
  -- change burns a name out of a namespace everybody shares, permanently, and
  -- one account should not be able to hoard a hundred of them. The first pick
  -- is exempt: that is the one we asked them for.
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

revoke all on function public.set_username(text) from public, anon;
grant execute on function public.set_username(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The column nobody may write directly
--
-- "own profile is editable" lets you UPDATE your own row, and without this that
-- includes the username — you could take any name you liked straight from the
-- network tab, retired ones and reserved ones included, and public.usernames
-- would never hear about it. A column privilege says it in one line and cannot
-- be worked around, which a policy on a whole row cannot.
--
-- set_username() is SECURITY DEFINER, so it runs as the owner and is not subject
-- to this. That is the only door.
-- ---------------------------------------------------------------------------
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_path, prefs, setup_done)
  on public.profiles to authenticated;
