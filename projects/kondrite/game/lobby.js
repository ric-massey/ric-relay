"use strict";

/* KONDRITE — THE LOBBY
   ─────────────────────────────────────────────────────────────────────────────
   The lobby, who is sitting where, the room service and the list.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── lobby ───────────────────────────────────────────────────────────────
   The whole online flow is one list. A host puts a game on it; a guest picks
   one off it. The two session descriptions that actually open the connection
   travel through the room service, so neither player ever sees one. */
const el = id => document.getElementById(id);
const lobby = el("lobby");
let lobbyRole = null;

function say(msg, bad) {
  el("lobbyStatus").textContent = msg || "";
  el("lobbyStatus").classList.toggle("bad", !!bad);
}

function show(id, on) { el(id).hidden = !on; }

function seatsUI() {
  const N = window.KondriteNet;
  const list = el("seatList");
  list.replaceChildren();

  const rows = [];
  if (lobbyRole === "host") {
    rows.push([0, "host"]);
    if (N) for (const l of N.host.links) {
      if (l.seat != null) rows.push([l.seat, l.open ? "connected" : "connecting…"]);
    }
  } else if (N && N.guest.link && N.guest.link.open) {
    // A guest knows the room only through the last table the host sent.
    for (const seat of [...guestTaken].sort((a, b) => a - b)) {
      rows.push([seat, seat === 0 ? "hosting"
                     : seat === net.seat ? "you" : "connected"]);
    }
  }

  show("seatWrap", rows.length > 0);

  for (const [seat, what] of rows) {
    const row = document.createElement("div");
    row.className = "row";
    row.style.color = skinOf(seat).colour;

    const dot = document.createElement("span");
    dot.className = "dot";
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = nameOf(seat);
    const note = document.createElement("span");
    note.className = "what";
    note.textContent = skinOf(seat).label.toLowerCase() + " · " + what;

    row.append(dot, who, note);

    // Seat 0 is the host and has nothing to say about being ready.
    if (seat !== 0 && what !== "connecting…") {
      const tick = document.createElement("span");
      tick.className = "tick";
      tick.textContent = ready[seat] ? "READY" : "…";
      row.append(tick);
    }
    list.appendChild(row);
  }

  if (lobbyRole === "host") {
    const links = N ? N.host.links : [];
    const hasOpen = links.some(l => l.open);
    const hasConnecting = links.some(l => !l.open);
    if (!hasOpen) {
      const p = document.createElement("div");
      p.className = "empty";
      p.textContent = "No other players connected.";
      list.appendChild(p);
    } else if (hasConnecting) {
      const p = document.createElement("div");
      p.className = "empty";
      p.textContent = "Wait for every player to finish connecting.";
      list.appendChild(p);
    } else if (!allReady()) {
      const p = document.createElement("div");
      p.className = "empty";
      p.textContent = "Waiting for everyone to ready up.";
      list.appendChild(p);
    }
    show("rowStart", hasOpen && !hasConnecting && allReady());
    el("startWhat").textContent = "Everyone's ready · " + MODES[roomMode].name;
    show("rowReady", false);
  } else {
    // A guest readies up; there is nothing else for it to do down here.
    const joined = N && N.guest.link && N.guest.link.open;
    show("rowReady", !!joined);
    if (joined) {
      const on = !!ready[net.seat];
      const what = MODES[roomMode] ? MODES[roomMode].name : "";
      el("btnReady").textContent = on ? "ready ✓" : "ready up";
      el("readyNote").textContent = on
        ? what + " · the host starts when everyone is ready."
        : what + " · tell the host you're ready.";
    }
  }
}

/* The colours you may take. The host reads the truth straight out of its own
   seating plan; a guest paints the last table the host sent it, which is why
   losing a race for a colour looks like the button simply going out. */
let guestTaken = [0];

function paintColours() {
  const box = el("swatches");
  if (!box) return;
  const host = lobbyRole === "host";
  const seat = host ? 0 : net.seat;
  const occupied = host ? [...seatsTaken()] : guestTaken;
  box.replaceChildren();
  PLAYERS.forEach((p, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.skin = String(i);
    b.textContent = p.label.toLowerCase();
    b.style.color = p.colour;
    const mine = skins[seat] === i;
    const held = !mine && occupied.some(s => s !== seat && skins[s] === i);
    if (mine) b.className = "mine";
    b.disabled = held;
    b.setAttribute("aria-pressed", mine ? "true" : "false");
    box.appendChild(b);
  });
  show("colourPick", true);
}

