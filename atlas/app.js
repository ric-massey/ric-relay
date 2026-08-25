/* ATLAS — a private map, shared.
 *
 * Three people, one map, pins any of them can drop and all of them can find
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
import { shrink, photoPath, shrinkSquare, avatarPath } from './photos.js';
import {
  terms, scorePin, placeSearchUrl, viewboxFromBounds, normalisePlaces,
  rankPlaces, dedupePlaces, isArea, MIN_QUERY,
  SCOPES, searchUrlForScope, searchOrigin, homeFromPlace, homeCamera,
} from './search.js';
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
const AVATAR_BUCKET = 'avatars';
const BYTES_PER_TILE = 28 * 1024;   // measured: Esri ~20 KB, USGS/OSM ~32 KB

let map       = null;
let me        = null;    // { id, username, display_name }
let pins      = [];      // every pin anybody has dropped
let markers   = new Map();
let meMarker  = null;
let sheet     = null;    // { mode: 'new' | 'view', pin }
let basemap   = 'sat';
let download  = null;    // { cancel: bool } while an area download runs
let notes     = [];      // every note on every pin you can see
let photoRows = [];      // the photo index. The images live in IndexedDB.
let parcelSources = [];  // county assessor adapters — see owners.js
let ownerShown = null;   // { r, cached } — the ownership answer currently drawn
let countyHunt = null;   // { pinId, state, found } while looking for a county
let people    = [];      // every profile: id, username, display_name, avatar_path
let query     = '';      // what is in the search field
let places    = [];      // what the geocoder last said about it
let placeState = 'idle'; // idle | asking | done | failed | offline
let placeAsk  = null;    // AbortController for the request in flight
let placeTimer = null;
let scope     = 'near';  // near | view | anywhere — which ground the search covers
let navApp    = null;    // google | apple | waze — which app opens directions
let widened   = false;   // the near search found nothing, so it asked the world
let home      = null;    // { name, detail, lat, lng, bounds } — the town you named
let firstRun  = false;   // the setup screen is up and the map is waiting
let foundMarker = null;  // the place a search put on the map
let sources   = { pins: true, places: true };
let editingNote = null;  // id of the note currently open for editing
let draftNote = null;    // { id, pending } — photos attached to a note not yet written
let photoTarget = null;  // which strip the next pick from the file input lands in

/* Object URLs handed to <img>, and a generation counter. Rendering a photo is
 * async, so a sheet closed mid-load would otherwise hand a URL to a thumbnail
 * nobody is looking at and leak it. Every render bumps the generation; a load
 * that finishes against a stale one throws its URL away. */
let objectUrls = [];
let photoGen   = 0;
/* The list keeps its own bucket. The sheet revokes every URL it owns each time
 * it repaints, and it must not take the list's thumbnails down with them. */
let listUrls = [];
let listGen  = 0;
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
    // Draws its own roads and place names into the tile: the overlays below
    // can add to that, but nothing can take it away. See overlayNotes().
    ownRoads: true,
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}',
    attribution: 'USGS The National Map',
    // USGS bakes the contours INTO the imagery and stops the whole thing at 16
    // — three levels short of plain satellite, and it 404s above that. That is
    // why this map goes soft while the satellite one is still sharp: they are
    // not one picture at two settings, they are two different pictures.
    //
    // It was briefly made to fade out past 16 and let plain satellite through,
    // which fixed the sharpness by deleting the map: at the zoom you actually
    // use it, "satellite + topo" became satellite. The two base maps mean
    // opposite things — one is bare ground, one has the information drawn on —
    // and a map that quietly turns into the other one is worse than a soft map.
    //
    // So it stays itself and stops where its tiles stop. The card in the layers
    // panel says so, and says what to do instead: satellite, with whichever
    // overlays you actually wanted. There is no fix beyond that — every free
    // transparent contour service was checked and none goes past 16 either.
    maxzoom: 16,
  },
  topo: {
    label: 'USGS topo',
    // Draws its own roads and place names into the tile: the overlays below
    // can add to that, but nothing can take it away. See overlayNotes().
    ownRoads: true,
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    attribution: 'USGS The National Map',
    maxzoom: 16,
  },
  otm: {
    label: 'contour topo',
    // Draws its own roads and place names into the tile: the overlays below
    // can add to that, but nothing can take it away. See overlayNotes().
    ownRoads: true,
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
    // Draws its own roads and place names into the tile: the overlays below
    // can add to that, but nothing can take it away. See overlayNotes().
    ownRoads: true,
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
  /* State and county lines, from the Census. Two switches off one service,
   * which publishes each boundary at half a dozen generalisations and picks
   * the right one for the scale itself — so a state line is a clean line at
   * z5 and the real jagged river at z14, with nothing here to choose between
   * them.
   *
   * The odd part is the URL. This service has no tile cache, so instead of
   * z/x/y it is handed the bounding box of each tile and asked to draw it:
   * {bbox-epsg-3857} is MapLibre's own token for exactly that. The cost is
   * that these two cannot be bulk-downloaded for offline — there is no tile to
   * download, only a question to ask — which is what noBulk means below and why
   * both descriptions in the layers panel stop short of promising otherwise.
   */
  states: {
    label: 'state lines',
    urls: ['https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image&layers=show:0,2,4,6,8,10,12,14,15,16'],
    maxzoom: 16,
    noBulk: true,
    attribution: 'US Census Bureau TIGERweb',
  },
  counties: {
    label: 'county lines',
    urls: ['https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image&layers=show:1,3,5,7,9,11,13'],
    maxzoom: 16,
    noBulk: true,
    attribution: 'US Census Bureau TIGERweb',
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

/* ── what kind of place it is ────────────────────────────────────────────
 * The `kind` column has been on the pins table since the first migration,
 * defaulting to 'spot', and nothing has ever written to it. It is the
 * vocabulary now: eight kinds, each with a colour, chosen when you drop a pin
 * and filterable afterwards.
 *
 * Deliberately NOT a check constraint in the database. A kind nobody
 * recognises falls back to "other" here and still draws, still lists and still
 * filters — whereas a constraint would turn a future rename into a write that
 * fails on a phone in a canyon, which is the worst place to find out.
 */
const KINDS = [
  { key: 'cliffs',    label: 'cliffs' },
  { key: 'caves',     label: 'caves' },
  { key: 'trails',    label: 'trails' },
  { key: 'tunnels',   label: 'tunnels' },
  { key: 'bridges',   label: 'bridges' },
  { key: 'buildings', label: 'abandoned buildings' },
  { key: 'mountains', label: 'mountains' },
  { key: 'towers',    label: 'towers' },
  { key: 'other',     label: 'other' },
];
const KIND_KEYS = new Set(KINDS.map((k) => k.key));
const kindOf = (p) => (KIND_KEYS.has(p?.kind) ? p.kind : 'other');
const kindLabel = (key) => KINDS.find((k) => k.key === key)?.label || 'other';

/* Every kind shown until told otherwise, and the choice is kept on the phone:
 * it is about what you are looking for today, not about anybody else. */
let kindFilter = new Set(KIND_KEYS);
const filtering = () => kindFilter.size !== KINDS.length;
/* A parking spot is not a kind of place — it belongs to one. It shows when the
 * pin it serves shows and hides when that hides, or you are left with a lone P
 * in the woods and nothing on the map to explain it. */
function passesFilter(p) {
  if (isParking(p)) {
    const parent = pins.find((x) => x.id === p.parent_id);
    return !!parent && kindFilter.has(kindOf(parent));
  }
  return kindFilter.has(kindOf(p));
}

/* ── little helpers ─────────────────────────────────────────────────────── */

/* Every icon in the app is a <use> of the sprite in index.html, so markup built
 * in here draws from the same set as the markup that is written by hand. Taking
 * only a symbol id means there is no way to smuggle a different stroke weight
 * or a stray viewBox into a template. */
const icon = (name, cls = '') =>
  `<svg class="icon${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#${name}"/></svg>`;

/* A button with an icon in it cannot have its words replaced with textContent —
 * that throws the icon away, and the button silently loses it the first time
 * its label changes. The words live in a span and only the span is written. */
function setLabel(btn, text) {
  const lbl = btn.querySelector('.lbl');
  if (lbl) lbl.textContent = text; else btn.textContent = text;
}

let toastTimer = null;
function toast(msg, bad = false) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.toggle('is-bad', bad);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, bad ? 4200 : 2200);
}

/* Relative time, short. A feed is read as "what has happened lately", and
 * "Aug 20, 2026" makes you do the subtraction yourself — in tabular monospace,
 * at the same visual weight as the name of the place. */
