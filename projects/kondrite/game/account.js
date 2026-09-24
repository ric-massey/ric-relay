"use strict";

/* KONDRITE — THE ACCOUNT
   ─────────────────────────────────────────────────────────────────────────────
   The account, the door, the field behind it and the save button.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── the account ──────────────────────────────────────────────────────────
   Optional, always. Survey saves to this browser whether anybody signs in or
   not, and everything below is about the *second* copy: the one on an account,
   which is what makes the sector you charted on the laptop the sector that
   opens on the phone.

   Nothing here can stop somebody playing. With no configuration the panel
   says so and offers nothing; with a dead network every call fails into a
   sentence about the save still being on this device, which is true. */
const cloud = window.KondriteCloud || null;
const accountEl = el("account");

function acctSay(msg, bad) {
  el("acctStatus").textContent = msg || "";
  el("acctStatus").classList.toggle("bad", !!bad);
}

/* Two books that disagree, held while the player decides. Never resolved on
   their behalf: both sides are somebody's hours, and picking the newer one
   automatically is how you throw away the run somebody made on a plane. */
let clash = null;

/* What Survey writes goes to the account too, once there is an account to
   write to. This is the `bookMirror` the store talks to — see `bookStore`. */
function syncMirror() {
  const on = !!(cloud && cloud.enabled() && cloud.session());
  BOOK.setMirror(on ? {
    push: str => cloud.push(str),
    wipe: () => { cloud.wipeRow().catch(() => {}); }
  } : null);
}
if (cloud) { syncMirror(); cloud.onChange(() => { syncMirror(); paintAccount(); }); }

/* Already signed in from a previous visit? Then the account's copy should be
   here before anybody presses play. The whole promise is that the sector you
   left on the laptop is the one that opens on the phone, and that promise is
   not kept by a panel somebody has to go and find first.

   Never destructive. A book already on this device is only replaced when there
   is nothing to replace — the copy sitting here might be the newer one, made
   on a plane with no signal, and deciding that on somebody's behalf is how you
   throw away the run they care most about. Two that disagree are held for the
   panel and nothing is lost either way.

   Failure is silence. No network, a paused project, a rotated token: the game
   plays on the local book, which is what it did before any of this existed. */
async function catchUp() {
  /* Silent in the ordinary case and noisy under `?debug=1`, because every way
     this can fail is a way it fails *invisibly* — the player simply gets the
     sector they had, which is exactly what a working game looks like. */
  const why = m => { if (debugOn) console.warn("kondrite: catch-up " + m); };
  /* Silent when there is nothing configured and nobody signed in. Those are
     the *normal* states — every test boot and every guest is one — and a
     warning for them is a warning nobody reads, which is how the one that
     matters gets missed. */
  if (!cloud || !cloud.enabled() || !cloud.session()) return;
  let remote = null;
  try { remote = await cloud.pull(); }
  catch (err) { return why("could not read the account: " + err.message); }
  if (!remote || !remote.book) return why("found nothing on the account");

  const local = bookStore.read();
  if (local === remote.book) return;

  if (!local) {
    /* Nothing here to lose. `adoptCloud` rather than a bare write, because the
       pull can land after the player has already started a fresh sector — and
       a book written under a running Survey does nothing until the tab is
       closed, which looks exactly like the feature not working. */
    adoptCloud(remote.book, true);
    note("Your saved survey is here.");
    return;
  }

  clash = { remote, local };
  paintAccount();
  note("This device and your account have different surveys — " +
       "pause and open ACCOUNT to pick one.");
}
catchUp();

/* Enough of a book to tell two of them apart, without opening the sector. A
   seed is the sector's only name, so it is given in the same hex the `?seed=`
   link uses and can be recognised. */
function describeBook(str) {
  let b = null;
  try { b = JSON.parse(str); } catch (_) {}
  if (!b || !b.seed) return "an empty survey";
  const bits = ["sector " + (b.seed >>> 0).toString(16).toUpperCase()];
  if (b.cash) bits.push(Math.round(b.cash).toLocaleString() + " cash");
  if (Array.isArray(b.found) && b.found.length) {
    bits.push(b.found.length + " catalogue " +
              (b.found.length === 1 ? "entry" : "entries"));
  }
  if (b.savedAt) bits.push("saved " + howLongAgo(b.savedAt));
  return bits.join(" · ");
}

