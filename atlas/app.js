/* ATLAS — private crew map.
 *
 * Three people, one map, pins anyone in the crew can drop and everyone can find
 * again. Two rules drive every decision in here:
 *
 *   1. Dropping a pin in the field takes one tap and no thought. The filling-in
 *      happens at home on wifi.
 *   2. It has to work with no signal, because the places worth pinning don't
 *      have any. Pins are mirrored to IndexedDB, writes queue up offline, and
 *      map tiles can be downloaded before you leave the house.
 */

import { local } from './db.js';
import { lngLatToTile, tileUrlsForBounds } from './tiles.js';
import { shrink, photoPath } from './photos.js';
import {
  lookup as lookupOwnership, assessorSearchUrl, parcelSiteUrl,
  discoverParcelSource,
} from './owners.js';

const db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

/* Read this before supabase-js consumes and clears the hash. An invite link and
 * a password-reset link both drop you here already signed in, and both should
 * land on "choose your password" rather than the map. */
const LINK_TYPE = new URLSearchParams(location.hash.replace(/^#/, '')).get('type');

const $ = (id) => document.getElementById(id);
const IS_APPLE = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
const TILE_CACHE = 'atlas-tiles-v1';
const PHOTO_BUCKET = 'pin-photos';
const BYTES_PER_TILE = 28 * 1024;   // measured: Esri ~20 KB, USGS/OSM ~32 KB

let map       = null;
let me        = null;    // { id, username, display_name }
let pins      = [];      // every pin the crew has dropped
let markers   = new Map();
let meMarker  = null;
let sheet     = null;    // { mode: 'new' | 'view', pin }
let basemap   = 'sat';
let download  = null;    // { cancel: bool } while an area download runs
let notes     = [];      // every note on every pin the crew can see
let photoRows = [];      // the photo index. The images live in IndexedDB.
let parcelSources = [];  // county assessor adapters — see owners.js
let ownerShown = null;   // { r, cached } — the ownership answer currently drawn
let countyHunt = null;   // { pinId, state, found } while looking for a county
let editingNote = null;  // id of the note currently open for editing
let placing = false;     // true while you are choosing a point on the map
let draftNote = null;    // { id, pending } — photos attached to a note not yet written
let photoTarget = null;  // which strip the next pick from the file input lands in

/* Object URLs handed to <img>, and a generation counter. Rendering a photo is
 * async, so a sheet closed mid-load would otherwise hand a URL to a thumbnail
 * nobody is looking at and leak it. Every render bumps the generation; a load
 * that finishes against a stale one throws its URL away. */
let objectUrls = [];
let photoGen   = 0;
let lightboxUrl = null;

/* ── base maps ───────────────────────────────────────────────────────────
 * All free, all no-key, all nationwide. Satellite is the default because it is
 * the one that shows you a bridge. Topo is USGS, which is the one that shows a
 * contour tight enough to be a cliff.
 */
const BASEMAPS = {
  sat: {
    label: 'satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Esri, Maxar, Earthstar Geographics',
    maxzoom: 19,
  },
  hybrid: {
    label: 'satellite + topo',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}',
    attribution: 'USGS The National Map',
    maxzoom: 16,
  },
  topo: {
    label: 'USGS topo',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    attribution: 'USGS The National Map',
    maxzoom: 16,
  },
  otm: {
    label: 'contour topo',
    url: 'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap, OpenStreetMap contributors (CC-BY-SA)',
    maxzoom: 17,
    // OpenTopoMap is run by volunteers off donated hardware. Browsing it is
    // fine; pulling four thousand tiles of it in one go is not, so it is left
    // out of area downloads on purpose.
    noBulk: true,
  },
  street: {
    label: 'street',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxzoom: 19,
  },
};

/* ── overlays ────────────────────────────────────────────────────────────
 * Things you can put on top of a base map. Roads-over-satellite is the one
 * that gets used most: imagery tells you what's there, the road layer tells you
 * how to get near it. All free, all keyless.
 */
const OVERLAYS = {
  roads: {
    label: 'roads',
    urls: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}'],
    maxzoom: 19,
    attribution: 'Esri',
  },
  labels: {
    label: 'place names',
    urls: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
    maxzoom: 19,
    attribution: 'Esri',
  },
  rail: {
    label: 'railways',
    urls: ['https://a.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png'],
    maxzoom: 19,
    attribution: '&copy; OpenRailwayMap, OpenStreetMap contributors',
  },
  trails: {
    label: 'trails',
    urls: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
    maxzoom: 18,
    attribution: 'waymarkedtrails.org, OpenStreetMap contributors',
  },
  terrain: {
    label: 'terrain shading',
    // Esri's hillshade rather than the USGS one: sharper, and it does not stop
    // at the US border.
    urls: ['https://services.arcgisonline.com/arcgis/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}'],
    maxzoom: 16,
    attribution: 'Esri',
  },
  water: {
    label: 'creeks & water',
    urls: ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSHydroCached/MapServer/tile/{z}/{y}/{x}'],
    maxzoom: 16,
    attribution: 'USGS The National Map',
  },
  publicland: {
    label: 'public land',
    urls: ['https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_without_PriUnk/MapServer/tile/{z}/{y}/{x}'],
    maxzoom: 16,
    attribution: 'BLM Surface Management Agency',
    opacity: 0.45,
  },
  parcels: {
    label: 'property lines',
    urls: ['https://tiles.arcgis.com/tiles/KzeiCaQsMoeCfoCq/arcgis/rest/services/Regrid_Nationwide_Parcel_Boundaries_v1/MapServer/tile/{z}/{y}/{x}'],
    // The cache starts at 16 — below that the server 404s every tile, so asking
    // for them just spams the network with misses.
    minzoom: 16,
    maxzoom: 19,
    attribution: 'Regrid',
  },
};

let overlaysOn = new Set();

/* ── little helpers ─────────────────────────────────────────────────────── */

let toastTimer = null;
function toast(msg, bad = false) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('is-bad', bad);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, bad ? 4200 : 2200);
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined,
  { year: 'numeric', month: 'short', day: 'numeric' });

const fmtCoords = (lat, lng) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

const pinTitle = (p) => p.name?.trim() || `untitled — ${fmtDate(p.created_at)}`;

const fmtSize = (bytes) => bytes >= 1073741824
  ? `${(bytes / 1073741824).toFixed(1)} GB`
  : `${Math.round(bytes / 1048576)} MB`;

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const online = () => navigator.onLine;

const EMPTY_GEOJSON = { type: 'FeatureCollection', features: [] };

/* Straight-line metres between two points. It is not the walk — nothing here
 * knows about the ridge in between — so everything that shows it says so. */
function metresBetween(a, b) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/* Both units on purpose: the app talks in metres because GPS does, and the crew
 * thinks in feet and miles. */
const fmtDistance = (m) => m < 1000
  ? `${Math.round(m)} m &middot; ${Math.round(m * 3.28084).toLocaleString()} ft`
  : `${(m / 1000).toFixed(1)} km &middot; ${(m / 1609.344).toFixed(1)} mi`;

/* ── auth ────────────────────────────────────────────────────────────────
 * Crew types a username. Supabase only understands emails, so the domain gets
 * glued on here and they never see it.
 */

async function handleLogin(e) {
  e.preventDefault();
  const btn = $('login-btn');
  const err = $('login-error');
  err.hidden = true;
  btn.disabled = true;
  btn.textContent = 'signing in…';

  const { error } = await db.auth.signInWithPassword({
    email: $('email').value.trim().toLowerCase(),
    password: $('password').value,
  });

  if (error) {
    // Don't leak which half was wrong — same message either way.
    err.textContent = !online()
      ? 'no signal — you need to be online to sign in the first time'
      : (/invalid/i.test(error.message) ? 'wrong username or password' : error.message);
    err.hidden = false;
    btn.disabled = false;
    btn.textContent = 'sign in';
    return;
  }
  $('password').value = '';
  await start();
}

async function forgotPassword(e) {
  e.preventDefault();
  const email = $('email').value.trim().toLowerCase();
  const err = $('login-error');
  if (!email) {
    err.textContent = 'type your email address first';
    err.hidden = false;
    return;
  }
  const { error } = await db.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + location.pathname,
  });
  // Say the same thing either way — whether an address has an account here is
  // nobody's business but ours.
  err.textContent = error && !/rate|limit/i.test(error.message)
    ? 'if that address has an account, a reset link is on its way'
    : (error ? error.message : 'if that address has an account, a reset link is on its way');
  err.style.color = 'var(--ink-dim)';
  err.hidden = false;
}

async function setNewPassword(e) {
  e.preventDefault();
  const btn = $('np-btn');
  const err = $('np-error');
  const p1 = $('np-1').value;
  const p2 = $('np-2').value;

  const fail = (msg) => { err.textContent = msg; err.hidden = false; };
  err.hidden = true;

  if (p1.length < 8)  return fail('at least 8 characters');
  if (p1 !== p2)      return fail("those don't match");

  btn.disabled = true;
  btn.textContent = 'setting…';

  const { error } = await db.auth.updateUser({ password: p1 });
  if (error) {
    fail(error.message);
    btn.disabled = false;
    btn.textContent = 'set password';
    return;
  }

  // Only now is the flag allowed to drop — the RPC keys off auth.uid(), so it
  // can only ever clear the caller's own.
  const { error: rpcError } = await db.rpc('complete_password_change');
  if (rpcError) {
    fail(rpcError.message);
    btn.disabled = false;
    btn.textContent = 'set password';
    return;
  }

  me.must_change_password = false;
  await local.set('me', me);
  history.replaceState(null, '', location.pathname + location.search);
  $('np-1').value = '';
  $('np-2').value = '';
  btn.disabled = false;
  btn.textContent = 'set password';
  await start();
  toast('password set');
}