const nameInput = el("playerName");

// Deliberately not written back into the field while typing: correcting the
// box under someone's fingers is how you lose the space between two words.
nameInput.addEventListener("input", () => {
  const N = window.KondriteNet;
  myName = tidyName(nameInput.value);
  saveName();
  if (lobbyRole === "host") {
    names[0] = myName;
    seatsUI();
    tellSeats();
  } else {
    names[net.seat] = myName;
    seatsUI();
    if (N && N.guest.link && N.guest.link.open) {
      N.guest.send({ t: "me", name: myName, acct: myAccount() }, true);
    }
  }
});

el("swatches").addEventListener("click", e => {
  const b = e.target.closest && e.target.closest("button[data-skin]");
  if (!b) return;
  const skin = +b.dataset.skin;
  if (lobbyRole === "host") {
    if (claimSkin(0, skin)) tellSeats();
  } else {
    // Ask. The host's next seating plan is the answer, and it repaints this.
    const N = window.KondriteNet;
    if (N) N.guest.send({ t: "pick", skin }, true);
  }
});

/* ── who is sitting where ─────────────────────────────────────────────────
   The host owns the seating plan and is the only one allowed to change it.
   A guest asks for a colour; the host says what the answer was by sending
   the whole table back to everybody. Two people clicking violet at the same
   moment is then not a race — the second one simply sees the table say
   violet is taken, and picks again. */
const seatsTaken = () => {
  const set = new Set([0]);                    // the host is always seat 0
  const N = window.KondriteNet;
  if (N) for (const l of N.host.links) if (l.seat != null) set.add(l.seat);
  return set;
};

const skinTaken = (skin, exceptSeat) => {
  for (const seat of seatsTaken()) {
    if (seat !== exceptSeat && skins[seat] === skin) return true;
  }
  return false;
};

// Lowest seat number nobody holds. Counting the links instead would hand a
// seat that is still in use to a newcomer, once anybody has dropped out.
function freeSeat() {
  const taken = seatsTaken();
  let seat = 1;
  while (taken.has(seat)) seat++;
  return seat;
}

function tellSeats() {
  const N = window.KondriteNet;
  if (!N) return;
  for (const l of N.host.links) {
    if (l.open && l.seat != null) {
      l.send({ t: "seats", seat: l.seat, skins, names,
               taken: [...seatsTaken()], ready, mode: roomMode }, true);
    }
  }
  seatsUI();
  if (lobbyRole === "host") paintColours();
}

// Returns whether it happened, so the asker can be told when it didn't.
function claimSkin(seat, skin) {
  if (!Number.isInteger(skin) || skin < 0 || skin >= MAX_PLAYERS) return false;
  if (skinTaken(skin, seat)) return false;
  skins[seat] = skin;
  return true;
}

function dropRemoteSeat(link) {
  if (!link || link.seat == null) return;
  const seat = link.seat;
  delete net.inputs[seat];
  // A seat that leaves takes its readiness with it, or the next person to
  // sit in it arrives already ready.
  ready[seat] = false;

  const ship = ships[seat];
  if (ship) {
    ship.input.l = ship.input.r = ship.input.th = ship.input.f = false;
    ship.burstLeft = 0;
    ship.cool = 0;
  }

  // In the lobby there is no ship to retire. During an intentional host
  // shutdown netReset clears the role before closing links, so it also lands
  // here without changing match statistics.
  if (net.role !== "host" || !inMatch() || state === "over" || !ship || ship.dead) return;

  ship.alive = false;
  ship.dead = true;
  ship.stocks = 0;
  ship.hull = 0;
  ship.survivedFor = clock;
  banner = { text: ship.name + " DISCONNECTED", sub: null,
             t: 2.2, colour: ship.colour };

  // Leaving is not a kill and does not count as an environmental death, but
  // the seat must stop participating in win/loss checks immediately.
  if (mode.pvp) checkRoyaleEnd();
  else if (ships.every(s => s.dead)) endMatch({ kind: "lost" });
}

