/* CROSSFIRE — peer-to-peer transport
   ────────────────────────────────────────────────────────────────────────────
   There is no game server. This site is static files on GitHub Pages, so there
   is nowhere to run one. Players connect straight to each other over WebRTC,
   and the only thing that has to travel out-of-band is the connection offer —
   which is why joining means pasting a code rather than typing a room name. A
   short room name would need a server to look it up; the code IS the lookup.

   This file knows nothing about the game. It moves messages and reports who is
   connected. Everything about ships and rocks lives in index.html.

   ── the one external thing ──
   ICE_SERVERS below is a public STUN server. It is not a script and nothing is
   downloaded from it: the browser asks it "what does my address look like from
   outside?" so two peers behind home routers can find each other. Without it
   this works only between machines on the same wifi. It is contacted only when
   someone actually opens the multiplayer panel — loading the page, or playing
   locally, makes no external request at all.

   Point it at your own coturn instance, or set it to [] for same-wifi-only
   play, and nothing else here changes.                                       */

(() => {
  "use strict";

  const ICE_SERVERS = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
  ];

  // Reliable for lobby and match control, unreliable for the firehose of state.
  // Snapshots are worthless the moment a newer one exists, so retransmitting a
  // lost one only delays the good ones behind it.
  const CH_CTL = { ordered: true };
  const CH_STATE = { ordered: false, maxRetransmits: 0 };

  /* ── code encoding ────────────────────────────────────────────────────────
     A raw session description is 2–4 KB of SDP, which is miserable to paste.
     The compact description below removes browser-generated boilerplate before
     base64 encoding it. New codes stay uncompressed so they work across browsers
     even when only one side implements CompressionStream. */

  async function unsqueeze(bytes, format) {
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    writer.write(bytes);
    writer.close();
    return new Uint8Array(await new Response(ds.readable).arrayBuffer());
  }

  const b64 = bytes => btoa(String.fromCharCode(...bytes));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  /* Compressing the raw SDP still left ~780 characters to paste, because most
     of an SDP is boilerplate that both ends already know. So we don't send it.
     Only five things actually differ between one connection and another:

       the ICE username and password, the DTLS fingerprint, which side starts
       the handshake, and the list of addresses to try

     Everything else is reconstructed from the template below. That takes the
     code from ~780 characters to roughly 200. */
  const FP_RE = /^a=fingerprint:sha-256 (.+)$/m;
  const UFRAG_RE = /^a=ice-ufrag:(.+)$/m;
  const PWD_RE = /^a=ice-pwd:(.+)$/m;
  const SETUP_RE = /^a=setup:(.+)$/m;

  const hexToBytes = h =>
    Uint8Array.from(h.split(":").map(x => parseInt(x, 16)));
  const bytesToHex = b =>
    [...b].map(x => x.toString(16).padStart(2, "0").toUpperCase()).join(":");

  /* Browsers won't hand out your real local address any more — they publish a
     random name like 4f3c….local instead, and the other end asks the local
     network who that is. The name is a UUID, so 36 characters of it fit into
     16 bytes and come back out as 22. */
  const MDNS_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.local$/i;
  const uuidToBytes = u =>
    Uint8Array.from(u.replace(/-/g, "").match(/../g), x => parseInt(x, 16));
  const bytesToUuid = b => {
    const h = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-` +
           `${h.slice(16, 20)}-${h.slice(20)}`;
  };

  function packDesc(desc) {
    const sdp = desc.sdp;
    const grab = re => { const m = re.exec(sdp); return m && m[1].trim(); };
    const ufrag = grab(UFRAG_RE), pwd = grab(PWD_RE);
    const fp = grab(FP_RE), setup = grab(SETUP_RE);
    if (!ufrag || !pwd || !fp) throw new Error("Couldn't read this browser's connection details.");

    // Keep only UDP candidates worth trying, deduped, in priority order.
    const seen = new Set(), cands = [];
    for (const line of sdp.split(/\r?\n/)) {
      const m = /^a=candidate:(\S+) (\d+) (udp|UDP) (\d+) (\S+) (\d+) typ (\w+)/.exec(line);
      if (!m) continue;
      const [, , comp, , pri, ip, port, typ] = m;
      if (comp !== "1") continue;                 // RTCP candidates are unused here
      if (typ === "relay") continue;              // no TURN server in play
      const key = ip + ":" + port;
      if (seen.has(key)) continue;
      seen.add(key);
      // A .local name is worth sending even to someone far away: if they are
      // on your network their browser resolves it, and if they aren't they
      // quietly ignore it. Dropping it is what costs you — it is the only
      // address that works on the same wifi, or between two tabs on one
      // machine, where the router usually refuses to bounce traffic back.
      const local = MDNS_RE.exec(ip);
      cands.push(local
        ? [2, b64(uuidToBytes(local[1])), +port, +pri]
        : [typ === "host" ? 0 : 1, ip, +port, +pri]);
    }
    return [
      desc.type === "offer" ? 0 : 1,
      ufrag, pwd,
      b64(hexToBytes(fp)),
      setup === "active" ? 0 : setup === "passive" ? 1 : 2,
      cands
    ];
  }

  function unpackDesc(a) {
    const [kind, ufrag, pwd, fpB64, setupN, cands] = a;
    const fp = bytesToHex(unb64(fpB64));
    const setup = setupN === 0 ? "active" : setupN === 1 ? "passive" : "actpass";
    const lines = [
      "v=0",
      "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
      "s=-",
      "t=0 0",
      "a=group:BUNDLE 0",
      "a=extmap-allow-mixed",
      "a=msid-semantic: WMS",
      "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
      "c=IN IP4 0.0.0.0",
      "a=ice-ufrag:" + ufrag,
      "a=ice-pwd:" + pwd,
      "a=ice-options:trickle",
      "a=fingerprint:sha-256 " + fp,
      "a=setup:" + setup,
      "a=mid:0",
      "a=sctp-port:5000",
      "a=max-message-size:262144"
    ];
    cands.forEach(([typ, ip, port, pri], i) => {
      const t = typ === 1 ? "srflx" : "host";
      const addr = typ === 2 ? bytesToUuid(unb64(ip)) + ".local" : ip;
      lines.push(`a=candidate:${i + 1} 1 udp ${pri} ${addr} ${port} typ ${t}` +
                 (t === "srflx" ? ` raddr 0.0.0.0 rport 0` : ""));
    });
    lines.push("a=end-of-candidates");
    return { type: kind === 0 ? "offer" : "answer", sdp: lines.join("\r\n") + "\r\n" };
  }

  async function encodeDesc(desc) {
    let payload, tag;
    try {
      payload = JSON.stringify(packDesc(desc));
      tag = "C1";
    } catch (_) {
      // If anything about this browser's SDP is unfamiliar, send the whole
      // thing rather than a broken shorthand.
      payload = JSON.stringify({ t: desc.type, s: desc.sdp });
      tag = "C0";
    }
    const raw = new TextEncoder().encode(payload);
    return tag + "p" + b64(raw);
  }

  async function decodeDesc(code) {
    const clean = String(code).replace(/\s+/g, "");
    const tag = clean.slice(0, 2), enc = clean.slice(2, 3);
    if (tag !== "C0" && tag !== "C1") {
      throw new Error("That doesn't look like a CROSSFIRE code.");
    }
    if (enc !== "p" && enc !== "z") {
      throw new Error("That CROSSFIRE code has an unknown format.");
    }
    const body = unb64(clean.slice(3));
    if (enc === "z" && typeof DecompressionStream !== "function") {
      throw new Error("This browser can't open that older compressed code. Ask for a new code.");
    }
    const raw = enc === "z" ? await unsqueeze(body, "deflate-raw") : body;
    const o = JSON.parse(new TextDecoder().decode(raw));
    return tag === "C1" ? unpackDesc(o) : { type: o.t, sdp: o.s };
  }

  /* ICE candidates trickle in over a second or two. With no signalling server
     there's no channel to trickle them down, so we wait for gathering to finish
     and ship them inside the one description. */
  function whenGathered(pc) {
    if (pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise(resolve => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      pc.addEventListener("icegatheringstatechange", () => {
        if (pc.iceGatheringState === "complete") finish();
      });
      // Some networks never reach "complete". Don't hang the UI on it.
      setTimeout(finish, 3000);
    });
  }

  function newPeer() {
    return new RTCPeerConnection({ iceServers: ICE_SERVERS });
  }

  /* ── a single link to one other player ──────────────────────────────────── */
  class Link {
    constructor(id, handlers) {
      this.id = id;
      this.h = handlers;
      this.pc = newPeer();
      this.ctl = null;
      this.state = null;
      this.open = false;
      this.disconnectTimer = 0;
      this.pc.addEventListener("connectionstatechange", () => {
        const s = this.pc.connectionState;
        if (s === "failed" || s === "closed") {
          this.die();
        } else if (s === "disconnected") {
          // `disconnected` is recoverable: wifi changes and brief network stalls
          // commonly pass through it before returning to `connected`.
          clearTimeout(this.disconnectTimer);
          this.disconnectTimer = setTimeout(() => {
            if (this.pc.connectionState === "disconnected") this.die();
          }, 12_000);
        } else if (s === "connected") {
          clearTimeout(this.disconnectTimer);
          this.disconnectTimer = 0;
        }
      });
    }

    wire(ch) {
      if (ch.label === "ctl") this.ctl = ch; else this.state = ch;
      ch.binaryType = "arraybuffer";
      ch.addEventListener("open", () => {
        // Ready only once both channels are up, or early sends vanish.
        if (this.ctl && this.state &&
            this.ctl.readyState === "open" && this.state.readyState === "open" &&
            !this.open) {
          this.open = true;
          this.h.onOpen && this.h.onOpen(this);
        }
      });
      ch.addEventListener("message", e => {
        let msg;
        try { msg = JSON.parse(e.data); } catch (_) { return; }
        this.h.onMessage && this.h.onMessage(msg, this);
      });
      ch.addEventListener("close", () => this.die());
    }

    send(obj, reliable) {
      const ch = reliable ? this.ctl : this.state;
      if (!ch || ch.readyState !== "open") return false;
      try { ch.send(JSON.stringify(obj)); return true; } catch (_) { return false; }
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      this.open = false;
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = 0;
      try { this.pc.close(); } catch (_) {}
      this.h.onClose && this.h.onClose(this);
    }
  }

  /* ── host ────────────────────────────────────────────────────────────────
     One RTCPeerConnection per guest. Each guest needs its own invite code and
     its own reply pasted back — that is the price of having no server, and it
     is why four guests is tedious where one is fine. */
  const host = {
    links: [],
    pending: null,

    async invite(handlers) {
      if (this.pending) {
        throw new Error("That invite is still waiting for a reply.");
      }
      const link = new Link(this.links.length + 1, handlers);
      link.wire(link.pc.createDataChannel("ctl", CH_CTL));
      link.wire(link.pc.createDataChannel("st", CH_STATE));
      const offer = await link.pc.createOffer();
      await link.pc.setLocalDescription(offer);
      await whenGathered(link.pc);
      this.pending = link;
      return encodeDesc(link.pc.localDescription);
    },

    async accept(code) {
      if (!this.pending) throw new Error("Make an invite code first.");
      const desc = await decodeDesc(code);
      if (desc.type !== "answer") {
        throw new Error("That's an invite code, not a reply. You need the code your friend sent back.");
      }
      await this.pending.pc.setRemoteDescription(desc);
      this.links.push(this.pending);
      this.pending = null;
    },

    /* The other way round, for when a room service is carrying the invite.
       There the guest knocks first — it posts an offer and waits — so the host
       is the one answering. That matters: with the host offering, two people
       typing the room word at the same moment would both grab the same offer
       and one of them would silently fail. Answering each knock in turn has no
       such race, however many arrive together. */
    async answer(code, handlers) {
      const desc = await decodeDesc(code);
      if (desc.type !== "offer") throw new Error("That isn't someone knocking.");
      const link = new Link(this.links.length + 1, handlers);
      link.pc.addEventListener("datachannel", e => link.wire(e.channel));
      await link.pc.setRemoteDescription(desc);
      const answer = await link.pc.createAnswer();
      await link.pc.setLocalDescription(answer);
      await whenGathered(link.pc);
      this.links.push(link);
      return { link, code: await encodeDesc(link.pc.localDescription) };
    },

    broadcast(obj, reliable) {
      for (const l of this.links) if (l.open) l.send(obj, reliable);
    },

    close() {
      // onClose handlers may remove themselves from `links`; iterate a copy so
      // that closing one link cannot make the next connection get skipped.
      for (const l of [...this.links]) l.die();
      this.links = [];
      if (this.pending) this.pending.die();
      this.pending = null;
    }
  };

  /* ── guest ─────────────────────────────────────────────────────────────── */
  const guest = {
    link: null,

    async join(code, handlers) {
      const desc = await decodeDesc(code);
      if (desc.type !== "offer") {
        throw new Error("That's a reply code, not an invite. You need the code from whoever is hosting.");
      }
      const link = new Link(0, handlers);
      link.pc.addEventListener("datachannel", e => link.wire(e.channel));
      await link.pc.setRemoteDescription(desc);
      const answer = await link.pc.createAnswer();
      await link.pc.setLocalDescription(answer);
      await whenGathered(link.pc);
      this.link = link;
      return encodeDesc(link.pc.localDescription);
    },

    /* Knocking on a room: make the offer, hand it to the room service, and
       wait for an answer to come back. The channels are made here because the
       side that offers is the side that opens them. */
    async offer(handlers) {
      const link = new Link(0, handlers);
      link.wire(link.pc.createDataChannel("ctl", CH_CTL));
      link.wire(link.pc.createDataChannel("st", CH_STATE));
      const offer = await link.pc.createOffer();
      await link.pc.setLocalDescription(offer);
      await whenGathered(link.pc);
      this.link = link;
      return encodeDesc(link.pc.localDescription);
    },

    async take(code) {
      if (!this.link) throw new Error("Nothing is waiting for an answer.");
      const desc = await decodeDesc(code);
      if (desc.type !== "answer") throw new Error("That isn't a reply.");
      await this.link.pc.setRemoteDescription(desc);
    },

    send(obj, reliable) {
      return this.link ? this.link.send(obj, reliable) : false;
    },

    close() {
      if (this.link) this.link.die();
      this.link = null;
    }
  };

  window.CrossfireNet = {
    host, guest,
    supported: typeof RTCPeerConnection === "function",
    reset() { host.close(); guest.close(); }
  };
})();
