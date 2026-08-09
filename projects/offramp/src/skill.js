/* ══════════════════════════════════════════════════════════════════════
   SKILL.

   A hidden number between 0 and 1 for how well this driver actually
   drives, and a deliberately small amount of leverage over the dice.

   ── it is composed of rates, never totals ───────────────────────────
   A total only ever rises, so a long bad run would outrank a short
   brilliant one and the score would end up measuring patience. Every
   component here is a ratio:

     C  clean distance ÷ total distance, weighted by how fast that
        clean distance was covered
     X  clean exits ÷ exits attempted
     V  saves made ÷ savable incidents

     E = 0.40·C + 0.25·X + 0.35·V

   ── the window is distance, not runs ────────────────────────────────
   Five runs could be two hundred kilometres or five instant deaths, so
   the window is a hundred kilometres of driving and the record of a run
   falls out the back when it is full. Note that a rolling window IS the
   decay mechanism — evidence leaves rather than bleeding away — so
   there is no separate decay term here and none is wanted.

   ── it starts in the middle ─────────────────────────────────────────
   With no evidence E is 0.5, blended toward the real figure as the
   window fills. The game must not be hardest the first time it is
   played.

   ── and its influence FADES as the crash gets worse ─────────────────
   This is the important property and it is the counter-intuitive one.
   Skill has far less purchase on a high-speed excursion than instinct
   says — it is precisely why experienced and professional drivers die
   in run-off-road crashes. Once soft ground has the car, the ground
   decides. So the modifier is at most ±35% of a probability, and that
   35% shrinks to nothing as the severity rises:

     lateral   base    best driver   worst driver
      20 km/h   2.2%      1.5%          2.9%
      29       29.9%     22.5%         37.2%
      40+      85.0%     72.0%         95.0%

   About 1.3× at the dangerous end and much more at the safe end. That
   is unsatisfying and it is correct, and it guarantees the skill score
   can never trivialise a serious crash — so it cannot quietly become
   what the game is about.

   ── watch the feedback loop ─────────────────────────────────────────
   Clean distance raises E, E improves survival, survival extends
   distance. That compounds. The rates and the 0.95 clamp contain it,
   but if mean run length ever grows without bound across a session the
   ceiling is too high.
   ══════════════════════════════════════════════════════════════════════ */

