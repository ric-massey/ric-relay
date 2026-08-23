-- Editing a note after you have left it.
--
-- The UPDATE policy on pin_notes has allowed this since the table was created;
-- there was simply no way to ask for it. Adding the button turns up one problem
-- that has to be fixed in the database rather than the app.
--
-- pin_notes fires touch_updated_at(), which sets updated_at = now()
-- unconditionally. Everywhere else in ATLAS the phone mints its own timestamps,
-- precisely so that something written in a canyon on Tuesday still says Tuesday
-- when it syncs on Thursday. An edit made offline deserves the same treatment,
-- and the old trigger would have stamped it Thursday.
--
-- So: the trigger now only reaches for now() when the statement did not set
-- updated_at itself. An ordinary UPDATE is unchanged. An offline edit replaying
-- out of the queue carries the moment it was actually made.

create or replace function public.touch_updated_at_unless_set()
returns trigger language plpgsql as $$
begin
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

comment on function public.touch_updated_at_unless_set() is
  'updated_at trigger that yields to a client-supplied value. ATLAS mints
   timestamps on the phone so an offline edit keeps the time it was made.';

drop trigger if exists pin_notes_touch_updated_at on public.pin_notes;
create trigger pin_notes_touch_updated_at
  before update on public.pin_notes
  for each row execute function public.touch_updated_at_unless_set();

-- The one thing an edit must not be able to do is change whose note it is, or
-- move it to another pin. The existing policy checks created_by on both sides
-- of the update; pin_id was not pinned down, so a note could be walked onto a
-- different pin. Nothing in the app does that — but the policy is the lock, not
-- the app, and "the client would never" is how holes stay open.
drop policy if exists "own notes are editable" on public.pin_notes;
create policy "own notes are editable" on public.pin_notes
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and public.can_see_pin(pin_id));

create or replace function public.pin_notes_immutable_bones()
returns trigger language plpgsql as $$
begin
  if new.pin_id <> old.pin_id then
    raise exception 'a note belongs to the pin it was left on';
  end if;
  if new.created_by <> old.created_by then
    raise exception 'a note keeps its author';
  end if;
  if new.created_at <> old.created_at then
    raise exception 'a note keeps the day it was written';
  end if;
  return new;
end;
$$;

drop trigger if exists pin_notes_keep_bones on public.pin_notes;
create trigger pin_notes_keep_bones
  before update on public.pin_notes
  for each row execute function public.pin_notes_immutable_bones();
