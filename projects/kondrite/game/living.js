"use strict";

/* KONDRITE — THE LIVING WORLD
   ─────────────────────────────────────────────────────────────────────────────
   Powers with needs, provinces with resources, five actions and the events they
   leave behind. Nothing here writes a story: rules make pressures, pressures
   pick actions, actions make events, events change the world, and the world
   remembers. The player is one more actor in it. LIVING-WORLD.md is the brief;
   this is its first version — §27 with §16 and the front of §28 — built on the
   war that already moves the borders (war.js) rather than beside it.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ═══ THE LIVING WORLD ════════════════════════════════════════════════════
   What was already here: three powers, a war between two of them, territory
   that changes hands for reasons (`claimCell`), an economy where a station's
   shortage is a price and a price is a reason to fly, standing per flag, and
   ships that remember you. That is the substrate the brief asks for, and most
   of §27 was the loop on top of it:

     POWERS      each has three resources it trades in (the same ice, iron
                 and alloy the stations do), a stability figure, three traits
                 rolled per seed — aggression, expansion, trade — and an
                 opinion of each other power, -1 to 1.
     PROVINCES   the political sector of §5: a 6×6 block of region cells.
                 Its owner is whoever holds most of it, its control is how
                 much, and it carries resources of its own, rolled once from
                 the seed. Only the provinces near you are worked each turn —
                 the same rule the war already follows — and only the ones
                 anybody has looked at are in the book.
     PRESSURES   read off the numbers every turn: short of something, weak,
                 a border in dispute, recently raided, tired of a war.
     ACTIONS     TRADE, CLAIM, RAID, INVADE, MAKE PEACE. Each power scores each
                 action against each other power and takes the best one if it
                 is worth taking. Costs, cooldowns and memory keep it from
                 changing its mind every minute (§25).
     EVENTS      everything that matters is written down with who, whom,
                 where, how much it mattered and which thread it belongs to.
                 Low importance is forgotten first when the record fills.
     NEWS        templates over real events, framed by whoever is telling it
                 (§20). News reports; it never creates anything (§21).

   The player: a kill weakens a fleet and is recorded, a delivery into a
   shortage is a relief the owner notices, a rescue is remembered, and a
   border you watched move is on your chart as the moment it moved. */

const LIVING_TURN     = 60;       // seconds of play between political turns
const LIVING_CAP      = 240;      // events kept; the least important go first
const LIVING_BLOCK    = 6;        // region cells to a province, each way
const LIVING_REACH    = 3;        // provinces either side of you that are worked
const LIVING_WAR_COOL = 60;       // turns after a peace before a new war
const LIVING_ACT_COOL = 3;        // turns between one power's actions
const LIVING_RAID_COOL = 14;      // turns before the same neighbour is raided again
const LIVING_TRADE_COOL = 6;      // turns before the same partner is dealt with again
const LIVING_WAR_MIN  = 15;       // turns a war runs before anybody tires of it
/* §28 */
const LIVING_TERM        = 45;    // turns a leader serves before facing an election
const LIVING_LAW_COOL    = 20;    // turns between one power's law changes
const LIVING_WITHHOLD  = 0.3;     // loyalty under which a province stops paying — if the guns are not on it
const LIVING_GUNS      = 0.5;     // security over which nobody withholds, whatever they feel
const LIVING_SECEDE    = 40;      // turns a bloc withholds, unenforced, before it holds its own sky
const LIVING_ENFORCE_COOL = 6;    // turns between one power's fleets being sent home
const LIVING_CAUSE_COLOURS = ["#ffb347", "#f0f08a", "#8fe3ff", "#f7f7f7"];
const LIVING_BOUNTY_CAP  = 6;     // prices posted at once
const LIVING_BOUNTY_TURNS = 150;  // turns a price stands before it lapses

const LIVING_GOODS = ["ice", "iron", "alloy"];
const LIVING_ACTIONS = ["trade", "claim", "raid", "invade", "peace"];
/* What is worth remembering, and roughly how much. The number is a floor:
   the player being involved, or a war, adds to it. */
const LIVING_KINDS = {
  trade:   { glyph: "trade",  base: 0.15, colour: "#6dffbf" },
  claim:   { glyph: "taken",  base: 0.30, colour: "#ffcb42" },
  raid:    { glyph: "raid",   base: 0.45, colour: "#ff8f77" },
  war:     { glyph: "war",    base: 0.90, colour: "#ff5555" },
  peace:   { glyph: "peace",  base: 0.80, colour: "#a08cff" },
  taken:   { glyph: "taken",  base: 0.50, colour: "#ffcb42" },
  battle:  { glyph: "battle", base: 0.60, colour: "#ff8f77" },
  kill:    { glyph: "kill",   base: 0.25, colour: "#ff8f77" },
  relief:  { glyph: "relief", base: 0.40, colour: "#6dffbf" },
  rescue:  { glyph: "rescue", base: 0.35, colour: "#6dffbf" },
  loss:    { glyph: "loss",   base: 0.35, colour: "#ff8f77" },
  arrived: { glyph: "trade",  base: 0.10, colour: "#6dffbf" },
  /* §28: who rules, what the law is, when a province rises, who is wanted. */
  election: { glyph: "vote",   base: 0.55, colour: "#a08cff" },
  fall:     { glyph: "fall",   base: 0.80, colour: "#ff8f77" },
  law:      { glyph: "law",    base: 0.50, colour: "#ffe56d" },
  bounty:   { glyph: "bounty", base: 0.40, colour: "#ffcb42" },
  claimed:  { glyph: "bounty", base: 0.50, colour: "#ffe56d" },
  /* The people (§8): a bloc of provinces that stopped paying, the fleet sent
     to it, the day it held its own sky, and the day that sky was taken back. */
  cause:    { glyph: "cause",  base: 0.50, colour: "#ffb347" },
  enforce:  { glyph: "battle", base: 0.35, colour: "#ff8f77" },
  secede:   { glyph: "secede", base: 1.00, colour: "#ffb347" },
  absorbed: { glyph: "fall",   base: 0.70, colour: "#a08cff" }
};
const LIVING_LAWS   = ["privateers", "borders", "conscription"];
const LIVING_TITLES = { cordon: "MARSHAL", hallow: "WARDEN", morrow: "CHAIR" };

/* ── the powers, rolled ─────────────────────────────────────────────────
   Every seed gives the three powers different tempers. The names and colours
   are the sector's (`FACTIONS`); what is rolled is how they behave. */
function livingPower(R, key, turn) {
  const p = { ice: 0.4 + R() * 0.4, iron: 0.4 + R() * 0.4, alloy: 0.3 + R() * 0.4,
              stability: 0.55 + R() * 0.35,
              aggression: 0.2 + R() * 0.7, expansion: 0.2 + R() * 0.7,
              trade: 0.2 + R() * 0.7,
              rel: {}, cool: { act: 0, war: 0, law: 0, enforce: 0, raid: {}, trade: {} }, pressures: [],
              laws: { privateers: false, borders: false, conscription: false } };
  for (const g of FACTIONS) if (g.key !== key) p.rel[g.key] = -0.3 + R() * 0.6;
  /* Somebody is in charge, and the three do not all vote the same week. */
  p.leader = livingLeader(R, key, turn | 0);
  p.leader.term = (turn | 0) + Math.round(LIVING_TERM * (0.4 + R() * 0.8));
  return p;
}
function livingFresh(seed) {
  const R = seeded(((seed | 0) ^ 0x6c1f9d33) >>> 0);
  /* A new sector has the three flags the world rolled and no others: a
     freehold that seceded in the last sector does not follow you here. */
  livingClearCauses();
  const powers = {};
  for (const f of FACTIONS) powers[f.key] = livingPower(R, f.key, 0);
  /* The war the world rolled is already a fact between two of them. */
  return { turn: 0, clock: 0, seq: 0, powers, provinces: new Map(), events: [],
           bounties: [], causes: [], lastDock: null };
}

/* Numbers that must stay numbers: everything a turn touches is clamped on
   the way out, so no drift, no save and no hand edit can run one off. */
const liveClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));

/* ── provinces ──────────────────────────────────────────────────────────── */
const provinceKey = (px, py) => px + "," + py;
const provinceAtCell = (cx, cy) =>
  [Math.floor(cx / LIVING_BLOCK), Math.floor(cy / LIVING_BLOCK)];

/* A province's own resources, from the seed, once. */
function provinceOf(px, py) {
  const L = surv.living;
  const key = provinceKey(px, py);
  let pv = L.provinces.get(key);
  if (!pv) {
    const R = seeded(chunkSeed(px ^ 0x3a7f11c5, py ^ 0x5d9b2e73));
    pv = { px, py, ice: R(), iron: R(), alloy: R(),
           owner: "", control: 0, contested: "", security: 0.5, unrest: 0.1,
           /* The people (§8): how they feel about the flag over them, what has
              lately been done to them and for them, and whether they are
              still paying. */
           loyalty: 0.7 + R() * 0.15, cause: "", withheld: 0, withholding: false,
           hurt: 0, relief: 0, guard: 0, garrison: 0 };
    L.provinces.set(key, pv);
  }
  return pv;
}