async function signOut() {
  const pending = await local.queueCount();
  const warning = pending
    ? `\n\n${pending} pin${pending > 1 ? 's have' : ' has'} not synced yet. Signing out will lose ${pending > 1 ? 'them' : 'it'}.`
    : '';
  if (!confirm(`Sign out of ATLAS?${warning}`)) return;
  await db.auth.signOut();
  location.reload();
}

/* ── boot ────────────────────────────────────────────────────────────────── */

async function start() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    $('gate').hidden = false;
    $('app').hidden = true;
    return;
  }

  // Offline, the profile fetch will fail — fall back to the copy we kept.
  let profile = await local.get('me');
  if (online()) {
    const { data } = await db.from('profiles')
      .select('id, username, display_name, must_change_password')
      .eq('id', session.user.id).single();
    if (data) { profile = data; await local.set('me', data); }
  }

  me = profile || {
    id: session.user.id,
    username: session.user.email.split('@')[0],
    display_name: session.user.email.split('@')[0],
  };

  $('gate').hidden = true;

  // Arriving from an invite or a reset link, or carrying a password someone
  // else chose: pick your own before you see anything.
  if (me.must_change_password || LINK_TYPE === 'invite' || LINK_TYPE === 'recovery') {
    $('np-user').value = me.username;   // gives password managers something to file under
    $('newpass').hidden = false;
    $('app').hidden = true;
    setTimeout(() => $('np-1').focus(), 80);
    return;
  }

  $('newpass').hidden = true;
  $('app').hidden = false;
  // A monogram rather than a squeezed username: "rmbuster82" clipped to
  // "rmbus" at the edge of a phone reads as a layout that gave up. The whole
  // name goes on the tooltip, where it costs no room.
  const whoami = $('whoami');
  whoami.textContent = (me.display_name || me.username || '?').trim().charAt(0);
  whoami.title = `${me.display_name || me.username} — sign out`;
  whoami.setAttribute('aria-label', whoami.title);

  if (!map) initMap();
  await loadPins();
  await loadNotes();
  await loadPhotos();
  await loadSources();
  await syncQueue();
  refreshNetworkUI();
}

/* ── map ─────────────────────────────────────────────────────────────────── */

function initMap() {
  const sources = {};
  const layers = [];
  for (const [key, cfg] of Object.entries(BASEMAPS)) {
    sources[key] = {
      type: 'raster', tiles: [cfg.url], tileSize: 256,
      maxzoom: cfg.maxzoom, attribution: cfg.attribution,
    };
    layers.push({
      id: `base-${key}`, type: 'raster', source: key,
      layout: { visibility: key === basemap ? 'visible' : 'none' },
    });
  }

  // Overlays go into the initial style rather than being added afterwards:
  // addSource() before the style finishes loading throws. Terrain is listed
  // first so roads and labels draw on top of it rather than under.
  // Order is the draw order: ground-shading first, then areas, then lines, then
  // labels last so nothing is drawn over the text.
  const DRAW_ORDER = ['terrain', 'publicland', 'water', 'parcels', 'trails', 'rail', 'roads', 'labels'];
  for (const key of DRAW_ORDER) {
    const cfg = OVERLAYS[key];
    cfg.urls.forEach((url, i) => {
      const id = `ov-${key}-${i}`;
      sources[id] = {
        type: 'raster', tiles: [url], tileSize: 256,
        maxzoom: cfg.maxzoom, attribution: cfg.attribution,
        ...(cfg.minzoom ? { minzoom: cfg.minzoom } : {}),
      };
      layers.push({
        id, type: 'raster', source: id,
        layout: { visibility: overlaysOn.has(key) ? 'visible' : 'none' },
        ...(cfg.opacity ? { paint: { 'raster-opacity': cfg.opacity } } : {}),
      });
    });
  }

  map = new maplibregl.Map({
    container: 'map',
    style: { version: 8, sources, layers },
    center: [-98.6, 39.8],   // middle of the country until we know better
    zoom: 3.4,
    attributionControl: { compact: true },
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

  // Long-press (or right-click) pins the thing across the valley that you can
  // see but are not standing in.
  map.on('contextmenu', (e) => openNewPin(e.lngLat.lat, e.lngLat.lng, null));
  wireLongPress();

  map.on('moveend', updateDownloadEstimate);

  // Restore the last place we were, so opening the app in a canyon shows the
  // canyon rather than the whole country.
  local.get('lastView').then((v) => {
    if (v) map.jumpTo({ center: v.center, zoom: v.zoom });
    // Not silent: if there's no blue dot, the reason should be on screen rather
    // than left for you to wonder about.
    locate({ fly: true }).catch(() => {});
  });
  map.on('moveend', () => {
    const c = map.getCenter();
    local.set('lastView', { center: [c.lng, c.lat], zoom: map.getZoom() });
  });
}

/* Press and hold somewhere and it becomes a pin. Drag instead and it is a pan —
 * that distinction is the whole of it, and 12px of drift is still a press,
 * because nobody holds a phone still.
 *
 * Wired for a finger and for a mouse. The mouse half is not only for a desktop:
 * it is the only way this path can be exercised in a browser that is being
 * driven rather than touched, and an interaction nobody can test is one that
 * quietly stops working. */
function wireLongPress() {
  const canvas = map.getCanvasContainer();
  let timer = null, startPt = null;

  const arm = (x, y) => {
    startPt = { x, y };
    clearTimeout(timer);
    timer = setTimeout(() => {
      const rect = canvas.getBoundingClientRect();
      const ll = map.unproject([startPt.x - rect.left, startPt.y - rect.top]);
      openNewPin(ll.lat, ll.lng, null);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 600);
  };

  // A little drift is still a press; a real drag is a pan.
  const moved = (x, y) => startPt && Math.hypot(x - startPt.x, y - startPt.y) >= 12;
  const disarm = () => { clearTimeout(timer); timer = null; };

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    arm(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && !moved(e.touches[0].clientX, e.touches[0].clientY)) return;
    disarm();
  }, { passive: true });
  canvas.addEventListener('touchend', disarm, { passive: true });
  canvas.addEventListener('touchcancel', disarm, { passive: true });

  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) arm(e.clientX, e.clientY); });
  canvas.addEventListener('mousemove', (e) => { if (timer && moved(e.clientX, e.clientY)) disarm(); });
  canvas.addEventListener('mouseup', disarm);
  canvas.addEventListener('mouseleave', disarm);
}

function setBasemap(key) {
  basemap = key;
  for (const k of Object.keys(BASEMAPS)) {
    map.setLayoutProperty(`base-${k}`, 'visibility', k === key ? 'visible' : 'none');
  }
  const radio = document.querySelector(`[name="basemap"][value="${key}"]`);
  if (radio) radio.checked = true;
  local.set('basemap', key);
  updateDownloadEstimate();
}

function setOverlay(key, on) {
  on ? overlaysOn.add(key) : overlaysOn.delete(key);
  OVERLAYS[key].urls.forEach((_, i) => {
    const id = `ov-${key}-${i}`;
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  });
  local.set('overlays', [...overlaysOn]);
  updateDownloadEstimate();
}

/* ── where am I ──────────────────────────────────────────────────────────── */

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no GPS on this device'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 20000, maximumAge: 0,
    });
  });
}

async function locate({ silent = false, fly = false } = {}) {
  try {
    const pos = await getPosition();
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    showMe(lat, lng);
    if (fly) map.flyTo({ center: [lng, lat], zoom: 15, duration: 1200 });
    else map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15) });
    if (!silent) toast(`you, within ${Math.round(accuracy)} m`);
    refreshLocationState();
    return pos;
  } catch (err) {
    if (!silent) toast(geoMessage(err), true);
    refreshLocationState();
    throw err;
  }
}

function geoMessage(err) {
  if (err?.code === 1) return 'location permission denied — turn it on in settings';
  if (err?.code === 3) return 'no GPS fix yet — try again out in the open';
  return 'could not get a location';
}

function showMe(lat, lng) {
  if (!meMarker) {
    const el = document.createElement('div');
    el.className = 'me-marker';
    meMarker = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
  } else {
    meMarker.setLngLat([lng, lat]);
  }
}

/* Location is a browser permission, not an app setting — so the honest thing is
 * to report what the browser actually thinks and hand over the one button that
 * can change it. A denied permission cannot be undone from here, only from the
 * browser or phone settings, and saying so beats a button that does nothing. */
