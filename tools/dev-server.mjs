/* ══════════════════════════════════════════════════════════════════════
   dev-server.mjs — a static server that does not cache.

   `python3 -m http.server` sends Last-Modified and nothing else. With no
   Cache-Control and no ETag the browser falls back to heuristic freshness,
   and for ES modules that is quietly disastrous: the module graph is keyed
   by URL, so a stale hit means the page runs *old code* while the file on
   disk is new, through reloads, through hard reloads, and through a
   changed query string on the HTML — because the imports inside it resolve
   to the same unchanged URLs either way.

   That failure mode costs more than it sounds like it should, because it
   does not look like a caching problem. It looks like your change did not
   work. The symptom is a correct edit, a passing test suite, and a browser
   calmly demonstrating the old behaviour.

   So: no-store on everything, and a 404 that says what was not found.
   This is a development server. It is never what serves the real site.

   Usage:  node tools/dev-server.mjs [port]
   ══════════════════════════════════════════════════════════════════════ */

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const ROOT = resolve(process.argv[2] ?? ".");
const PORT = Number(process.env.PORT ?? process.argv[3] ?? 8642);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".zip": "application/zip",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end("bad path");
    return;
  }

  // Contain the path inside the root. `normalize` collapses the `..`
  // segments; the prefix check is what makes that a guarantee rather than
  // an assumption.
  let file = normalize(join(ROOT, pathname));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403).end("outside the root");
    return;
  }

  try {
    let info = await stat(file);
    if (info.isDirectory()) {
      file = join(file, "index.html");
      info = await stat(file);
    }
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
      "Content-Length": info.size,
      // The entire point of this file.
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" })
      .end(`404 — no such file: ${pathname}\n`);
  }
});

server.listen(PORT, () => {
  console.log(`serving ${ROOT} on http://localhost:${PORT} — caching disabled`);
});