/* Who holds it and how firmly, read off the lattice the war moves. */
function provinceRead(pv) {
  const tally = {};
  let held = 0;
  for (let j = 0; j < LIVING_BLOCK; j++) {
    for (let i = 0; i < LIVING_BLOCK; i++) {
      const o = WORLD.holderOf(pv.px * LIVING_BLOCK + i, pv.py * LIVING_BLOCK + j);
      if (!o) continue;
      held++;
      tally[o] = (tally[o] || 0) + 1;
    }
  }
  const n = LIVING_BLOCK * LIVING_BLOCK;
  const ranked = Object.keys(tally).sort((a, b) => tally[b] - tally[a]);
  pv.owner = ranked[0] || "";
  pv.control = pv.owner ? tally[pv.owner] / n : 0;
  pv.contested = ranked[1] && tally[ranked[1]] >= 4 ? ranked[1] : "";
  pv.held = held / n;
  return pv;
}

/* The province the ship is in, and the ones around it. */
function provincesNear() {
  const me = ships[0];
  const here = WORLD.siteAt(me ? me.x : 0, me ? me.y : 0);
  const [px, py] = provinceAtCell(here.cx, here.cy);
  const out = [];
  for (let j = -LIVING_REACH; j <= LIVING_REACH; j++) {
    for (let i = -LIVING_REACH; i <= LIVING_REACH; i++) {
      out.push(provinceRead(provinceOf(px + i, py + j)));
    }
  }
  return { here: provinceOf(px, py), near: out };
}

/* Where a province is, for a mark or a line of chatter. */
function provinceSite(pv) {
  return WORLD.regionSite(pv.px * LIVING_BLOCK + Math.floor(LIVING_BLOCK / 2),
                          pv.py * LIVING_BLOCK + Math.floor(LIVING_BLOCK / 2));
}

/* ── the record ───────────────────────────────────────────────────────────
   `recordEvent` is the only way anything gets into the history. It fills the
   fields every event has, scores it, and drops the least important thing on
   the shelf if the shelf is full. */
function recordEvent(e) {
  const L = surv && surv.living;
  if (!L || !e || !LIVING_KINDS[e.kind]) return null;
  const spec = LIVING_KINDS[e.kind];
  let importance = spec.base;
  if (e.actor === "you" || e.target === "you") importance += 0.15;
  if (e.kind !== "war" && e.kind !== "peace" && warSides().length &&
      (warSides().indexOf(e.actor) >= 0 || warSides().indexOf(e.target) >= 0)) {
    importance += 0.05;
  }
  const ev = {
    id: ++L.seq, turn: L.turn, t: Math.round(L.clock),
    kind: e.kind, actor: e.actor || "", target: e.target || "",
    x: Math.round(e.x || 0), y: Math.round(e.y || 0),
    what: String(e.what || "").slice(0, 60),
    thread: String(e.thread || "").slice(0, 40),
    n: Math.round(e.n || 0),
    importance: liveClamp(e.importance !== undefined ? e.importance : importance, 0, 1)
  };
  L.events.push(ev);
  if (L.events.length > LIVING_CAP) {
    // The least important thing goes, never the newest.
    let worst = 0;
    for (let i = 1; i < L.events.length - 20; i++) {
      if (L.events[i].importance < L.events[worst].importance) worst = i;
    }
    L.events.splice(worst, 1);
  }
  return ev;
}

/* ── pressures ─────────────────────────────────────────────────────────── */
function livingPressures(key, near) {
  const L = surv.living, p = L.powers[key], st = surv.war.strength[key] || 1;
  const out = [];
  for (const g of LIVING_GOODS) if (p[g] < 0.35) out.push("short:" + g);
  if (st < 0.7) out.push("weak");
  if (near.some(pv => pv.owner === key && pv.contested)) out.push("dispute");
  if (near.some(pv => pv.contested === key)) out.push("dispute");
  const recent = L.events.slice(-30);
  if (recent.some(e => e.kind === "raid" && e.target === key)) out.push("raided");
  if (warSides().indexOf(key) >= 0 && L.turn - (L.warSince || 0) >= LIVING_WAR_MIN) out.push("weary");
  p.pressures = out;
  return out;
}

/* ── evaluate, then act ───────────────────────────────────────────────────
   The scores are the brief's "need fuel + neighbour has it + relations are
   bad + we are strong = invading looks attractive" (§4), as arithmetic. A
   power takes the single best thing above the bar, once every few turns. */
function livingOptions(key, near, R) {
  const L = surv.living, p = L.powers[key], T = livingTemper(p);
  const st = surv.war.strength, mine = st[key] || 1;
  const atWarNow = warSides().length === 2;
  const enemy = warPairs()[key] || "";
  const opts = [];
  /* Memory (§25): who raided us lately. Every raid on record against us by
     a power makes trading with it less likely and invading it more. */
  const recent = L.events.slice(-40);
  const raidedBy = o => recent.filter(e => e.kind === "raid" && e.target === key && e.actor === o).length;
  /* Each action has its own bar, because they are not the same size of
     decision: settling empty sky is cheap and a war is not. `bar` travels
     with the option so the turn can compare score against it. */
  for (const f of FACTIONS) {
    const o = f.key;
    if (o === key) continue;
    const q = L.powers[o], rel = p.rel[o] || 0, theirs = st[o] || 1;
    // What they have that we are short of.
    let want = 0;
    for (const g of LIVING_GOODS) if (p[g] < 0.35 && q[g] > 0.45) want += 0.5;
    const fighting = enemy === o;
    const grudge = raidedBy(o);

    // TRADE: something to buy, somebody we can stand, not at war, and not
    // the same partner every three minutes. A closed border on either side
    // is most of the reason not to (§6).
    const closed = livingLaw(key, "borders") || livingLaw(o, "borders");
    if (!fighting && !(p.cool.trade[o] > 0)) {
      opts.push({ act: "trade", target: o, bar: 0.45,
                  score: 0.05 + want * 0.55 + rel * 0.4 + T.trade * 0.3 -
                         (rel < -0.4 ? 0.6 : 0) - grudge * 0.3 - (closed ? 0.4 : 0) });
    }
    // RAID: bad blood, a taste for it, and they have what we want — and not
    // the same neighbour again for a while. Letters of marque make it policy.
    if (!(p.cool.raid[o] > 0)) opts.push({ act: "raid", target: o, bar: 0.55,
                score: -0.1 + T.aggression * 0.55 - rel * 0.5 + want * 0.35 +
                       (mine > theirs ? 0.15 : -0.15) - (fighting ? 0.05 : 0) +
                       (livingLaw(key, "privateers") ? 0.15 : 0) });
    // INVADE: only from peace, only against somebody we could beat and dislike.
    if (!atWarNow && p.cool.war <= 0) {
      const dispute = p.pressures.indexOf("dispute") >= 0 ? 0.2 : 0;
      opts.push({ act: "invade", target: o, bar: 0.55,
                  score: -0.5 + T.aggression * 0.45 + p.expansion * 0.3 - rel * 0.6 +
                         (mine / theirs - 1) * 0.6 + want * 0.25 + dispute + grudge * 0.15 -
                         (p.stability < 0.4 ? 0.4 : 0) });
    }
    // MAKE PEACE: tired, losing, coming apart at home, or warming — and never
    // in the first dozen turns unless it is collapsing, or a war would be a
    // thing that lasted a minute. A dove in charge is the brief's example
    // (§7): the war goes badly, the leader changes, the policy changes.
    const young = L.turn - (L.warSince || 0) < LIVING_WAR_MIN;
    if (fighting && (!young || p.stability < 0.15 || mine < 0.6)) {
      const weary = p.pressures.indexOf("weary") >= 0 ? 0.4 : 0;
      opts.push({ act: "peace", target: o, bar: 0.5,
                  score: -0.25 + weary + (mine < 0.85 ? 0.35 : 0) + (theirs < 0.85 ? 0.1 : 0) +
                         (p.stability < 0.3 ? 0.45 : 0) + rel * 0.2 - T.aggression * 0.25 +
                         Math.max(0, 0.5 - (p.leader ? p.leader.hawk : 0.5)) * 0.5 });
    }
  }
  // CLAIM: settle sky next door that nobody holds firmly. Expansion is the
  // whole of the appetite, and the price is iron.
  const open = near.filter(pv => pv.held < 0.6 && (!pv.owner || (pv.owner === key && pv.control < 0.5)) &&
    near.some(o => o !== pv && o.owner === key && Math.abs(o.px - pv.px) + Math.abs(o.py - pv.py) === 1));
  if (open.length && p.iron > 0.15) {
    opts.push({ act: "claim", target: "", bar: 0.35, province: open[Math.floor(R() * open.length)],
                score: 0.05 + p.expansion * 0.5 + (mine - 0.9) * 0.4 });
  }
  return opts;
}

