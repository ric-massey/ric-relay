#!/usr/bin/env node
/* CROSSFIRE — room service, on a laptop
   ────────────────────────────────────────────────────────────────────────────
   Plumbing only. Every rule about who may talk to this, what a password is
   worth and when a room dies lives in `rooms-core.mjs`, which this shares with
   the Cloudflare Worker in `worker.mjs`. This file exists so that working on
   the service needs nothing installed: no account, no wrangler, no network.

   ── running it ──
       node projects/crossfire/server/rooms.js

   Then point the game at it without editing anything:

       http://localhost:8912/projects/crossfire/?rooms=http://localhost:8787

   Deploying is a different file. See README.md.                             */

"use strict";

const http = require("node:http");

const PORT = Number(process.env.PORT || 8787);
const TRUST_PROXY = process.env.TRUST_PROXY === "1";

// Well above anything the core will accept, so an oversized body is refused
// there — with the same 400 everything else malformed gets — rather than being
// a special case here. This cap only stops one from being held in memory.
const READ_CAP = 64 * 1024;

/* Forwarded headers are controlled by the caller unless this service sits
   behind a proxy we deliberately trust. A single trusted reverse proxy appends
   the real client address at the right-hand end of X-Forwarded-For. On
   Cloudflare none of this applies: the edge sets an address the caller cannot
   touch, and `worker.mjs` reads that instead. */
function clientIp(req) {
  const peer = req.socket.remoteAddress || "?";
  if (!TRUST_PROXY) return peer;
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",").map(value => value.trim()).filter(Boolean);
  return forwarded[forwarded.length - 1] || peer;
}

function readRaw(req) {
  return new Promise(resolve => {
    let size = 0;
    const parts = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > READ_CAP) { req.destroy(); return; }
      parts.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(parts)));
    req.on("error", () => resolve(Buffer.alloc(0)));
  });
}

async function main() {
  const { createRooms } = await import("./rooms-core.mjs");
  const rooms = createRooms();

  const server = http.createServer(async (req, res) => {
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const body = hasBody ? await readRaw(req) : null;

    const request = new Request(new URL(req.url, "http://rooms.local"), {
      method: req.method,
      headers: req.headers,
      body: body && body.length ? body : undefined
    });

    let out;
    try {
      out = await rooms.handle(request, clientIp(req));
    } catch (error) {
      console.error(error);
      out = new Response(JSON.stringify({ error: "broke" }), {
        status: 500, headers: { "content-type": "application/json" }
      });
    }

    const headers = {};
    for (const [k, v] of out.headers) headers[k] = v;
    res.writeHead(out.status, headers);
    res.end(Buffer.from(await out.arrayBuffer()));
  });

  server.listen(PORT, () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : PORT;
    console.log(`CROSSFIRE rooms on http://localhost:${port}`);
    console.log(`point the game at it with:  ?rooms=http://localhost:${port}`);
  });
}

main();
