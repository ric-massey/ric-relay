"use strict";

/* KONDRITE — SURVEY — JOBS
   ─────────────────────────────────────────────────────────────────�
   A station's job board: what the stations it knows are short of, as work
   you can take; what you have taken; and what you have done for whom.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ═══ JOBS ════════════════════════════════════════════════════════════════
   WORLD-IDEAS.md, "A world the player has a history in". Ric, 2026-11-12:
   *"quests are almost needed to show more of the world."* And on 2026-11-13,
   asked how a job should reach the player, he chose **a board at stations**.

   The rule this file exists to keep is the brief's own: *"Any eventual quest
   should agree with the actual situation and its outcome should affect that
   situation … it does not authorize inventing a shortage merely to display a
   quest."* So nothing here makes anything up:

     · an offer is a **real shortage** at a real station — the same number the
       price is made of (`marketOf`, sector.js). If nothing near is short, the
       board is empty, and it says so;
     · the reason on the card is read off the living world's record — the
       convoys actually lost near that station — or it is the station's own
       habit, and the card says which;
     · delivering is **the ordinary sale**. A job adds no second way to hand
       cargo over: `sellSome` and `sellHold` call `jobSold`, so the shortage
       eases by exactly what a sale eases it, the relief lands in the record
       the way any relief does, and the bonus is the only thing a job adds;
     · if the shortage goes away without you — a convoy got through — the job
       lapses and says why. You are paid for the part you carried.

   What it is *for* is the other half of the brief: a delivery **shows you a
   station you have not been to**. Taking a job writes its dock onto your
   chart, by name. Stations had no names until this file; a place you are
   meant to recognise needs one. */

const JOB_CHUNKS = 20;         // chunks either side of a dock that it knows
const JOB_MAX    = 3;          // taken at once
const JOB_SHORT  = 0.45;       // how short a station is before it posts
const JOB_OFFERS = 4;          // rows on one board
const JOB_TURNS  = 120;        // living turns (two hours of play) before one goes stale
const JOB_LOSS_REACH = 26000;  // the same radius a lost convoy deepens a shortage over
const JOB_DONE_CAP = 40;       // deliveries remembered

/* A station's name: a function of where it is, like everything else about a
   place, so it is the same station a week later and nothing is stored. */
function stationName(st) {
  if (!st) return "";
  if (dist2(st.x, st.y, HOME_STATION.x, HOME_STATION.y) < 400 * 400) return "HOME";
  const R = seeded(chunkSeed(Math.round(st.x / 13) ^ 0x2f6e2b1,
                             Math.round(st.y / 13) ^ 0x5bd1e995));
  const syl = list => list[Math.floor(R() * list.length)];
  return (syl(SYL_HEAD) + syl(SYL_TAIL) + (R() < 0.35 ? syl(SYL_TAIL) : "")).toUpperCase();
}

const freshJobs = () => ({ taken: [], done: [] });
const jobBook = () => (surv.jobs || (surv.jobs = freshJobs()));
const sameDock = (a, b) => dist2(a.x, a.y, b.x, b.y) < 200 * 200;

/* The stations a dock knows about: every one within twenty chunks, read off
   the same generator the sky is built from. Measured: 1,681 chunks in 36 ms,
   once per docking — the answer is kept until you dock somewhere else. */
let jobProbe = { id: null, seed: null, list: [] };
function stationsAround(st) {
  const id = stationId(st);
  if (jobProbe.id === id && jobProbe.seed === surv.seed) return jobProbe.list;
  const cx0 = Math.floor(st.x / CHUNK), cy0 = Math.floor(st.y / CHUNK);
  const list = [];
  for (let dx = -JOB_CHUNKS; dx <= JOB_CHUNKS; dx++) {
    for (let dy = -JOB_CHUNKS; dy <= JOB_CHUNKS; dy++) {
      for (const o of buildChunk(cx0 + dx, cy0 + dy).stations) {
        if (sameDock(o, st)) continue;
        // Your own station is not somebody else's customer.
        if (sameDock(o, HOME_STATION)) continue;
        list.push({ x: o.x, y: o.y, faction: o.faction || "free" });
      }
    }
  }
  jobProbe = { id, seed: surv.seed, list };
  return list;
}