function livingAct(key, opt, R) {
  const L = surv.living, p = L.powers[key], f = factionOf(key);
  const o = opt.target, g = o ? factionOf(o) : null, q = o ? L.powers[o] : null;
  const where = opt.province ? provinceSite(opt.province) : livingPlaceOf(o || key);
  p.cool.act = LIVING_ACT_COOL;

  if (opt.act === "trade") {
    p.cool.trade[o] = LIVING_TRADE_COOL;
    let goods = "";
    for (const gd of LIVING_GOODS) {
      if (p[gd] < q[gd] - 0.1) { p[gd] = liveClamp(p[gd] + 0.06, 0, 1); q[gd] = liveClamp(q[gd] - 0.04, 0, 1); goods = goods || gd; }
    }
    p.rel[o] = liveClamp(p.rel[o] + 0.06, -1, 1);
    q.rel[key] = liveClamp(q.rel[key] + 0.06, -1, 1);
    p.stability = liveClamp(p.stability + 0.02, 0, 1);
    // A deal eases a shortage at the buyer's loaded stations.
    for (const st of surv.stations) if (st.faction === key && goods) moveMarket(st, goods, -0.15);
    recordEvent({ kind: "trade", actor: key, target: o, x: where.x, y: where.y, what: goods,
                  thread: "trade:" + [key, o].sort().join("-") });
    return true;
  }
  if (opt.act === "claim") {
    const pv = opt.province;
    let took = 0;
    for (let j = 0; j < LIVING_BLOCK && took < 3; j++) {
      for (let i = 0; i < LIVING_BLOCK && took < 3; i++) {
        const cx = pv.px * LIVING_BLOCK + i, cy = pv.py * LIVING_BLOCK + j;
        if (WORLD.holderOf(cx, cy)) continue;
        // Only from next to something it already holds.
        let touch = false;
        for (let jj = -1; jj <= 1 && !touch; jj++) for (let ii = -1; ii <= 1 && !touch; ii++) {
          if (WORLD.holderOf(cx + ii, cy + jj) === key) touch = true;
        }
        if (touch && claimCell(cx, cy, key, f.short + " has settled new sky")) took++;
      }
    }
    if (!took) return false;
    p.iron = liveClamp(p.iron - 0.03, 0, 1);
    recordEvent({ kind: "claim", actor: key, x: where.x, y: where.y, n: took,
                  thread: "claim:" + key });
    return true;
  }
  if (opt.act === "raid") {
    p.cool.raid[o] = LIVING_RAID_COOL;
    weaken(o, 0.015);
    p.rel[o] = liveClamp(p.rel[o] - 0.05, -1, 1);
    q.rel[key] = liveClamp(q.rel[key] - 0.12, -1, 1);
    q.stability = liveClamp(q.stability - 0.03, 0, 1);
    // Whatever they have most of, some of it changes hands.
    const best = LIVING_GOODS.slice().sort((a, b) => q[b] - q[a])[0];
    q[best] = liveClamp(q[best] - 0.06, 0, 1);
    p[best] = liveClamp(p[best] + 0.05, 0, 1);
    // And a station of theirs near you feels it.
    let hit = null;
    for (const st of surv.stations) if (st.faction === o && (!hit || R() < 0.5)) hit = st;
    if (hit) {
      moveMarket(hit, best, 0.25);
      // And the people there remember whether anybody was defending them.
      const pv = provinceOfSite(hit.x, hit.y);
      if (pv) pv.hurt = 1;
    }
    // Beside the station rather than on it, or the two marks share a label.
    const off = R() * Math.PI * 2;
    const at = hit ? { x: hit.x + Math.cos(off) * 700, y: hit.y + Math.sin(off) * 700 } : where;
    const ev = recordEvent({ kind: "raid", actor: key, target: o, x: at.x, y: at.y, what: best,
                             thread: "feud:" + [key, o].sort().join("-") });
    if (ev) noteKnown("raid", at.x, at.y, f.short + " RAID");
    chatter(f.short + " raiders hit " + g.short + (hit ? " at a station" : " shipping") + ".",
            f.colour, hit ? hit : false);
    return true;
  }
  if (opt.act === "invade") {
    const war = surv.war;
    war.pairs = { [key]: o, [o]: key };
    war.belligerents = [key, o];
    war.calm = 0;
    L.warSince = L.turn;
    p.rel[o] = liveClamp(p.rel[o] - 0.2, -1, 1);
    q.rel[key] = liveClamp(q.rel[key] - 0.3, -1, 1);
    livingWar(key, o, "invaded");
    return true;
  }
  if (opt.act === "peace") {
    const war = surv.war;
    war.pairs = {};
    war.belligerents = [];
    war.calm = 0;
    p.cool.war = LIVING_WAR_COOL;
    q.cool.war = LIVING_WAR_COOL;
    p.rel[o] = liveClamp(p.rel[o] + 0.2, -1, 1);
    q.rel[key] = liveClamp(q.rel[key] + 0.15, -1, 1);
    livingPeace(key, o, "asked");
    return true;
  }
  return false;
}

/* Somewhere that is theirs, near you, for an event with no better address. */
function livingPlaceOf(key) {
  const st = surv.stations.find(s => s.faction === key);
  if (st) return { x: st.x, y: st.y };
  const me = ships[0];
  return { x: me ? me.x : 0, y: me ? me.y : 0 };
}

/* War and peace are said here whoever decided them — the living loop or the
   older strength rule in `surveyWarTurn` — so the record has one entry per
   war, with the reason. */
function livingWar(a, b, why) {
  const L = surv.living;
  if (!L) return;
  L.warSince = L.turn;
  const at = livingPlaceOf(a);
  recordEvent({ kind: "war", actor: a, target: b, x: at.x, y: at.y, what: why || "",
                thread: "war:" + [a, b].sort().join("-") });
  chatter(factionOf(a).name + " has gone to war with " + factionOf(b).name + ".",
          factionOf(a).colour, false);
}
function livingPeace(a, b, why) {
  const L = surv.living;
  if (!L) return;
  /* The two that made peace wait the full term; everybody else waits a
     shorter one, or the third power was invading the loser six turns after
     every ceasefire, on every seed, like clockwork. */
  for (const f of FACTIONS) {
    const p = L.powers[f.key];
    if (!p) continue;
    const term = f.key === a || f.key === b ? LIVING_WAR_COOL : Math.round(LIVING_WAR_COOL * 0.4);
    p.cool.war = Math.max(p.cool.war, term);
  }
  const at = livingPlaceOf(a);
  recordEvent({ kind: "peace", actor: a, target: b, x: at.x, y: at.y, what: why || "",
                thread: "war:" + [a, b].sort().join("-") });
  chatter("CEASEFIRE — " + factionOf(a).short + " and " + factionOf(b).short, "#a08cff");
}

/* ── one turn ─────────────────────────────────────────────────────────────
   §24, cut to what exists: resources, unrest, pressures, actions, then the
   relationships drift. The ground itself is moved by `surveyWarTurn`. */
function livingTurn(R) {
  R = R || Math.random;
  const L = surv.living;
  if (!L) return [];
  L.turn++;
  const { here, near } = provincesNear();
  const st = surv.war.strength;
  const sides = warSides();
  const acted = [];

  // 1. The provinces feed their owners, and unrest follows control.
  /* Income is what the held sky yields; the cost of being a power is paid
     below, every turn, held sky or not. A power holding little of the sky
     around you runs short, and short is where every other action starts.
     Measured over 400 turns: at 0.004 a province the goods pinned at 0.99
     and nothing ever wanted anything. */
  /* The rate is set so that about a fifth of the sky around you pays for a
     power: hold more and you are comfortable, hold less and you run short,
     and the `(1.2 - have)` keeps a rich power from pinning at the top.
     Measured over 400 turns on two seeds: at 0.0035 every power drained to
     nothing and, with nobody holding anything, nobody wanted anything either;
     at 0.006 the power with half the sky sits near 0.8, the one with a
     quarter near 0.4, and the one with a sixth is permanently short — which
     is the spread that makes the other four actions worth taking. */
  for (const pv of near) {
    const p = pv.owner ? L.powers[pv.owner] : null;
    if (p && !pv.withholding) {
      // A closed border keeps some of the yield at home, unsold (§6). A
      // province that has stopped paying keeps all of it (§8).
      const yield_ = livingLaw(pv.owner, "borders") ? 0.9 : 1;
      for (const g of LIVING_GOODS) {
        p[g] = liveClamp(p[g] + pv[g] * pv.control * 0.006 * yield_ * (1.2 - p[g]), 0, 1);
      }
    }
    const front = pv.contested && sides.length && sides.indexOf(pv.owner) >= 0;
    /* Unrest is the ground's own condition plus its owner's: a province of a
       power that is broke, coming apart and drafting its people is unquiet
       ground, and unquiet ground is where its people's loyalty starts to go
       (`livingPeopleTurn`). */
    let want = front ? 0.6 : pv.owner ? 0.25 - pv.control * 0.2 : 0.4;
    if (p) {
      want += (1 - p.stability) * 0.3 + (LIVING_GOODS.some(g => p[g] < 0.2) ? 0.1 : 0) +
              (livingLaw(pv.owner, "conscription") ? 0.1 : 0);
    }
    pv.unrest = liveClamp(pv.unrest + (want - pv.unrest) * 0.15, 0, 1);
    pv.garrison = (pv.garrison || 0) * 0.85;
    pv.security = liveClamp((pv.owner ? (st[pv.owner] || 1) * pv.control : 0.2) - pv.unrest * 0.3 +
                            pv.garrison * 0.4, 0, 1);
  }
  // 2. Being a power costs goods every turn; a war eats metal and calm, and
  //    a shortage eats calm too.
  for (const f of FACTIONS) {
    const p = L.powers[f.key];
    /* A small power needs less than a large one — a fifth of the sky pays
       for a power that holds a fifth. Without this the smallest was at zero
       for the whole of every run: short is a pressure, dead is a hole. */
    const holds = near.filter(pv => pv.owner === f.key).length / Math.max(1, near.length);
    for (const g of LIVING_GOODS) p[g] = liveClamp(p[g] - (0.01 + 0.02 * holds), 0, 1);
    const short = LIVING_GOODS.some(g => p[g] < 0.2);
    if (sides.indexOf(f.key) >= 0) {
      p.iron = liveClamp(p.iron - 0.012, 0, 1);
      p.alloy = liveClamp(p.alloy - 0.012, 0, 1);
      p.stability = liveClamp(p.stability - 0.012 - (short ? 0.01 : 0), 0, 1);
    } else {
      p.stability = liveClamp(p.stability + (0.7 - p.stability) * 0.04 - (short ? 0.015 : 0), 0, 1);
    }
    /* The laws, charged (§6). Conscription buys fleet with calm; a closed
       border buys a little calm with the trade it is not doing; privateers
       cost the goodwill of everybody whose ships they take. */
    /* A drafted fleet is never a full one: measured at +0.004 to the cap,
       both sides sat at full strength for the whole run, the strength rule
       that ends wars never fired, and one war lasted four hundred turns. */
    if (livingLaw(f.key, "conscription")) {
      st[f.key] = Math.max(st[f.key] || 1, Math.min(1.2, (st[f.key] || 1) + 0.002));
      p.stability = liveClamp(p.stability - 0.008, 0, 1);
    }
    if (livingLaw(f.key, "borders")) p.stability = liveClamp(p.stability + 0.005, 0, 1);
    for (const k of Object.keys(p.rel)) {
      const dispute = near.some(pv => (pv.owner === f.key && pv.contested === k) ||
                                      (pv.owner === k && pv.contested === f.key));
      p.rel[k] = liveClamp(p.rel[k] * 0.99 + (warPairs()[f.key] === k ? -0.012 : 0) -
                           (dispute ? 0.006 : 0) - (livingLaw(k, "privateers") ? 0.004 : 0), -1, 1);
    }
    p.cool.act = Math.max(0, p.cool.act - 1);
    p.cool.war = Math.max(0, p.cool.war - 1);
    p.cool.law = Math.max(0, (p.cool.law || 0) - 1);
    p.cool.enforce = Math.max(0, (p.cool.enforce || 0) - 1);
    for (const k of Object.keys(p.cool.raid || {})) p.cool.raid[k] = Math.max(0, p.cool.raid[k] - 1);
    for (const k of Object.keys(p.cool.trade || {})) p.cool.trade[k] = Math.max(0, p.cool.trade[k] - 1);
  }
  // 3. Pressures, then the one best thing each power can do about them.
  for (const key of POWERS_BY_STRENGTH()) {
    const p = L.powers[key];
    livingPressures(key, near);
    if (p.cool.act > 0) continue;
    const opts = livingOptions(key, near, R);
    if (!opts.length) continue;
    // The best thing that clears its own bar, and a little chance: the same
    // numbers should not always mean the same afternoon.
    const worth = opts.filter(x => x.score >= x.bar).sort((a, b) => (b.score - b.bar) - (a.score - a.bar));
    const best = worth[0];
    if (!best || R() > 0.75) continue;
    if (livingAct(key, best, R)) acted.push(key + ":" + best.act + (best.target ? ":" + best.target : ""));
  }
  // 4. §28: who is in charge, what the law is, whether anywhere rises, and
  //    which prices have stood too long.
  livingLeadersTurn(near, R);
  livingLawsTurn(near, R);
  livingPeopleTurn(near, R);
  livingCausesTurn(near, R);
  L.bounties = (L.bounties || []).filter(b => L.turn - b.turn < LIVING_BOUNTY_TURNS);
  return acted;
}

