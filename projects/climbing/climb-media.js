/* CLIMBING — photos and video for a day
   ────────────────────────────────────────────────────────────────────────────
   The bytes live in R2 behind the log service, not in this repo. A send clip is
   tens of megabytes and permanent; git is the wrong shape for that, and Pages
   caps a site at about a gigabyte. The Worker holds the gate and the bucket;
   this is the small client that every page shares.

   Same reason web-trips.js exists rather than living inside the deep log: the
   room page needs the same answer, and a second private copy is how the two
   pages end up disagreeing about what has been recorded.

       await ClimbMedia.load();
       ClimbMedia.of('2026-08-18')      // [{id, kind, src, route, caption, …}]

   Reads are public and never carry a token. Writes go through Owner, which is
   where the password lives — and the Worker is what actually refuses one, so
   nothing here is a security boundary. */
(function (global) {
  /* The location scrub (assets/scrub-media.js), loaded from beside this
     file's own src so every page that uploads gets it without listing it. */
  const SCRUB_SRC = (() => {
    const me = document.currentScript && document.currentScript.src;
    return me ? new URL('../../assets/scrub-media.js', me).href : null;
  })();
  let scrubLoaded = null;
  const loadScrub = () => global.ScrubMedia ? Promise.resolve() : (scrubLoaded = scrubLoaded || new Promise((ok, no) => {
    if (!SCRUB_SRC) return no(new Error('no scrub'));
    const s = document.createElement('script');
    s.src = SCRUB_SRC; s.onload = ok; s.onerror = () => { scrubLoaded = null; no(new Error('no scrub')); };
    document.head.appendChild(s);
  }));

  /* Where a photo was taken goes before it leaves the phone (hard rule 1):
     the file is read and its camera notes dropped, losslessly. HEIC can't be
     edited that way, so it is redrawn as a JPEG, which keeps none of them.
     Resolves to a Blob, or to {error} when the file can't be cleaned — it is
     never sent as it came. */
  async function clean(file, type) {
    try { await loadScrub(); } catch (e) { return { error: 'could not load the location scrub — try again' }; }
    if (type === 'image/heic' || type === 'image/heif') {
      try {
        const bmp = await createImageBitmap(file);
        const c = document.createElement('canvas');
        c.width = bmp.width; c.height = bmp.height;
        c.getContext('2d').drawImage(bmp, 0, 0);
        const jpg = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
        if (jpg) return { blob: jpg, type: 'image/jpeg' };
      } catch (e) {}
      return { error: 'this browser cannot open HEIC — send it as a JPEG' };
    }
    const out = global.ScrubMedia.bytes(type, new Uint8Array(await file.arrayBuffer()));
    if (!out) return { error: 'that file could not be cleaned of its location, so it was not sent' };
    return { blob: new Blob([out], { type }), type };
  }

  /* The Worker hands back a PATH, not a URL — it has no reliable idea of its own
     public name, and under the dev server its origin is one no browser can
     reach. The page knows the host; the page builds the URL. */
  /* The Worker hands back a PATH; the page builds the URL, off whichever
     origin climb-host.js found was answering. */
  const url = rec => ClimbHost.origin() + rec.path;

  let days = {};
  let loaded = null;

  async function load(force) {
    if (loaded && !force) return days;
    loaded = (async () => {
      try {
        const r = await ClimbHost.fetch('/media', { cache: 'no-store' });
        if (!r.ok) return {};
        const body = await r.json();
        return body.days || {};
      } catch (e) {
        /* No signal, or no bucket yet. A climbing log with no thumbnails is the
           right page; an error is not. */
        return {};
      }
    })();
    days = await loaded;
    /* Cached as a value rather than the promise, so a later force-refresh after
       an upload replaces it instead of resolving to the stale one. */
    loaded = Promise.resolve(days);
    return days;
  }

  const of = date => (days[date] || []).map(m => ({ ...m, src: url(m) }));
  const has = date => !!(days[date] && days[date].length);
  /* The one clip a day gets to lead with: first video, else first photo. */
  const feature = date => of(date).find(m => m.kind === 'video') || of(date)[0] || null;

  /* XHR rather than fetch, for one reason: upload progress. A 60MB clip going
     up on a phone with two bars is a thirty-second silence otherwise, and a
     silent thirty seconds is indistinguishable from a hang — which is exactly
     when somebody taps the button again. */
  async function upload(date, file, opts = {}) {
    const token = global.Owner && Owner.token();
    if (!token) return { error: 'not signed in' };
    const cleaned = await clean(file, file.type || byExtension(file.name));
    if (cleaned.error) return { error: cleaned.error };
    return send(date, file.name, cleaned.blob, cleaned.type, token, opts);
  }

  function send(date, name, body, type, token, opts) {
    return new Promise(resolve => {
      const q = new URLSearchParams({ name: name || '' });
      if (opts.route) q.set('route', opts.route);
      if (opts.caption) q.set('caption', opts.caption);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${ClimbHost.origin()}/media/${date}?${q}`);
      xhr.setRequestHeader('authorization', 'Bearer ' + token);
      /* The type decides the extension and whether it is a photo or a video, so
         it has to be the real one. Phones sometimes hand over a blank type for
         a file picked out of the camera roll; fall back to the extension rather
         than sending nothing and being refused. */
      xhr.setRequestHeader('content-type', type);
      if (opts.onProgress) {
        xhr.upload.onprogress = e => e.lengthComputable && opts.onProgress(e.loaded / e.total);
      }
      xhr.onload = () => {
        let body = {};
        try { body = JSON.parse(xhr.responseText); } catch (e) {}
        if (xhr.status !== 200) return resolve({ error: body.error || `upload failed (${xhr.status})` });
        (days[date] || (days[date] = [])).push(body);
        resolve(body);
      };
      xhr.onerror = () => resolve({ error: 'no signal — the upload did not go' });
      xhr.send(body);
    });
  }

  const EXT = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
    mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', webm: 'video/webm'
  };
  const byExtension = name =>
    EXT[String(name || '').split('.').pop().toLowerCase()] || 'application/octet-stream';

  async function remove(date, id) {
    if (!global.Owner || !Owner.on()) return false;
    const out = await Owner.post(`/media/${date}/${id}`, { remove: true });
    if (!out) return false;
    days[date] = (days[date] || []).filter(m => m.id !== id);
    return true;
  }

  /* Which route a photo is of, set after the fact.

     Nothing at a crag asks, so most files arrive without one, and until this
     existed the only way to correct that was to delete the file and upload it
     again — 74MB back up a phone connection to fix a spelling. The label lives
     in the log service rather than on the object, so this is a few dozen bytes
     either way. The local copy is patched too, so the page it was set from
     doesn't have to reload to show it. */
  async function label(date, id, fields) {
    if (!global.Owner || !Owner.on()) return false;
    const out = await Owner.post(`/media/${date}/${id}`, {
      route: String(fields.route || ''),
      caption: String(fields.caption || '')
    });
    if (!out) return false;
    (days[date] || []).forEach(m => {
      if (m.id !== id) return;
      m.route = String(fields.route || '');
      m.caption = String(fields.caption || '');
    });
    return true;
  }

  /* What the file picker should offer. Kept next to the Worker's allowlist on
     purpose — a type accepted here and refused there is a failed upload with no
     explanation, which is the worst version of this to debug on a phone. */
  const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,' +
                 'video/mp4,video/quicktime,video/webm,video/x-m4v,.jpg,.jpeg,.png,.heic,.mov,.mp4,.m4v,.webm';
  const MAX_BYTES = 100 * 1024 * 1024;

  global.ClimbMedia = { host: ClimbHost.origin, load, of, has, feature, upload, remove, label, url, ACCEPT, MAX_BYTES, byExtension };
})(window);
