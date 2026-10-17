/* WEATHER-SW — the weather room's service worker, and the only one on the site
   ────────────────────────────────────────────────────────────────────────────
   Registered by weather.html with scope "./weather", so it controls that page
   and nothing else on ricmassey.com. It exists so the room opens from a home
   screen with no signal: every same-origin file the page loads (the page, its
   scripts, the scoreboard files) is fetched from the network first, and the
   last good copy is kept for when the network is not there. Nothing from any
   other host is touched — forecasts, alerts and radar always come fresh, and
   the page keeps its own last forecast in localStorage for offline.

   Network first means a change to the site reaches a home-screen user on their
   next open with signal, never a week later. Bump VERSION to drop old copies. */
const VERSION = 'wx-1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
      if (hit) return hit;
      throw err;
    }
  })());
});
