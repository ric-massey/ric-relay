-- Three follow-ups from the 2026-10-17 bug sweep: a ban reaches the pages at
-- once, a page's path is only ever a plain relative path, and somebody who
-- lost Studies can still delete their own watchlist. Needs `supabase db push`.
--
-- A1-5. A ban from /admin set Supabase's ban_duration and nothing else.
-- That refuses the next sign-in and the next token refresh, but an access
-- token already issued stays good until it expires — up to an hour — and
-- has_page_access() never looked at the ban, so a banned person kept reading
-- ATLAS for that hour while /admin said "Banned." Now the lock itself asks.
--
-- A1-10. site_pages.path's check was `path !~ '^(/|[a-z]+:)'`: case
-- sensitive, so `JavaScript:` and ` javascript:` and `\\evil.example` all
-- passed, and account.js puts the path into an href. Only Ric can write the
-- table, but the check read as "relative paths only" and was not.

create or replace function public.has_page_access(page text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and not exists (
      select 1 from auth.users u
       where u.id = auth.uid() and u.banned_until is not null and u.banned_until > now()
    )
    and (
      exists (select 1 from public.site_admins a where a.user_id = auth.uid())
      or exists (
        select 1 from public.site_access s
         where s.user_id = auth.uid() and s.page_key = page
      )
    );
$$;

revoke all on function public.has_page_access(text) from public, anon;
grant execute on function public.has_page_access(text) to authenticated;

alter table public.site_pages drop constraint if exists site_pages_path_check;
alter table public.site_pages add constraint site_pages_path_check
  check (path = '' or path ~ '^[a-z0-9][a-z0-9/_.-]*$');

-- B4-11. A watchlist is a list of health interests, and the restrictive
-- "only with studies access" policy is FOR ALL — so once Ric took Studies away
-- from an account, its owner could no longer see or delete the rows, and they
-- stayed until the whole account was deleted. The policies stay exactly as
-- they are (projects/psyche/test/watch-policy.test.mjs holds them); this is
-- the one door around them, and it only ever deletes, and only the caller's.
create or replace function public.forget_my_watchlist()
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  with gone as (
    delete from public.trial_watch where user_id = auth.uid() and auth.uid() is not null returning 1
  )
  select count(*)::integer from gone;
$$;

revoke all on function public.forget_my_watchlist() from public, anon;
grant execute on function public.forget_my_watchlist() to authenticated;
