-- KONDRITE — the save table
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: everything is guarded.
--
-- ── why this is its own project ────────────────────────────────────────────
-- Not the project ATLAS uses, deliberately. ATLAS grants reads with
-- `for select to authenticated` and no crew check, so its privacy rests
-- entirely on signup being switched off in the dashboard — and a public game
-- needs signup switched on. One project could not hold both without the first
-- stranger who saved a game being able to read the map.
--
-- The lesson is taken here rather than repeated: every policy below names
-- `auth.uid()`. A stranger with an account sees their own row and nothing else,
-- however many accounts exist and whatever the dashboard is set to.

create table if not exists public.saves (
  user_id    uuid primary key references auth.users on delete cascade,

  -- The book, exactly as the game writes it: one JSON string. Kept as `text`
  -- rather than `jsonb` because the game wants the same string back, and jsonb
  -- is free to reorder keys and drop duplicates on the way through. Nothing
  -- here ever needs to look inside it.
  book       text not null,

  -- Which sector it is, lifted out of the book so a save can be identified
  -- without parsing it. The seed is a uint32; bigint holds it without a cast.
  seed       bigint,

  -- What wrote it last, so a conflict can say "your phone" rather than
  -- "somewhere else". Free text from the client, and treated as such.
  wrote      text not null default '',

  updated_at timestamptz not null default now(),

  -- A save is a save. The ceiling is measured rather than guessed, by the
  -- `chartsize` check in test/survey.js: twenty round trips to the edge of the
  -- abyss — a longer run than anyone will play, in the fragmented shape that
  -- costs run-length encoding the most — charts 46,160 cells and packs to
  -- 121 KB. Half a megabyte is four times that, and a ceiling on what a bad
  -- client can dump into the free tier.
  constraint book_is_a_save check (length(book) <= 512 * 1024)
);

create or replace function public.touch_saves_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saves_touch_updated_at on public.saves;
create trigger saves_touch_updated_at
  before update on public.saves
  for each row execute function public.touch_saves_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security. Your save is yours, and there is nothing else in here.
-- ---------------------------------------------------------------------------
alter table public.saves enable row level security;

drop policy if exists "your save is yours" on public.saves;
create policy "your save is yours" on public.saves
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "you write your own save" on public.saves;
create policy "you write your own save" on public.saves
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "you overwrite your own save" on public.saves;
create policy "you overwrite your own save" on public.saves
  for update to authenticated using (auth.uid() = user_id)
                              with check (auth.uid() = user_id);

drop policy if exists "you may wipe your own save" on public.saves;
create policy "you may wipe your own save" on public.saves
  for delete to authenticated using (auth.uid() = user_id);


-- ===========================================================================
-- THE BOARDS
-- ===========================================================================
-- Added for step 5 of SIMULATIONS.md. Safe to re-run, like everything above.
--
-- ── why a board cannot live in `saves` ─────────────────────────────────────
-- The whole safety property of `saves` is that every policy names `auth.uid()`,
-- so nobody reads anyone else's book. A leaderboard is the exact opposite —
-- everybody reads everybody — and the two postures cannot share a table. So
-- these are their own, and the rule about `auth.uid()` still holds on every
-- write.
--
-- ── the problem these tables exist to solve ────────────────────────────────
-- This is a static client. There is no game server, `net.js` says so in its
-- first line, and signing in gives **identity, not authority**: a signed-in
-- player can POST any score they like from the browser console. An account
-- stops a board being anonymous; it does not stop it being wrong.
--
-- What a multiplayer result has that a solo one never can is that **somebody
-- else was there**. So a score is not a thing you claim about yourself. It is a
-- thing other people *report about you*, and it only counts when two of them
-- agree:
--
--   · every client posts one row per player it saw, saying what that player got
--   · a row is (match, subject, reporter): who it is about, and who says so
--   · a score counts when two different accounts report the same value for the
--     same subject in the same match
--
-- The check is here, in Postgres, and not in the client — a check the client
-- performs is not a check. This defeats casual forgery outright: faking a score
-- stops being a line in the console and becomes two real people agreeing to lie
-- about a game they played, which is a social problem and not one worth
-- engineering against.