function howLongAgo(ms) {
  const s = Math.max(0, Date.now() - ms) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return Math.round(s / 60) + " minutes ago";
  if (s < 86400) return Math.round(s / 3600) + " hours ago";
  return Math.round(s / 86400) + " days ago";
}

function paintAccount() {
  if (!accountEl || accountEl.hidden) return;
  const up = !!(cloud && cloud.enabled());
  const who = up ? cloud.session() : null;

  /* Signed in but unnamed is its own state, and it comes before the signed-in
     one: until there is something to print on a board, the account is not
     finished being made. */
  const unnamed = up && !!who && !who.name && !clash;
  show("acctClash", !!clash);
  show("acctOut", up && !who && !clash);
  show("acctName", unnamed);
  show("acctIn", up && !!who && !clash && !unnamed);

  /* At the door the panel is answering "shall I sign in before I start"; from
     a menu it is answering "what is the state of my account". Same controls,
     different question, so the heading and the way out both change. */
  accountEl.classList.toggle("door", !!gate);
  /* The game's name, not Survey's. The door used to stand in front of one
     mode and now it stands in front of the whole game — the sector and the
     machines both — so naming one of the two things behind it was telling
     half the players they were in the wrong place. */
  el("accountTitle").textContent = gate ? "KONDRITE" : "YOUR ACCOUNT";
  /* At the door the boxes say what they are and the labels above them come
     off — two words instead of six, in the only place a player is looking.
     The `aria-label`s stay on the inputs, so a screen reader still gets the
     long version of each. */
  el("acctEmail").placeholder = gate ? "email" : "you@example.com";
  el("acctPass").placeholder = gate ? "password" : "at least 8 characters";
  el("acctPilot").placeholder = gate ? "pilot name" : "3 to 16 characters";
  el("btnAcctClose").textContent = "back";
  el("btnAcctPlay").hidden = !gate;
  // The third answer is only offered where the question is being asked.
  show("acctGuestRow", !!gate && up && !who && !clash);
  /* At the door there is no way past this one: a name is what the boards
     print, and the door is the moment the plan chose to ask for it. From
     SETTINGS it is an edit like any other and `back` still works. */
  el("acctNamePitch").textContent = gate
    ? "One more thing: what should the boards call you?"
    : "What the boards call you.";
  // Hidden at the door — see the `.door` rules. The settings page keeps it,
  // because there it is the only thing that says what an account is for.
  el("acctPitch").textContent =
    "Keeps the same sector on every device you play on.";

  if (!up) {
    acctSay("No account service is set up for this copy of the game. " +
            "Survey still saves on this device.");
    return;
  }

  if (who) {
    /* The name, because that is who you are here; the email is how you sign
       in and is nobody else's business. */
    el("acctWho").textContent = who.name || who.email;
    const last = cloud.lastSync();
    const err = cloud.lastError();
    el("acctSync").textContent = err
      ? "Last sync failed: " + err
      : last ? "Saved to your account " + howLongAgo(last) + "."
             : "Nothing sent yet this session.";
  }
  if (clash) {
    el("acctClashWhat").textContent =
      "On the account: " + describeBook(clash.remote.book) +
      (clash.remote.wrote ? ", from " + clash.remote.wrote : "") + ".\n" +
      "On this device: " + describeBook(clash.local) + ".";
  }
}

/* ── the door ─────────────────────────────────────────────────────────────
   Survey opens on this panel rather than straight into a sector, because the
   account question only has a good answer *before* somebody has played. Ask it
   after two hours and either answer is bad news: sign in and you have two
   surveys to reconcile, stay a guest and you have already built something that
   one cleared history will take.

   Asked once, and there are three answers: sign in, make an account, or
   play as a guest. The guest door was closed for a while (step 3 of
   archive/SIMULATIONS.md) on the argument that the boards are the whole
   reward a simulator has and a guest has no name to put on one. Ric reopened
   it on 2026-09-24: a game that will not start until you have typed an email
   into it is a game a lot of people close, and the boards are still there for
   anybody who wants them. So a guest plays everything — the sector, the
   machines, online — with the one trade said out loud on the button: the
   survey lives on this device only, and nothing a guest does reaches a board
   (`cloud.reportMatch` sends nothing without a session, so a guest's rows are
   not even queued to land on whoever signs in next). Choosing guest is
   remembered, so the door stops appearing; signing in clears it; signing out
   clears it too, because "not this account" is not "no account" and the
   question is worth asking again.

   What a required sign-in must never become is a required *connection*. The
   requirement is having signed in **on this device**, not being online now:
   the session is in local storage, `cloud.session()` reads it without a
   network, and `fresh` no longer signs anybody out for being unreachable. A
   cached session plays on a plane indefinitely. */