function hostHandlers(link) {
  return {
    onOpen: () => {
      // The roster is immutable once play begins. A room-service answer can
      // finish just after the host clicks Start, so reject that late link
      // instead of leaving it connected without an init packet.
      if (inMatch()) {
        link.seat = null;
        link.die();
        return;
      }
      // A newcomer wears the first colour nobody has claimed.
      if (link.seat != null && skinTaken(skins[link.seat], link.seat)) {
        for (let i = 0; i < MAX_PLAYERS; i++) {
          if (!skinTaken(i, link.seat)) { skins[link.seat] = i; break; }
        }
      }
      say("A player connected.");
      tellSeats();
    },
    onClose: () => {
      const N = window.KondriteNet;
      const arrived = link.everOpen;
      dropRemoteSeat(link);
      const i = N.host.links.indexOf(link);
      if (i >= 0) N.host.links.splice(i, 1);
      // Somebody who never got in is not somebody who left, and saying they
      // disconnected sends the host looking for a player who was never there.
      say(arrived
            ? "A player disconnected."
            : "Somebody tried to join but couldn't reach you. They can try again.",
          true);
      tellSeats();
    },
    onMessage: msg => {
      if (msg.t === "in" && link.seat != null && Number.isInteger(msg.q) &&
          msg.q > (link.inputSeq || 0)) {
        link.inputSeq = msg.q;
        net.inputs[link.seat] = msg;
      }
      else if (msg.t === "pick" && link.seat != null) {
        claimSkin(link.seat, msg.skin);
        tellSeats();          // the table is the answer, accepted or not
      }
      else if (msg.t === "me" && link.seat != null) {
        names[link.seat] = tidyName(msg.name);
        /* An id off the wire, kept only if it is the shape of one. It is
           never trusted to be *true* — nothing here can check that — but a
           report filed against something that is not a uuid is a row the
           database refuses, and this is the cheapest place to not do that. */
        accounts[link.seat] =
          /^[0-9a-f-]{36}$/i.test(String(msg.acct || "")) ? String(msg.acct) : "";
        tellSeats();
      }
      else if (msg.t === "ready" && link.seat != null) {
        ready[link.seat] = !!msg.on;
        tellSeats();
      }
    }
  };
}

const guestHandlers = {
  onOpen: () => {
    say("Connected. Telling the host who you are…");
    window.KondriteNet.guest.send({ t: "me", name: myName, acct: myAccount() }, true);
  },
  /* The host going away means something different depending on where you are
     standing. Mid-match there is nothing to go back to but the title. In the
     lobby there is: the list you came from, which may well have another game
     on it — so put them back on it rather than leaving them looking at a
     seating plan for a game that no longer exists. */
  onClose: () => {
    netReset();
    if (lobby.hidden) { say("Disconnected from the host.", true); toTitle(); return; }
    ready = [];
    guestTaken = [0];
    lobbyRole = "guest";
    show("colourPick", false);
    show("rowReady", false);
    seatsUI();
    showRoute("room");
    say("That lobby closed. Here's what else is open.", true);
  },
  onMessage: msg => {
    if (msg.t === "init") { applyInit(msg); closeLobby(); }
    else if (msg.t === "seats") {
      net.seat = msg.seat;
      if (Array.isArray(msg.skins)) skins = msg.skins.slice();
      if (Array.isArray(msg.names)) names = msg.names.map(tidyName);
      guestTaken = Array.isArray(msg.taken) ? msg.taken : [0];
      if (Array.isArray(msg.ready)) ready = msg.ready.slice();
      if (MODES[msg.mode]) roomMode = msg.mode;
      say("You're in as " + nameOf(net.seat) +
          ", flying " + skinOf(net.seat).label.toLowerCase() +
          ". Waiting for the host to start.");
      paintColours();
      seatsUI();
    }
    else if (msg.t === "s") applySnapshot(msg);
    else if (msg.t === "r") applyRocks(msg);
  }
};

/* ── the room service ─────────────────────────────────────────────────────
   What makes online play possible at all. A host puts its game on a list and
   leaves an address; a guest picks it off the list and leaves an offer; the
   host answers. That is the service's whole job — it never sees a ship.

   Once two browsers are connected they talk directly, so the service could
   be switched off mid-match without anybody noticing. But nobody can start a
   new game without it, which is why the panel checks for it up front and
   says plainly when it isn't there.

   Left empty there is no service, and the lobby never makes a request at
   all. ?rooms=… overrides it for testing. */
