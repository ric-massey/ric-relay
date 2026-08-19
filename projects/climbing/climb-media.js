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
  const HOST = global.location.origin.includes('localhost')
    ? global.location.origin
    : 'https://training-log.rmbuster82.workers.dev';

  /* The Worker hands back a PATH, not a URL — it has no reliable idea of its own
     public name, and under the dev server its origin is one no browser can
     reach. The page knows the host; the page builds the URL. */
  const url = rec => HOST + rec.path;

  let days = {};
  let loaded = null;

  async function load(force) {
    if (loaded && !force) return days;
    loaded = (async () => {
      try {
        const r = await fetch(HOST + '/media', { cache: 'no-store' });
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
  function upload(date, file, opts = {}) {
    return new Promise(resolve => {
      const token = global.Owner && Owner.token();
      if (!token) return resolve({ error: 'not signed in' });

      const q = new URLSearchParams({ name: file.name || '' });
      if (opts.route) q.set('route', opts.route);
      if (opts.caption) q.set('caption', opts.caption);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${HOST}/media/${date}?${q}`);
      xhr.setRequestHeader('authorization', 'Bearer ' + token);
      /* The type decides the extension and whether it is a photo or a video, so
         it has to be the real one. Phones sometimes hand over a blank type for
         a file picked out of the camera roll; fall back to the extension rather
         than sending nothing and being refused. */
      xhr.setRequestHeader('content-type', file.type || byExtension(file.name));
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
      xhr.send(file);
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

  /* What the file picker should offer. Kept next to the Worker's allowlist on
     purpose — a type accepted here and refused there is a failed upload with no
     explanation, which is the worst version of this to debug on a phone. */
  const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,' +
                 'video/mp4,video/quicktime,video/webm,video/x-m4v,.jpg,.jpeg,.png,.heic,.mov,.mp4,.m4v,.webm';
  const MAX_BYTES = 100 * 1024 * 1024;

  global.ClimbMedia = { HOST, load, of, has, feature, upload, remove, url, ACCEPT, MAX_BYTES, byExtension };
})(window);
