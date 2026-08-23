-- A photo on a note, rather than on the pin.
--
-- These answer different questions and the difference is the whole point. A
-- photo on the PIN is what the place is: here is the entrance, here is the
-- crack, here is what you are looking for. A photo on a NOTE is what happened
-- when someone went: here is the gate with a new lock on it, here is the road
-- washed out, here is how low the creek was in August. The first one is true
-- until the place changes. The second one is true about a day, and it is dated
-- and signed by whoever was standing there.
--
-- So a photo gets an optional note_id, and nothing else moves. The object in
-- the bucket is still named {pin_id}/{uploader_id}/{photo_id}.jpg, and the
-- storage policies still read permission out of that name. Permission belongs
-- to the pin — it always did, and a note cannot be seen by anyone who cannot
-- already see the pin it is on, so there is nothing here for a second set of
-- storage policies to protect.

alter table public.pin_photos
  add column if not exists note_id uuid references public.pin_notes on delete cascade;

create index if not exists pin_photos_note_idx on public.pin_photos (note_id, created_at);

comment on column public.pin_photos.note_id is
  'The note this photo was left on, or NULL for a photo of the place itself.
   Cascades: deleting the note deletes the row. The OBJECT is the app''s job —
   see the delete-photos-first dance in deleteNote().';

-- ---------------------------------------------------------------------------
-- A note is one person's account of one trip, so the photos on it are that
-- person's photos. That is not a UI preference — it is what makes the cleanup
-- provable: every photo on a note has exactly one owner, who is also the only
-- person who can delete the note, so there is never a cascade that strands
-- somebody else's file in the bucket with no row left to find it by.
--
-- Written as a function rather than inline in the policy because the inline
-- version is a trap: inside `exists (select ... from pin_notes n where ...)`
-- the bare name `pin_id` binds to n.pin_id, not to the row being inserted, and
-- the check quietly passes for every note in the table.
-- ---------------------------------------------------------------------------
create or replace function public.note_takes_photo(p_note uuid, p_pin uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_note is null or exists (
    select 1 from public.pin_notes n
    where n.id = p_note
      and n.pin_id = p_pin
      and n.created_by = auth.uid()
  );
$$;

comment on function public.note_takes_photo(uuid, uuid) is
  'True if this photo may hang off this note: no note at all, or your own note
   on the same pin. Must stay SECURITY INVOKER.';

drop policy if exists "crew adds photos" on public.pin_photos;
create policy "crew adds photos" on public.pin_photos
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_see_pin(pin_id)
    and public.note_takes_photo(note_id, pin_id)
  );

-- There is deliberately still no UPDATE policy on this table, which is what
-- stops a photo being walked onto another note or another pin after the fact.
-- The offline queue re-sends photo inserts as upserts, but only ever with the
-- row it minted, and only when the insert never landed in the first place.

-- ---------------------------------------------------------------------------
-- The view names every column on purpose. `select ph.*` is expanded once when
-- the view is created, so a view written that way would still be serving the
-- old column list right now and note_id would simply never arrive in the app —
-- silently, with every photo reappearing on the pin.
-- ---------------------------------------------------------------------------
drop view if exists public.pin_photos_with_author;

create view public.pin_photos_with_author
with (security_invoker = true) as
select
  ph.id,
  ph.pin_id,
  ph.note_id,
  ph.created_by,
  ph.path,
  ph.width,
  ph.height,
  ph.bytes,
  ph.created_at,
  pr.username,
  pr.display_name
from public.pin_photos ph
left join public.profiles pr on pr.id = ph.created_by;

comment on view public.pin_photos_with_author is
  'Photo index joined to the name of whoever uploaded it. security_invoker =
   true, so row-level security on public.pin_photos applies through the view.';