/* ── the room service, and why this one word did not rename ──────────────
   A renamed worker is a *new URL*, and a client on the old one reaches a
   different room list: a host on one and a joiner on the other simply cannot
   see each other, with no error anywhere. A split room list is worse than an
   outage, because nothing announces it.

   So this waited until `kondrite-rooms` was deployed **and** the old worker
   had been replaced with a pass-through to it. Both of those are done, and
   both URLs now feed one list — measured: a room hosted on the old address
   appears on the new one and the other way round. An old client still asking
   `crossfire-rooms` is therefore looking at exactly this list, and is only
   paying one extra hop inside the runtime for it.

   The old worker is `server/passthrough/`, and it is deleted when its logs
   go quiet. Until then, never point this at anything the shim does not also
   reach. See RENAME-KONDRITE.md §2. */
const ROOM_HOST = "https://kondrite-rooms.rmbuster82.workers.dev";

const ROOM_SERVICE =
  (new URLSearchParams(location.search).get("rooms") || ROOM_HOST)
    .trim().replace(/\/+$/, "");

let roomsAlive = null, roomsAskedAt = 0;

/* Asked once when the lobby opens, then trusted for a while. It has a short
   fuse: a lobby that sits there spinning because a laptop is asleep is worse
   than one that just shows you the codes. */
async function roomsUp() {
  if (!ROOM_SERVICE) return false;
  if (roomsAlive !== null && Date.now() - roomsAskedAt < 15_000) return roomsAlive;
  roomsAskedAt = Date.now();
  try {
    const r = await fetch(ROOM_SERVICE + "/health",
                          { signal: AbortSignal.timeout(2500), cache: "no-store" });
    roomsAlive = r.ok;
  } catch (_) {
    roomsAlive = false;
  }
  return roomsAlive;
}

const roomFetch = (path, opts) => fetch(ROOM_SERVICE + path, Object.assign(
  { signal: AbortSignal.timeout(6000), cache: "no-store" }, opts));

/* How to reach the other player. Fetched when the panel opens rather than
   built into the page, because a relay's credentials expire — and asked for
   exactly once per visit, since they are good for hours and every peer this
   tab makes can share them.

   Nothing waits on this to *succeed*. A room service that is old, unwell or
   doesn't offer a relay leaves the STUN-only default in place, which is what
   every direct connection was using anyway. */
let icePromise = null;

function iceReady() {
  if (icePromise) return icePromise;
  icePromise = (async () => {
    if (!ROOM_SERVICE) return false;
    try {
      const r = await roomFetch("/ice");
      if (!r.ok) return false;
      const data = await r.json();
      return window.KondriteNet.setIce(data.iceServers);
    } catch (_) {
      return false;
    }
  })();
  return icePromise;
}

const roomPost = (path, body) => roomFetch(path, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body)
});

/* Proves to the service that later calls about a room come from whoever
   opened it. Kept across reloads on purpose: a fresh key every time would
   mean that reloading the page locks you out of your own room name until it
   expires. Never leaves this machine except to the service. */
const hostKey = (() => {
  const KEY = "kondrite.hostkey.v1";
  const make = () => Math.random().toString(36).slice(2) +
                     Math.random().toString(36).slice(2);
  try {
    let k = localStorage.getItem(KEY);
    if (!k) { k = make(); localStorage.setItem(KEY, k); }
    return k;
  } catch (_) { return make(); }
})();

/* A room id is made here and never shown to anybody. The list is how a game
   is found, so the id only has to be unique and legal — it is not a secret,
   and it is not the password. */
const newRoomId = () =>
  "g" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

/* What the room is playing. Chosen when the game is made rather than at the
   moment of starting, so it can be in the list — you should know what you
   are joining before you join it, not after everybody has readied up. */
let roomMode = "survival";

let roomWord = "", roomTimer = 0, roomTitle = "", roomPass = "";

