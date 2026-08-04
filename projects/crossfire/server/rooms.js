#!/usr/bin/env node
/* CROSSFIRE — room service
   ────────────────────────────────────────────────────────────────────────────
   The game does not need this. Two browsers can still connect by passing codes
   to each other, which is what they do when this isn't running. All this does
   is spare people the pasting: a host claims a word, a guest types the same
   word, and the two connection descriptions are handed over here instead of
   through a chat window.

   It sees no gameplay. Once two peers are connected they talk directly and
   nothing else comes through here — a room is thirty seconds of matchmaking,
   not a server the match depends on.

   ── state ──
   Everything lives in memory and expires. There is no database, nothing is
   written to disk, and restarting throws away every room, which costs nobody
   anything: a room only exists for as long as somebody is sitting in the
   lobby with it open.

   ── running it ──
       node projects/crossfire/server/rooms.js
       tailscale funnel 8787              (in another terminal, to publish it)

   Then put the Funnel hostname into ROOM_SERVICE in the game's index.html.  */

"use strict";

const http = require("node:http");

const PORT = Number(process.env.PORT || 8787);

/* Which sites may talk to this. A browser will refuse to send the request at
   all unless the origin is echoed back, so this is the guest list. */
const ALLOWED = new Set([
  "https://ricmassey.com",
  "https://www.ricmassey.com",
  "https://ric-massey.github.io",
  "http://localhost:8912"          // the local copy of the site, for testing
]);

const ROOM_TTL   = 25_000;   // a room with no heartbeat this long is gone
const JOIN_TTL   = 60_000;   // an unanswered join request expires
const MAX_ROOMS  = 200;
const MAX_JOINS  = 8;        // pending joins per room
const MAX_BODY   = 8 * 1024; // a connection description is ~300 bytes

/* Room words are typed by people and shared out loud, so they are kept to
   something you can say down a phone. */
const WORD_RE = /^[a-z0-9][a-z0-9-]{1,23}$/;
const tidyWord = w => String(w || "").trim().toLowerCase();

/* ── rooms ──────────────────────────────────────────────────────────────── */
const rooms = new Map();      // word → { host, seen, joins: Map(id → join) }

function reap() {
  const now = Date.now();
  for (const [word, room] of rooms) {
    if (now - room.seen > ROOM_TTL) { rooms.delete(word); continue; }
    for (const [id, join] of room.joins) {
      if (now - join.at > JOIN_TTL) room.joins.delete(id);
    }
  }
}
setInterval(reap, 5_000).unref();

/* ── guessing a room word is the only way in, so make guessing slow ─────────
   A leaky bucket per address. Generous enough that nobody playing will ever
   see it, tight enough that walking the dictionary isn't worth starting. */
const buckets = new Map();
const RATE = { size: 30, refillMs: 2_000 };

function allow(ip) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b) { b = { tokens: RATE.size, at: now }; buckets.set(ip, b); }
  b.tokens = Math.min(RATE.size, b.tokens + (now - b.at) / RATE.refillMs);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of buckets) if (now - b.at > 120_000) buckets.delete(ip);
}, 60_000).unref();

/* ── plumbing ───────────────────────────────────────────────────────────── */
function send(res, code, body, origin) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": origin || "null",
    "vary": "origin"
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const parts = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new Error("too big")); req.destroy(); return; }
      parts.push(chunk);
    });
    req.on("end", () => {
      if (!parts.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(parts).toString("utf8"))); }
      catch (_) { reject(new Error("not json")); }
    });
    req.on("error", reject);
  });
}

// Descriptions are opaque here — they're the game's own compact codes, and
// this only checks that they're the right shape and size to be one.
const looksLikeCode = c =>
  typeof c === "string" && c.length > 8 && c.length < 4_000 && /^[\w+/=]+$/.test(c);

