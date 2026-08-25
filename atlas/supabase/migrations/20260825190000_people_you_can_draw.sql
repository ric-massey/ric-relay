-- Whose name and face you are allowed to resolve.
--
-- `crew reads profiles ... using (true)` has been in since the first migration:
-- any signed-in account could read every profile in the database. With three
-- brothers that was the truth of the thing. It is not survivable at the size
-- this is being built for — a readable profiles table is a roster, and a roster
-- is the thing that makes a place browsable.
--
-- What replaces it is not "the people you are allowed to know about". It is the
-- narrower and more useful question: **whose face does the app have to be able
-- to draw?** A name with no face beside it, or a byline that says nothing, is a
-- broken screen, and it is broken in a way the person reading it cannot fix.
--
-- The answer is four things:
--
--   * you
--   * people in your groups                — you put them there
--   * people whose groups you are in       — they put you there
--   * people whose pins, notes and photos you can already see
--
-- The middle two are the pair Ric asked for, and the second of them is the
-- interesting one: somebody who has filed you can be drawn by you, before they
-- have shared anything at all. It is a small disclosure and it buys something
-- worth more — there is no state in which the app has a face it cannot render.
--
-- THE RULE THAT MAKES IT SAFE: this set is never enumerated to anybody. It
-- resolves a name that is already on screen for some other reason. There is no
-- screen that lists it, no query that walks it, and there must never be one —
-- the moment it is shown as a list it stops being "who can be drawn" and starts
-- being "who has you filed", which is a different and much louder fact. Same
-- discipline as the user id: it identifies, it never authorizes, it is never
-- an entry point. See docs/audiences.md.

-- ---------------------------------------------------------------------------
-- The set
--
-- SECURITY DEFINER, and takes no parameters — so there is nothing to point it
-- at somebody else, and it can only ever describe the caller. Same
-- justification as my_groups() in docs/audiences.md; contrast can_see_pin(),
-- which takes an id, performs no check of its own, and must stay INVOKER
-- forever.
--
-- It has to be DEFINER because two of the four clauses read rows the caller
-- cannot: `groups` is owner-only, so "groups I am a member of" is invisible to
-- me by design, and that is exactly the question being asked here.
-- ---------------------------------------------------------------------------
create or replace function public.people_i_can_draw()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct who), '{}')
  from (
    select auth.uid() as who

    -- People in your groups.
    union all
    select gm.user_id
      from public.group_members gm
      join public.groups g on g.id = gm.group_id
     where g.owner = auth.uid()

    -- People whose groups you are in. You are not told which group, or that
    -- there is one — only that this person is somebody the app may have to
    -- draw for you.
    union all
    select g.owner
      from public.group_members gm
      join public.groups g on g.id = gm.group_id
     where gm.user_id = auth.uid()

    -- Anybody whose work you can already see. Today that is nearly everybody,
    -- because a pin is visible to the whole crew unless it is personal — which
    -- is the correct answer while that is still how pins work. When pin
    -- audiences land this clause narrows on its own, without being edited,
    -- because can_see_pin() is the only thing it asks.
    union all
    select p.created_by from public.pins p
     where not p.is_private or p.created_by = auth.uid()
    union all
    select n.created_by from public.pin_notes n where public.can_see_pin(n.pin_id)
    union all
    select ph.created_by from public.pin_photos ph where public.can_see_pin(ph.pin_id)
  ) s
  where who is not null;
$$;

comment on function public.people_i_can_draw() is
  'The user ids whose profile the caller may read: themselves, their group
   members, the owners of groups they are in, and the authors of anything they
   can already see. Takes no parameters on purpose — it can only ever describe
   the caller. NEVER show this set to anybody as a list: it resolves faces that
   are already on screen, and enumerated it would read as "who has you filed".';

-- ---------------------------------------------------------------------------
-- The policy
--
-- Written as array containment against a scalar subquery, which is deliberate on
-- both counts. The subquery makes Postgres run the function ONCE as an InitPlan
-- rather than once per row — nothing at three people, the whole page at three
-- hundred. And `<@` rather than `= any(...)`: with the subquery in that
-- position the parser reads `any (subquery)` and tries to compare a uuid to a
-- uuid[], which does not typecheck.
-- ---------------------------------------------------------------------------
drop policy if exists "crew reads profiles" on public.profiles;
drop policy if exists "profiles you have to be able to draw" on public.profiles;
create policy "profiles you have to be able to draw" on public.profiles
  for select to authenticated
  using (array[id] <@ (select public.people_i_can_draw()));

-- ---------------------------------------------------------------------------
-- can_add_to_group() has to stop reading profiles, for the same reason
--
-- It checked that the person exists with `exists (select 1 from profiles ...)`,
-- and it is SECURITY INVOKER — so the moment the policy above lands, that check
-- can only see people you can ALREADY draw, and putting somebody new in a group
-- becomes impossible. Which is precisely backwards: adding a person you have
-- never shared anything with is the entire job.
--
-- The check was redundant anyway. group_members.user_id references auth.users,
-- so an id belonging to nobody is refused by the foreign key without anybody
-- having to ask a question first. Taking the read out fixes the breakage AND
-- removes an existence oracle rather than trading one for the other — which is
-- what making this function DEFINER would have done.
--
-- Still SECURITY INVOKER, and still the seam where the mutual-connection check
-- lands before this app grows.
-- ---------------------------------------------------------------------------
create or replace function public.can_add_to_group(who uuid)
returns boolean
language sql
immutable
set search_path = public
as $$
  select who is not null and who <> auth.uid();
$$;

comment on function public.can_add_to_group(uuid) is
  'Whether the caller may put this person in one of their groups. The seam where
   the mutual-connection check lands — see docs/audiences.md. Must stay SECURITY
   INVOKER. It deliberately does not check that the account exists: the foreign
   key on group_members.user_id does that, without answering questions about
   people the caller cannot see.';

-- ---------------------------------------------------------------------------
-- lookup_username() is unaffected and has to be
--
-- It is SECURITY DEFINER, so it reads past the policy above — which is the
-- point. Finding somebody you have never met is the one thing a username is
-- for, and it would be a strange app where you could only look up people you
-- could already see. It still answers one exact name, one row, and only the
-- fields that are already on a byline.
-- ---------------------------------------------------------------------------
