-- Personal pins.
--
-- Everything is shared by default — that is the point of the map. But some
-- places are nobody else's business even inside the crew, so a pin can be
-- marked personal and then only the person who dropped it can see it.
--
-- This is enforced in the SELECT policy, not in the app. A private pin is not
-- hidden from the interface, it is never sent over the wire at all: the
-- database simply does not return that row to anyone else, no matter what they
-- ask it with.

alter table public.pins
  add column if not exists is_private boolean not null default false;

drop policy if exists "crew reads pins" on public.pins;
create policy "crew reads pins" on public.pins
  for select to authenticated
  using (not is_private or created_by = auth.uid());

-- pins_with_author is security_invoker, so it inherits the policy above rather
-- than bypassing it. Worth stating out loud: a view that did NOT would quietly
-- undo all of this.
comment on view public.pins_with_author is
  'Pins joined to the name of whoever dropped them. security_invoker = true, so
   row-level security on public.pins applies to reads through this view.';