/* Whether the panel is standing in the doorway or was opened from a menu. In
   the doorway it has a `then` to run, and every way out of it runs that — a
   door you can close onto nothing is a mode that cannot be started. */
let gate = null;

/* The guest answer, remembered. Storage that cannot be read counts as
   "already answered": a browser with storage switched off would otherwise
   ask at every start and never be able to remember the reply. */
const GUEST_KEY = "kondrite.account.guest";
const guestChosen = () => {
  try { return localStorage.getItem(GUEST_KEY) === "yes"; } catch (_) { return true; }
};
const chooseGuest = on => {
  try {
    if (on) localStorage.setItem(GUEST_KEY, "yes");
    else localStorage.removeItem(GUEST_KEY);
  } catch (_) {}
};

/* Nobody signed in and nobody has said they would rather not be, or signed
   in and not yet named. With no account service at all there is nothing to
   ask and no door — a fork of this repo with a blank `config.js` is a whole
   game, which is that file's own promise and is not something a sign-in wall
   gets to revoke. */
const needsDoor = () => {
  if (!(cloud && cloud.enabled())) return false;
  const who = cloud.session();
  if (!who) return !guestChosen();
  return !who.name;
};

/* ── the field behind the door ────────────────────────────────────────────
   Its own canvas, not the game's. The game's is still showing the mode cards
   you opened this from, and the door is meant to be somewhere else rather
   than a veil laid over somewhere you have left.

   Drawn the way `menu.js` draws the Survey diorama and in the same violet, so
   the door and the card that opened it are recognisably one mode. Stars only:
   no rocks, no ship, nothing that implies a game is already running.

   The loop runs only while the door is up, and the `.door` class is the one
   that shows the canvas — so from SETTINGS this costs nothing at all. */
const starCanvas = el("acctStars");
const starCtx = starCanvas && starCanvas.getContext && starCanvas.getContext("2d");
let starRAF = 0, starClock = 0, starPrev = 0, starField = null;

/* A fixed scatter from a fixed sequence. The field is the same every time the
   door opens, which is what makes it a place and not an effect. */
function makeField(n) {
  let seed = 20260912;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push({ x: rnd(), y: rnd(), depth: 0.3 + rnd() * 0.85,
               phase: rnd() * Math.PI * 2, rate: 0.5 + rnd() * 1.1 });
  }
  return out;
}

function paintStars(dt) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const w = starCanvas.clientWidth, h = starCanvas.clientHeight;
  if (!w || !h) return;
  const pw = Math.round(w * ratio), ph = Math.round(h * ratio);
  if (starCanvas.width !== pw || starCanvas.height !== ph) {
    starCanvas.width = pw;
    starCanvas.height = ph;
  }
  starCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  starCtx.clearRect(0, 0, w, h);
  starClock += dt;
  for (const d of starField) {
    /* Depth does double duty: the near stars drift faster and sit brighter,
       which is the whole of the parallax and costs one multiply. */
    const x = (((d.x - starClock * 0.006 * d.depth) % 1) + 1) % 1;
    const twinkle = 0.4 + 0.6 *
      Math.abs(Math.sin(d.phase + starClock * 0.9 * d.rate));
    starCtx.globalAlpha = (0.12 + 0.5 * d.depth) * twinkle;
    starCtx.fillStyle = "#a08cff";
    const size = 0.9 + d.depth * 1.3;
    starCtx.fillRect(x * w, d.y * h, size, size);
  }
  starCtx.globalAlpha = 1;
}

function starStep(t) {
  starRAF = requestAnimationFrame(starStep);
  // Clamped: a tab that was in the background for a minute must not arrive
  // back with a minute of drift to apply in one frame.
  const dt = Math.min(0.05, Math.max(0, (t - starPrev) / 1000)) || 0;
  starPrev = t;
  paintStars(dt);
}

function startStars() {
  if (!starCtx || starRAF) return;
  starField = starField || makeField(260);
  starPrev = performance.now();
  starRAF = requestAnimationFrame(starStep);
}