async function refreshLocationState() {
  const el = $('loc-state');
  const btn = $('loc-enable');
  if (!navigator.geolocation) {
    el.textContent = 'this device has no location hardware the browser can reach';
    btn.hidden = true;
    return;
  }
  let state = 'prompt';
  try {
    state = (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch { /* Safari has historically not supported this query */ }

  if (state === 'granted') {
    el.innerHTML = meMarker
      ? 'on &middot; <b>the blue dot is you</b>'
      : 'allowed — tap below to get a fix';
    btn.hidden = false;
    btn.textContent = meMarker ? 'find me again' : 'get a fix';
  } else if (state === 'denied') {
    el.innerHTML = '<b>blocked.</b> the app cannot re-ask — you have to allow location '
      + 'for this site in your browser settings. on iPhone: Settings → Safari → Location.';
    btn.hidden = true;
  } else {
    el.textContent = 'off. the map cannot see where you are until you allow it.';
    btn.hidden = false;
    btn.textContent = 'turn on my location';
  }
}

/* ── pins ────────────────────────────────────────────────────────────────── */

async function loadPins() {
  if (online()) {
    const { data, error } = await db.from('pins_with_author').select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Keep anything still sitting in the queue — the server doesn't know
      // about it yet, and it must not vanish off the map.
      const queued = (await local.queued())
        .filter((q) => q.op === 'insert').map((q) => ({ ...q.row, _pending: true }));
      pins = [...queued, ...data];
      await local.replacePins(pins);
      await local.set('lastSync', Date.now());
      drawPins();
      return;
    }
    if (error) toast(error.message, true);
  }

  // No signal, or the server said no: use the mirror.
  pins = (await local.getPins()).sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at));
  drawPins();
}

/* Notes and photo rows for every pin at once, rather than a round trip each
 * time a sheet opens. Three people do not generate enough of either for this to
 * be worth paginating, and pulling the lot means the whole log is already on the
 * phone when the signal goes — which is the only version of this that matters.
 * The images are a separate question; see photoBlob.
 */
async function loadNotes() {
  if (online()) {
    const { data, error } = await db.from('pin_notes_with_author').select('*')
      .order('created_at', { ascending: true });
    if (!error && data) {
      const pending = await local.queued();
      const queued = pending
        .filter((q) => q.op === 'note-insert')
        .map((q) => ({ ...q.row, _pending: true,
                       username: me.username, display_name: me.display_name }));
      notes = [...data, ...queued];

      // An edit still sitting in the queue has to win over the server's copy of
      // the same note, or a refresh puts the old wording back on screen and the
      // edit looks like it never happened.
      for (const q of pending.filter((q) => q.op === 'note-update')) {
        const n = notes.find((x) => x.id === q.id);
        if (n) Object.assign(n, q.fields, { _pending: true });
      }

      await local.replaceNotes(notes);
      return;
    }
  }
  notes = await local.getNotes();
}

async function loadPhotos() {
  if (online()) {
    const { data, error } = await db.from('pin_photos_with_author').select('*')
      .order('created_at', { ascending: true });
    if (!error && data) {
      const queued = (await local.queued())
        .filter((q) => q.op === 'photo-insert')
        .map((q) => ({ ...q.row, _pending: true }));
      photoRows = [...data, ...queued];
      await local.replacePhotos(photoRows);
      return;
    }
  }
  photoRows = await local.getPhotos();
}

function drawPins() {
  markers.forEach((m) => m.remove());
  markers.clear();
  pins.forEach(addMarker);
}

function addMarker(p) {
  const el = document.createElement('div');
  el.className = 'pin-marker'
    + (p.created_by === me.id ? ' is-mine' : '')
    + (p._pending ? ' is-pending' : '')
    + (p.is_private ? ' is-private' : '');
  el.title = pinTitle(p);
  el.addEventListener('click', (e) => { e.stopPropagation(); openPin(p); });

  markers.set(p.id, new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([p.lng, p.lat]).addTo(map));
}

/* PIN HERE — the one-tap path. GPS works with no signal, so this whole flow
 * runs fine in a canyon; the write just queues up. */
async function pinHere() {
  const btn = $('pin-btn');
  btn.classList.add('is-busy');
  btn.textContent = 'GETTING FIX…';
  try {
    const pos = await getPosition();
    const { latitude, longitude, accuracy } = pos.coords;
    showMe(latitude, longitude);
    map.easeTo({ center: [longitude, latitude], zoom: Math.max(map.getZoom(), 16) });
    openNewPin(latitude, longitude, accuracy);
    if (navigator.vibrate) navigator.vibrate(20);
  } catch (err) {
    toast(geoMessage(err), true);
  } finally {
    btn.classList.remove('is-busy');
    btn.textContent = 'PIN HERE';
  }
}

/* ── picking a point by hand ─────────────────────────────────────────────
 * How you tag the far side of the valley, or anywhere at all when location is
 * off or refusing to fix.
 *
 * This used to be one tap that took whatever happened to be at the centre of
 * the map the instant you pressed it — and the centre was not marked, so the
 * one thing you were choosing was the one thing you could not see.
 *
 * So it is a mode now. The dock clears, the crosshair marks exactly what "the
 * middle" means, you move the map under it, and nothing is written until you
 * say so.
 */
function startPlacing() {
  placing = true;
  $('dock').hidden = true;
  $('crosshair').hidden = false;
  $('place-label').textContent = 'move the map — the pin goes in the middle';
  $('placer').hidden = false;
}

function stopPlacing() {
  if (!placing) return false;
  placing = false;
  $('placer').hidden = true;
  $('dock').hidden = false;
  $('crosshair').hidden = true;
  return true;
}

function confirmPlace() {
  const c = map.getCenter();
  if (stopPlacing()) openNewPin(c.lat, c.lng, null);
}

/* ── the sheet ─────────────────────────────────────────────────────────────
 * The sheet takes the bottom half and the map keeps the top half, so the ground
 * is still on screen while you write about it. That makes "centre the map on
 * this point" wrong by half a sheet: the middle of the viewport is behind the
 * sheet. Padding the camera by the sheet's height moves the map's own idea of
 * its centre up into the half you can see, which fixes the crosshair, the eased
 * flight, and anything later that asks the map where the middle is — rather
 * than each of those carrying its own offset.
 */
function sheetPadding(open) {
  if (!map) return;
  const h = map.getContainer().clientHeight;
  map.setPadding({ top: 0, left: 0, right: 0, bottom: open ? Math.round(h / 2) : 0 });
}



function openNewPin(lat, lng, accuracy) {
  // The id is minted here rather than in createPin, because a photo taken
  // before the pin is saved still has to know which pin it belongs to. Nothing
  // is written anywhere until save, so an abandoned sheet costs a uuid.
  discardDraftNote();
  sheet = {
    mode: 'new',
    pin: { id: crypto.randomUUID(), lat, lng, accuracy_m: accuracy ?? null },
    pending: [],       // photos added before the pin itself exists
  };
  // Show where the pin will land, so "the middle of the map" isn't a guess.
  sheetPadding(true);
  $('crosshair').classList.add('is-offset');
  $('crosshair').hidden = false;
  map.easeTo({ center: [lng, lat] });
  $('pin-name').value = '';
  $('pin-desc').value = '';
  $('pin-name').disabled = false;
  $('pin-desc').disabled = false;
  $('pin-private').checked = false;      // shared by default — that is the point
  $('pin-private').disabled = false;
  $('pin-save').hidden = false;
  $('pin-save').textContent = 'save pin';
  $('pin-delete').hidden = true;
  $('sheet-actions').hidden = false;
  $('pin-meta').innerHTML = metaHtml(sheet.pin, null);
  $('notes-block').hidden = true;    // nothing to log about a place yet
  // Emptied rather than just hidden: the strips inside it are still in the
  // document, and renderPhotos paints every strip it can find.
  $('notes-list').innerHTML = '';
  renderPhotos();
  resetOwner();
  $('sheet').hidden = false;
  setTimeout(() => $('pin-name').focus(), 80);
}

function openPin(p) {
  // Tapping straight from one pin to another never closes the sheet, so the
  // photos hung on a note half-written for the last one are cleared here too.
  discardDraftNote();
  sheet = { mode: 'view', pin: p };
  const mine = p.created_by === me.id;
  $('pin-name').value = p.name || '';
  $('pin-desc').value = p.description || '';
  $('pin-name').disabled = !mine;
  $('pin-desc').disabled = !mine;
  $('pin-private').checked = !!p.is_private;
  $('pin-private').disabled = !mine;
  $('pin-save').hidden = !mine;
  $('pin-save').textContent = 'save changes';
  $('pin-delete').hidden = !mine;
  // Someone else's pin: nothing in the bar, so the bar itself goes. An empty
  // strip with a rule over it reads as something that failed to load.
  $('sheet-actions').hidden = !mine;
  $('pin-meta').innerHTML = metaHtml(p, p.display_name || p.username);
  $('notes-block').hidden = false;
  $('note-body').value = '';
  editingNote = null;
  renderNotes();          // which paints the photo strips, this pin's included
  resetOwner();
  $('sheet').hidden = false;
  sheetPadding(true);
  map.easeTo({ center: [p.lng, p.lat] });
}

function metaHtml(p, author) {
  const bits = [];
  if (author) bits.push(`dropped by <b>${escapeHtml(author)}</b>`);
  if (p.created_at) bits.push(fmtDate(p.created_at));
  const head = bits.length ? bits.join(' &middot; ') : 'new pin';
  const acc = p.accuracy_m ? ` &middot; &plusmn;${Math.round(p.accuracy_m)} m` : '';
  const pending = p._pending
    ? '<br><span class="warn">waiting to sync — lives on this phone only</span>' : '';
  const priv = p.is_private ? '<br><b>personal</b> &middot; nobody else can see this pin' : '';
  return `${head}<br>${fmtCoords(p.lat, p.lng)}${acc}${priv}${pending}`;
}

function closeSheet() {
  $('sheet').hidden = true;
  $('crosshair').hidden = true;
  $('crosshair').classList.remove('is-offset');
  sheetPadding(false);
  $('pin-save').hidden = false;
  discardDraftNote();
  releaseObjectUrls();
  editingNote = null;
  sheet = null;
}

