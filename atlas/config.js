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