function stopStars() {
  if (!starRAF) return;
  cancelAnimationFrame(starRAF);
  starRAF = 0;
}

function openAccount(then) {
  if (!accountEl) return;
  gate = typeof then === "function" ? { then } : null;
  accountEl.hidden = false;
  acctSay("");
  paintAccount();
  if (gate) startStars();
}

/* Two ways out of the door and they are different things, which is why there
   is no third: `closeAccount` is an answer — sign in, make one, or say you
   would rather not — and it flies. `cancelAccount` is "I did not mean to click
   Survey" and it goes back to the cards having started nothing.

   There was briefly a "not now, just fly" here as well, which played without
   remembering the answer. It sat next to the guest button looking like the
   same button, and the difference between them — whether you get asked again —
   is not something anybody should have to work out from two labels. That one
   is gone; the guest button, which remembers, is the third way through. */
function closeAccount() {
  if (!accountEl) return;
  accountEl.hidden = true;
  stopStars();
  const g = gate;
  gate = null;
  if (g) g.then();
}

function cancelAccount() {
  if (!accountEl) return;
  accountEl.hidden = true;
  stopStars();
  gate = null;
}

/* Signing in is the easy half. The hard half is the two saves that may now
   both exist, and which of them the player meant. */
async function afterSignIn() {
  syncMirror();
  acctSay("Signed in. Looking for a saved survey…");
  let remote = null;
  try {
    remote = await cloud.pull();
  } catch (err) {
    paintAccount();
    return acctSay("Signed in, but the saved survey could not be read: " +
                   err.message, true);
  }
  const local = bookStore.read();

  // Nothing up there yet: this device's survey becomes the account's.
  if (!remote || !remote.book) {
    if (local) {
      cloud.push(local);
      const r = await cloud.flush();
      paintAccount();
      return acctSay(r.synced
        ? "Signed in. This device's survey is now on your account."
        : "Signed in, but the upload failed: " + r.reason, !r.synced);
    }
    paintAccount();
    return acctSay("Signed in. Your survey will be saved to the account from now on.");
  }

  // Nothing here, or the same thing: no decision to make.
  if (!local || local === remote.book) {
    if (!local) adoptCloud(remote.book, true);
    paintAccount();
    return acctSay(local
      ? "Signed in. This device is already up to date."
      : "Signed in. Your saved survey has been brought down to this device.");
  }

  clash = { remote, local };
  paintAccount();
  acctSay("");
}

// Signed in, and the door can close — once there is a name to close it on.
/* Signing in is also an answer to "would you rather not": choosing guest and
   then signing in must not leave the guest flag standing, or signing out
   later would drop straight back into the sector with no door. */
function nowSignedIn() {
  chooseGuest(false);
  doorAnswered();
}

/* Signing in answers the door's question, so it closes the door. Not
   instantly: "signed in, and here is what became of your two saves" is worth a
   second on the screen before a sector arrives over it. A clash is the
   exception — that is a question, and it must not be flown past. */
function doorAnswered() {
  if (!gate || clash || needsDoor()) return;
  setTimeout(() => { if (gate && !clash && !needsDoor()) closeAccount(); }, 1600);
}

/* Taking the account's copy. The book is written to the store and then the
   mode is rebuilt around it — a running Survey is holding the old sector in
   memory, and leaving it there would show the old world over the new save
   until the tab was closed. */
function adoptCloud(book, quiet) {
  bookStore.write(book);
  if (mode && mode.survey && surv) {
    surv = null;
    startGame("survey", 1, 0);
    state = "playing";
  }
  if (!quiet) note("Your saved survey is loaded.");
}

el("btnAcctClose").addEventListener("click", () => {
  if (gate) cancelAccount(); else closeAccount();
});
el("btnAcctPlay").addEventListener("click", closeAccount);

el("btnAcctGuest").addEventListener("click", () => {
  chooseGuest(true);
  closeAccount();
});

/* The name, and the reason this is local-first. A player at the door with no
   network still has to be able to get into the game: the name is set on the
   session here and now, and the account service is told when it can be
   reached. A write that fails is not a refusal to play. */
