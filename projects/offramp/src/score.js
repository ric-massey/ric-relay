/* ══════════════════════════════════════════════════════════════════════
   THE SCORE — high risk, high reward, and the exits are the bank.

   *(Ric, 2026-08-12: "essentially the more difficult and dangerous you
   make it the more points you get. high risk high reward low risk low
   reward." And on banking: "maybe its like every 10 exits are a
   checkpoint ... if you wreck before the 40th exit you get the rewards
   for the first 30.")*

   This replaces the placeholder that offramp.js has carried since the
   rebuild — a flat rate on distance plus `900 + 260·exits` on each exit,
   with a four-second combo timer. That scheme's own comment said what it
   was: "score currently comes from distance and from taking exits — see
   PLAN.md §2 for where it should come from once there is a corridor to
   score." There is a corridor now.

   ── the shape ────────────────────────────────────────────────────────
   ONE pot, earned continuously, multiplied by how dangerous the driving
   is, and banked only at a checkpoint.

       earn rate  =  (distance + exits) · traffic · night · pace

   Nothing here is a bonus you collect. Every term is a multiplier on
   everything else, which is what makes the top of the range worth
   chasing: a wet Friday at five, at speed, in the middle of it, peaks
   at about ×15 against a Sunday-morning cruise's ×1.

   ×15 is the top of the needle and not the average of it. `pace` spends
   its first ninety seconds climbing, so what a dangerous run REALISES
   over its length is nearer ten — measured, and asserted separately in
   test/score.test.js §2 so that nobody later closes the gap between the
   two figures thinking it is a bug.

   ── why the terms fight each other, which is the good part ───────────
   `traffic` rises with the density around you and `pace` rises with the
   speed you can hold. Those are not independent — heavy traffic is
   exactly where you CANNOT hold speed. So the maximum is not "find the
   busiest hour" or "go fast on an empty road", it is thread fast traffic
   at speed, which is the most dangerous thing a person can do on a
   freeway and is precisely what the game should be paying for.

   Nobody designed that interaction; it falls out of multiplying. It is
   the reason the multipliers multiply rather than adding.

   ── the pace threshold is a FRACTION of your car's top speed ─────────
   This is the one decision here that is not obvious and it matters more
   than any constant. An absolute threshold — "above 130 mph" — would
   mean the Jetta, which tops out at 120, could never earn the speed
   multiplier at all, while the built 911 collects it at a canter. The
   whole garage below the Corvette would be a strictly worse choice and
   the ladder would collapse into "drive the fastest thing you own."

   As a fraction, holding 100 mph in the Jetta pays what 165 pays in the
   Porsche — and it is genuinely more frightening, because the Jetta is
   at 83% of everything it has while the Porsche is loafing. The slow
   car stays a legitimate high-skill choice instead of something you
   leave behind, and the bike — 188 mph and 197 kg — is terrifying at a
   fraction nothing else finds difficult.

   ── what a wreck costs ───────────────────────────────────────────────
   Banked points are yours forever. The CARRIED pot is not, and a wreck
   takes all of it. Checkpoints are every tenth exit, so wrecking on the
   thirty-ninth pays for thirty and nothing else — you were nine exits
   into a stretch you never finished.

   Quitting to the menu mid-run costs the pot too, and that is
   deliberate rather than harsh: if quitting banked it, the optimal play
   would be to build a ×15 and immediately quit, and every interesting
   decision in the game would be replaced by that one.

   ── this file is pure ────────────────────────────────────────────────
   No DOM, no localStorage, no clock of its own. It is told the time, the
   density and the speed; it never looks them up. `src/progress.js` owns
   what persists and `test/score.test.js` drives this headless.
   ══════════════════════════════════════════════════════════════════════ */

