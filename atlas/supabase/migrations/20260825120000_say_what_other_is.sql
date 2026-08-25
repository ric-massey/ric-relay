-- ATLAS — "other", in your own words.
--
-- Eight of the nine kinds name themselves. The ninth is "other", which is the
-- honest answer often enough — a quarry, a spring house, a mine adit, a hole in
-- the ground nobody has a word for — but it is also the least useful thing a
-- pin can tell you at a glance, and the list row and the search index both had
-- to print the word "other" and mean it.
--
-- So "other" gets a line to say what it actually is. Optional, because half the
-- time there genuinely is no word for it and demanding one would just get an
-- empty string typed in by hand.
alter table public.pins
  add column if not exists kind_other text not null default '';

comment on column public.pins.kind_other is
  'What this place is, in the finder''s words, when kind = ''other''. Empty is
   allowed and normal. Kept when the kind is changed away from other, so that
   changing your mind twice does not lose what you typed.';

-- The view has to carry it or the app cannot read it back. Every column named
-- on purpose: `select p.*` is expanded once at creation, which is how
-- is_private went missing the first time.
drop view if exists public.pins_with_author;

create view public.pins_with_author
with (security_invoker = true) as
select
  p.id,
  p.created_by,
  p.parent_id,
  p.name,
  p.description,
  p.lat,
  p.lng,
  p.accuracy_m,
  p.kind,
  p.kind_other,
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