el("btnAcctName").addEventListener("click", async () => {
  const typed = el("acctPilot").value;
  const pilot = cloud.pilot.clean(typed);
  if (!cloud.pilot.ok(pilot)) return acctSay(cloud.pilot.why(typed), true);
  acctSay("Saving the name\u2026");
  let r;
  try {
    r = await cloud.setName(pilot);
  } catch (err) { return acctSay(err.message, true); }
  /* Taken is not a failure to save, it is a different name being needed —
     one name, one pilot, so that a board is a list of people rather than a
     list of claims to be somebody. The door stays up and asks again. */
  if (r.taken) {
    el("acctPilot").select && el("acctPilot").select();
    return acctSay(r.reason + " Pick another.", true);
  }
  paintAccount();
  acctSay(r.saved
    ? "You are " + r.name + "."
    : "You are " + r.name + " on this device. " +
      (r.offline ? "It will reach your account when there is a connection."
                 : "The account could not be told: " + r.reason));
  doorAnswered();
});

el("btnAcctIn").addEventListener("click", async () => {
  const email = el("acctEmail").value.trim();
  const pass = el("acctPass").value;
  if (!email || !pass) return acctSay("An email and a password, please.", true);
  acctSay("Signing in…");
  try {
    await cloud.signIn(email, pass);
    el("acctPass").value = "";
    await afterSignIn();
    nowSignedIn();
  } catch (err) {
    acctSay(err.status === 400
      ? "That email and password do not match an account."
      : err.message, true);
  }
});

el("btnAcctUp").addEventListener("click", async () => {
  const email = el("acctEmail").value.trim();
  const pass = el("acctPass").value;
  if (!email || !pass) return acctSay("An email and a password, please.", true);
  /* Checked here as well as by the server, because the server's version of
     this message is "Password should be at least 6 characters" and the player
     would rather be told before they wait for a round trip. */
  if (pass.length < 8) {
    return acctSay("Make the password at least 8 characters.", true);
  }
  acctSay("Making the account…");
  try {
    const r = await cloud.signUp(email, pass);
    el("acctPass").value = "";
    if (r.confirm) {
      paintAccount();
      return acctSay("Account made. Check your email for a link to confirm it, " +
                     "then sign in.");
    }
    await afterSignIn();
    nowSignedIn();
  } catch (err) {
    acctSay(err.message, true);
  }
});

el("btnAcctForgot").addEventListener("click", async () => {
  const email = el("acctEmail").value.trim();
  if (!email) return acctSay("Put your email in first.", true);
  try {
    await cloud.resetPassword(email);
    /* Said the same way whether or not the address has an account. The other
       version of this message tells anybody who asks which addresses are
       registered. */
    acctSay("If that address has an account, a reset link is on its way.");
  } catch (err) {
    acctSay(err.message, true);
  }
});

/* Signing out costs nothing and that is the point: the book stays on this
   device *and* stays on the account, so this is a reversible button and can be
   pressed directly rather than through a confirmation nobody needs. The one
   thing it must not do is drop a save still sitting in the coalescing window —
   losing the last few seconds silently is the worst way to lose anything. */
async function signOutNow(say) {
  if (!cloud || !cloud.session()) return;
  if (cloud.pendingWrite()) {
    if (say) say("Saving before signing out…");
    await cloud.flush();
  }
  await cloud.signOut();
  /* The door comes back, because `needsDoor` asks the session and there is
     no longer one — and the guest flag is cleared with it: somebody who has
     just signed out has not said they want to be a guest, they have said they
     do not want to be *this* account, which is a different answer and a
     question worth asking again. Not immediately, though: a survey already
     running is left alone. Signing out says "not this account", which is not a reason to
     take somebody out of the sector they are flying — the door is asked at
     the front page, on the way into something, and that is where they will
     meet it. */
  chooseGuest(false);
  syncMirror();
  paintAccount();
  // Said plainly, because it is the thing about this that surprises people.
  if (say) say("Signed out. Your survey is still on this device.");
}

el("btnAcctOut").addEventListener("click", () => signOutNow(acctSay));

el("btnAcctSave").addEventListener("click", async () => {
  if (mode && mode.survey && surv) saveSurveyBook();
  else { const b = bookStore.read(); if (b) cloud.push(b); }
  acctSay("Saving…");
  const r = await cloud.flush();
  paintAccount();
  acctSay(r.synced ? "Saved to your account." : "Could not save: " + r.reason,
          !r.synced);
});

el("btnAcctTakeCloud").addEventListener("click", () => {
  adoptCloud(clash.remote.book);
  clash = null;
  paintAccount();
  acctSay("Loaded the survey from your account.");
  doorAnswered();
});

