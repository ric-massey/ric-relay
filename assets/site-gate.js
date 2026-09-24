/* One account for the whole site — the question a locked page asks.
 *
 *   <script src="https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
 *   <script src="<root>/atlas/config.js"></script>
 *   <script src="<root>/assets/site-gate.js"></script>
 *   ...
 *   const gate = await SiteGate.check('hermiscus');
 *   // gate.state: 'signed-out' | 'waiting' | 'denied' | 'ok'
 *
 * The account IS the ATLAS account: same Supabase project, same session (the
 * browser keeps one per origin, so signing in here signs you into ATLAS and the
 * other way round). Accounts are made and approved at /account/.
 *
 * Read this before locking a new page with it: this decides what the page SHOWS.
 * It cannot hide anything the page's own files already contain — the site is a
 * public repo. Only data kept in the database behind has_page_access() is
 * actually private. See atlas/README.md, "One account for the whole site". */
(() => {
  const script = document.currentScript;
  const root = new URL('../', script.src);
  let client = null;

  function db() {
    if (client) return client;
    const cfg = window.CONFIG || {};
    if (!window.supabase || !cfg.SUPABASE_URL) throw new Error('site-gate: supabase-js and atlas/config.js must load first');
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    return client;
  }

  async function check(page) {
    const { data: { session } } = await db().auth.getSession();
    if (!session) return { state: 'signed-out' };
    const email = session.user.email || '';
    const [{ data: allowed, error }, { data: request }] = await Promise.all([
      db().rpc('has_page_access', { page }),
      db().from('access_requests').select('status,pages').eq('user_id', session.user.id).maybeSingle(),
    ]);
    if (error) return { state: 'error', email, error };
    if (allowed) return { state: 'ok', email };
    if (request && request.status === 'denied') return { state: 'denied', email };
    // 'asked': this page is in a request Ric has not answered yet.
    const asked = !!(request && request.status === 'pending' && (request.pages || []).includes(page));
    return { state: 'waiting', email, asked };
  }

  // The "request permission" button on a locked page. A person has one request
  // at a time, and asking replaces it, so anything already waiting rides along.
  async function requestAccess(page) {
    const { data: { session } } = await db().auth.getSession();
    if (!session) throw new Error('not signed in');
    const { data: request } = await db().from('access_requests')
      .select('status,pages,note').eq('user_id', session.user.id).maybeSingle();
    const waiting = request && request.status === 'pending' ? request.pages || [] : [];
    const { error } = await db().rpc('request_access', {
      who: '', why: (request && request.note) || '', wanted: [...new Set([...waiting, page])],
    });
    if (error) throw error;
  }

  async function signIn(email, password) {
    const { error } = await db().auth.signInWithPassword({
      email: String(email || '').trim().toLowerCase(), password: String(password || ''),
    });
    if (error) throw error;
  }

  async function signOut() { await db().auth.signOut(); }

  window.SiteGate = Object.freeze({
    check, signIn, signOut, requestAccess, db,
    accountUrl: new URL('account/', root).href,
  });
})();
