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

const db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

/* Read this before supabase-js consumes and clears the hash. An invite link and
 * a password-reset link both drop you here already signed in, and both should
 * land on "choose your password" rather than the map. */
const LINK_TYPE = new URLSearchParams(location.hash.replace(/^#/, '')).get('type');

const $ = (id) => document.getElementById(id);
const IS_APPLE = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
const TILE_CACHE = 'atlas-tiles-v1';
const BYTES_PER_TILE = 28 * 1024;   // measured: Esri ~20 KB, USGS/OSM ~32 KB

let map       = null;
let me        = null;    // { id, username, display_name }
let pins      = [];      // every pin the crew has dropped
let markers   = new Map();
let meMarker  = null;
let sheet     = null;    // { mode: 'new' | 'view', pin }
let basemap   = 'sat';
let download  = null;    // { cancel: bool } while an area download runs

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
  topo: {
    label: 'USGS topo',
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    attribution: 'USGS The National Map',
    maxzoom: 16,
  },
  street: {
    label: 'street',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxzoom: 19,
  },
};

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
  $('whoami').textContent = me.username;

  if (!map) initMap();
  await loadPins();
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
    locate({ silent: true, fly: true });
  });
  map.on('moveend', () => {
    const c = map.getCenter();
    local.set('lastView', { center: [c.lng, c.lat], zoom: map.getZoom() });
  });
}

function wireLongPress() {
  const canvas = map.getCanvasContainer();
  let timer = null, startPt = null;

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startPt = { x: t.clientX, y: t.clientY };
    timer = setTimeout(() => {
      const rect = canvas.getBoundingClientRect();
      const ll = map.unproject([startPt.x - rect.left, startPt.y - rect.top]);
      openNewPin(ll.lat, ll.lng, null);
      if (navigator.vibrate) navigator.vibrate(30);
    }, 600);
  }, { passive: true });

  const cancel = (e) => {
    if (e?.touches?.length === 1 && startPt) {
      const t = e.touches[0];
      // A little drift is still a press; a real drag is a pan.
      if (Math.hypot(t.clientX - startPt.x, t.clientY - startPt.y) < 12) return;
    }
    clearTimeout(timer);
  };
  canvas.addEventListener('touchmove', cancel, { passive: true });
  canvas.addEventListener('touchend', cancel, { passive: true });
  canvas.addEventListener('touchcancel', cancel, { passive: true });
}