el("btnAcctTakeLocal").addEventListener("click", async () => {
  const keep = clash.local;
  clash = null;
  cloud.push(keep);
  acctSay("Uploading this device's survey…");
  const r = await cloud.flush();
  paintAccount();
  acctSay(r.synced ? "This device's survey is now the one on your account."
                   : "Could not upload: " + r.reason, !r.synced);
  doorAnswered();
});

/* ── the save button ──────────────────────────────────────────────────────
   Survey has always saved on its own, every fifteen seconds and at about
   thirty events besides, so this button is not what keeps a run. What it is
   for is the two things autosaving cannot do: send it to the account *now*
   rather than at the end of the coalescing window, and say out loud that it
   worked — which is the whole reason anybody asks for a save button. */
let saveSaid = 0;          // when the button last reported
let saveWord = "";

/* What the button into the panel says, which is the shortest true answer to
   "is my survey safe anywhere but here". */
function accountLabel() {
  if (!cloud || !cloud.enabled()) return "ACCOUNT: NONE";
  const who = cloud.session();
  return who ? "ACCOUNT: ON" : "SIGN IN";
}

function saveLabel() {
  return performance.now() < saveSaid ? saveWord : "SAVE";
}
function saveNote() {
  if (performance.now() < saveSaid) return "";
  if (cloud && cloud.enabled() && cloud.session()) {
    return "Kept on this device and on your account.";
  }
  /* The honest version. A save that lives in one browser is one cleared
     history away from gone, and somebody who has played for six hours is
     entitled to know that before it happens rather than after. */
  return cloud && cloud.enabled()
    ? "Kept on this device only — an account keeps it if this browser forgets."
    : "Kept on this device only.";
}

function surveySaveNow() {
  const kept = saveSurveyBook();
  saveSaid = performance.now() + 2600;
  saveWord = kept ? "SAVED" : "COULD NOT SAVE";
  if (!kept) {
    note("This browser will not let the game save — private browsing, or the " +
         "storage is full.");
    return;
  }
  if (cloud && cloud.enabled() && cloud.session()) {
    cloud.flush().then(r => {
      saveSaid = performance.now() + 2600;
      saveWord = r.synced ? "SAVED" : "SAVED HERE ONLY";
      if (!r.synced) note("Saved on this device. The account copy failed: " + r.reason);
    });
  }
}

el("onlineFriendlyFire").addEventListener("click", toggleFriendlyFire);

el("btnStart").addEventListener("click", () => {
  const key = roomMode;
  const N = window.KondriteNet;
  if (N.host.links.some(l => !l.open)) {
    return say("Wait for every player to finish connecting.", true);
  }
  const seated = N.host.links.filter(l => l.open);
  const n = Math.min(MAX_PLAYERS, 1 + seated.length);
  if (n < MODES[key].minPlayers) {
    return say("Battle royale needs at least two connected.", true);
  }
  net.role = "host";
  net.seat = 0;
  net.inputs = {};

  /* Seat numbers have to be 0…n-1 from here on, because a seat number is the
     index of a ship. Until now they were only handles for the lobby, and a
     player dropping out could leave a gap. Renumber, keeping each player
     with the colour they chose, and give whatever is left to the bots so
     nobody ends up flying against their own colour. */
  const compactNames = [names[0], ...seated.map(l => names[l.seat])];
  const chosen = [skins[0], ...seated.map(l => skins[l.seat])];
  names = compactNames;
  // Who is in which seat, compacted with the names. See `hostMatchSeats`.
  hostMatchSeats(seated);
  skins = chosen.concat(PLAYERS.map((_, i) => i).filter(i => !chosen.includes(i)));
  seated.forEach((l, i) => { l.seat = i + 1; l.inputSeq = 0; });

  startGame(key, n);
  // Only this keyboard drives seat 0; the rest arrive over the wire. Your
  // own keys fly your ship whatever colour you picked.
  ships.forEach((s, i) => { s.localKeys = i === 0 ? PLAYERS[0] : null; });
  seated.forEach(l => l.send(initPacket(l.seat), true));
  closeLobby();
});

el("btnLobbyClose").addEventListener("click", () => {
  netReset();
  closeLobby();
  toTitle();
});

lobby.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  e.preventDefault();
  el("btnLobbyClose").click();
});
