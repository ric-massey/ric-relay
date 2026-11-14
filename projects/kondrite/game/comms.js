"use strict";

/* KONDRITE — SURVEY — TRANSMISSIONS
   ─────────────────────────────────────────────────────────────────�
   What has come in over the radio: the big changes near you, each with where
   the ship heard it, and the messages addressed to you.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ═══ TRANSMISSIONS ═══════════════════════════════════════════════════════
   WORLD-IDEAS.md §3 asked for a news card at the edge of the flight screen.
   Ric, 2026-11-13, asked which should win — that, or the living world's rule
   of a wordless strip in flight:

     "i was thinking a transmission page for big stuff like close wars and
      stuff and people trying to talk to you and you have to go to that page
      to see the information."

   So flight stays quiet. Nothing here puts a sentence on the flight screen:
   a transmission waits on its own page, and the only thing flight shows is a
   count that something is waiting.

   Two kinds, and neither is invented:

     · **news** — an event that is in the living world's record (living.js),
       worded by `livingLine`, which already refuses to say anything that did
       not happen. Only the big ones, and only the near ones, except the few
       that are the whole sector's business (a war, a peace, a secession).
     · **a message** — somebody you dealt with telling you what they did
       about it: a dock that was paid for, a power putting a price on a name,
       a pilot you gave water to. One line, one way. Nobody waits for a reply
       and there is nothing to choose.

   And §3's other rule, kept: every item says **where the ship heard it** and
   how long ago. LOCAL SCAN is something that happened inside your own scan
   range. UNCONFIRMED is something heard at a distance. STATION REPORT is
   what a dock told you — and docking is what turns an unconfirmed report
   into a confirmed one, told the way that dock's flag would tell it. */

const COMMS_CAP   = 30;       // kept; the oldest go
const COMMS_REACH = 80000;    // how far off an event can be and still be yours to hear
const COMMS_BIG   = 0.55;     // importance that reaches you in flight
const COMMS_DOCK  = 0.45;     // importance a dock bothers to tell you
const COMMS_SECTOR = { war: 1, peace: 1, secede: 1, fall: 1, absorbed: 1 };

const freshComms = () => ({ list: [], seq: 0, lastEvent: -1, dockEvent: -1 });
const commsBook = () => (surv.comms || (surv.comms = freshComms()));
const commsUnread = () =>
  surv && surv.comms ? surv.comms.list.reduce((n, m) => n + (m.read ? 0 : 1), 0) : 0;

function transmit(m) {
  const C = commsBook();
  const L = surv.living;
  C.list.unshift({
    id: ++C.seq, kind: m.kind || "news",
    from: String(m.from || "").slice(0, 24),
    text: String(m.text || "").slice(0, 90),
    colour: m.colour || "#ffcb42",
    source: m.source || "direct", by: String(m.by || "").slice(0, 24),
    x: Math.round(m.x || 0), y: Math.round(m.y || 0), placed: !!m.placed,
    ev: m.ev || 0, t: Math.round(L ? L.clock : 0), read: false
  });
  if (C.list.length > COMMS_CAP) C.list.length = COMMS_CAP;
}

// A message addressed to you. `at` is whoever sent it, if they are somewhere.
function transmitMsg(from, text, colour, at) {
  if (!surv) return;
  transmit({ kind: "msg", from, text, colour, source: "direct",
             x: at ? at.x : 0, y: at ? at.y : 0, placed: !!at });
}

const commsHears = (ev, me) =>
  ev.actor !== "you" &&
  (COMMS_SECTOR[ev.kind] ||
   (me && dist2(ev.x, ev.y, me.x, me.y) < COMMS_REACH * COMMS_REACH));

/* Once a living turn: whatever went into the record since last time that is
   big enough and near enough. */
function commsNews() {
  const L = surv && surv.living;
  if (!L) return;
  const C = commsBook();
  /* A book from before this page existed, or a new sector: start from now.
     Replaying two hundred old events as "news" would be a flood of nothing. */
  if (C.lastEvent < 0) { C.lastEvent = L.seq; C.dockEvent = L.seq; return; }
  const me = ships[0];
  const reach = scanRange();
  for (const ev of L.events) {
    if (ev.id <= C.lastEvent) continue;
    if (ev.importance < COMMS_BIG || !commsHears(ev, me)) continue;
    const text = livingLine(ev, "");
    if (!text) continue;
    const near = me && dist2(ev.x, ev.y, me.x, me.y) < reach * reach;
    transmit({ kind: "news", text, colour: LIVING_KINDS[ev.kind].colour,
               source: near ? "scan" : "unconfirmed",
               x: ev.x, y: ev.y, placed: !COMMS_SECTOR[ev.kind], ev: ev.id });
  }
  C.lastEvent = L.seq;
}

