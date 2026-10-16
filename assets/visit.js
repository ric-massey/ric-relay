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
       k  'view', 'ping', 'leave' or 'out'
       i  a random id for this one page view, so its heartbeats find it
       l  the browser's language, two letters ('en')
       w  the window's width class: S, M, L or XL — not the size
       u  utm_source or ?ref= from the address, when a shared link carried one
       c  utm_campaign, likewise
       t  seconds this page has been in front (heartbeats and leaving)
       d  how far down it has been scrolled, percent (likewise)
       o  on 'out': the hostname of a link to another site that was clicked

   Nothing else: no cookies, no fingerprint, no exact screen size, no full
   referrer URL, nothing typed. The country comes from Cloudflare at the other end and the IP address
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

    var view = rid();
    var lang = ((navigator.language || '').split('-')[0] || '').toLowerCase();
    var vw = window.innerWidth || 0;
    var width = vw < 600 ? 'S' : vw < 1024 ? 'M' : vw < 1440 ? 'L' : 'XL';
    var qs = new URLSearchParams(location.search);
    var src = qs.get('utm_source') || qs.get('ref') || '', camp = qs.get('utm_campaign') || '';

    /* Time in front: counted only while the tab is visible, capped at the
       same half hour the heartbeat stops at. */
    var shown = 0, since = document.visibilityState === 'visible' ? Date.now() : 0;
    var seconds = function () { return Math.min(IDLE, shown + (since ? Date.now() - since : 0)) / 1000 | 0; };
    var depth = 0;
    var scrolled = function () {
      var el = document.documentElement;
      var h = Math.max(el.scrollHeight, document.body ? document.body.scrollHeight : 0);
      var seen = h > 0 ? Math.round(((window.scrollY || el.scrollTop || 0) + window.innerHeight) / h * 100) : 100;
      if (seen > depth) depth = Math.min(100, seen);
    };

    var send = function (kind, extra) {
      var msg = { v: visitor, s: session, i: view, f: kind === 'view' && first, p: path, r: kind === 'view' ? ref : '', k: kind };
      if (kind === 'view') { msg.l = lang; msg.w = width; msg.u = src; msg.c = camp; }
      if (kind === 'ping' || kind === 'leave') { msg.t = seconds(); msg.d = depth; }
      if (extra) for (var x in extra) msg[x] = extra[x];
      var body = JSON.stringify(msg);
      /* A string body goes as text/plain, which needs no CORS preflight. */
      if (navigator.sendBeacon && navigator.sendBeacon(HOST + '/hit', body)) return;
      fetch(HOST + '/hit', { method: 'POST', body: body, keepalive: true, mode: 'no-cors' }).catch(function () {});
    };

    send('view');
    scrolled();
    window.addEventListener('scroll', scrolled, { passive: true });

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
    /* Going to the background or closing: bank the visible time and say how
       long and how far, once. Coming back: start the clock again. */
    var left = false;
    var leave = function () {
      if (since) { shown += Date.now() - since; since = 0; }
      if (left || ignored()) return;
      left = true;
      send('leave');
    };
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') { since = Date.now(); left = false; ping(); }
      else leave();
    });
    window.addEventListener('pagehide', leave);

    /* A link to another site: only where it went, by hostname. */
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || ignored()) return;
      try {
        var to = new URL(a.href, location.href);
        if (!/^https?:$/.test(to.protocol)) return;
        if (to.hostname.replace(/^www\./, '') === location.hostname.replace(/^www\./, '')) return;
        send('out', { o: to.hostname });
      } catch (err) {}
    }, true);
  } catch (e) { /* private mode, storage blocked — count nothing, break nothing */ }
})();
