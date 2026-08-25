-- Lock the door on people_i_can_draw().
--
-- A Postgres function is EXECUTE-able by PUBLIC unless somebody says otherwise,
-- and PUBLIC here includes `anon` — the role every unauthenticated request to
-- the API arrives as. people_i_can_draw() went out in the previous migration
-- without the revoke that set_username() and lookup_username() both have, and
-- because it is SECURITY DEFINER it reads past every policy in the database.
--
-- So an anonymous request got back a list of real user ids: everybody who has
-- ever dropped a pin that is not personal. Not names, not places, but the ids
-- themselves are a roster of who exists here, handed to anybody with the
-- publishable key — which is in the public JavaScript, by design.
--
-- Caught by asking the live API for it with nothing but that key, which is the
-- only way this class of mistake shows itself: the function is correct, the
-- policy that uses it is correct, and the hole is in neither of them.
--
-- The lesson worth keeping: a SECURITY DEFINER function is not private because
-- the policy that calls it is. Every one of them needs the two lines below, and
-- an audit of the rest is at the bottom.

revoke all on function public.people_i_can_draw() from public, anon;
grant execute on function public.people_i_can_draw() to authenticated;

-- ---------------------------------------------------------------------------
-- The rest of them, checked rather than assumed
--
-- can_see_pin() and can_add_to_group() are SECURITY INVOKER, so anon calling
-- them gets what anon can see, which is nothing — they are left open because
-- shutting them changes nothing and a revoke that does not matter is a line
-- somebody has to work out later. complete_password_change(), set_username()
-- and lookup_username() were already locked when they were written.
--
-- handle_new_user() returns trigger and cannot be called over the API at all.
-- ---------------------------------------------------------------------------
