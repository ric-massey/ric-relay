/* OWNER — the password box, shared by the training and climbing pages
   ────────────────────────────────────────────────────────────────────────────
   One job: decide whether to draw the editing controls, and hold the password
   that every write is sent with.

   ── what this is not ──
   It is not a security boundary and it is not pretending to be one. This repo
   is public and Pages is static, so anyone can read this file and anyone can
   set `ownerToken` in their own browser. What they get for it is a row of
   buttons that return 401. The Worker holds the real secret and the Worker is
   what says yes. Everything here is a rendering hint.

   ── why the password IS the token ──
   Exchanging a password for a session token would add a round trip, an
   expiry, and a refresh path, and would protect against nothing extra: both
   end up in localStorage on the same device. So the password is sent as the
   bearer token directly. `POST /auth` exists only so a wrong password can be
   reported the moment it is typed rather than silently failing on the first
   tick an hour later.

   Usage:
       Owner.init({ host: LOG_HOST, onChange: render });
       if (Owner.on()) { ...draw controls... }
       await Owner.post('/log/2026-08-16', { done: {1:true} });
*/
window.Owner = (function () {
  const KEY = 'ownerToken';
  const QKEY = 'ownerQueue';
  let HOST = '';
  let token = null;
  let onChange = () => {};
  /* One replay at a time. post() kicks a flush on every successful write and
     the `online` event fires its own, so without this two passes can walk the
     same queue at once and each remove the other's work. */
  let flushing = false;

  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const write = v => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {} };

  /* ── the offline queue ──
     Ticking a session happens at a crag, which is the one place with no signal.
     Without this, the tick rolls back and the answer is "do it again later" —
     which is exactly the friction this whole thing exists to remove.

     Writes that fail for NETWORK reasons are kept here and replayed in order
     when the connection comes back. Order matters and is enough on its own: a
     tick followed by an untick replays to untick, which is the right answer, so
     there is no merging to get wrong.

     A write refused for AUTH reasons is never queued — replaying a rejected
     password forever helps nobody. */
  const readQ = () => { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch (e) { return []; } };
  const writeQ = q => { try { q.length ? localStorage.setItem(QKEY, JSON.stringify(q)) : localStorage.removeItem(QKEY); } catch (e) {} };

  /* A one-tap link is still supported — ?key=… — because typing a long password
     on a phone at a crag is exactly the friction this is meant to remove. It is
     stripped from the address bar immediately, though it does pass through
     history on the way, which is what the sign-out button is for. */
  function takeKeyFromUrl() {
    const u = new URL(location.href);
    const k = u.searchParams.get('key');
    if (!k) return;
    write(k);
    u.searchParams.delete('key');
    history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
  }

  async function check(password) {
    try {
      const r = await fetch(HOST + '/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password })
      });
      return r.ok;
    } catch (e) { return null; }        // null = could not reach the server
  }

  return {
    init(opts) {
      HOST = opts.host;
      onChange = opts.onChange || onChange;
      takeKeyFromUrl();
      token = read();
      /* Two chances to drain the queue: the browser telling us the connection
         is back, and simply opening the page — which is what actually happens
         after a drive home, because `online` fires while the tab is asleep. */
      window.addEventListener('online', () => this.flush());
      if (token && readQ().length) setTimeout(() => this.flush(), 0);
    },
    on: () => !!token,
    token: () => token,
    /* Sent on reads too, so the owner gets his own private notes back. */
    headers: () => (token ? { authorization: 'Bearer ' + token } : {}),

    async signIn(password) {
      const ok = await check(password);
      if (ok === null) return 'offline';
      if (!ok) return 'wrong';
      token = password;
      write(password);
      onChange();
      return 'ok';
    },

    signOut() { token = null; write(null); onChange(); },

    /* Every write goes through here so there is one place that knows what a
       rejected password looks like.

       Three outcomes, and callers need to tell them apart:
         an object with `ok`      — the server took it
         { queued: true }         — no signal, kept for later, UI should STAND
         null                     — refused or malformed, UI should roll back

       Pass { queue: true } for anything worth keeping through a dead spot.
       Signing in, by contrast, is pointless to queue. */
    async post(path, body, opts = {}) {
      if (!token) return null;
      try {
        const r = await fetch(HOST + path, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
          body: JSON.stringify(body)
        });
        if (r.status === 401) { this.signOut(); return null; }
        if (!r.ok) return null;
        const out = await r.json();
        /* A successful write proves the connection is back, so drain anything
           that piled up while it was not. */
        if (readQ().length) this.flush();
        return out;
      } catch (e) {
        /* fetch() only throws for network-level failures — a real HTTP error
           came back above with a status. So this branch IS "no signal". */
        if (opts.queue) {
          const q = readQ();
          q.push({ path, body, at: Date.now() });
          writeQ(q.slice(-200));
          return { queued: true };
        }
        return null;
      }
    },

    pending: () => readQ().length,

    /* Replay in order, stop at the first failure and keep the rest. Stopping
       rather than skipping is deliberate: these are ordered edits to the same
       days, and applying number three without number two would write a state
       that never existed.

       ── why this re-reads the queue every single time ──
       It used to take one snapshot at the top and write `q.slice(sent)` back at
       the end. Anything queued WHILE the flush was in flight lived in
       localStorage but not in that snapshot, so the final write erased it. A
       tick made on flaky signal during a replay was destroyed silently: the
       caller was told `{queued: true}`, the tick painted, and the write was
       gone. That is the one outcome this whole queue exists to prevent, and the
       window was the length of a single fetch — at a crag, on one bar, which is
       precisely when a replay is happening.

       So the queue on disk is the only queue. Each pass re-reads it, sends the
       head, and re-reads again before removing that head, which means a write
       appended to the tail mid-flight is still there afterwards.

       ── and why a refusal no longer jams it ──
       Stopping at the first failure is right for "no signal" and wrong for "the
       server will never accept this". A single malformed entry used to block
       every write behind it for ever, retried on every flush, silently. A 4xx
       that is not about authentication or rate limiting is a permanent no: it
       is dropped, loudly, so the rest of the queue can move. */
    async flush() {
      if (!token || flushing) return 0;
      flushing = true;
      let sent = 0;
      try {
        for (;;) {
          const head = readQ()[0];
          if (!head) break;
          let r;
          try {
            r = await fetch(HOST + head.path, {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
              body: JSON.stringify(head.body)
            });
          } catch (e) { break; }               // no signal — keep everything, try later
          if (r.status === 401) { this.signOut(); break; }
          /* Re-read before removing, so a write appended while that fetch was
             in flight survives. */
          const drop = () => { const q = readQ(); q.shift(); writeQ(q); };
          if (r.ok) { drop(); sent++; continue; }
          if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) {
            console.error('owner: dropping a queued write the server refuses permanently —',
                          r.status, head.path, head.body);
            drop();
            continue;
          }
          break;                               // 5xx, 429, 408 — transient, keep and retry
        }
      } finally { flushing = false; }
      if (sent) onChange();
      return sent;
    },

    /* The sign-in box. Rendered into whatever element is passed; both pages use
       the same markup so the muscle memory is identical on either. */
    mountBox(el, { title = 'Sign in to log', note = '' } = {}) {
      el.innerHTML = `
        <form class="ownerform" autocomplete="on">
          <label class="ownerlabel" for="ownerpw">${title}</label>
          <input id="ownerpw" type="password" name="password" autocomplete="current-password"
                 placeholder="password" aria-describedby="ownermsg">
          <button type="submit">Sign in</button>
          <span class="ownermsg" id="ownermsg" role="status">${note}</span>
        </form>`;
      const form = el.querySelector('form');
      const input = el.querySelector('#ownerpw');
      const msg = el.querySelector('#ownermsg');
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const pw = input.value;
        if (!pw) return;
        msg.textContent = 'checking…';
        const r = await this.signIn(pw);
        if (r === 'ok') { msg.textContent = ''; input.value = ''; }
        else if (r === 'offline') msg.textContent = 'could not reach the log — try again in a moment.';
        else { msg.textContent = 'that is not it.'; input.select(); }
      });
    }
  };
})();