function fmtAgo(iso) {
  const secs = (Date.now() - new Date(iso).getTime()) / 1000;
  if (secs < 90) return 'just now';
  const mins = secs / 60;
  if (mins < 60) return `${Math.round(mins)}m ago`;
  const hrs = mins / 60;
  if (hrs < 24) return `${Math.round(hrs)}h ago`;
  const days = hrs / 24;
  if (days < 7) return `${Math.round(days)}d ago`;
  if (days < 35) return `${Math.round(days / 7)}w ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
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

/* One unit, in what everybody here thinks in. This goes on the end of a list row
 * beside a name, a date and a note count, and two units there is a sentence. */
const fmtDistance = (m) => m < 1609
  ? `${Math.round(m * 3.28084).toLocaleString()} ft`
  : `${(m / 1609.344).toFixed(m < 16093 ? 1 : 0)} mi`;

/* ── auth ────────────────────────────────────────────────────────────────
 * An email and a password, and the email is also the invitation: Supabase
 * sends the link, whoever follows it picks their own password, and nobody is
 * ever handed one.
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
      : (/invalid/i.test(error.message) ? 'wrong email or password' : error.message);
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
  let adopted = false;
  if (online()) {
    const { data } = await db.from('profiles')
      .select('id, username, display_name, avatar_path, must_change_password, prefs, setup_done')
      .eq('id', session.user.id).single();
    if (data) {
      profile = data;
      await local.set('me', data);
      adopted = await adoptPrefs(data.prefs);
    }
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
  me.email = session.user.email;
  await loadPeople();
  whoamiChip();
  renderMe();
  // Not awaited: nothing on screen is waiting for a face, and the map should
  // not be either.
  warmAvatars().then(pruneAvatars);

  // Whatever the laptop decided last, before the map is built out of it.
  if (adopted) await applyPrefs();

  // The first time this PERSON signs in — not the first time this device does.
  // It is a column on their profile, so a second phone gets the map they have
  // already set up rather than a welcome screen and a fresh start. Offline
  // there is no answer and no first sign-in either: reaching this screen at all
  // needed a network once.
  if (me.setup_done === false) openFirstRun();

  if (!map) initMap();
  else if (adopted) reapplyToMap();
  await loadPins();
  await loadNotes();
  await loadPhotos();
  await loadSources();
  await syncQueue();
  refreshNetworkUI();
}

/* ── settings that follow the person ─────────────────────────────────────
 * These used to live only in IndexedDB, which made the laptop and the phone two
 * different maps and handed the first-run setup to every new device as though
 * nobody had ever signed in.
 *
 * Local is still written first and always: it is instant, it works in a canyon,
 * and it is what the app reads on the way up. The server copy is the one that
 * outlives the phone, and it is written behind the scenes — nothing on screen
 * waits for it, and if it cannot be written now it goes up on the next start.
 *
 * Only preferences are in here. What this DEVICE may do — whether it may ask
 * for your location, where it last had the map, what it has downloaded — stays
 * local, because those are facts about the phone rather than about you.
 */
const SYNCED_PREFS = ['theme', 'accent', 'glass', 'basemap', 'overlays',
                      'kindFilter', 'scope', 'sources', 'home', 'navApp'];

let prefsTimer = null;

/* True while applyPrefs is putting saved values back into the controls. Every
 * one of those setters is the same function the user's own tap calls, so
 * without this the app would record its own boot as a change — stamping
 * prefsAt with "now" on every open, which would make every device permanently
 * look like the newest one and turn the rule below into a coin toss. */
let restoring = false;

async function pushPrefs() {
  if (!me || !online()) return;
  const prefs = { at: (await local.get('prefsAt')) || Date.now() };
  for (const k of SYNCED_PREFS) {
    const v = await local.get(k);
    if (v !== null && v !== undefined) prefs[k] = v;
  }
  // Not awaited by anything and not worth a toast: a preference that failed to
  // reach the server is still right on this device and goes up next start.
  await db.from('profiles').update({ prefs }).eq('id', me.id);
}

/* Debounced, because dragging the accent picker is twenty changes and one
 * decision. Local is written immediately either way — and so is the time it
 * changed, which is what stops the sync going backwards (see adoptPrefs). */
async function savePref(key, value) {
  await local.set(key, value);
  if (restoring) return;          // putting a setting back is not changing it
  await local.set('prefsAt', Date.now());
  clearTimeout(prefsTimer);
  prefsTimer = setTimeout(() => pushPrefs().catch(() => {}), 900);
}

/* The newer copy wins, and which one that is has to be asked rather than
 * assumed.
 *
 * "The server is always right" is the obvious rule and it quietly eats work:
 * change the base map in a canyon with no signal, come back into range, and the
 * server's older answer would land on top of the one you actually made and then
 * get pushed back up as though you had chosen it. So both sides carry the time
 * they last changed, and the older one gives way. Clocks between two of your
 * own devices are close enough for this; nothing here is a bank ledger. */
async function adoptPrefs(prefs) {
  if (!prefs || typeof prefs !== 'object') return false;
  const keys = SYNCED_PREFS.filter((k) => prefs[k] !== undefined);
  if (!keys.length) return false;

  const mine = (await local.get('prefsAt')) || 0;
  const theirs = Number(prefs.at) || 0;
  if (mine > theirs) {
    // This device is ahead — probably changed with no signal. Send, don't take.
    pushPrefs().catch(() => {});
    return false;
  }

  for (const k of keys) await local.set(k, prefs[k]);
  // Adopted wholesale, so this device is now exactly as old as what it took.
  // Without this the next change would look newer than it is by however long
  // the app has been open, and two devices would take turns overwriting.
  await local.set('prefsAt', theirs);
  return true;
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

  // The thread from a pin to its parking spot. In the initial style rather than
  // added later for the same reason as the overlays: addSource() before the
  // style has loaded throws. Empty until a sheet is open.
  sources[PARK_LINE_SRC] = { type: 'geojson', data: EMPTY_GEOJSON };
  const parkLineLayer = {
    id: 'park-line', type: 'line', source: PARK_LINE_SRC,
    layout: { 'line-cap': 'round' },
    paint: {
      'line-color': '#ffffff', 'line-width': 2.4, 'line-opacity': 0.9,
      'line-dasharray': [1.6, 1.6],
    },
  };

  // Overlays go into the initial style rather than being added afterwards:
  // addSource() before the style finishes loading throws. Terrain is listed
  // first so roads and labels draw on top of it rather than under.
  // Order is the draw order: ground-shading first, then areas, then lines, then
  // labels last so nothing is drawn over the text.
  const DRAW_ORDER = ['terrain', 'publicland', 'water', 'parcels',
                     'counties', 'states', 'trails', 'rail', 'roads', 'labels'];
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

  // Last, so the thread is drawn over every base map and overlay. The markers
  // are DOM and sit above all of it regardless.
  layers.push(parkLineLayer);

  map = new maplibregl.Map({
    container: 'map',
    style: { version: 8, sources, layers },
    center: [-98.6, 39.8],   // middle of the country until we know better
    zoom: 3.4,
    // Off the map. The credits are a licence condition, not a control, and
    // down in the corner they were the third thing competing for the bottom of
    // the screen with the two things you actually press. They are in settings,
    // under "map data", and they say more there than the little ⓘ ever did.
    attributionControl: false,
  });

  // Bottom right, stacked above the search bar. Up in the corner they were
  // tucked under the settings and avatar chips — half hidden, and at the end of
  // the reach from a thumb that is already down at the search bar. Zooming is
  // the most-pressed thing on the whole map; it belongs where the hand is.
  // The clearance above the bottom bar is set in styles.css.
  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');

  // Long-press (or right-click) pins the thing across the valley that you can
  // see but are not standing in.
  map.on('contextmenu', (e) => openNewPin(e.lngLat.lat, e.lngLat.lng, null));
  wireLongPress();

  map.on('moveend', updateDownloadEstimate);
  // Every frame of a pinch, not just the end of it — a pin that resizes once
  // the gesture is over reads as a glitch rather than as a response.
  map.on('zoom', scalePins);
  scalePins();

  /* Where the map opens, in order of how much each answer knows.
   *
   * The last view is painted first whatever happens: it is instant, it is
   * usually right, and it means nobody is looking at the whole of Kansas while
   * the GPS thinks about it. Then your own position, which wins whenever the
   * phone will give one — nothing beats being told where you are. And if it
   * will not, the town you named, because the alternative is opening on
   * wherever you happened to be looking last time.
   *
   * Not silent: if there is no blue dot, the reason should be on screen rather
   * than left for you to wonder about. */
  local.get('lastView').then((v) => {
    if (v) map.jumpTo({ center: v.center, zoom: v.zoom });
    // On the first run nobody has agreed to be asked yet, and the browser's
    // permission box arriving over the screen that explains it is optional
    // would make a liar of the screen. firstRunDone() takes it from here.
    if (firstRun) return;
    if (useLocation) locate({ fly: true }).catch(() => goHome());
    else goHome();
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
  savePref('basemap', key);
  overlayNotes();
  updateDownloadEstimate();
  renderCredits();
}

/* The roads and place-names switches add Esri's layers on top. They cannot
 * subtract, and four of the five base maps have roads and names painted into
 * their own tiles — so turning "roads" off on the topo map does exactly nothing
 * visible, and the switch spends the rest of the day looking broken. It is not:
 * it is telling the truth about a layer it does not own. Say so where the
 * switch is, rather than leaving everyone to work it out on a mountain. */
function overlayNotes() {
  const own = !!BASEMAPS[basemap]?.ownRoads;
  const name = BASEMAPS[basemap]?.label ?? 'this map';
  $('ov-note-roads').textContent = own
    ? `${name} draws its own roads — this only adds route shields on top`
    : 'the road network and route shields';
  $('ov-note-labels').textContent = own
    ? `${name} has its own names — switch to satellite for a clean picture`
    : 'towns, parks, peaks, creeks — the labels';
}

function setOverlay(key, on) {
  on ? overlaysOn.add(key) : overlaysOn.delete(key);
  OVERLAYS[key].urls.forEach((_, i) => {
    const id = `ov-${key}-${i}`;
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
  });
  savePref('overlays', [...overlaysOn]);
  updateDownloadEstimate();
  renderCredits();
}

/* ── where am I ──────────────────────────────────────────────────────────── */

/* Two switches, not one, and they answer different questions. The browser's
 * permission is "may this site ask". This one is "does ATLAS want to know" —
 * and it is the one that was missing. Granting a permission you then cannot
 * decline from inside the app without digging through Safari's settings is
 * exactly what makes people deny it forever instead.
 *
 * Off is total: the blue dot goes, the button that centres on you goes,
 * distances leave the list, and no call is made to the phone at all — not on
 * boot, not on a tap, not silently.
 */
let useLocation = true;

function setUseLocation(on) {
  useLocation = !!on;
  $('loc-use').checked = useLocation;
  $('locate-btn').hidden = !useLocation;
  if (!useLocation) {
    meMarker?.remove();
    meMarker = null;
    $('locate-btn').classList.remove('is-live');
    // The distance column is drawn from the dot, so it has to be redrawn
    // without it rather than left showing a number from a position we have
    // just agreed to stop holding.
    if (!$('list').hidden) renderResults();
  }
  local.set('useLocation', useLocation);
  refreshLocationState();
}

function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no GPS on this device'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 20000, maximumAge: 0,
    });
  });
}

async function locate({ silent = false, fly = false } = {}) {
  if (!useLocation) {
    if (!silent) toast('my location is switched off — turn it on in settings');
    return null;
  }
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
  $('locate-btn').classList.add('is-live');
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
  if (!useLocation) {
    el.textContent = 'off. nothing here asks the phone where you are.';
    btn.hidden = true;
    return;
  }
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
    setLabel(btn, meMarker ? 'find me again' : 'get a fix');
  } else if (state === 'denied') {
    el.innerHTML = '<b>blocked.</b> the app cannot re-ask — you have to allow location '
      + 'for this site in your browser settings. on iPhone: Settings → Safari → Location.';
    btn.hidden = true;
  } else {
    el.textContent = 'off. the map cannot see where you are until you allow it.';
    btn.hidden = false;
    setLabel(btn, 'turn on my location');
  }
}

/* ── everybody else, and their faces ────────────────────────────────────
 * Three profiles, fetched once and mirrored, rather than an avatar column
 * threaded through pins_with_author, pin_notes_with_author and every view added
 * after them. A name belongs on the row it was written with — a note says who
 * wrote it, that day, and stays true if they are renamed later. A FACE is the
 * opposite: it is whoever that person is right now, so it is looked up by id at
 * the moment of drawing and there is exactly one place it can be wrong.
 */
async function loadPeople() {
  if (online()) {
    const { data, error } = await db.from('profiles')
      .select('id, username, display_name, avatar_path');
    if (!error && data) {
      people = data;
      await local.set('people', data);
      return;
    }
  }
  people = (await local.get('people')) || [];
}

/* Three faces at about 7 KB each, fetched once so they are on the phone before
 * the phone is in a canyon. A byline that falls back to a letter offline is not
 * broken, but it is a worse map than the one you had on the drive out, and this
 * costs less than a single tile. */
async function warmAvatars() {
  if (!online()) return;
  await Promise.all(people
    .filter((p) => p.avatar_path)
    .map((p) => avatarBlob(p.avatar_path).catch(() => null)));
}

/* Faces nobody wears any more. A new picture is a new path, which is what makes
 * the cache safe to trust — and is also what would otherwise leave every
 * picture anybody had ever tried sitting on every phone forever.
 *
 * Guarded on the profiles being known: offline on a fresh install the mirror is
 * empty, and "keep nothing" would then throw away every face on the phone at
 * exactly the moment there is no way to fetch them back. */
async function pruneAvatars() {
  if (!people.length) return;
  const keep = new Set(people.filter((p) => p.avatar_path).map((p) => `avatar:${p.avatar_path}`));
  for (const id of await local.blobIds()) {
    if (typeof id === 'string' && id.startsWith('avatar:') && !keep.has(id)) {
      await local.deleteBlob(id);
    }
  }
}

const avatarPathFor = (userId) =>
  people.find((p) => p.id === userId)?.avatar_path || null;

/* One object URL per picture per session, held in a Map keyed by path. The
 * photo strips mint a URL per render and revoke the lot on the next one, which
 * is right for a strip that repaints as you scroll; a face is drawn in five
 * places, repeats on every row of the list, and never changes without the app
 * being told — so it is made once. A new picture is a new path, so a stale
 * entry is impossible rather than merely unlikely. */
const avatarUrls = new Map();

async function avatarBlob(path) {
  const key = `avatar:${path}`;
  const cached = await local.getBlob(key);
  if (cached) return cached;
  if (!online()) return null;

  const { data, error } = await db.storage.from(AVATAR_BUCKET).download(path);
  if (error || !data) return null;
  await local.putBlob(key, data);
  return data;
}

async function avatarUrl(path) {
  if (avatarUrls.has(path)) return avatarUrls.get(path);
  const blob = await avatarBlob(path);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  avatarUrls.set(path, url);
  return url;
}

/* The monogram is not a placeholder waiting for a picture — it is the answer
 * for anybody who has not set one, and it is what everybody sees offline before
 * a face has ever been downloaded. So it is always what gets drawn first, and
 * the picture lands on top of it if there is one. */
const initialOf = (name) => (String(name || '?').trim().charAt(0) || '?');

function avatarHtml(userId, name, cls = '') {
  return `<span class="avatar${cls ? ' ' + cls : ''}" data-avatar="${userId || ''}"`
    + ` title="${escapeHtml(name || '')}">${escapeHtml(initialOf(name))}</span>`;
}

/* Painted after the markup, like the photo strips, and idempotent: anything
 * already carrying its picture is skipped, so calling this after every render
 * costs a Map lookup per face rather than a download. */
function paintAvatars(root = document) {
  root.querySelectorAll('[data-avatar]:not(.is-loaded)').forEach((el) => {
    const path = avatarPathFor(el.dataset.avatar);
    if (!path) return;
    avatarUrl(path).then((url) => {
      if (!url) return;
      el.style.backgroundImage = `url("${url}")`;
      el.classList.add('is-loaded');
    });
  });
}

/* After somebody's picture changes, every copy of the old one on screen has to
 * be told to forget it — they are marked painted and would never look again. */
function resetAvatars(userId) {
  document.querySelectorAll(`[data-avatar="${userId}"]`).forEach((el) => {
    el.classList.remove('is-loaded');
    el.style.backgroundImage = '';
  });
  paintAvatars();
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

/* The dashed thread from a pin to its parking spot, drawn only for the pin you
 * currently have open. Drawn for all of them at once it is a plate of spaghetti;
 * drawn for none of them, a P on a forest road belongs to nothing. */
const PARK_LINE_SRC = 'park-line';

function drawParkLine() {
  if (!map || !map.getSource(PARK_LINE_SRC)) return;
  const pin = sheet?.mode === 'view' ? sheet.pin : null;
  const park = pin && !isParking(pin) ? parkingFor(pin.id) : null;
  map.getSource(PARK_LINE_SRC).setData(park
    ? { type: 'FeatureCollection', features: [{
        type: 'Feature', properties: {},
        geometry: { type: 'LineString',
          coordinates: [[park.lng, park.lat], [pin.lng, pin.lat]] } }] }
    : EMPTY_GEOJSON);
}

function drawPins() {
  markers.forEach((m) => m.remove());
  markers.clear();
  pins.filter(passesFilter).forEach(addMarker);
  drawParkLine();
  // Say when the map is deliberately incomplete, or a filtered-out pin reads
  // as a lost one.
  $('search-open').classList.toggle('is-filtered', filtering());
  // Every marker is thrown away and rebuilt in here, so the one being read
  // about has to be told again that it is — a filter change or a sync mid-sheet
  // would otherwise quietly put the open pin back in the crowd.
  if (sheet?.mode === 'view') markActive(sheet.pin.id);
}

/* An actual pin: a round head on a point, with the point being the bit that
 * means something — it is the only part of the shape that says "here, exactly".
 * It was a rotated CSS square with one square corner, which is the shape a pin
 * makes if you have only got border-radius. Drawn rather than approximated now,
 * so the head is round, the point is sharp and it sits on its own shadow.
 *
 * Colour comes from one custom property the classes set, so mine/theirs,
 * unsynced and personal all compose instead of fighting each other. */
const PIN_SVG = `<svg class="pin-art" viewBox="0 0 24 33" aria-hidden="true">
  <path class="pin-body" d="M12 32C12 32 22.6 19.8 22.6 11.6 22.6 5.5 17.8.7 12 .7S1.4 5.5 1.4 11.6C1.4 19.8 12 32 12 32Z"/>
  <circle class="pin-eye" cx="12" cy="11.5" r="4.2"/>
</svg>`;

/* Exactly one pin is the one whose sheet is open, and it is drawn standing up
 * with a ring under it. Written as "set them all, one is true" rather than
 * "clear the old one, set the new one", because the old one may have just been
 * removed by a redraw and clearing something that is gone is a silent no-op
 * that leaves two pins looking selected. */
function markActive(id) {
  markers.forEach((m, key) =>
    m.getElement().classList.toggle('is-active', key === id));
}

/* ── how big a pin is drawn ──────────────────────────────────────────────
 * A pin is a label at walking zoom and a symptom of clutter at state zoom. At
 * z15 you are looking at one place and want the thing legible; at z5 you are
 * looking at nine counties and what you want is to see the SHAPE of where the
 * pins are — which ones are clustered on one bluff and which one is off on its
 * own — and thirty full-size pins is one blob with no shape in it at all.
 *
 * The curve is deliberately not linear. Halfway between z5 and z15 is not
 * halfway between the two problems: clutter arrives fast on the way out, so
 * the size falls away fast too, and the power keeps them small over the whole
 * range where a pin is a marker rather than a label.
 */
const PIN_Z_FULL  = 15;      // at and above this, drawn at its designed size
const PIN_Z_MIN   = 4;       // at and below this, as small as it ever gets
const PIN_MIN     = 0.34;    // 10x14px — a coloured tick, still the right colour

function scalePins() {
  const t = Math.max(0, Math.min(1,
    (map.getZoom() - PIN_Z_MIN) / (PIN_Z_FULL - PIN_Z_MIN)));
  const scale = PIN_MIN + (1 - PIN_MIN) * t ** 1.5;
  document.documentElement.style.setProperty('--pin-scale', scale.toFixed(3));
}

/* A parking spot is drawn as what it is rather than as another find: a small
 * square with a P in it, the shape every road sign in the country already uses
 * for this. Deliberately NOT the pin silhouette — the whole job of the map is
 * that a glance tells you which of these you drive to and which you walk to. */
const PARK_SVG = `<svg class="pin-art" viewBox="0 0 24 28" aria-hidden="true">
  <path class="pin-body" d="M3 2.6h18a1.6 1.6 0 0 1 1.6 1.6v13.4A1.6 1.6 0 0 1 21 19.2h-6.4L12 25.4l-2.6-6.2H3a1.6 1.6 0 0 1-1.6-1.6V4.2A1.6 1.6 0 0 1 3 2.6Z"/>
  <path class="pin-letter" d="M9.6 15.4V6.6h3.1a2.6 2.6 0 0 1 0 5.2H9.6"/>
</svg>`;

function addMarker(p) {
  const park = isParking(p);
  const el = document.createElement('div');
  el.className = 'pin-marker'
    + (park ? ' is-park' : '')
    + (p.created_by === me.id ? ' is-mine' : '')
    + (p._pending ? ' is-pending' : '')
    + (p.is_private ? ' is-private' : '');
  el.dataset.kind = park ? 'parking' : kindOf(p);
  el.innerHTML = park ? PARK_SVG : PIN_SVG;
  el.title = park ? 'parking' : pinTitle(p);
  el.addEventListener('click', (e) => { e.stopPropagation(); openPin(p); });

  markers.set(p.id, new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([p.lng, p.lat]).addTo(map));
}

/* ── choosing and filtering by kind ─────────────────────────────────────── */

function renderKindControls() {
  $('pin-kind').innerHTML = KINDS.map((k) => `
    <label class="kind-chip" data-kind="${k.key}">
      <input type="radio" name="kind" value="${k.key}">
      <span class="kind-dot"></span>${escapeHtml(k.label)}
    </label>`).join('');

  $('kind-filter').innerHTML = KINDS.map((k) => `
    <label class="kind-chip" data-kind="${k.key}">
      <input type="checkbox" data-filter="${k.key}" checked>
      <span class="kind-dot"></span>${escapeHtml(k.label)}
    </label>`).join('');
}

/* Someone else's pin is read-only, and a disabled radio has to LOOK disabled or
 * it is just a control that ignores you. The class is what the stylesheet dims;
 * the disabled attribute is what actually refuses the tap. */
function setPinKindEnabled(on) {
  $('pin-kind').classList.toggle('is-locked', !on);
  $('pin-kind').querySelectorAll('input[name="kind"]')
    .forEach((r) => { r.disabled = !on; });
}

function setPinKind(key) {
  const radio = document.querySelector(`[name="kind"][value="${key}"]`);
  if (radio) radio.checked = true;
  // The dot on the title line is the same vocabulary the markers use, so the
  // sheet says which of those coloured pins you are reading before the name does.
  $('sheet-head').dataset.kind = key;
}

const chosenKind = () =>
  document.querySelector('[name="kind"]:checked')?.value || 'other';

async function applyFilter() {
  document.querySelectorAll('[data-filter]').forEach((c) => {
    c.checked = kindFilter.has(c.dataset.filter);
  });
  await savePref('kindFilter', [...kindFilter]);
  drawPins();
  if (!$('list').hidden) renderResults();
}

function toggleKind(key, on) {
  if (on) kindFilter.add(key); else kindFilter.delete(key);
  // Filtering everything out leaves a blank map and no way to read why, so the
  // last one off turns them all back on rather than showing nothing.
  if (!kindFilter.size) kindFilter = new Set(KIND_KEYS);
  applyFilter();
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
/* Three places the sheet can sit, and one number that says which. Everything
 * that needs to know how much of the screen is left — the map's own centre, the
 * crosshair, the drag itself — reads --sheet-frac rather than keeping its own
 * copy of "half", which is how those three used to disagree with each other. */
const SHEET_HALF = 0.52;
const SHEET_FULL = 0.92;
const SHEET_GONE = 0.3;      // let go below this and you meant to close it

let sheetFrac = SHEET_HALF;

function setSheetFrac(f) {
  sheetFrac = f;
  document.documentElement.style.setProperty('--sheet-frac', f.toFixed(3));
}

/* The results sheet has its own three, and a fourth stop the pin sheet does not
 * need: PEEK, a hand's width of list left showing. Searching is nearly always
 * about ground you can see, so getting the map back has to cost one push rather
 * than a close and a re-open — the arrow in the corner is for leaving, not for
 * looking. Snapping is to the NEAREST of the three; with three stops a
 * threshold either side of the middle one puts you somewhere you did not aim. */
const LIST_PEEK = 0.22;
const LIST_HALF = 0.52;
const LIST_FULL = 0.86;
const LIST_GONE = 0.11;      // shoved well past peek: you meant to be rid of it

let listFrac = LIST_HALF;

function setListFrac(f) {
  listFrac = f;
  document.documentElement.style.setProperty('--list-frac', f.toFixed(3));
}

function sheetPadding(open) {
  if (!map) return;
  const h = map.getContainer().clientHeight;
  // Capped: dragged to full height the sheet leaves almost no map, and padding
  // the camera by 92% of itself puts the centre off the top of the world.
  const bottom = open ? Math.round(h * Math.min(sheetFrac, 0.62)) : 0;
  map.setPadding({ top: 0, left: 0, right: 0, bottom });
}

/* Shown and hidden through here rather than by setting `hidden` directly, so
 * the sheet has time to slide back down. The timer is cancelled on the way in:
 * tapping a second pin while the first is still leaving must not hand the new
 * sheet the old one's disappearance. */
let sheetHideTimer = null;

function showSheet() {
  clearTimeout(sheetHideTimer);
  const el = $('sheet');
  el.classList.remove('is-closing');
  el.hidden = false;
}

function hideSheet() {
  const el = $('sheet');
  if (el.hidden) return;
  el.classList.add('is-closing');
  clearTimeout(sheetHideTimer);
  sheetHideTimer = setTimeout(() => {
    el.hidden = true;
    el.classList.remove('is-closing');
  }, 220);
}

/* Same trick for the full-screen panels: they animate out, so they cannot be
 * hidden the instant the button is pressed. `then` runs once it is really gone,
 * for the caller that has cleanup — the list revoking its thumbnails — which
 * would otherwise blank every picture mid-fade. */
const panelTimers = new Map();

function openPanel(id) {
  clearTimeout(panelTimers.get(id));
  const el = $(id);
  el.classList.remove('is-closing');
  el.hidden = false;
}

function closePanel(id, then) {
  const el = $(id);
  if (el.hidden) { then?.(); return; }
  el.classList.add('is-closing');
  clearTimeout(panelTimers.get(id));
  panelTimers.set(id, setTimeout(() => {
    el.hidden = true;
    el.classList.remove('is-closing');
    then?.();
  }, 130));
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
  // Mark the exact spot: the pin has no marker of its own until it is saved.
  setSheetFrac(SHEET_HALF);
  sheetPadding(true);
  markActive(null);
  $('crosshair').classList.add('is-offset');
  $('crosshair').hidden = false;
  map.easeTo({ center: [lng, lat] });
  $('pin-name').value = '';
  $('pin-desc').value = '';
  $('pin-name').disabled = false;
  $('pin-desc').disabled = false;
  setPinKind('other');
  // A new pin is always yours, and the sheet is reused — so anything openPin
  // locked on somebody else's pin has to be handed back here.
  setPinKindEnabled(true);
  $('photo-add').hidden = false;
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
  showSheet();
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
  setPinKind(kindOf(p));
  // The kind chips were the one control left live on somebody else's pin. They
  // could not save anything — the save button is hidden below — but tapping one
  // recoloured the dot at the top of the sheet, so it looked like an edit that
  // had taken, right up until you closed the sheet and it came back.
  setPinKindEnabled(mine);
  $('pin-private').checked = !!p.is_private;
  $('pin-private').disabled = !mine;
  // A photo with no note on it is a photo OF THE PLACE — it speaks in the pin's
  // voice and belongs to whoever found it. Photos on a note are the other half
  // of that and stay open to everybody; see the note compose box below.
  $('photo-add').hidden = !mine;
  $('pin-save').hidden = !mine;
  $('pin-save').textContent = 'save changes';
  $('pin-delete').hidden = !mine;
  // Someone else's pin: nothing in the bar, so the bar itself goes. An empty
  // strip with a rule over it reads as something that failed to load.
  $('sheet-actions').hidden = !mine;
  $('pin-meta').innerHTML = metaHtml(p, p.display_name || p.username);
  renderParking();
  renderDirectionsLabel();
  $('notes-block').hidden = false;
  $('note-body').value = '';
  editingNote = null;
  renderNotes();          // which paints the photo strips, this pin's included
  paintAvatars($('pin-meta'));
  resetOwner();
  showSheet();
  setSheetFrac(SHEET_HALF);
  sheetPadding(true);
  // Stand the pin you are reading about up out of the others, and thread it to
  // where you leave the truck.
  markActive(p.id);
  drawParkLine();
  map.easeTo({ center: [p.lng, p.lat] });
}

function metaHtml(p, author) {
  const bits = [];
  if (author) bits.push(`dropped by <b>${escapeHtml(author)}</b>`);
  if (p.created_at) bits.push(fmtDate(p.created_at));
  const face = author ? avatarHtml(p.created_by, author, 'avatar-sm') : '';
  const head = bits.length ? `${face}${bits.join(' &middot; ')}` : 'new pin';
  const acc = p.accuracy_m ? ` &middot; &plusmn;${Math.round(p.accuracy_m)} m` : '';
  const pending = p._pending
    ? '<br><span class="note-warn">' + icon('i-alert', 'icon-sm')
      + 'waiting to sync — lives on this phone only</span>' : '';
  const priv = p.is_private ? '<br><b>personal</b> &middot; nobody else can see this pin' : '';
  return `${head}<br>${fmtCoords(p.lat, p.lng)}${acc}${priv}${pending}`;
}

function closeSheet() {
  hideSheet();
  markActive(null);
  $('crosshair').hidden = true;
  $('crosshair').classList.remove('is-offset');
  sheetPadding(false);
  $('pin-save').hidden = false;
  discardDraftNote();
  releaseObjectUrls();
  editingNote = null;
  sheet = null;
  drawParkLine();      // nothing open, so nothing to thread
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
    kind: chosenKind(),
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
    el.dataset.kind = kindOf(p);
  }
  closeSheet();
  toast(sent ? 'saved' : 'saved on this phone — will sync later');
  refreshNetworkUI();
}

/* Every photo on one pin, out of the bucket and out of the mirror.
 *
 * Its own function because deleting a pin now has two of these to do — the pin
 * and the parking spot hanging off it — and the order is the whole point: the
 * permission to remove a photo is checked against a pin that still exists, so
 * the moment the pin goes its files are stranded in the bucket for ever. */
async function erasePinPhotos(pinId) {
  const its = photosForPin(pinId);
  if (!its.length) return;
  await push({ op: 'photo-delete', paths: its.map((r) => r.path), ids: its.map((r) => r.id) });
  for (const r of its) { await local.deletePhoto(r.id); await local.deleteBlob(r.id); }
  photoRows = photoRows.filter((r) => r.pin_id !== pinId);
}

async function deletePin() {
  if (!sheet || sheet.mode !== 'view') return;
  if (!confirm(`Delete "${pinTitle(sheet.pin)}"? This cannot be undone.`)) return;

  const id = sheet.pin.id;

  // The parking spot goes with it, and it has to go FIRST and by hand.
  //
  // The database cascades the child row on its own — that part is fine. What it
  // cannot do is reach into the storage bucket. Its photo rows would vanish in
  // the cascade while the objects stayed behind, unfindable and so undeletable
  // for ever: exactly the trap described below, reached through the back door.
  const park = parkingFor(id);
  if (park) await erasePinPhotos(park.id);

  // Photos go FIRST, and deliberately. The rows cascade when the pin goes, but
  // the objects in the bucket do not, and the permission to delete someone
  // else's photo off your pin is checked against a pin that still exists. Kill
  // the pin first and those files are unreachable and undeletable forever.
  await erasePinPhotos(id);

  const sent = await push({ op: 'delete', id });

  // The notes cascade in the database; this just keeps the mirror honest.
  for (const n of notes.filter((n) => n.pin_id === id)) await local.deleteNote(n.id);
  notes = notes.filter((n) => n.pin_id !== id);

  markers.get(id)?.remove();
  markers.delete(id);
  // The child cascaded on the server; the mirror and the map have to be told.
  if (park) {
    markers.get(park.id)?.remove();
    markers.delete(park.id);
    await local.deletePin(park.id);
    for (const n of notes.filter((n) => n.pin_id === park.id)) await local.deleteNote(n.id);
    notes = notes.filter((n) => n.pin_id !== park.id);
  }
  pins = pins.filter((p) => p.id !== id && p.id !== park?.id);
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

  paintAvatars($('notes-list'));

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
  const name = n.display_name || n.username || 'someone';
  const who = escapeHtml(name);
  const mine = n.created_by === me.id;

  const head = `<div class="note-head">
      ${avatarHtml(n.created_by, name, 'avatar-sm')}
      <b>${who}</b><span>${fmtDate(n.created_at)}${
        wasEdited(n) ? ` &middot; edited ${fmtDate(n.updated_at)}` : ''}</span>
      ${mine && editingNote !== n.id ? `
        <button class="note-photo" data-photo="${n.id}">photo</button>
        <button class="note-photo" data-edit="${n.id}">edit</button>
        <button class="note-del" data-id="${n.id}" aria-label="Delete note">${
          icon('i-close', 'icon-sm')}</button>` : ''}
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
    ${n._pending ? `<span class="note-warn">${icon('i-alert', 'icon-sm')}not synced yet</span>` : ''}
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
 * the repo is public and which counties get searched is location data.
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
  openPanel('sources');
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
  badge.innerHTML = n ? `${icon('i-sync', 'icon-sm')}${n} unsynced` : '';
  badge.hidden = !n;
  document.body.classList.toggle('is-offline', !online());
  $('net').innerHTML = online() ? '' : `${icon('i-offline', 'icon-sm')}offline`;
  $('net').hidden = online();
}

