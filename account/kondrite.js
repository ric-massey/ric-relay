/* KONDRITE's pilots, on Ric's account page.
 *
 * KONDRITE keeps its accounts in a Supabase project of its own (see
 * projects/kondrite/config.js for why), so this is a second sign-in beside the
 * site one. It reuses the game's own session when this browser has one — same
 * origin, same storage key, same shape as cloud.js writes — so if Ric has
 * signed into KONDRITE here, the list is simply there.
 *
 * As with account.js, nothing here is trusted: every row and every change goes
 * through a function in projects/kondrite/supabase/admin.sql that asks
 * is_admin() first. Somebody who opens this panel in devtools gets "admins
 * only" back from every button. */
(() => {
  'use strict';
  const CFG = window.KONDRITE_CLOUD || {};
  const BASE = String(CFG.url || '').replace(/\/+$/, '');
  const KEY = String(CFG.anonKey || '');
  const SESSION_KEY = 'kondrite.account.v1';   // cloud.js's key — keep in step
  const FOREVER_HOURS = 24 * 365 * 100;

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const day = (t) => t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'never';

  let root = null;
  let sess = null;
  let pilots = [];
  let filter = '';

  const readSess = () => {
    try { const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); return s && s.access && s.refresh ? s : null; }
    catch (_) { return null; }
  };
  const writeSess = (s) => {
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
      throw new Error('could not reach KONDRITE\'s account service');
    }
    const text = await res.text();
    let j = null;
    try { j = text ? JSON.parse(text) : null; } catch (_) {}
    if (!res.ok) {
      const err = new Error((j && (j.error_description || j.msg || j.message || j.error)) || ('HTTP ' + res.status));
      err.code = j && j.code;
      err.status = res.status;
      throw err;
    }
    return j;
  }

  async function fresh() {
    if (!sess) return false;
    if (Date.now() < sess.expires) return true;
    try {
      writeSess(fromAuth(await call('/auth/v1/token?grant_type=refresh_token',
        { method: 'POST', auth: false, body: { refresh_token: sess.refresh } })));
      return true;
    } catch (err) {
      if (err.status) writeSess(null);   // refused; offline keeps the session
      throw err;
    }
  }

  const rpc = async (fn, args = {}) => { await fresh(); return call('/rest/v1/rpc/' + fn, { method: 'POST', body: args }); };

  // ── drawing ──────────────────────────────────────────────────────────────
  const say = (text, good = false) => {
    const el = root.querySelector('#kd-msg');
    if (el) { el.textContent = text; el.classList.toggle('good', good); }
  };

  function signInForm(note) {
    root.innerHTML = `
      <p>${note ? esc(note) : 'KONDRITE keeps its own accounts. sign in with your KONDRITE account to see the pilots.'}</p>
      <form id="kd-form" novalidate>
        <label class="field" for="kd-email">kondrite email</label>
        <input id="kd-email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" required>
        <label class="field" for="kd-pass">password</label>
        <input id="kd-pass" type="password" autocomplete="current-password" required>
        <button class="wide" id="kd-go" type="submit">sign in to kondrite</button>
      </form>
      <p class="message" id="kd-msg" role="status" aria-live="polite"></p>`;
  }

  const SCORE_WORDS = {
    survival: (v) => `survival wave ${v}`,
    royale: (v) => `royale ${v}s alive`,
    campaign: (v) => `campaign mission ${v}`,
  };

  function card(p) {
    const banned = p.banned_until && new Date(p.banned_until) > new Date();
    const tags = [
      p.is_admin ? '<span class="tag">admin</span>' : '',
      banned ? `<span class="tag denied">banned${new Date(p.banned_until).getFullYear() > 2100 ? '' : ' to ' + esc(day(p.banned_until))}</span>` : '',
      p.confirmed ? '' : '<span class="tag pending">unconfirmed</span>',
    ].join('');
    const best = Object.entries(p.best || {}).map(([g, v]) => (SCORE_WORDS[g] || ((x) => `${g} ${x}`))(v));
    const save = p.has_save
      ? `save: sector ${esc(p.save_seed)} · ${esc(Math.ceil(p.save_bytes / 1024))} KB · synced ${esc(day(p.save_updated_at))}`
      : 'no cloud save';
    const id = esc(p.user_id);
    // A row that opens, like the site's people; account.js remembers which.
    const open = !!(window.SiteRows && window.SiteRows.openRows.has('kd:' + p.user_id));
    return `<details class="person" data-row="kd:${id}" data-pilot="${id}"${open ? ' open' : ''}>
      <summary><span class="who">${esc(p.name || '(no name)')}${tags}</span>
        <span class="peek">${esc(p.email)}</span></summary>
      <div class="meta">joined ${esc(day(p.created_at))} · last in ${esc(day(p.last_sign_in_at))}</div>
      <div class="meta">${save}</div>
      <div class="meta">${best.length ? esc(best.join(' · ')) : 'nothing on the boards'}${p.reports ? ` · ${esc(p.reports)} report${p.reports === 1 ? '' : 's'} about them` : ''}</div>
      ${p.board_name || !p.name ? '' : '<div class="meta">name not on the boards yet</div>'}
      <div class="row rename">
        <input type="text" aria-label="new name for ${esc(p.name || p.email)}" data-name="${id}" value="${esc(p.name)}" maxlength="16" autocapitalize="none" spellcheck="false">
        <button type="button" class="ghost" data-kd="rename" data-user="${id}">rename</button>
      </div>
      <div class="row">
        ${p.has_save ? `<button type="button" class="ghost" data-kd="wipe" data-user="${id}">wipe save</button>` : ''}
        ${p.reports ? `<button type="button" class="ghost" data-kd="scores" data-user="${id}">clear scores</button>` : ''}
        ${p.is_admin ? '' : banned
          ? `<button type="button" class="ghost" data-kd="unban" data-user="${id}">unban</button>`
          : `<button type="button" class="danger" data-kd="ban" data-user="${id}">ban</button>`}
        ${p.is_admin ? '' : `<button type="button" class="danger" data-kd="delete" data-user="${id}">delete</button>`}
      </div>
    </details>`;
  }

  const matches = (p) => !filter || [p.name, p.board_name, p.email].some((s) => String(s || '').toLowerCase().includes(filter));

  function drawList() {
    const list = root && root.querySelector('#kd-list');
    if (!list) return;
    const shown = pilots.filter(matches);
    list.innerHTML = shown.length ? shown.map(card).join('')
      : `<p>${pilots.length ? 'no pilot matches that.' : 'nobody has made a KONDRITE account yet.'}</p>`;
    const count = root.querySelector('#kd-count');
    if (count) count.textContent = filter ? `${shown.length} of ${pilots.length}` : String(pilots.length);
  }

  async function load() {
    try {
      pilots = (await rpc('admin_pilots')) || [];
    } catch (err) {
      if (!sess) return signInForm('your KONDRITE session ran out — sign in again.');
      if (err.code === '42501') return signInForm(`${sess.email} is not a KONDRITE admin. sign in with the account named in admin.sql, or add this one there.`);
      if (err.code === 'PGRST202' || err.code === '42883') {
        root.innerHTML = '<p>the KONDRITE admin functions are not set up yet: run <b>projects/kondrite/supabase/admin.sql</b> in its SQL editor.</p>';
        return;
      }
      root.innerHTML = `<p class="message">${esc(err.message)}</p>`;
      return;
    }
    root.innerHTML = `
      <p class="sub" style="margin:0 0 6px">signed in to kondrite as ${esc(sess.email)} · <span id="kd-count"></span> pilots
        <button class="switch" type="button" data-kd="signout" style="padding:0 0 0 8px;min-height:0">sign out</button></p>
      <div id="kd-list"></div>
      <p class="message" id="kd-msg" role="status" aria-live="polite"></p>`;
    drawList();
  }

  // ── acting ───────────────────────────────────────────────────────────────
  const pilotOf = (id) => pilots.find((p) => p.user_id === id) || {};

  async function act(button) {
    const id = button.dataset.user;
    const p = pilotOf(id);
    const who = p.name || p.email || 'this pilot';
    const kind = button.dataset.kd;
    let fn, args, done;
    if (kind === 'rename') {
      const input = root.querySelector(`input[data-name="${CSS.escape(id)}"]`);
      fn = 'admin_rename_pilot'; args = { target: id, new_name: input ? input.value : '' }; done = 'renamed.';
    } else if (kind === 'wipe') {
      if (!confirm(`Wipe ${who}'s cloud save? The copy on their own device is kept and goes back up when they play.`)) return;
      fn = 'admin_wipe_save'; args = { target: id }; done = 'cloud save wiped.';
    } else if (kind === 'scores') {
      if (!confirm(`Clear every score ${who} reported or was reported for? This cannot be undone.`)) return;
      fn = 'admin_clear_scores'; args = { target: id }; done = 'scores cleared.';
    } else if (kind === 'ban') {
      const answer = prompt(`Ban ${who} for how many hours? (blank = forever)`, '');
      if (answer === null) return;
      const hours = answer.trim() === '' ? FOREVER_HOURS : Math.floor(Number(answer));
      if (!(hours > 0)) { say('that is not a number of hours.'); return; }
      fn = 'admin_ban_pilot'; args = { target: id, hours }; done = 'banned. it takes hold within the hour.';
    } else if (kind === 'unban') {
      fn = 'admin_ban_pilot'; args = { target: id, hours: 0 }; done = 'ban lifted.';
    } else if (kind === 'delete') {
      if (!confirm(`Delete ${who}'s KONDRITE account, save and scores for good?`)) return;
      fn = 'admin_delete_pilot'; args = { target: id }; done = 'account deleted.';
    } else return;

    button.disabled = true;
    try {
      await rpc(fn, args);
    } catch (err) {
      button.disabled = false;
      say(err.code === '23505' ? 'that name is taken.' : err.message);
      return;
    }
    await load();
    say(done, true);
  }

  async function signIn(form) {
    const go = form.querySelector('#kd-go');
    go.disabled = true;
    say('');
    try {
      writeSess(fromAuth(await call('/auth/v1/token?grant_type=password', {
        method: 'POST', auth: false,
        body: { email: form.querySelector('#kd-email').value.trim(), password: form.querySelector('#kd-pass').value },
      })));
      await load();
    } catch (err) {
      go.disabled = false;
      say(/invalid/i.test(err.message) ? 'wrong email or password' : err.message);
    }
  }

  function mount(el) {
    root = el;
    if (root.dataset.wired !== '1') {
      root.dataset.wired = '1';
      root.addEventListener('submit', (e) => {
        if (e.target.id !== 'kd-form') return;
        e.preventDefault();
        signIn(e.target);
      });
      root.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-kd]');
        if (!b) return;
        if (b.dataset.kd === 'signout') { writeSess(null); signInForm(); return; }
        act(b);
      });
    }
    if (!BASE || !KEY) { root.innerHTML = '<p>KONDRITE has no account service configured.</p>'; return Promise.resolve(); }
    sess = readSess();
    if (!sess) { signInForm(); return Promise.resolve(); }
    return load();
  }

  window.KondriteAdmin = {
    mount,
    // The page's one search box filters this list too.
    filter(q) { filter = String(q || '').trim().toLowerCase(); drawList(); },
  };
})();
