/* Admin — KONDRITE's pilots. Data only, no drawing.
 *
 * KONDRITE keeps its accounts in its own Supabase project ("crossfire" in the
 * dashboard), so this is a second sign-in. It shares the game's session — same
 * origin, same storage key, same shape cloud.js writes — so a browser signed
 * into the game is signed in here.
 *
 * Every read and change is a function in projects/kondrite/supabase/admin.sql
 * that asks is_admin() first; nothing here is trusted. */
(() => {
  'use strict';
  const CFG = window.KONDRITE_CLOUD || {};
  const BASE = String(CFG.url || '').replace(/\/+$/, '');
  const KEY = String(CFG.anonKey || '');
  const SESSION_KEY = 'kondrite.account.v1';   // cloud.js's key — keep in step
  let sess = null;

  const read = () => {
    try { const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); return s && s.access && s.refresh ? s : null; }
    catch (_) { return null; }
  };
  const write = (s) => {
    sess = s;
    try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch (_) {}
  };
  // The same shape cloud.js's fromAuth() makes, so the game reads it as its own.
  const fromAuth = (j) => ({
    access: j.access_token, refresh: j.refresh_token,
    userId: j.user && j.user.id, email: (j.user && j.user.email) || '',
    name: String((j.user && j.user.user_metadata && j.user.user_metadata.name) || ''),
    expires: Date.now() + Math.max(0, (Number(j.expires_in) || 3600) - 60) * 1000,
  });

  async function call(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { apikey: KEY, 'Content-Type': 'application/json' };
    if (auth && sess) headers.Authorization = 'Bearer ' + sess.access;
    let res;
    try {
      res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (_) {
      const err = new Error('Could not reach KONDRITE.');
      err.offline = true;
      throw err;
    }
    const text = await res.text();
    let j = null;
    try { j = text ? JSON.parse(text) : null; } catch (_) {}
    if (!res.ok) {
      const err = new Error((j && (j.error_description || j.msg || j.message || j.error)) || ('HTTP ' + res.status));
      err.code = j && j.code;
      err.status = res.status;
      // What the page shows for the two refusals worth naming.
      if (err.code === '42501') err.kind = 'not-admin';
      else if (err.code === 'PGRST202' || err.code === '42883') err.kind = 'not-set-up';
      throw err;
    }
    return j;
  }

  async function fresh() {
    if (!sess) { const e = new Error('Sign in to KONDRITE.'); e.kind = 'signed-out'; throw e; }
    if (Date.now() < sess.expires) return;
    try {
      write(fromAuth(await call('/auth/v1/token?grant_type=refresh_token',
        { method: 'POST', auth: false, body: { refresh_token: sess.refresh } })));
    } catch (err) {
      if (err.status) { write(null); err.kind = 'signed-out'; }   // refused; offline keeps the session
      throw err;
    }
  }

  const rpc = async (fn, args = {}) => { await fresh(); return call('/rest/v1/rpc/' + fn, { method: 'POST', body: args }); };

  // The shape the list draws, the same one the site's people come in.
  const norm = (p) => ({
    id: p.user_id, email: p.email || '', name: p.name || '', board_name: p.board_name,
    created_at: p.created_at, last_sign_in_at: p.last_sign_in_at, confirmed: p.confirmed,
    banned_until: p.banned_until, is_admin: !!p.is_admin, has_save: !!p.has_save,
    save_seed: p.save_seed, save_updated_at: p.save_updated_at, save_bytes: p.save_bytes || 0,
    best: p.best || {}, reports: p.reports || 0,
  });

  window.KondriteAdmin = Object.freeze({
    enabled: () => !!(BASE && KEY),
    restore() { sess = read(); return !!sess; },
    email: () => (sess ? sess.email : ''),
    async signIn(email, password) {
      write(fromAuth(await call('/auth/v1/token?grant_type=password', {
        method: 'POST', auth: false, body: { email: String(email).trim(), password: String(password) },
      })));
    },
    signOut() { write(null); },
    async pilots() { return ((await rpc('admin_pilots')) || []).map(norm); },
    rename: (id, name) => rpc('admin_rename_pilot', { target: id, new_name: name }),
    wipe: (id) => rpc('admin_wipe_save', { target: id }),
    clearScores: (id) => rpc('admin_clear_scores', { target: id }),
    ban: (id, hours) => rpc('admin_ban_pilot', { target: id, hours }),
    remove: (id) => rpc('admin_delete_pilot', { target: id }),
    // Supabase's own reset email, from the KONDRITE project, back to the game.
    reset: (email, siteRoot) => call('/auth/v1/recover?redirect_to=' + encodeURIComponent(siteRoot + 'projects/kondrite/'),
      { method: 'POST', auth: false, body: { email } }),
  });
})();
