(() => {
  'use strict';

  const config = window.HERMISCUS_CONFIG || {};
  const scriptUrl = new URL(document.currentScript.src);
  const appRoot = new URL('../', scriptUrl);
  const sessionKey = 'hermiscus_auth_session_v1';
  const maxOfflineAgeMs = 24 * 60 * 60 * 1000;
  // No database key (the public website never has one) means demo mode: made-up data in
  // this browser, no sign-in, and any crew page can be opened to see what that person sees.
  const demo = !config.supabaseUrl || !config.publishableKey;
  const knownNames = Object.freeze({
    victoria: 'Victoria', michelle: 'Michelle', auston: 'Auston',
    grady: 'Grady', silas: 'Silas', ric: 'Ric', sydney: 'Sydney',
    aubrey: 'Aubrey'
  });

  function readSession() {
    try {
      const value = JSON.parse(localStorage.getItem(sessionKey) || 'null');
      return value && value.access_token && value.refresh_token ? value : null;
    } catch (_) {
      return null;
    }
  }

  function writeSession(value) {
    const now = Date.now();
    const stored = {
      access_token: value.access_token,
      refresh_token: value.refresh_token,
      expires_at: value.expires_at || Math.floor(now / 1000) + Number(value.expires_in || 3600),
      user: value.user ? { id: value.user.id, email: value.user.email } : undefined,
      verified_at: now
    };
    localStorage.setItem(sessionKey, JSON.stringify(stored));
    return stored;
  }

  function clearPrivateState() {
    [
      sessionKey,
      'hermesco_me',
      'hermesco_offline_write_queue_v1',
      'hermesco_offline_data_cache_v1',
      'hermesco_local_db_v1'
    ].forEach(key => localStorage.removeItem(key));
  }

  function nameSlug(name) {
    return String(name || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_-]/g, '');
  }

  function emailForName(name) {
    const slug = nameSlug(name);
    if (!slug || slug.length > 64) throw new Error('invalid-name');
    return `${slug}@${config.accountDomain}`;
  }

  function slugFromSession(value = readSession()) {
    const email = String(value && value.user && value.user.email || '').toLowerCase();
    const suffix = `@${config.accountDomain}`;
    return email.endsWith(suffix) ? email.slice(0, -suffix.length) : '';
  }

  function profileName() {
    if (demo) {
      const requested = String(document.body && document.body.dataset.profile || '').toLowerCase();
      return knownNames[requested] || '';
    }
    const slug = slugFromSession();
    return knownNames[slug] || '';
  }

  function profilePath() {
    const slug = slugFromSession();
    return knownNames[slug] ? `profiles/${slug}/` : '';
  }

  async function authRequest(path, body) {
    if (!config.supabaseUrl || !config.publishableKey) throw new Error('missing-config');
    return fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
      method: 'POST',
      headers: {
        apikey: config.publishableKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }

  async function signIn(name, password) {
    const response = await authRequest('token?grant_type=password', {
      email: emailForName(name),
      password: String(password || '')
    });
    if (!response.ok) throw new Error('sign-in-failed');
    const session = writeSession(await response.json());
    if (!profileName(session)) {
      clearPrivateState();
      throw new Error('sign-in-failed');
    }
    return session;
  }

  async function freshSession() {
    const current = readSession();
    if (!current) throw new Error('no-session');
    if ((Number(current.expires_at) * 1000) - Date.now() > 60_000) return current;

    try {
      const response = await authRequest('token?grant_type=refresh_token', {
        refresh_token: current.refresh_token
      });
      if (!response.ok) {
        clearPrivateState();
        throw new Error('session-expired');
      }
      return writeSession(await response.json());
    } catch (error) {
      if (error && (error.message === 'session-expired' || error.message === 'no-session')) throw error;
      if (Date.now() - Number(current.verified_at || 0) <= maxOfflineAgeMs) {
        return { ...current, offline: true };
      }
      clearPrivateState();
      throw new Error('session-expired');
    }
  }

  function directoryUrl() {
    return new URL('index.html', appRoot).href;
  }

  function loginUrl() {
    return new URL('login.html', appRoot).href;
  }

  // Demo sign-in is just a name: there is nothing private behind it to protect.
  function demoProfileUrl(name) {
    const slug = nameSlug(name);
    return demo && knownNames[slug] ? new URL(`profiles/${slug}/`, appRoot).href : '';
  }

  function profileUrl() {
    if (demo) return directoryUrl();
    const path = profilePath();
    return path ? new URL(path, appRoot).href : loginUrl();
  }

  // On the website the app is a demo, and seeing it takes an account on Ric's
  // site with HERMISCUS switched on (the same account as ATLAS; see
  // assets/site-gate.js). That decides only who is shown the demo — its data is
  // made up and its files are public, so this is a curtain, not a lock.
  const siteRoot = new URL('../../', appRoot);
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error(`could not load ${src}`));
      document.head.appendChild(el);
    });
  }
  async function siteGate() {
    if (window.SiteGate) return window.SiteGate;
    if (!window.supabase) await loadScript('https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js');
    if (!window.CONFIG) await loadScript(new URL('atlas/config.js', siteRoot).href);
    await loadScript(new URL('assets/site-gate.js', siteRoot).href);
    return window.SiteGate;
  }
  async function demoAccess() {
    return (await siteGate()).check('hermiscus');
  }

  async function requireSession() {
    if (demo) {
      try {
        if ((await demoAccess()).state === 'ok') return true;
      } catch (_) {}
      window.location.replace(loginUrl());
      return false;
    }
    try {
      await freshSession();
      if (!profileName()) throw new Error('unknown-member');
      return true;
    } catch (_) {
      clearPrivateState();
      window.location.replace(loginUrl());
      return false;
    }
  }

  function ensureProfileRoute() {
    if (demo) return true;
    const expected = new URL(profileUrl()).pathname.replace(/index\.html$/, '');
    const current = window.location.pathname.replace(/index\.html$/, '');
    if (current !== expected) {
      window.location.replace(profileUrl());
      return false;
    }
    return true;
  }

  async function authorizedHeaders(existing = {}) {
    const session = await freshSession();
    if (session.offline) {
      const error = new Error('offline');
      error.offline = true;
      throw error;
    }
    return {
      ...existing,
      apikey: config.publishableKey,
      Authorization: `Bearer ${session.access_token}`
    };
  }

  async function signOut() {
    if (demo) { try { await (await siteGate()).signOut(); } catch (_) {} return; }
    const current = readSession();
    clearPrivateState();
    if (current && navigator.onLine) {
      try {
        await fetch(`${config.supabaseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: config.publishableKey,
            Authorization: `Bearer ${current.access_token}`
          }
        });
      } catch (_) {
        // The local session is already gone. A network failure must not keep the app open.
      }
    }
  }

  window.HermiscusAuth = Object.freeze({
    readSession, signIn, signOut, freshSession, requireSession,
    ensureProfileRoute, authorizedHeaders, profileName, profileUrl,
    loginUrl, directoryUrl, demoProfileUrl, clearPrivateState, demo,
    demoAccess, siteGate
  });
})();