/* Per frame. The clock, the turn, and the one thing the player sees without
   opening a page: docking reads you the sector's headline, once, framed the
   way this station's owner would put it. */
function livingTick(dt) {
  const L = surv && surv.living;
  if (!L) return;
  if (L.pendingStrength) {
    /* A cause restored from the book: `surv.war` did not exist when the
       living world was read, so its strength lands here, once. */
    L.pendingStrength = false;
    for (const c of L.causes) if (typeof surv.war.strength[c.key] !== "number") surv.war.strength[c.key] = c.strength || 1;
  }
  L.clock += dt;
  if (L.clock - (L.turnAt || 0) >= LIVING_TURN) {
    L.turnAt = L.clock;
    livingTurn();
    saveSurveyBook();
  }
  const dock = surv.docked ? stationId(surv.docked) : null;
  if (dock && dock !== L.lastDock) {
    L.lastDock = dock;
    const news = livingNews(surv.docked.faction, 1);
    if (news.length) chatter(news[0].text, news[0].colour, false);
  } else if (!dock) L.lastDock = null;
}

/* ── the player, in the same world (§16) ────────────────────────────────── */
function livingKill(t) {
  if (!surv || !surv.living || !t) return;
  livingBountyPaid(t);
  // A raider shot down over a province is a province somebody defended.
  if (t.faction === "pirate") { const pv = provinceOfSite(t.x, t.y); if (pv) pv.guard = 1; }
  const armed = ROLES[t.role] && ROLES[t.role].armed;
  recordEvent({ kind: "kill", actor: "you", target: t.faction || "", what: t.role || t.kind || "",
                x: t.x, y: t.y, importance: t.faction === "pirate" ? 0.2 : armed ? 0.4 : 0.3,
                thread: t.faction && t.faction !== "pirate" && t.faction !== "free" ? "you:" + t.faction : "" });
}
function livingDelivery(st, key, n, shortBefore) {
  if (!surv || !surv.living || !st || shortBefore < 0.3) return;
  const p = surv.living.powers[st.faction];
  if (p && LIVING_GOODS.indexOf(key) >= 0) p[key] = liveClamp(p[key] + 0.03, 0, 1);
  const pv = provinceOfSite(st.x, st.y);
  if (pv) pv.relief = 1;
  const ev = recordEvent({ kind: "relief", actor: "you", target: st.faction || "free",
                           what: key, n, x: st.x, y: st.y, thread: "you:" + (st.faction || "free") });
  if (ev) noteKnown("relief", st.x, st.y, "RELIEF");
}
function livingRescue(t) {
  if (!surv || !surv.living || !t) return;
  recordEvent({ kind: "rescue", actor: "you", target: t.faction || "free", what: t.name || "",
                x: t.x, y: t.y, thread: "you:" + (t.faction || "free") });
}
function livingConvoy(t, lost) {
  if (!surv || !surv.living || !t) return;
  recordEvent({ kind: lost ? "loss" : "arrived", actor: lost ? (t.killer || "") : t.faction || "free",
                target: t.faction || "free", what: (t.cargo || []).join(","), x: t.x, y: t.y,
                thread: lost ? "lanes:" + (t.faction || "free") : "" });
}
function livingBattle(b, winner) {
  if (!surv || !surv.living || !b) return;
  const loser = winner ? (b.sides[0] === winner ? b.sides[1] : b.sides[0]) : "";
  recordEvent({ kind: "battle", actor: winner || b.sides[0], target: loser || b.sides[1],
                what: b.name || "", x: b.x, y: b.y, n: b.fleet || 0,
                importance: b.big ? 0.75 : 0.5,
                thread: "war:" + b.sides.slice().sort().join("-") });
}
function livingTaken(cx, cy, power, was) {
  if (!surv || !surv.living) return;
  const site = WORLD.regionSite(cx, cy);
  /* A cell settled from empty sky is barely news; one taken from somebody is.
     The record fills from the bottom otherwise — the frontier settles every
     few turns, and a hundred lines of that would bury the one war. */
  const ev = recordEvent({ kind: "taken", actor: power || "", target: was || "", x: site.x, y: site.y,
                           importance: power && was ? 0.35 : 0.12,
                           thread: power && was ? "war:" + [power, was].sort().join("-") : "claim:" + (power || was) });
  // On the chart as the moment it moved, if it moved near enough to matter.
  if (ev && was && power) noteKnown("taken", site.x, site.y, factionOf(power).short + " TOOK IT");
}


/* ═══ §28 — LEADERS, LAWS, THE PEOPLE, BOUNTIES ═════════════════════════════
   The first expansion, cut the way the first version was: each of these is
   a number that moves a number that was already here. A leader is two
   traits that pull a power's temper; a law is a switch with a cost the game
   already knows how to charge; the people are provinces that feel things; a
   bounty is a price on a name the sector already remembers. None of it adds
   words to the flight. Each is a bar, a glyph, a mark or a figure. */

/* ── leaders (§7) ─────────────────────────────────────────────────────────
   Kept simple, as the brief says: a name, a title, two traits and how
   popular they are. `hawk` pulls the power's aggression, `open` pulls its
   trade and its borders. Rolled from the seed, so a sector has the leaders
   it has. */
function livingName(R) {
  const word = () => (SYL_HEAD[Math.floor(R() * SYL_HEAD.length)] +
                      SYL_TAIL[Math.floor(R() * SYL_TAIL.length)]).toUpperCase();
  return word() + " " + word();
}
function livingLeader(R, key, turn, lean) {
  lean = lean || {};
  return { name: livingName(R), title: LIVING_TITLES[key] || (key.indexOf("c:") === 0 ? "SPEAKER" : "LEADER"),
           hawk: liveClamp(lean.hawk !== undefined ? lean.hawk : R(), 0, 1),
           open: liveClamp(lean.open !== undefined ? lean.open : R(), 0, 1),
           popularity: 0.6, since: turn | 0, term: (turn | 0) + LIVING_TERM };
}
/* A power's temper is half its own and half whoever leads it. */
function livingTemper(p) {
  const l = p.leader || { hawk: 0.5, open: 0.5 };
  return { aggression: (p.aggression + l.hawk) / 2, trade: (p.trade + l.open) / 2 };
}

/* Popularity follows the numbers; the election follows the calendar; a fall
   follows a collapse. The challenger is rolled AGAINST the problems of the
   day — a war going badly gets a dove, a shortage gets a trader, raids get
   a hawk — which is the brief's example (§7) as a rule rather than a story:
   the war goes badly, the leader changes, the policy changes. */
