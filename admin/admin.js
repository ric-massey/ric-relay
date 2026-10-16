/* Admin — the wiring. Sign in, the admin check, the two lists, the drawer,
 * the buttons.
 *
 * Who gets in is decided by the database, not by this file: the list comes from
 * the site-admin function and admin_people(), both of which refuse anybody not
 * in site_admins. Somebody who edits this file to skip the check gets an empty
 * page and a refusal from every button. Drawing is view.js; KONDRITE's data is
 * kondrite.js.
 *
 * The list and the drawer are drawn separately on purpose. Typing in search
 * redraws the list many times a second; the drawer holds a form, and redrawing
 * it would throw away what Ric was typing. Anything typed and not saved is kept
 * in S.drafts as well, so even a drawer redraw after another button keeps it. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const V = window.AdminView;
  const K = window.KondriteAdmin;
  const A = window.AdminAnalytics;
  const db = window.SiteGate.db();
  const CFG = window.CONFIG || {};
  const FN_URL = String(CFG.SUPABASE_URL || '').replace(/\/+$/, '') + '/functions/v1/site-admin';
  const SITE_ROOT = new URL('../', location.href).href;
  const tabs = () => ({ site: null, kondrite: null });

  const S = {
    tab: 'site',
    pages: [],
    people: [], server: true, siteLoading: true,
    pilots: [], kState: 'idle',   // idle | loading | signed-out | not-admin | not-set-up | ok | error
    kError: '',
    open: tabs(),
    filter: { site: 'all', kondrite: 'all' },
    picked: { site: new Set(), kondrite: new Set() },
    drafts: { site: new Map(), kondrite: new Map() },
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

  // A styled yes/no. Resolves true only on the confirm button.
  function ask({ title, body = '', yes = 'Confirm', danger = false }) {
    return new Promise((resolve) => {
      const d = $('confirm-dlg');
      $('confirm-title').textContent = title;
      $('confirm-body').textContent = body;
      $('confirm-body').hidden = !body;
      $('confirm-yes').textContent = yes;
      $('confirm-yes').className = 'btn ' + (danger ? 'danger' : 'primary');
      d.returnValue = '';
      d.onclose = () => resolve(d.returnValue === 'yes');
      d.showModal();
      $('confirm-yes').focus();
    });
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

  // Runs work with the button showing a spinner. Errors become a red toast and
  // undefined, so callers only have to check for success.
  async function busy(button, work) {
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    try { return await work(); }
    catch (err) { toast(err.message, true); return undefined; }
    finally { if (button) { button.disabled = false; button.removeAttribute('aria-busy'); } }
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
    draw();
    await loadSite();
    if (K.enabled() && K.restore()) loadPilots();   // in the background; the tab draws when it lands
  }

  // ── loading ────────────────────────────────────────────────────────────────
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
    S.siteLoading = false;
    forget('site');
    draw();
    if (S.tab === 'site') drawDrawer();
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
    forget('kondrite');
    draw();
    if (S.tab === 'kondrite') drawDrawer();
  }

  // Drop picks, drafts and the open drawer for people who are gone.
  function forget(tab) {
    const ids = new Set((tab === 'site' ? S.people : S.pilots).map((p) => p.id));
    for (const id of [...S.picked[tab]]) if (!ids.has(id)) S.picked[tab].delete(id);
    for (const id of [...S.drafts[tab].keys()]) if (!ids.has(id)) S.drafts[tab].delete(id);
    if (S.open[tab] && !ids.has(S.open[tab])) S.open[tab] = null;
  }

  // ── drawing the list ───────────────────────────────────────────────────────
  const label = (k) => (S.pages.find((p) => p.key === k) || { label: k }).label;
  const list = () => (S.tab === 'site' ? S.people : S.pilots);
  const shown = () => list().filter((p) => V.matches(p, $('find').value) && V.inFilter(p, S.filter[S.tab]));
  const sideOf = (p) => (S.tab === 'site'
    ? (p.is_admin ? 'Everything' : p.pages.map(label).join(', ') || 'No access')
    : V.scoreText(p.best)[0] || '');
  const loading = () => (S.tab === 'site' ? S.siteLoading : S.kState === 'loading');

  function draw() {
    for (const t of document.querySelectorAll('.tab')) t.setAttribute('aria-selected', String(t.dataset.tab === S.tab));
    // Analytics is not a list of people: none of the list's tools apply.
    const numbers = S.tab === 'analytics';
    $('tools').hidden = numbers;
    if (numbers) {
      $('notice').hidden = true;
      $('stats').innerHTML = '';
      $('bulk').hidden = true;
      return A.show($('body'), async () => {
        const { data: { session } } = await db.auth.getSession();
        return session ? session.access_token : '';
      });
    }
    A.hide();
    $('invite').hidden = S.tab !== 'site';
    $('invite').disabled = !S.server;
    $('notice').hidden = !(S.tab === 'site' && !S.server && !S.siteLoading);
    $('notice').textContent = 'The site-admin server function is not deployed, so invites, emails, profile edits, bans and deletes are off. See admin/README.md.';
    drawBulk();

    if (loading()) {
      $('stats').innerHTML = V.skeletonStats();
      $('body').innerHTML = V.skeleton();
      return;
    }
    if (S.tab === 'kondrite' && S.kState !== 'ok') { $('stats').innerHTML = ''; return drawKondriteDoor(); }

    $('stats').innerHTML = V.stats(V.count(list()), S.filter[S.tab]);
    const rows = shown();
    const picked = S.picked[S.tab];
    const pickedShown = rows.filter((p) => picked.has(p.id)).length;
    $('body').innerHTML = rows.length
      ? `<ul class="list">${V.listHead(rows.length, pickedShown)}${rows.map((p) => V.row(p, {
          active: S.open[S.tab] === p.id, selected: picked.has(p.id), side: sideOf(p),
        })).join('')}</ul>`
      : `<div class="list empty">${list().length ? 'No one matches.' : 'No accounts yet.'}</div>`;
    const all = $('pick-all');
    if (all) all.indeterminate = pickedShown > 0 && pickedShown < rows.length;
  }

  function drawBulk() {
    if (!S.picked[S.tab]) return;
    const n = S.picked[S.tab].size;
    $('bulk').hidden = !n;
    $('bulk-count').textContent = `${n} selected`;
    $('compose').textContent = n ? `Email ${n}` : 'Email';
    const picked = list().filter((p) => S.picked[S.tab].has(p.id));
    document.querySelector('[data-bulk="approve"]').hidden = S.tab !== 'site' || !picked.some((p) => p.status === 'pending' && !p.is_admin);
    for (const b of document.querySelectorAll('[data-bulk="email"],[data-bulk="ban"],[data-bulk="delete"]')) {
      b.disabled = S.tab === 'site' && !S.server;
    }
  }

  function drawKondriteDoor() {
    const msg = {
      'not-admin': `${V.esc(K.email())} is not a KONDRITE admin.`,
      'not-set-up': 'Run projects/kondrite/supabase/admin.sql in the KONDRITE project first.',
      error: V.esc(S.kError),
    }[S.kState];
    if (!K.enabled()) { $('body').innerHTML = '<div class="list empty">KONDRITE has no account service configured.</div>'; return; }
    $('body').innerHTML = `<div class="gate" style="min-height:0;padding:12px 0"><form class="card" id="k-signin" novalidate>
      <h1>KONDRITE</h1><p>${msg || 'Sign in with your KONDRITE account.'}</p>
      <label for="k-email">Email</label><input id="k-email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" required>
      <label for="k-pass">Password</label><input id="k-pass" type="password" autocomplete="current-password" required>
      <button class="btn primary" type="submit">Sign in</button>
      <p class="error" id="k-msg" role="alert"></p></form></div>`;
  }

  // ── the drawer ─────────────────────────────────────────────────────────────
  const person = (id) => list().find((p) => p.id === id) || {};

  function drawDrawer() {
    const id = S.open[S.tab];
    const p = id ? person(id) : null;
    const on = !!(p && p.id);
    $('drawer').hidden = !on;
    $('scrim').hidden = !on;
    document.body.classList.toggle('drawer-open', on);
    if (!on) return;
    const draft = S.drafts[S.tab].get(p.id) || {};
    $('drawer-avatar').textContent = String(p.name || p.email || '?').trim().charAt(0).toUpperCase();
    $('drawer-name').textContent = p.name || p.email || 'No name';
    $('drawer-email').textContent = p.email || '';
    $('drawer-badge').innerHTML = V.badgeHtml(p);
    $('drawer-body').innerHTML = S.tab === 'site'
      ? V.siteDetails(p, S.pages, { server: S.server, draft })
      : V.pilotDetails(p, { draft });
  }

  function openDrawer(id) {
    S.open[S.tab] = id;
    draw();
    drawDrawer();
    $('drawer-close').focus();
  }

  function closeDrawer() {
    const id = S.open[S.tab];
    S.open[S.tab] = null;
    draw();
    drawDrawer();
    const row = id && document.querySelector(`[data-open="${CSS.escape(id)}"]`);
    if (row) row.focus();
  }

  // What is typed or ticked in the drawer, kept until it is saved.
  function noteDraft(e) {
    const id = S.open[S.tab];
    if (!id) return;
    const d = S.drafts[S.tab].get(id) || {};
    const field = e.target.dataset.field;
    if (field) d[field] = e.target.value;
    if (e.target.dataset.page !== undefined) {
      d.pages = [...$('drawer-body').querySelectorAll('input[data-page]:checked')].map((i) => i.dataset.page);
    }
    S.drafts[S.tab].set(id, d);
    // Flip the "Unsaved changes" lines without redrawing the form.
    const dirty = V.dirtyOf(person(id), d);
    for (const el of $('drawer-body').querySelectorAll('[data-dirty]')) el.hidden = !dirty[el.dataset.dirty];
  }
  const clearDraft = (id, ...keys) => {
    const d = S.drafts[S.tab].get(id);
    if (!d) return;
    for (const k of keys) delete d[k];
    if (!Object.keys(d).length) S.drafts[S.tab].delete(id);
  };
  const valueOf = (id, field) => {
    const d = S.drafts[S.tab].get(id);
    if (d && d[field] !== undefined) return d[field];
    const el = $('drawer-body').querySelector(`[data-field="${field}"]`);
    return el ? el.value : undefined;
  };
  const checkedPages = () => [...$('drawer-body').querySelectorAll('input[data-page]:checked')].map((i) => i.dataset.page);

  // ── doing, one person ──────────────────────────────────────────────────────
  function askBan(who) {
    return new Promise((resolve) => {
      const d = $('ban-dlg');
      $('ban-title').textContent = `Ban ${who}`;
      d.returnValue = '';
      d.onclose = () => resolve(d.returnValue === 'ban' ? Number($('ban-hours').value) : null);
      d.showModal();
    });
  }

  let mailTo = [];
  function openMail(people) {
    mailTo = people.filter((p) => p.email);
    if (!mailTo.length) return toast('Nobody to email.', true);
    $('mail-to').textContent = 'To: ' + (mailTo.length <= 6
      ? mailTo.map((p) => (p.name ? `${p.name} <${p.email}>` : p.email)).join(', ')
      : `${mailTo.length} people`);
    $('mail-msg').textContent = '';
    $('mail-dlg').showModal();
    $('mail-subject').focus();
  }

  const who = (p) => p.name || p.email;

  const SITE_ACTS = {
    async approve(p, b) { await setAccess(p, 'approved', b, 'Approved.'); },
    async access(p, b) { await setAccess(p, 'approved', b, 'Access saved.'); },
    async deny(p, b) {
      if (!await ask({ title: `Remove ${who(p)}'s access?`, body: 'They keep their account but can open nothing.', yes: 'Remove access', danger: true })) return;
      await setAccess(p, 'denied', b, 'Access removed.');
    },
    async profile(p, b) {
      const ok = await busy(b, () => fn('update', { id: p.id, name: valueOf(p.id, 'name'), email: valueOf(p.id, 'email') }));
      if (ok) { clearDraft(p.id, 'name', 'email'); toast('Profile saved.'); await loadSite(); }
    },
    async reset(p, b) {
      if (!await ask({ title: 'Send a password reset?', body: `To ${p.email}.`, yes: 'Send' })) return;
      if (await busy(b, () => fn('reset', { id: p.id }))) toast('Reset email sent.');
    },
    async resend(p, b) {
      if (await busy(b, () => fn('resend', { id: p.id }))) toast(p.invited ? 'Invite sent again.' : 'Confirmation sent again.');
    },
    async ban(p, b) {
      const hours = await askBan(who(p));
      if (hours == null) return;
      if (await busy(b, () => fn('ban', { id: p.id, hours }))) { toast('Banned.'); await loadSite(); }
    },
    async unban(p, b) {
      if (await busy(b, () => fn('ban', { id: p.id, hours: 0 }))) { toast('Unbanned.'); await loadSite(); }
    },
    async delete(p, b) {
      if (!await ask({ title: `Delete ${who(p)}?`, body: 'Their account is removed for good.', yes: 'Delete', danger: true })) return;
      if (await busy(b, () => fn('delete', { id: p.id }))) { toast('Deleted.'); await loadSite(); }
    },
    email(p) { openMail([p]); },
  };

  async function setAccess(p, status, b, done) {
    const pages = status === 'denied' ? [] : checkedPages();
    if (status === 'approved' && !pages.length
      && !await ask({ title: 'Approve with no pages?', body: 'They will be approved but able to open nothing.', yes: 'Approve' })) return;
    const ok = await busy(b, () => rpc('admin_set_access', { target: p.id, new_status: status, grant_pages: pages }).then(() => true));
    if (ok) { clearDraft(p.id, 'pages'); toast(done); await loadSite(); }
  }

  const PILOT_ACTS = {
    async rename(p, b) {
      if (await busy(b, () => K.rename(p.id, valueOf(p.id, 'name') || '').then(() => true))) {
        clearDraft(p.id, 'name'); toast('Renamed.'); await loadPilots();
      }
    },
    async reset(p, b) {
      if (!await ask({ title: 'Send a KONDRITE password reset?', body: `To ${p.email}.`, yes: 'Send' })) return;
      if (await busy(b, () => K.reset(p.email, SITE_ROOT).then(() => true))) toast('Reset email sent.');
    },
    async wipe(p, b) {
      if (!await ask({ title: `Wipe ${who(p)}'s cloud save?`, body: 'The copy on their device stays.', yes: 'Wipe', danger: true })) return;
      if (await busy(b, () => K.wipe(p.id).then(() => true))) { toast('Save wiped.'); await loadPilots(); }
    },
    async scores(p, b) {
      if (!await ask({ title: `Clear ${who(p)}'s scores?`, body: 'Every score they reported or were reported for. Cannot be undone.', yes: 'Clear', danger: true })) return;
      if (await busy(b, () => K.clearScores(p.id).then(() => true))) { toast('Scores cleared.'); await loadPilots(); }
    },
    async ban(p, b) {
      const hours = await askBan(who(p));
      if (hours == null) return;
      if (await busy(b, () => K.ban(p.id, hours).then(() => true))) { toast('Banned.'); await loadPilots(); }
    },
    async unban(p, b) {
      if (await busy(b, () => K.ban(p.id, 0).then(() => true))) { toast('Unbanned.'); await loadPilots(); }
    },
    async delete(p, b) {
      if (!await ask({ title: `Delete ${who(p)}?`, body: 'Their KONDRITE account, save and scores, for good.', yes: 'Delete', danger: true })) return;
      if (await busy(b, () => K.remove(p.id).then(() => true))) { toast('Deleted.'); await loadPilots(); }
    },
    email(p) { openMail([p]); },
  };

  // ── doing, many people ─────────────────────────────────────────────────────
  // One at a time, so a refusal names who it was about; admins and Ric
  // himself are left out of bans and deletes before anything is sent.
  async function each(button, people, work) {
    let ok = 0;
    const failed = [];
    await busy(button, async () => {
      for (const p of people) {
        try { await work(p); ok++; } catch (err) { failed.push(`${who(p)}: ${err.message}`); }
      }
    });
    return { ok, failed };
  }

  const BULK = {
    email(picked) { openMail(picked); },
    async approve(picked, b) {
      const waiting = picked.filter((p) => p.status === 'pending' && !p.is_admin);
      if (!await ask({ title: `Approve ${waiting.length}?`, body: 'Each gets the pages they asked for, plus any they already have.', yes: 'Approve' })) return;
      const r = await each(b, waiting, (p) => rpc('admin_set_access', { target: p.id, new_status: 'approved', grant_pages: [...new Set([...p.pages, ...p.requested])] }));
      report('Approved', r, waiting.length);
      await loadSite();
    },
    async ban(picked, b) {
      const targets = picked.filter((p) => !p.is_admin);
      if (!targets.length) return toast('Admins cannot be banned here.', true);
      const hours = await askBan(`${targets.length} ${targets.length === 1 ? 'person' : 'people'}`);
      if (hours == null) return;
      const r = await each(b, targets, (p) => (S.tab === 'site' ? fn('ban', { id: p.id, hours }) : K.ban(p.id, hours)));
      report('Banned', r, targets.length);
      await (S.tab === 'site' ? loadSite() : loadPilots());
    },
    async delete(picked, b) {
      const targets = picked.filter((p) => !p.is_admin);
      if (!targets.length) return toast('Admins cannot be deleted here.', true);
      if (!await ask({ title: `Delete ${targets.length} ${targets.length === 1 ? 'account' : 'accounts'}?`, body: 'For good. Admins are skipped.', yes: 'Delete', danger: true })) return;
      const r = await each(b, targets, (p) => (S.tab === 'site' ? fn('delete', { id: p.id }) : K.remove(p.id)));
      report('Deleted', r, targets.length);
      await (S.tab === 'site' ? loadSite() : loadPilots());
    },
    clear() { S.picked[S.tab].clear(); draw(); },
  };

  function report(verb, { ok, failed }, of) {
    if (!failed.length) return toast(`${verb} ${ok}.`);
    toast(`${verb} ${ok} of ${of}. ${failed[0]}${failed.length > 1 ? ` (+${failed.length - 1} more)` : ''}`, true);
  }

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
  $('drawer-close').addEventListener('click', closeDrawer);
  $('scrim').addEventListener('click', closeDrawer);
  $('drawer-body').addEventListener('input', noteDraft);
  $('drawer-body').addEventListener('change', noteDraft);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.open[S.tab] && !document.querySelector('dialog[open]')) closeDrawer();
  });

  $('compose').addEventListener('click', async () => {
    const picked = S.picked[S.tab];
    if (picked.size) return openMail(list().filter((p) => picked.has(p.id)));
    const rows = shown();
    if (rows.length > 1 && !await ask({ title: `Email all ${rows.length} people shown?`, yes: 'Write email' })) return;
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
      draw();
      return drawDrawer();
    }
    const stat = e.target.closest('[data-filter]');
    if (stat) { S.filter[S.tab] = stat.dataset.filter; return draw(); }
    const open = e.target.closest('[data-open]');
    if (open) return S.open[S.tab] === open.dataset.open ? closeDrawer() : openDrawer(open.dataset.open);
    const bulk = e.target.closest('[data-bulk]');
    if (bulk) return BULK[bulk.dataset.bulk](list().filter((p) => S.picked[S.tab].has(p.id)), bulk);
    const act = e.target.closest('#drawer button[data-act]');
    if (act) {
      const p = person(act.dataset.id);
      const run = (S.tab === 'site' ? SITE_ACTS : PILOT_ACTS)[act.dataset.act];
      if (p.id && run) run(p, act);
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'pick-all') {
      const set = S.picked[S.tab];
      for (const p of shown()) e.target.checked ? set.add(p.id) : set.delete(p.id);
      return draw();
    }
    const pick = e.target.closest('input[data-pick]');
    if (!pick) return;
    const set = S.picked[S.tab];
    pick.checked ? set.add(pick.dataset.pick) : set.delete(pick.dataset.pick);
    draw();
  });

  boot().catch((err) => { $('si-msg').textContent = `Could not reach the account service (${err.message}).`; showGate('signin'); });
})();
