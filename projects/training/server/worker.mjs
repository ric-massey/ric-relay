/* TRAINING — the log service on Cloudflare
   ────────────────────────────────────────────────────────────────────────────
   Stores which sessions got done and the notes written against them. Nothing
   else. The plan itself is a static file (assets/training-plan.json) served
   from Pages, so this never holds a schedule, a venue or a rota — only ticks
   and prose, keyed by date.

       cd projects/training/server
       npx wrangler@latest secret put LOG_TOKEN     # once, pick something long
       npx wrangler@latest deploy

   ── why the whole security model is one token ──
   Pages is static and the repo is public, so there is no such thing as a secret
   in the page and no "is this Ric" check written in JavaScript is worth
   anything — anyone can edit their own copy. The gate therefore has to sit
   somewhere the public cannot read, which is here. The page is free to render
   whatever controls it likes; a write without the token gets a 401 and nothing
   happens. That is why the client is allowed to be naive.

   ── why a Durable Object, and why it differs from crossfire-rooms ──
   Same reason as Crossfire — a Worker is many isolates and they share no
   memory, so a tick written in one would not exist for the next reader. The
   difference is that this one actually WRITES to its SQLite storage, because
   unlike a lobby list a training log is worth keeping. The volume is a handful
   of writes a day from one person, which sits far inside the free plan. */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/* Constant-time compare. A plain === leaks the length of the matching prefix
   through timing, which is a real if slow way to recover a token. */
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* Reads are public by design, so the origin is echoed rather than policed —
   CORS is not what protects the writes, the token is. */
const cors = origin => ({
  'access-control-allow-origin': origin || '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-max-age': '86400'
});

const json = (body, status, origin, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cors(origin), ...extra }
  });

/* Notes default to public — the deliberate choice for this log — so the filter
   removes only what was explicitly marked private. */
const publicView = entry => ({
  done: entry.done || {},
  ticks: entry.ticks || {},
  notes: (entry.notes || []).filter(n => n.public !== false).map(({ id, text, at }) => ({ id, text, at })),
  updated: entry.updated || null
});

export class TrainingLog {
  /* A Durable Object is handed the environment at construction, which is where
     the token comes from. It is never sent to the client and never logged. */
  constructor(state, env) {
    this.state = state;
    this.token = env.LOG_TOKEN || '';
    /* Timestamps of recent failed attempts. In memory rather than storage on
       purpose: there is exactly one instance of this object, so a plain array
       is a global counter, and losing it when the object is evicted is fine —
       an attacker cannot cause an eviction and a restart costs nothing. */
    this.fails = [];
  }

