-- Parking is gone.
--
-- A pin could carry a second point — the pull-off, the gate, the wide spot on
-- the forest road — on the reasoning that the place you came for is usually not
-- somewhere you can drive to. Ric scrapped the idea on 2026-08-23. It is out of
-- the app entirely: the block in the sheet, the marker, the dashed line to the
-- pin, the directions button, the whole of it.
--
-- THIS MIGRATION DESTROYS DATA. Every parking point anyone has saved goes with
-- these two columns and there is no undo. That is the intent — a column the app
-- can no longer read or write is worse than no column, because it looks like a
-- feature to the next person who opens the schema. But it is worth being clear
-- about what running it does, and worth checking first if it matters:
--
--   select count(*) from public.pins where park_lat is not null;
--
-- The view has to be rebuilt rather than altered: `pins_with_author` names
-- park_lat and park_lng explicitly, so dropping the columns underneath it would
-- fail on the dependency. Dropped and recreated in the same transaction, which
-- is what a migration already is.

drop view if exists public.pins_with_author;

alter table public.pins
  drop column if exists park_lat,
  drop column if exists park_lng;

-- Every column named on purpose, as everywhere else in here. `select p.*` is
-- expanded once when the view is created, so a view written that way silently
-- stops carrying columns added later — which is exactly how is_private went
-- missing the first time.
create view public.pins_with_author
with (security_invoker = true) as
select
  p.id,
  p.created_by,
  p.name,
  p.description,
  p.lat,
  p.lng,
  p.accuracy_m,
  p.kind,
  p.is_private,
  p.created_at,
  p.updated_at,
  pr.username,
  pr.display_name
from public.pins p
left join public.profiles pr on pr.id = p.created_by;

comment on view public.pins_with_author is
  'Pins joined to the name of whoever dropped them. security_invoker = true, so
   row-level security on public.pins applies to reads through this view.';
