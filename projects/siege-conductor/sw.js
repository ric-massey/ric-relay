/* Siege Conductor service worker — offline-first.
   Once the app has been opened on the web, it keeps working with no internet. */
/* v4 (2026-10-29, bug sweep C4-2 and C4-12): network first, so a returning
   visitor gets today's page and the site's shared scripts instead of July's;
   the cache is the fallback with no signal. Only good answers are kept — a
   404 seen once was kept for good. And the precache takes each file on its
   own, so one missing file (the shared scripts live outside this folder)
   no longer stops the whole install. */
const CACHE = "siege-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./favicon-32.png",
  "../relay-return.js",
  "../../effects.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

/* Only Siege's own old versions. Cache Storage is the whole origin's, and
   deleting "everything that isn't mine" wiped ATLAS's offline maps. */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("siege-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then((resp) => {
      // A fresh copy of a good same-origin answer, for the next time offline.
      try {
        if (resp.ok && new URL(e.request.url).origin === location.origin) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
      } catch (_) {}
      return resp;
    }).catch(() => caches.open(CACHE).then((c) => c.match(e.request)).then((hit) =>
      hit || (e.request.mode === "navigate"
        ? caches.open(CACHE).then((c) => c.match("./index.html"))
        : Response.error())))
  );
});