function releaseObjectUrls() {
  photoGen++;
  objectUrls.forEach(URL.revokeObjectURL);
  objectUrls = [];
}

async function savePin() {
  if (!sheet) return;
  const btn = $('pin-save');
  btn.disabled = true;

  const fields = {
    name: $('pin-name').value.trim(),
    description: $('pin-desc').value.trim(),
    is_private: $('pin-private').checked,
  };

  try {
    if (sheet.mode === 'new') await createPin(fields);
    else await updatePin(fields);
  } finally {
    btn.disabled = false;
  }
}

async function createPin(fields) {
  // The id and the timestamp are made here, not by the server. That way a pin
  // dropped on Tuesday in a canyon still says Tuesday when it syncs on Thursday,
  // and replaying the queue twice can't create it twice.
  const row = {
    id: sheet.pin.id,
    created_by: me.id,
    lat: sheet.pin.lat,
    lng: sheet.pin.lng,
    accuracy_m: sheet.pin.accuracy_m,
    created_at: new Date().toISOString(),
    ...fields,
  };
  const shown = { ...row, username: me.username, display_name: me.display_name };

  const sent = await push({ op: 'insert', row });
  if (!sent) shown._pending = true;

  pins.unshift(shown);
  await local.putPin(shown);
  addMarker(shown);

  // Photos queued behind the pin, never in front of it: a photo row references
  // the pin, so replaying them the other way round would fail the foreign key
  // and jam the queue. The queue is strictly ordered, so this is enough.
  for (const photo of sheet.pending || []) await commitPhoto(photo);

  closeSheet();
  toast(sent ? 'pinned' : 'pinned — will sync when you have signal');
  refreshNetworkUI();
}

async function updatePin(fields) {
  const p = sheet.pin;
  Object.assign(p, fields);

  const sent = await push({ op: 'update', id: p.id, fields });
  if (!sent) p._pending = true;

  await local.putPin(p);
  const el = markers.get(p.id)?.getElement();
  if (el) {
    el.title = pinTitle(p);
    el.classList.toggle('is-pending', !!p._pending);
    el.classList.toggle('is-private', !!p.is_private);
  }
  closeSheet();
  toast(sent ? 'saved' : 'saved on this phone — will sync later');
  refreshNetworkUI();
}

async function deletePin() {
  if (!sheet || sheet.mode !== 'view') return;
  if (!confirm(`Delete "${pinTitle(sheet.pin)}"? This cannot be undone.`)) return;

  const id = sheet.pin.id;

  // Photos go FIRST, and deliberately. The rows cascade when the pin goes, but
  // the objects in the bucket do not, and the permission to delete someone
  // else's photo off your pin is checked against a pin that still exists. Kill
  // the pin first and those files are unreachable and undeletable forever.
  const its = photosForPin(id);
  if (its.length) {
    await push({ op: 'photo-delete', paths: its.map((r) => r.path), ids: its.map((r) => r.id) });
    for (const r of its) { await local.deletePhoto(r.id); await local.deleteBlob(r.id); }
    photoRows = photoRows.filter((r) => r.pin_id !== id);
  }

  const sent = await push({ op: 'delete', id });

  // The notes cascade in the database; this just keeps the mirror honest.
  for (const n of notes.filter((n) => n.pin_id === id)) await local.deleteNote(n.id);
  notes = notes.filter((n) => n.pin_id !== id);

  markers.get(id)?.remove();
  markers.delete(id);
  pins = pins.filter((p) => p.id !== id);
  await local.deletePin(id);
  await local.del(`own:${id}`);
  closeSheet();
  toast(sent ? 'deleted' : 'deleted here — will sync later');
  refreshNetworkUI();
}


/* ── photos ──────────────────────────────────────────────────────────────
 * A photo answers the question a description can't: is that the entrance, or
 * is it the one forty feet left of it. Shrunk and stripped of EXIF on the
 * phone (see photos.js), uploaded to a private bucket, and kept in IndexedDB
 * once you have seen it so it is still there with no signal.
 *
 * A photo hangs off the pin or off a note, and which one it is is the whole
 * meaning. On the pin: this is the place — here is the entrance, here is the
 * crack. On a note: this is what it looked like the day I went, under a line
 * that is dated and signed. A new lock on the gate belongs to that Tuesday. It
 * is not a truth about the place, and filing it as one is how a map starts
 * lying to you.
 */

/* Every photo on this pin, notes included — what deleting the pin has to clear
 * out of the bucket. */
const photosForPin = (pinId) => photoRows.filter((r) => r.pin_id === pinId);

/* The strip under the description is the place itself, not anybody's trip. */
const pinOnlyPhotos = (pinId) => photosForPin(pinId).filter((r) => !r.note_id);

const notePhotos = (noteId) => photoRows.filter((r) => r.note_id === noteId);

/* Everything the lightbox might be looking at, including photos hung on a note
 * that has not been written yet. */
function sheetPhotos() {
  if (!sheet) return [];
  const drafted = draftNote?.pending || [];
  return sheet.mode === 'new'
    ? [...(sheet.pending || []), ...drafted]
    : [...photosForPin(sheet.pin.id), ...drafted];
}

/* One file input, several strips. Which one a pick lands in is decided by the
 * button that opened it — the input itself knows nothing. */
function pickPhotos(target, btn) {
  if (!sheet) return;
  photoTarget = { ...target, btn };
  $('photo-input').click();
}

async function onPhotoPick(e) {
  const files = [...e.target.files];
  e.target.value = '';                 // so picking the same file twice works
  // A pick with no target is the pin's: iOS can hand the file back after the
  // sheet has been through a re-render, and the place itself is the safe guess.
  const target = photoTarget || { kind: 'pin' };
  photoTarget = null;
  if (!sheet || !files.length) return;

  const btn = target.btn;
  btn?.classList.add('is-busy');
  try {
    for (const file of files) await addPhoto(file, target);
  } finally {
    btn?.classList.remove('is-busy');
  }
}

/* A photo attached to a note nobody has written yet needs the note's id before
 * the note exists. Minting it early is the same trick a new pin plays, for the
 * same reason: an id is free, and it means the picture and the sentence go in
 * together instead of the picture waiting on a round trip. */
function draft() {
  if (!draftNote) draftNote = { id: crypto.randomUUID(), pending: [] };
  return draftNote;
}

/* Closing the sheet on a half-written note throws its photos away. They belong
 * to a note that will never exist, and leaving them behind means an abandoned
 * sentence quietly costs someone three megabytes of phone. */
async function discardDraftNote() {
  const d = draftNote;
  draftNote = null;
  if (!d) return;
  for (const row of d.pending) await local.deleteBlob(row.id);
}

async function addPhoto(file, target = { kind: 'pin' }) {
  let image;
  try {
    image = await shrink(file);
  } catch {
    toast('could not read that photo', true);
    return;
  }

  const id = crypto.randomUUID();
  const row = {
    id,
    pin_id: sheet.pin.id,
    note_id: target.kind === 'note'  ? target.id
           : target.kind === 'draft' ? draft().id
           : null,
    created_by: me.id,
    path: photoPath(sheet.pin.id, me.id, id),
    width: image.width,
    height: image.height,
    bytes: image.blob.size,
    created_at: new Date().toISOString(),
  };

  // The image goes to the phone first, always. Everything after this can fail
  // and be retried; losing the only copy of a photo cannot be.
  await local.putBlob(id, image.blob);

  if (target.kind === 'draft') draft().pending.push(row);
  else if (sheet.mode === 'new') sheet.pending.push(row);
  else await commitPhoto(row);

  renderPhotos();
}

async function commitPhoto(row) {
  const sent = await push({ op: 'photo-insert', row });
  const shown = { ...row, username: me.username, display_name: me.display_name };
  if (!sent) shown._pending = true;

  photoRows.push(shown);
  await local.putPhoto(shown);
  refreshNetworkUI();
}

/* The bucket is private, so there is no URL to point an <img> at. Take the
 * bytes once and keep them: the second look costs nothing, and it works in the
 * canyon. Returns null when we have neither the blob nor a way to get it. */
async function photoBlob(row) {
  const cached = await local.getBlob(row.id);
  if (cached) return cached;
  if (!online()) return null;

  const { data, error } = await db.storage.from(PHOTO_BUCKET).download(row.path);
  if (error || !data) return null;
  await local.putBlob(row.id, data);
  return data;
}

/* Every strip on screen is painted in one pass: the pin's, the one under the
 * note being written, and one per note. They have to be, because they are
 * revoked together — a load that finishes after the sheet has moved on would
 * otherwise draw somebody else's photo into a tile that is still on screen. */
function renderPhotos() {
  releaseObjectUrls();
  const gen = photoGen;

  paintStrip($('pin-photos'), !sheet ? []
    : sheet.mode === 'new' ? (sheet.pending || [])
    : pinOnlyPhotos(sheet.pin.id), gen);

  paintStrip($('note-draft-photos'), draftNote?.pending || [], gen);

  // The strips inside the notes are drawn by renderNotes and filled here, so a
  // note always has an empty one waiting — otherwise a photo added to a note
  // would have nowhere to land until the whole list was rebuilt.
  document.querySelectorAll('[data-note-photos]').forEach((el) =>
    paintStrip(el, notePhotos(el.dataset.notePhotos), gen));
}