/* ── parking ─────────────────────────────────────────────────────────────
 * The place you came for is usually not somewhere you can drive to, and the
 * gap between the two is where trips go wrong: the pull-off is unmarked, the
 * gate is a mile before the trailhead, the obvious wide spot is somebody's
 * drive.
 *
 * So a parking spot is a PIN, hanging off the pin it serves. It gets a name, a
 * photo of the gate, and its own running log — "washed out in March" is exactly
 * the kind of thing you need to know about a pull-off and exactly the kind of
 * thing two columns on the parent could never hold. Everything a pin already
 * knows how to do it does for free, privacy and the offline queue included.
 *
 * The database enforces the rest: one level deep, same owner, and privacy taken
 * from the parent whether the client remembers or not.
 */
const isParking = (p) => !!p?.parent_id;
const placePins = () => pins.filter((p) => !p.parent_id);
const parkingFor = (pinId) => pins.find((p) => p.parent_id === pinId);

/* Where "directions" should actually send you. The parking spot if there is
 * one — that is the entire point of having asked for it. */
function navTarget(pin) {
  const park = pin ? parkingFor(pin.id) : null;
  return park || pin;
}

function renderParking() {
  const pin = sheet?.pin;
  const block = $('park-block');
  // A parking spot does not get a parking spot, and a pin that is not saved yet
  // has nothing for one to hang off.
  if (!pin || sheet.mode !== 'view' || isParking(pin)) { block.hidden = true; return; }
  block.hidden = false;

  const mine = pin.created_by === me.id;
  const park = parkingFor(pin.id);

  $('park-set').hidden = !park;
  $('park-clear').hidden = !park || !mine;
  // Only the finder sets it — a parking spot is part of the pin, and the pin is
  // theirs. Everyone else reads it, which is the half that matters out there.
  $('park-add').hidden = !!park || !mine;
  $('park-none').hidden = !!park || mine;

  if (park) {
    $('park-name').textContent = park.name?.trim() || 'the parking spot';
    const away = metresBetween({ lat: park.lat, lng: park.lng }, { lat: pin.lat, lng: pin.lng });
    $('park-meta').textContent =
      `${fmtDistance(away)} from the pin, in a straight line`;
  }
}