/* Docking. What you had only heard is confirmed, in this flag's words; and
   the dock tells you the few things you missed. */
function commsDock(st) {
  const L = surv && surv.living;
  if (!L || !st) return;
  const C = commsBook();
  if (C.lastEvent < 0) { C.lastEvent = L.seq; C.dockEvent = L.seq; return; }
  const name = stationName(st);
  const flag = FACTIONS.some(f => f.key === st.faction) ? st.faction : "";
  for (const m of C.list) {
    if (m.source !== "unconfirmed") continue;
    const ev = L.events.find(e => e.id === m.ev);
    m.source = "station"; m.by = name;
    if (ev) m.text = (livingLine(ev, flag) || m.text).slice(0, 90);
  }
  const have = new Set(C.list.map(m => m.ev));
  const missed = L.events
    .filter(ev => ev.id > C.dockEvent && !have.has(ev.id) &&
                  ev.importance >= COMMS_DOCK && commsHears(ev, st))
    .sort((a, b) => b.importance - a.importance || b.id - a.id)
    .slice(0, 4)
    .sort((a, b) => a.id - b.id);
  for (const ev of missed) {
    const text = livingLine(ev, flag);
    if (!text) continue;
    transmit({ kind: "news", text, colour: LIVING_KINDS[ev.kind].colour,
               source: "station", by: name, x: ev.x, y: ev.y,
               placed: !COMMS_SECTOR[ev.kind], ev: ev.id });
  }
  C.dockEvent = L.seq;
}

/* Opening the page reads everything. `fresh` is what was unread when it
   opened, so the page can draw those brighter for as long as it is up. */
function commsOpened() {
  const C = commsBook();
  for (const m of C.list) { m.fresh = !m.read; m.read = true; }
}

function commsState() {
  const C = commsBook();
  const L = surv.living;
  const me = ships[0];
  const now = L ? L.clock : 0;
  return {
    unread: commsUnread(),
    list: C.list.map(m => ({
      id: m.id, kind: m.kind, from: m.from, text: m.text, colour: m.colour,
      source: m.source, by: m.by, fresh: !!m.fresh || !m.read,
      ago: Math.max(0, now - m.t),
      dist: m.placed && me ? Math.round(Math.hypot(m.x - me.x, m.y - me.y)) : -1,
      bearing: m.placed && me ? bearingTo(me, m) : 0
    }))
  };
}

/* ── the book ───────────────────────────────────────────────────────────── */
function commsToBook() {
  const C = commsBook();
  return { seq: C.seq, lastEvent: C.lastEvent, dockEvent: C.dockEvent,
           list: C.list.map(m => ({ id: m.id, kind: m.kind, from: m.from, text: m.text,
                                    colour: m.colour, source: m.source, by: m.by,
                                    x: m.x, y: m.y, placed: m.placed, ev: m.ev,
                                    t: m.t, read: m.read })) };
}
function commsFromBook(saved) {
  const out = freshComms();
  if (!saved || typeof saved !== "object") return out;
  const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
  const SOURCES = ["scan", "station", "unconfirmed", "direct"];
  out.seq = num(saved.seq, 0, 1e9);
  out.lastEvent = num(saved.lastEvent, -1, 1e9);
  out.dockEvent = num(saved.dockEvent, -1, 1e9);
  for (const m of Array.isArray(saved.list) ? saved.list.slice(0, COMMS_CAP) : []) {
    if (!m || typeof m.text !== "string") continue;
    out.list.push({
      id: num(m.id, 0, 1e9), kind: m.kind === "msg" ? "msg" : "news",
      from: String(m.from || "").slice(0, 24), text: m.text.slice(0, 90),
      colour: /^#[0-9a-fA-F]{6}$/.test(m.colour) ? m.colour : "#ffcb42",
      source: SOURCES.indexOf(m.source) >= 0 ? m.source : "unconfirmed",
      by: String(m.by || "").slice(0, 24),
      x: num(m.x, -1e9, 1e9), y: num(m.y, -1e9, 1e9), placed: !!m.placed,
      ev: num(m.ev, 0, 1e9), t: num(m.t, 0, 1e9), read: !!m.read
    });
  }
  return out;
}
