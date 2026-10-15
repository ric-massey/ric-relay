/* VISIT — one page view, counted
   ────────────────────────────────────────────────────────────────────────────
   Loaded on every page (`<script src="…/assets/visit.js" defer></script>`).
   Sends one small beacon to the Worker's POST /hit when the page opens, and a
   heartbeat once a minute while the tab is in front, so the dashboard at
   /visitors/ can say who is here right now. worker/visitors.mjs is the other
   half and says what is stored.

   What this sends, all of it:
       v  a random id this browser made up the first time (localStorage)
       s  a random session id — a new one after 30 minutes of nothing
       f  whether this is the first page of that session
       p  the page's path, no query string
       r  the referring site's hostname, only when it is another site
       k  'view' or 'ping'

   Nothing else: no cookies, no fingerprint, no screen size, no full referrer
   URL. The country comes from Cloudflare at the other end and the IP address
   is never stored.

   It does nothing on file://, under automation, or on a device Ric has told
   to stop counting (the "ignore this device" switch on /visitors/ sets
   `visit:ignore`). And it never throws: a counter that can break a page is
   worse than no counter. */
(function () {
  try {
    if (location.protocol === 'file:' || navigator.webdriver) return;
    var ls = window.localStorage;
    var ignored = function () { return ls.getItem('visit:ignore') === '1'; };
    if (ignored()) return;

    var HOST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
      ? location.origin
      : 'https://training-log.rmbuster82.workers.dev';
    var IDLE = 30 * 60 * 1000;
    var ID = /^[a-z0-9-]{8,40}$/;

    var rid = function () {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 32);
    };

    var visitor = ls.getItem('visit:id');
    if (!ID.test(visitor || '')) { visitor = rid(); ls.setItem('visit:id', visitor); }

    var first = false, session;
    var touch = function () { ls.setItem('visit:session', JSON.stringify({ id: session, at: Date.now() })); };
    try {
      var held = JSON.parse(ls.getItem('visit:session') || 'null');
      if (held && ID.test(held.id || '') && Date.now() - held.at < IDLE) session = held.id;
    } catch (e) {}
    if (!session) { session = rid(); first = true; }
    touch();

    /* Another site only, and only its name. Moving between rooms is not a
       referral, and ricmassey.com → www.ricmassey.com is the same site. */
    var ref = '';
    try {
      var h = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
      if (h && h !== location.hostname.replace(/^www\./, '')) ref = h;
    } catch (e) {}

    /* 404.html carries data-missing, and its views are filed under /404/… so
       the dashboard can list broken links apart from real pages. */
    var self = document.currentScript;
    var path = (self && self.hasAttribute('data-missing') ? '/404' : '') + location.pathname;

    var send = function (kind) {
      var body = JSON.stringify({ v: visitor, s: session, f: kind === 'view' && first, p: path, r: kind === 'view' ? ref : '', k: kind });
      /* A string body goes as text/plain, which needs no CORS preflight. */
      if (navigator.sendBeacon && navigator.sendBeacon(HOST + '/hit', body)) return;
      fetch(HOST + '/hit', { method: 'POST', body: body, keepalive: true, mode: 'no-cors' }).catch(function () {});
    };

    send('view');

    /* The heartbeat. Only while the tab is in front, and not forever — a tab
       left open overnight is not somebody online. Half an hour of one page is
       the most anyone reads. */
    var opened = Date.now();
    var ping = function () {
      if (document.visibilityState !== 'visible' || ignored()) return;
      if (Date.now() - opened > IDLE) return;
      touch();
      send('ping');
    };
    setInterval(ping, 60 * 1000);
    document.addEventListener('visibilitychange', ping);
  } catch (e) { /* private mode, storage blocked — count nothing, break nothing */ }
})();
