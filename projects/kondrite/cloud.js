/* KONDRITE — the account, and the book kept in it
   ────────────────────────────────────────────────────────────────────────────
   Survey has always saved. What it could not do was save *somewhere that is not
   this browser* — so the sector you charted on the laptop did not exist on the
   phone, and clearing site data threw away an afternoon with no warning. This
   is the other end: an account, and one row in it holding the same book the
   game already writes to local storage.

   It is a mirror and never the source. The run reads and writes the local copy
   at full speed and this is told afterwards; nothing in the game ever waits for
   a network, because a game that stutters on a bad train in exchange for a save
   file is a bad trade. See `bookStore` in index.html for the seam.

   ── why there is no SDK here ──
   Supabase publishes a fine JavaScript client and this does not use it. The
   whole of what a save needs is four HTTP calls — sign in, refresh, read a row,
   write a row — against an API that is plain REST, and 120 KB of CDN script to
   make four fetches would cost this game the two things it actually has: no
   build step, and no third-party script on the page. It would also put the
   game's ability to load your save at the mercy of a CDN and of whatever
   version that CDN decided `@2` meant this morning.

   ── what it costs when it is not there ──
   Nothing. With no configuration, a failed request, a paused project or no
   network at all, `enabled()` is false or the call rejects, and Survey saves to
   local storage exactly as it did before any of this existed. There is no path
   through this file that can stop somebody playing.

   ── what leaves this machine ──
   An email address, a password (over TLS, to Supabase's auth endpoint, never
   stored here), and the book: your sector seed, your chart, your hold and your
   position in it. Nothing else. No telemetry, and no request of any kind until
   somebody opens the account panel and asks for one.                        */