function livingLeadersTurn(near, R) {
  const L = surv.living, st = surv.war.strength, sides = warSides();
  for (const f of FACTIONS) {
    const key = f.key, p = L.powers[key];
    if (!p.leader) p.leader = livingLeader(R, key, L.turn);
    const l = p.leader;
    const atWar = sides.indexOf(key) >= 0, enemy = warPairs()[key] || "";
    const short = LIVING_GOODS.filter(g => p[g] < 0.3).length;
    const raided = p.pressures.indexOf("raided") >= 0;
    let want = 0.5 + (p.stability - 0.5) * 0.6 - short * 0.1 - (raided ? 0.1 : 0);
    if (atWar) want += ((st[key] || 1) - (st[enemy] || 1)) * 0.4 - 0.08;
    l.popularity = liveClamp(l.popularity + (want - l.popularity) * 0.08, 0, 1);
    const at = livingPlaceOf(key);
    // A fall: nobody stands behind a leader who is losing everything.
    /* Measured: at "stability under 0.2, popularity under 0.3, five turns
       in" a power fell a hundred times in four hundred turns, because the
       fall itself gave the next one nothing to stand on. A fall is rarer
       than that and the new government gets a honeymoon. */
    if (p.stability < 0.15 && l.popularity < 0.25 && L.turn - l.since > 30) {
      const next = livingLeader(R, key, L.turn, { hawk: R() * 0.5, open: 0.3 + R() * 0.7 });
      next.popularity = 0.55;
      p.leader = next;
      p.stability = liveClamp(p.stability + 0.25, 0, 1);
      p.cool.law = 0;
      recordEvent({ kind: "fall", actor: key, x: at.x, y: at.y, what: l.name, thread: "rule:" + key });
      chatter(f.short + " — " + l.title + " " + l.name + " has fallen.", f.colour, false);
      continue;
    }
    if (L.turn < (l.term || 0)) continue;
    // Election day.
    l.term = L.turn + LIVING_TERM;
    const losing = atWar && (st[key] || 1) < (st[enemy] || 1);
    const challenger = livingLeader(R, key, L.turn, {
      hawk: losing ? R() * 0.4 : raided ? 0.6 + R() * 0.4 : R(),
      open: short ? 0.6 + R() * 0.4 : R() });
    const support = 0.5 + (0.5 - l.popularity) * 1.2 + (R() - 0.5) * 0.25;
    if (support > 0.5) {
      challenger.term = l.term;
      p.leader = challenger;
      p.cool.law = 0;
      recordEvent({ kind: "election", actor: key, x: at.x, y: at.y, what: challenger.name, n: 1,
                    thread: "rule:" + key });
      chatter(f.short + " has a new " + challenger.title.toLowerCase() + ": " + challenger.name + ".",
              f.colour, false);
    } else {
      l.popularity = liveClamp(l.popularity + 0.1, 0, 1);
      recordEvent({ kind: "election", actor: key, x: at.x, y: at.y, what: l.name, n: 0,
                    thread: "rule:" + key, importance: 0.3 });
    }
  }
}

/* ── laws (§6) ────────────────────────────────────────────────────────────
   Three switches, each with a real effect somewhere else in the game:
     privateers    letters of marque — raiders are three times as common in
                   that power's sky (war.js), its raids come easier, and
                   everybody else thinks less of it every turn;
     borders       closed — no trade deals across it, foreign pilots are
                   paid a tariffed price at its stations (sector.js), a
                   little of the yield stays home, a little calm is bought;
     conscription  the fleet grows every turn and the calm goes with it,
                   and every province it holds is angrier for it.
   A leader changes the one law they feel most strongly about, at most
   once, then waits. */
function livingLaw(key, law) {
  const L = surv && surv.living, p = L && L.powers && L.powers[key];
  return !!(p && p.laws && p.laws[law]);
}
const LIVING_LAW_WORDS = {
  privateers:   ["LETTERS OF MARQUE ISSUED", "PRIVATEERS RECALLED"],
  borders:      ["BORDERS CLOSED", "BORDERS OPENED"],
  conscription: ["CONSCRIPTION ORDERED", "CONSCRIPTS SENT HOME"]
};
function livingLawsTurn(near, R) {
  const L = surv.living, st = surv.war.strength, sides = warSides();
  for (const f of FACTIONS) {
    const key = f.key, p = L.powers[key];
    if (!p.laws) p.laws = { privateers: false, borders: false, conscription: false };
    if (p.cool.law > 0 || R() > 0.5) continue;
    const l = p.leader || { hawk: 0.5, open: 0.5 };
    const atWar = sides.indexOf(key) >= 0, enemy = warPairs()[key] || "";
    const short = LIVING_GOODS.some(g => p[g] < 0.3);
    const raided = p.pressures.indexOf("raided") >= 0;
    const losing = atWar && (st[key] || 1) < (st[enemy] || 1);
    /* Provinces that have stopped paying are an argument against the laws
       that made them stop — to a dove. A hawk sends the fleet instead
       (`livingPeopleTurn`). */
    const withholding = near.some(pv => pv.owner === key && pv.withholding);
    const concede = withholding ? (1 - l.hawk) * 0.5 : 0;
    const wants = {
      privateers:   l.hawk * 0.6 + (atWar ? 0.3 : 0) + (raided ? 0.15 : 0) - l.open * 0.4,
      borders:      (raided ? 0.3 : 0) + (1 - l.open) * 0.5 + (atWar ? 0.2 : 0) - (short ? 0.35 : 0) - concede,
      conscription: (atWar ? 0.5 : 0) + l.hawk * 0.3 + (losing ? 0.2 : 0) - (p.stability < 0.35 ? 0.3 : 0) - concede
    };
    // The one it feels most strongly about, if it feels strongly at all.
    let pick = null, gap = 0;
    for (const law of LIVING_LAWS) {
      const on = p.laws[law], w = wants[law];
      const d = on ? Math.max(0, 0.25 - w) : Math.max(0, w - 0.5);
      if (d > gap) { gap = d; pick = law; }
    }
    if (!pick) continue;
    p.laws[pick] = !p.laws[pick];
    p.cool.law = LIVING_LAW_COOL;
    const at = livingPlaceOf(key);
    recordEvent({ kind: "law", actor: key, x: at.x, y: at.y, what: pick, n: p.laws[pick] ? 1 : 0,
                  thread: "law:" + key });
    if (pick === "privateers") {
      for (const g of FACTIONS) {
        if (g.key === key) continue;
        L.powers[g.key].rel[key] = liveClamp(L.powers[g.key].rel[key] + (p.laws[pick] ? -0.08 : 0.04), -1, 1);
      }
    }
    chatter(f.short + ": " + LIVING_LAW_WORDS[pick][p.laws[pick] ? 0 : 1].toLowerCase() + ".", f.colour, false);
  }
}

/* ── the people (§8) ─────────────────────────────────────────────────────
   Ric's rule for this: civil war is not a feature. "It needs to be able to
   happen through the collectives of the people. Nothing forced or faked.
   You make the elements and the world exists through randomness." So there
   is no line here that decides a civil war happens. There are provinces
   that feel things, and what they do about it, and a power that answers
   from its own temper; secession is only the name for a shape the map can
   end up in. Most sectors never get there, the way most countries do not.

   The elements:
     LOYALTY     how a province feels about the flag over it. Moved only by
                 things that happened to it — raided with nobody defending
                 it, drafted, starved behind a closed border, left short,
                 sat on a front — and things done for it: a fleet that
                 stood over it, a raider shot down over it, a shortage a
                 pilot broke. Its leader's popularity counts for a little.
     TALK        neighbours of one flag pull each other's loyalty toward
                 their own. People talk; a grievance spreads or is talked
                 down.
     WITHHOLDING a province whose loyalty is under the line stops paying its
                 owner — if the guns are not on it. That is its only action,
                 and it is a real one: the owner is poorer for it, and poor
                 is where every other action starts.
     A BLOC      withholding provinces of one flag that touch are one thing,
                 named for the place the way ships are named. Nothing creates
                 it; it is the shape of the map.
     THE ANSWER  a hawk with a fleet to spare sends it: the guns go on, and
                 the people pay again, resentfully, until the fleet leaves.
                 A dove lifts the law that caused it (`livingLawsTurn`).
     SECESSION   a bloc that has withheld long enough with no fleet over it
                 holds its own sky: its cells are its own, a fourth flag is
                 on the lattice, ships crewed from there fly it, and the old
                 owner may make war on it or not, by the same arithmetic as
                 any other war. It is taken back the same way, cell by cell,
                 and when it holds nothing it is gone. */

/* Which province a point is in, if it has been looked at. */
function provinceOfSite(x, y) {
  const L = surv && surv.living;
  if (!L) return null;
  const site = WORLD.siteAt(x, y);
  const [px, py] = provinceAtCell(site.cx, site.cy);
  return provinceOf(px, py);
}
/* A place name off the sector's own gazetteer, rolled once for the spot. */
function causeName(px, py) {
  const R = seeded(chunkSeed(px ^ 0x1c3d5e7f, py ^ 0x7e5d3c1b));
  const w = SYL_HEAD[Math.floor(R() * SYL_HEAD.length)] + SYL_TAIL[Math.floor(R() * SYL_TAIL.length)];
  return w.toUpperCase();
}
const adjacent = (a, b) => Math.abs(a.px - b.px) + Math.abs(a.py - b.py) === 1;