-- ---------------------------------------------------------------------------
-- Who you are, publicly. The one thing about an account anybody else can see.
-- ---------------------------------------------------------------------------
-- The email lives in `auth.users` and never leaves it. A board joins to this.
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users on delete cascade,

  -- What the boards print. Three to sixteen characters, letters or digits at
  -- both ends — the same rule the game's own `PILOT` enforces before it ever
  -- gets here, repeated because a constraint the client owns is not one.
  name       text not null
             constraint name_is_a_pilot_name
             check (name ~ '^[A-Za-z0-9][A-Za-z0-9 _-]{1,14}[A-Za-z0-9]$'),

  updated_at timestamptz not null default now()
);

-- One name, one pilot. Case-insensitively, or RIC and ric are two rows that
-- read as one person on a board.
create unique index if not exists profiles_name_unique
  on public.profiles (lower(name));

alter table public.profiles enable row level security;

-- Everybody reads every name: that is what a board is for, and a name is the
-- only thing in here.
drop policy if exists "names are public" on public.profiles;
create policy "names are public" on public.profiles
  for select to authenticated using (true);

drop policy if exists "you name yourself" on public.profiles;
create policy "you name yourself" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "you rename yourself" on public.profiles;
create policy "you rename yourself" on public.profiles
  for update to authenticated using (auth.uid() = user_id)
                               with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- What people say happened.
-- ---------------------------------------------------------------------------
create table if not exists public.scores (
  -- The match everybody is talking about. Made by the host when the match
  -- starts and sent to every guest, so all the reports land under one id.
  match_id   uuid not null,

  -- Whose score this is, and who is saying so. They are usually different
  -- people: the whole point is that your score is something others witnessed.
  subject    uuid not null references auth.users on delete cascade,
  reporter   uuid not null references auth.users on delete cascade,

  game       text not null check (game in ('survival', 'royale', 'campaign')),

  -- Survival: the wave reached. Battle royale: seconds survived. Campaign: the
  -- highest mission cleared. One number, because a board is a ranking.
  value      bigint not null check (value >= 0 and value < 1000000000),

  -- What the number does not say: the difficulty a campaign ran at, the place
  -- a royale finished in. Short, and free text from a client, so it is treated
  -- as such and never as markup.
  detail     text not null default '' check (length(detail) <= 40),

  created_at timestamptz not null default now(),

  -- One report per person per player per match. Saying it twice is saying it
  -- once, which stops a single account agreeing with itself.
  primary key (match_id, subject, reporter)
);

alter table public.scores enable row level security;

-- Read the board freely. This is the half that `saves` must never have.
drop policy if exists "scores are public" on public.scores;
create policy "scores are public" on public.scores
  for select to authenticated using (true);

-- You may only report *as yourself*. You may report about anybody, because
-- reporting about other people is exactly what witnessing is.
drop policy if exists "you report as yourself" on public.scores;
create policy "you report as yourself" on public.scores
  for insert to authenticated with check (auth.uid() = reporter);

-- No update and no delete, for anyone. A score cannot be walked back, and the
-- absence of these policies is what says so: with RLS on, an operation with no
-- policy is refused.

create index if not exists scores_by_game on public.scores (game, value desc);
create index if not exists scores_by_match on public.scores (match_id);

-- ---------------------------------------------------------------------------
-- The agreement rule, which is the only thing that makes any of this real.
-- ---------------------------------------------------------------------------
-- A claim counts when two different accounts made it. `security_invoker` so
-- the reader's own permissions still apply through the view rather than the
-- view's owner's — a view is not a way around row-level security.
create or replace view public.agreed_scores
  with (security_invoker = true) as
  select match_id, subject, game, value,
         count(distinct reporter) as witnesses,
         min(created_at)          as at
    from public.scores
   group by match_id, subject, game, value
  having count(distinct reporter) >= 2;

-- And the board itself: each pilot's best witnessed score per game, with the
-- only public thing about them attached. No email can reach this — there is
-- none in either table it is built from.
create or replace view public.board
  with (security_invoker = true) as
  select a.game,
         a.subject                        as user_id,
         p.name,
         max(a.value)                     as value,
         min(a.at)                        as first_at,
         sum(a.witnesses)                 as witnesses
    from public.agreed_scores a
    join public.profiles p on p.user_id = a.subject
   group by a.game, a.subject, p.name;
