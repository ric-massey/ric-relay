/* Admin — the wiring. Sign in, the admin check, the two lists, the buttons.
 *
 * Who gets in is decided by the database, not by this file: the list comes from
 * the site-admin function and admin_people(), both of which refuse anybody not
 * in site_admins. Somebody who edits this file to skip the check gets an empty
 * page and a refusal from every button. Drawing is view.js; KONDRITE's data is
 * kondrite.js. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const V = window.AdminView;
  const K = window.KondriteAdmin;
  const db = window.SiteGate.db();
  const CFG = window.CONFIG || {};
  const FN_URL = String(CFG.SUPABASE_URL || '').replace(/\/+$/, '') + '/functions/v1/site-admin';
  const SITE_ROOT = new URL('../', location.href).href;

  const S = {
    tab: 'site',
    pages: [],
    people: [], server: true,
    pilots: [], kState: 'idle',   // idle | signed-out | not-admin | not-set-up | ok | error
    kError: '',
    open: { site: null, kondrite: null },
    picked: { site: new Set(), kondrite: new Set() },
  };

  // ── small things ───────────────────────────────────────────────────────────
  let toastTimer = 0;
  function toast(text, bad = false) {
    const t = $('toast');
    t.textContent = text;
    t.classList.toggle('bad', bad);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, bad ? 6000 : 3000);
  }

  async function fn(action, body = {}) {
    const { data: { session } } = await db.auth.getSession();
    if (!session) throw new Error('Signed out.');
    let res;
    try {
      res = await fetch(FN_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token, apikey: CFG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
    } catch (_) {
      const e = new Error('Could not reach the server.'); e.offline = true; throw e;
    }
    let j = null;
    try { j = await res.json(); } catch (_) {}
    if (!res.ok) {
      const e = new Error((j && (j.error || j.message || j.msg)) || `Server said ${res.status}`);
      e.status = res.status;
      throw e;
    }
    return j;
  }

  const rpc = async (name, args) => {
    const { data, error } = await db.rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  };

  async function busy(button, work) {
    if (button) button.disabled = true;
    try { return await work(); }
    catch (err) { toast(err.message, true); return undefined; }
    finally { if (button) button.disabled = false; }
  }

  // ── the door ───────────────────────────────────────────────────────────────
  function showGate(which, email = '') {
    $('app').hidden = true;
    $('gate').hidden = false;
    $('signin').hidden = which !== 'signin';
    $('denied').hidden = which !== 'denied';
    $('denied-who').textContent = email ? `${email} is not an admin.` : '';
    if (which === 'signin') $('si-email').focus();
  }

  async function boot() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) return showGate('signin');
    let isAdmin = false;
    try { isAdmin = await rpc('is_site_admin'); } catch (err) { $('si-msg').textContent = err.message; return showGate('signin'); }
    if (!isAdmin) return showGate('denied', session.user.email);
    $('gate').hidden = true;
    $('app').hidden = false;
    $('me-email').textContent = session.user.email || '';
    await loadSite();
    if (K.enabled() && K.restore()) loadPilots();   // in the background; the tab draws when it lands
  }

  // ── the site ───────────────────────────────────────────────────────────────
  async function loadSite() {
    const { data: pages } = await db.from('site_pages').select('key,label,sort').order('sort');
    S.pages = pages || [];
    try {
      S.people = await fn('list');
      S.server = true;
    } catch (err) {
      if (err.status === 403 || err.status === 401) { toast(err.message, true); return showGate('denied'); }
      // Not deployed yet (404) or unreachable: draw from the database alone
      // and switch off what only the server can do.
      S.server = false;
      try {
        S.people = ((await rpc('admin_people')) || []).map((p) => ({
          id: p.user_id, email: p.email, name: p.name, username: p.username, note: p.note,
          status: p.is_admin ? 'admin' : p.status, requested: p.requested || [], pages: p.pages || [],
          is_admin: p.is_admin, created_at: p.created_at, last_sign_in_at: p.last_sign_in_at,
        }));
      } catch (e2) { toast(e2.message, true); S.people = []; }
    }
    draw();
  }

  async function loadPilots() {
    S.kState = 'loading';
    if (S.tab === 'kondrite') draw();
    try {
      S.pilots = await K.pilots();
      S.kState = 'ok';
    } catch (err) {
      S.kState = err.kind || 'error';
      S.kError = err.message;
    }
    draw();
  }

  // ── drawing ────────────────────────────────────────────────────────────────
  const label = (k) => (S.pages.find((p) => p.key === k) || { label: k }).label;
  const list = () => (S.tab === 'site' ? S.people : S.pilots);
  const shown = () => list().filter((p) => V.matches(p, $('find').value) && V.inFilter(p, $('filter').value));
  const sideOf = (p) => (S.tab === 'site'
    ? (p.is_admin ? 'Everything' : p.pages.map(label).join(', ') || 'No access')
    : V.scoreText(p.best)[0] || '');

  function draw() {
    for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-selected', String(t.dataset.tab === S.tab));
    $('invite').hidden = S.tab !== 'site';
    $('invite').disabled = !S.server;
    $('notice').hidden = !(S.tab === 'site' && !S.server);
    $('notice').textContent = 'The site-admin server function is not deployed, so invites, emails, profile edits, bans and deletes are off. See admin/README.md.';

    const picked = S.picked[S.tab];
    $('compose').textContent = picked.size ? `Email ${picked.size}` : 'Email';

    if (S.tab === 'kondrite' && S.kState !== 'ok') return drawKondriteDoor();

    const rows = shown();
    const all = list();
    const waiting = all.filter((p) => p.status === 'pending' && !p.is_admin).length;
    $('summary').textContent = `${rows.length === all.length ? all.length : `${rows.length} of ${all.length}`} ${all.length === 1 ? 'person' : 'people'}`
      + (S.tab === 'site' && waiting ? ` · ${waiting} waiting` : '')
      + (S.tab === 'kondrite' ? ` · signed in as ${K.email()}` : '');
    $('body').innerHTML = rows.length
      ? `<ul class="list">${rows.map((p) => V.row(p, {
          open: S.open[S.tab] === p.id,
          selected: picked.has(p.id),
          side: sideOf(p),
          details: S.open[S.tab] === p.id ? (S.tab === 'site' ? V.siteDetails(p, S.pages, { server: S.server }) : V.pilotDetails(p)) : '',
        })).join('')}</ul>`
      : `<div class="list empty">${all.length ? 'No one matches.' : 'No accounts yet.'}</div>`;
  }

  function drawKondriteDoor() {
    $('summary').textContent = '';
    const msg = {
      'not-admin': `${V.esc(K.email())} is not a KONDRITE admin.`,
      'not-set-up': 'Run projects/kondrite/supabase/admin.sql in the KONDRITE project first.',
      error: V.esc(S.kError),
      loading: 'Loading…',
    }[S.kState];
    if (!K.enabled()) { $('body').innerHTML = '<div class="list empty">KONDRITE has no account service configured.</div>'; return; }
    if (S.kState === 'loading') { $('body').innerHTML = `<div class="list empty">${msg}</div>`; return; }
    $('body').innerHTML = `<div class="gate" style="min-height:0;padding:12px 0"><form class="card" id="k-signin" novalidate>
      <h1>KONDRITE</h1><p>${msg || 'Sign in with your KONDRITE account.'}</p>
      <label for="k-email">Email</label><input id="k-email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" required>
      <label for="k-pass">Password</label><input id="k-pass" type="password" autocomplete="current-password" required>
      <button class="btn primary" type="submit">Sign in</button>
      <p class="error" id="k-msg" role="alert"></p></form></div>`;
  }

  // ── doing ──────────────────────────────────────────────────────────────────
  const person = (id) => list().find((p) => p.id === id) || {};
  const valueOf = (id, field) => {
    const el = document.querySelector(`[data-field="${field}"][data-for="${CSS.escape(id)}"]`);
    return el ? el.value : undefined;
  };
  const checkedPages = (id) => [...document.querySelectorAll(`input[data-page][data-for="${CSS.escape(id)}"]:checked`)].map((i) => i.dataset.page);

  function askBan(p) {
    return new Promise((resolve) => {
      const d = $('ban-dlg');
      $('ban-title').textContent = `Ban ${p.name || p.email}`;
      d.onclose = () => resolve(d.returnValue === 'ban' ? Number($('ban-hours').value) : null);
      d.showModal();
    });
  }

  let mailTo = [];
  function openMail(people) {
    mailTo = people.filter((p) => p.email);
    if (!mailTo.length) return toast('Nobody to email.', true);
    $('mail-to').textContent = 'To: ' + (mailTo.length <= 6
      ? mailTo.map((p) => p.name ? `${p.name} <${p.email}>` : p.email).join(', ')
      : `${mailTo.length} people`);
    $('mail-msg').textContent = '';
    $('mail-dlg').showModal();
    $('mail-subject').focus();
  }

  const SITE_ACTS = {
    async approve(p, b) { await setAccess(p, 'approved', b, 'Approved.'); },
    async access(p, b) { await setAccess(p, 'approved', b, 'Access saved.'); },
    async deny(p, b) {
      if (!confirm(`Remove all access for ${p.name || p.email}?`)) return;
      await setAccess(p, 'denied', b, 'Access removed.');
    },
    async profile(p, b) {
      const ok = await busy(b, () => fn('update', { id: p.id, name: valueOf(p.id, 'name'), email: valueOf(p.id, 'email') }));
      if (ok) { toast('Profile saved.'); await loadSite(); }
    },
    async reset(p, b) {
      if (!confirm(`Send a password reset to ${p.email}?`)) return;
      if (await busy(b, () => fn('reset', { id: p.id }))) toast('Reset email sent.');
    },
    async resend(p, b) {
      if (await busy(b, () => fn('resend', { id: p.id }))) toast(p.invited ? 'Invite sent again.' : 'Confirmation sent again.');
    },
    async ban(p, b) {
      const hours = await askBan(p);
      if (hours == null) return;
      if (await busy(b, () => fn('ban', { id: p.id, hours }))) { toast('Banned.'); await loadSite(); }
    },
    async unban(p, b) {
      if (await busy(b, () => fn('ban', { id: p.id, hours: 0 }))) { toast('Unbanned.'); await loadSite(); }
    },
    async delete(p, b) {
      if (!confirm(`Delete ${p.name || p.email}'s account for good?`)) return;
      if (await busy(b, () => fn('delete', { id: p.id }))) { S.open.site = null; toast('Deleted.'); await loadSite(); }
    },
    email(p) { openMail([p]); },
  };

  async function setAccess(p, status, b, done) {
    const pages = status === 'denied' ? [] : checkedPages(p.id);
    if (status === 'approved' && !pages.length && !confirm('Approve with no pages ticked?')) return;
    const ok = await busy(b, () => rpc('admin_set_access', { target: p.id, new_status: status, grant_pages: pages }).then(() => true));
    if (ok) { toast(done); await loadSite(); }
  }

  const PILOT_ACTS = {
    async rename(p, b) {
      if (await busy(b, () => K.rename(p.id, valueOf(p.id, 'name') || '').then(() => true))) { toast('Renamed.'); await loadPilots(); }
    },
    async reset(p, b) {
      if (!confirm(`Send a KONDRITE password reset to ${p.email}?`)) return;
      if (await busy(b, () => K.reset(p.email, SITE_ROOT).then(() => true))) toast('Reset email sent.');
    },
    async wipe(p, b) {
      if (!confirm(`Wipe ${p.name || p.email}'s cloud save? Their device copy stays.`)) return;
      if (await busy(b, () => K.wipe(p.id).then(() => true))) { toast('Save wiped.'); await loadPilots(); }
    },
    async scores(p, b) {
      if (!confirm(`Clear every score ${p.name || p.email} reported or was reported for?`)) return;
      if (await busy(b, () => K.clearScores(p.id).then(() => true))) { toast('Scores cleared.'); await loadPilots(); }
    },
    async ban(p, b) {
      const hours = await askBan(p);
      if (hours == null) return;
      if (await busy(b, () => K.ban(p.id, hours).then(() => true))) { toast('Banned.'); await loadPilots(); }
    },
    async unban(p, b) {
      if (await busy(b, () => K.ban(p.id, 0).then(() => true))) { toast('Unbanned.'); await loadPilots(); }
    },
    async delete(p, b) {
      if (!confirm(`Delete ${p.name || p.email}'s KONDRITE account, save and scores for good?`)) return;
      if (await busy(b, () => K.remove(p.id).then(() => true))) { S.open.kondrite = null; toast('Deleted.'); await loadPilots(); }
    },
    email(p) { openMail([p]); },
  };

  // ── events ─────────────────────────────────────────────────────────────────
  $('signin').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('si-msg').textContent = '';
    await busy($('si-go'), async () => {
      try { await window.SiteGate.signIn($('si-email').value, $('si-pass').value); }
      catch (err) { $('si-msg').textContent = /invalid/i.test(err.message) ? 'Wrong email or password.' : err.message; return; }
      $('si-pass').value = '';
      await boot();
    });
  });

  const signOut = async () => { await window.SiteGate.signOut(); location.reload(); };
  $('signout').addEventListener('click', signOut);
  $('denied-out').addEventListener('click', signOut);

  $('find').addEventListener('input', draw);
  $('filter').addEventListener('change', draw);

  $('compose').addEventListener('click', () => {
    const picked = S.picked[S.tab];
    if (picked.size) return openMail(list().filter((p) => picked.has(p.id)));
    const rows = shown();
    if (rows.length > 1 && !confirm(`Email all ${rows.length} people shown?`)) return;
    openMail(rows);
  });

  $('mail-form').addEventListener('submit', async (e) => {
    if (e.submitter && e.submitter.value === 'cancel') return;
    e.preventDefault();
    $('mail-msg').textContent = '';
    const out = await busy($('mail-send'), async () => {
      try {
        return await fn('email', { to: mailTo.map((p) => p.email), subject: $('mail-subject').value, text: $('mail-text').value });
      } catch (err) { $('mail-msg').textContent = err.message; return null; }
    });
    if (!out) return;
    $('mail-dlg').close();
    $('mail-subject').value = '';
    $('mail-text').value = '';
    S.picked[S.tab].clear();
    draw();
    toast(`Sent to ${out.sent} ${out.sent === 1 ? 'person' : 'people'}.`);
  });

  $('invite').addEventListener('click', () => {
    $('inv-pages').innerHTML = S.pages.map((pg) => `<label><input type="checkbox" value="${V.esc(pg.key)}"${pg.key === 'atlas' ? ' checked' : ''}> ${V.esc(pg.label)}</label>`).join('');
    $('inv-msg').textContent = '';
    $('invite-dlg').showModal();
    $('inv-email').focus();
  });

  $('invite-form').addEventListener('submit', async (e) => {
    if (e.submitter && e.submitter.value === 'cancel') return;
    e.preventDefault();
    $('inv-msg').textContent = '';
    const pages = [...$('inv-pages').querySelectorAll('input:checked')].map((i) => i.value);
    const ok = await busy($('inv-send'), async () => {
      try {
        const { id } = await fn('invite', { email: $('inv-email').value, name: $('inv-name').value });
        await rpc('admin_set_access', { target: id, new_status: 'approved', grant_pages: pages });
        return true;
      } catch (err) { $('inv-msg').textContent = err.message; return false; }
    });
    if (!ok) return;
    $('invite-dlg').close();
    $('inv-email').value = '';
    $('inv-name').value = '';
    toast('Invite sent.');
    await loadSite();
  });

  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'k-signin') return;
    e.preventDefault();
    const b = e.target.querySelector('button');
    await busy(b, async () => {
      try { await K.signIn($('k-email').value, $('k-pass').value); }
      catch (err) { $('k-msg').textContent = /invalid/i.test(err.message) ? 'Wrong email or password.' : err.message; return; }
      await loadPilots();
    });
  });

  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) {
      S.tab = tab.dataset.tab;
      if (S.tab === 'kondrite' && S.kState === 'idle') {
        if (K.enabled() && K.restore()) loadPilots(); else S.kState = 'signed-out';
      }
      return draw();
    }
    const tog = e.target.closest('[data-toggle]');
    if (tog) {
      S.open[S.tab] = S.open[S.tab] === tog.dataset.toggle ? null : tog.dataset.toggle;
      return draw();
    }
    const act = e.target.closest('button[data-act]');
    if (act) {
      const p = person(act.dataset.id);
      const run = (S.tab === 'site' ? SITE_ACTS : PILOT_ACTS)[act.dataset.act];
      if (p.id && run) run(p, act);
    }
  });

  document.addEventListener('change', (e) => {
    const pick = e.target.closest('input[data-pick]');
    if (!pick) return;
    const set = S.picked[S.tab];
    pick.checked ? set.add(pick.dataset.pick) : set.delete(pick.dataset.pick);
    $('compose').textContent = set.size ? `Email ${set.size}` : 'Email';
  });

  boot().catch((err) => { $('si-msg').textContent = `Could not reach the account service (${err.message}).`; showGate('signin'); });
})();
