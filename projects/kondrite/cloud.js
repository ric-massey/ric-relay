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
      /* A table that is not there is not a sentence to show a player. It means
         `supabase/schema.sql` has not been run against this project, or has
         been run against a different one, and what PostgREST says about it —
         "Could not find the table 'public.board' in the schema cache" — ends up
         drawn on the board page in orange. PGRST205 is its code for exactly
         that; 42P01 is Postgres's own, for the paths that reach it first.

         Tagged as well as reworded, because "this service has no boards" and
         "this request failed" are different facts and a caller may want to
         tell them apart. */
      const code = body && body.code;
      const missing = code === "PGRST205" || code === "42P01";
      const err = new Error(missing ? "The boards are not set up yet." : msg);
      err.status = res.status;
      if (missing) err.missing = true;
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
      /* And the public copy, which is the one a board can actually read —
         `user_metadata` is in the auth schema and only its owner sees it. A
         name that is already somebody else's is the one failure here worth
         handing back rather than swallowing: it is the player's to fix, and
         until they do, nothing of theirs can appear on a board under it. */
      const pub = await profileUp(pilot);
      if (pub.taken) {
        return { saved: false, taken: true, name: pilot,
                 reason: "Somebody is already flying as " + pilot + "." };
      }
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

  /* ── the boards ───────────────────────────────────────────────────────────
     Step 5. Three things live here: the public half of an account, the rows a
     client posts about a match it was in, and reading a board back.

     The rule the whole thing turns on is that **a score is not a claim you make
     about yourself**. Every client in a match posts one row per player it saw,
     and Postgres counts a score only where two different accounts reported the
     same value for the same player in the same match. See `supabase/schema.sql`
     — the check is there rather than here, because a check the client performs
     is not a check. */

  /* Your name, where other people can read it. `user_metadata` from step 3 is
     in the auth schema and only its owner can see it, so a board could never
     have printed it. This is the public copy, and it is the only public thing
     about an account. */
  async function profileUp(name) {
    if (!sess) throw new Error("Not signed in.");
    const pilot = PILOT.clean(name);
    if (!PILOT.ok(pilot)) throw new Error(PILOT.why(pilot));
    await fresh();
    try {
      await call("/rest/v1/profiles", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: { user_id: sess.userId, name: pilot, updated_at: new Date().toISOString() }
      });
      return { saved: true, name: pilot };
    } catch (err) {
      /* One name, one pilot. 23505 is Postgres saying the unique index refused
         it, and it is the one failure here a player can actually do something
         about — so it is its own answer rather than a message about SQL. */
      if (/23505|duplicate key|already exists/i.test(err.message || "")) {
        return { saved: false, taken: true, name: pilot };
      }
      throw err;
    }
  }

  /* Whose name is on a board, when it is not yours. Read once and kept, because
     a board is a page you open and close and reopen. */
  async function myProfile() {
    if (!sess) return null;
    await fresh();
    const rows = await call("/rest/v1/profiles?select=name&user_id=eq." + sess.userId);
    return rows && rows.length ? rows[0] : null;
  }

  /* ── what you witnessed ───────────────────────────────────────────────────
     Rows are queued rather than sent, and for the same reason the book is: a
     match can end on a train. A score made with no connection goes up on the
     next one, and until it does it sits in local storage, so closing the tab
     does not lose it either.

     Re-posting is harmless and is relied on: the primary key is (match,
     subject, reporter), so a row that went up twice is the same row, and a
     queue that cannot be sure whether it succeeded may simply try again. */
  const QUEUE_KEY = "kondrite.scores.v1";
  const QUEUE_MAX = 200;

  let queue = (() => {
    try {
      const q = JSON.parse(readLocal(QUEUE_KEY) || "[]");
      return Array.isArray(q) ? q.slice(0, QUEUE_MAX) : [];
    } catch (_) { return []; }
  })();
  const saveQueue = () => {
    if (queue.length) writeLocal(QUEUE_KEY, JSON.stringify(queue.slice(0, QUEUE_MAX)));
    else dropLocal(QUEUE_KEY);
  };

  /* One match's worth of reports. `rows` is what this client saw: a subject, a
     game, a number, and a word about it. The reporter is always *this* account
     and is set here rather than taken from the caller, because the policy on
     the table will refuse anything else and a client that lied about it would
     simply be told no in a confusing way. */
  function reportMatch(matchId, rows) {
    if (!sess || !enabled() || !matchId || !rows || !rows.length) return 0;
    const made = [];
    for (const r of rows) {
      if (!r || !r.subject || !r.game) continue;
      const v = Math.max(0, Math.round(Number(r.value) || 0));
      if (!isFinite(v)) continue;
      made.push({ match_id: matchId, subject: r.subject, reporter: sess.userId,
                  game: r.game, value: v,
                  detail: String(r.detail || "").slice(0, 40) });
    }
    if (!made.length) return 0;
    queue = queue.concat(made).slice(0, QUEUE_MAX);
    saveQueue();
    sendScores();
    return made.length;
  }

  let sendingScores = false;
  async function sendScores() {
    if (sendingScores || !sess || !enabled() || !queue.length) {
      return { sent: 0, left: queue.length };
    }
    sendingScores = true;
    const batch = queue.slice(0, 50);
    try {
      await fresh();
      await call("/rest/v1/scores", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: batch
      });
      /* Only the rows that went are dropped. A report made while this was in
         flight has to survive and go next time. */
      queue = queue.slice(batch.length);
      saveQueue();
      lastError = "";
      emit();
      return { sent: batch.length, left: queue.length };
    } catch (err) {
      /* Offline keeps the queue. A refusal keeps it too: the rows are still
         true, and the next attempt is after a refresh that may well work. */
      lastError = err.message;
      emit();
      return { sent: 0, left: queue.length, reason: err.message,
               offline: !!err.offline };
    } finally {
      sendingScores = false;
    }
  }

  /* ── reading one back ─────────────────────────────────────────────────────
     Cached for the session. A board is a number that changes when somebody
     finishes a game, which is not often, and a read every time a page is drawn
     would spend the free tier on a row that did not move. */
  const BOARD_TTL = 90_000;
  const boards = new Map();

  async function board(game, limit) {
    const n = Math.max(1, Math.min(50, limit || 20));
    const key = game + ":" + n;
    const have = boards.get(key);
    if (have && Date.now() - have.at < BOARD_TTL) return have.rows;
    await fresh();
    const rows = await call("/rest/v1/board?select=name,value,witnesses,user_id" +
                            "&game=eq." + encodeURIComponent(game) +
                            "&order=value.desc&limit=" + n);
    const got = (rows || []).map(r => ({ name: r.name, value: Number(r.value) || 0,
                                         witnesses: Number(r.witnesses) || 0,
                                         you: r.user_id === sess.userId }));
    boards.set(key, { at: Date.now(), rows: got });
    return got;
  }
  // What is cached right now, for a page that must draw before a read returns.
  const boardNow = (game, limit) => {
    const have = boards.get(game + ":" + Math.max(1, Math.min(50, limit || 20)));
    return have ? have.rows : null;
  };
  const forgetBoards = () => boards.clear();

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
      /* There is a connection, so anything a match left waiting goes now. Not
         awaited: a board is never worth holding a save up for. */
      if (queue.length) sendScores();
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
    /* The boards. `reportMatch` is what a client says it saw; `board` is what
       two people agreeing about it looks like afterwards. */
    profileUp, myProfile, reportMatch, sendScores, board, boardNow, forgetBoards,
    scoresWaiting: () => queue.length,
    pull, put, wipeRow,
    push, flush,
    pendingWrite: () => pending !== null,
    lastSync: () => lastPush,
    lastError: () => lastError,
    deviceName,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
})();
