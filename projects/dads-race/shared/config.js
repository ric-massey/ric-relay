/*
 * No database key lives in this file, and none may be committed anywhere in this folder.
 *
 * The real Supabase address and key live in shared/config.local.js, which is git-ignored
 * and only exists on Ric's machine. It is loaded only when the app is served from this
 * computer (localhost). Everywhere else, including ricmassey.com, there is no key, and the
 * app runs as a demo on the made-up race in demo-data.js.
 *
 * Add ?demo=1 to any page on localhost to see the demo; ?demo=0 goes back to the real data.
 */
window.HERMISCUS_CONFIG = Object.freeze({ accountDomain: 'hermiscus.local' });
(() => {
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const flag = new URLSearchParams(location.search).get('demo');
  try {
    if (flag === '1') sessionStorage.setItem('hermiscus_force_demo', '1');
    if (flag === '0') sessionStorage.removeItem('hermiscus_force_demo');
  } catch (_) {}
  let forceDemo = false;
  try { forceDemo = sessionStorage.getItem('hermiscus_force_demo') === '1'; } catch (_) {}
  if (local && !forceDemo) {
    // Parser-inserted, so it runs before auth.js reads the config. A missing file just
    // leaves the demo in place.
    document.write(`<script src="${new URL('config.local.js', document.currentScript.src).href}"><\/script>`);
  }
})();
