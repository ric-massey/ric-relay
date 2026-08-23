-- Photos on a pin.
--
-- Stored in Supabase Storage rather than Cloudflare R2, which was the original
-- plan. R2 is cheaper at scale and has no egress fee, but a private R2 bucket
-- needs something server-side to sign URLs, and ATLAS deliberately has no
-- server — it is a static folder plus a database. Storage here reuses the
-- session the app already has and the same row-level security everything else
-- is guarded by, at $0 for three people. If the crew ever outgrows the free
-- tier, that is the moment to revisit R2, and not before.
--
-- The bucket is PRIVATE. Photos are read through short-lived signed URLs, so a
-- leaked link dies on its own, and an unauthenticated request gets nothing.

-- ---------------------------------------------------------------------------
-- One row per photo. The image itself is in the bucket; this is the index.
-- ---------------------------------------------------------------------------
create table if not exists public.pin_photos (
  id         uuid primary key default gen_random_uuid(),
  pin_id     uuid not null references public.pins on delete cascade,
  created_by uuid not null references auth.users on delete cascade,
  path       text not null unique,      -- object name inside the pin-photos bucket
  width      integer,
  height     integer,
  bytes      integer,
  created_at timestamptz not null default now()
);

create index if not exists pin_photos_pin_idx on public.pin_photos (pin_id, created_at);

alter table public.pin_photos enable row level security;

drop policy if exists "crew reads photos" on public.pin_photos;
create policy "crew reads photos" on public.pin_photos
  for select to authenticated
  using (public.can_see_pin(pin_id));

drop policy if exists "crew adds photos" on public.pin_photos;
create policy "crew adds photos" on public.pin_photos
  for insert to authenticated
  with check (created_by = auth.uid() and public.can_see_pin(pin_id));

-- Your own photo, or anyone's photo on a pin of yours. The second half is what
-- makes deleting a pin actually clean up after itself: the rows cascade away on
-- their own, but the objects in the bucket do not, and an object whose row is
-- gone can never be found again to be deleted. Without this, a photo your
-- brother added to your pin would sit in the bucket eating quota forever.
drop policy if exists "own photos are deletable" on public.pin_photos;
create policy "own photos are deletable" on public.pin_photos
  for delete to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.pins p
      where p.id = pin_id and p.created_by = auth.uid()
    )
  );

drop view if exists public.pin_photos_with_author;

create view public.pin_photos_with_author
with (security_invoker = true) as
select
  ph.id,
  ph.pin_id,
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

-- ---------------------------------------------------------------------------
-- The bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('pin-photos', 'pin-photos', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Object names carry their own permissions:  {pin_id}/{uploader_id}/{photo_id}.jpg
--
-- Reading the uploader out of the path rather than out of storage.objects.owner
-- is deliberate. That column has been renamed and deprecated across storage
-- releases, and a policy that silently stops matching is a policy that silently
-- stops protecting. A path is ours and cannot change underneath us.
--
-- Returns NULL for anything that is not a uuid in that position, and every
-- policy below treats NULL as "no", so a malformed name is simply refused.
-- ---------------------------------------------------------------------------
create or replace function public.uuid_segment(object_name text, idx integer)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(object_name, '/', idx) ~
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(object_name, '/', idx)::uuid
  end;
$$;

comment on function public.uuid_segment(text, integer) is
  'Nth slash-separated segment of a storage object name, as a uuid, or NULL if
   that segment is not one. Used by the pin-photos policies.';

drop policy if exists "crew reads pin photos" on storage.objects;
create policy "crew reads pin photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pin-photos'
    and public.can_see_pin(public.uuid_segment(name, 1))
  );

-- You may only write under your own id, and only onto a pin you can see.
drop policy if exists "crew adds pin photos" on storage.objects;
create policy "crew adds pin photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pin-photos'
    and public.uuid_segment(name, 2) = auth.uid()
    and public.can_see_pin(public.uuid_segment(name, 1))
  );

-- Update exists only so that replaying the offline queue is harmless: an upload
-- that already landed before the phone lost signal is re-sent as an upsert and
-- overwrites itself with identical bytes, rather than failing and jamming the
-- queue behind it. It is still restricted to your own objects.
drop policy if exists "own pin photos are replaceable" on storage.objects;
create policy "own pin photos are replaceable" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pin-photos'
    and public.uuid_segment(name, 2) = auth.uid()
  )
  with check (
    bucket_id = 'pin-photos'
    and public.uuid_segment(name, 2) = auth.uid()
  );

-- Same rule as the table above: your upload, or anything on your pin.
drop policy if exists "own pin photos are deletable" on storage.objects;
create policy "own pin photos are deletable" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pin-photos'
    and (
      public.uuid_segment(name, 2) = auth.uid()
      or exists (
        select 1 from public.pins p
        where p.id = public.uuid_segment(name, 1)
          and p.created_by = auth.uid()
      )
    )
  );
