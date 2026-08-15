/* CROSSFIRE — room service on Cloudflare
   ────────────────────────────────────────────────────────────────────────────
   Plumbing only. Every rule about who may talk to this, what a password is
   worth and when a room dies lives in `rooms-core.mjs`, which this shares with
   the laptop runner in `rooms.js`.

   ── why a Durable Object ──
   A Worker is not one program. Cloudflare runs it in as many isolates as it
   likes, wherever the request landed, and two of them share no memory — so a
   room opened in London would simply not exist for a guest whose request woke
   an isolate in Dallas. A Durable Object is the opposite promise: one named
   instance, one place, one copy of the list. `idFromName("crossfire")` names
   the only one there is, so every host and every guest in the world is looking
   at the same list. It sits in one region and distant lobby polls cross an
   ocean to reach it, which nobody will feel while picking a game off a list —
   and the match itself never comes near it.

   ── why it never writes anything down ──
   A Durable Object has SQLite attached and this uses none of it. Rooms are
   worth twenty-five seconds each and are rebuilt by the host's next heartbeat,
   so persisting them would buy nothing and spend the free plan's daily write
   allowance on data that is stale by the time it lands. Being evicted while
   idle costs an empty list, which is the same thing a restart has always cost.
   The class still has to be declared with the SQLite backend in the Wrangler
   config — that is what makes it free-plan eligible, not what makes it write. */

import { createRooms } from "./rooms-core.mjs";

export class RoomList {
  constructor() {
    this.rooms = createRooms();
  }

  fetch(request) {
    /* On Cloudflare this header is set by the edge and cannot be forged by the
       caller, which is what makes the rate limiter behind it worth having. The
       laptop runner works its own address out, because there nothing upstream
       has earned that trust by default. */
    const ip = request.headers.get("cf-connecting-ip") || "?";
    return this.rooms.handle(request, ip);
  }
}

export default {
  fetch(request, env) {
    return env.ROOMS.get(env.ROOMS.idFromName("crossfire")).fetch(request);
  }
};