function livingPeopleTurn(near, R) {
  const L = surv.living, st = surv.war.strength, sides = warSides();
  // 1. Loyalty follows what happened to each province.
  for (const pv of near) {
    pv.hurt = (pv.hurt || 0) * 0.85; pv.relief = (pv.relief || 0) * 0.9; pv.guard = (pv.guard || 0) * 0.9;
    const key = pv.owner, p = key ? L.powers[key] : null;
    if (!p) { pv.withholding = false; pv.withheld = 0; pv.cause = ""; continue; }
    const front = pv.contested && sides.indexOf(key) >= 0;
    const short = LIVING_GOODS.some(g => p[g] < 0.2);
    const pop = p.leader ? p.leader.popularity : 0.5;
    /* People are loyal by habit. The resting point is contented, and only
       real things pull it down — each one small, so it takes several at once
       and for a long time. Measured: with the resting point at 0.35 plus
       security, the average province sat near 0.3, every seed seceded and
       one seceded ten times. A sector is not a country on the brink. */
    const want = 0.8 + (pop - 0.5) * 0.15 -
                 Math.max(0, 0.45 - p.stability) * 0.6 -
                 (livingLaw(key, "conscription") ? 0.1 : 0) - (livingLaw(key, "borders") ? 0.04 : 0) -
                 (short ? 0.08 : 0) - (front ? 0.08 : 0) -
                 pv.hurt * (pv.security > 0.6 ? 0.03 : 0.2) + pv.relief * 0.1 + pv.guard * 0.08 -
                 /* A movement has momentum: provinces that have stopped paying
                    together and have a name for themselves are partly held
                    there by the name. It fades when they pay again. */
                 (pv.cause ? 0.08 : 0);
    // Slowly: a grievance is a season, not an afternoon.
    pv.loyalty = liveClamp((typeof pv.loyalty === "number" ? pv.loyalty : 0.75) + (want - pv.loyalty) * 0.04, 0, 1);
  }
  // 2. People talk.
  for (const pv of near) {
    if (!pv.owner) continue;
    const nb = near.filter(o => o !== pv && o.owner === pv.owner && adjacent(o, pv));
    if (!nb.length) continue;
    const mean = nb.reduce((sum, o) => sum + o.loyalty, 0) / nb.length;
    pv.loyalty = liveClamp(pv.loyalty + (mean - pv.loyalty) * 0.05, 0, 1);
  }
  // 3. Withholding, and how long for.
  for (const pv of near) {
    if (!pv.owner) continue;
    const w = pv.loyalty < LIVING_WITHHOLD && pv.security < LIVING_GUNS;
    pv.withholding = w;
    pv.withheld = w ? (pv.withheld | 0) + 1 : Math.max(0, (pv.withheld | 0) - 2);
    if (!w && !pv.withheld) pv.cause = "";
  }
  // 4. Blocs: withholding provinces of one flag that touch.
  const seen = new Set(), blocs = [];
  for (const pv of near) {
    if (!pv.withholding || seen.has(pv)) continue;
    const bloc = [], stack = [pv];
    seen.add(pv);
    while (stack.length) {
      const q = stack.pop();
      bloc.push(q);
      for (const o of near) {
        if (seen.has(o) || !o.withholding || o.owner !== q.owner || !adjacent(o, q)) continue;
        seen.add(o); stack.push(o);
      }
    }
    if (bloc.length >= 2) blocs.push(bloc);
  }
  for (const bloc of blocs) {
    const owner = bloc[0].owner, p = L.powers[owner];
    const anchor = bloc.slice().sort((a, b) => a.py - b.py || a.px - b.px)[0];
    const site = provinceSite(anchor);
    // Its name is the one its people already had, or the place's.
    let key = bloc.map(q => q.cause).find(c => c);
    if (!key) {
      const place = causeName(anchor.px, anchor.py);
      key = "c:" + place.toLowerCase();
      recordEvent({ kind: "cause", actor: owner, what: place, n: bloc.length, x: site.x, y: site.y,
                    thread: "cause:" + key });
      noteKnown("cause", site.x, site.y, place + " WITHHOLDS");
      chatter("The " + place + " provinces have stopped paying " + factionOf(owner).short + ".",
              LIVING_KINDS.cause.colour, { x: site.x, y: site.y });
    }
    for (const q of bloc) q.cause = key;
    // 5. The owner answers from its own temper: a hawk with a fleet sends it.
    const l = p.leader || { hawk: 0.5 };
    if (l.hawk >= 0.5 && (st[owner] || 1) > 0.8 && !(p.cool.enforce > 0)) {
      p.cool.enforce = LIVING_ENFORCE_COOL;
      st[owner] = Math.max(0.2, (st[owner] || 1) - 0.02);
      p.stability = liveClamp(p.stability - 0.01, 0, 1);
      for (const q of bloc) { q.garrison = 1; q.loyalty = liveClamp(q.loyalty - 0.03, 0, 1); }
      recordEvent({ kind: "enforce", actor: owner, what: key.slice(2).toUpperCase(), n: bloc.length,
                    x: site.x, y: site.y, thread: "cause:" + key });
    }
    // 6. Secession is a state the map reaches, not a step anybody takes.
    const held = bloc.reduce((sum, q) => sum + (q.withheld | 0), 0) / bloc.length;
    if (held >= LIVING_SECEDE && bloc.every(q => q.security < 0.35)) livingSecede(bloc, key, owner, R);
  }
}

/* ── a fourth flag ────────────────────────────────────────────────────────
   A cause that holds its own sky is a faction like any other: it is pushed
   onto `FACTIONS`, so every loop in the game that asks "for each power"
   finds it — traffic flies its colours, the standings list it, the strip and
   the board give it a tile, the war can be against it. It is a power in the
   living world too, born from its parent's numbers and its people's
   grievance. `livingClearCauses` takes them all off for a new sector. */
function livingClearCauses() {
  for (let i = FACTIONS.length - 1; i >= 0; i--) if (FACTIONS[i].cause) FACTIONS.splice(i, 1);
}
function registerCause(c) {
  if (FACTIONS.some(f => f.key === c.key)) return;
  FACTIONS.push({ key: c.key, name: c.name, short: c.short, colour: c.colour, cause: true, from: c.from,
                  note: "held its own sky against " + (factionOf(c.from).short || "its old flag").toLowerCase(),
                  long: "Provinces that stopped paying " + factionOf(c.from).name + " and were never " +
                        "brought back. Their ships fly this now." });
}
function livingSecede(bloc, key, owner, R) {
  const L = surv.living, st = surv.war.strength;
  if (L.powers[key]) return;
  // The sky first: a bloc with none of its owner's cells in it has nothing to hold.
  const cells = [];
  for (const q of bloc) {
    for (let j = 0; j < LIVING_BLOCK; j++) for (let i = 0; i < LIVING_BLOCK; i++) {
      const cx = q.px * LIVING_BLOCK + i, cy = q.py * LIVING_BLOCK + j;
      if (WORLD.holderOf(cx, cy) === owner && !WORLD.homeCell(cx, cy)) cells.push(cx + "," + cy);
    }
  }
  if (!cells.length) return;
  const place = key.slice(2).toUpperCase();
  const c = { key, short: place, name: "THE " + place + " FREEHOLD",
              colour: LIVING_CAUSE_COLOURS[L.causes.length % LIVING_CAUSE_COLOURS.length],
              from: owner, since: L.turn };
  L.causes.push(c);
  registerCause(c);
  // What the bloc's provinces held for the owner, they hold for themselves.
  for (const k of cells) surv.claims.set(k, key);
  const took = cells.length;
  WORLD.territoryChanged();
  // The power: its parent's goods in part, its people's grievance as temper.
  const p = L.powers[owner];
  const grievance = bloc.reduce((sum, q) => sum + (1 - q.loyalty), 0) / bloc.length;
  const n = livingPower(R || Math.random, key, L.turn);
  for (const g of LIVING_GOODS) n[g] = liveClamp(p[g] * 0.6 + 0.1, 0, 1);
  n.stability = 0.5;
  n.aggression = liveClamp(0.25 + grievance * 0.4, 0, 1);
  n.expansion = 0.3;
  n.trade = p.trade;
  for (const f of FACTIONS) {
    if (f.key === key) continue;
    n.rel[f.key] = f.key === owner ? -0.7 : 0.1;
    if (L.powers[f.key]) L.powers[f.key].rel[key] = f.key === owner ? -0.7 : 0;
  }
  n.leader.popularity = 0.7;
  L.powers[key] = n;
  // The fleet: ships crewed from there go over with it.
  const share = bloc.length / Math.max(1, provincesNear().near.filter(q => q.owner === owner || q.owner === key).length);
  const strength = liveClamp(0.4 + (st[owner] || 1) * share, 0.2, 1.4);
  st[key] = strength;
  st[owner] = Math.max(0.2, (st[owner] || 1) - strength * 0.4);
  c.strength = strength;
  for (const q of bloc) { q.loyalty = 0.7; q.cause = ""; q.withheld = 0; q.withholding = false; }
  const site = provinceSite(bloc[0]);
  recordEvent({ kind: "secede", actor: key, target: owner, what: c.name, n: took, x: site.x, y: site.y,
                thread: "cause:" + key });
  noteKnown("secede", site.x, site.y, place + " SECEDED");
  chatter(c.name + " has seceded from " + factionOf(owner).name + ".", c.colour, false);
}
/* A cause that holds nothing any more is gone: the last of its sky was taken
   back, cell by cell, by the war or the frontier. */
