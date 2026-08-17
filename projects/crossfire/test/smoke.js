#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const url = require("node:url");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../../..");
const PROJECT = path.join(ROOT, "projects/crossfire");
const INDEX = path.join(PROJECT, "index.html");
const NET = path.join(PROJECT, "net.js");
const ROOMS = path.join(PROJECT, "server/rooms.js");
const CORE = path.join(PROJECT, "server/rooms-core.mjs");
const WORKER = path.join(PROJECT, "server/worker.mjs");
const WRANGLER = path.join(PROJECT, "server/wrangler.jsonc");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function checkSyntax() {
  new vm.Script(read(NET), { filename: "net.js" });
  new vm.Script(read(ROOMS), { filename: "rooms.js" });

  const html = read(INDEX);
  const scripts = [...html.matchAll(
    /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
  )];
  assert.equal(scripts.length, 1, "expected one inline game script");
  new vm.Script(scripts[0][1], { filename: "index.inline.js" });

  assert.doesNotMatch(html, /MATCH_TIME|timeUp\(/,
    "Battle Royale must not end on a timer");
  assert.match(html, /blurb: "two-hit hulls · no time limit · the wall closes in"/,
    "Battle Royale must advertise that it has no time limit");
  assert.match(html, /const BURST_SIZE\s*=\s*3;/, "weapons must stay three-round bursts");
  assert.match(html, /const ROYALE_HULL\s*=\s*2;/, "Battle Royale must use two-hit hulls");
  assert.match(html, /cause === "shot" \|\| cause === "rock"/,
    "only shots and asteroid collisions should use the Battle Royale hull");
  assert.doesNotMatch(html, /HULL HIT/, "ordinary hull hits must not interrupt the match");
  assert.match(html, /if \(s\.localKeys\)\s*{\s*text\("HULL /s,
    "the HUD must hide remote and bot hull strength");
  assert.match(html, /kf:\s*killFeed\.map/,
    "Battle Royale death notifications must synchronize online");
  assert.doesNotMatch(html, /text\("×" \+ s\.kills/,
    "live ship rows must not show a stray kill multiplier");
  assert.match(html, /fill: h\.fill, size: h\.size/, "hazard visuals must reach guests");
  assert.match(html, /get\("debug"\) === "1"/, "debug API must remain opt-in");
  assert.match(
    html,
    /body\.touch\s*{[^}]*user-select:\s*none;/s,
    "mobile game surface must not select text"
  );
  assert.match(
    html,
    /body\.touch #lobby input\s*{[^}]*user-select:\s*text;/s,
    "lobby name and password fields must stay editable on mobile"
  );
  // The paste route is gone, so nothing in the lobby is a code any more. Its
  // markup, its styling and the strings that promised it all have to go too —
  // a fallback that no longer exists must not be offered to anybody.
  assert.doesNotMatch(html, /<textarea|#lobby textarea/,
    "the lobby must not carry the deleted paste route");
  assert.doesNotMatch(html, /join by code|codes still work/,
    "the lobby must not offer a manual-code fallback that no longer exists");
  assert.match(html, /const MODE_KEYS = \["survival", "royale"\];/,
    "Survival and Battle Royale must be the only top-level modes");
  assert.doesNotMatch(html, /MODES\.safe|data-mode="safe"|SURVIVAL — SAFE/,
    "friendly-fire-free Survival must not remain a separate mode");
  assert.match(html, /FRIENDLY FIRE: " \+ \(survivalFriendlyFire \? "ON" : "OFF"\)/,
    "Survival setup must expose its friendly-fire toggle");
  assert.match(html, /friendlyFire: mode\.friendlyFire/,
    "online initialization must synchronize the Survival setting");
  assert.match(html, /tapButton\("PLAY"[\s\S]*?startCountChoice/s,
    "the setup screen must use an explicit Play button");
  assert.match(html, /tapButton\(replayLabel[\s\S]*?playAgain/s,
    "results must offer Play Again");
  assert.match(html, /tapButton\("MAIN MENU"[\s\S]*?leaveMatch/s,
    "results must retain a full session exit");
  assert.match(html, /seated\.forEach\(l => l\.send\(initPacket\(l\.seat\), true\)\);/,
    "online Play Again must initialize every guest");
  assert.match(html, /function hazardActive\(h\)[\s\S]*?h\.x >= bounds\.x0/s,
    "shrinking-wall hazard activity must use the live arena");
  assert.match(html, /for \(const h of hazards\) \{\s*if \(!hazardActive\(h\)\) continue;/s,
    "gravity must ignore hazards outside the live arena");
  assert.match(html, /const p = respawnPoint\(ship\);/,
    "respawns must choose a point inside the current wall");
  assert.match(html, /rand\(bounds\.x0 \+ margin, bounds\.x1 - margin\)/,
    "fallback respawns must retain distance from the current wall");
  assert.match(html, /const SOUND_STORE = "crossfire\.sound\.v1";/,
    "sound preference must persist");
  assert.match(html, /window\.AudioContext \|\| window\.webkitAudioContext/,
    "sound effects must use the dependency-free Web Audio path");
  assert.match(html, /gameSound\("shot", ship\.x\)/,
    "weapon fire must produce sound");
  assert.match(html, /gameSound\("explode", ship\.x\)/,
    "ship destruction must produce sound");
  assert.match(html, /fx: soundEvents\.filter/,
    "online snapshots must carry recent sound events");
  assert.match(html, /e\[0\] <= net\.lastSoundSeq/,
    "online sound events must not replay twice");
  assert.match(html, /document\.documentElement\.requestFullscreen/,
    "fullscreen must include the game and its touch controls");
  assert.match(html, /document\.exitFullscreen \|\| document\.webkitExitFullscreen/,
    "fullscreen must have an exit path");
  assert.match(html, /tapButton\(fullscreenLabel\(\)/,
    "fullscreen must be exposed as a visible game control");
  assert.match(html, /else if \(net\.role === "host"\) readSimulationInput\(\);/,
    "the host must keep remote and bot input current while its menu is open");
  assert.match(html, /t: "s", q: \+\+net\.outSnapSeq/,
    "snapshots must carry a monotonic sequence");
  assert.match(html, /t: "r", q: \+\+net\.outRockSeq/,
    "rock packets must carry a monotonic sequence");
  assert.match(html, /t: "in", q: \+\+net\.outInputSeq/,
    "guest input packets must carry a monotonic sequence");
  assert.match(html, /msg\.q <= net\.lastSnapSeq/,
    "stale snapshots must be rejected");
  assert.match(html, /msg\.q <= net\.lastRockSeq/,
    "stale rock packets must be rejected");
  assert.match(html, /msg\.q > \(link\.inputSeq \|\| 0\)/,
    "stale guest input packets must be rejected");
  assert.match(html, /const compactNames = \[names\[0\], \.\.\.seated\.map/,
    "lobby names must compact with seats");
  assert.match(html, /if \(inMatch\(\)\)\s*{\s*link\.seat = null;\s*link\.die\(\);/s,
    "connections that finish after match start must be rejected");
  assert.match(html, /s\.vx \+= \(vx - s\.vx\) \* blend/,
    "guest prediction must absorb authoritative impact velocity");
  assert.match(html, /ships\.filter\(s => s\.localKeys && !s\.bot\)/,
    "local control checks must cover every keyboard player");
  assert.match(html, /const dx = sepX\(o\.x, s\.x\), dy = sepY\(o\.y, s\.y\)/,
    "bot targeting must use wrapped arena distance");

  /* ── the closing wall, and where a ship is allowed to appear ───────────────
     Four bugs lived here, all of them invisible from the viewport and all of
     them found by stepping a match with a fake clock and checking the numbers.
     These assertions exist so the arithmetic cannot quietly come back. */

  // A moving wall must be able to push and unable to keep. Reflecting only the
  // speed a body already had let the wall overtake anything slow and carry it.
  assert.match(html, /const wallPush = \{ x: 0, y: 0 \};/,
    "the wall must publish how fast it is closing");
  assert.match(html, /wallPush\.x = moving \? \(arena\.w \/ 2\) \* \(1 - CLOSE_TO\) \/ CLOSE_TIME/,
    "the wall's closing speed must come from the same numbers that move it");
  assert.match(html, /const off = \(v, push\) => Math\.max\(Math\.abs\(v\) \* restitution, push\);/,
    "a bounce must never return less than the wall's own speed");
  assert.ok(/const WALL_SHOVE = ([\d.]+);/.test(html), "the wall shove must be named");
  assert.ok(Number(/const WALL_SHOVE = ([\d.]+);/.exec(html)[1]) > 1,
    "leaving at exactly the wall's speed still rides the wall — it must exceed it");

  // Spawning is three rules, and only one of them may be bent.
  assert.doesNotMatch(html, /ship\.respawn < -3/,
    "a spawn must never be forced into a spot that failed its own check");
  assert.match(html, /Math\.hypot\(x - h\.x, y - h\.y\) - h\.reach/,
    "spawn clearance must be measured from a hazard's pull, not its kill radius");
  assert.match(html, /function clearRocksAt\(/,
    "rocks must be the thing that gives way when nothing is clear");
  assert.match(html, /const outOfWells = scored\.filter\(c => c\.well >= 0\);/,
    "spawn selection must prefer points outside every gravity well");
  assert.match(html, /if \(mode\.hazards\) \{\s*\n\s*for \(const s of ships\) \{/,
    "the opening spawn ring must be rechecked once hazards and rocks exist");

  /* Online failure has two causes that look identical from the guest's seat,
     and one of them used to have no message at all. */
  assert.match(html, /async function watchConnection\(\)/,
    "a guest must not be left on \"Connecting…\" for ever");
  assert.match(html, /That host isn't answering/,
    "no answer at all must be reported as an absent host");
  assert.match(html, /couldn't connect to each other/,
    "an answered knock that never opens must be reported as a network problem");

  /* The field idling behind the menus is decoration, and decoration must not be
     able to reach the match. Three things keep it honest: it is drawn only on
     screens with no world of their own, it keeps its own arrays rather than
     borrowing the match's, and it stays faint enough that menu text over it
     still clears contrast. */
  assert.match(html, /const menu = state === "title" \|\| state === "count" \|\|/,
    "the idling field must be gated to menu screens");
  assert.match(html, /if \(menu\) drawDrift\(/,
    "the idling field must be drawn behind menus only");
  assert.doesNotMatch(html, /function driftStep[\s\S]*?\brocks\.push\b[\s\S]*?function drawDrift/,
    "the idling field must not push into the match's own rock list");
  assert.match(html, /prefers-reduced-motion: reduce/,
    "the idling field must stop moving when less motion is asked for");
  const driftAlpha = /const DRIFT_ALPHA = ([\d.]+);/.exec(html);
  assert.ok(driftAlpha, "the idling field must keep a single named opacity");
  assert.ok(Number(driftAlpha[1]) <= 0.35,
    "the idling field must stay faint enough for menu text to read over it");

  const roomSource = read(ROOMS);
  assert.match(roomSource, /const TRUST_PROXY = process\.env\.TRUST_PROXY === "1";/,
    "proxy trust must be an explicit operator choice");
  assert.match(roomSource, /if \(!TRUST_PROXY\) return peer;/,
    "direct room-service clients must not control their rate-limit address");
  assert.doesNotMatch(html, /Three minutes|!urgent \|\| true/, "stale release code remains");
}

class FakeChannel {
  constructor(label) {
    this.label = label;
    this.readyState = "connecting";
  }

  addEventListener() {}
  send() {}
}

let peerSequence = 0;

// A browser publishes a random name rather than your real local address; the
// compact encoding packs the UUID in it down to 16 bytes and must rebuild it.
const MDNS_NAME = "4f3c1a2b-5d6e-4f70-8192-a3b4c5d6e7f8.local";

class FakePeer {
  constructor() {
    this.id = ++peerSequence;
    this.connectionState = "new";
    this.iceGatheringState = "complete";
    this.events = {};
  }

  addEventListener(type, listener) {
    this.events[type] = listener;
  }

  createDataChannel(label) {
    return new FakeChannel(label);
  }

  /* One of every kind of candidate a real browser produces, because the compact
     encoding keeps them by type and has already lost one that way: relay
     candidates were dropped on the grounds that there was no TURN server, which
     stopped being true without this noticing. A relayed address is the only
     route two players behind carrier NAT have, and losing it fails silently. */
  description(type, setup) {
    return {
      type,
      sdp: [
        `a=ice-ufrag:test${this.id}`,
        `a=ice-pwd:password${this.id}`,
        "a=fingerprint:sha-256 00:11:22:33",
        `a=setup:${setup}`,
        "a=candidate:1 1 udp 2130706431 192.168.1.5 50000 typ host",
        "a=candidate:2 1 udp 2113937151 " + MDNS_NAME + " 50001 typ host",
        "a=candidate:3 1 udp 1677729535 203.0.113.7 50002 typ srflx " +
          "raddr 192.168.1.5 rport 50000",
        "a=candidate:4 1 udp 41885439 198.51.100.9 50003 typ relay " +
          "raddr 203.0.113.7 rport 50002",
        // Component 2 is RTCP, which this game never uses and must not carry.
        "a=candidate:5 2 udp 2130706430 192.168.1.5 50004 typ host"
      ].join("\r\n") + "\r\n"
    };
  }

  async createOffer() {
    return this.description("offer", "actpass");
  }

  async createAnswer() {
    return this.description("answer", "active");
  }

  async setLocalDescription(description) {
    this.localDescription = description;
  }

  async setRemoteDescription(description) {
    this.remoteDescription = description;
  }

  close() {
    this.connectionState = "closed";
    if (this.events.connectionstatechange) this.events.connectionstatechange();
  }
}

function transportContext() {
  const context = {
    window: {},
    RTCPeerConnection: FakePeer,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Response,
    JSON,
    Math,
    String,
    Set,
    Promise,
    setTimeout,
    clearTimeout,
    btoa: value => Buffer.from(value, "binary").toString("base64"),
    atob: value => Buffer.from(value, "base64").toString("binary")
  };
  vm.createContext(context);
  vm.runInContext(read(NET), context, { filename: "net.js" });
  return context;
}

async function checkTransport() {
  const context = transportContext();
  const network = context.window.CrossfireNet;
  let hostClosed = 0;

  const invite = await network.host.invite({ onClose: () => hostClosed++ });
  assert.match(invite, /^C1p/, "new invite should use compact plain encoding");
  await assert.rejects(
    network.host.invite({}),
    /still waiting/,
    "an unanswered invite must not be overwritten"
  );

  const answer = await network.guest.join(invite, {});
  assert.match(answer, /^C1p/, "new answer should use compact plain encoding");

  /* What the far side actually received. Every address the browser offered has
     to survive the round trip, because each one is the only route for somebody:
     the mDNS name is what works on one wifi and between two tabs on one machine,
     the reflexive address is what works between two homes, and the relay is the
     only thing that works for anyone the other two have failed. */
  const crossed = network.guest.link.pc.remoteDescription.sdp;
  assert.match(crossed, /198\.51\.100\.9 50003 typ relay/,
    "a relay candidate did not survive the compact encoding");
  assert.match(crossed, /203\.0\.113\.7 50002 typ srflx/,
    "a reflexive candidate did not survive the compact encoding");
  assert.match(crossed, /192\.168\.1\.5 50000 typ host/,
    "a host candidate did not survive the compact encoding");
  assert.ok(crossed.includes(MDNS_NAME + " 50001 typ host"),
    "an mDNS candidate did not survive the compact encoding");
  assert.ok(!crossed.includes("50004"),
    "an RTCP candidate was carried across and should not have been");
  assert.equal((crossed.match(/^a=candidate:/gm) || []).length, 4,
    "wrong number of candidates crossed");

  await network.host.accept(answer);
  assert.equal(network.host.links.length, 1, "offer/answer round trip did not connect");

  const link = network.host.links[0];
  link.pc.connectionState = "disconnected";
  link.pc.events.connectionstatechange();
  assert.equal(link.dead, undefined, "recoverable disconnect closed immediately");
  link.pc.connectionState = "connected";
  link.pc.events.connectionstatechange();
  assert.equal(link.dead, undefined, "reconnected link was closed");
  link.pc.connectionState = "failed";
  link.pc.events.connectionstatechange();
  assert.equal(link.dead, true, "failed link remained open");
  assert.equal(hostClosed, 1, "host close handler did not run exactly once");

  network.reset();
}

function waitForService(child) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error("room service did not start")), 4000);

    child.stdout.on("data", chunk => {
      output += chunk;
      const match = /CROSSFIRE rooms on http:\/\/localhost:(\d+)/.exec(output);
      if (!match) return;
      clearTimeout(timeout);
      resolve(Number(match[1]));
    });
    child.once("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", code => {
      if (code === null || output.includes("CROSSFIRE rooms on")) return;
      clearTimeout(timeout);
      reject(new Error(`room service exited with ${code}`));
    });
  });
}

async function checkRoomService() {
  const child = spawn(process.execPath, [ROOMS], {
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    const port = await waitForService(child);
    const base = `http://127.0.0.1:${port}`;
    const allowedOrigin = "http://127.0.0.1:8000";

    const health = await fetch(`${base}/health`, {
      headers: { Origin: allowedOrigin }
    });
    assert.equal(health.status, 200, "allowed health check failed");
    assert.equal(
      health.headers.get("access-control-allow-origin"),
      allowedOrigin,
      "allowed origin was not echoed"
    );

    const blocked = await fetch(`${base}/health`, {
      headers: { Origin: "https://example.invalid" }
    });
    assert.equal(blocked.status, 403, "unapproved browser origin was accepted");
    assert.equal(
      blocked.headers.get("access-control-allow-origin"),
      null,
      "blocked origin received a CORS grant"
    );

    const oversized = await fetch(`${base}/room/test/host`, {
      method: "POST",
      headers: { Origin: allowedOrigin, "content-type": "application/json" },
      body: JSON.stringify({ key: "x".repeat(13_000) })
    });
    assert.equal(oversized.status, 400, "oversized body was not rejected cleanly");

    /* Without TRUST_PROXY the socket address is the caller, so a fresh
       X-Forwarded-For on every request must not buy a fresh bucket. Run well
       past the bucket to prove the header is being ignored rather than merely
       that the run was short. */
    let throttled = false;
    for (let i = 0; i < 400; i++) {
      const request = await fetch(`${base}/room/test/missing`, {
        headers: { "x-forwarded-for": `198.51.100.${i % 255}` }
      });
      if (request.status === 429) { throttled = true; break; }
      assert.equal(request.status, 404, "unexpected response before rate limit");
    }
    assert.equal(throttled, true,
      "rotating spoofed forwarded addresses bypassed the default throttle");
  } finally {
    child.kill("SIGTERM");
  }
}

/* The room list is the part strangers see, so what it does and does not carry
   is worth pinning down: a locked room appears, says it is locked, and never
   ships the password or its salt to anybody. */
async function checkRoomList() {
  const child = spawn(process.execPath, [ROOMS], {
    env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const offer = "C1p" + "A".repeat(40);

  try {
    const port = await waitForService(child);
    const base = `http://127.0.0.1:${port}`;
    const origin = "http://127.0.0.1:8000";
    const head = { Origin: origin, "content-type": "application/json" };
    const post = (path, body) => fetch(`${base}${path}`, {
      method: "POST", headers: head, body: JSON.stringify(body)
    });

    const empty = await (await fetch(`${base}/rooms`, { headers: head })).json();
    assert.deepEqual(empty.rooms, [], "a fresh service listed rooms");

    await post("/room/glocked/host",
               { key: "k1", name: "Ric", title: "Ric's game", pass: "otter",
                 mode: "royale" });
    await post("/room/gopen/host", { key: "k2", name: "Guest", title: "Open one" });

    const listed = await (await fetch(`${base}/rooms`, { headers: head })).json();
    assert.equal(listed.rooms.length, 2, "both rooms should be listed");
    const locked = listed.rooms.find(r => r.id === "glocked");
    assert.equal(locked.locked, true, "a room with a password must say so");
    assert.equal(locked.title, "Ric's game", "the room title was not carried");
    assert.equal(locked.mode, "royale", "the room's mode was not carried");
    assert.equal(listed.rooms.find(r => r.id === "gopen").mode, "survival",
      "a room that named no mode should read as survival");
    assert.equal(listed.rooms.find(r => r.id === "gopen").locked, false,
      "a room without a password must not read as locked");
    assert.equal(JSON.stringify(listed).includes("otter"), false,
      "the list leaked a room password");
    assert.equal(/salt|hash/i.test(JSON.stringify(listed)), false,
      "the list leaked password material");

    // An open room takes anybody; a locked one takes only the right password.
    assert.equal((await post("/room/gopen/join", { offer })).status, 200,
      "an open room refused a join");
    assert.equal((await post("/room/glocked/join", { offer, pass: "wrong" })).status, 403,
      "a locked room accepted the wrong password");
    assert.equal((await post("/room/glocked/join", { offer, pass: "otter" })).status, 200,
      "a locked room refused the right password");

    // Guessing stops being answered long before a short password falls.
    let lockedOut = false;
    for (let i = 0; i < 20; i++) {
      const r = await post("/room/glocked/join", { offer, pass: `no${i}` });
      if (r.status === 429) { lockedOut = true; break; }
    }
    assert.equal(lockedOut, true, "wrong passwords were never throttled");

    // Only the room's owner can take it down, and once down it is not listed.
    assert.equal((await post("/room/gopen/close", { key: "not-the-key" })).status, 403,
      "a stranger closed somebody else's room");
    assert.equal((await post("/room/gopen/close", { key: "k2" })).status, 200,
      "the owner could not close its own room");
    const after = await (await fetch(`${base}/rooms`, { headers: head })).json();
    assert.equal(after.rooms.some(r => r.id === "gopen"), false,
      "a closed room stayed in the list");

    // A room that has started asks to be left out of the list.
    await post("/room/glocked/host",
               { key: "k1", name: "Ric", title: "Ric's game", listed: false });
    const hidden = await (await fetch(`${base}/rooms`, { headers: head })).json();
    assert.equal(hidden.rooms.length, 0, "an unlisted room was still listed");
  } finally {
    child.kill("SIGTERM");
  }
}

/* ── the service, without either set of plumbing ─────────────────────────────
   Everything above reaches the service through the laptop runner's node:http
   server. Cloudflare runs the same rules behind completely different plumbing,
   so the rules are worth testing on their own — this is the code path that is
   live for everybody, and it can be exercised without an account, a network or
   wrangler. `handle` is handed the caller's address rather than digging one
   out, because only the runtime knows which header it is allowed to believe. */
async function checkCore() {
  const { createRooms, ALLOWED } = await import(url.pathToFileURL(CORE).href);
  const origin = "https://ricmassey.com";
  assert.equal(ALLOWED.has(origin), true, "the live site must be allowed to call this");

  const rooms = createRooms();
  const head = { Origin: origin, "content-type": "application/json" };
  const at = (ip, path, init) =>
    rooms.handle(new Request("https://rooms.invalid" + path, init), ip);
  const post = (ip, path, body) =>
    at(ip, path, { method: "POST", headers: head, body: JSON.stringify(body) });
  const get = (ip, path) => at(ip, path, { headers: { Origin: origin } });

  assert.equal((await get("1.1.1.1", "/health")).status, 200, "health check failed");

  /* The whole of matchmaking, which is the one thing no test covered before
     the service learned to run in two places: a guest leaves an offer, the
     host collects it on its next heartbeat, answers it, and the guest picks
     the answer up. After that the two browsers are talking and this is done. */
  const offer = "C1p" + "A".repeat(40);
  const answer = "C1p" + "B".repeat(40);

  await post("1.1.1.1", "/room/ghandshake/host", { key: "k1", name: "Ric" });
  const knock = await (await post("2.2.2.2", "/room/ghandshake/join",
                                  { offer, name: "Guest" })).json();
  assert.equal(typeof knock.id, "string", "the guest was given no join id");

  const beat = await (await post("1.1.1.1", "/room/ghandshake/host", { key: "k1" })).json();
  assert.equal(beat.joins.length, 1, "the host was not handed the waiting offer");
  assert.equal(beat.joins[0].offer, offer, "the offer was altered in transit");
  assert.equal(beat.joins[0].name, "Guest", "the guest's name did not travel");

  const again = await (await post("1.1.1.1", "/room/ghandshake/host", { key: "k1" })).json();
  assert.equal(again.joins.length, 0, "the same offer was handed over twice");

  assert.equal((await (await get("2.2.2.2", `/room/ghandshake/join/${knock.id}`)).json()).waiting,
    true, "the guest was told to stop waiting before there was an answer");

  assert.equal((await post("3.3.3.3", "/room/ghandshake/answer",
    { key: "not-the-key", id: knock.id, answer })).status, 403,
    "a stranger answered somebody else's join");
  assert.equal((await post("1.1.1.1", "/room/ghandshake/answer",
    { key: "k1", id: knock.id, answer })).status, 200, "the host could not answer");

  const got = await (await get("2.2.2.2", `/room/ghandshake/join/${knock.id}`)).json();
  assert.equal(got.answer, answer, "the answer did not reach the guest");
  assert.equal((await get("2.2.2.2", `/room/ghandshake/join/${knock.id}`)).status, 404,
    "a collected answer was left lying around for a second caller");

  // A locked room still says nothing about its password to anyone who lists it.
  await post("1.1.1.1", "/room/glocked/host",
             { key: "k2", name: "Ric", title: "Locked", pass: "otter" });
  const listed = await (await get("2.2.2.2", "/rooms")).json();
  assert.equal(listed.rooms.find(r => r.id === "glocked").locked, true,
    "a room with a password did not say so");
  assert.equal(/otter|salt|hash/i.test(JSON.stringify(listed)), false,
    "the list leaked password material");
  assert.equal((await post("2.2.2.2", "/room/glocked/join", { offer, pass: "wrong" })).status,
    403, "a locked room accepted the wrong password");
  assert.equal((await post("2.2.2.2", "/room/glocked/join", { offer, pass: "otter" })).status,
    200, "a locked room refused the right password");

  /* An address is a house, not a person: everybody on one wifi arrives here as
     the same caller. So the limiter has to fit the worst sensible room — five
     players on one router, the host beating every 2s and four guests refreshing
     every 3s — which is about 110 requests a minute before anyone does anything
     unusual. Counted as a burst, because a join adds twenty in ten seconds.

     This is written as the requirement rather than the constant on purpose: the
     first version allowed 30 a minute, which throttled a family out of their own
     game, and the way to not do that again is to state the room, not the number. */
  const household = 30 + 4 * 20;
  const fresh = createRooms();
  const busy = ip => fresh.handle(new Request("https://rooms.invalid/rooms",
                                              { headers: { Origin: origin } }), ip);
  for (let i = 0; i < household; i++) {
    assert.equal((await busy("5.5.5.5")).status, 200,
      `one household was throttled after ${i} requests in a minute`);
  }

  /* It must still stop somewhere, and stopping one caller must not stop the
     rest — otherwise anybody could shut the list for everybody. */
  let throttled = false;
  for (let i = 0; i < 400; i++) {
    if ((await get("9.9.9.9", "/rooms")).status === 429) { throttled = true; break; }
  }
  assert.equal(throttled, true, "one address was never throttled");
  assert.equal((await get("8.8.8.8", "/rooms")).status, 200,
    "throttling one caller shut out everybody else");
}

/* The Worker is plumbing, but two things about it are worth pinning: that it
   runs the shared core at all, and that it always names the same Durable
   Object. A Worker is many isolates in many places; the moment two of them can
   own different lists, a room opened in one is invisible from the other. */
async function checkWorker() {
  const worker = await import(url.pathToFileURL(WORKER).href);
  assert.equal(typeof worker.default.fetch, "function", "the Worker has no fetch");
  assert.equal(typeof worker.RoomList, "function",
    "the Durable Object class must be exported for Cloudflare to find it");

  const made = new Map();
  const names = [];
  const env = {
    ROOMS: {
      idFromName(name) { names.push(name); return name; },
      get(name) {
        if (!made.has(name)) made.set(name, new worker.RoomList());
        return made.get(name);
      }
    }
  };

  const origin = "https://ricmassey.com";
  const call = (path, init) => worker.default.fetch(
    new Request("https://rooms.invalid" + path, init), env
  );

  await call("/room/gworker/host", {
    method: "POST",
    headers: { Origin: origin, "content-type": "application/json",
               "CF-Connecting-IP": "1.1.1.1" },
    body: JSON.stringify({ key: "k1", name: "Ric", title: "Through the Worker" })
  });
  const listed = await (await call("/rooms", {
    headers: { Origin: origin, "CF-Connecting-IP": "2.2.2.2" }
  })).json();

  assert.equal(listed.rooms.length, 1,
    "a room hosted through the Worker was not visible on the next request");
  assert.equal(listed.rooms[0].title, "Through the Worker", "the Worker lost the room");
  assert.equal(made.size, 1, "the Worker used more than one room list");
  assert.equal(new Set(names).size, 1,
    "the Worker named a different Durable Object per request");

  /* Free-plan Durable Objects are SQLite-backed ones, and the backend is fixed
     when the namespace is created. Getting this wrong is not a broken deploy —
     it is a working deploy that starts costing money. */
  const config = fs.readFileSync(WRANGLER, "utf8");
  assert.match(config, /"new_sqlite_classes":\s*\[\s*"RoomList"\s*\]/,
    "the Durable Object must be declared with the SQLite backend");
  assert.doesNotMatch(config, /"new_classes"/,
    "new_classes is the paid-plan backend — the free plan needs new_sqlite_classes");
  assert.match(config, /"class_name":\s*"RoomList"/, "the binding names no class");
}

async function main() {
  checkSyntax();
  await checkTransport();
  await checkCore();
  await checkWorker();
  await checkRoomService();
  await checkRoomList();
  console.log("CROSSFIRE smoke checks passed");
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