function paintStrip(strip, rows, gen) {
  if (!strip) return;
  strip.innerHTML = '';
  strip.hidden = !rows.length;

  rows.forEach((row) => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'thumb' + (row._pending ? ' is-pending' : '');
    tile.dataset.id = row.id;
    tile.setAttribute('aria-label', 'Open photo');
    strip.appendChild(tile);

    photoBlob(row).then((blob) => {
      if (gen !== photoGen) return;             // sheet moved on without us
      if (!blob) {
        tile.classList.add('is-missing');
        tile.title = 'not downloaded — open this with signal once';
        return;
      }
      const url = URL.createObjectURL(blob);
      objectUrls.push(url);
      tile.style.backgroundImage = `url("${url}")`;
      tile.classList.add('is-loaded');
    });
  });
}

/* You can bin your own photo, or any photo on a pin of yours. Same rule the
 * database enforces — this only decides whether to draw the button. */
const canDeletePhoto = (row) =>
  row.created_by === me.id || sheet?.pin?.created_by === me.id;

async function openLightbox(id) {
  const row = sheetPhotos().find((r) => r.id === id);
  if (!row) return;

  const blob = await photoBlob(row);
  if (!blob) { toast('that one is not downloaded yet', true); return; }

  if (lightboxUrl) URL.revokeObjectURL(lightboxUrl);
  lightboxUrl = URL.createObjectURL(blob);
  $('lightbox-img').src = lightboxUrl;
  $('lightbox-del').hidden = !canDeletePhoto(row);
  $('lightbox-del').dataset.id = id;
  $('lightbox').hidden = false;
}

function closeLightbox() {
  $('lightbox').hidden = true;
  $('lightbox-img').removeAttribute('src');
  if (lightboxUrl) { URL.revokeObjectURL(lightboxUrl); lightboxUrl = null; }
}

async function deletePhoto(id) {
  const row = sheetPhotos().find((r) => r.id === id);
  if (!row) return;
  if (!confirm('Delete this photo?')) return;

  if (draftNote?.pending.some((r) => r.id === id)) {
    // Never left the phone: no row, no object, nothing to tell the server.
    draftNote.pending = draftNote.pending.filter((r) => r.id !== id);
  } else if (sheet.mode === 'new') {
    sheet.pending = sheet.pending.filter((r) => r.id !== id);
  } else {
    await push({ op: 'photo-delete', paths: [row.path], ids: [id] });
    photoRows = photoRows.filter((r) => r.id !== id);
    await local.deletePhoto(id);
  }
  await local.deleteBlob(id);

  closeLightbox();
  renderPhotos();
  refreshNetworkUI();
}

/* ── notes ───────────────────────────────────────────────────────────────
 * The description is what the place is. A note is what happened when someone
 * went. Anyone can add one to any pin they can see, including someone else's —
 * that is the point: the map gets better every time one of you goes out.
 *
 * A note carries its own photos, because "here is what the gate looks like now"
 * is a different picture from "here is the entrance" and filing them together
 * loses the difference. They are the note author's: a note is one person's
 * account of one day, and the database says so too.
 */

function renderNotes() {
  const rows = notes
    .filter((n) => n.pin_id === sheet.pin.id)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  $('notes-list').innerHTML = rows.length
    ? rows.map(noteHtml).join('')
    : '<p class="notes-empty">No notes yet. Been out there? Say what you found.</p>';

  // Rebuilding the list threw every note's photo strip away with it, so the
  // tiles are repainted here rather than at each of the seven call sites that
  // could forget. renderPhotos paints all the strips on screen, this one
  // included.
  renderPhotos();
}

/* An edit keeps the day it was written and says so separately, because on a log
 * of "gate was locked in March" the date is half the meaning. Rewriting March
 * to today would quietly turn a record into a claim. */
const wasEdited = (n) => !!n.updated_at
  && new Date(n.updated_at) - new Date(n.created_at) > 1000;

function noteHtml(n) {
  const who = escapeHtml(n.display_name || n.username || 'someone');
  const mine = n.created_by === me.id;

  const head = `<div class="note-head">
      <b>${who}</b><span>${fmtDate(n.created_at)}${
        wasEdited(n) ? ` &middot; edited ${fmtDate(n.updated_at)}` : ''}</span>
      ${mine && editingNote !== n.id ? `
        <button class="note-photo" data-photo="${n.id}">photo</button>
        <button class="note-photo" data-edit="${n.id}">edit</button>
        <button class="note-del" data-id="${n.id}" aria-label="Delete note">✕</button>` : ''}
    </div>`;

  const body = editingNote === n.id
    ? `<textarea class="note-body note-edit-box" id="note-edit-box" rows="3"
                 autocapitalize="sentences">${escapeHtml(n.body)}</textarea>
       <div class="note-edit-actions">
         <button class="btn-ghost" data-save="${n.id}">save note</button>
         <button class="linkish" data-cancel="1">cancel</button>
       </div>`
    : `<p>${escapeHtml(n.body)}</p>`;

  // The strip is always drawn, empty or not, and renderPhotos fills it. A note
  // that only grows its first photo after the list was built still has
  // somewhere to put it.
  return `<article class="note${n._pending ? ' is-pending' : ''}${
    editingNote === n.id ? ' is-editing' : ''}">
    ${head}
    ${body}
    <div class="photo-strip is-note" data-note-photos="${n.id}" hidden></div>
    ${n._pending ? '<span class="note-warn">not synced yet</span>' : ''}
  </article>`;
}

function startEditNote(id) {
  editingNote = id;
  renderNotes();
  const box = $('note-edit-box');
  if (box) {
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }
}

async function saveNoteEdit(id) {
  const box = $('note-edit-box');
  const n = notes.find((x) => x.id === id);
  if (!box || !n) return;

  const body = box.value.trim();
  // An empty note is not an edit, it is a deletion, and it should have to say so
  // out loud rather than happening because someone selected all and typed.
  if (!body) { toast('a note cannot be emptied — delete it instead', true); return; }
  if (body === n.body) { editingNote = null; renderNotes(); return; }

  // Minted here for the same reason every other timestamp in ATLAS is: an edit
  // made in a canyon on Tuesday keeps Tuesday when it lands on Thursday. The
  // trigger on pin_notes yields to this rather than stamping now().
  const updated_at = new Date().toISOString();
  const sent = await push({ op: 'note-update', id, fields: { body, updated_at } });

  n.body = body;
  n.updated_at = updated_at;
  if (!sent) n._pending = true;
  await local.putNote(n);

  editingNote = null;
  renderNotes();
  refreshNetworkUI();
  if (!sent) toast('edit saved here — will sync later');
}

function cancelEditNote() {
  editingNote = null;
  renderNotes();
}

async function addNote() {
  if (!sheet || sheet.mode !== 'view') return;
  const body = $('note-body').value.trim();
  const drafted = draftNote?.pending || [];
  if (!body) {
    // A picture with nothing said about it is a photo of the place, and it
    // belongs on the pin. Say that rather than writing an empty note to hang
    // it off — the sentence is what makes a note worth reading later.
    if (drafted.length) toast('say what happened, or put the photo on the pin', true);
    return;
  }

  const row = {
    // The drafted photos already point at this id. If nothing was attached
    // there is no draft and this is an ordinary new uuid.
    id: draft().id,
    pin_id: sheet.pin.id,
    created_by: me.id,
    body,
    created_at: new Date().toISOString(),
  };

  const sent = await push({ op: 'note-insert', row });
  const shown = { ...row, username: me.username, display_name: me.display_name };
  if (!sent) shown._pending = true;

  notes.push(shown);
  await local.putNote(shown);

  // Photos queued behind the note, never in front of it: a photo row references
  // the note, so replaying them the other way round fails the foreign key and
  // jams everything behind it in the queue. Same rule as a new pin's photos.
  draftNote = null;
  for (const photo of drafted) await commitPhoto(photo);

  $('note-body').value = '';
  renderNotes();
  refreshNetworkUI();
  if (!sent) toast('note saved here — will sync later');
}

async function deleteNote(id) {
  const its = notePhotos(id);
  if (!confirm(its.length
    ? `Delete this note and ${its.length === 1 ? 'its photo' : `its ${its.length} photos`}?`
    : 'Delete this note?')) return;

  // Photos first, exactly as when a pin goes. The rows cascade away with the
  // note, but the objects in the bucket do not, and once the row is gone
  // nothing knows the object's name to delete it by — it sits there forever.
  if (its.length) {
    await push({ op: 'photo-delete', paths: its.map((r) => r.path), ids: its.map((r) => r.id) });
    for (const r of its) { await local.deletePhoto(r.id); await local.deleteBlob(r.id); }
    photoRows = photoRows.filter((r) => r.note_id !== id);
  }

  await push({ op: 'note-delete', id });
  notes = notes.filter((n) => n.id !== id);
  await local.deleteNote(id);
  renderNotes();
  refreshNetworkUI();
}

function onNotesClick(e) {
  const thumb = e.target.closest('.thumb');
  if (thumb) { openLightbox(thumb.dataset.id); return; }

  const photo = e.target.closest('[data-photo]');
  if (photo) { pickPhotos({ kind: 'note', id: photo.dataset.photo }, photo); return; }

  const del = e.target.closest('.note-del');
  if (del) { deleteNote(del.dataset.id); return; }

  const edit = e.target.closest('[data-edit]');
  if (edit) { startEditNote(edit.dataset.edit); return; }

  const save = e.target.closest('[data-save]');
  if (save) { saveNoteEdit(save.dataset.save); return; }

  if (e.target.closest('[data-cancel]')) cancelEditNote();
}

