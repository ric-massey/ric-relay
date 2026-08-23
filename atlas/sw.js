/* ATLAS service worker.
 *
 * Two jobs, deliberately kept apart:
 *
 *   1. The app shell lives in a versioned cache and is replaced wholesale on
 *      every deploy. Bump SHELL_VERSION and the old one is binned.
 *   2. Map tiles live in their own cache that survives deploys, because a tile
 *      of a canyon does not go stale and re-downloading 4,000 of them over cell
 *      data would be rude.
 */

const SHELL_VERSION = 'atlas-shell-v12';
const TILE_CACHE    = 'atlas-tiles-v1';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './config.js',
  './db.js',
  './tiles.js',
  './photos.js',
  './owners.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
  'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js',
];

// Hosts whose responses are map tiles. Anything from here is cache-first and
// kept forever.
const TILE_HOSTS = [
  'server.arcgisonline.com',
  'basemap.nationalmap.gov',
  'tile.openstreetmap.org',
  'a.tiles.openrailwaymap.org',
  'tile.waymarkedtrails.org',
  'tiles.arcgis.com',
  'gis.blm.gov',
  'services.arcgisonline.com',
  'a.tile.opentopomap.org',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_VERSION);
    // Individually, so one dead CDN URL can't fail the whole install.
    await Promise.all(SHELL.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (k !== SHELL_VERSION && k !== TILE_CACHE) return caches.delete(k);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never cache Supabase. Stale pins are worse than no pins, and the app keeps
  // its own copy in IndexedDB for when there's no signal.
  if (url.hostname.endsWith('.supabase.co')) return;

  // An ArcGIS /query is not a tile — it is an answer about one point. gis.blm.gov
  // is in TILE_HOSTS, so without this the ownership lookups would be filed in the
  // tile cache and kept forever, and the offline fallback would hand a question
  // about who owns a canyon a transparent PNG. Straight to the network; the app
  // keeps its own answer per pin in IndexedDB for when there is no network.
  //
  // The same goes for every other ArcGIS answer the app asks for — the layer
  // metadata and the catalogue search behind "find the county's records" are
  // questions, not tiles, and www.arcgis.com is not in TILE_HOSTS, so without
  // this they would go to shellFirst and be answered out of the app-shell cache
  // for the life of the deploy. Nothing that is a tile asks for f=json.
  if (url.pathname.endsWith('/query') || url.searchParams.get('f') === 'json') return;

  if (TILE_HOSTS.includes(url.hostname)) {
    event.respondWith(tileFirst(req));
    return;
  }

  event.respondWith(shellFirst(req));
});

/* A tile we already have is always the right answer. */
async function tileFirst(req) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;

  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    // Offline and never downloaded. Hand back a transparent tile so the map
    // shows a hole rather than throwing console errors at every pan.
    return blankTile();
  }
}

/* App shell: serve from cache, refresh in the background. */
async function shellFirst(req) {
  const cache = await caches.open(SHELL_VERSION);
  const hit = await cache.match(req, { ignoreVary: true });

  const fresh = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);

  if (hit) return hit;

  const res = await fresh;
  if (res) return res;

  // A navigation with nothing cached at all: fall back to the app itself.
  if (req.mode === 'navigate') {
    const shell = await cache.match('./index.html', { ignoreVary: true });
    if (shell) return shell;
  }
  return new Response('offline', { status: 503, statusText: 'offline' });
}

const BLANK_PNG = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
), (c) => c.charCodeAt(0));

function blankTile() {
  return new Response(BLANK_PNG, {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
  });
}
