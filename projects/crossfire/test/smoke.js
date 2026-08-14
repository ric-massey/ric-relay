#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "../../..");
const PROJECT = path.join(ROOT, "projects/crossfire");
const INDEX = path.join(PROJECT, "index.html");
const NET = path.join(PROJECT, "net.js");
const ROOMS = path.join(PROJECT, "server/rooms.js");

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

  assert.match(html, /const MATCH_TIME\s*=\s*60;/, "Battle Royale must stay one minute");
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
    /body\.touch #lobby textarea\s*{[^}]*user-select:\s*text;/s,
    "online codes must remain selectable on mobile"
  );
  assert.match(html, /state === "over"[\s\S]*?leaveMatch\(\)/,
    "returning from results must close the online session");
  assert.match(html, /tapText\("SPACE to return"[\s\S]*?leaveMatch\);/,
    "the clickable results return must close the online session");
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

  description(type, setup) {
    return {
      type,
      sdp: [
        `a=ice-ufrag:test${this.id}`,
        `a=ice-pwd:password${this.id}`,
        "a=fingerprint:sha-256 00:11:22:33",
        `a=setup:${setup}`
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

    let throttled = false;
    for (let i = 0; i < 40; i++) {
      const request = await fetch(`${base}/room/test/missing`, {
        headers: { "x-forwarded-for": `198.51.100.${i}` }
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

async function main() {
  checkSyntax();
  await checkTransport();
  await checkRoomService();
  console.log("CROSSFIRE smoke checks passed");
}

main().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
