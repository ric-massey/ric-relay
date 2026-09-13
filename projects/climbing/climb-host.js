/* CLIMBING — which log service actually answers
   ────────────────────────────────────────────────────────────────────────────
   web-trips.js, climb-media.js and web-todo.js each held their own copy of this
   and add.html held a fourth, which is how the Add page ended up posting /auth
   at a static file server: three of the four had learned the localhost lesson
   and one had not.

       await ClimbHost.fetch('/climb', { cache: 'no-store' });
       ClimbHost.origin()            // right after the first fetch
       await ClimbHost.resolved()    // right before it too

   On localhost a Worker may be running locally, so that is tried first — but a
   plain static dev server answers /climb and /media with a 404, and for a long
   time that silently meant every day logged from a phone was invisible in local
   preview. The page looked finished and was months out of date. So localhost is
   a preference, not a rule. */
(function (global) {
  const LIVE = 'https://training-log.rmbuster82.workers.dev';
  const LOCAL = global.location.origin.includes('localhost');
  let HOST = LOCAL ? global.location.origin : LIVE;
  let probing = null;

  async function call(path, init) {
    if (!LOCAL) return fetch(LIVE + path, init);
    try {
      const r = await fetch(global.location.origin + path, init);
      if (r.ok) { HOST = global.location.origin; return r; }
    } catch (e) { /* nothing listening locally; fall through */ }
    HOST = LIVE;
    return fetch(LIVE + path, init);
  }

  /* origin() is only right AFTER something has asked — before the first call it
     is still the guess. Anything that needs the answer up front (signing in
     posts /auth at it) awaits this, which probes once and hands every later
     caller the same origin. */
  async function resolved() {
    if (!LOCAL) return LIVE;
    if (!probing) probing = call('/climb', { cache: 'no-store' }).then(() => HOST, () => HOST);
    return probing;
  }

  global.ClimbHost = { fetch: call, origin: () => HOST, resolved, LIVE };
})(window);