function stopRoom() {
  if (roomTimer) { roomTimer.stop(); roomTimer = 0; }
  // Take the room down rather than letting it expire: a game that has started
  // should leave the list now, not in twenty-five seconds. Nothing waits on
  // the answer — the room expires by itself if this never lands.
  if (roomWord) {
    roomPost("/room/" + roomWord + "/close", { key: hostKey }).catch(() => {});
  }
  roomWord = "";
  roomTitle = "";
  roomPass = "";
}

/* The host's whole loop: say "still here" and collect anybody who knocked
   since last time. One request does both. */
async function hostBeat() {
  if (!roomWord) return;
  let data;
  try {
    /* The heartbeat is also the advert: it carries what the list shows and
       whether the room belongs in it at all. A match that has started stops
       being listed immediately rather than waiting to expire.

       The count it carries is players, not seats. A seat is held from the
       moment somebody knocks, so counting seats advertised a lobby as fuller
       than it was — and a room that reached its maximum in half-connected
       strangers went grey in everybody's list. */
    const r = await roomPost("/room/" + roomWord + "/host", {
      key: hostKey, name: myName,
      title: roomTitle, pass: roomPass, mode: roomMode,
      players: 1 + window.KondriteNet.host.links.filter(l => l.open).length,
      max: MAX_PLAYERS,
      listed: !inMatch()
    });
    data = await r.json();
    if (!r.ok) {
      /* Being throttled or finding the service briefly unwell is not the same
         as being refused the room. A room lives twenty-five seconds and this
         beats every two, so a few lost beats cost nothing and the next one
         puts the lobby straight back in the list. Tearing it down for those
         threw a host out of a lobby with people already sitting in it. */
      if (r.status === 429 || r.status >= 500) {
        return say("The room service is busy — your lobby may drop out of the " +
                   "list for a moment.", true);
      }
      stopRoom();
      show("makeRoute", true);
      el("btnOpenRoom").disabled = false;
      return say(data.error || "The room service turned that down.", true);
    }
  } catch (_) {
    return say("Can't reach the room service, so nobody can see your lobby.", true);
  }
  for (const join of data.joins || []) await admit(join);
}

async function admit(join) {
  const N = window.KondriteNet;
  if (N.host.links.length >= MAX_PLAYERS - 1) return;
  try {
    // Settled long before anybody knocks; awaited rather than assumed because
    // answering with the wrong ICE configuration is a connection that fails
    // for no reason the players can see.
    await iceReady();
    const made = await N.host.answer(join.offer, hostHandlers(null));
    Object.assign(made.link.h, hostHandlers(made.link));
    made.link.seat = freeSeat();
    if (join.name) names[made.link.seat] = tidyName(join.name);
    await roomPost("/room/" + roomWord + "/answer",
                   { key: hostKey, id: join.id, answer: made.code });
    seatsUI();
  } catch (_) {
    say("Somebody tried to join and it didn't take. They can try again.", true);
  }
}

async function openRoom() {
  const title = tidyTitle(el("gameName").value) ||
                (myName ? myName + "'s lobby" : "a lobby");
  const pass = el("gameLock").checked ? el("gamePass").value.trim() : "";
  if (el("gameLock").checked && pass.length < 1) {
    return say("Type a password, or untick the lock.", true);
  }
  el("btnOpenRoom").disabled = true;
  say("Opening the lobby…");
  roomWord = newRoomId();
  roomTitle = title;
  roomPass = pass;
  await hostBeat();
  if (!roomWord) return;                       // hostBeat gave up and said why
  el("roomNote").textContent = pass
    ? "locked · your friends need the password"
    : "open · anybody can join from the list";
  show("makeRoute", false);
  say(pass ? "\"" + title + "\" is up, locked."
           : "\"" + title + "\" is up. It's in the list now.");
  roomTimer = makeTicker(hostBeat, 2000);
  roomTimer.start();
  seatsUI();
}

/* ── the list ────────────────────────────────────────────────────────────
   Everything on a row came off the network, so every piece of it is written
   with textContent and nothing is ever built as markup. */
let browseTimer = 0, browsing = false, pendingJoin = null, roomsDrawn = "";

function stopBrowse() {
  if (browseTimer) { clearInterval(browseTimer); browseTimer = 0; }
  browsing = false;
  roomsDrawn = "";
}

