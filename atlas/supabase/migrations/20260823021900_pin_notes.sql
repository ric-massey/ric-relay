-- Notes on a pin.
--
-- The description and a note answer different questions, which is why this is a
-- table and not a longer textarea. The description is the finder's writeup —
-- what this place is, how you get in, what you need — and it belongs to whoever
-- found it. A note is what happened afterwards, and it belongs to whoever went:
-- "gate was locked in March", "creek's dry by August", "second entrance is
-- easier". Anyone in the crew can leave one on any pin they can see, including
-- someone else's. That is the entire value of it — the map gets better every
-- time one of you goes somewhere. You edit and delete only your own.

-- ---------------------------------------------------------------------------
-- Can the caller see this pin at all?
--
-- Personal pins are the only exception to "the crew sees everything", and this
-- is the one place that rule gets written down so anything hanging off a pin
-- can reuse it rather than reimplementing it and getting it subtly wrong.
--
-- SECURITY INVOKER — the default, and load-bearing. Marked SECURITY DEFINER
-- this function would bypass row-level security on pins and cheerfully confirm
-- the existence of everyone's private ones.
-- ---------------------------------------------------------------------------
create or replace function public.can_see_pin(p_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.pins p
    where p.id = p_id
      and (not p.is_private or p.created_by = auth.uid())
  );
$$;

comment on function public.can_see_pin(uuid) is
  'True if the current user may read this pin. Anything attached to a pin —
   notes, photos — must gate on this so a personal pin stays personal all the
   way down. Must stay SECURITY INVOKER.';

-- ---------------------------------------------------------------------------
-- The notes themselves
-- ---------------------------------------------------------------------------
create table if not exists public.pin_notes (
  -- Minted on the phone like a pin id, so a note written in a canyon on Tuesday
  -- still says Tuesday when it syncs on Thursday, and replaying the offline
  -- queue twice cannot write it twice.
  id         uuid primary key default gen_random_uuid(),
  pin_id     uuid not null references public.pins on delete cascade,
  created_by uuid not null references auth.users on delete cascade,
  body       text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pin_notes_pin_idx on public.pin_notes (pin_id, created_at);

drop trigger if exists pin_notes_touch_updated_at on public.pin_notes;
create trigger pin_notes_touch_updated_at
  before update on public.pin_notes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.pin_notes enable row level security;

drop policy if exists "crew reads notes" on public.pin_notes;
create policy "crew reads notes" on public.pin_notes
  for select to authenticated
  using (public.can_see_pin(pin_id));

-- Note the second half: you cannot leave a note on a pin you are not allowed to
-- see, which also means you cannot use this table to probe for one.
drop policy if exists "crew leaves notes" on public.pin_notes;
create policy "crew leaves notes" on public.pin_notes
  for insert to authenticated
  with check (created_by = auth.uid() and public.can_see_pin(pin_id));

drop policy if exists "own notes are editable" on public.pin_notes;
create policy "own notes are editable" on public.pin_notes
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "own notes are deletable" on public.pin_notes;
create policy "own notes are deletable" on public.pin_notes
  for delete to authenticated
  using (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Joined to the author, every column named on purpose. `select n.*` is expanded
-- once at creation, so a view written that way silently stops carrying columns
-- added later — which is exactly how is_private went missing from
-- pins_with_author. Named columns make the next ALTER TABLE break loudly here.
-- ---------------------------------------------------------------------------
drop view if exists public.pin_notes_with_author;

create view public.pin_notes_with_author
with (security_invoker = true) as
select
  n.id,
  n.pin_id,
  n.created_by,
  n.body,
  n.created_at,
  n.updated_at,
  pr.username,
  pr.display_name
from public.pin_notes n
left join public.profiles pr on pr.id = n.created_by;

comment on view public.pin_notes_with_author is
  'Notes joined to the name of whoever left them. security_invoker = true, so
   row-level security on public.pin_notes applies to reads through this view.';
