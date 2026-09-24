# HERMISCUS access setup

Do not publish the app or run `security.sql` until the local UI and the existing
Supabase table names have been reviewed together.

1. In Supabase Authentication, disable public user sign-ups.
2. Create each crew account manually. Use `<lowercase-name>@hermiscus.local`, such
   as `victoria@hermiscus.local`, and set a unique password. Do not put a password
   in this repository or send one through GitHub.
3. Run `security.sql` in the Supabase SQL editor. It links matching auth accounts
   to existing profile rows, revokes anonymous table access, and installs RLS.
4. Open the app in a private browser window. Confirm that no race page opens while
   signed out, then sign in as one non-manager and one manager.
5. Confirm that both can read race data, neither can impersonate another URL, and
   only managers can alter profiles or delete race structure.

The key in `shared/config.js` is Supabase's public browser key. It is not a
password and cannot bypass RLS. A `service_role` key must never be used here.
