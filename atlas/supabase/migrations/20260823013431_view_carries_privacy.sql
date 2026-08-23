-- pins_with_author was defined as `select p.*`, and Postgres expands that once,
-- at creation. Adding pins.is_private therefore never reached the view, so the
-- app could not tell a personal pin from a shared one. (Row-level security was
-- never affected — the view is security_invoker, so private rows were already
-- being withheld. This was a missing column, not a leak.)
--
-- Recreated with every column named, so the next ALTER TABLE fails loudly here
-- instead of going quietly missing.

drop view if exists public.pins_with_author;

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
  p.park_lat,
  p.park_lng,
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