/* ── who owns it ─────────────────────────────────────────────────────────
 * See owners.js for what is being asked and why those sources and no others.
 * Here: ask once, keep the answer on the phone, and never pretend to know.
 */

function resetOwner() {
  const out = $('own-result');
  ownerShown = null;
  countyHunt = null;
  out.hidden = true;
  out.innerHTML = '';
  $('own-ask').disabled = false;
  $('own-ask').textContent = 'check who owns this land';
  if (!sheet) return;

  // A spot you have already looked up answers instantly, and answers in the
  // canyon — which is the half of this that matters.
  const id = sheet.pin.id;
  local.get(`own:${id}`).then((cached) => {
    if (cached && sheet?.pin?.id === id) renderOwner(cached, true);
  });
}

async function askOwner() {
  if (!sheet) return;
  const { id, lat, lng } = sheet.pin;
  const btn = $('own-ask');

  if (!online()) {
    const cached = await local.get(`own:${id}`);
    if (cached) { renderOwner(cached, true); return; }
    toast('that one needs signal — look it up before you go', true);
    return;
  }

  countyHunt = null;          // "check again" means the whole question, not half of it
  btn.disabled = true;
  btn.textContent = 'asking…';
  try {
    const result = await lookupOwnership(lat, lng, { sources: parcelSources });
    if (sheet?.pin?.id !== id) return;          // sheet moved on while we waited
    await local.set(`own:${id}`, result);
    renderOwner(result, false);
  } catch {
    toast('could not reach the land records', true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'check again';
  }
}

function ownerRow(term, value) {
  return `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(String(value))}</dd></div>`;
}

/* ── going and finding the county ────────────────────────────────────────
 * Everything above is national and works anywhere. The owner's NAME is the one
 * thing that isn't, and the answer to that used to be a form: find your
 * county's ArcGIS parcel layer, work out which of its ninety columns is the
 * owner, type it all in. Which is a reasonable thing to ask of somebody at a
 * desk and a ridiculous one to ask of somebody standing at a gate.
 *
 * So it goes and looks instead, and what it finds is only ever offered, never
 * applied: it says which service, how many parcels are in it, and what it just
 * read off the ground under this pin. You look at that and decide. Saving it
 * writes one row, and from then on the county answers instantly and offline
 * for everybody.
 */

function huntHtml() {
  if (!countyHunt || countyHunt.pinId !== sheet?.pin?.id) return '';

  if (countyHunt.state === 'busy') {
    return '<div class="owner-hunt">looking through what the county publishes… '
         + 'give it a few seconds</div>';
  }
  if (countyHunt.state === 'none') {
    return '<div class="owner-hunt">nothing published that will answer about this '
         + 'point. The office still will — the description above is what they '
         + 'search on.</div>';
  }
  if (countyHunt.state === 'dropped') {
    return '<div class="owner-hunt">left alone. If you know the county\'s layer, '
         + 'it can still be added by hand.</div>';
  }

  const f = countyHunt.found;
  const rows = [];
  if (f.parcel?.owner)   rows.push(ownerRow('owner', f.parcel.owner));
  if (f.parcel?.apn)     rows.push(ownerRow('parcel', f.parcel.apn));
  if (f.parcel?.address) rows.push(ownerRow('address', f.parcel.address));

  // Said plainly, because it is the difference between an answer and a service
  // that merely covers the area: standing on a road or on public land, there is
  // no parcel under you and there is not supposed to be one.
  const read = rows.length
    ? `<dl class="owner-rows">${rows.join('')}</dl>`
    : `<div class="owner-hunt">It covers this area, but nothing owns the exact
        spot this pin is on — usually a road, or public land. Save it and it
        will answer for the pins that do.</div>`;

  return `<div class="owner-found">
    <div class="owner-found-head">${escapeHtml(f.service)}</div>
    <div class="owner-when">${f.count ? `${f.count.toLocaleString()} parcels &middot; ` : ''}${
      escapeHtml(new URL(f.source.url).hostname)}</div>
    ${read}
    <div class="owner-links">
      <button class="linkish" data-own="save-county"><b>yes, use this</b></button>
      <button class="linkish" data-own="drop-county">no, skip it</button>
    </div>
  </div>`;
}

async function findCounty() {
  const r = ownerShown?.r;
  if (!sheet || !r?.county) return;
  if (!online()) { toast('finding a county needs signal', true); return; }

  const pinId = sheet.pin.id;
  countyHunt = { pinId, state: 'busy' };
  renderOwner(r, ownerShown.cached);

  let found = null;
  try {
    found = await discoverParcelSource(r.county, r.state, sheet.pin.lat, sheet.pin.lng);
  } catch {
    found = null;
  }
  if (sheet?.pin?.id !== pinId) return;        // sheet moved on while we looked

  countyHunt = found
    ? { pinId, state: 'found', found }
    : { pinId, state: 'none' };
  renderOwner(r, ownerShown.cached);
}

async function saveCounty() {
  const found = countyHunt?.found;
  if (!found) return;

  const { error } = await db.from('parcel_sources')
    .insert({ ...found.source, created_by: me.id });
  if (error) { toast(error.message, true); return; }

  countyHunt = null;
  await loadSources();
  toast('saved — this county answers from now on');
  // Ask again rather than showing what the search happened to read: the real
  // lookup goes through the same code every other pin uses, so what you end up
  // looking at is what everybody will see, not a preview of it.
  askOwner();
}

function renderOwner(r, cached) {
  const out = $('own-result');
  ownerShown = { r, cached };
  const parts = [];

  if (r.agencyName) {
    parts.push(`<div class="owner-agency">${escapeHtml(r.agencyName)}</div>`);
    if (r.access) parts.push(`<div class="owner-access">${escapeHtml(r.access)}</div>`);
  } else {
    parts.push('<div class="owner-agency owner-unknown">not on the federal ownership map</div>');
  }
  if (r.unit) {
    parts.push(`<div class="owner-unit">${escapeHtml(r.unit)}${
      r.unitType ? ` &middot; ${escapeHtml(r.unitType)}` : ''}</div>`);
  }

  const rows = [];
  if (r.parcel?.owner)   rows.push(ownerRow('owner', r.parcel.owner));
  if (r.parcel?.apn)     rows.push(ownerRow('parcel', r.parcel.apn));
  if (r.parcel?.address) rows.push(ownerRow('address', r.parcel.address));
  if (r.parcel?.acres)   rows.push(ownerRow('acres', r.parcel.acres.toLocaleString()));
  if (r.legal)  rows.push(ownerRow('survey', [r.legal, r.aliquotArea].filter(Boolean).join(' · ')));
  if (r.meridian) rows.push(ownerRow('meridian', r.meridian));
  if (r.county) rows.push(ownerRow('county', [r.county, r.state].filter(Boolean).join(', ')));
  if (rows.length) parts.push(`<dl class="owner-rows">${rows.join('')}</dl>`);

  const links = [];
  if (r.legal) links.push('<button class="linkish" data-own="copy">copy the description</button>');

  const site = r.parcel ? parcelSiteUrl(r.parcel.source, r.parcel) : null;
  if (site) {
    links.push(`<a class="linkish" href="${escapeHtml(site)}" target="_blank" rel="noopener">
      open it at ${escapeHtml(r.parcel.source.label || 'the county')}</a>`);
  } else if (r.county) {
    links.push(`<a class="linkish" href="${escapeHtml(assessorSearchUrl(r.county, r.state))}"
      target="_blank" rel="noopener">find the assessor's office</a>`);
  }
  if (!r.parcel && r.county && !countyHunt) {
    links.push('<button class="linkish" data-own="find">look up the owner\'s name</button>');
  }
  if (!r.parcel && r.county && ['none', 'dropped'].includes(countyHunt?.state)) {
    links.push('<button class="linkish" data-own="sources">enter the county myself</button>');
  }
  if (links.length) parts.push(`<div class="owner-links">${links.join('')}</div>`);

  parts.push(huntHtml());

  parts.push(`<div class="owner-when">${cached
    ? `looked up ${fmtDate(new Date(r.at).toISOString())} &middot; kept on this phone`
    : 'BLM surface management &middot; BLM cadastral survey &middot; US Census'}</div>`);

  out.innerHTML = parts.join('');
  out.hidden = false;
  out.dataset.legal = r.legal
    ? [r.legal, r.meridian, r.county && `${r.county}${r.state ? ', ' + r.state : ''}`]
        .filter(Boolean).join(', ')
    : '';
  $('own-ask').textContent = 'check again';
}

async function onOwnerClick(e) {
  const btn = e.target.closest('[data-own]');
  if (!btn) return;
  const what = btn.dataset.own;
  if (what === 'sources') { closeSheet(); openSources(); return; }
  if (what === 'find')    { findCounty(); return; }
  if (what === 'save-county') { saveCounty(); return; }
  if (what === 'drop-county') {
    // Rejecting a candidate leaves the manual form as the way through, which is
    // the same place this always ended before it could go and look.
    countyHunt = { pinId: sheet?.pin?.id, state: 'dropped' };
    renderOwner(ownerShown.r, ownerShown.cached);
    return;
  }

  const text = $('own-result').dataset.legal;
  if (!text) return;
  try { await navigator.clipboard.writeText(text); toast('description copied'); }
  catch { prompt('Copy this:', text); }
}

/* ── county parcel adapters ──────────────────────────────────────────────
 * The sources themselves live in the database rather than in this repo, because
 * the repo is public and which counties the crew searches is location data.
 */

async function loadSources() {
  if (online()) {
    const { data, error } = await db.from('parcel_sources').select('*').order('label');
    if (!error && data) {
      parcelSources = data;
      await local.set('parcelSources', data);
      return;
    }
  }
  parcelSources = (await local.get('parcelSources')) || [];
}

function openSources() {
  $('sources').hidden = false;
  renderSources();
}

function renderSources() {
  const body = $('sources-list');
  body.innerHTML = parcelSources.length
    ? parcelSources.map((s) => {
        let host = '';
        try { host = new URL(s.url).hostname; } catch { host = s.url; }
        return `<div class="source-row">
          <div>
            <div class="source-name">${escapeHtml(s.label)}</div>
            <div class="source-host">${escapeHtml(host)}</div>
          </div>
          ${s.created_by === me.id
            ? `<button class="note-del" data-drop="${s.id}" aria-label="Remove">✕</button>` : ''}
        </div>`;
      }).join('')
    : '<p class="notes-empty">None yet. Everything above still works — this only '
      + 'adds the owner’s name.</p>';
}

async function addSource() {
  const err = $('src-error');
  const fail = (msg) => { err.textContent = msg; err.hidden = false; };
  err.hidden = true;

  if (!online()) return fail('this one needs signal');

  const row = {
    label:         $('src-label').value.trim(),
    url:           $('src-url').value.trim(),
    owner_field:   $('src-owner').value.trim() || null,
    apn_field:     $('src-apn').value.trim() || null,
    address_field: $('src-address').value.trim() || null,
    acres_field:   $('src-acres').value.trim() || null,
    site_url:      $('src-site').value.trim() || null,
    created_by:    me.id,
  };

  if (!row.label) return fail('give it a name');
  if (!/^https:\/\//i.test(row.url)) return fail('the layer URL has to start with https://');
  if (!/\/\d+\/?$/.test(row.url)) return fail('that should be one layer — a URL ending in a number');
  if (!row.owner_field && !row.apn_field) return fail('name at least the owner or parcel-number field');
  if (row.site_url && !/^https:\/\//i.test(row.site_url)) return fail('the parcel page has to be https:// too');

  const btn = $('src-save');
  btn.disabled = true;
  const { error } = await db.from('parcel_sources').insert(row);
  btn.disabled = false;
  if (error) return fail(error.message);

  ['src-label', 'src-url', 'src-owner', 'src-apn', 'src-address', 'src-acres', 'src-site']
    .forEach((id) => { $(id).value = ''; });
  document.querySelector('.add-source').open = false;
  await loadSources();
  renderSources();
  toast('county added');
}

async function dropSource(id) {
  const s = parcelSources.find((x) => x.id === id);
  if (!s || !confirm(`Remove ${s.label}?`)) return;
  const { error } = await db.from('parcel_sources').delete().eq('id', id);
  if (error) { toast(error.message, true); return; }
  await loadSources();
  renderSources();
}

function onSourcesClick(e) {
  const drop = e.target.closest('[data-drop]');
  if (drop) dropSource(drop.dataset.drop);
}

/* ── the queue ───────────────────────────────────────────────────────────
 * Try the network. If it doesn't go, park it and move on — the user should
 * never have to think about which of those happened.
 */

async function push(op) {
  if (!online()) { await local.enqueue(op); return false; }
  try {
    await runOp(op);
    return true;
  } catch (err) {
    await local.enqueue(op);
    return false;
  }
}

async function runOp(op) {
  let res;
  if (op.op === 'insert')      res = await db.from('pins').upsert(op.row);
  else if (op.op === 'update') res = await db.from('pins').update(op.fields).eq('id', op.id);
  else if (op.op === 'delete') res = await db.from('pins').delete().eq('id', op.id);

  else if (op.op === 'note-insert') res = await db.from('pin_notes').upsert(op.row);
  else if (op.op === 'note-update') res = await db.from('pin_notes').update(op.fields).eq('id', op.id);
  else if (op.op === 'note-delete') res = await db.from('pin_notes').delete().eq('id', op.id);

  else if (op.op === 'photo-insert') {
    const blob = await local.getBlob(op.row.id);
    // The image is the part that can genuinely be gone — cleared storage, a
    // reinstall. Nothing to upload and nothing to retry, so let it go rather
    // than jamming everything queued behind it forever.
    if (!blob) return;

    const up = await db.storage.from(PHOTO_BUCKET)
      .upload(op.row.path, blob, { contentType: 'image/jpeg', upsert: true });
    if (up.error) throw new Error(up.error.message);

    res = await db.from('pin_photos').upsert(op.row);
  }

  else if (op.op === 'photo-delete') {
    // Bucket first: the row is what tells us the object's name, so losing the
    // row while the object lives leaves a file nothing can ever find again.
    const rm = await db.storage.from(PHOTO_BUCKET).remove(op.paths);
    if (rm.error) throw new Error(rm.error.message);
    res = await db.from('pin_photos').delete().in('id', op.ids);
  }

  if (res?.error) throw new Error(res.error.message);
}

async function syncQueue() {
  if (!online()) return;
  const items = (await local.queued()).sort((a, b) => a.qid - b.qid);
  if (!items.length) return;

  let done = 0;
  for (const item of items) {
    try {
      await runOp(item);
      await local.dequeue(item.qid);
      done++;
    } catch (err) {
      // Stop at the first failure so the order is preserved — a later edit must
      // never land before the insert it edits.
      break;
    }
  }

  if (done) {
    toast(`${done} pin${done > 1 ? 's' : ''} synced`);
    await loadPins();
    await loadNotes();
    await loadPhotos();
  }
  refreshNetworkUI();
}

async function refreshNetworkUI() {
  const n = await local.queueCount();
  const badge = $('pending');
  badge.textContent = n ? `${n} unsynced` : '';
  badge.hidden = !n;
  document.body.classList.toggle('is-offline', !online());
  $('net').textContent = online() ? '' : 'offline';
  $('net').hidden = online();
}

/* ── getting there ───────────────────────────────────────────────────────── */

function openDirections() {
  if (!sheet) return;
  const { lat, lng } = sheet.pin;
  const label = encodeURIComponent(pinTitle(sheet.pin));
  window.open(IS_APPLE
    ? `https://maps.apple.com/?daddr=${lat},${lng}&q=${label}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    '_blank', 'noopener');
}

async function copyCoords() {
  if (!sheet) return;
  const text = fmtCoords(sheet.pin.lat, sheet.pin.lng);
  try { await navigator.clipboard.writeText(text); toast('location copied'); }
  catch { prompt('Copy these:', text); }
}

/* ── all pins ────────────────────────────────────────────────────────────── */

function openList() {
  const body = $('list-body');
  body.innerHTML = pins.length ? pins.map((p) => `
    <button class="list-row" data-pin="${p.id}">
      <div class="r-name">${escapeHtml(pinTitle(p))}${p.is_private ? ' <span class="tag-private">personal</span>' : ''}${p._pending ? ' <span class="dot-pending"></span>' : ''}</div>
      <div class="r-sub">${escapeHtml(p.display_name || p.username || 'unknown')}
        &middot; ${fmtDate(p.created_at)} &middot; ${fmtCoords(p.lat, p.lng)}</div>
    </button>`).join('')
    : '<p class="list-empty">No pins yet. Go find something.</p>';
  $('list').hidden = false;
}

function onListClick(e) {
  const row = e.target.closest('[data-pin]');
  if (!row) return;
  const p = pins.find((x) => x.id === row.dataset.pin);
  $('list').hidden = true;
  if (p) { map.jumpTo({ center: [p.lng, p.lat], zoom: 15 }); openPin(p); }
}

/* ── offline maps ────────────────────────────────────────────────────────
 * Download the tiles for whatever is on screen before you leave the house, and
 * the map still draws in the canyon. This is the difference between an app that
 * works out there and a black screen with a blue dot on it.
 */

function tilesForView(minZoom, maxZoom) {
  const b = map.getBounds();
  const bounds = { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
  const urls = [];

  const add = (template, layerMax) =>
    urls.push(...tileUrlsForBounds(bounds, minZoom, Math.min(maxZoom, layerMax), template));

  const cfg = BASEMAPS[basemap];
  if (!cfg.noBulk) add(cfg.url, cfg.maxzoom);

  // Whatever is switched on comes down too — a satellite tile with no road
  // layer over it is half the map you were looking at when you hit download.
  for (const key of overlaysOn) {
    const cfg = OVERLAYS[key];
    const from = Math.max(minZoom, cfg.minzoom || 0);
    if (from > Math.min(maxZoom, cfg.maxzoom)) continue;   // nothing to fetch
    cfg.urls.forEach((u) =>
      urls.push(...tileUrlsForBounds(bounds, from, Math.min(maxZoom, cfg.maxzoom), u)));
  }
  return urls;
}

const maxZoomChoice = () => parseInt(
  document.querySelector('[name="detail"]:checked')?.value || '16', 10);

function updateDownloadEstimate() {
  if ($('maps').hidden || !map) return;
  const n = tilesForView(9, maxZoomChoice()).length;
  const base = BASEMAPS[basemap];
  const what = [...(base.noBulk ? [] : [base.label]), ...[...overlaysOn].map((k) => OVERLAYS[k].label)];
  $('dl-nobulk').hidden = !base.noBulk;
  $('dl-estimate').innerHTML =
    `<b>${n.toLocaleString()}</b> tiles &middot; about <b>${fmtSize(n * BYTES_PER_TILE)}</b>
     &middot; ${escapeHtml(what.join(' + '))}`;
  $('dl-warn').hidden = n < 6000;
  $('dl-go').disabled = n === 0;
}

async function downloadArea() {
  if (download) { download.cancel = true; return; }

  const urls = tilesForView(9, maxZoomChoice());
  if (!urls.length) return;

  // Ask the OS not to evict this the moment storage gets tight.
  if (navigator.storage?.persist) await navigator.storage.persist().catch(() => {});

  download = { cancel: false };
  const go = $('dl-go');
  go.textContent = 'cancel';
  go.classList.add('is-cancel');

  const cache = await caches.open(TILE_CACHE);
  let done = 0, failed = 0;
  const CONCURRENCY = 8;

  const worker = async () => {
    while (urls.length && !download.cancel) {
      const url = urls.pop();
      try {
        // Already have it? Don't re-download somebody else's bandwidth.
        if (!(await cache.match(url))) {
          const res = await fetch(url, { mode: 'cors' });
          if (res.ok) await cache.put(url, res);
          else failed++;
        }
      } catch { failed++; }
      done++;
      if (done % 12 === 0) showProgress(done, done + urls.length);
    }
  };

  const total = urls.length;
  showProgress(0, total);
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const cancelled = download.cancel;
  download = null;
  go.textContent = 'download this area';
  go.classList.remove('is-cancel');
  $('dl-progress').hidden = true;

  await refreshStorage();
  toast(cancelled
    ? `stopped — ${done.toLocaleString()} tiles kept`
    : `${(done - failed).toLocaleString()} tiles saved${failed ? `, ${failed} failed` : ''}`);
}

function showProgress(done, total) {
  const el = $('dl-progress');
  el.hidden = false;
  const pct = total ? Math.round(done / total * 100) : 0;
  $('dl-bar').style.width = `${pct}%`;
  $('dl-count').textContent = `${done.toLocaleString()} / ${total.toLocaleString()}`;
}

/* Photos are cached as you look at them, which is the right default — nobody
 * wants their whole photo library pulled over cell data. But "before you go" is
 * exactly when you want the lot, and out there is exactly when you cannot get
 * them. So: one button, same panel as the offline maps.
 */
async function cachePhotosOffline() {
  const btn = $('dl-photos');
  if (!online()) { toast('that one needs signal', true); return; }

  const missing = [];
  for (const row of photoRows) if (!(await local.hasBlob(row.id))) missing.push(row);
  if (!missing.length) { toast('every photo is already on this phone'); return; }

  btn.disabled = true;
  let got = 0;
  for (const row of missing) {
    btn.textContent = `getting photos… ${got}/${missing.length}`;
    if (await photoBlob(row)) got++;
  }
  btn.disabled = false;
  btn.textContent = 'download all photos';
  toast(`${got} photo${got === 1 ? '' : 's'} saved for offline`);
  refreshStorage();
}

async function refreshStorage() {
  const est = await navigator.storage?.estimate?.();
  if (!est) return;
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const photoBytes = await local.blobBytes();
  $('dl-storage').innerHTML =
    `using <b>${fmtSize(est.usage)}</b> of ${fmtSize(est.quota)} available`
    + (photoBytes ? ` &middot; ${fmtSize(photoBytes)} of that is photos` : '')
    + (persisted ? ' &middot; protected from cleanup' : '');
}

async function clearTiles() {
  if (!confirm('Delete all downloaded map tiles? Your pins are not touched.')) return;
  await caches.delete(TILE_CACHE);
  await refreshStorage();
  updateDownloadEstimate();
  toast('downloaded maps cleared');
}

function openMaps() {
  $('maps').hidden = false;
  updateDownloadEstimate();
  refreshStorage();
}

/* ── theme ───────────────────────────────────────────────────────────────
 * Bright by default. This gets used outdoors, and a dark UI in direct sun is
 * a mirror. Night mode is a deliberate choice, not the default.
 */

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('theme-btn').textContent = theme === 'night' ? '☾' : '☀';
  $('theme-btn').title = theme === 'night' ? 'Night mode — tap for day' : 'Day mode — tap for night';
  document.querySelector('meta[name="theme-color"]')
    .setAttribute('content', theme === 'night' ? '#0d0f12' : '#ffffff');
  local.set('theme', theme);
}

/* ── wiring ──────────────────────────────────────────────────────────────── */

$('login-form').addEventListener('submit', handleLogin);
$('newpass-form').addEventListener('submit', setNewPassword);
$('forgot').addEventListener('click', forgotPassword);
$('whoami').addEventListener('click', signOut);
$('pin-btn').addEventListener('click', pinHere);
$('locate-btn').addEventListener('click', () => locate().catch(() => {}));
$('list-btn').addEventListener('click', openList);
$('list-close').addEventListener('click', () => { $('list').hidden = true; });
$('list-body').addEventListener('click', onListClick);
$('sheet-close').addEventListener('click', closeSheet);
$('pin-save').addEventListener('click', savePin);
$('pin-delete').addEventListener('click', deletePin);
$('pin-directions').addEventListener('click', openDirections);
$('pin-copy').addEventListener('click', copyCoords);
$('photo-input').addEventListener('change', onPhotoPick);
$('photo-add').addEventListener('click', (e) => pickPhotos({ kind: 'pin' }, e.currentTarget));
$('note-photo').addEventListener('click', (e) => pickPhotos({ kind: 'draft' }, e.currentTarget));
$('pin-photos').addEventListener('click', (e) => {
  const tile = e.target.closest('.thumb');
  if (tile) openLightbox(tile.dataset.id);
});
$('note-draft-photos').addEventListener('click', (e) => {
  const tile = e.target.closest('.thumb');
  if (tile) openLightbox(tile.dataset.id);
});
$('lightbox-close').addEventListener('click', closeLightbox);
$('lightbox').addEventListener('click', (e) => {
  if (e.target === $('lightbox')) closeLightbox();   // tap the backdrop
});
$('lightbox-del').addEventListener('click', (e) => deletePhoto(e.target.dataset.id));
$('note-add').addEventListener('click', addNote);
$('notes-list').addEventListener('click', onNotesClick);
$('place-ok').addEventListener('click', confirmPlace);
$('place-cancel').addEventListener('click', stopPlacing);
$('own-ask').addEventListener('click', askOwner);
$('own-result').addEventListener('click', onOwnerClick);
$('sources-open').addEventListener('click', () => { $('layers').hidden = true; openSources(); });
$('sources-close').addEventListener('click', () => { $('sources').hidden = true; });
$('sources-list').addEventListener('click', onSourcesClick);
$('src-save').addEventListener('click', addSource);
$('dl-photos').addEventListener('click', cachePhotosOffline);
$('layers-btn').addEventListener('click', () => {
  $('layers').hidden = false;
  refreshLocationState();
});
$('pin-map-btn').addEventListener('click', startPlacing);
$('loc-enable').addEventListener('click', () => locate().catch(() => {}));
$('maps-from-layers').addEventListener('click', () => { $('layers').hidden = true; openMaps(); });
$('layers-close').addEventListener('click', () => { $('layers').hidden = true; });

document.querySelectorAll('[name="basemap"]').forEach((r) =>
  r.addEventListener('change', () => r.checked && setBasemap(r.value)));
document.querySelectorAll('[data-overlay]').forEach((c) =>
  c.addEventListener('change', () => setOverlay(c.dataset.overlay, c.checked)));
$('maps-close').addEventListener('click', () => { $('maps').hidden = true; });
$('dl-go').addEventListener('click', downloadArea);
$('dl-clear').addEventListener('click', clearTiles);
$('pending').addEventListener('click', syncQueue);
$('theme-btn').addEventListener('click', () =>
  setTheme(document.documentElement.dataset.theme === 'night' ? 'day' : 'night'));

document.querySelectorAll('[name="detail"]').forEach((r) =>
  r.addEventListener('change', updateDownloadEstimate));

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // The lightbox sits on top of the sheet, so it gets the first Escape on its
  // own — otherwise closing the photo also closes the pin behind it.
  if (!$('lightbox').hidden) { closeLightbox(); return; }
  // Backing out of placing must not also close the sheet it came from.
  if (placing) { stopPlacing(); return; }
  // A note open for editing gets the next one on its own, for the same reason:
  // backing out of an edit should not also close the pin.
  if (editingNote) { cancelEditNote(); return; }
  closeSheet();
  ['list', 'maps', 'layers', 'sources'].forEach((id) => { $(id).hidden = true; });
});

window.addEventListener('online', () => { refreshNetworkUI(); syncQueue(); });
window.addEventListener('offline', refreshNetworkUI);

// Restore preferences before anything paints.
(async () => {
  setTheme((await local.get('theme')) || 'day');
  const saved = await local.get('basemap');
  if (saved && BASEMAPS[saved]) basemap = saved;
  const radio = document.querySelector(`[name="basemap"][value="${basemap}"]`);
  if (radio) radio.checked = true;

  const savedOverlays = await local.get('overlays');
  if (Array.isArray(savedOverlays)) {
    overlaysOn = new Set(savedOverlays.filter((k) => OVERLAYS[k]));
    document.querySelectorAll('[data-overlay]').forEach((c) => {
      c.checked = overlaysOn.has(c.dataset.overlay);
    });
  }
  start();
})();

if ('serviceWorker' in navigator) {
  // A new worker takes over the moment it installs (skipWaiting + claim), but
  // this page is still running the old CSS and JS until it reloads. Do that
  // once, automatically — otherwise a fix looks like it didn't work.
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