function setBasemap(key) {
  basemap = key;
  for (const k of Object.keys(BASEMAPS)) {
    map.setLayoutProperty(`base-${k}`, 'visibility', k === key ? 'visible' : 'none');
  }
  document.querySelectorAll('[data-basemap]').forEach((b) => {
    b.classList.toggle('is-on', b.dataset.basemap === key);
  });
  local.set('basemap', key);
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
    return pos;
  } catch (err) {
    if (!silent) toast(geoMessage(err), true);
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

function drawPins() {
  markers.forEach((m) => m.remove());
  markers.clear();
  pins.forEach(addMarker);
}

function addMarker(p) {
  const el = document.createElement('div');
  el.className = 'pin-marker'
    + (p.created_by === me.id ? ' is-mine' : '')
    + (p._pending ? ' is-pending' : '');
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

/* ── the sheet ───────────────────────────────────────────────────────────── */

function openNewPin(lat, lng, accuracy) {
  sheet = { mode: 'new', pin: { lat, lng, accuracy_m: accuracy ?? null } };
  $('pin-name').value = '';
  $('pin-desc').value = '';
  $('pin-name').disabled = false;
  $('pin-desc').disabled = false;
  $('pin-save').hidden = false;
  $('pin-save').textContent = 'save pin';
  $('pin-delete').hidden = true;
  $('pin-meta').innerHTML = metaHtml(sheet.pin, null);
  $('sheet').hidden = false;
  setTimeout(() => $('pin-name').focus(), 80);
}

function openPin(p) {
  sheet = { mode: 'view', pin: p };
  const mine = p.created_by === me.id;
  $('pin-name').value = p.name || '';
  $('pin-desc').value = p.description || '';
  $('pin-name').disabled = !mine;
  $('pin-desc').disabled = !mine;
  $('pin-save').hidden = !mine;
  $('pin-save').textContent = 'save changes';
  $('pin-delete').hidden = !mine;
  $('pin-meta').innerHTML = metaHtml(p, p.display_name || p.username);
  $('sheet').hidden = false;
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
  return `${head}<br>${fmtCoords(p.lat, p.lng)}${acc}${pending}`;
}

function closeSheet() {
  $('sheet').hidden = true;
  $('pin-save').hidden = false;
  sheet = null;
}

async function savePin() {
  if (!sheet) return;
  const btn = $('pin-save');
  btn.disabled = true;

  const fields = {
    name: $('pin-name').value.trim(),
    description: $('pin-desc').value.trim(),
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
    id: crypto.randomUUID(),
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
  if (el) { el.title = pinTitle(p); el.classList.toggle('is-pending', !!p._pending); }
  closeSheet();
  toast(sent ? 'saved' : 'saved on this phone — will sync later');
  refreshNetworkUI();
}

async function deletePin() {
  if (!sheet || sheet.mode !== 'view') return;
  if (!confirm(`Delete "${pinTitle(sheet.pin)}"? This cannot be undone.`)) return;

  const id = sheet.pin.id;
  const sent = await push({ op: 'delete', id });

  markers.get(id)?.remove();
  markers.delete(id);
  pins = pins.filter((p) => p.id !== id);
  await local.deletePin(id);
  closeSheet();
  toast(sent ? 'deleted' : 'deleted here — will sync later');
  refreshNetworkUI();
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
  try { await navigator.clipboard.writeText(text); toast('coords copied'); }
  catch { prompt('Copy these:', text); }
}

/* ── all pins ────────────────────────────────────────────────────────────── */

function openList() {
  const body = $('list-body');
  body.innerHTML = pins.length ? pins.map((p) => `
    <button class="list-row" data-pin="${p.id}">
      <div class="r-name">${escapeHtml(pinTitle(p))}${p._pending ? ' <span class="dot-pending"></span>' : ''}</div>
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
  const cfg = BASEMAPS[basemap];
  return tileUrlsForBounds(
    { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() },
    minZoom,
    Math.min(maxZoom, cfg.maxzoom),
    cfg.url,
  );
}

const maxZoomChoice = () => parseInt(
  document.querySelector('[name="detail"]:checked')?.value || '16', 10);

function updateDownloadEstimate() {
  if ($('maps').hidden || !map) return;
  const n = tilesForView(9, maxZoomChoice()).length;
  $('dl-estimate').innerHTML =
    `<b>${n.toLocaleString()}</b> tiles &middot; about <b>${fmtSize(n * BYTES_PER_TILE)}</b>
     of ${escapeHtml(BASEMAPS[basemap].label)}`;
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

async function refreshStorage() {
  const est = await navigator.storage?.estimate?.();
  if (!est) return;
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  $('dl-storage').innerHTML =
    `using <b>${fmtSize(est.usage)}</b> of ${fmtSize(est.quota)} available`
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
$('maps-btn').addEventListener('click', openMaps);
$('maps-close').addEventListener('click', () => { $('maps').hidden = true; });
$('dl-go').addEventListener('click', downloadArea);
$('dl-clear').addEventListener('click', clearTiles);
$('pending').addEventListener('click', syncQueue);
$('theme-btn').addEventListener('click', () =>
  setTheme(document.documentElement.dataset.theme === 'night' ? 'day' : 'night'));

document.querySelectorAll('[data-basemap]').forEach((b) =>
  b.addEventListener('click', () => setBasemap(b.dataset.basemap)));
document.querySelectorAll('[name="detail"]').forEach((r) =>
  r.addEventListener('change', updateDownloadEstimate));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeSheet(); $('list').hidden = true; $('maps').hidden = true; }
});

window.addEventListener('online', () => { refreshNetworkUI(); syncQueue(); });
window.addEventListener('offline', refreshNetworkUI);

// Restore preferences before anything paints.
(async () => {
  setTheme((await local.get('theme')) || 'day');
  const saved = await local.get('basemap');
  if (saved && BASEMAPS[saved]) basemap = saved;
  document.querySelectorAll('[data-basemap]').forEach((b) =>
    b.classList.toggle('is-on', b.dataset.basemap === basemap));
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
