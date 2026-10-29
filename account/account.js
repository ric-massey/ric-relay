/* The account page: sign in, ask for access, see what you can open.
 *
 * Deciding moved to /admin/ (2026-10-16): Ric's approvals, invites, emails and
 * KONDRITE's pilots all live there now, and this page only links to it for an
 * admin. Nothing here is trusted for anything — request_access and
 * has_page_access in the database make every decision. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const db = window.SiteGate.db();
  const siteRoot = new URL('../', location.href);
  const PENDING_KEY = 'site-account-pending-request';
  let PAGES = [];
  // The page that sent them here (?for=atlas). A new account asks for that page and only
  // that one — there is no list to choose from. Arriving from nowhere in particular (the
  // terminal's `login`) makes an account with nothing asked for; opening a locked page
  // later offers "request permission" there.
  const forKey = new URLSearchParams(location.search).get('for') || '';

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const pageHref = (p) => new URL(p.path || '', siteRoot).href;
  const labelOf = (key) => (PAGES.find((p) => p.key === key) || { label: key }).label;
  // The three panels are exclusive.
  const show = (id) => ['signin-panel', 'request-panel', 'me-panel'].forEach((p) => { $(p).hidden = p !== id; });
  const say = (id, text, good = false) => { const el = $(id); el.textContent = text; el.classList.toggle('good', good); };

  async function loadPages() {
    const { data } = await db.from('site_pages').select('key,label,blurb,path,sort').order('sort');
    PAGES = data || [];
    const page = PAGES.find((p) => p.key === forKey);
    $('rq-for').innerHTML = page
      ? `asking for <b>${esc(page.label)}</b>`
      : 'makes your account — open the page you are after and ask for it there';
    $('rq-go').textContent = page ? 'send request' : 'make account';
  }
  const requestedPages = () => (PAGES.some((p) => p.key === forKey) ? [forKey] : []);

  // A request typed before an email-confirmation step still has to reach Ric.
  async function sendStoredRequest(session) {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch (_) {}
    if (!stored) return;
    const mine = String((session && session.user && session.user.email) || '').toLowerCase();
    if (!stored.email || stored.email !== mine) {
      // Somebody else's, or one from before requests carried their address.
      try { localStorage.removeItem(PENDING_KEY); } catch (_) {}
      return;
    }
    const { email: _for, ...request } = stored;
    const { error } = await db.rpc('request_access', request);
    // ATLAS makes every new account pick a password on first sign-in, which was
    // right when Ric texted out starting passwords. Somebody who signed up here
    // chose their own a minute ago, so they are not asked twice.
    await db.rpc('complete_password_change');
    if (!error) try { localStorage.removeItem(PENDING_KEY); } catch (_) {}
  }

  async function render() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
      show(location.hash === '#request' ? 'request-panel' : 'signin-panel');
      return;
    }
    await sendStoredRequest(session);
    const uid = session.user.id;
    const [{ data: request }, { data: access }, { data: isAdmin }] = await Promise.all([
      db.from('access_requests').select('status,pages').eq('user_id', uid).maybeSingle(),
      db.from('site_access').select('page_key').eq('user_id', uid),
      db.rpc('is_site_admin'),
    ]);
    const mine = new Set((access || []).map((a) => a.page_key));
    const status = isAdmin ? 'admin' : (request && request.status) || 'pending';
    const asked = (request && request.status === 'pending' ? request.pages || [] : []).filter((k) => !mine.has(k));

    $('me-email').textContent = `signed in as ${session.user.email || ''}`;
    const waitingOn = asked.length ? `<b>waiting for Ric</b> on ${esc(asked.map(labelOf).join(', '))}.` : '';
    $('me-status').innerHTML = status === 'admin' ? '<b>you run the place.</b> every page is open to you.'
      : status === 'denied' ? 'this account has not been given access.'
      : mine.size ? `${waitingOn ? waitingOn + ' meanwhile, ' : ''}here is what you can open:`
      : waitingOn || '<b>waiting for Ric.</b> your request is with him; this page will show what you can open once he decides.';
    const open = PAGES.filter((p) => isAdmin || mine.has(p.key));
    $('me-pages').innerHTML = (isAdmin
      ? `<li><a href="${esc(new URL('admin/', siteRoot).href)}">Admin →</a> <small>accounts, access and email</small></li>` : '')
      + open.map((p) =>
      `<li><a href="${esc(pageHref(p))}">${esc(p.label)} →</a> <small>${esc(p.blurb)}</small></li>`).join('');
    show('me-panel');
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
    const wanted = requestedPages();
    if (!name) return say('rq-msg', 'your name, so Ric knows who is asking');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return say('rq-msg', 'that email does not look right');
    if (password.length < 8) return say('rq-msg', 'password needs at least 8 characters');
    const request = { who: name, why: '', wanted };
    // The request is kept with the address it was typed for, and dropped if
    // the sign-up fails: it used to stay behind and go out for whoever signed
    // in next on this browser, under their account (bug sweep A1-6).
    $('rq-go').disabled = true;
    try {
      try { localStorage.setItem(PENDING_KEY, JSON.stringify({ ...request, email })); } catch (_) {}
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
      try { localStorage.removeItem(PENDING_KEY); } catch (_) {}
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
  });

  $('signout').addEventListener('click', async () => {
    await window.SiteGate.signOut();
    await render();
  });

  loadPages().then(render).catch((err) => say('si-msg', `could not reach the account service (${err.message})`));
})();
