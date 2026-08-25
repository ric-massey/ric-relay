-- ATLAS — a photo of the place belongs to the pin; a photo on a note doesn't.
--
-- The rule everywhere else in here is already that only the person who dropped
-- a pin can change it: the UPDATE and DELETE policies on public.pins have said
-- so since the first migration, and the app hides the name, the description and
-- the privacy switch on somebody else's pin.
--
-- pin_photos was the hole. Its INSERT policy asked only whether you can SEE the
-- pin, which is true of all three of you for nearly every pin — so anyone could
-- add a photo to the photo strip of anyone else's find. That strip is part of
-- the pin. It says "here is what this place looks like", in the pin's own
-- voice, and it should be the finder's voice.
--
-- Notes are the other half of that sentence and they do not change. Anyone may
-- leave a note on any pin they can see, and a note carries its own photos —
-- that is the whole point of the running log, and it is signed and dated by
-- whoever was standing there. So the split is:
--
--   note_id is null  ->  a photo OF THE PLACE. The pin's owner only.
--   note_id present  ->  a photo ON YOUR NOTE. Anyone who can see the pin,
--                        still bound by note_takes_photo() to your own note
--                        on that same pin.
--
-- Nothing already uploaded is touched. This only governs what may be added
-- from here.
drop policy if exists "crew adds photos" on public.pin_photos;
create policy "crew adds photos" on public.pin_photos
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_see_pin(pin_id)
    and public.note_takes_photo(note_id, pin_id)
    and (
      note_id is not null
      or exists (
        select 1 from public.pins p
        where p.id = pin_id and p.created_by = auth.uid()
      )
    )
  );

-- DELETE is deliberately left alone. It is already "your own photo, or anything
-- on a pin of yours", which is the right pair of powers: you can withdraw what
-- you contributed, and the finder can clear their own pin. Tightening it would
-- strand files in the bucket, which the pin_photos migration explains at
-- length.
