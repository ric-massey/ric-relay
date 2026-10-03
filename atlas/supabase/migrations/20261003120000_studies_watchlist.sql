-- Studies: trial alerts on the site account.
--
-- The Studies page in the Psyche room (projects/psyche/studies.html) searches
-- ClinicalTrials.gov for anybody. Tracking a study — and being told on the
-- front door when its results come out or its status moves — belongs to an
-- account: the same one that opens ATLAS and HERMISCUS, approved the same way.
--
-- It first shipped (2026-10-03) as one list on the Worker behind Ric's
-- password. Ric asked the same day for it to follow the account instead, like
-- HERMISCUS, so each person who is let in has a list of their own.
--
-- Two locks, both required:
--   your rows only        a watchlist is a list of health interests; nobody
--                         reads another person's, Ric included
--   has_page_access(...)  restrictive, so an account that signed itself up a
--                         minute ago and was never approved stores nothing

insert into public.site_pages (key, label, blurb, path, sort) values
  ('studies', 'Studies', 'trial alerts — track clinical trials and hear when results are out',
   'projects/psyche/studies.html', 30)
on conflict (key) do nothing;

create table if not exists public.trial_watch (
  user_id  uuid not null default auth.uid() references auth.users on delete cascade,
  nct_id   text not null check (nct_id ~ '^NCT[0-9]{8}$'),
  title    text not null default '' check (length(title) <= 300),
  -- How the study looked when its owner last said "got it": status, results
  -- yes or no, a few dates. Compared against the live record by the page.
  seen     jsonb check (seen is null or (jsonb_typeof(seen) = 'object' and pg_column_size(seen) <= 2000)),
  seen_at  timestamptz,
  added_at timestamptz not null default now(),
  primary key (user_id, nct_id)
);

alter table public.trial_watch enable row level security;

create policy "your watchlist" on public.trial_watch
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "only with studies access" on public.trial_watch
  as restrictive
  for all to authenticated
  using (public.has_page_access('studies'))
  with check (public.has_page_access('studies'));

-- Two hundred studies a person. A cap, so an approved account cannot turn the
-- table into storage.
create or replace function public.trial_watch_cap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.trial_watch w where w.user_id = new.user_id) >= 200 then
    raise exception 'two hundred tracked studies is the limit — untrack one first';
  end if;
  return new;
end;
$$;

drop trigger if exists trial_watch_cap on public.trial_watch;
create trigger trial_watch_cap before insert on public.trial_watch
  for each row execute function public.trial_watch_cap();

grant all on public.trial_watch to service_role;
grant select, insert, update, delete on public.trial_watch to authenticated;
revoke all on public.trial_watch from anon;