/* What a station most needs, without writing anything: its live market if
   somebody has been near it, and otherwise the baseline it would have. Only
   things it actually buys — a need it will not pay for is not a job. */
function stationNeed(st) {
  const m = surv.market[stationId(st)];
  const base = marketBaseline(st);
  if (!m) return { key: base.key, want: base.want, live: false };
  let best = null;
  for (const key of Object.keys(m.want)) {
    if (key !== m.base && !buysMaterial(st, key)) continue;
    if (!best || m.want[key] > best.want) best = { key, want: m.want[key], live: true };
  }
  return best || { key: base.key, want: 0, live: true };
}

// Convoys the record says were lost near a station, lately.
function lossesNear(st) {
  const L = surv.living;
  if (!L) return 0;
  let n = 0;
  for (const e of L.events) {
    if (e.kind !== "loss" || L.turn - e.turn > 40) continue;
    if (dist2(e.x, e.y, st.x, st.y) < JOB_LOSS_REACH * JOB_LOSS_REACH) n++;
  }
  return n;
}

const jobId = (st, key) => "j:" + Math.round(st.x) + "," + Math.round(st.y) + ":" + key;

/* How many units break it. A sale eases a shortage by 0.04 a unit (sellSome),
   so this is most of the way down — the job is the shortage, not a number
   beside it. */
const jobUnits = (want, key) => {
  /* The dear things come in ones and twos — a reactor core is "rare and
     always salvage", and the first board this drew asked for thirteen of
     them. So the count thins with what the stuff is worth: a job for cores
     eases the shortage rather than ending it, which is the truth about cores. */
  const v = matSpec(key).value;
  const thin = v >= 30 ? 4 : v >= 13 ? 2 : 1;
  return Math.max(2, Math.min(14, Math.ceil(want / 0.04 * 0.7 / thin)));
};

/* What it pays *on top of the sale*. Distance and the cargo's worth, more the
   shorter the station is. Placed against the hull ladder — the first version
   paid 1,200 to 2,500, which is a NEEDLE (2,200) for one trip, and Ric's note
   of 2026-11-12 is that money already arrives too fast. These come out at
   about 150 to 700: a good hold's worth, for going somewhere new. Not
   measured against a clock; nothing in the game records how fast money is
   earned. */
function jobPay(dist, key, n, want) {
  const m = matSpec(key);
  const raw = (dist / 200 + n * (m ? m.value : 1) * 0.5 + 60) * (0.7 + want);
  return Math.max(50, Math.round(raw / 10) * 10);
}

function jobOffer(at, st, here) {
  const need = stationNeed(st);
  if (!need || need.want < JOB_SHORT) return null;
  const id = jobId(st, need.key);
  if (jobBook().taken.some(j => j.id === id)) return null;
  const dist = here ? 0 : Math.hypot(st.x - at.x, st.y - at.y);
  const n = jobUnits(need.want, need.key);
  return { id, kind: "deliver", key: need.key, n, here: !!here,
           x: Math.round(st.x), y: Math.round(st.y),
           name: stationName(st), faction: st.faction || "free",
           dist: Math.round(dist), want: need.want,
           lost: lossesNear(st), live: need.live,
           pay: jobPay(dist, need.key, n, need.want) };
}

/* The board at the station you are docked at: its own need first — the one
   that asks you to come back — then the worst-off of the docks it knows. */