function livingCausesTurn(near, R) {
  const L = surv.living;
  if (!L.causes || !L.causes.length) return;
  const holds = {};
  for (const v of surv.claims.values()) if (v) holds[v] = (holds[v] || 0) + 1;
  for (let i = L.causes.length - 1; i >= 0; i--) {
    const c = L.causes[i];
    if (holds[c.key]) continue;
    L.causes.splice(i, 1);
    delete L.powers[c.key];
    for (let k = FACTIONS.length - 1; k >= 0; k--) if (FACTIONS[k].key === c.key) FACTIONS.splice(k, 1);
    for (const f of FACTIONS) if (L.powers[f.key]) delete L.powers[f.key].rel[c.key];
    for (const pv of L.provinces.values()) if (pv.cause === c.key) pv.cause = "";
    const war = surv.war;
    if (war.belligerents.indexOf(c.key) >= 0) { war.pairs = {}; war.belligerents = []; war.calm = 0; }
    delete surv.war.strength[c.key];
    const at = livingPlaceOf(c.from);
    recordEvent({ kind: "absorbed", actor: c.from, target: "", what: c.name, x: at.x, y: at.y,
                  thread: "cause:" + c.key });
    chatter(c.name + " holds nothing now.", LIVING_KINDS.absorbed.colour, false);
  }
}

/* ── bounties (§28) ───────────────────────────────────────────────────────
   A raider that got away from you in somebody's sky gets a price on its
   name, posted by whoever holds that sky. The name is the one the grudge
   already carries (`rememberGrudge`), so the ship that comes back to find
   you is the ship that is wanted. Paid on the kill, to you, by the poster. */
function livingBounty(t) {
  const L = surv && surv.living;
  if (!L || !t || !t.name) return null;
  L.bounties = L.bounties || [];
  if (L.bounties.some(b => b.name === t.name)) return null;
  const me = ships[0];
  const site = WORLD.siteAt(me ? me.x : t.x, me ? me.y : t.y);
  const by = WORLD.holderOf(site.cx, site.cy);
  if (!by || !L.powers[by]) return null;   // nobody's sky posts nothing
  const amount = Math.round((600 + Math.max(0, t.maxHp || t.hp || 0) * 6) / 50) * 50;
  const b = { name: String(t.name).slice(0, 40), by, amount, turn: L.turn };
  L.bounties.push(b);
  if (L.bounties.length > LIVING_BOUNTY_CAP) L.bounties.shift();
  recordEvent({ kind: "bounty", actor: by, target: "pirate", what: b.name, n: amount,
                x: t.x, y: t.y, thread: "bounty:" + b.name.slice(0, 24) });
  chatter(factionOf(by).short + " has put " + money(amount) + " on " + b.name + ".", factionOf(by).colour, false);
  return b;
}
function livingBountyPaid(t) {
  const L = surv && surv.living;
  if (!L || !L.bounties || !t || !t.grudge || !t.name) return false;
  const i = L.bounties.findIndex(b => b.name === t.name);
  if (i < 0) return false;
  const b = L.bounties.splice(i, 1)[0];
  surv.cash += b.amount;
  addRep(b.by, 2);
  recordEvent({ kind: "claimed", actor: "you", target: b.by, what: b.name, n: b.amount,
                x: t.x, y: t.y, thread: "bounty:" + b.name.slice(0, 24) });
  chatter("BOUNTY PAID — " + money(b.amount) + " from " + factionOf(b.by).short + ".", "#ffe56d");
  return true;
}

/* ── the news (§20) ───────────────────────────────────────────────────────
   Same facts, framed by the flag telling them. A power says "we"; a rival
   says the other side's name coldly; an unaligned station says it straight.
   Never invented: every line is an event that is in the record. */
function livingLine(ev, flag) {
  const A = factionOf(ev.actor), T = factionOf(ev.target);
  const you = ev.actor === "you";
  const us = flag && (ev.actor === flag || ev.target === flag);
  const weActed = flag && ev.actor === flag, weSuffered = flag && ev.target === flag;
  const a = you ? "A pilot" : A.short, t = T.short;
  /* A cause that was absorbed is UNALIGNED to `factionOf` now; its lines
     keep its name because the event carries it. */
  switch (ev.kind) {
    case "war":
      return weActed ? "WE ARE AT WAR WITH " + t
           : weSuffered ? a + " HAS ATTACKED US"
           : a + " AND " + t + " ARE AT WAR";
    case "peace":
      return us ? "CEASEFIRE — THE SHOOTING HAS STOPPED" : a + " AND " + t + " HAVE MADE PEACE";
    case "raid":
      return weActed ? "OUR RAIDERS HIT " + t + " SHIPPING"
           : weSuffered ? a + " RAIDERS ARE HITTING OUR LANES"
           : a + " RAIDED " + t;
    case "trade":
      return us ? "A TRADE DEAL WITH " + (weActed ? t : a) + " — " + (ev.what || "goods").toUpperCase() + " IS MOVING"
           : a + " AND " + t + " ARE TRADING";
    case "claim":
      return weActed ? "WE HAVE SETTLED NEW SKY" : a + " IS SETTLING THE FRONTIER";
    case "taken":
      return weActed ? "GROUND TAKEN FROM " + t
           : weSuffered ? "WE HAVE LOST GROUND TO " + a
           : a + " HAS TAKEN GROUND FROM " + t;
    case "battle":
      return weActed ? "VICTORY AT " + (ev.what || "THE FRONT")
           : weSuffered ? "A DEFEAT AT " + (ev.what || "THE FRONT")
           : (ev.what || "A BATTLE") + " — " + a + " HELD THE FIELD";
    case "kill":
      return weSuffered ? "ONE OF OURS WAS SHOT DOWN" : "A " + t + " " + (ev.what || "SHIP").toUpperCase() + " WAS SHOT DOWN";
    case "relief":
      return weSuffered ? "A PILOT BROKE OUR " + (ev.what || "").toUpperCase() + " SHORTAGE"
           : "A SHORTAGE AT A " + t + " STATION HAS EASED";
    case "rescue":
      return weSuffered ? "ONE OF OURS WAS PULLED OUT OF TROUBLE" : "A " + t + " SHIP WAS RESCUED";
    case "loss":
      return weSuffered ? "A CONVOY OF OURS WAS LOST" : "A " + t + " CONVOY WAS LOST";
    case "arrived":
      return "A " + t + " CONVOY GOT THROUGH";
    case "election": {
      const title = LIVING_TITLES[ev.actor] || "LEADER";
      return ev.n ? (weActed ? "WE HAVE A NEW " + title + " — " + ev.what : a + " HAS ELECTED " + ev.what)
                  : (weActed ? "OUR " + title + " HOLDS ON" : a + " KEPT ITS " + title);
    }
    case "fall": {
      const title = LIVING_TITLES[ev.actor] || "LEADER";
      return weActed ? "OUR " + title + " HAS FALLEN" : "THE " + a + " " + title + " HAS FALLEN";
    }
    case "law": {
      const w = LIVING_LAW_WORDS[ev.what];
      const said = w ? w[ev.n ? 0 : 1] : "THE LAW HAS CHANGED";
      return weActed ? said + " AT HOME" : a + " — " + said;
    }
    case "cause":
      return weActed ? "THE " + ev.what + " PROVINCES HAVE STOPPED PAYING"
           : "THE " + ev.what + " PROVINCES WITHHOLD FROM " + a;
    case "enforce":
      return weActed ? "THE FLEET IS OVER " + ev.what : a + " HAS SENT THE FLEET TO " + ev.what;
    case "secede":
      return weActed ? "WE ARE OUR OWN NOW"
           : weSuffered ? "WE HAVE LOST " + ev.what + " — IT FLIES ITS OWN FLAG"
           : ev.what + " HAS SECEDED FROM " + t;
    case "absorbed":
      return weActed ? ev.what + " IS OURS AGAIN" : ev.what + " HOLDS NOTHING NOW";
    case "bounty":
      return weActed ? "WE HAVE PUT A PRICE ON " + ev.what : a + " WANTS " + ev.what + " DEAD";
    case "claimed":
      return weSuffered ? "A PILOT COLLECTED OUR PRICE ON " + ev.what : "THE PRICE ON " + ev.what + " WAS PAID";
  }
  return "";
}

function livingNews(flag, n) {
  const L = surv && surv.living;
  if (!L) return [];
  const powers = FACTIONS.map(f => f.key);
  const teller = powers.indexOf(flag) >= 0 ? flag : "";
  const seen = new Set();
  const out = [];
  const list = L.events.slice().sort((a, b) => (b.importance - a.importance) || (b.id - a.id));
  for (const ev of list) {
    if (out.length >= (n || 3)) break;
    if (ev.importance < 0.3) continue;
    const key = ev.kind + ":" + ev.actor + ":" + ev.target;
    if (seen.has(key)) continue;
    seen.add(key);
    const text = livingLine(ev, teller);
    if (!text) continue;
    out.push({ text, colour: LIVING_KINDS[ev.kind].colour, kind: ev.kind, id: ev.id, t: ev.t });
  }
  return out;
}

/* ── what the pages read ──────────────────────────────────────────────────
   Numbers for bars and colours for tiles; the words are one line each. */
