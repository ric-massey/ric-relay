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