function jobOffers() {
  const at = surv.docked;
  if (!at) return [];
  const out = [];
  if (!sameDock(at, HOME_STATION)) {
    const mine = jobOffer(at, at, true);
    if (mine) out.push(mine);
  }
  const far = [];
  for (const st of stationsAround(at)) {
    const o = jobOffer(at, st, false);
    if (o) far.push(o);
  }
  far.sort((a, b) => b.want - a.want || a.dist - b.dist);
  return out.concat(far).slice(0, JOB_OFFERS);
}

function takeJob(id) {
  const J = jobBook();
  if (!surv.docked) { gameSound("hit"); return false; }
  if (J.taken.length >= JOB_MAX) {
    chatter("Three jobs is what one ship carries.", "#ff8f77");
    gameSound("hit");
    return false;
  }
  const o = jobOffers().find(x => x.id === id);
  if (!o) { gameSound("hit"); return false; }
  J.taken.push({ id: o.id, kind: o.kind, key: o.key, n: o.n, left: o.n,
                 x: o.x, y: o.y, name: o.name, faction: o.faction, pay: o.pay,
                 turn: surv.living ? surv.living.turn : 0,
                 from: stationName(surv.docked) });
  /* The whole point: the dock goes on your chart, by name. */
  const kid = knownId("station", o.x, o.y);
  const known = surv.known.get(kid);
  if (known) { if (!known.name) known.name = o.name; }
  else noteKnown("station", o.x, o.y, o.name);
  gameSound("win");
  chatter(o.name + " is on your chart.", NEBULA);
  saveSurveyBook();
  return true;
}

function closeJob(j, paid, why) {
  const J = jobBook();
  const i = J.taken.indexOf(j);
  if (i >= 0) J.taken.splice(i, 1);
  const carried = j.n - Math.max(0, j.left);
  if (carried > 0) {
    J.done.unshift({ name: j.name, x: j.x, y: j.y, key: j.key, n: carried,
                     faction: j.faction, turn: surv.living ? surv.living.turn : 0 });
    if (J.done.length > JOB_DONE_CAP) J.done.length = JOB_DONE_CAP;
  }
  if (paid > 0) surv.cash += paid;
  chatter(why, paid > 0 ? CASH : "#ff8f77", false);
}

/* A sale, seen by the jobs. Called by the two functions that sell and by
   nothing else: a job is not a second counter. */
function jobSold(st, key, n) {
  if (!surv || !surv.jobs || !st || !(n > 0)) return;
  const j = surv.jobs.taken.find(x => x.key === key && sameDock(x, st));
  if (!j) return;
  j.left -= n;
  if (j.left > 0) return;
  j.left = 0;
  addRep(j.faction, 4);
  transmitMsg(j.name, j.n + " " + matSpec(j.key).name.toLowerCase() + " received \u2014 " +
              money(j.pay) + " sent", CASH, j);
  closeJob(j, j.pay, "JOB DONE — " + j.name + " pays " + money(j.pay) + " on top.");
}

function dropJob(id) {
  const j = jobBook().taken.find(x => x.id === id);
  if (!j) return false;
  closeJob(j, 0, "Job dropped — " + j.name + " will ask somebody else.");
  saveSurveyBook();
  return true;
}

/* Once a living turn. A job goes when the need does — somebody else's convoy
   got there — and you are paid for what you carried; or when it has sat for
   two hours, because a station does not wait for ever. */
function jobsTurn() {
  if (!surv || !surv.jobs) return;
  const turn = surv.living ? surv.living.turn : 0;
  for (const j of surv.jobs.taken.slice()) {
    const m = surv.market[stationId({ x: j.x, y: j.y })];
    const eased = m && (m.want[j.key] || 0) < 0.08;
    const stale = turn - j.turn > JOB_TURNS;
    if (!eased && !stale) continue;
    const part = Math.round(j.pay * (j.n - j.left) / j.n / 10) * 10;
    transmitMsg(j.name, (eased ? "supplied by somebody else" : "no longer waiting on you") +
                (part ? " \u2014 " + money(part) + " sent for what you carried" : ""),
                eased ? NEBULA : "#ff8f77", j);
    closeJob(j, part,
      (eased ? j.name + " got its " + (matSpec(j.key) || { name: j.key }).name.toLowerCase() +
               " elsewhere"
             : j.name + " stopped waiting") +
      (part ? " — " + money(part) + " for what you carried." : "."));
  }
}