(() => {
  "use strict";

  /* Filled in by config.js, which is committed: the publishable key is designed
     to sit in public JavaScript and row-level security on `public.saves` is what
     actually keeps one player's save away from another's.

     Blank is a normal state, not an error — it is what anyone who has cloned
     this without making a project of their own will have, and it has to play. */
  const CFG = window.KONDRITE_CLOUD || {};
  const URL_BASE = String(CFG.url || "").replace(/\/+$/, "");
  const ANON = String(CFG.anonKey || "");

  const enabled = () => !!(URL_BASE && ANON);

  /* Where the session is kept. Separate from the book: signing out must not
     take somebody's save with it, and wiping a save must not sign them out. */
  const SESSION_KEY = "kondrite.account.v1";

  const readLocal = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const writeLocal = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };
  const dropLocal = k => { try { localStorage.removeItem(k); } catch (_) {} };

  /* ── the session ──────────────────────────────────────────────────────────
     An access token good for an hour, a refresh token that outlives it, and
     enough of the user to put a name on the panel. Held in memory and mirrored
     to local storage so a reload does not ask for the password again. */
  let sess = (() => {
    try {
      const s = JSON.parse(readLocal(SESSION_KEY) || "null");
      if (s && s.access && s.refresh) return s;
    } catch (_) {}
    return null;
  })();

  function setSession(s) {
    sess = s;
    if (s) writeLocal(SESSION_KEY, JSON.stringify(s));
    else dropLocal(SESSION_KEY);
    emit();
  }

  /* Supabase returns `expires_in` seconds. Kept as an absolute moment, because
     seconds-from-now stops being true the instant it is written down. Sixty
     seconds of margin so a token cannot expire mid-request. */
  /* What the boards will call you. Kept on the session beside the email and
     never instead of it: the email is how you sign in and the name is the only
     thing about an account that is ever public. See `PILOT` and `setName`. */
  const nameOf = u => String((u && u.user_metadata && u.user_metadata.name) || "");

  const fromAuth = (j) => ({
    access: j.access_token,
    refresh: j.refresh_token,
    userId: j.user && j.user.id,
    email: (j.user && j.user.email) || "",
    name: nameOf(j.user),
    expires: Date.now() + Math.max(0, (Number(j.expires_in) || 3600) - 60) * 1000
  });

  /* ── the pilot name ───────────────────────────────────────────────────────
     One rule, here, because the box that asks for it and the board that prints
     it must not disagree about what a name is. Short enough to sit on a
     cabinet, long enough to be somebody, and nothing in it that could be read
     as anything but a name. */
  const PILOT = {
    min: 3, max: 16,
    /* Letters, digits, and single spaces, hyphens or underscores between them.
       No leading or trailing punctuation, so a name cannot be drawn as a blank
       or padded to the top of a board. */
    ok: n => /^[A-Za-z0-9][A-Za-z0-9 _-]{1,14}[A-Za-z0-9]$/.test(n),
    clean: n => String(n || "").trim().replace(/\s+/g, " "),
    /* Said the way the box should say it, so the message is written once. */
    why: n => {
      const c = PILOT.clean(n);
      if (!c) return "Pick a name for the boards.";
      if (c.length < PILOT.min) return "A name needs at least " + PILOT.min + " characters.";
      if (c.length > PILOT.max) return "Keep the name to " + PILOT.max + " characters or fewer.";
      return "Letters and numbers, with spaces, - or _ between them.";
    }
  };

  // Anyone who wants to know when the panel should redraw.
  const listeners = new Set();
  const emit = () => { for (const fn of listeners) { try { fn(); } catch (_) {} } };

  /* ── talking to it ────────────────────────────────────────────────────────
     One place that knows the headers, so the api key cannot be forgotten on a
     call somewhere and produce a 401 that reads like a wrong password. */
  async function call(path, opts = {}) {
    if (!enabled()) throw new Error("No account service is configured.");
    const headers = Object.assign({
      "apikey": ANON,
      "Content-Type": "application/json"
    }, opts.headers || {});
    if (opts.auth !== false && sess) headers.Authorization = "Bearer " + sess.access;

    let res;
    try {
      res = await fetch(URL_BASE + path, {
        method: opts.method || "GET",
        headers,
        body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
      });
    } catch (_) {
      /* A dead network, a paused free project and a blocked request are the
         same thing from here, and the message has to be one a player can act
         on rather than the word "TypeError".

         Tagged, because one caller has to tell this apart from a refusal:
         `fresh` signs you out when the service says no, and signing somebody
         out because their train went into a tunnel would take the game with
         it. Not reaching the service is not the service saying no. */
      const err = new Error("Could not reach the account service. Your save is still on this device.");
      err.offline = true;
      throw err;
    }

    if (res.status === 204) return null;
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (_) {}

    if (!res.ok) {
      const msg = (body && (body.error_description || body.msg || body.message ||
                            body.error || body.hint)) || ("HTTP " + res.status);
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return body;
  }

  /* An hour is shorter than a session of Survey, so the token in hand is
     routinely the expired one. Refreshed once, ahead of the call that needs it,
     and a refresh that fails signs you out rather than looping — a rotated or
     revoked refresh token never becomes valid again by being retried. */
  let refreshing = null;
  async function fresh() {
    if (!sess) throw new Error("Not signed in.");
    await knowWho();
    if (Date.now() < sess.expires) return;
    if (!refreshing) {
      refreshing = (async () => {
        try {
          const j = await call("/auth/v1/token?grant_type=refresh_token", {
            method: "POST", auth: false, body: { refresh_token: sess.refresh }
          });
          setSession(fromAuth(j));
        } catch (err) {
          /* Offline is not a refusal. The session is still good, the game is
             playable on it, and it will refresh the moment there is a network
             again — so it stays. Signing out here is what would turn a flight
             with no signal into a locked game, which is the one thing a
             required sign-in must never do. */
          if (err && err.offline) throw err;
          setSession(null);
          throw new Error("Your sign-in expired. Sign in again to sync — nothing has been lost.");
        } finally {
          refreshing = null;
        }
      })();
    }
    return refreshing;
  }

  /* Who this is. A session that came from a link in an email carries tokens and
     no user, and every row here is addressed by user id — so without this a
     recovered session asks for `user_id=eq.` and is told, correctly, about
     nothing. Asked once and remembered; a failure leaves the id empty and the
     caller fails on its own terms rather than on a second, stranger error. */
  let asking = null;
  async function knowWho() {
    if (!sess || sess.userId) return;
    if (!asking) {
      asking = call("/auth/v1/user")
        .then(u => {
          if (sess && u && u.id) {
            setSession(Object.assign({}, sess, { userId: u.id, email: u.email || "",
                                                 name: nameOf(u) || sess.name || "" }));
          }
        })
        .catch(() => {})
        .finally(() => { asking = null; });
    }
    return asking;
  }

  /* Where a link in an email should land. Supabase sends confirmation and
     password-reset links through its own `/verify` endpoint and then bounces the
     browser to whatever `redirect_to` says — and if nobody says, it uses the
     project's Site URL, which on a fresh project is `http://localhost:3000` and
     is therefore a dead end for every player in the world.

     Asked for explicitly, from wherever the game is actually running, so the
     same build works on the live site and on a laptop. The project still has to
     allow the URL — Authentication → URL Configuration → Redirect URLs — or
     Supabase ignores this and falls back to the Site URL. */
  function backHere() {
    try { return location.origin + location.pathname; } catch (_) { return ""; }
  }
  const withRedirect = path => {
    const to = backHere();
    return to ? path + (path.includes("?") ? "&" : "?") +
                "redirect_to=" + encodeURIComponent(to) : path;
  };

  /* ── coming back from an email ────────────────────────────────────────────
     A confirmation or reset link lands here with the session in the URL
     fragment. Picking it up is what makes both of those journeys end somewhere:
     without it the player arrives at a game that does not know who they are,
     which for a password reset means the link did nothing at all.

     The fragment is scrubbed afterwards. A URL carrying a live token is one that
     goes into browser history, gets copied into a message, and signs somebody
     else in. */
  function takeSessionFromURL() {
    let h = "";
    try { h = location.hash || ""; } catch (_) { return false; }
    if (h.length < 2 || h.indexOf("access_token=") < 0) return false;
    const q = new URLSearchParams(h.slice(1));
    const access = q.get("access_token"), refresh = q.get("refresh_token");
    if (!access || !refresh) return false;
    setSession({
      access, refresh,
      userId: "", email: "",
      expires: Date.now() + Math.max(0, (Number(q.get("expires_in")) || 3600) - 60) * 1000
    });
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch (_) {}
    // The fragment carries no user, so who this is has to be asked for.
    knowWho();
    return true;
  }

  /* ── signing in ───────────────────────────────────────────────────────────
     Supabase can be set to confirm addresses by email before it will hand out a
     session. When it is, a signup returns a user and no tokens — which is not a
     failure and must not read like one, so it is reported as its own outcome
     and the panel says to go and click the link. */
  /* The name goes in at signup, in `data`, which is where Supabase keeps what
     an account was created with — so an account has a name from the moment it
     exists and there is never a row on a board with nothing to print. An
     account made before names existed has none, and `setName` is how it gets
     one; see the panel. */
  async function signUp(email, password, name) {
    const pilot = PILOT.clean(name);
    const j = await call(withRedirect("/auth/v1/signup"), {
      method: "POST", auth: false,
      body: pilot ? { email, password, data: { name: pilot } } : { email, password }
    });
    if (j && j.access_token) { setSession(fromAuth(j)); return { signedIn: true }; }
    /* Confirmation is on, so there is no session yet and the name went up with
       the signup. It comes back down with the session when they follow the
       link and sign in. */
    return { signedIn: false, confirm: true };
  }

  /* Naming an account that has not got one. Local first and the server after,
     deliberately: the name is needed to play and the service may be a tunnel
     away, so a player is never held at the door by a network. A failed write
     leaves the name on this device and goes up with the next one. */
  async function setName(name) {
    if (!sess) throw new Error("Not signed in.");
    const pilot = PILOT.clean(name);
    if (!PILOT.ok(pilot)) throw new Error(PILOT.why(pilot));
    setSession(Object.assign({}, sess, { name: pilot }));
    try {
      await fresh();
      await call("/auth/v1/user", { method: "PUT", body: { data: { name: pilot } } });
      return { saved: true, name: pilot };
    } catch (err) {
      return { saved: false, name: pilot, reason: err.message, offline: !!err.offline };
    }
  }

  async function signIn(email, password) {
    const j = await call("/auth/v1/token?grant_type=password", {
      method: "POST", auth: false, body: { email, password }
    });
    setSession(fromAuth(j));
    return { signedIn: true };
  }

  async function resetPassword(email) {
    await call(withRedirect("/auth/v1/recover"),
               { method: "POST", auth: false, body: { email } });
  }

  /* Local first, then tell the server. The other order leaves somebody signed
     in on a machine they are walking away from if the request hangs. */
  async function signOut() {
    const had = sess;
    setSession(null);
    if (!had) return;
    try {
      await call("/auth/v1/logout", {
        method: "POST",
        headers: { Authorization: "Bearer " + had.access }
      });
    } catch (_) { /* the token is gone from here either way */ }
  }

  /* ── the row ──────────────────────────────────────────────────────────────
     One per account. `user_id` is the primary key and every policy on the table
     names `auth.uid()`, so this can only ever see its own. */
  async function pull() {
    await fresh();
    const rows = await call(
      "/rest/v1/saves?select=book,seed,wrote,updated_at&user_id=eq." + sess.userId);
    if (!rows || !rows.length) return null;
    const r = rows[0];
    return { book: r.book, seed: r.seed, wrote: r.wrote || "",
             at: Date.parse(r.updated_at) || 0 };
  }

  async function put(book, seed) {
    await fresh();
    await call("/rest/v1/saves", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: { user_id: sess.userId, book: String(book),
              seed: Number(seed) || 0, wrote: deviceName() }
    });
  }

  async function wipeRow() {
    await fresh();
    await call("/rest/v1/saves?user_id=eq." + sess.userId, { method: "DELETE" });
  }

  /* What a conflict calls the other machine. Coarse on purpose: enough to tell
     the phone from the laptop, and not a fingerprint. */
  function deviceName() {
    const ua = String(navigator.userAgent || "");
    if (/iPad/.test(ua)) return "an iPad";
    if (/iPhone|Android.*Mobile/.test(ua)) return "a phone";
    if (/Android/.test(ua)) return "a tablet";
    if (/Mac OS X/.test(ua)) return "a Mac";
    if (/Windows/.test(ua)) return "a PC";
    return "another device";
  }

  /* ── the mirror ───────────────────────────────────────────────────────────
     What `bookStore` hands every write to. Survey saves every fifteen seconds
     and at about thirty events besides, and a row written that often would
     spend the free tier's budget on a number that changed by one. So a push is
     *coalesced*: the newest book waits a while, and only the last one goes.

     `flush` is the save button and the closing tab — the two moments where
     waiting is the wrong answer. */
  const PUSH_AFTER = 25_000;
  let pending = null;      // the newest book not yet sent
  let timer = 0;
  let sending = false;
  let lastPush = 0;        // when a push last succeeded
  let lastError = "";

  function push(bookString) {
    if (!sess || !enabled()) return;
    pending = bookString;
    if (!timer) timer = setTimeout(() => { timer = 0; flush(); }, PUSH_AFTER);
  }

  /* Returns what happened, because the save button has to say. A push while one
     is already in flight keeps the newer book and lets the running one finish —
     two overlapping writes of the same row is the one way this could land an
     older save on top of a newer one. */
  async function flush() {
    if (timer) { clearTimeout(timer); timer = 0; }
    if (!sess || !enabled()) return { synced: false, reason: "not signed in" };
    if (pending === null) return { synced: true, nothing: true };
    if (sending) return { synced: false, reason: "already saving" };

    sending = true;
    const book = pending;
    try {
      let seed = 0;
      try { seed = Number(JSON.parse(book).seed) || 0; } catch (_) {}
      await put(book, seed);
      // Only cleared if it is still the book we sent: a save that happened
      // mid-flight has to survive and go next time.
      if (pending === book) pending = null;
      lastPush = Date.now();
      lastError = "";
      emit();
      return { synced: true, at: lastPush };
    } catch (err) {
      lastError = err.message;
      emit();
      return { synced: false, reason: err.message };
    } finally {
      sending = false;
    }
  }

  /* A tab being closed or backgrounded gets one last attempt. `pagehide` rather
     than `beforeunload` because iOS Safari does not reliably fire the latter,
     and a phone that never fires it is exactly the device this feature is for. */
  if (typeof window.addEventListener === "function") {
    const last = () => { if (pending !== null && sess) flush(); };
    window.addEventListener("pagehide", last);
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") last();
    });
  }

  // Before anything else asks whether somebody is signed in.
  if (enabled()) { try { takeSessionFromURL(); } catch (_) {} }

  window.KondriteCloud = {
    enabled,
    /* Null when signed out. A copy, so the panel cannot reach in and edit the
       session it is drawing. */
    session: () => sess
      ? { email: sess.email, userId: sess.userId, name: sess.name || "" } : null,
    signUp, signIn, signOut, resetPassword, setName,
    // The one rule about what a name is, so the panel cannot invent a second.
    pilot: PILOT,
    pull, put, wipeRow,
    push, flush,
    pendingWrite: () => pending !== null,
    lastSync: () => lastPush,
    lastError: () => lastError,
    deviceName,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
})();