  /* Wrong passwords get slower. Ten failures in five minutes and everything
     stops accepting them for the rest of that window.

     Why this matters: a static site cannot hide the API, so anybody can throw
     guesses at it forever. Without a limit, a short password falls in hours.
     With it, the ceiling is ~2,880 guesses a day against however long the
     password is — which is nothing at 20 random characters and still not much
     at 12. The password should still be long; this stops it being the only
     thing standing there.

     Ten is generous for a human typo and brutal for a script, and a lockout is
     the same five minutes for the owner, which is the right trade for a page
     that ticks boxes. */
  throttled() {
    const now = Date.now(), WINDOW = 5 * 60 * 1000, LIMIT = 10;
    this.fails = this.fails.filter(t => now - t < WINDOW);
    return this.fails.length >= LIMIT;
  }
  noteFail() { this.fails.push(Date.now()); }

  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const parts = url.pathname.split('/').filter(Boolean);   // ['log'] | ['log','2026-08-16']
    const date = parts[1];

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });

    const bearer = () => {
      const a = request.headers.get('authorization') || '';
      return a.startsWith('Bearer ') ? a.slice(7) : '';
    };
    /* Every failed credential check — a bad password on /auth or a bad bearer
       token on any write — counts toward the same limit. Checking them
       separately would leave the write path as an unthrottled oracle.

       A CORRECT credential is never refused, throttle or no throttle. Two
       reasons, and the second is the important one:

       1. On a read, refusing the owner does not deny an attacker anything —
          they were getting the public view regardless — it just silently
          empties Ric's own private notes and returns 200, which reads as data
          loss rather than as a lockout.
       2. If a right password could be locked out, then anybody in the world
          could lock Ric out of his own site indefinitely by hammering /auth
          with rubbish. That is a denial of service handed out for free, in
          exchange for delaying a guesser who is already bounded by the counter.

       The rate limit's job is to cap how fast WRONG guesses can be made. It is
       not to punish the person who knows the password. */
    const authed = () => {
      const given = bearer();
      if (!given) return false;
      if (this.token && sameSecret(given, this.token)) return true;
      this.noteFail();
      return false;
    };

    /* ---------- POST /auth ----------
       The password IS the token; this endpoint only exists so the page can say
       "wrong password" the moment it is typed rather than silently failing on
       the first tick an hour later. It returns nothing but a yes or a no. */
    if (parts[0] === 'auth') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);
      let body = {};
      try { body = await request.json(); } catch {}
      const given = String(body.password || '');
      /* Correctness first, so the right password works even mid-lockout —
         see the note on authed() above for why that matters more than it
         looks. Only wrong guesses meet the throttle. */
      if (given && this.token && sameSecret(given, this.token)) {
        return json({ ok: true }, 200, origin);
      }
      if (this.throttled()) {
        return json({ error: 'too many attempts — wait five minutes' }, 429, origin,
          { 'retry-after': '300' });
      }
      /* A wrong password is a 401 with no detail — not "too short", not "close",
         nothing that narrows the search. */
      this.noteFail();
      return json({ error: 'nope' }, 401, origin);
    }

    /* ---------- /climb/:date ----------
       Climbing days added from the web, as opposed to the ones built from
       climbs.md. Both end up on the climbing page; these are the ones that can
       be written from a phone at the crag. Public to read, token to write. */
    if (parts[0] === 'climb') {
      if (date && !DAY.test(date)) return json({ error: 'date must be YYYY-MM-DD' }, 400, origin);

      if (request.method === 'GET') {
        if (date) {
          const e = await this.state.storage.get('c:' + date);
          return json(e || null, 200, origin, { 'cache-control': 'public, max-age=30' });
        }
        const all = await this.state.storage.list({ prefix: 'c:' });
        const out = {};
        for (const [k, v] of all) out[k.slice(2)] = v;
        return json({ days: out }, 200, origin, { 'cache-control': 'public, max-age=30' });
      }

      if (request.method === 'POST') {
        if (!date) return json({ error: 'POST needs a date: /climb/YYYY-MM-DD' }, 400, origin);
        if (!authed()) return json({ error: 'nope' }, 401, origin);

        let body;
        try { body = await request.json(); } catch { return json({ error: 'body must be JSON' }, 400, origin); }

        /* Deleting a day is a POST with no routes and no area — a phone at a
           crag should not need a second verb to fix a mistake. */
        if (body.remove === true) {
          await this.state.storage.delete('c:' + date);
          return json({ ok: true, removed: date }, 200, origin);
        }

        const entry = {
          date,
          area: String(body.area || '').slice(0, 120),
          notes: String(body.notes || '').slice(0, 2000),
          people: String(body.people || '').slice(0, 200),
          routes: Array.isArray(body.routes) ? body.routes.slice(0, 200).map(r => ({
            name: String(r.name || '').slice(0, 160),
            grade: String(r.grade || '').slice(0, 24),
            outcome: ['sent', 'attempt', 'repeat'].includes(r.outcome) ? r.outcome : 'sent'
          })).filter(r => r.name) : [],
          source: 'web',
          updated: new Date().toISOString()
        };
        if (!entry.area && !entry.routes.length) {
          return json({ error: 'a day needs at least an area or one route' }, 400, origin);
        }
        await this.state.storage.put('c:' + date, entry);
        return json({ ok: true, ...entry }, 200, origin);
      }

      return json({ error: 'method not allowed' }, 405, origin);
    }

    if (parts[0] !== 'log') return json({ error: 'not found' }, 404, origin);
    if (date && !DAY.test(date)) return json({ error: 'date must be YYYY-MM-DD' }, 400, origin);

    /* ---------- read ----------
       Public by default, but the owner reading with a token gets the private
       notes back. Without this the author cannot see his own private notes:
       he writes one, reloads, and it is gone — filtered by the same rule that
       protects it from everyone else. A note you cannot re-read is a note you
       will stop writing. Caching therefore has to be private on this path. */
    if (request.method === 'GET') {
      const isOwner = authed();
      const view = e => isOwner ? { done: e.done || {}, ticks: e.ticks || {}, notes: e.notes || [], updated: e.updated || null }
                                : publicView(e);
      const cache = isOwner ? 'private, no-store' : 'public, max-age=30';

      if (date) {
        const entry = await this.state.storage.get('d:' + date);
        return json(entry ? view(entry) : { done: {}, ticks: {}, notes: [], updated: null }, 200, origin,
          { 'cache-control': cache });
      }
      /* The whole log. One person ticking boxes for a year is a small map, and
         the public page wants it in one request so a month view is instant. */
      const all = await this.state.storage.list({ prefix: 'd:' });
      const out = {};
      for (const [k, v] of all) out[k.slice(2)] = view(v);
      return json({ days: out }, 200, origin, { 'cache-control': cache });
    }

    /* ---------- write: token only ---------- */
    if (request.method === 'POST') {
      if (!date) return json({ error: 'POST needs a date: /log/YYYY-MM-DD' }, 400, origin);

      if (!authed()) return json({ error: 'nope' }, 401, origin);

      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'body must be JSON' }, 400, origin); }

      const prev = (await this.state.storage.get('d:' + date)) || { done: {}, ticks: {}, notes: [] };

      /* Merge rather than replace: the phone and the laptop both write, and a
         tick made on one should not be erased by a stale view from the other. */
      const entry = {
        done:  { ...prev.done,  ...(body.done  && typeof body.done  === 'object' ? body.done  : {}) },
        ticks: { ...prev.ticks, ...(body.ticks && typeof body.ticks === 'object' ? body.ticks : {}) },
        notes: Array.isArray(body.notes) ? body.notes.slice(0, 50).map(n => ({
          id: String(n.id || crypto.randomUUID()).slice(0, 64),
          text: String(n.text || '').slice(0, 4000),
          public: n.public !== false,
          at: String(n.at || new Date().toISOString()).slice(0, 32)
        })) : (prev.notes || []),
        updated: new Date().toISOString()
      };

      await this.state.storage.put('d:' + date, entry);
      /* Echo the OWNER's view — this response only ever reaches a caller who
         already proved the token, and it is what the page re-renders from.
         Returning the filtered view here would make a private note vanish the
         instant it was written. */
      return json({ ok: true, date, done: entry.done, ticks: entry.ticks, notes: entry.notes, updated: entry.updated }, 200, origin);
    }

    return json({ error: 'method not allowed' }, 405, origin);
  }
}

export default {
  fetch(request, env) {
    /* One named instance, one place, one copy of the log — the same reason
       crossfire-rooms names its object. Every device writing ticks is talking
       to the same one. */
    return env.LOG.get(env.LOG.idFromName('training')).fetch(request);
  }
};