function drawRooms(list) {
  /* Rebuilding every three seconds would throw away the row under somebody's
     finger just as they press it, so the list is only redrawn when it has
     actually changed. */
  const stamp = JSON.stringify(list);
  if (stamp === roomsDrawn) return;
  roomsDrawn = stamp;

  const box = el("roomList");
  box.replaceChildren();
  if (!list.length) {
    const p = document.createElement("div");
    p.className = "empty";
    p.textContent = "No lobbies open right now. Start one and they'll see it.";
    box.appendChild(p);
    return;
  }
  for (const room of list) {
    const full = room.players >= room.max;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "game" + (full ? " full" : "");
    b.disabled = full;

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = room.title || "a lobby";
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = room.host ? room.host : "";
    const what = document.createElement("span");
    what.className = "who";
    what.textContent = MODES[room.mode] ? MODES[room.mode].name.toLowerCase() : "";
    const count = document.createElement("span");
    count.className = "count";
    count.textContent = room.players + "/" + room.max;
    const lock = document.createElement("span");
    lock.className = "lock";
    lock.textContent = room.locked ? "LOCKED" : "OPEN";

    b.append(title, what, who, count, lock);
    b.addEventListener("click", () => pickRoom(room));
    box.appendChild(b);
  }
}

async function refreshRooms() {
  if (!browsing) return;
  try {
    const r = await roomFetch("/rooms");
    const data = await r.json();
    if (!browsing) return;
    drawRooms(Array.isArray(data.rooms) ? data.rooms : []);
  } catch (_) {
    if (browsing) say("Lost the room service. The list has stopped updating.", true);
  }
}

function startBrowse() {
  browsing = true;
  pendingJoin = null;
  roomsDrawn = "";
  show("joinPassRow", false);
  el("roomList").replaceChildren();
  refreshRooms();
  if (!browseTimer) browseTimer = setInterval(refreshRooms, 3000);
}

/* Clicking a game either goes straight in, or stops to ask for the password
   first. The password box is deliberately part of the list rather than a
   separate screen: you can see which game you are unlocking. */
function pickRoom(room) {
  if (room.locked) {
    pendingJoin = room;
    el("joinPassLabel").textContent = "password for “" + room.title + "”";
    el("joinPass").value = "";
    show("joinPassRow", true);
    el("joinPass").focus();
    return;
  }
  joinRoom(room.id, "");
}

/* An answer crossed, so somebody is there and willing. If the data channel
   still never opens, the two browsers agreed to talk and then could not
   reach each other — which is the network between them, not the host.

   This is the failure with no message at all before: the guest was told
   "Connecting…" and left on it for ever, because nothing was watching. It is
   also the most likely thing to go wrong in real use. Kondrite connects
   peers directly with STUN and no relay, which is fine between most homes and
   is not fine behind a school or office network, or on mobile data behind
   carrier NAT. Naming that is the difference between "this is broken" and
   "try the other wifi".

   The host watches the same clock from its end — one number, shared, so that
   neither side is left holding a seat open for somebody the other has already
   given up on. */
const CONNECT_GRACE = (window.KondriteNet && window.KondriteNet.grace) || 15_000;

async function watchConnection() {
  const N = window.KondriteNet;
  const until = Date.now() + CONNECT_GRACE;
  while (Date.now() < until) {
    await new Promise(done => setTimeout(done, 500));
    if (lobby.hidden) return;                       // the match already began
    const link = N.guest.link;
    if (link && link.open) return;                  // connected, nothing to say
    if (!link) return;                              // they backed out
  }
  if (lobby.hidden) return;
  const link = N.guest.link;
  if (link && link.open) return;

  N.guest.close();
  netReset();
  ready = [];
  guestTaken = [0];
  lobbyRole = "guest";
  show("colourPick", false);
  show("rowReady", false);
  seatsUI();
  showRoute("room");
  startBrowse();
  say("Reached the host, but your two devices couldn't connect to each other. " +
      "A school, office or mobile network usually blocks this — try another wifi.", true);
}

