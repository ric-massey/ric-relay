/* Siege Conductor service worker — offline-first.
   Once the app has been opened on the web, it keeps working with no internet. */
const CACHE = "siege-v3";
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
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((resp) => {
        // best-effort cache of same-origin assets (e.g. fonts fetched on first load)
        try {
          if (new URL(e.request.url).origin === location.origin) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
        } catch (_) {}
        return resp;
      }).catch(() => e.request.mode === "navigate"
        ? caches.match("./index.html")
        : Response.error());
    })
  );
});
