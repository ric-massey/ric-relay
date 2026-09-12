/* CROSSFIRE — the account service.
 *
 * Blank here means "no accounts": the game makes no request, the account panel
 * says so, and Survey saves to this browser the way it always has. Everything
 * still works. Fill these in to switch cloud saves on.
 *
 * ── where these come from ──
 * A Supabase project of its own — deliberately NOT the one ATLAS uses. ATLAS
 * grants reads to any signed-in account with no crew check, so its privacy
 * rests on signup being switched off in its dashboard, and a public game needs
 * signup switched on. See supabase/schema.sql.
 *
 *   1. supabase.com → New project (the free plan is enough)
 *   2. SQL Editor → paste supabase/schema.sql → Run
 *   3. Project Settings → API → copy the URL and the publishable key below
 *
 * The publishable key belongs in public JavaScript and is safe to commit: it is
 * designed for it, and row-level security on `public.saves` is what actually
 * keeps one player's save away from another's. NEVER put the service_role key
 * in this file — that one bypasses every policy.
 */
window.CROSSFIRE_CLOUD = {
  url: "https://zsmrcptmyvndrskrciil.supabase.co",
  anonKey: "sb_publishable_tkcvBQipD1_PQgo7khYhWQ_YqvvtcSO"
};