async function joinRoom(id, pass) {
  const N = window.KondriteNet;
  if (!id) return;
  stopBrowse();
  say("Knocking…");
  try {
    await iceReady();
    const offer = await N.guest.offer(guestHandlers);
    const r = await roomPost("/room/" + id + "/join",
                             { offer, name: myName, pass });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "That lobby didn't answer.");

    // The host answers on its next heartbeat, so this is a couple of seconds
    // at worst. Twenty tries at half a second is a generous ceiling.
    for (let i = 0; i < 20; i++) {
      await new Promise(done => setTimeout(done, 500));
      const p = await roomFetch("/room/" + id + "/join/" + data.id);
      const got = await p.json();
      if (got.answer) {
        await N.guest.take(got.answer);
        say("Found them. Connecting…");
        show("browseRoute", false);
        watchConnection();
        return;
      }
      if (!p.ok) throw new Error(got.error || "That lobby went away.");
    }
    /* Reaching here means nobody ever collected the knock, which is a host
       that has gone away — not a network problem. The other failure, where
       the host answers and the two browsers still cannot reach each other,
       is caught by watchConnection below. Telling both of them "is the host
       still there?" sent people looking in the wrong place. */
    throw new Error("That host isn't answering — they may have closed the lobby.");
  } catch (e) {
    window.KondriteNet.guest.close();
    say(e.message || "That didn't work.", true);
    // Back to the list — whatever went wrong, another game may be fine.
    show("joinPassRow", false);
    startBrowse();
  }
}

/* Readiness is the guest's own claim, so it is sent and then echoed back in
   the next seat broadcast rather than assumed locally — the host's table is
   the one that decides whether START lights up. */
el("btnReady").addEventListener("click", () => {
  const N = window.KondriteNet;
  if (!N || !N.guest.link || !N.guest.link.open) return;
  const on = !ready[net.seat];
  ready[net.seat] = on;
  N.guest.send({ t: "ready", on }, true);
  seatsUI();
});

el("btnOpenRoom").addEventListener("click", openRoom);
el("btnRefresh").addEventListener("click", refreshRooms);
el("btnJoinCancel").addEventListener("click", () => {
  pendingJoin = null;
  show("joinPassRow", false);
  say("");
});
el("btnJoinPass").addEventListener("click", () => {
  if (pendingJoin) joinRoom(pendingJoin.id, el("joinPass").value);
});
el("joinPass").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); el("btnJoinPass").click(); }
});
el("gameName").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); openRoom(); }
});
/* The mode picker in the create panel. Battle royale needs somebody to fight,
   so the note says so up front rather than refusing at the moment you press
   start with everybody watching. */
function paintModePick() {
  for (const b of el("modePick").querySelectorAll("button")) {
    const mine = b.dataset.pick === roomMode;
    b.className = mine ? "mine" : "";
    b.setAttribute("aria-pressed", mine ? "true" : "false");
  }
  el("modeNote").textContent = MODES[roomMode].blurb;
  show("onlineFriendlyFire", roomMode === "survival");
}

el("modePick").addEventListener("click", e => {
  const pick = e.target.dataset && e.target.dataset.pick;
  if (!pick || !MODES[pick]) return;
  roomMode = pick;
  paintModePick();
});

el("gameLock").addEventListener("change", () => {
  const on = el("gameLock").checked;
  show("gamePass", on);
  if (on) el("gamePass").focus();
});

// The host button lives in the list: you look for a game first, and start
// one when there isn't the one you wanted.
el("btnHostGame").addEventListener("click", () => {
  lobbyRole = "host";
  names[0] = myName;
  stopBrowse();
  showRoute("room");
  // Becoming the host is where seat 0 becomes yours, so it is also where the
  // ship colours and the mode become things you can choose.
  paintColours();
  paintModePick();
  seatsUI();
  el("gameName").focus();
});

// Changed your mind before opening anything: back to the list you came from.
el("btnBackToList").addEventListener("click", () => {
  lobbyRole = "guest";
  stopRoom();
  show("colourPick", false);
  showRoute("room");
  say("");
});

/* Which way in the panel is offering. A host names a game; everybody else
   reads the list. There is nothing else — an invite code is a thing the room
   service carries between two browsers, not a thing anybody has to hold. */
