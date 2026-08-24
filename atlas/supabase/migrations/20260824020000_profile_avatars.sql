-- A face on a byline.
--
-- Every pin and every note in here already carries a name, and a name is enough
-- to know who found something. A face is what makes a map three people share
-- read like the crew rather than like a table with initials in it — you scan a
-- list for "what did Silas find" far faster by picture than by word.
--
-- Deliberately the same shape as pin photos, for the same reasons: a PRIVATE
-- bucket read through the session the app already has, an object name that IS
-- the permission model, and the image itself never in a column. A base64 avatar
-- in a text column would be sent down with every profile row on every load,
-- forever, to save one request.
--
-- The one difference from pin photos is who may look: a face is not filed under
-- a pin, so there is no per-pin visibility to check. Any signed-in crew member
-- reads any avatar. That is the whole point of it.

-- ---------------------------------------------------------------------------
-- Where your picture is, or NULL for the monogram
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists avatar_path text;

comment on column public.profiles.avatar_path is
  'Object name inside the private avatars bucket: {user_id}/{avatar_id}.jpg, or
   NULL for the monogram. The avatar_id is minted fresh every time a new picture
   is set rather than the object being overwritten in place, so the path is its
   own cache key — a phone holding the old face offline can never draw it under
   the new path, and there is no version number for anything to get wrong.';

-- The existing "own profile is editable" policy already let you write this
-- column; what it did not do is say the path has to be yours. Nothing terrible
-- follows from pointing your row at someone else's picture among three people
-- who know each other, but the path is load-bearing everywhere else in this
-- schema and it should be here too.
drop policy if exists "own profile is editable" on public.profiles;
create policy "own profile is editable" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (avatar_path is null or public.uuid_segment(avatar_path, 1) = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- The bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Object names carry their own permissions:  {user_id}/{avatar_id}.jpg
--
-- public.uuid_segment() comes from the pin_photos migration and does the same
-- job here: read the owner out of the name rather than out of
-- storage.objects.owner, which has been renamed and deprecated across storage
-- releases. A policy that silently stops matching is one that silently stops
-- protecting. Anything that is not a uuid in that position comes back NULL, and
-- NULL is "no" in every policy below.
-- ---------------------------------------------------------------------------
drop policy if exists "crew reads avatars" on storage.objects;
create policy "crew reads avatars" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "own avatar is writable" on storage.objects;
create policy "own avatar is writable" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.uuid_segment(name, 1) = auth.uid()
  );

-- Update exists so that setting a picture twice in a row, or replaying an
-- upload the phone was not sure had landed, overwrites itself rather than
-- failing. Still only ever your own.
drop policy if exists "own avatar is replaceable" on storage.objects;
create policy "own avatar is replaceable" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and public.uuid_segment(name, 1) = auth.uid()
  )
  with check (
    bucket_id = 'avatars'
    and public.uuid_segment(name, 1) = auth.uid()
  );

-- Replacing a picture deletes the old object, and so does removing one. Without
-- this every face anybody ever tried would sit in the bucket forever, and the
-- row that named it would already be gone — an object whose path nothing
-- records can never be found again to be deleted.
drop policy if exists "own avatar is deletable" on storage.objects;
create policy "own avatar is deletable" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and public.uuid_segment(name, 1) = auth.uid()
  );
