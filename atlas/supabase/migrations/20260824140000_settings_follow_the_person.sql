-- ATLAS — settings follow the person, not the phone.
--
-- Every preference lived in IndexedDB. That made the laptop and the phone two
-- different maps: change the base map on one and the other never heard about
-- it, and every new device was handed the first-run setup as though nobody had
-- ever signed in. Those are one bug, not two — the settings were being kept
-- against the device when they are facts about the person.
--
-- prefs is deliberately a single jsonb blob rather than a column per setting.
-- These are one small object read and written whole, they change shape every
-- time the app grows a switch, and none of them is ever queried across rows.
-- A migration per switch would be all cost and no benefit.
alter table public.profiles
  add column if not exists prefs      jsonb   not null default '{}'::jsonb,
  add column if not exists setup_done boolean not null default false;

-- Everybody with an account today has already been through the first run; the
-- column is new, the people are not, and nobody who has been dropping pins for
-- a month should be handed a "welcome to ATLAS" by a schema change.
--
-- must_change_password is the tell. It is true from the moment an invitation is
-- sent and false only once somebody has arrived and chosen their own password,
-- so it marks exactly the accounts that have been used and none of the ones
-- sitting in an inbox waiting to be.
update public.profiles
   set setup_done = true
 where must_change_password = false;

-- No policy change: "own profile is editable" already covers every column of
-- your own row, and "crew reads profiles" makes prefs readable by the other
-- two. That last part is worth being deliberate about rather than surprised by
-- — prefs holds a base map and a home town, not anything private. Nothing that
-- belongs to one person alone goes in here.
