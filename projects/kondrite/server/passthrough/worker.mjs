/* CROSSFIRE — the old room service, kept alive as a pass-through
   ────────────────────────────────────────────────────────────────────────────
   The game was renamed and the worker with it, so the room service now lives at
   `kondrite-rooms`. A renamed worker is a *new URL*, and a client still asking
   the old one would be looking at a different room list — a host on one and a
   guest on the other simply cannot see each other, with no error anywhere. A
   split room list is worse than an outage because nothing announces it.

   So the old address keeps answering, and everything it is asked it asks the
   new one. Both URLs feed one list. This exists only for as long as somebody
   still has the old page open — see archive/RENAME-KONDRITE.md §2 — and is deleted
   when the logs go quiet.

   ── why a service binding and not a fetch ──
   The obvious version of this file was `fetch("https://kondrite-rooms.…")`, and
   it does not work: a Worker calling another Worker's workers.dev hostname does
   not route, and what comes back is Cloudflare's own "There is nothing here
   yet" page — which this worker then returns, perfectly, to the player. It
   looks exactly like the old worker having been deleted. A **service binding**
   is the supported way for one Worker to call another: it never leaves the
   runtime, so there is no hostname to resolve and no hop to lose the request
   on, and the whole `Request` — method, path, body, Origin, and the address
   below — arrives intact.

   ── why the Durable Object is still declared ──
   Deleting a Durable Object class is a migration against a namespace that
   already exists, and this shim is meant to be temporary and dull. Keeping the
   binding exactly as the old worker had it means deploying this changes the
   *code* and nothing else: same name, same binding, same migration tag. The
   object is never reached, because `fetch` below never asks for it.

   ── the caller's address ──
   `rooms-core.mjs` rate-limits per `cf-connecting-ip`, and the edge sets that
   header on the way in to each worker. A subrequest is not an eyeball, so the
   new worker could reasonably see this one instead of the player — and every
   old client would then share a single token bucket. Forwarding the address we
   were given costs nothing and removes the question: if the runtime sets it
   downstream it was already right, and if it does not, ours is the true one. */

export { RoomList } from "../worker.mjs";

export default {
  fetch(request, env) {
    const out = new Request(request);
    const ip = request.headers.get("cf-connecting-ip");
    if (ip) out.headers.set("cf-connecting-ip", ip);
    return env.NEW.fetch(out);
  }
};