const Score = (() => {
  "use strict";

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ── base earning ──────────────────────────────────────────────────
     Points per kilometre at ×1, and the lump an exit pays before its
     structure weight. Deliberately round numbers: they set the scale of
     the whole economy and the unlock costs in data/garage.js are quoted
     against them, so if these move, those move. */
  const PER_KM = 100;
  const EXIT_BASE = 400;

  /* What an exit is worth, by what you had to do to get off and back on.
     PLAN.md §2's table, keyed on the `routeType` the corridor actually
     produces. Anything unrecognised is an ordinary interchange, so a new
     kind of junction appearing in the world data scores sensibly on the
     day it appears rather than scoring zero. */
  const WEIGHT = {
    rest:         0.5,      // pull-off, a bench and a map
    truckstop:    0.8,      // fuel, and a lorry reversing across you
    exit:         1.5,      // the ordinary diamond
    signal:       2.0,      // §7b's signalised cross road, with a queue
    loop:         2.5,      // cloverleaf — tight radius, taken at speed
    beltway:      3.0,
    radial:       3.0,
    "cross-street": 1.0,
  };
  const DEFAULT_WEIGHT = 1.5;

  /* ── traffic ───────────────────────────────────────────────────────
     Local density in vehicles per km per lane, which is what `sim.js`
     measures and what is actually around you — not the hour's demand,
     because demand is a property of the day and density is a property
     of where you are in it.

     40 veh/km/lane is the top of the range: past that the road is
     stop-start and you cannot earn the pace term anyway. The standing
     harness carries 17.6, so an ordinary free-flowing road sits near
     ×1.9 and the ceiling is genuinely heavy traffic. */
  const K_FULL = 40, TRAFFIC_MAX = 3.0;
  const trafficMult = (k) =>
    clamp(1 + (TRAFFIC_MAX - 1) * ((k || 0) / K_FULL), 1, TRAFFIC_MAX);

  /* ── night ─────────────────────────────────────────────────────────
     "also night gives a bit extra points" — a bit, so it is the
     smallest term here and it is a step rather than a curve. The
     shoulders are half, because dusk is not midnight. */
  const NIGHT_MAX = 1.25;
  function nightMult(hour) {
    const h = ((hour | 0) % 24 + 24) % 24;
    if (h >= 22 || h <= 4) return NIGHT_MAX;
    if (h === 20 || h === 21 || h === 5) return 1 + (NIGHT_MAX - 1) / 2;
    return 1;
  }

  /* ── pace ──────────────────────────────────────────────────────────
     "also speed for extreeme durations should give you points" — so it
     is TIME HELD and not speed itself. Sitting at 0.9 of your top speed
     for a second and a half is worth nothing; holding it for a minute
     and a half is worth four times everything else you are earning.

     It decays about eleven times faster than it builds. Lifting off for
     a corner or a queue costs you some of it and not all of it; coming
     off the boil properly costs the lot. */
  const HOT_FRAC = 0.80;         // of the CAR's top speed — see the header
  const PACE_MAX = 4.0;
  const PACE_UP = 90;            // s of holding it to reach the ceiling
  const PACE_DOWN = 8;           // s off the boil to lose it all

  /* ── checkpoints ───────────────────────────────────────────────────
     Every tenth exit banks everything carried. Ric's number, and it is
     a better one than every exit: this corridor has an interchange
     every 1,420 m, so ten of them is about nine miles of committed
     driving rather than a chance to lose your nerve at each ramp. */
  const CHECKPOINT_EVERY = 10;

  /* ══════════════════════════════════════════════════════════════════
     state
     ══════════════════════════════════════════════════════════════════ */
  let S = fresh();

  function fresh() {
    return {
      banked: 0,          // survives a wreck
      carried: 0,         // does not
      exits: 0,           // cleanly taken, this run
      hot: 0,             // seconds of pace credit, 0..PACE_UP
      hour: 12,
      vTop: 220 * 1.609344,
      km: 0,
      lastMult: 1,
      parts: { traffic: 1, night: 1, pace: 1 },
      history: [],        // {atExit, amount} — what each checkpoint paid
    };
  }

  /* `car` is a row out of data/garage.js; only its top speed is read,
     and only to set the pace threshold. */
  function begin(opts) {
    const o = opts || {};
    S = fresh();
    S.hour = o.hour == null ? 12 : o.hour;
    S.vTop = (o.car && o.car.vTop) || S.vTop;
    S.parts.night = nightMult(S.hour);
    return S;
  }

  /* Once a frame while driving.
       dt       seconds
       speed    km/h, the player's
       density  veh/km/lane around the player, or 0 if unknown
     Returns the points added, which is only ever useful to a test. */
  function frame(dt, speed, density) {
    if (!(dt > 0)) return 0;

    /* pace, before it is used, so a frame at speed counts on the frame
       it happens rather than the one after. */
    const hotAt = HOT_FRAC * S.vTop;
    if (Math.abs(speed) >= hotAt) S.hot = Math.min(PACE_UP, S.hot + dt);
    else S.hot = Math.max(0, S.hot - dt * (PACE_UP / PACE_DOWN));

    S.parts.pace = 1 + (PACE_MAX - 1) * (S.hot / PACE_UP);
    S.parts.traffic = trafficMult(density);
    S.parts.night = nightMult(S.hour);
    const mult = S.parts.traffic * S.parts.night * S.parts.pace;
    S.lastMult = mult;

    const km = Math.abs(speed) * dt / 3600;
    S.km += km;
    const gained = km * PER_KM * mult;
    S.carried += gained;
    return gained;
  }

  /* An exit taken and returned from. Pays its lump, and every tenth one
     banks the pot. Returns what happened so the HUD can say so. */
  function exit(routeType) {
    S.exits++;
    const w = WEIGHT[routeType] === undefined ? DEFAULT_WEIGHT : WEIGHT[routeType];
    S.carried += EXIT_BASE * w * S.lastMult;

    if (S.exits % CHECKPOINT_EVERY !== 0)
      return { checkpoint: false, exits: S.exits, carried: S.carried,
               toCheckpoint: CHECKPOINT_EVERY - (S.exits % CHECKPOINT_EVERY) };

    const paid = S.carried;
    S.banked += paid;
    S.carried = 0;
    S.history.push({ atExit: S.exits, amount: paid });
    return { checkpoint: true, exits: S.exits, paid, banked: S.banked,
             toCheckpoint: CHECKPOINT_EVERY };
  }

  /* The run is over. `reason` is recorded but changes nothing — a wreck
     and a walk-away cost the same pot, for the reason in the header. */
  function end(reason) {
    const lost = S.carried;
    S.carried = 0;
    return { banked: S.banked, lost, exits: S.exits, km: S.km, reason: reason || "wreck" };
  }

  const read = () => ({
    banked: S.banked, carried: S.carried, exits: S.exits,
    mult: S.lastMult, parts: { ...S.parts }, km: S.km,
    hot: S.hot,
    toCheckpoint: CHECKPOINT_EVERY - (S.exits % CHECKPOINT_EVERY),
    history: S.history.slice(),
  });

  return {
    begin, frame, exit, end, read,
    trafficMult, nightMult,
    PER_KM, EXIT_BASE, WEIGHT, DEFAULT_WEIGHT,
    HOT_FRAC, PACE_MAX, PACE_UP, PACE_DOWN,
    TRAFFIC_MAX, NIGHT_MAX, K_FULL, CHECKPOINT_EVERY,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Score;
