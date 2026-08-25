-- can_add_to_group() was marked IMMUTABLE. It calls auth.uid().
--
-- IMMUTABLE is a promise to the planner: this function depends on nothing but
-- its arguments, so the same input always gives the same answer, forever, for
-- everybody. auth.uid() reads the current request's JWT out of a session
-- setting — it is a different answer for every person who signs in, which is
-- the exact opposite of that promise.
--
-- Postgres does not check. It believes you, and then it is free to evaluate the
-- call once and reuse the result: folded at plan time, cached in a plan that
-- PostgREST hands to the next request on the same pooled connection, hoisted out
-- of a loop. This function is in the WITH CHECK of the policy that decides who
-- may be put in a group, so an answer computed for one person and reused for
-- the next is an authorization decision made for the wrong account.
--
-- Nothing is known to have gone wrong — it shipped hours ago, on a database with
-- three people in it who may all add each other, so a wrong answer and a right
-- answer are currently the same answer. That is luck, not safety.
--
-- STABLE is the correct marking, and is what every other function here that
-- touches auth.uid() already carries: constant within a single statement,
-- recomputed for the next one.
create or replace function public.can_add_to_group(who uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select who is not null and who <> auth.uid();
$$;
