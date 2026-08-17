/* TRAINING — local stand-in for the log service
   ────────────────────────────────────────────────────────────────────────────
   Serves the site AND the log API from one origin, so training.html can be
   exercised end to end without deploying anything or holding a real token.

       node projects/training/server/dev.mjs
       open http://localhost:8799/training.html?key=local-dev-token

   The token below is a fixture, not a secret — it only ever unlocks this
   in-memory server, which forgets everything when you stop it. The real one
   lives in Cloudflare and is never in this repo.

   The Durable Object class is imported from worker.mjs rather than reimplemented,
   so what you exercise here is the same code that gets deployed. Only the
   storage is swapped, for a Map. */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TrainingLog } from './worker.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PORT = 8799;
const TOKEN = 'local-dev-token';

const mem = new Map();
const log = new TrainingLog({
  storage: {
    get: async k => mem.get(k),
    put: async (k, v) => { mem.set(k, v); },
    delete: async k => { mem.delete(k); },
    list: async ({ prefix }) => new Map([...mem].filter(([k]) => k.startsWith(prefix)))
  }
}, { LOG_TOKEN: TOKEN });

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg'
};

createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);

  /* DEV_OFFLINE=1 serves the site but kills the API, which is the only way to
     rehearse the case that actually matters on a phone: the page loads fine and
     the log is unreachable. A total blackout is untestable through a browser —
     the HTML would not arrive either — so this is the realistic half. */
  if (process.env.DEV_OFFLINE && /^\/(log|climb|auth)\b/.test(u.pathname)) {
    res.socket.destroy();               // hang up, exactly like no signal
    return;
  }

  /* Every route the Worker owns. Keep this in step with worker.mjs — a path
     missing here falls through to the static handler and 404s, which looks
     exactly like a Worker bug and is not one. */
  if (/^\/(log|climb|auth)\b/.test(u.pathname)) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const r = await log.fetch(new Request('https://local' + u.pathname, {
      method: req.method,
      headers: req.headers,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {})
    }));
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }

  const p = u.pathname === '/' ? '/index.html' : u.pathname;
  try {
    const buf = await readFile(join(ROOT, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}).listen(PORT, () => {
  console.log(`site + log api  →  http://localhost:${PORT}/training.html`);
  console.log(`owner mode      →  http://localhost:${PORT}/training.html?key=${TOKEN}`);
});
