-- ATLAS — parking, as a pin inside a pin.
--
-- Parking was tried once as two columns on pins (park_lat, park_lng) and
-- scrapped on 2026-08-23; see 20260823220000_drop_parking.sql. This is not that
-- idea again. A pull-off is a place: it has a name ("the wide bit past the
-- second cattle guard"), it earns a photo of the gate, and it earns notes —
-- "washed out in March". Two floats could hold none of that.
--
-- So it is a pin, with a parent. Everything a pin already has comes free:
-- row-level security, the offline queue, notes, photos, who dropped it and
-- when. Nothing new has to be taught how to be careful.
alter table public.pins
  add column if not exists parent_id uuid references public.pins on delete cascade;

create index if not exists pins_parent_idx on public.pins (parent_id);

comment on column public.pins.parent_id is
  'The pin this one serves — a parking spot for it. NULL for a place in its own
   right. One level only, and enforced: see pins_child_follows_parent().';

-- ---------------------------------------------------------------------------
-- A child is not free to disagree with its parent, and the important half of
-- that is privacy.
--
-- A personal pin that nobody else can see, with a parking spot anyone can see
-- fifty metres away, is not a personal pin. The privacy of a place is the
-- privacy of everything that points at it — and a pull-off with a name like
-- "gate for the mine" points hard.
--
-- Same for ownership. Only the person who dropped a pin may change it, which is
-- the rule the whole app is built on; a parking spot IS part of the pin, so a
-- child owned by somebody else would be a way around that rule rather than an
-- exception to it.
--
-- And one level. A parking spot for a parking spot is not a thing, and a chain
-- of them is a cascade nobody can reason about.
-- ---------------------------------------------------------------------------
create or replace function public.pins_child_follows_parent()
returns trigger
language plpgsql
as $$
declare
  parent public.pins%rowtype;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'a pin cannot be its own parking spot';
  end if;

  select * into parent from public.pins where id = new.parent_id;
  if not found then
    raise exception 'parking spot points at a pin that does not exist';
  end if;

  if parent.parent_id is not null then
    raise exception 'parking spots do not get parking spots';
  end if;

  if parent.created_by <> new.created_by then
    raise exception 'only the person who dropped a pin can park at it';
  end if;

  -- Not validated — forced. The client never has to remember, and an older
  -- build that does not know about any of this cannot get it wrong.
  new.is_private := parent.is_private;
  return new;
end;
$$;

drop trigger if exists pins_child_follows_parent on public.pins;
create trigger pins_child_follows_parent
  before insert or update of parent_id, created_by, is_private on public.pins
  for each row execute function public.pins_child_follows_parent();

-- The other direction: making a pin personal later has to take its parking spot
-- with it. Without this, the pin vanishes for everyone else and the pull-off
-- stays on their map, which is the leak in slow motion.
create or replace function public.pins_privacy_cascades()
returns trigger
language plpgsql
as $$
begin
  if new.is_private is distinct from old.is_private then
    update public.pins set is_private = new.is_private
     where parent_id = new.id and is_private is distinct from new.is_private;
  end if;
  return new;
end;
$$;

drop trigger if exists pins_privacy_cascades on public.pins;
create trigger pins_privacy_cascades
  after update of is_private on public.pins
  for each row execute function public.pins_privacy_cascades();

-- ---------------------------------------------------------------------------
-- The view has to carry the new column or the app cannot see it. Every column
-- named on purpose — `select p.*` is expanded once at creation, which is how
-- is_private went missing the first time.
-- ---------------------------------------------------------------------------
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