const tidyName = n =>
  String(n == null ? "" : n).replace(/[^\p{L}\p{N} '-]/gu, "").trim().slice(0, 12);

let seq = 0;
const newId = () => (++seq).toString(36) + Date.now().toString(36).slice(-4);

/* ── the four things it can do ──────────────────────────────────────────── */
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigin = ALLOWED.has(origin) ? origin : null;

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": allowedOrigin || "null",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
      "vary": "origin"
    });
    return res.end();
  }

  const url = new URL(req.url, "http://x");
  const parts = url.pathname.split("/").filter(Boolean);
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
             req.socket.remoteAddress || "?";

  // Is anybody home? The game asks this before showing the room fields, and
  // shows the paste route instead when it doesn't answer.
  if (req.method === "GET" && parts[0] === "health") {
    return send(res, 200, { ok: true, rooms: rooms.size }, allowedOrigin);
  }

  if (!allow(ip)) return send(res, 429, { error: "slow down" }, allowedOrigin);

  const word = tidyWord(parts[1]);
  if (parts[0] !== "room" || !WORD_RE.test(word)) {
    return send(res, 404, { error: "no such thing" }, allowedOrigin);
  }

  let body = {};
  if (req.method === "POST") {
    try { body = await readBody(req); }
    catch (_) { return send(res, 400, { error: "bad body" }, allowedOrigin); }
  }

  /* Host: claim the word, and collect anybody waiting at the door. One call
     does both, so the host's polling loop is a single request. */
  if (req.method === "POST" && parts[2] === "host") {
    let room = rooms.get(word);
    const me = String(body.key || "");
    if (!me) return send(res, 400, { error: "no key" }, allowedOrigin);

    if (room && room.host !== me && Date.now() - room.seen <= ROOM_TTL) {
      return send(res, 409, { error: "that room name is in use" }, allowedOrigin);
    }
    if (!room) {
      if (rooms.size >= MAX_ROOMS) {
        return send(res, 503, { error: "too many rooms" }, allowedOrigin);
      }
      room = { host: me, seen: 0, joins: new Map(), name: "" };
      rooms.set(word, room);
    }
    room.host = me;
    room.seen = Date.now();
    room.name = tidyName(body.name);

    // Hand over the waiting offers and forget them: the host answers each one
    // and posts the answers back, so nothing needs to be kept here.
    const joins = [];
    for (const [id, join] of room.joins) {
      if (join.offer && !join.taken) {
        join.taken = true;
        joins.push({ id, offer: join.offer, name: join.name });
      }
    }
    return send(res, 200, { ok: true, joins }, allowedOrigin);
  }

  /* Guest: knock, leaving an offer. Everything else is polling for the reply. */
  if (req.method === "POST" && parts[2] === "join") {
    const room = rooms.get(word);
    if (!room || Date.now() - room.seen > ROOM_TTL) {
      return send(res, 404, { error: "nobody is hosting that room" }, allowedOrigin);
    }
    if (!looksLikeCode(body.offer)) {
      return send(res, 400, { error: "bad offer" }, allowedOrigin);
    }
    if (room.joins.size >= MAX_JOINS) {
      return send(res, 503, { error: "that room is busy" }, allowedOrigin);
    }
    const id = newId();
    room.joins.set(id, {
      offer: body.offer, name: tidyName(body.name),
      answer: null, taken: false, at: Date.now()
    });
    return send(res, 200, { ok: true, id, host: room.name }, allowedOrigin);
  }

  /* Host: here is the answer for that knock. */
  if (req.method === "POST" && parts[2] === "answer") {
    const room = rooms.get(word);
    if (!room) return send(res, 404, { error: "gone" }, allowedOrigin);
    if (String(body.key || "") !== room.host) {
      return send(res, 403, { error: "not your room" }, allowedOrigin);
    }
    const join = room.joins.get(String(body.id || ""));
    if (!join) return send(res, 404, { error: "gone" }, allowedOrigin);
    if (!looksLikeCode(body.answer)) {
      return send(res, 400, { error: "bad answer" }, allowedOrigin);
    }
    join.answer = body.answer;
    return send(res, 200, { ok: true }, allowedOrigin);
  }

  /* Guest: is there a reply yet? Once taken, the join is finished with. */
  if (req.method === "GET" && parts[2] === "join" && parts[3]) {
    const room = rooms.get(word);
    if (!room) return send(res, 404, { error: "gone" }, allowedOrigin);
    const join = room.joins.get(parts[3]);
    if (!join) return send(res, 404, { error: "gone" }, allowedOrigin);
    if (!join.answer) return send(res, 200, { waiting: true }, allowedOrigin);
    room.joins.delete(parts[3]);
    return send(res, 200, { answer: join.answer }, allowedOrigin);
  }

  return send(res, 404, { error: "no such thing" }, allowedOrigin);
});

server.listen(PORT, () => {
  console.log(`CROSSFIRE rooms on http://localhost:${PORT}`);
  console.log(`publish it with:  tailscale funnel ${PORT}`);
});
