/* ATLAS — local storage layer.
 *
 * Everything here exists so the app works with no signal. Six stores:
 *
 *   pins   — a mirror of what the server had last time we could reach it, so a
 *            cave your brother pinned is still on the map in the canyon.
 *   notes  — the same, for the running log on each pin.
 *   photos — the same, for the photo index. The rows, not the images.
 *   blobs  — the images themselves, keyed by photo id. A photo you have looked
 *            at once, or pulled down before leaving, is yours out there.
 *   queue  — writes made with no signal, replayed in order when there is one.
 *   meta   — small odds and ends (who you are, when we last synced).
 */

const DB_NAME = 'atlas';
const DB_VERSION = 2;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const idb = req.result;
      // Additive only, and every store guarded — upgrading from v1 must not
      // throw away the pins someone is carrying around offline.
      if (!idb.objectStoreNames.contains('pins'))  idb.createObjectStore('pins', { keyPath: 'id' });
      if (!idb.objectStoreNames.contains('queue')) idb.createObjectStore('queue', { keyPath: 'qid', autoIncrement: true });
      if (!idb.objectStoreNames.contains('meta'))  idb.createObjectStore('meta', { keyPath: 'key' });
      if (!idb.objectStoreNames.contains('notes')) {
        idb.createObjectStore('notes', { keyPath: 'id' }).createIndex('pin', 'pin_id');
      }
      if (!idb.objectStoreNames.contains('photos')) {
        idb.createObjectStore('photos', { keyPath: 'id' }).createIndex('pin', 'pin_id');
      }
      if (!idb.objectStoreNames.contains('blobs')) idb.createObjectStore('blobs', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then((idb) => new Promise((resolve, reject) => {
    const t = idb.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    const r = fn(s);
    if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

/* Swap the whole contents of a store for a fresh copy from the server, in one
 * transaction — a half-replaced mirror is worse than a stale one. */
function replaceAll(store, rows) {
  return open().then((idb) => new Promise((resolve, reject) => {
    const t = idb.transaction(store, 'readwrite');
    const s = t.objectStore(store);
    s.clear();
    rows.forEach((row) => s.put(row));
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  }));
}

const byPin = (store, pinId) =>
  tx(store, 'readonly', (s) => s.index('pin').getAll(pinId)).then((r) => r || []);

export const local = {
  /* ── pins mirror ── */
  async getPins()      { return (await tx('pins', 'readonly', (s) => s.getAll())) || []; },
  async putPin(pin)    { return tx('pins', 'readwrite', (s) => s.put(pin)); },
  async deletePin(id)  { return tx('pins', 'readwrite', (s) => s.delete(id)); },
  async replacePins(pins) { return replaceAll('pins', pins); },

  /* ── notes mirror ── */
  async getNotes()       { return (await tx('notes', 'readonly', (s) => s.getAll())) || []; },
  async notesFor(pinId)  { return byPin('notes', pinId); },
  async putNote(note)    { return tx('notes', 'readwrite', (s) => s.put(note)); },
  async deleteNote(id)   { return tx('notes', 'readwrite', (s) => s.delete(id)); },
  async replaceNotes(rows) { return replaceAll('notes', rows); },

  /* ── photo index mirror ── */
  async photosFor(pinId) { return byPin('photos', pinId); },
  async getPhotos()      { return (await tx('photos', 'readonly', (s) => s.getAll())) || []; },
  async putPhoto(row)    { return tx('photos', 'readwrite', (s) => s.put(row)); },
  async deletePhoto(id)  { return tx('photos', 'readwrite', (s) => s.delete(id)); },
  async replacePhotos(rows) { return replaceAll('photos', rows); },

  /* ── the images themselves ── */
  async getBlob(id)      { const r = await tx('blobs', 'readonly', (s) => s.get(id)); return r ? r.blob : null; },
  async hasBlob(id)      { return (await tx('blobs', 'readonly', (s) => s.count(id))) > 0; },
  async putBlob(id, blob) { return tx('blobs', 'readwrite', (s) => s.put({ id, blob })); },
  async deleteBlob(id)   { return tx('blobs', 'readwrite', (s) => s.delete(id)); },
  async blobIds()        { return (await tx('blobs', 'readonly', (s) => s.getAllKeys())) || []; },
  async blobBytes() {
    const rows = (await tx('blobs', 'readonly', (s) => s.getAll())) || [];
    return rows.reduce((n, r) => n + (r.blob?.size || 0), 0);
  },

  /* ── write queue ── */
  async enqueue(op)      { return tx('queue', 'readwrite', (s) => s.add({ ...op, at: Date.now() })); },
  async queued()         { return (await tx('queue', 'readonly', (s) => s.getAll())) || []; },
  async dequeue(qid)     { return tx('queue', 'readwrite', (s) => s.delete(qid)); },
  async queueCount()     { return (await tx('queue', 'readonly', (s) => s.count())) || 0; },

  /* ── meta ── */
  async get(key)         { const r = await tx('meta', 'readonly', (s) => s.get(key)); return r ? r.value : null; },
  async set(key, value)  { return tx('meta', 'readwrite', (s) => s.put({ key, value })); },
};
