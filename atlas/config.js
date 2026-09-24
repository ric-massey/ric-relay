// ATLAS — configuration.
//
// The anon key belongs here and it is safe to commit: it is designed to sit in
// public JavaScript. Row-level security in the database is what actually guards
// the pins. NEVER put the service_role key in this file — that one bypasses
// every policy and must stay in the dashboard.
window.CONFIG = {
  SUPABASE_URL: 'https://ljnwclgjfctotkmqdlqh.supabase.co',

  // Project Settings -> API -> publishable key.
  SUPABASE_ANON_KEY: 'sb_publishable_O97QmZOjuKjA6KtRP3G84Q_WT2uGmLQ',

};

// On Ric's Mac only: point ATLAS and /account/ at the local Supabase stack
// (`supabase start` in atlas/) instead of the live project, to try database
// changes before they are pushed. Turn on in the browser console with
//   localStorage.setItem('atlas-local-db', '1')
// and off with removeItem. The key is the CLI's fixed local demo key; it opens
// nothing but a database on 127.0.0.1. Visitors never match the hostname.
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  try {
    if (localStorage.getItem('atlas-local-db') === '1') {
      window.CONFIG.SUPABASE_URL = 'http://127.0.0.1:54321';
      window.CONFIG.SUPABASE_ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
    }
  } catch (_) {}
}