function livingState() {
  const L = surv && surv.living;
  if (!L) return null;
  const { here, near } = provincesNear();
  const sides = warSides();
  const total = near.length;
  const powers = FACTIONS.map(f => {
    const p = L.powers[f.key];
    const holds = near.filter(pv => pv.owner === f.key).length;
    return { key: f.key, short: f.short, name: f.name, colour: f.colour,
             strength: liveClamp((surv.war.strength[f.key] || 1) / 1.4, 0, 1),
             holdings: total ? holds / total : 0,
             goods: LIVING_GOODS.map(g => {
               const m = MATERIALS.find(x => x.key === g);
               return { key: g, name: m ? m.name : g.toUpperCase(), colour: m ? m.colour : "#9aa6b8", v: p[g] };
             }),
             stability: p.stability, rel: Object.assign({}, p.rel),
             atWar: sides.indexOf(f.key) >= 0, enemy: warPairs()[f.key] || "",
             pressures: p.pressures.slice(),
             cause: !!f.cause, from: f.from || "", fromColour: f.from ? factionOf(f.from).colour : "",
             leader: p.leader ? { name: p.leader.name, title: p.leader.title, popularity: p.leader.popularity,
                                  hawk: p.leader.hawk, open: p.leader.open,
                                  since: p.leader.since, term: p.leader.term } : null,
             laws: LIVING_LAWS.map(law => ({ key: law, on: !!(p.laws && p.laws[law]) })) };
  });
  const bounties = (L.bounties || []).slice().reverse().map(b => ({
    name: b.name, by: factionOf(b.by).short, colour: factionOf(b.by).colour, amount: b.amount }));
  /* Newest first, and the same thing said once: three trades between the
     same two in a row are one fact, and the page has eight lines. */
  const seenKey = new Set();
  const recent = L.events.slice(-60).reverse().filter(ev => {
    const k = ev.kind + ":" + ev.actor + ":" + ev.target;
    if (seenKey.has(k)) return false;
    seenKey.add(k);
    return true;
  }).slice(0, 8).map(ev => ({
    id: ev.id, kind: ev.kind, glyph: LIVING_KINDS[ev.kind].glyph,
    colour: LIVING_KINDS[ev.kind].colour,
    actor: ev.actor === "you" ? "" : factionOf(ev.actor).colour,
    line: livingLine(ev, ""), ago: Math.max(0, L.clock - ev.t),
    x: ev.x, y: ev.y, importance: ev.importance
  }));
  return {
    turn: L.turn, powers,
    here: { owner: here.owner, colour: here.owner ? factionOf(here.owner).colour : "",
            control: here.control, contested: here.contested,
            contestedColour: here.contested ? factionOf(here.contested).colour : "",
            unrest: here.unrest, security: here.security,
            loyalty: typeof here.loyalty === "number" ? here.loyalty : 0.7,
            withholding: !!here.withholding, cause: here.cause || "" },
    history: recent, bounties,
    news: surv.docked ? livingNews(surv.docked.faction, 3) : []
  };
}

/* ── the book ─────────────────────────────────────────────────────────── */
function livingToBook() {
  const L = surv && surv.living;
  if (!L) return null;
  return {
    turn: L.turn, clock: Math.round(L.clock), seq: L.seq, warSince: L.warSince || 0,
    powers: L.powers,
    provinces: [...L.provinces.values()].slice(-400).map(pv => ({
      px: pv.px, py: pv.py, ice: pv.ice, iron: pv.iron, alloy: pv.alloy,
      unrest: pv.unrest, security: pv.security,
      loyalty: pv.loyalty, cause: pv.cause || "", withheld: pv.withheld | 0,
      hurt: pv.hurt || 0, relief: pv.relief || 0, guard: pv.guard || 0, garrison: pv.garrison || 0 })),
    events: L.events,
    bounties: L.bounties || [],
    causes: (L.causes || []).map(c => ({ key: c.key, short: c.short, name: c.name, colour: c.colour,
                                          from: c.from, since: c.since | 0,
                                          strength: surv.war.strength[c.key] || c.strength || 1 }))
  };
}
function livingFromBook(seed, saved) {
  const L = livingFresh(seed);
  if (!saved || typeof saved !== "object") return L;
  L.turn = Math.max(0, saved.turn | 0);
  L.clock = Math.max(0, Number(saved.clock) || 0);
  L.turnAt = L.clock;
  L.seq = Math.max(0, saved.seq | 0);
  L.warSince = Math.max(0, saved.warSince | 0);
  /* The causes first, so the loop over `FACTIONS` below finds them. The
     validator has already checked the keys; the parent must be a real flag. */
  const R = seeded(((seed | 0) ^ 0x5ca11ed) >>> 0);
  for (const c of (Array.isArray(saved.causes) ? saved.causes : [])) {
    if (!c || typeof c.key !== "string" || !/^c:[a-z]{2,20}$/.test(c.key)) continue;
    if (!FACTIONS.some(f => f.key === c.from && !f.cause)) continue;
    const place = c.key.slice(2).toUpperCase();
    const cc = { key: c.key, short: place, name: "THE " + place + " FREEHOLD",
                 colour: LIVING_CAUSE_COLOURS[L.causes.length % LIVING_CAUSE_COLOURS.length],
                 from: c.from, since: Math.max(0, c.since | 0),
                 strength: liveClamp(typeof c.strength === "number" ? c.strength : 1, 0.2, 1.4) };
    L.causes.push(cc);
    registerCause(cc);
    L.powers[c.key] = livingPower(R, c.key, L.turn);
  }
  L.pendingStrength = L.causes.length > 0;
  for (const f of FACTIONS) {
    const s = saved.powers && saved.powers[f.key];
    if (!s) continue;
    const p = L.powers[f.key];
    for (const k of ["ice", "iron", "alloy", "stability", "aggression", "expansion", "trade"]) {
      if (typeof s[k] === "number") p[k] = liveClamp(s[k], 0, 1);
    }
    for (const g of FACTIONS) if (g.key !== f.key && s.rel && typeof s.rel[g.key] === "number") p.rel[g.key] = liveClamp(s.rel[g.key], -1, 1);
    if (s.cool) {
      p.cool.act = Math.max(0, s.cool.act | 0); p.cool.war = Math.max(0, s.cool.war | 0);
      p.cool.law = Math.max(0, s.cool.law | 0);
      for (const g of FACTIONS) {
        if (s.cool.raid && typeof s.cool.raid[g.key] === "number") p.cool.raid[g.key] = Math.max(0, s.cool.raid[g.key] | 0);
        if (s.cool.trade && typeof s.cool.trade[g.key] === "number") p.cool.trade[g.key] = Math.max(0, s.cool.trade[g.key] | 0);
      }
    }
    if (s.laws && typeof s.laws === "object") for (const law of LIVING_LAWS) p.laws[law] = !!s.laws[law];
    if (s.leader && typeof s.leader === "object" && typeof s.leader.name === "string") {
      p.leader = { name: s.leader.name.slice(0, 40), title: LIVING_TITLES[f.key] || "LEADER",
                   hawk: liveClamp(typeof s.leader.hawk === "number" ? s.leader.hawk : 0.5, 0, 1),
                   open: liveClamp(typeof s.leader.open === "number" ? s.leader.open : 0.5, 0, 1),
                   popularity: liveClamp(typeof s.leader.popularity === "number" ? s.leader.popularity : 0.5, 0, 1),
                   since: Math.max(0, s.leader.since | 0), term: Math.max(0, s.leader.term | 0) };
    }
  }
  L.bounties = (Array.isArray(saved.bounties) ? saved.bounties : [])
    .filter(b => b && typeof b.name === "string" && FACTIONS.some(f => f.key === b.by))
    .slice(-LIVING_BOUNTY_CAP)
    .map(b => ({ name: b.name.slice(0, 40), by: b.by, amount: Math.max(0, b.amount | 0), turn: Math.max(0, b.turn | 0) }));
  for (const pv of (saved.provinces || [])) {
    if (!pv || !Number.isFinite(pv.px) || !Number.isFinite(pv.py)) continue;
    const got = provinceOfFresh(L, pv.px | 0, pv.py | 0);
    for (const k of ["ice", "iron", "alloy", "unrest", "security", "loyalty", "hurt", "relief", "guard", "garrison"]) {
      if (typeof pv[k] === "number") got[k] = liveClamp(pv[k], 0, 1);
    }
    got.withheld = Math.max(0, pv.withheld | 0);
    got.cause = typeof pv.cause === "string" && /^c:[a-z]{2,20}$/.test(pv.cause) ? pv.cause : "";
  }
  for (const ev of (saved.events || [])) {
    if (!ev || !LIVING_KINDS[ev.kind]) continue;
    L.events.push({ id: ev.id | 0, turn: ev.turn | 0, t: ev.t | 0, kind: ev.kind,
                    actor: String(ev.actor || "").slice(0, 12), target: String(ev.target || "").slice(0, 12),
                    x: ev.x | 0, y: ev.y | 0, what: String(ev.what || "").slice(0, 60),
                    thread: String(ev.thread || "").slice(0, 40), n: ev.n | 0,
                    importance: liveClamp(ev.importance, 0, 1) });
  }
  L.events = L.events.slice(-LIVING_CAP);
  return L;
}
// The same as `provinceOf`, before `surv.living` exists to hang it on.
function provinceOfFresh(L, px, py) {
  const key = provinceKey(px, py);
  let pv = L.provinces.get(key);
  if (!pv) {
    const R = seeded(chunkSeed(px ^ 0x3a7f11c5, py ^ 0x5d9b2e73));
    pv = { px, py, ice: R(), iron: R(), alloy: R(), owner: "", control: 0, contested: "",
           security: 0.5, unrest: 0.1,
           loyalty: 0.7 + R() * 0.15, cause: "", withheld: 0, withholding: false,
           hurt: 0, relief: 0, guard: 0, garrison: 0 };
    L.provinces.set(key, pv);
  }
  return pv;
}
