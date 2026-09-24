-- LOCAL ONLY. `supabase db reset --local` runs this after the migrations; the
-- live project never sees it (`db push` skips seeds unless told --include-seed,
-- which nobody should do).
--
-- The hosted project gives anon and authenticated the standard table privileges
-- on everything in public by default, and ATLAS's migrations were written
-- against that: they grant nothing and let row-level security decide. A local
-- stack from a recent CLI does not, so without this every table answers
-- "permission denied" locally and no policy is ever reached. This puts the live
-- default back so local tests exercise the same policies the live site runs.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
-- ...and then the one set of tables that must NOT be writable directly, exactly
-- as the migration leaves them live.
revoke insert, update, delete on public.site_pages, public.site_admins,
  public.site_access, public.access_requests from anon, authenticated;
