-- Where the owner-name lookups come from.
--
-- ATLAS can already say, anywhere in the country and for free, which agency
-- manages a piece of ground, what its legal description is, and which county
-- it is in. What it cannot do from a free nationwide source is put a NAME to a
-- private parcel — that has been checked more than once and it is still true.
-- Names live with county assessors, and every county publishes differently.
--
-- Most of them publish through ArcGIS, though, so one generic adapter covers a
-- lot of them: give it a layer URL that answers point queries and the names of
-- the fields holding the owner, the parcel number, the address and the acreage.
--
-- The adapters live HERE, in the database, and not in the repo. The repo is
-- public and rule 1 is that no location data goes in it — and a list of the
-- counties this crew looks parcels up in is exactly that. So the code ships the
-- mechanism, the database holds the places, which is the same split every other
-- part of ATLAS is built on.

create table if not exists public.parcel_sources (
  id            uuid primary key default gen_random_uuid(),
  label         text not null check (length(btrim(label)) > 0),

  -- An ArcGIS layer URL, without the trailing /query — the app appends that.
  -- https only, and enforced here rather than only in the browser: this row is
  -- a URL that three people's phones will fetch on request, and the check that
  -- matters is the one an attacker cannot skip by not using the form.
  url           text not null check (url ~* '^https://'),

  owner_field   text,
  apn_field     text,
  address_field text,
  acres_field   text,

  -- The county's own page for a parcel. '{apn}' is substituted, and the app
  -- refuses to build a link when it has no parcel number to put in.
  site_url      text check (site_url is null or site_url ~* '^https://'),

  enabled       boolean not null default true,
  created_by    uuid not null references auth.users on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists parcel_sources_enabled_idx on public.parcel_sources (enabled);

drop trigger if exists parcel_sources_touch_updated_at on public.parcel_sources;
create trigger parcel_sources_touch_updated_at
  before update on public.parcel_sources
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security.
--
-- Unlike a pin, a source is not personal — it is plumbing the whole crew shares,
-- so everyone reads every row and anyone can add one. Editing and deleting stay
-- with whoever added it, the same rule as everything else in here.
-- ---------------------------------------------------------------------------
alter table public.parcel_sources enable row level security;

drop policy if exists "crew reads parcel sources" on public.parcel_sources;
create policy "crew reads parcel sources" on public.parcel_sources
  for select to authenticated using (true);

drop policy if exists "crew adds parcel sources" on public.parcel_sources;
create policy "crew adds parcel sources" on public.parcel_sources
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "own parcel sources are editable" on public.parcel_sources;
create policy "own parcel sources are editable" on public.parcel_sources
  for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "own parcel sources are deletable" on public.parcel_sources;
create policy "own parcel sources are deletable" on public.parcel_sources
  for delete to authenticated using (created_by = auth.uid());

comment on table public.parcel_sources is
  'County assessor parcel services, one row per county. Deliberately in the
   database rather than the repo: which counties the crew searches is location
   data, and the repo is public.';