const Skill = (() => {
  "use strict";

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const KEY = "offramp.skill.v1";
  const SKILL_WINDOW_KM = 100;
  const SKILL_MAX = 0.35;                 // the most it is ever allowed to matter
  const SAVE_WINDOW = 3;                  // s to get back on pavement and count it
  /* Above this much lateral velocity off the pavement, or in contact
     with the barrier, you were in something that could have ended the
     run. Impact.V_CRIT is the same energy balance the rollover uses. */
  const V_CRIT = typeof Impact !== "undefined" ? Impact.V_CRIT : 16.62;

  let runs = [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(raw)) runs = raw.filter((r) => r && typeof r.km === "number");
  } catch (e) { runs = []; }

  /* The run in progress. Not written to the window until it ends, so a
     run cannot raise its own difficulty while it is being driven. */
  let cur = blank();

  function blank() {
    return {
      km: 0, cleanKm: 0, speedKm: 0,
      exits: 0, cleanExits: 0, incidents: 0, saves: 0,
      inAux: false, auxClean: true, inc: null,
    };
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(runs)); } catch (e) { /* private mode */ }
  }

  /* ── the score ──────────────────────────────────────────────────────
     Recomputed from the window rather than accumulated, so there is
     exactly one place the arithmetic lives and no drift. */
  function evaluate() {
    let km = 0, cleanKm = 0, speedKm = 0;
    let exits = 0, cleanExits = 0, incidents = 0, saves = 0;
    for (const r of runs) {
      km += r.km; cleanKm += r.cleanKm; speedKm += r.speedKm;
      exits += r.exits; cleanExits += r.cleanExits;
      incidents += r.incidents; saves += r.saves;
    }
    if (km <= 0) return 0.5;
    const meanClean = cleanKm > 0 ? speedKm / cleanKm : 0;    // km/h
    const speedWeight = clamp(meanClean / 200, 0, 1);
    const C = (cleanKm / km) * speedWeight;
    /* No exits attempted and no incidents survived is not evidence of
       incompetence, it is an absence of evidence, so both default to
       the neutral half rather than to zero. */
    const X = exits > 0 ? cleanExits / exits : 0.5;
    const V = incidents > 0 ? saves / incidents : 0.5;
    const raw = 0.40 * C + 0.25 * X + 0.35 * V;
    const fill = clamp(km / SKILL_WINDOW_KM, 0, 1);
    return 0.5 * (1 - fill) + raw * fill;
  }

  let E = evaluate();

  /* ── the modifier ───────────────────────────────────────────────────
     `sevNorm` is 0 where the outcome first becomes possible at all and
     1 where physics has taken over. Clamp AFTER the modifier, never
     before — clamping first flattens the spread at the top and produces
     the nonsense of a worse outcome at 40 km/h than at 50.

     The 0.95 ceiling is on what the MODIFIER may produce, not on the
     probability itself, and the difference is not academic: clamping
     the value outright caps every impact in the game at 95%, so one
     collision in twenty at any delta-v whatsoever came out as
     "carry on with a dented wing". A 190 km/h frontal read as
     survivable five percent of the time. So the ceiling is the base
     probability or 0.95, whichever is higher — a bad driver can never
     be pushed past 95%, and physics is never pulled back TO it. */
  function adjust(p, sevNorm) {
    if (!(p > 0)) return p;
    const shift = (E - 0.5) * 2;                      // −1 .. +1
    const w = SKILL_MAX * (1 - clamp(sevNorm, 0, 1));
    return clamp(p * (1 - shift * w), 0, Math.max(p, 0.95));
  }

  /* ══════════════════════════════════════════════════════════════════
     what the game tells it
     ══════════════════════════════════════════════════════════════════ */

  function beginRun() { cur = blank(); }

  /* Something was touched, so nothing from here to the end of this exit
     counts as a clean one. */
  function dirty() { cur.auxClean = false; }

  /* A frame that could have ended the run and did not. Counted once per
     episode; a save is getting back on pavement, in control, inside
     three seconds. */
  function incident() {
    if (cur.inc) return;
    cur.inc = { t: 0, done: false };
    cur.incidents++;
    cur.auxClean = false;
  }

  /* An incident that ended well, for the things that resolve by
     themselves rather than by driving out of it — catching a blowout,
     mainly. */
  function saved() {
    if (cur.inc && !cur.inc.done) { cur.inc.done = true; cur.saves++; }
    cur.inc = null;
  }

  /* Once a frame while driving. `dKm` is the distance covered, `clean`
     is whether that distance was covered touching nothing with every
     wheel on pavement, and the last three are what the exit and
     incident book-keeping needs. */
  function frame(dt, dKm, speed, clean, inAux, onRamp, paved, vLat) {
    cur.km += dKm;
    if (clean) { cur.cleanKm += dKm; cur.speedKm += speed * dKm; }

    // an exit is attempted the moment you commit to the decel lane
    if (inAux && !cur.inAux) { cur.inAux = true; cur.auxClean = true; cur.exits++; }
    if (!clean && cur.inAux) cur.auxClean = false;
    if (cur.inAux && !inAux) {
      // it closed. Reaching the ramp is what makes it a clean one.
      if (onRamp && cur.auxClean) cur.cleanExits++;
      cur.inAux = false;
    }

    // and an incident is over when the car is back on tarmac, straight
    if (cur.inc) {
      cur.inc.t += dt;
      const settled = paved && vLat < V_CRIT * 0.5;
      if (settled) {
        if (cur.inc.t <= SAVE_WINDOW && !cur.inc.done) cur.saves++;
        cur.inc = null;
      } else if (cur.inc.t > SAVE_WINDOW) {
        cur.inc = null;                   // too slow. It happened, and it was not a save.
      }
    }
  }

  /* The run is over — including a run that ended well, though none of
     them do yet. Its record joins the window and the oldest fall out. */
  function endRun() {
    if (cur.km <= 0.001) { cur = blank(); return; }
    runs.push({
      km: cur.km, cleanKm: cur.cleanKm, speedKm: cur.speedKm,
      exits: cur.exits, cleanExits: cur.cleanExits,
      incidents: cur.incidents, saves: cur.saves,
    });
    let total = runs.reduce((a, r) => a + r.km, 0);
    while (runs.length > 1 && total > SKILL_WINDOW_KM) total -= runs.shift().km;
    save();
    E = evaluate();
    cur = blank();
  }

  function forget() { runs = []; save(); E = evaluate(); }

  return {
    beginRun, endRun, frame, incident, saved, dirty, adjust, forget,
    get E() { return E; },
    get window() { return runs.slice(); },
    SKILL_WINDOW_KM, SKILL_MAX,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Skill;