// The job the arrow points at: the oldest one you took.
const jobTracked = () => (surv && surv.jobs && surv.jobs.taken[0]) || null;

/* What the pages are handed. Offers are worked out only while the board is
   open — `surveyState` is built every frame the HUD draws. */
function jobsState(withOffers) {
  const J = jobBook();
  const me = ships[0];
  const at = surv.docked;
  const far = j => me ? Math.round(Math.hypot(j.x - me.x, j.y - me.y)) : 0;
  const bearing = j => me ? bearingTo(me, j) : 0;
  const dress = j => {
    const m = matSpec(j.key);
    return Object.assign({}, j, {
      mat: m ? m.name : j.key, colour: m ? m.colour : "#fff",
      flag: factionOf(j.faction).short, flagColour: factionOf(j.faction).colour,
      dist: j.here ? 0 : far(j), bearing: bearing(j),
      aboard: surv.hold[j.key] || 0,
      known: surv.known.has(knownId("station", j.x, j.y))
    });
  };
  const L = surv.living;
  return {
    max: JOB_MAX,
    taken: J.taken.map(dress),
    offers: withOffers && at ? jobOffers().map(dress) : [],
    here: at ? { name: stationName(at),
                 done: J.done.filter(d => sameDock(d, at)).length,
                 units: J.done.filter(d => sameDock(d, at))
                              .reduce((s, d) => s + d.n, 0) } : null,
    wanted: at && L && L.bounties
      ? L.bounties.filter(b => b.by === at.faction)
                  .map(b => ({ name: b.name, amount: b.amount }))
      : [],
    done: J.done.length
  };
}

/* ── the book ─────────────────────────────────────────────────────────────
   Everything is checked on the way in: a hand-edited book can put a number
   out of range, and it cannot put a job for a material that does not exist. */
function jobsToBook() {
  const J = jobBook();
  return { taken: J.taken.map(j => Object.assign({}, j)),
           done: J.done.map(d => Object.assign({}, d)) };
}
function jobsFromBook(saved) {
  const out = freshJobs();
  if (!saved || typeof saved !== "object") return out;
  const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
  const str = (v, n) => String(v || "").slice(0, n);
  const flag = k => (k === "free" || FACTIONS.some(f => f.key === k)) ? k : "free";
  for (const j of Array.isArray(saved.taken) ? saved.taken.slice(0, JOB_MAX) : []) {
    if (!j || !MATERIALS.some(m => m.key === j.key)) continue;
    const n = num(j.n, 1, 99);
    const x = num(j.x, -1e9, 1e9), y = num(j.y, -1e9, 1e9);
    out.taken.push({ id: jobId({ x, y }, j.key), kind: "deliver", key: j.key,
                     n, left: num(j.left, 0, n), x, y,
                     name: str(j.name, 24), faction: flag(j.faction),
                     pay: num(j.pay, 0, 1e6), turn: num(j.turn, 0, 1e9),
                     from: str(j.from, 24) });
  }
  for (const d of Array.isArray(saved.done) ? saved.done.slice(0, JOB_DONE_CAP) : []) {
    if (!d || !MATERIALS.some(m => m.key === d.key)) continue;
    out.done.push({ name: str(d.name, 24), x: num(d.x, -1e9, 1e9), y: num(d.y, -1e9, 1e9),
                    key: d.key, n: num(d.n, 1, 99), faction: flag(d.faction),
                    turn: num(d.turn, 0, 1e9) });
  }
  return out;
}
