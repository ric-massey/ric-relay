-- Force a password change on first sign-in.
--
-- Ric hands out starting passwords over text, so the first thing a new account
-- should do is replace one. The flag also covers the reset path: when Ric resets
-- a forgotten password in the dashboard, flip this back to true and that person
-- gets asked to choose a new one again.

alter table public.profiles
  add column if not exists must_change_password boolean not null default true;

-- Everyone who already exists has a password Ric chose, so they all owe us one.
update public.profiles set must_change_password = true;

-- Clearing the flag goes through here rather than a direct update, so the app
-- can't mark someone done without actually having changed the password first.
create or replace function public.complete_password_change()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set must_change_password = false
  where id = auth.uid();
$$;

revoke all on function public.complete_password_change() from public, anon;
grant execute on function public.complete_password_change() to authenticated;