/* Picking the spot. The crosshair is already how this app says "this exact
 * point", so this borrows it rather than inventing a second gesture, and the
 * confirm goes on the floor of the screen instead of in a dialog over the map
 * you are trying to read. */
let parkPick = null;      // { forPin } while choosing

function startParkPick() {
  const pin = sheet?.pin;
  if (!pin) return;
  parkPick = { forPin: pin };
  closeSheet();
  $('park-pick').hidden = false;
  $('crosshair').classList.remove('is-offset');
  $('crosshair').hidden = false;
  // Start over the pin itself: the pull-off is near the place, so the fewest
  // drags from here is almost always the right answer.
  map.easeTo({ center: [pin.lng, pin.lat], zoom: Math.max(map.getZoom(), 15) });
}

function cancelParkPick() {
  const pin = parkPick?.forPin;
  parkPick = null;
  $('park-pick').hidden = true;
  $('crosshair').hidden = true;
  if (pin) openPin(pin);
}

async function confirmParkPick() {
  const pin = parkPick?.forPin;
  if (!pin) return;
  const c = map.getCenter();
  parkPick = null;
  $('park-pick').hidden = true;
  $('crosshair').hidden = true;
  await createParking(pin, c.lat, c.lng);
  openPin(pin);
}

async function createParking(pin, lat, lng) {
  const row = {
    id: crypto.randomUUID(),
    created_by: me.id,
    parent_id: pin.id,
    name: '',
    description: '',
    lat, lng,
    accuracy_m: null,
    kind: 'other',
    // Sent for the sake of the mirror this device keeps; the database forces it
    // from the parent regardless, which is what actually makes it safe.
    is_private: !!pin.is_private,
    created_at: new Date().toISOString(),
  };
  const shown = { ...row, username: me.username, display_name: me.display_name };
  const sent = await push({ op: 'insert', row });
  if (!sent) shown._pending = true;

  pins.unshift(shown);
  await local.putPin(shown);
  addMarker(shown);
  drawParkLine();
  toast(sent ? 'parking saved' : 'parking saved — will sync when you have signal');
}

async function clearParking() {
  const pin = sheet?.pin;
  const park = pin && parkingFor(pin.id);
  if (!park) return;
  if (!confirm('Remove the parking spot? Its notes and photos go with it.')) return;
  await push({ op: 'delete', id: park.id });
  pins = pins.filter((p) => p.id !== park.id);
  await local.deletePin(park.id);
  markers.get(park.id)?.remove();
  markers.delete(park.id);
  drawParkLine();
  renderParking();
  toast('parking removed');
}

/* ── getting there ───────────────────────────────────────────────────────── */

/* Three apps, because which one is right is a fact about the person and not
 * about the phone: Waze on an iPhone is a perfectly ordinary preference, and
 * guessing Apple Maps from the user agent — which is what this used to do —
 * gets it wrong for exactly the people who care most. */
