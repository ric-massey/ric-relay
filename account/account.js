/* The account page: sign in, ask for access, and — for Ric — decide.
 *
 * Nothing here is trusted for anything. Every decision is made by the database
 * (request_access, admin_people, admin_set_access, has_page_access); this page
 * only asks and draws the answers. A person who edits this file in their
 * browser can make the admin panel appear and it will be empty and every button
 * in it will be refused. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const db = window.SiteGate.db();
  const siteRoot = new URL('../', location.href);
  const PENDING_KEY = 'site-account-pending-request';
  let PAGES = [];

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const pageHref = (p) => new URL(p.path || '', siteRoot).href;
  const labelOf = (key) => (PAGES.find((p) => p.key === key) || { label: key }).label;
  // The three main panels are exclusive; the admin panel is set on its own.
  const show = (id) => ['signin-panel', 'request-panel', 'me-panel'].forEach((p) => { $(p).hidden = p !== id; });
  const say = (id, text, good = false) => { const el = $(id); el.textContent = text; el.classList.toggle('good', good); };

  async function loadPages() {
    const { data } = await db.from('site_pages').select('key,label,blurb,path,sort').order('sort');
    PAGES = data || [];
    $('rq-pages').innerHTML = PAGES.map((p) => `
      <label><input type="checkbox" name="page" value="${esc(p.key)}">
        <span>${esc(p.label)} <small>· ${esc(p.blurb)}</small></span></label>`).join('');
  }

  // A request typed before an email-confirmation step still has to reach Ric.
  async function sendStoredRequest() {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch (_) {}
    if (!stored) return;
    const { error } = await db.rpc('request_access', stored);
    // ATLAS makes every new account pick a password on first sign-in, which was
    // right when Ric texted out starting passwords. Somebody who signed up here
    // chose their own a minute ago, so they are not asked twice.
    await db.rpc('complete_password_change');
    if (!error) try { localStorage.removeItem(PENDING_KEY); } catch (_) {}
  }

  async function render() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
      $('admin-panel').hidden = true;
      show(location.hash === '#request' ? 'request-panel' : 'signin-panel');
      return;
    }
    await sendStoredRequest();
    const uid = session.user.id;
    const [{ data: request }, { data: access }, { data: isAdmin }] = await Promise.all([
      db.from('access_requests').select('status,pages').eq('user_id', uid).maybeSingle(),
      db.from('site_access').select('page_key').eq('user_id', uid),
      db.rpc('is_site_admin'),
    ]);
    const mine = new Set((access || []).map((a) => a.page_key));
    const status = isAdmin ? 'admin' : (request && request.status) || 'pending';

    $('me-email').textContent = `signed in as ${session.user.email || ''}`;
    $('me-status').innerHTML = {
      admin: '<b>you run the place.</b> every page is open to you.',
      approved: mine.size ? '<b>approved.</b> here is what you can open:' : '<b>approved</b>, but nothing is switched on for you yet.',
      pending: '<b>waiting for Ric.</b> your request is with him; this page will show what you can open once he decides.',
      denied: 'this account has not been given access.',
    }[status] || '';
    const open = PAGES.filter((p) => isAdmin || mine.has(p.key));
    $('me-pages').innerHTML = open.map((p) =>
      `<li><a href="${esc(pageHref(p))}">${esc(p.label)} →</a> <small>${esc(p.blurb)}</small></li>`).join('');

    $('admin-panel').hidden = !isAdmin;
    show('me-panel');
    if (isAdmin) await renderAdmin();
  }

  function pageChecks(userId, checked) {
    return `<div class="checks" role="group" aria-label="pages">${PAGES.map((p) => `
      <label><input type="checkbox" data-user="${esc(userId)}" value="${esc(p.key)}" ${checked.includes(p.key) ? 'checked' : ''}>
        <span>${esc(p.label)}</span></label>`).join('')}</div>`;
  }

  function personCard(p, pending) {
    const when = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const tag = p.is_admin ? '<span class="tag">admin</span>'
      : p.status === 'approved' ? '' : `<span class="tag ${esc(p.status)}">${esc(p.status)}</span>`;
    const checked = pending ? (p.requested.length ? p.requested : []) : p.pages;
    return `<div class="person" data-person="${esc(p.user_id)}">
      <div class="who">${esc(p.name || p.username || p.email)}${tag}</div>
      <div class="meta">${esc(p.email)} · joined ${esc(when)}${pending && p.requested.length ? ` · asked for ${esc(p.requested.map(labelOf).join(', '))}` : ''}</div>
      ${p.note ? `<div class="note">${esc(p.note)}</div>` : ''}
      ${p.is_admin ? '' : `${pageChecks(p.user_id, checked)}
      <div class="row">
        ${pending
          ? `<button type="button" data-act="approve" data-user="${esc(p.user_id)}">approve</button>
             <button type="button" class="danger" data-act="deny" data-user="${esc(p.user_id)}">deny</button>`
          : `<button type="button" class="ghost" data-act="save" data-user="${esc(p.user_id)}">save access</button>
             ${p.status === 'denied' ? '' : `<button type="button" class="danger" data-act="deny" data-user="${esc(p.user_id)}">remove</button>`}`}
      </div>`}
    </div>`;
  }

  async function renderAdmin() {
    const { data, error } = await db.rpc('admin_people');
    if (error) { say('admin-msg', error.message); return; }
    const people = data || [];
    const pending = people.filter((p) => p.status === 'pending' && !p.is_admin);
    const rest = people.filter((p) => !(p.status === 'pending' && !p.is_admin));
    $('pending-count').textContent = pending.length ? String(pending.length) : '';
    $('pending-count').hidden = !pending.length;
    $('pending-list').innerHTML = pending.length
      ? pending.map((p) => personCard(p, true)).join('')
      : '<p>no one is waiting.</p>';
    $('people-list').innerHTML = rest.map((p) => personCard(p, false)).join('');
  }

  async function decide(button) {
    const user = button.dataset.user;
    const act = button.dataset.act;
    const pages = [...document.querySelectorAll(`input[data-user="${CSS.escape(user)}"]:checked`)].map((i) => i.value);
    if (act === 'deny' && !confirm('Take away all access for this account?')) return;
    if (act === 'approve' && !pages.length && !confirm('Approve with no pages ticked?')) return;
    button.disabled = true;
    const { error } = await db.rpc('admin_set_access', {
      target: user, new_status: act === 'deny' ? 'denied' : 'approved', grant_pages: act === 'deny' ? [] : pages,
    });
    button.disabled = false;
    if (error) { say('admin-msg', error.message); return; }
    say('admin-msg', act === 'deny' ? 'access removed.' : 'saved.', true);
    await renderAdmin();
  }

  $('signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    say('si-msg', '');
    $('si-go').disabled = true;
    try {
      await window.SiteGate.signIn($('si-email').value, $('si-pass').value);
      $('si-pass').value = '';
      await render();
    } catch (err) {
      say('si-msg', /invalid/i.test(err.message || '') ? 'wrong email or password' : err.message);
    } finally {
      $('si-go').disabled = false;
    }
  });

  $('request-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    say('rq-msg', '');
    const name = $('rq-name').value.trim();
    const email = $('rq-email').value.trim().toLowerCase();
    const password = $('rq-pass').value;
    const wanted = [...document.querySelectorAll('#rq-pages input:checked')].map((i) => i.value);
    if (!name) return say('rq-msg', 'your name, so Ric knows who is asking');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say('rq-msg', 'that email does not look right');
    if (password.length < 8) return say('rq-msg', 'password needs at least 8 characters');
    if (!wanted.length) return say('rq-msg', 'tick at least one thing you would like to see');
    const request = { who: name, why: $('rq-note').value.trim(), wanted };
    $('rq-go').disabled = true;
    try {
      try { localStorage.setItem(PENDING_KEY, JSON.stringify(request)); } catch (_) {}
      const { data, error } = await db.auth.signUp({
        email, password, options: { data: { display_name: name }, emailRedirectTo: location.href.split('#')[0] },
      });
      if (error) throw error;
      $('rq-pass').value = '';
      if (data.session) {
        await render();
      } else {
        say('rq-msg', 'check your email to confirm the address — your request goes to Ric as soon as you sign in.', true);
      }
    } catch (err) {
      say('rq-msg', /registered|exists/i.test(err.message || '') ? 'that email already has an account — sign in instead'
        : /signups? not allowed|disabled/i.test(err.message || '') ? 'requests are switched off right now'
        : err.message);
    } finally {
      $('rq-go').disabled = false;
    }
  });

  document.addEventListener('click', (e) => {
    const sw = e.target.closest('[data-show]');
    if (sw) { show(sw.dataset.show); const first = $(sw.dataset.show).querySelector('input'); if (first) first.focus(); return; }
    const act = e.target.closest('button[data-act]');
    if (act) decide(act);
  });

  $('signout').addEventListener('click', async () => {
    await window.SiteGate.signOut();
    $('admin-panel').hidden = true;
    await render();
  });

  loadPages().then(render).catch((err) => say('si-msg', `could not reach the account service (${err.message})`));
})();