function showRoute(which) {
  const room = which === "room";
  const host = lobbyRole === "host";
  show("makeRoute", room && host);
  show("browseRoute", room && !host);
  show("hostNote", host);
  if (room && !host) startBrowse(); else stopBrowse();
  el("roomNote").textContent = "";
  el("lobbyTitle").textContent = host ? "HOST A LOBBY" : "PLAY ONLINE";
  el("lobbyHint").textContent = host
    ? "Name it, lock it if you want, and it appears in everyone's list."
    : "Pick a lobby to join, or start one of your own.";
  show("lobbyHint", true);
}

/* One door in. You arrive at the list of lobbies and either join one or start
   your own, and only then are you a host — which is why `role` is a default
   here rather than a choice made on the title screen. */
/* Online is behind the door too, and by the same argument as `openWithPeople`:
   "before single player and before multiplayer". Gated here rather than on
   the keys that reach it, because there are several of those — the title's
   O, the simulators page's O, and the multiplayer lane's own card — and a
   door with a way round it is a fence. Once through, `needsDoor` is false
   and this costs nothing. */
function openLobby(role) {
  if (needsDoor()) { openAccount(() => openLobby(role)); return; }
  const N = window.KondriteNet;
  role = role === "host" ? "host" : "guest";
  lobbyRole = role;
  ready = [];
  lobby.hidden = false;
  paintFriendlyFireButton();
  el("lobbyTitle").textContent = role === "host" ? "HOST A LOBBY" : "PLAY ONLINE";
  el("lobbyHint").textContent = role === "host"
    ? ""
    : "Pick a lobby to join, or start one of your own.";
  show("lobbyHint", role !== "host");

  /* Your name and ship first — it's the only part that's about you, and the
     rest of the panel is a sequence you work down.

     A player who has just told the door what to call them should not be
     asked again three screens later, so the pilot name fills this in when
     there is nothing in it. It seeds rather than overrides: the lobby name
     is still theirs to change, and a name they have already chosen here is
     not silently replaced. */
  if (!myName && cloud && cloud.session() && cloud.session().name) {
    myName = tidyName(cloud.session().name);
    saveName();
  }
  nameInput.value = myName;
  if (role === "host") names[0] = myName;

  // The host owns the simulation, so only the host needs the keep-open note.
  show("hostNote", role === "host");
  el("youLabel").textContent = role === "host"
    ? "1. Enter your name and choose a ship."
    : "Your name";
  el("seatTitle").textContent = role === "host" ? "Players" : "Who's here";

  const order = { lobbyTitle: 1, lobbyHint: 2, hostNote: 2, youBlock: 3,
                  makeRoute: 4, browseRoute: 4,
                  lobbyStatus: 11, seatWrap: 12,
                  rowReady: 13, rowStart: 13, rowClose: 14 };
  for (const id in order) { const n = el(id); if (n) n.style.order = order[id]; }

  // Clear the panel down before anything is started, or the reset below
  // stops the list this function has just asked for.
  el("gameName").value = "";
  el("gameLock").checked = false;
  el("gamePass").value = "";
  show("gamePass", false);
  roomMode = "survival";
  paintModePick();
  el("btnOpenRoom").disabled = false;
  el("roomNote").textContent = "";
  show("joinPassRow", false);
  stopRoom();
  stopBrowse();

  /* Online is the room list and nothing else, so the panel has one thing to
     say when there is no room service: it isn't there. Saying so beats a list
     that never arrives. */
  showRoute("room");
  // Started now so it has settled by the time anybody clicks a lobby.
  iceReady();
  roomsUp().then(up => {
    if (lobby.hidden || lobbyRole !== role) return;   // they moved on
    if (!up) {
      stopBrowse();
      show("browseRoute", false);
      show("makeRoute", false);
      say(ROOM_SERVICE
            ? "The room service isn't answering, so there are no lobbies to show."
            : "No room service is configured, so online play is off here.", true);
    }
  });

  show("rowStart", false);
  show("rowReady", false);
  say(N && N.supported ? "" : "This browser has no WebRTC, so online play won't work here.",
      !(N && N.supported));
  // The host can choose a ship before anyone arrives; a guest has nothing to
  // choose from until the host has told it what the seating plan is.
  if (role === "host") paintColours(); else show("colourPick", false);
  seatsUI();
}

function closeLobby() {
  // A room is only worth holding while somebody is sitting in the lobby.
  stopRoom();
  stopBrowse();
  lobby.hidden = true;
}
