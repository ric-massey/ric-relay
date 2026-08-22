/* ATLAS — local storage layer.
 *
 * Everything here exists so the app works with no signal. Three stores:
 *
 *   pins   — a mirror of what the server had last time we could reach it, so a
 *            cave your brother pinned is still on the map in the canyon.
 *   queue  — writes made with no signal, replayed in order when there is one.
 *   meta   — small odds and ends (who you are, when we last synced).
 */

const DB_NAME = 'atlas';
const DB_VERSION = 1;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const idb = req.result;
      if (!idb.objectStoreNames.contains('pins'))  idb.createObjectStore('pins', { keyPath: 'id' });
      if (!idb.objectStoreNames.contains('queue')) idb.createObjectStore('queue', { keyPath: 'qid', autoIncrement: true });
      if (!idb.objectStoreNames.contains('meta'))  idb.createObjectStore('meta', { keyPath: 'key' });
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

export const local = {
  /* ── pins mirror ── */
  async getPins()      { return (await tx('pins', 'readonly', (s) => s.getAll())) || []; },
  async putPin(pin)    { return tx('pins', 'readwrite', (s) => s.put(pin)); },
  async deletePin(id)  { return tx('pins', 'readwrite', (s) => s.delete(id)); },
  async replacePins(pins) {
    const idb = await open();
    return new Promise((resolve, reject) => {
      const t = idb.transaction('pins', 'readwrite');
      const s = t.objectStore('pins');
      s.clear();
      pins.forEach((p) => s.put(p));
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
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