const NAV_APPS = {
  google: { label: 'Google Maps', url: (lat, lng) =>
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving` },
  apple:  { label: 'Apple Maps',  url: (lat, lng) =>
    `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d` },
  waze:   { label: 'Waze',        url: (lat, lng) =>
    `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` },
};

let navFor = null;      // the point waiting on a choice of app

function openDirections() {
  if (!sheet) return;
  const to = navTarget(sheet.pin);
  navFor = { lat: to.lat, lng: to.lng };

  const saved = navApp;
  if (saved && NAV_APPS[saved]) { launchNav(saved); return; }
  $('nav-remember').checked = true;
  $('nav-pick').hidden = false;
}

/* The button has to say where it is actually going to send you, or the first
 * time it opens a pull-off half a mile from the pin it reads as a bug. */
function renderDirectionsLabel() {
  const pin = sheet?.pin;
  const park = pin && !isParking(pin) ? parkingFor(pin.id) : null;
  $('pin-directions-label').textContent = park
    ? 'directions to the parking spot'
    : 'directions to this place';
}

/* Settings shows which app is remembered, and lets it be taken back — an
 * "always" that cannot be undone is a trap, not a preference. */
function renderNavChoice() {
  const el = $('nav-current');
  if (!el) return;
  el.textContent = navApp && NAV_APPS[navApp]
    ? NAV_APPS[navApp].label
    : 'asked each time';
  const clear = $('nav-clear');
  if (clear) clear.hidden = !navApp;
}

function launchNav(key) {
  const app = NAV_APPS[key];
  const to = navFor;
  navFor = null;
  $('nav-pick').hidden = true;
  if (!app || !to) return;
  window.open(app.url(to.lat, to.lng), '_blank', 'noopener');
}

async function chooseNav(key) {
  if (!NAV_APPS[key]) return;
  // Remembered on the account, so the phone and the laptop agree — and
  // changeable in settings, because "always" is a promise this has to keep.
  if ($('nav-remember').checked) { navApp = key; await savePref('navApp', key); }
  renderNavChoice();
  launchNav(key);
}

async function copyCoords() {
  if (!sheet) return;
  const text = fmtCoords(sheet.pin.lat, sheet.pin.lng);
  try { await navigator.clipboard.writeText(text); toast('location copied'); }
  catch { prompt('Copy these:', text); }
}

/* ── all pins ────────────────────────────────────────────────────────────── */

/* ── the list ────────────────────────────────────────────────────────────
 * This is the closest thing ATLAS has to a feed, and what it is for is not
 * "find a pin by name" — it is somebody handing you a place and you deciding
 * whether you want to go. So a row has to answer that: what does it look like,
 * what is it, who found it, has anyone been since, and how far is it.
 *
 * It used to be a name, an author, a date and a pair of coordinates. Nobody has
 * ever decided to drive somewhere because of its longitude.
 */

/* Sorted by the last thing that HAPPENED rather than the day it was dropped.
 * Someone leaving a note on a two-year-old pin means somebody just went there,
 * which is news, and news is the entire point of a feed. */
function lastActivity(p) {
  const times = notes.filter((n) => n.pin_id === p.id)
    .map((n) => new Date(n.created_at).getTime());
  return Math.max(new Date(p.created_at).getTime() || 0, ...times, 0);
}

function releaseListUrls() {
  listGen++;
  listUrls.forEach(URL.revokeObjectURL);
  listUrls = [];
}

/* The pin's own photo if it has one, otherwise whatever a note carries — for
 * deciding whether to go, any picture of the place beats none. */
const listPhoto = (pinId) => pinOnlyPhotos(pinId)[0] || photosForPin(pinId)[0] || null;

function listRow(p, here, why = null) {
  const its = notes.filter((n) => n.pin_id === p.id);
  const desc = (p.description || '').trim().split('\n')[0];
  const away = here ? metresBetween(here, p) : null;
  const photo = listPhoto(p.id);

  // Whose it is, said as plainly as it can be said. Three people share this
  // map; when every row is a name in the same grey you cannot scan for "what
  // did Silas find", which is most of what you open this screen to do. And
  // yours says "you", which no colour or badge conveys as quickly.
  const mine = p.created_by === me.id;
  const name = p.display_name || p.username || 'someone';
  const who = mine ? 'you' : name;

  // The time shown is the time the list is SORTED by, or the sort looks broken:
  // a pin found a month ago sitting at the top because somebody left a note on
  // it yesterday has to say so, not say "1mo ago".
  const bits = [`<b>${escapeHtml(who)}</b>`, escapeHtml(kindLabel(kindOf(p)))];
  if (its.length) {
    const last = its.reduce((a, b) => (a.created_at > b.created_at ? a : b));
    bits.push(`${its.length} note${its.length > 1 ? 's' : ''}`);
    bits.push(`last ${fmtAgo(last.created_at)}`);
  } else {
    bits.push(`found ${fmtAgo(p.created_at)}`);
  }

  return `<button class="list-row" data-pin="${p.id}">
    <div class="r-thumb" data-kind="${kindOf(p)}"${photo ? ` data-thumb="${photo.id}"` : ''}>
      ${icon(photo ? 'i-image' : 'i-pin')}
      ${avatarHtml(p.created_by, name, 'avatar-badge')}
    </div>
    <div class="r-text">
      <div class="r-top">
        <div class="r-name">${escapeHtml(pinTitle(p))}${
          p.is_private ? ' <span class="tag-private">personal</span>' : ''}${
          p._pending ? ' <span class="dot-pending"></span>' : ''}</div>
        ${away != null ? `<div class="r-away">${fmtDistance(away)}</div>` : ''}
      </div>
      ${desc ? `<div class="r-desc">${escapeHtml(desc)}</div>` : ''}
      ${why ? `<div class="r-why">&ldquo;${escapeHtml(why)}&rdquo;</div>` : ''}
      <div class="r-sub">${bits.join(' &middot; ')}</div>
    </div>
    ${icon('i-chevron', 'r-go')}
  </button>`;
}

/* ── search ──────────────────────────────────────────────────────────────
 * One box, two questions, and keeping them apart is the whole design.
 *
 * Every pin is already on the phone, so they are searched on every
 * keystroke, for free, in a canyon. Everywhere else — towns, creeks, forest
 * roads, wilderness areas — belongs to somebody else's index and costs a
 * request over cell data, so it waits for you to stop typing and for there to
 * be a real word to ask about.
 */

function openSearch() {
  // Always back to half, however far it was pushed last time. Where the sheet
  // was left is an answer to the last question, not to this one.
  setListFrac(LIST_HALF);
  openPanel('list');
  renderResults();
  // The bar you pressed was a search bar, so the thing you meant to do next was
  // type. Delayed past the panel's own entrance or iOS scrolls it mid-animation.
  setTimeout(() => $('q').focus(), 140);
}

function closeSearch() {
  $('q').blur();          // take the keyboard with it
  closePanel('list', releaseListUrls);
}

function onQuery() {
  query = $('q').value;
  $('q-clear').hidden = !query;
  renderResults();          // the pins are free and instant
  schedulePlaces();         // the rest of the world is neither
  searchBarLabel();
}

function searchBarLabel() {
  const q = query.trim();
  const bar = $('search-open');
  $('search-open-label').textContent = q || 'search places, roads and pins';
  bar.classList.toggle('is-set', !!q);
}

function clearQuery() {
  $('q').value = '';
  onQuery();
  $('q').focus();
}

/* Nominatim asks for no more than one request a second and no bulk use. This is
 * where that promise is kept: nothing is sent until you pause, nothing is sent
 * for a fragment too short to mean anything, and a request whose query has
 * already moved on is aborted rather than left to arrive and overwrite the
 * answer to a question you are no longer asking. */
function schedulePlaces() {
  clearTimeout(placeTimer);
  placeAsk?.abort();
  placeAsk = null;

  const q = query.trim();
  if (!sources.places || q.length < MIN_QUERY) {
    places = [];
    placeState = 'idle';
    renderResults();
    return;
  }
  if (!online()) {
    places = [];
    placeState = 'offline';
    renderResults();
    return;
  }

  placeState = 'asking';
  renderResults();
  placeTimer = setTimeout(() => askPlaces(q), 350);
}

/* Nominatim's usage policy is an absolute maximum of one request a second, and
 * this is the one place in the app that could break it — the fallback below
 * fires two in a row. So every request goes through here, and here waits. */
let lastAsk = 0;

async function politeFetch(url, ctl) {
  const wait = Math.max(0, 1100 - (Date.now() - lastAsk));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  if (ctl.signal.aborted) return [];
  lastAsk = Date.now();

  const res = await fetch(url, { signal: ctl.signal });
  if (!res.ok) throw new Error(String(res.status));
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

/* Where the search is asked from, and it is a ranking rather than a setting.
 * Being told where you are beats a town you typed in once, which beats wherever
 * the map happens to be pointing — that could be somewhere you were only
 * looking at. Everything downstream reads `from` to say which it got, because a
 * list ordered by distance is a lie if it does not say distance from what. */
function originNow() {
  const at = meMarker?.getLngLat();
  const c = map?.getCenter();
  return searchOrigin({
    here: at ? { lat: at.lat, lng: at.lng } : null,
    home,
    centre: c ? { lat: c.lat, lng: c.lng } : null,
  });
}

/* The piece of ground on screen, as Nominatim wants it. Null before the map
 * exists, which every caller has to survive — search can be open on the first
 * paint. */
function viewNow() {
  const b = map?.getBounds();
  return b ? viewboxFromBounds({
    west: b.getWest(), north: b.getNorth(), east: b.getEast(), south: b.getSouth(),
  }) : null;
}

async function askPlaces(q) {
  const ctl = new AbortController();
  placeAsk = ctl;
  widened = false;

  try {
    const origin = originNow();
    const view = viewNow();

    let rows = await politeFetch(searchUrlForScope(q, scope, { origin, view }), ctl);
    if (ctl.signal.aborted) return;

    // Only "near" widens, and only when it came back with nothing. Asking for
    // what is around here and being told about a canyon in Utah is the right
    // answer to a question you would obviously ask next; asking for what is IN
    // THIS VIEW and being handed the whole country is the control not working.
    if (!rows.length && scope === 'near' && origin) {
      widened = true;
      rows = await politeFetch(placeSearchUrl(q, { viewbox: view }), ctl);
    }
    if (ctl.signal.aborted) return;

    // Ranked by where you are rather than by how famous a thing is, and the
    // same object listed three times listed once.
    places = dedupePlaces(rankPlaces(normalisePlaces(rows), origin));
    placeState = 'done';
  } catch (err) {
    if (ctl.signal.aborted || err?.name === 'AbortError') return;
    places = [];
    placeState = 'failed';
  }

  if (placeAsk === ctl) placeAsk = null;
  renderResults();
}

/* The pins, ranked. With nothing typed this is the old list — everything,
 * newest activity first — because the list of places and the results of an
 * empty search are the same list, which is why there is only one screen now. */
function matchedPins() {
  // Places only. A parking spot is reached through the pin it serves — it has
  // no business being a result in its own right, sitting in the list next to
  // the thing it is fifty metres from.
  const rows = placePins().filter(passesFilter);
  const q = terms(query);

  if (!q.length) {
    return rows
      .sort((a, b) => lastActivity(b) - lastActivity(a))
      .map((p) => ({ pin: p, why: null }));
  }

  const out = [];
  for (const p of rows) {
    const mine = p.created_by === me.id;
    const name = p.display_name || p.username || 'someone';
    const scored = scorePin({
      name: pinTitle(p),
      description: p.description || '',
      kind: kindLabel(kindOf(p)),
      // Your own pins answer to "you" as well as to your name, because that is
      // what the row itself says and it is what people type.
      author: mine ? `you ${name}` : name,
      notes: notes.filter((nt) => nt.pin_id === p.id).map((nt) => nt.body),
    }, q);
    if (scored) out.push({ pin: p, why: scored.why, score: scored.score });
  }

  return out.sort((a, b) => b.score - a.score || lastActivity(b.pin) - lastActivity(a.pin));
}

function renderResults() {
  releaseListUrls();
  const gen = listGen;
  const q = query.trim();

  // Where you are, if the app has been told. Never asked for on opening this:
  // it is the one screen you might read on the sofa.
  const at = meMarker?.getLngLat();
  const here = at ? { lat: at.lat, lng: at.lng } : null;

  const hits = sources.pins ? matchedPins() : [];
  const html = [];

  if (sources.pins) {
    html.push(`<div class="result-head">our pins<b>${hits.length}</b></div>`);
    html.push(hits.length
      ? hits.map(({ pin, why }) => listRow(pin, here, why)).join('')
      : `<div class="list-empty">${icon('i-pin')}<span>${
          q ? 'No pin says that — try the map below.'
            : placePins().length ? 'Nothing of those kinds. Turn some back on.'
                          : 'No pins yet. Go find something.'}</span></div>`);
  }

  if (sources.places) {
    // The scope belongs to this half of the answer and to nothing else — your
    // own pins are all on the phone and there is no sense in which some of them
    // are further away than the search can reach.
    const origin = originNow();
    html.push(`<div class="result-head">areas &amp; roads${
      placeState === 'done' ? `<b>${places.length}</b>` : ''}</div>`);
    html.push(scopeBar(origin));
    html.push(placesHtml(q, origin));
  }

  const body = $('list-body');
  body.innerHTML = html.join('');
  const total = placePins().length;
  $('list-count').textContent = q ? '' : (total ? `${hits.length} of ${total}` : '');
  $('kind-bar').hidden = !sources.pins;

  paintAvatars(body);

  // Thumbnails after the markup, same rule as the sheet's strips: a blob that
  // arrives after the list has moved on must not paint into a live row.
  body.querySelectorAll('[data-thumb]').forEach((el) => {
    const row = photoRows.find((r) => r.id === el.dataset.thumb);
    if (!row) return;
    photoBlob(row).then((blob) => {
      if (gen !== listGen || !blob) return;
      const url = URL.createObjectURL(blob);
      listUrls.push(url);
      el.style.backgroundImage = `url("${url}")`;
      el.classList.add('is-loaded');
    });
  });
}

/* Which ground the question covers. Three chips rather than a guess, because
 * the three questions are genuinely different and nothing in the words you type
 * tells them apart: "spring" near me, "spring" in this canyon and "spring"
 * anywhere are three answers and all three are somebody's real question.
 *
 * The near chip is named after what it will actually measure from, because "near
 * me" with location switched off is a promise the app cannot keep. */
function scopeName(key, origin) {
  if (key === 'view') return 'in this view';
  if (key === 'anywhere') return 'anywhere';
  if (origin?.from === 'you') return 'near me';
  if (origin?.from === 'home') return `near ${home?.name || 'home'}`;
  return 'near here';
}

function scopeBar(origin) {
  return `<div class="scope-bar" role="radiogroup" aria-label="where to search">${
    SCOPES.map((key) => `<button class="scope-chip${key === scope ? ' is-on' : ''}"
      role="radio" aria-checked="${key === scope}" data-scope="${key}"
      >${escapeHtml(scopeName(key, origin))}</button>`).join('')}</div>`;
}

function setScope(key) {
  if (!SCOPES.includes(key) || key === scope) return;
  scope = key;
  savePref('scope', scope);
  schedulePlaces();   // renders on its way through, whatever state it lands in
}

/* Half of this is states rather than results, and every one of them says which
 * it is. "Nothing found" and "could not ask" look identical as an empty list,
 * and out there the difference is the whole answer. */
function placesHtml(q, origin) {
  const note = (name, text) =>
    `<p class="result-note">${icon(name, 'icon-sm')}<span>${text}</span></p>`;

  if (q.length < MIN_QUERY) {
    return note('i-search', q
      ? 'Keep typing — a word or two is enough.'
      : 'Type a name and the map is searched too: towns, creeks, peaks, forest roads.');
  }
  if (placeState === 'offline') return note('i-offline', 'No signal, so only your own pins can be searched.');
  if (placeState === 'asking')  return note('i-search', 'looking…');
  if (placeState === 'failed')  return note('i-alert', 'Could not reach the map index. Try again in a moment.');
  if (!places.length) {
    return note('i-map', scope === 'view'
      ? 'Nothing by that name on the piece of map you are looking at.'
      : 'Nothing on the map by that name.');
  }

  // Say when the answer is not to the question asked. A near search that came
  // back empty and quietly showed the whole country looks like the scope chip
  // doing nothing.
  const widenedNote = widened
    ? note('i-map', `Nothing ${escapeHtml(scopeName('near', origin))} — showing everywhere instead.`)
    : '';
  return widenedNote + places.map((pl) => placeRow(pl, origin)).join('');
}

function placeRow(pl, origin) {
  const sub = [pl.type, pl.detail].filter(Boolean).map(escapeHtml).join(' &middot; ');
  // The same number a pin row carries, measured from the same place the list is
  // sorted by — a list in distance order with no distances on it is a list you
  // have to take on trust.
  const away = origin ? metresBetween(origin, pl) : null;
  return `<button class="place-row" data-place="${escapeHtml(pl.id)}">
    <span class="p-mark">${icon(isArea(pl) ? 'i-layers' : 'i-map')}</span>
    <div class="r-text">
      <div class="r-top">
        <div class="r-name">${escapeHtml(pl.name)}</div>
        ${away != null ? `<div class="r-away">${fmtDistance(away)}</div>` : ''}
      </div>
      ${sub ? `<div class="r-sub">${sub}</div>` : ''}
    </div>
    ${icon('i-chevron', 'r-go')}
  </button>`;
}

/* An area is flown to as a box and a point as a point. A wilderness area framed
 * as a point drops you in the middle of it at street zoom with no idea how big
 * it is, and a gate framed as a box is the whole county. */
function goToPlace(pl) {
  closeSearch();
  showFound(pl);
  if (isArea(pl) && pl.bounds) {
    map.fitBounds(pl.bounds, { padding: 56, maxZoom: 15, duration: 900 });
  } else {
    map.flyTo({ center: [pl.lng, pl.lat], zoom: 15, duration: 900 });
  }
}

/* Deliberately not a pin. A pin is somewhere one of you has been and written up;
 * this is a name off an index, and it stands on the map with its name beside it
 * until you look for something else or tap it away. */
function showFound(pl) {
  foundMarker?.remove();
  const el = document.createElement('div');
  el.className = 'found-marker';
  el.title = pl.name;
  el.innerHTML = `<span class="found-dot"></span>`
    + `<span class="found-label">${escapeHtml(pl.name)}</span>`;
  el.addEventListener('click', (e) => { e.stopPropagation(); clearFound(); });
  foundMarker = new maplibregl.Marker({ element: el, anchor: 'left' })
    .setLngLat([pl.lng, pl.lat]).addTo(map);
}

function clearFound() {
  foundMarker?.remove();
  foundMarker = null;
}

function setSource(which, on) {
  sources[which] = !!on;
  // Both off is a search that cannot answer anything, so the one you just
  // turned off comes back on rather than leaving a blank screen with no way to
  // read why — the same rule the kind filter has.
  if (!sources.pins && !sources.places) sources[which] = true;
  $('src-pins').checked = sources.pins;
  $('src-places').checked = sources.places;
  savePref('sources', sources);
  schedulePlaces();
  renderResults();
}

function onListClick(e) {
  const scopeEl = e.target.closest('[data-scope]');
  if (scopeEl) { setScope(scopeEl.dataset.scope); return; }

  const pinRow = e.target.closest('[data-pin]');
  if (pinRow) {
    const p = pins.find((x) => x.id === pinRow.dataset.pin);
    closeSearch();
    if (p) { map.jumpTo({ center: [p.lng, p.lat], zoom: 15 }); openPin(p); }
    return;
  }

  const placeEl = e.target.closest('[data-place]');
  if (placeEl) {
    const pl = places.find((x) => x.id === placeEl.dataset.place);
    if (pl) goToPlace(pl);
  }
}

/* ── home ────────────────────────────────────────────────────────────────
 * One town, named once, doing two jobs.
 *
 * It is where the map opens when the phone will not say where you are — off on
 * the sofa, off indoors, off before the fix comes in, off for anybody who would
 * rather not be asked — because a map that opens on the middle of the country
 * is a map you fly out of every morning.
 *
 * And it is what "near me" measures from with location off, which is the
 * difference between a brand-name search working and returning a town in
 * Brazil. Your own position still wins whenever there is one; this is the
 * fallback, not a preference.
 */
let homeTimer = null;
let homeAsk   = null;
let homeFound = [];      // the towns the last lookup offered

function renderHome() {
  $('home-set').hidden = !home;
  if (home) {
    $('home-name').textContent = home.name;
    $('home-detail').textContent = home.detail || '';
  }
  $('home-q').placeholder = home ? 'somewhere else' : 'name your town';
}

function homeSaying(text) {
  const el = $('home-note');
  el.textContent = text || '';
  el.hidden = !text;
}

function onHomeQuery() {
  const q = $('home-q').value.trim();
  $('home-q-clear').hidden = !q;
  clearTimeout(homeTimer);
  homeAsk?.abort();
  homeAsk = null;

  if (q.length < MIN_QUERY) {
    renderHomeResults([]);
    homeSaying(q ? 'keep going — a town name is enough' : '');
    return;
  }
  if (!online()) {
    renderHomeResults([]);
    homeSaying('no signal, and a town cannot be looked up from memory');
    return;
  }
  homeSaying('looking…');
  // The same debounce and the same one-a-second queue as the map search: this
  // is the second box in the app that can talk to Nominatim, and the promise
  // made to them is about the app, not about the box.
  homeTimer = setTimeout(() => askHome(q), 350);
}

async function askHome(q) {
  const ctl = new AbortController();
  homeAsk = ctl;
  try {
    // Unbounded and unbiased, unlike every other search in here. Home is the
    // one question that is not about where you are standing — you might be
    // setting it from a hotel three states away, and the index's own ranking
    // by importance is exactly right for "which Springfield".
    const rows = await politeFetch(placeSearchUrl(q, { limit: 6 }), ctl);
    if (ctl.signal.aborted) return;
    const found = dedupePlaces(normalisePlaces(rows));
    renderHomeResults(found);
    homeSaying(found.length ? '' : 'nothing by that name');
  } catch (err) {
    if (ctl.signal.aborted || err?.name === 'AbortError') return;
    renderHomeResults([]);
    homeSaying('could not reach the map index — try again in a moment');
  }
  if (homeAsk === ctl) homeAsk = null;
}

function renderHomeResults(list) {
  homeFound = list || [];
  $('home-results').innerHTML = homeFound.map((pl) => `
    <button class="home-row" data-home="${escapeHtml(pl.id)}">
      <div class="r-text">
        <div class="r-name">${escapeHtml(pl.name)}</div>
        ${pl.detail ? `<div class="r-sub">${escapeHtml(pl.detail)}</div>` : ''}
      </div>
      ${icon('i-chevron', 'r-go')}
    </button>`).join('');
}

function pickHome(pl) {
  home = homeFromPlace(pl);
  if (!home) return;
  savePref('home', home);
  $('home-q').value = '';
  $('home-q-clear').hidden = true;
  renderHomeResults([]);
  homeSaying('');
  renderHome();
  // Deliberately does not fly there. You could be standing at a gate with a
  // live fix, and a settings screen that throws the map three counties away
  // while you are using it is a setting you would not touch twice.
  toast(`home is ${home.name} — the map opens there`);
  if (!$('list').hidden) renderResults();   // the near chip is named after it
}

function clearHome() {
  home = null;
  local.del('home');
  renderHome();
  if (!$('list').hidden) renderResults();
}

/* Instant, never animated. The only caller is the app opening, and a second and
 * a half of flying out of the middle of the country is a second and a half of
 * watching nothing. */
function goHome() {
  const cam = homeCamera(home);
  if (!cam || !map) return false;
  if (cam.bounds) map.fitBounds(cam.bounds, { padding: 40, maxZoom: cam.maxZoom, duration: 0 });
  else map.jumpTo({ center: cam.center, zoom: cam.zoom });
  return true;
}

/* ── the first run ───────────────────────────────────────────────────────
 * Somebody is invited by email, follows the link, chooses a password, and the
 * very next thing they see is this. It is the settings panel wearing a
 * different name rather than a wizard of its own, for three reasons: every
 * control here is one they will want to change later, the room they will have
 * to find to change it is this one, and a wizard is a second copy of a name
 * field and an avatar picker that can drift out of step with the real ones.
 *
 * What it is really for is the location question. ATLAS defaults to asking the
 * phone where you are, and the honest moment to explain that — and to make it
 * one tap to say no — is before the browser's own permission box appears, not
 * after. So while this screen is up the map does not call for a fix, and the
 * opening camera waits for the button at the bottom.
 *
 * Nothing here is compulsory. The button says "open the map" rather than
 * "finish" because there is nothing to finish.
 */
function openFirstRun() {
  firstRun = true;
  $('settings').classList.add('is-first');
  $('settings-title').textContent = 'welcome';
  openPanel('settings');
  refreshLocationState();
}

async function firstRunDone() {
  const btn = $('first-go');
  btn.disabled = true;

  // A name typed and not saved is a name you meant. The button underneath it
  // still says "save name" for the day you come back and change it, but
  // walking out of the door has to count as meaning it too — and if the save
  // cannot happen, the door stays shut with the reason on screen.
  const typed = $('me-name').value.trim();
  if (typed && typed !== me.display_name && !(await saveMyName())) {
    btn.disabled = false;
    return;
  }
  btn.disabled = false;

  // On the account, not on the phone — that is the whole point of it.
  me.setup_done = true;
  await local.set('me', me);
  if (online()) await db.from('profiles').update({ setup_done: true }).eq('id', me.id);
  firstRun = false;
  $('settings').classList.remove('is-first');
  $('settings-title').textContent = 'settings';
  closePanel('settings');

  // The map now opens exactly the way it will open every morning from here,
  // which is the shortest possible proof that the choice just made took.
  if (useLocation) locate({ fly: true }).catch(() => goHome());
  else goHome();
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
    // Some overlays are drawn to order from a bounding box rather than served
    // as tiles. There is nothing to put in a box and take up the mountain.
    if (cfg.noBulk) continue;
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

  // Split what is switched on into what will actually come down and what will
  // not. Listing an overlay that is not in the tile count is the estimate
  // promising something the download cannot deliver, and the place you find
  // that out is the place with no signal.
  const on = [...overlaysOn].map((k) => OVERLAYS[k]);
  const coming = on.filter((o) => !o.noBulk);
  const staying = on.filter((o) => o.noBulk);
  const what = [...(base.noBulk ? [] : [base.label]), ...coming.map((o) => o.label)];

  $('dl-nobulk').hidden = !base.noBulk;
  $('dl-noserve').hidden = !staying.length;
  if (staying.length) {
    const names = staying.map((o) => o.label).join(' and ');
    $('dl-noserve').querySelector('span').textContent =
      `${names} ${staying.length > 1 ? 'are' : 'is'} drawn to order rather than `
      + `served as tiles, so ${staying.length > 1 ? 'they are' : 'it is'} not in that `
      + `number. You keep whatever you have already looked at, and nothing more.`;
  }
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
  setLabel(go, 'cancel');
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
  setLabel(go, 'download this area');
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
  openPanel('maps');
  updateDownloadEstimate();
  refreshStorage();
}

/* ── who everybody else sees ─────────────────────────────────────────────
 * Your display name is on every pin you drop and every note you leave, and
 * until now it was whatever the invite trigger made of your email address —
 * "rmbuster82" title-cased — with no way to change it. On a map three people
 * read, that name is the byline on everything you have ever found.
 *
 * It writes to profiles, which has had an "own profile is editable" policy
 * since the first migration. Only display_name is offered: the username is
 * derived from the sign-in address and other rows point at it.
 */
function renderMe() {
  if (!me) return;
  $('me-name').value = me.display_name || '';
  $('me-user').textContent = me.username || '—';
  $('me-email').textContent = me.email || '—';

  const face = $('me-avatar');
  face.dataset.avatar = me.id || '';
  face.textContent = initialOf(me.display_name || me.username);
  setLabel($('avatar-pick'), me.avatar_path ? 'change photo' : 'add a photo');
  $('avatar-clear').hidden = !me.avatar_path;
  paintAvatars();
}

/* Your picture, the same deal as your name: it changes what everybody else
 * sees, so it either reaches them or it has not happened. Nothing here is
 * queued for later the way a pin is — a face that only landed on your own phone
 * is a lie about what everybody else is looking at, and it would be an awkward lie,
 * because you would be the one person who could not see that it had not worked.
 */
async function setAvatar(file) {
  const err = $('me-error');
  const said = $('me-said');
  err.hidden = true; said.hidden = true;
  if (!me) return;

  if (!online()) { err.textContent = 'this one needs signal'; err.hidden = false; return; }

  const btn = $('avatar-pick');
  btn.classList.add('is-busy');
  try {
    const { blob } = await shrinkSquare(file);
    // A fresh id every time rather than writing over the object: the path is
    // the cache key, on this phone and on everybody else's.
    const path = avatarPath(me.id, crypto.randomUUID());

    const up = await db.storage.from(AVATAR_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (up.error) throw new Error(up.error.message);

    const { error } = await db.from('profiles')
      .update({ avatar_path: path }).eq('id', me.id);
    // The row is what names the object. If it did not land, the upload is a
    // file nothing points at, so take it back out rather than leaving it.
    if (error) {
      await db.storage.from(AVATAR_BUCKET).remove([path]);
      throw new Error(error.message);
    }

    const old = me.avatar_path;
    me.avatar_path = path;
    await local.set('me', me);
    // Cached before anything is drawn, so your own new face appears at once
    // rather than being fetched back down from where it just came from.
    await local.putBlob(`avatar:${path}`, blob);
    await forgetAvatar(old);

    await loadPeople();
    renderMe();
    whoamiChip();
    resetAvatars(me.id);
    if (!$('list').hidden) renderResults();
    if (sheet) renderNotes();
    said.textContent = 'saved';
    said.hidden = false;
  } catch (e) {
    err.textContent = e.message || 'that picture would not upload';
    err.hidden = false;
  } finally {
    btn.classList.remove('is-busy');
  }
}

async function clearAvatar() {
  const err = $('me-error');
  err.hidden = true;
  if (!me?.avatar_path) return;
  if (!online()) { err.textContent = 'this one needs signal'; err.hidden = false; return; }
  if (!confirm('Go back to your initial?')) return;

  const old = me.avatar_path;
  const { error } = await db.from('profiles').update({ avatar_path: null }).eq('id', me.id);
  if (error) { err.textContent = error.message; err.hidden = false; return; }

  // The row goes first here, the opposite way round from a pin photo. There the
  // row is the only record of the object's name; here the name is derived from
  // your own id, so a row cleared before the file is removed leaves nothing
  // stranded — and a file removed before the row would leave every phone
  // pointed at a picture that no longer exists.
  me.avatar_path = null;
  await local.set('me', me);
  await db.storage.from(AVATAR_BUCKET).remove([old]);
  await forgetAvatar(old);

  await loadPeople();
  renderMe();
  whoamiChip();
  resetAvatars(me.id);
  if (!$('list').hidden) renderResults();
  if (sheet) renderNotes();
}

/* A face that is no longer anybody's: drop the copy on the phone and the URL
 * handed out for it, or the old one keeps being drawn from memory. */
async function forgetAvatar(path) {
  if (!path) return;
  const url = avatarUrls.get(path);
  if (url) { URL.revokeObjectURL(url); avatarUrls.delete(path); }
  await local.deleteBlob(`avatar:${path}`);
}

async function onAvatarPick(e) {
  const file = e.target.files?.[0];
  e.target.value = '';                 // so picking the same file twice works
  if (file) await setAvatar(file);
}

async function saveMyName() {
  const err = $('me-error');
  const said = $('me-said');
  err.hidden = true; said.hidden = true;

  const name = $('me-name').value.trim();
  if (!name) { err.textContent = 'put a name in'; err.hidden = false; return false; }
  if (name === me.display_name) { said.textContent = 'no change'; said.hidden = false; return true; }
  // Unlike a pin, this one is not worth queueing: it changes what everybody
  // else sees, so it either reaches them or it has not happened.
  if (!online()) { err.textContent = 'this one needs signal'; err.hidden = false; return false; }

  const btn = $('me-save');
  btn.disabled = true;
  const { error } = await db.from('profiles').update({ display_name: name }).eq('id', me.id);
  btn.disabled = false;
  if (error) { err.textContent = error.message; err.hidden = false; return false; }

  me.display_name = name;
  await local.set('me', me);
  await loadPeople();
  whoamiChip();
  said.textContent = 'saved';
  said.hidden = false;

  // Every byline in the app is drawn from rows the server already sent, so the
  // new name only appears after they are fetched again.
  await loadPins();
  await loadNotes();
  await loadPhotos();
  if (!$('list').hidden) renderResults();
  return true;
}

/* The monogram, kept in one place so signing in and renaming both use it. */
function whoamiChip() {
  const el = $('whoami');
  const name = (me?.display_name || me?.username || '?').trim();
  el.textContent = initialOf(name);
  el.dataset.avatar = me?.id || '';
  el.title = `${name} — settings`;
  el.setAttribute('aria-label', el.title);
  paintAvatars();
}

/* Every source currently drawing on the map, named. Built from the same two
 * tables the layers are built from, so a base map or an overlay added later is
 * credited by existing rather than by somebody remembering to. */
function renderCredits() {
  const bits = [];
  const add = (t) => { if (t && !bits.includes(t)) bits.push(t); };
  add(BASEMAPS[basemap]?.attribution);
  overlaysOn.forEach((k) => add(OVERLAYS[k]?.attribution));
  $('map-credit').innerHTML = bits.map((b) => `<li>${b}</li>`).join('');
}

/* ── settings ─────────────────────────────────────────────────────────────
 * Three preferences, all of them written to the phone rather than to the
 * database: they are about this screen in this light, not about anybody else. Two
 * of them are one attribute on <html> and nothing else — the stylesheet holds
 * the actual values, so there is no palette arithmetic here to drift out of
 * step with what the contrast test measures.
 */
const ACCENTS = ['ember', 'signal', 'moss', 'sky', 'plum'];

function setAccent(name) {
  const key = ACCENTS.includes(name) ? name : 'ember';
  document.documentElement.dataset.accent = key;
  const radio = document.querySelector(`[name="accent"][value="${key}"]`);
  if (radio) radio.checked = true;
  savePref('accent', key);
}

function setGlass(on) {
  // The attribute is only ever present when it is on, so the default costs
  // nothing and a phone that has never opened settings behaves as before.
  if (on) document.documentElement.dataset.glass = 'on';
  else delete document.documentElement.dataset.glass;
  $('glass-toggle').checked = !!on;
  savePref('glass', !!on);
}

/* ── theme ───────────────────────────────────────────────────────────────
 * Bright by default. This gets used outdoors, and a dark UI in direct sun is
 * a mirror. Night mode is a deliberate choice, not the default.
 */

function setTheme(theme) {
  const radio = document.querySelector(`[name="theme"][value="${theme}"]`);
  if (radio) radio.checked = true;
  document.documentElement.dataset.theme = theme;
  // The browser's own chrome follows the app, so a phone does not frame a dark
  // map in a white status bar.
  document.querySelector('meta[name="theme-color"]')
    .setAttribute('content', theme === 'night' ? '#0b0e13' : '#ffffff');
  savePref('theme', theme);
}

/* ── wiring ──────────────────────────────────────────────────────────────── */

$('login-form').addEventListener('submit', handleLogin);
$('newpass-form').addEventListener('submit', setNewPassword);
$('forgot').addEventListener('click', forgotPassword);
// Tapping your own name used to sign you out — a destructive action on the
// smallest target in the app, behind a tooltip nobody reads on a phone. It
// opens settings now, where signing out is a labelled button.
$('whoami').addEventListener('click', () => { openPanel('settings'); renderCredits(); });
$('signout').addEventListener('click', signOut);
$('me-save').addEventListener('click', saveMyName);
$('avatar-pick').addEventListener('click', () => $('avatar-input').click());
$('avatar-input').addEventListener('change', onAvatarPick);
$('avatar-clear').addEventListener('click', clearAvatar);
$('locate-btn').addEventListener('click', () => locate().catch(() => {}));
$('search-open').addEventListener('click', openSearch);
$('list-back').addEventListener('click', closeSearch);
$('q').addEventListener('input', onQuery);
$('q-clear').addEventListener('click', clearQuery);
// Enter takes the first thing on the list, which is the whole point of ranking
// it — punch a name in, hit go, and the map is there.
$('q').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  $('list-body').querySelector('[data-pin], [data-place]')?.click();
});
$('home-q').addEventListener('input', onHomeQuery);
$('home-q-clear').addEventListener('click', () => {
  $('home-q').value = '';
  onHomeQuery();
  $('home-q').focus();
});
$('home-clear').addEventListener('click', clearHome);
$('first-go').addEventListener('click', firstRunDone);
$('home-results').addEventListener('click', (e) => {
  const el = e.target.closest('[data-home]');
  const pl = el && homeFound.find((x) => x.id === el.dataset.home);
  if (pl) pickHome(pl);
});
$('src-pins').addEventListener('change', (e) => setSource('pins', e.target.checked));
$('src-places').addEventListener('change', (e) => setSource('places', e.target.checked));
$('list-body').addEventListener('click', onListClick);
$('sheet-close').addEventListener('click', closeSheet);
$('pin-save').addEventListener('click', savePin);
$('pin-delete').addEventListener('click', deletePin);
$('pin-directions').addEventListener('click', openDirections);
$('park-add').addEventListener('click', startParkPick);
$('park-cancel').addEventListener('click', cancelParkPick);
$('park-confirm').addEventListener('click', confirmParkPick);
$('park-clear').addEventListener('click', clearParking);
$('park-open').addEventListener('click', () => {
  const park = sheet?.pin && parkingFor(sheet.pin.id);
  // Its own sheet, because it is its own pin: name it, photograph the gate,
  // write down that the road was washed out.
  if (park) openPin(park);
});
$('nav-clear').addEventListener('click', async () => {
  navApp = null;
  await savePref('navApp', null);
  renderNavChoice();
  toast('directions will ask again');
});
$('nav-cancel').addEventListener('click', () => { navFor = null; $('nav-pick').hidden = true; });
$('nav-pick').addEventListener('click', (e) => {
  if (e.target === $('nav-pick')) { navFor = null; $('nav-pick').hidden = true; return; }
  const btn = e.target.closest('[data-nav]');
  if (btn) chooseNav(btn.dataset.nav);
});
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
$('own-ask').addEventListener('click', askOwner);
$('own-result').addEventListener('click', onOwnerClick);
$('sources-open').addEventListener('click', () => { closePanel('layers'); openSources(); });
$('sources-close').addEventListener('click', () => closePanel('sources'));
$('sources-list').addEventListener('click', onSourcesClick);
$('src-save').addEventListener('click', addSource);
$('dl-photos').addEventListener('click', cachePhotosOffline);
$('pin-kind').addEventListener('change', (e) => {
  if (e.target.name === 'kind') $('sheet-head').dataset.kind = e.target.value;
});
$('kind-filter').addEventListener('change', (e) => {
  if (e.target.dataset.filter) toggleKind(e.target.dataset.filter, e.target.checked);
});
$('filter-all').addEventListener('click', () => {
  kindFilter = new Set(KIND_KEYS);
  applyFilter();
});
$('settings-btn').addEventListener('click', () => { openPanel('settings'); renderCredits(); });
$('settings-close').addEventListener('click', () => closePanel('settings'));
$('glass-toggle').addEventListener('change', (e) => setGlass(e.target.checked));
document.querySelectorAll('[name="accent"]').forEach((r) =>
  r.addEventListener('change', () => r.checked && setAccent(r.value)));
document.querySelectorAll('[name="theme"]').forEach((r) =>
  r.addEventListener('change', () => r.checked && setTheme(r.value)));

$('layers-btn').addEventListener('click', () => {
  openPanel('layers');
  overlayNotes();     // the note depends on the base map, which may have moved
  refreshLocationState();
});
$('loc-enable').addEventListener('click', () => locate().catch(() => {}));
$('loc-use').addEventListener('change', (e) => setUseLocation(e.target.checked));
$('maps-from-layers').addEventListener('click', () => { closePanel('layers'); openMaps(); });
$('layers-close').addEventListener('click', () => closePanel('layers'));

document.querySelectorAll('[name="basemap"]').forEach((r) =>
  r.addEventListener('change', () => r.checked && setBasemap(r.value)));
document.querySelectorAll('[data-overlay]').forEach((c) =>
  c.addEventListener('change', () => setOverlay(c.dataset.overlay, c.checked)));
$('maps-close').addEventListener('click', () => closePanel('maps'));
$('dl-go').addEventListener('click', downloadArea);
$('dl-clear').addEventListener('click', clearTiles);
$('pending').addEventListener('click', syncQueue);

document.querySelectorAll('[name="detail"]').forEach((r) =>
  r.addEventListener('change', updateDownloadEstimate));

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  // The lightbox sits on top of the sheet, so it gets the first Escape on its
  // own — otherwise closing the photo also closes the pin behind it.
  if (!$('lightbox').hidden) { closeLightbox(); return; }
  // A note open for editing gets the next one on its own, for the same reason:
  // backing out of an edit should not also close the pin.
  if (editingNote) { cancelEditNote(); return; }
  closeSheet();
  if (!$('list').hidden) closeSearch();
  ['maps', 'layers', 'sources', 'settings'].forEach((id) => closePanel(id));
});

/* ── dragging the sheet ──────────────────────────────────────────────────
 * Take the grip and the sheet follows your thumb, then lands on one of three
 * things when you let go: full height for filling a pin in at home, half for
 * looking at the ground while you write about it, or off the bottom.
 *
 * Pointer events rather than touch: the same handful of lines then work for a
 * finger, a trackpad and a stylus, and pointer capture means a fast drag that
 * leaves the grip behind still gets its own pointerup instead of the sheet
 * sticking wherever the finger crossed the edge.
 */
(() => {
  const el = $('sheet');
  const grip = $('sheet-grip');
  let from = 0;
  let base = SHEET_HALF;
  let dragging = false;
  const height = () => $('app').clientHeight || window.innerHeight;

  grip.addEventListener('pointerdown', (e) => {
    dragging = true;
    from = e.clientY;
    base = sheetFrac;
    grip.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
  });

  grip.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    // Down the screen is up in Y and down in height, hence the subtraction.
    setSheetFrac(Math.min(SHEET_FULL, Math.max(0.1, base + (from - e.clientY) / height())));
  });

  const letGo = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    if (sheetFrac < SHEET_GONE) { setSheetFrac(SHEET_HALF); closeSheet(); return; }
    setSheetFrac(sheetFrac > (SHEET_HALF + SHEET_FULL) / 2 ? SHEET_FULL : SHEET_HALF);
    sheetPadding(true);
  };
  grip.addEventListener('pointerup', letGo);
  grip.addEventListener('pointercancel', letGo);
})();

/* ── dragging the results ────────────────────────────────────────────────
 * The same gesture as the pin sheet, on the same grip, landing on one of three
 * stops instead of two — and one thing the pin sheet does not do: taking hold
 * of it puts the keyboard away. A push downwards is a request to see the map,
 * and answering it by moving the sheet down while a keyboard holds the bottom
 * third of the screen is answering half of it.
 */
(() => {
  const el = $('list-sheet');
  const grip = $('list-grip');
  const stops = [LIST_PEEK, LIST_HALF, LIST_FULL];
  let from = 0;
  let base = LIST_HALF;
  let dragging = false;
  const height = () => $('app').clientHeight || window.innerHeight;

  grip.addEventListener('pointerdown', (e) => {
    dragging = true;
    from = e.clientY;
    base = listFrac;
    grip.setPointerCapture(e.pointerId);
    el.classList.add('is-dragging');
    $('q').blur();
  });

  grip.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    setListFrac(Math.min(LIST_FULL, Math.max(0.05, base + (from - e.clientY) / height())));
  });

  const letGo = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    if (listFrac < LIST_GONE) { setListFrac(LIST_HALF); closeSearch(); return; }
    // Nearest of the three, not a pair of thresholds — see LIST_PEEK.
    setListFrac(stops.reduce((best, f) =>
      Math.abs(f - listFrac) < Math.abs(best - listFrac) ? f : best));
  };
  grip.addEventListener('pointerup', letGo);
  grip.addEventListener('pointercancel', letGo);
})();

/* How much of the bottom of the screen the keyboard has taken.
 *
 * iOS does not shrink the window when the keyboard opens — it draws one over
 * the bottom of it — so `100%` keeps saying the same number while a third of
 * the screen stops existing. Everything anchored to the bottom is then behind
 * the keyboard, which for the results sheet means the answers are hidden under
 * the thing you are typing on. visualViewport is the only honest measurement of
 * what is still visible, and offsetTop matters as well as height: the page is
 * scrolled up as well as covered.
 *
 * Nothing here assumes it exists. Where it does not, --kb stays 0 and the sheet
 * sits on the bottom of the window exactly as it did. */
(function trackKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return;
  const set = () => {
    const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--kb', `${Math.round(covered)}px`);
  };
  vv.addEventListener('resize', set);
  vv.addEventListener('scroll', set);
  set();
})();

window.addEventListener('online', () => { refreshNetworkUI(); syncQueue(); });
window.addEventListener('offline', refreshNetworkUI);

/* Painted from whatever this device already knows, before anything is on
 * screen — and run a second time from start() if the server turns out to have a
 * newer answer. Written as one function called twice rather than as a boot path
 * and an update path, because two of them drift and then the phone and the
 * laptop disagree about exactly one setting for a month. */
async function applyPrefs() {
  restoring = true;
  try {
  renderKindControls();
  const savedFilter = await local.get('kindFilter');
  if (Array.isArray(savedFilter) && savedFilter.length) {
    kindFilter = new Set(savedFilter.filter((k) => KIND_KEYS.has(k)));
    if (!kindFilter.size) kindFilter = new Set(KIND_KEYS);
  }
  document.querySelectorAll('[data-filter]').forEach((c) => {
    c.checked = kindFilter.has(c.dataset.filter);
  });

  // Default on, so a phone that has never opened layers behaves as it always
  // did; only an explicit false turns it off.
  setUseLocation((await local.get('useLocation')) !== false);

  // Both of these have to be in hand before the map is built: home decides
  // where it opens, and the scope decides what the first search asks.
  home = await local.get('home');
  renderHome();
  const savedScope = await local.get('scope');
  if (SCOPES.includes(savedScope)) scope = savedScope;

  const savedSources = await local.get('sources');
  if (savedSources && typeof savedSources === 'object') {
    sources = { pins: savedSources.pins !== false, places: savedSources.places !== false };
    if (!sources.pins && !sources.places) sources = { pins: true, places: true };
  }
  $('src-pins').checked = sources.pins;
  $('src-places').checked = sources.places;
  searchBarLabel();

  const savedNav = await local.get('navApp');
  navApp = NAV_APPS[savedNav] ? savedNav : null;
  renderNavChoice();

  setTheme((await local.get('theme')) || 'day');
  setAccent((await local.get('accent')) || 'ember');
  setGlass((await local.get('glass')) === true);
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
  } finally { restoring = false; }
}

/* On a second run the map already exists, so the settings have to be pushed
 * into it rather than merely read into the variables it was built from. */
function reapplyToMap() {
  if (!map) return;
  restoring = true;
  try {
    setBasemap(basemap);
    for (const key of Object.keys(OVERLAYS)) setOverlay(key, overlaysOn.has(key));
  } finally { restoring = false; }
}

(async () => {
  await applyPrefs();
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
