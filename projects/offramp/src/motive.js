/* Why anybody changes lane.

   `node test/motive.test.js` from projects/offramp, and then
   `node test/sim.test.js` for the scoreboard, which is the real answer.

   ══════════════════════════════════════════════════════════════════════
   PLAN.md §5c, and its one architectural rule: **nobody does anything
   for no reason.** Every vehicle, every tick, scores a small fixed set
   of motives. Each returns a lane it wants to be in and how badly, on
   one scale. Highest urgency wins; below a floor, nobody moves.

   A lane change is never sampled. It is always something's answer.

   That is not a stylistic preference, it is the whole argument of §5c,
   and `sim.js` ships a decider that exists purely to prove it: a Poisson
   process aimed straight at the measured 0.37 lane changes per
   vehicle-km reproduces the rate and misses every other number, because

     "a model that changes lane at 0.37 per vehicle-km at random
      reproduces every number in §2 and still looks wrong."

   The eye reads intent, and randomness has none.

   ── what this file may look at ────────────────────────────────────────
   `decide(veh, view, ctx)`, and `view` is the enforcement point for §5c's
   *no perfect information*: its own leader, the two lanes beside it, and
   the corridor under it. Never the simulation's state, never `live`, and
   nothing about the player — §5c settled that too. **The player is not
   special; the driver is.** `yield` sees a vehicle closing at a speed
   difference and that is all it sees. The reason one car waves you
   through and the next never will is `polite`, drawn per vehicle and
   kept for its life, so the same car behaves the same way twice and you
   can learn to read it.

   ── four of seven, and why those four ─────────────────────────────────
   §5c lists seven motives. Three of them — `exit`, `merge`, `lane drop`
   — are about junctions, and the harness that judges this file is six
   kilometres of straight mainline with no ramps on it. That is not an
   oversight in the harness, it is deliberate: every number in
   BEHAVIOUR.md §2 was measured on mainline, so mainline is what has to
   reproduce them, and adding geometry before the mainline is right would
   only hide which of the two was wrong.

   So a junction motive built now could not be checked against anything,
   and a motive nobody can check is a guess with a docstring. The four
   here are exactly the four the mainline scoreboard measures:

     blocked      overtaking, the elephant race, weaving
     keep right   the 15 mph gradient; lorries out of lane 1
     yield        somebody sees you and moves over
     avoid        wrecks making traffic, which is the game

   `exit`, `merge` and `lane drop` are stubbed at the bottom with the
   signature they will have, and they are the second run of the harness.

   ── the traits are already drawn ─────────────────────────────────────
   Nothing here rolls a die about personality. `traffic.js` draws the
   whole temperament when the vehicle spawns and it is kept for life:
   `push` (0 patient to 1 aggressive, derived from the headway draw
   rather than rolled again, because the driver who tailgates is the same
   one who takes a tight gap), `discipline`, `polite`, `gap`, `signal`,
   `want`. This file reads them and never re-rolls them. If a motive
   wants a new knob, the knob belongs in the temperament.
   ══════════════════════════════════════════════════════════════════════ */
const Motive = (() => {
  "use strict";

  /* ══ the scale ══════════════════════════════════════════════════════
     One number, compared across motives, and the units are "how much
     this driver wants it" rather than anything physical. That is the
     price of letting seven unrelated reasons argue with each other, and
     it is worth paying: the alternative is a priority list, and a
     priority list cannot express "normally I would keep right, but not
     while I am overtaking this lorry".

     FLOOR is what a motive has to beat to move anybody at all. It is
     DECIDED, and it is the single most load-bearing number in the file —
     it sets the lane-change rate, which is one of the four things the
     scoreboard measures and which must therefore NOT be aimed at
     directly. It is set by asking what fraction of a driver's patience
     has to run out before they act, not by turning it until 0.37 comes
     out. The rate is the check, and a check you tuned against is not a
     check. */
  const FLOOR = 0.42;

  /* Urgency saturates. Nothing here returns more than 1 except `avoid`,
     which is allowed to, because a wreck across your lane outranks every
     opinion anybody has about lane discipline. */
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  /* ══ per-vehicle memory ═════════════════════════════════════════════
     Two motives integrate time — §5c says so in the table: `blocked`
     rises with "time spent below desired speed" and `keep right` with
     "time spent in a lane it does not need". That memory has to live
     somewhere, and it lives on the vehicle under one namespaced field so
     that `sim.js` stays completely ignorant of the motive layer. The
     harness must not know what a motive is; that is the whole reason it
     was built first.

     It is lazily created rather than added to `born()` for the same
     reason. Swapping this file out for another decider leaves no trace. */
  function mind(veh) {
    let m = veh.mot;
    if (!m) m = veh.mot = { held: 0, idle: 0, since: 0 };
    return m;
  }

  /* ══ can I hold my speed in that lane? ══════════════════════════════
     The question underneath three of the four motives, and it is not
     "is the lane empty". A lane with a vehicle 300 m up doing 70 is
     free; the same lane with a lorry 80 m up doing 52 is not, and the
     difference is what makes a motorway sort itself by speed rather than
     by density.

     So: I am free in a lane if there is nobody in front, or the vehicle
     in front is going at least as fast as I want, or it is far enough
     away that it will not matter for a while. `REACH` is that "for a
     while" — the distance at which a slower vehicle stops being my
     problem — and it scales with the speed difference, because closing
     on somebody 2 mph slower from 200 m back is not a constraint and
     closing on somebody 20 mph slower from 200 m back very much is.

     DECIDED, but the shape is forced: it has to be a TIME to contact
     rather than a distance, or every motive in the file behaves
     differently at 30 mph and 70.

     ── and it needs BOTH halves, which cost a carriageway to learn ────
     The first version asked only the closing question: am I catching
     something slower, and how long until I reach it. That is right for
     open road and catastrophically wrong in a queue, because in a queue
     you are not closing on the vehicle in front — you are both doing
     14 mph — so `closing <= 0.1` returned "not catching them" and
     therefore "free". Every driver in a jam believed they were
     unobstructed. `blocked` fired 82 times in a run against `keep
     right`'s 1,783, so the entire carriageway migrated right and nothing
     ever came back: 3% of cars in lane 1 against a measured 32%, lane 3
     stationary, and the flow down from 1,585 to 647.

     Being stuck behind somebody slower is not a closing rate, it is a
     DISTANCE — if you are sitting inside a few multiples of your own
     equilibrium spacing behind a vehicle slower than you want, their
     speed is your speed and you are blocked, whatever the relative
     velocity happens to be this instant. So there are two tests and
     either one constrains you: I am nearly on them, or I soon will be. */
  const REACH = 12;                  // seconds of closing before it matters
  const HOLD = 3.0;                  // multiples of equilibrium spacing
  const SLACK = 0.98;                // a lead this close to my speed is not slow

  function free(side, want, veh) {
    if (!side || !side.lead) return true;
    const lead = side.lead;
    if (lead.v >= want * SLACK) return true;         // not actually slower
    /* Sat behind them: their speed is mine, however slowly I am gaining. */
    const equilibrium = veh.s0 + want * veh.par.T;
    if (side.leadGap < HOLD * equilibrium) return false;
    const closing = veh.v - lead.v;
    if (closing <= 0.1) return true;                 // miles back, not gaining
    return side.leadGap / closing > REACH;
  }

  /* How fast I could actually go in that lane.

     It has to answer with the same picture of the world `free` has, and
     the first version did not — it read the lead's speed and ignored how
     far away it was, so a lane whose only vehicle was 300 m up doing
     54 mph was reported as offering 54 while `free` called the same lane
     clear. Every motive that compares lanes then saw gains of nearly
     nothing and stopped proposing: the lane-change rate fell to 0.216
     per vehicle-km against a measured 0.37, and cars that wanted a
     median of 73 mph sat at 56 on a road with the room to give it to
     them. Two symptoms, one cause, and the cause was two functions
     disagreeing about what "in front of me" means. */
  function prospect(side, want, veh) {
    if (!side) return -Infinity;
    if (!side.lead) return want;
    if (free(side, want, veh)) return want;
    return Math.min(want, Math.max(side.lead.v, 0));
  }

  /* Is there physically anywhere to go? `room()` in sim.js has the final
     say and applies the driver's own nerve to it; this is only so that a
     motive does not spend its urgency wanting something impossible. */
  function plausible(side, veh) {
    if (!side) return false;
    if (side.leadGap < veh.s0) return false;
    if (side.lag && side.lagGap < side.lag.s0) return false;
    return true;
  }

  /* ══ 1. BLOCKED ═════════════════════════════════════════════════════
     Wants: any lane where it can hold its speed.
     Rises with: time spent below desired speed.
     Produces: overtaking, the elephant race, weaving.

     The elephant race is the one to watch, because §5c stakes the
     architecture on it: *"If this does not emerge, the model is wrong
     somewhere."* Nothing here mentions lorries. Lorry desired speeds
     have a real measured spread — p15 to p85 is 49 to 63 mph — so sooner
     or later one lorry is 1 mph faster than the one in front. `blocked`
     puts it out to pass; 1 mph across two 20 m vehicles takes the better
     part of a minute; `keep right` stays quiet while it is still
     gaining. The dam assembles itself and then dissolves itself, and no
     line of code knows it happened.

     ── indifferent to side, on purpose ────────────────────────────────
     §5c is explicit that `blocked` must not prefer the left, because
     that is what lets somebody undertake. If this motive preferred left
     it would be impossible to pass on the right and the right-hand lanes
     would empty of quick traffic — and measured, lane 4 of I-294 still
     runs 58 mph against lane 2's 69, so they do not. What makes the left
     lane the fast one is `keep right` being asymmetric, not this.

     The tie-break when both sides are equally free goes left, which is
     not a preference so much as the fact that a driver who is being held
     up looks left first. Undertaking then happens exactly when the left
     is blocked and the right is clear, which is when real people do it.

     ── patience ───────────────────────────────────────────────────────
     TAU is how long a driver tolerates being held up before this motive
     beats the floor, scaled by `push`. At push 0 (the most patient
     quarter of the population, drawn straight off the measured headway
     distribution) it is a long time; at push 1 it is a few seconds. One
     trait, two very different drivers, no second die. */
  const BLOCK_TAU = 26;              // seconds at push 0
  const BLOCK_MIN = 3.0;             // ...and at push 1
  const BLOCK_MARGIN = 0.94;         // below this fraction of `want`, held up

  function blocked(veh, view, L, R) {
    const m = mind(veh), drv = veh.drv, want = drv.want;

    /* Held up means constrained BY SOMEBODY, not merely slow. A lorry
       governed to 62 on a posted 70 is not blocked, it is a lorry, and a
       motive that cannot tell those apart puts every heavy vehicle on
       the road into the outside lane. */
    const mine = { lead: view.lead, leadGap: view.gap, lag: null, lagGap: Infinity };
    const held = veh.v < want * BLOCK_MARGIN && !free(mine, want, veh);

    const tau = BLOCK_MIN + (BLOCK_TAU - BLOCK_MIN) * (1 - drv.push);
    if (held) m.held += view.dt;
    else m.held = Math.max(0, m.held - view.dt * 2);   // forgiven twice as fast
    if (!held || m.held <= 0) return null;

    const ln = Math.round(view.lane);
    /* ── how far left is a driver willing to go to get past? ──────────
       `blocked` is indifferent to SIDE, which §5c requires and which is
       what lets somebody undertake. It is not indifferent to DEPTH, and
       conflating those two is what put 5.6% of lorry-seconds in lane 1
       against a measured 1.2%: a lorry held up in lane 2 moved into lane
       1 to pass, because nothing anywhere said it should not, and 193
       lorry overtakes a road-hour were happening in the outside lane.

       The governing idea is the same one `keep right` uses and it is
       used with the same constant, because it is one idea and not two:
       **the further left a lane is, the better your reason has to be for
       being in it.** `keep right` reads that as how eagerly you come
       back; this reads it as how far out you are prepared to go in the
       first place. A disciplined driver needs a big gain to justify lane
       1 and almost none to justify moving one lane over at the right of
       the road — which is exactly where the elephant race happens, and
       it survives untouched. */
    const need = (target) => {
      const d = (view.lanes - target) / Math.max(1, view.lanes - 1);
      return KR_GIVE * habit(drv.discipline) * d * d * d * want;
    };
    const here = prospect({ lead: view.lead, leadGap: view.gap }, want, veh);
    const canL = ln > 1 && free(L, want, veh) && plausible(L, veh)
              && prospect(L, want, veh) >= here + need(ln - 1);
    const canR = ln < view.lanes && free(R, want, veh) && plausible(R, veh);
    if (!canL && !canR) return null;

    let lane, why;
    if (canL && canR) {
      /* Both free: take the one that is actually better, and look left
         when they are the same. */
      lane = prospect(L, want, veh) >= prospect(R, want, veh) ? ln - 1 : ln + 1;
      why = lane < ln ? "blocked-left" : "blocked-right";
    } else if (canL) { lane = ln - 1; why = "blocked-left"; }
    else { lane = ln + 1; why = "blocked-right"; }

    return { lane, urgency: clamp01(m.held / tau), why };
  }

  /* ══ 2. KEEP RIGHT ══════════════════════════════════════════════════
     Wants: one lane right.
     Rises with: time spent in a lane it does not need.
     Produces: the 15 mph gradient; lorries out of lane 1.

     These are the two numbers the standard model of the literature
     cannot reach — MOBIL gets a third of the gradient and five times too
     many lorries in the left lane — so this motive is the one carrying
     the argument, and it is worth being clear about why it can do what
     an acceleration-gain rule cannot.

     MOBIL's keep-right term is a constant bias added to an acceleration
     comparison this instant. It therefore competes with the traffic:
     when the right lane is slightly slower, staying put wins, every
     tick, forever. Nobody in MOBIL ever thinks *I have been sat in lane
     one for a mile and a half and I do not need to be here*. This does,
     because it integrates, and that is the whole difference. Time in a
     lane you do not need is a debt, it accumulates, and eventually it
     outranks a small speed advantage — which is exactly what lane
     discipline IS.

     ── and it is not symmetric, and that is where the gradient is ─────
     Nothing pulls anybody left. `blocked` moves you left when you are
     held up and stops the moment you are not, and then this quietly
     charges you for staying. So a fast driver oscillates outward and
     back, and a slow driver settles right and never has a reason to
     leave. Sort a population by desired speed with those two rules and
     the lanes come out graded, without anything anywhere being told what
     speed a lane should run at.

     ── the lorries ────────────────────────────────────────────────────
     1.2% of lorry-seconds in the left lane is MEASURED, on a four-lane
     motorway with no restriction requiring it. Nothing here mentions
     lorries either: `discipline` is drawn high and tight for heavy
     vehicles in `traffic.js` and low and wide for cars, so TAU is short
     for a lorry and long for a car, and the share falls out of the
     temperament.

     ── it asks a different question from `blocked`, and must ──────────
     `blocked` asks *can I hold the speed I want*, and `free` answers it
     against `want`. Asking that here as well — which is what the first
     version did — makes lane discipline conditional on losing nothing,
     and lane discipline is precisely the willingness to LOSE something.
     A lorry in lane 1 behind another lorry, with lane 2 running half a
     mile an hour slower, has no reason to move under that rule and does
     not. It put 17.8% of lorry-seconds in the left lane against a
     measured 1.2% — worse than the model this file exists to beat.

     So the comparison is not against `want` at all. It is against the
     speed at which this driver would consider themselves HELD UP — the
     same threshold `blocked` uses, and deliberately the same number.

     ── and it has to be the same number, or the road oscillates ───────
     Give the two motives independent thresholds and they fight. Set
     `keep right` to accept a lane that costs a couple of metres a second
     and it moves somebody right into a lane where `blocked` fires
     immediately, which moves them back left, where `keep right` starts
     charging again. That is a limit cycle, and it does not look like one
     from inside — it looks like a plausible motorway with a lane-change
     rate of 0.851 per vehicle-km against a measured 0.37, and a
     throughput of 470 veh/h/lane against 1,585, because every one of
     those manoeuvres disturbs two lanes.

     So there is one threshold, `blocked`'s own, and this motive bends it
     rather than inventing a second — which keeps the hysteresis
     structural rather than tuned.

     ── how far left you are is the whole of how much you must justify ──
     Bending it by a flat amount does not work either, and the reason is
     worth writing down because it is the shape of the answer. Make the
     tolerance generous and lorries go right, but so does everybody, and
     `blocked` spends the rest of the run dragging them back out: the
     rate went to 0.851 per vehicle-km against a measured 0.37 and the
     road carried 470 veh/h/lane. Make it tight and lane 1 fills with
     lorries — 13.3% of lorry-seconds against a measured 1.2%.

     The missing idea is that the lanes are not interchangeable. **The
     further left you are, the better your reason has to be for being
     there.** Sitting in lane 3 of 4 needs almost no justification;
     sitting in lane 1 needs a real one. That is not a modelling
     convenience, it is what lane discipline IS, and it is how every
     motorway on earth is signed and taught.

     So the speed a driver will give up to move right scales with how far
     from the right-hand lane they are sitting, and with `discipline`.
     A lorry in lane 1 will take almost anything to get out of it. The
     same lorry in lane 4, behind another lorry one mile an hour slower,
     will not — which leaves `blocked` free to put it out into lane 3,
     and the elephant race survives. §5c stakes the architecture on that
     race emerging, so a fix for the lorry share that killed it would
     have been the wrong fix.

     ── how strong it is at all, which the data says is NOT very ───────
     It is very easy to read "keep right" as "everybody ends up on the
     right", and BEHAVIOUR.md says flatly that they do not. Cars' share
     of each lane on the measured four-lane motorway is

         lane 1  31.7%   lane 2  24.3%   lane 3  19.2%   lane 4  24.8%

     — **lane 1 is the busiest lane on the road**, and lane 3 the
     quietest. So the 15 mph gradient is not produced by traffic piling
     rightwards. It is produced by traffic SORTING, at roughly even
     loading, and the two facts have to be true at once: fast drivers
     accumulate on the left and stay, slow drivers settle right and are
     never blocked, and the lanes stay about equally full.

     That puts a hard ceiling on how hard this motive may pull for a car,
     and it is why the raw `discipline` draw is passed through a curve
     before use. Lane discipline in the population is not linear, it is
     nearly BIMODAL: a minority treat keeping right as a rule and
     everybody else treats it as a suggestion. There is not much middle.

     So the curve has to be a step with soft edges, and the obvious first
     attempt — cubing — is not one. Cubing is monotone and gentle and it
     pulls the top down as hard as the bottom: it took the median lorry
     from 0.88 to 0.67 and put lorry-seconds in lane 1 UP from 3.8% to
     6.1%, which is the wrong direction on the number this motive exists
     to produce. A logistic centred just below the heavy-vehicle draw
     does what the prose actually claimed. `traffic.js` draws cars
     0.25–1.0 and heavy vehicles 0.75–1.0, so the threshold sits between
     them and the two classes separate without either being named:
     the median car lands at 0.29 and the median lorry at 0.89. */
  const KR_TAU = 34;                 // seconds at discipline 0
  const KR_MIN = 2.5;                // ...and at discipline 1
  const KR_GIVE = 0.42;              // fraction of `want` given up, in lane 1
  const KR_MID = 0.70, KR_STEEP = 12;          // the logistic, see above
  const habit = (d) => 1 / (1 + Math.exp(-KR_STEEP * (d - KR_MID)));

  function keepRight(veh, view, L, R) {
    const m = mind(veh), drv = veh.drv, want = drv.want;
    const ln = Math.round(view.lane);
    const disc = habit(drv.discipline);

    /* Nothing to charge for once you are as far right as you are
       willing to REST — which is not always the rightmost lane. See
       `home`: near a junction the right lane has traffic joining it, and
       shepherding somebody into the lane `yield` is busy clearing is the
       two motives working against each other. Ric's three roles are
       right lane to cruise, middle lane out of the way of the mergers,
       left lane to pass, and this is the first of the two halves that
       makes the middle one exist.

       Nothing to charge for either if moving right costs more than being
       this far left is worth. BLOCK_MARGIN is `blocked`'s own number;
       `depth` is what bends it. */
    let needed = ln >= home(veh, view);
    if (!needed) {
      /* CUBED, and it matters. Linear depth makes the middle lanes
         nearly as forgiving as lane 1, and a disciplined driver halfway
         past a lorry then accepts a 26% speed loss to dive back in front
         of it — which is not lane discipline, it is the manoeuvre §5c
         says this motive must never make: "not while I am overtaking
         this lorry". It cost the whole road about five miles an hour.

         Cubing says the thing that is actually true: **lane 1 is
         qualitatively different and the middle lanes are nearly
         interchangeable.** On four lanes the allowance runs 1.00, 0.30,
         0.04 — a full pardon for getting out of the outside lane, almost
         none for shuffling between the middle two. */
      const d = (view.lanes - ln) / Math.max(1, view.lanes - 1);
      const tol = BLOCK_MARGIN - KR_GIVE * disc * d * d * d;
      /* Judging the target lane by the traffic in it rather than by the
         hole you would drop into was tried here, and reverted. It is a
         defensible idea — settling BACK IN is a different question from
         pulling OUT to pass, and a momentary gap in a slower lane is
         not "I can do my speed there" — and on one seed it looked like
         a clear win. It does not survive three. See PLAN.md §5f: the
         seed-to-seed spread on these distributions is larger than the
         effect, which is a fact about the harness rather than about the
         idea, and it has to be fixed before anything here is tuned. */
      needed = prospect(R, want, veh) < want * tol;
    }
    if (needed) { m.idle = Math.max(0, m.idle - view.dt * 3); return null; }

    m.idle += view.dt;
    if (!plausible(R, veh)) return null;

    const tau = KR_MIN + (KR_TAU - KR_MIN) * (1 - disc);
    return { lane: ln + 1, urgency: clamp01(m.idle / tau), why: "keep-right" };
  }

  /* ══ 3. YIELD ═══════════════════════════════════════════════════════
     Wants: out of the way.
     Rises with: someone closing fast behind.
     Produces: *somebody sees you and moves over.*

     §5c calls this "the motive that makes the road feel inhabited rather
     than populated", and it is the one place the traffic acknowledges
     that anything else exists. It is gated on `polite`, drawn per
     vehicle, so roughly half the drivers on the road do not have this
     motive AT ALL and never will — which is a better source of variety
     than any amount of randomness, because it is consistent. The same
     car behaves the same way twice and you can learn to read it.

     The player is not special. This sees a vehicle closing at a speed
     difference; it does not know or ask what that vehicle is. The
     courtesy is earned rather than granted: sit on somebody's bumper and
     the polite ones move, and the rest do not, and no amount of being
     the player changes it.

     ── two triggers, and they pull opposite ways ──────────────────────
     §5c's table gives `yield` two: somebody closing fast behind, and
     somebody merging ahead. They are the same motive — get out of the
     way — and they move you in opposite directions, which is why the
     table says "one lane left" while the obvious reading of the first
     trigger is "move right". Both are correct:

       closing behind  →  move RIGHT, and let them past
       merging ahead   →  move LEFT, out of the lane they are joining

     ── and the second one is Ric's account of what the lanes are for ──
     *(Ric, 2026-08-10: "people stay in the right lane to cruise. people
     stay in the middle lane to stay out of the way of mergers and the
     left lane is for passing. most of the time.")*

     That is three roles, and the model only had two of them. `keep
     right` pulled everybody as far right as they could bear and
     `blocked` pulled them back out; nothing anywhere said the rightmost
     lane has traffic JOINING it, which is the reason a real driver does
     not treat it as home. It shows in the numbers exactly where you
     would expect: 31.1% of cars ended up in lane 4 against a measured
     24.8%, and 16.6% in lane 1 against a measured **31.7%** — lane 1 is
     the busiest lane on the real road and was the emptiest on this one.

     So the middle lanes are the shelter, and this is what puts drivers
     in them. The harness now knows where the interchanges are — see
     `junctions` in sim.js — and near one the rightmost lane is somewhere
     you leave rather than somewhere you settle.

     "Most of the time" is the last three words of Ric's sentence and
     they are load-bearing — but it is **most**, not half, and the two
     halves of `yield` turn out not to be the same disposition.

     Gating this on `polite` was the obvious thing and it is wrong twice
     over. Wrong on the rate: `polite` is drawn at 0.55, so 45% of
     lorries sat in the rightmost lane by construction, against a
     measured 24.7% — the gate was the binding constraint and no amount
     of urgency could get past it. And wrong on the meaning: moving out
     of the merge lane is not a courtesy, it is **self-interest**. You
     are not letting anybody in, you are declining to spend the next ten
     miles being merged into.

     ── and WHO shelters is in the data, and it is not everybody ───────
     Gating it on `push` instead was the second attempt and also wrong,
     for a better reason: it let 77% of ALL traffic shelter, which packs
     the middle lanes, and then lorries that spawned in lane 1 could not
     get out of it — 6.1% of lorry-seconds against a measured 1.2%, with
     exactly ONE lorry manoeuvre INTO lane 1 in the whole run. Nothing
     was driving there. They were stuck there.

     Read BEHAVIOUR.md's two rows against each other and it says plainly
     who does this:

       cars     lane 3  19.2%   lane 4 (right)  24.8%
       lorries  lane 3  48.1%   lane 4 (right)  24.7%

     **Cars slightly prefer the rightmost lane. Lorries avoid it two to
     one.** Lane 3 is quiet for cars precisely because it is full of
     lorries. So sheltering is not a majority behaviour with a few
     hold-outs — it is what the heavy traffic does and the cars do not.

     Which is physical, and it is about the vehicle rather than the
     driver: merging traffic takes the gap in front of you, and what that
     costs depends on how long you are and how badly you accelerate. A
     21 m artic that has just lost its gap spends the next mile getting
     it back. A car shrugs. So the gate is `length`, which `traffic.js`
     already draws per vehicle off its distribution — cars median 4.9 m,
     rigids 9.3, artics 21.5 — and no code here names a class.
     `push` still lets an aggressive driver of anything sit in the merge
     lane and make the joining traffic deal with them.

     ── it signals, and that asymmetry is deliberate ───────────────────
     §5c: "a driver doing you a courtesy is exactly the driver who
     indicates". So this motive reports itself as signalled regardless of
     the driver's habit. The signal reads as *intent to help*, which is
     the thing being modelled. Everything else obeys the measured split —
     half of all lane changes are unsignalled.

     ── what "closing fast behind" actually looks like in a mirror ─────
     The first version asked only for a closing speed, and it fired
     **zero times in 4,141 manoeuvres.** The reason is worth keeping,
     because it is a real fact about car-following rather than a bug:
     nobody can be twenty metres behind you and still gaining, because
     IDM already made them stop gaining. A follower who wants to go
     faster than you does not arrive at your bumper closing — they
     arrive, and then they SIT there. The closing speed is spent by the
     time it would have been noticed.

     So the cue a mirror actually gives you is not a velocity, it is a
     distance: somebody is on your bumper. That is observable, it is what
     a real driver reads, and it self-limits without needing a rate,
     because the measured headway distribution decides how many drivers
     sit that close — p15 is 0.71 s, so a threshold just under a second
     picks out the ones who are genuinely pushing and nobody else. The
     closing-speed path is kept as a second trigger for the case it was
     always right about: somebody arriving quickly from a long way back. */
  const YIELD_TAIL = 0.95;           // seconds of headway: that is a tailgater
  const YIELD_DV = 2.2;              // m/s of closing before it registers
  const YIELD_TTC = 20;              // seconds: still coming, from further out
  /* How far before an interchange the rightmost lane stops being a place
     to sit. A little longer than an on-ramp taper, because the point is
     to be gone before the merging starts rather than to react to it.
     DECIDED. Corridor-wide the median junction spacing is 1,420 m, so at
     500 m this leaves most of most stretches unaffected and bites where
     the junctions are close together — which is the difference between
     open country and a city, and is exactly where it should bite. */
  /* How near the next junction has to be before the rightmost lane is
     one you keep clear of. It is a HABIT rather than a reaction, and it
     took the data to see that.

     BEHAVIOUR.md §2 measures where the lorries sit, and it is not the
     rightmost lane: **48.1% of lorry-seconds in the second lane from the
     right against 24.7% in the rightmost**, very nearly two to one. That
     is not a shuffle at the nose of each ramp — it is where they live.
     On a corridor with a junction every 1,420 m there is no point moving
     back over after each one, so a driver who does not want to deal with
     merging traffic simply sits one lane in and stays there.

     So this is ONE distance graded, not a habit distance plus a reaction
     zone. The wish rises steadily as the junction comes on, crosses the
     floor a bit over a kilometre out, and is at its strongest at the
     ramp. A separate 500 m reaction zone was the first attempt and it
     moved almost nobody: 37 manoeuvres in a road-hour, and the lorries
     stayed exactly where they had been.

     Where the junctions are genuinely far apart — the p90 spacing is
     9 km — this never crosses the floor and the rightmost lane is just
     the cruising lane again. That is the Mojave at three in the morning,
     and it is correct. */
  const MERGE_NEAR = 3000;           // metres
  const MERGE_PUSH = 0.70;           // above this, sit in it anyway
  const MERGE_LEN = 6.2;             // m: longer than any car, shorter
                                     // than any rigid or artic. Moved
                                     // from 8.0 when the length bins
                                     // went to real vehicle sizes — the
                                     // gap it has to sit in is now
                                     // 6.0 to 6.4, not 7.4 to 7.5.

  /* The rightmost lane this driver is willing to REST in. Used by `keep
     right` as well, so that nobody is being shepherded into the lane
     this motive is trying to clear. */
  function home(veh, view) {
    if (view.lanes < 3) return view.lanes;      // no middle to shelter in
    /* Somebody actually getting off wants the lane everybody else is
       sheltering from. Their exit outranks the hassle of the merge, and
       without this `keep right` would stop shepherding them over and
       `yield` would actively pull them back out of the lane they need. */
    if (view.exitIn < MERGE_NEAR) return view.lanes;
    if (veh.len < MERGE_LEN) return view.lanes; // a car shrugs off a merge
    if (veh.drv.push >= MERGE_PUSH) return view.lanes;   // most, not all
    return view.junction < MERGE_NEAR ? view.lanes - 1 : view.lanes;
  }

  function yieldTo(veh, view, L, R) {
    const ln = Math.round(view.lane);
    const want = veh.drv.want;

    /* ── merging ahead: move LEFT, out of the lane they are joining ──
       Gated on `push` inside `home`, not on `polite`: this half is
       self-interest and the other half is courtesy. See above. */
    if (ln > home(veh, view) && ln > 1) {
      if (free(L, want, veh) && plausible(L, veh)) {
        /* Rises as the junction arrives, so the shuffle happens on the
           approach rather than at the nose of the ramp. */
        const urgency = clamp01(1 - view.junction / MERGE_NEAR);
        if (urgency > 0) return { lane: ln - 1, urgency, why: "yield-merge",
                                  signal: true };
      }
    }

    /* ── closing behind: move RIGHT, and let them past ───────────────
       THIS half is the courtesy, and it is the one `polite` gates: about
       half the drivers on the road do not have it and never will. */
    if (!veh.drv.polite) return null;
    if (ln >= view.lanes) return null;               // nowhere to go
    const mine = view.side(ln);
    const back = mine && mine.lag;
    if (!back) return null;

    /* On my bumper: a headway well inside what anybody chooses to hold. */
    const headway = mine.lagGap / Math.max(1, veh.v);
    const onMe = headway < YIELD_TAIL;

    /* Or still coming, from far enough back that they have not had to
       slow down yet. */
    const closing = back.v - veh.v;
    const ttc = closing > YIELD_DV ? mine.lagGap / closing : Infinity;
    const coming = ttc > 0 && ttc < YIELD_TTC;

    if (!onMe && !coming) return null;
    if (!free(R, want, veh) || !plausible(R, veh)) return null;

    /* Prompt, because a courtesy that arrives late is not one. Whichever
       cue is louder sets the urgency. */
    const urgency = Math.max(onMe ? 1 - headway / YIELD_TAIL : 0,
                             coming ? 1 - ttc / YIELD_TTC : 0);
    return { lane: ln + 1, urgency: clamp01(urgency),
             why: "yield", signal: true };
  }

  /* ══ 4. AVOID ═══════════════════════════════════════════════════════
     Wants: away from a hazard.
     Rises with: proximity.
     Produces: **wrecks making traffic, which is the game.**

     This is the motive §5c names as the point of the whole exercise, and
     until 2026-08-10 it had nothing to point at, because nothing in the
     simulation could be wrecked. Now it can: a wreck is a stationary
     object in a live lane that blocks every lane its width overlaps and
     does not clear for twenty minutes.

     ── it is allowed to break the scale ───────────────────────────────
     Everything else here saturates at 1. This does not, because a lane
     blocked by a stopped vehicle is not an opinion competing with other
     opinions about lane discipline — it is the only thing that matters,
     and it has to beat a driver who is midway through wanting something
     else. The urgency is deliberately unbounded above.

     ── and it is not perfect information ──────────────────────────────
     A wrecked car in front of you is a thing you can SEE. It is in your
     lane, it is not moving, and its hazards are on. Reading `lead.wreck`
     is not the decider peering into simulation state, it is the one
     piece of information a stationary obstacle broadcasts louder than
     anything else on the road. What this motive still cannot see is a
     wreck two lanes over, or one hidden behind the lorry in front, and
     that is correct — it is why traffic backs up rather than parting. */
  const AVOID_TTC = 11;              // seconds to a stopped obstacle
  const AVOID_CRAWL = 3.0;           // m/s: below this and stopping, it is one

  function hazard(side) {
    if (!side || !side.lead) return false;
    const L = side.lead;
    return !!L.wreck || L.v < AVOID_CRAWL;
  }

  function avoid(veh, view, L, R) {
    const mine = { lead: view.lead, leadGap: view.gap };
    if (!hazard(mine)) return null;
    const closing = veh.v - Math.max(0, view.lead.v);
    if (closing <= 0.1) return null;
    const ttc = view.gap / closing;
    if (!(ttc > 0) || ttc > AVOID_TTC) return null;

    const ln = Math.round(view.lane);
    /* Anywhere that is not this. A lane with its own hazard in it is not
       an escape, which is how a second wreck one lane over turns a
       diversion into a queue. */
    const okL = ln > 1 && !hazard(L) && plausible(L, veh);
    const okR = ln < view.lanes && !hazard(R) && plausible(R, veh);
    if (!okL && !okR) return null;

    let lane;
    if (okL && okR) lane = prospect(L, veh.drv.want, veh) >= prospect(R, veh.drv.want, veh)
                            ? ln - 1 : ln + 1;
    else lane = okL ? ln - 1 : ln + 1;

    /* Unbounded on purpose — see above. At the moment of arrival this is
       worth several times anything else on the scale. */
    const urgency = 1.15 * (AVOID_TTC / Math.max(0.4, ttc));
    return { lane, urgency, why: "avoid", signal: true,
             nerve: 1 + 0.6 * Math.max(0, urgency - 1) };
  }

  /* ══ the junction three, which are the second run of the harness ════
     Stubbed with the signature they will have rather than left out, so
     that the shape of `decide` does not change when they land and so
     that it is obvious they are missing rather than forgotten.

     They need a corridor with ramps in it. `exit` wants the distance to
     the gore of the exit this vehicle was given when it spawned and the
     lane that exit leaves from; `merge` wants the taper it is standing
     on and how much of it is left; `lane drop` wants to know that the
     lane it is in ends. None of those exist on six kilometres of
     straight mainline, which is what judges this file today. */
  /* ══ EXIT ═══════════════════════════════════════════════════════════
     Wants: the lane its exit leaves from.
     Rises with: closing on the gore.
     Produces: moving over early, and crossing four lanes late.

     *(Ric, 2026-08-10: "ramps define some of the decisions by cars.
     people will move lanes more around exits because they are trying to
     get off on or give people room.")*

     §5c calls this the motive that most affects the player, because the
     game is about exits and a car cutting four lanes in front of you is
     the hazard the corridor was built to stage. It is also, probably,
     where a chunk of the missing lane-change rate is: the model runs at
     0.27 per vehicle-km against a measured 0.37, and the drone that
     measured 0.37 was flown over road with ramps in frame — so a whole
     class of reason to change lane was simply absent.

     ── one trait, and it does everything ──────────────────────────────
     `exitLead` is drawn 240 m to 3.2 km, very wide on purpose, and it is
     the distance at which this driver starts thinking about getting
     over. That single draw produces the driver who is in the exit lane
     two miles out and the one still in lane 1 at the gore, and nothing
     anywhere has to decide which kind a vehicle is.

     ── and the second term is what makes the late ones frightening ────
     Wanting it earlier is not enough. A driver in lane 1 with 300 m left
     has to cross three lanes and a lane change takes four seconds, so
     the question is not how much they want it, it is whether there is
     any road left to do it in. When there is not, this goes unbounded —
     the same licence `avoid` has, for the same reason: at that point
     nothing else on the road matters to them. That is the four-lane
     scramble, and it falls out of arithmetic about time and distance
     rather than out of any rule that says "sometimes cut across". */
  const CROSS = 6.0;                 // seconds to GET ACROSS one lane

  function exit(veh, view, L, R) {
    const d = view.exitIn;
    if (!(d < Infinity)) return null;               // not getting off here
    const ln = Math.round(view.lane);
    if (ln >= view.lanes) return null;              // already in the exit lane
    if (!plausible(R, veh)) return null;

    /* How much road it needs to cross what is left.

       CROSS is seconds per lane and it is not the median manoeuvre
       duration, which is the mistake worth recording: at 4 s a lane —
       the measured median — **47% of drivers missed their exit**, which
       is not a wide `exitLead` producing the careful and the appalling,
       it is an allowance that was simply too small. A manoeuvre takes
       4.24 s at the median and 5.6 at p85, the driver has to find a gap
       before starting each one, and `room` throws plenty of attempts
       out. Six seconds a lane is the honest budget for actually getting
       across one, as opposed to the time the crossing itself takes.

       `veh.v` floors at walking pace so a stopped queue does not divide
       by nothing. */
    const need = (view.lanes - ln) * CROSS * Math.max(4, veh.v);
    const lead = Math.max(veh.drv.exitLead, need);
    if (d > lead) return null;                      // not on their mind yet

    let urgency = clamp01(1 - d / lead);
    /* Running out of road. Unbounded, deliberately. */
    if (d < need) urgency = Math.max(urgency, 1.1 * need / Math.max(20, d));
    /* And they will take a worse gap for it — see `room` in sim.js.
       Stated separately from urgency because `nerve` is a claim about
       what this driver will ACCEPT, and urgency is a claim about what
       they WANT; the two stand-in deciders have opinions about the
       second and none about the first. */
    return { lane: ln + 1, urgency, why: "exit", signal: true,
             nerve: 1 + 0.6 * Math.max(0, urgency - 1) };
  }
  const merge = () => null;          // needs a taper under the vehicle
  const laneDrop = () => null;       // needs the lane count to vary

  /* ══ and the argument between them ══════════════════════════════════
     Score everything, take the strongest, and move only if it clears the
     floor. Order of evaluation is irrelevant and must stay that way —
     if it ever matters, that is a priority list wearing a costume, and
     the architecture has quietly stopped being what §5c asked for. */
  const ALL = [avoid, blocked, keepRight, yieldTo, exit, merge, laneDrop];

  /* Having just moved, a driver settles before reconsidering. This is
     not a cooldown bolted on to suppress churn — it is that arriving in
     a lane takes a moment to assess, and a model without it re-decides
     the instant the wheels are straight, on a view of the world that has
     not finished changing. `avoid` is exempt, because a wreck does not
     wait for you to have settled in. DECIDED. */
  const SETTLE = 4.0;                // seconds

  function decide(veh, view, ctx) {
    /* `dt` on the view, so a motive can integrate without reaching for
       ctx. Everything else a motive needs is already on `view`. */
    view.dt = ctx.dt;

    const ln = Math.round(view.lane);
    const L = ln > 1 ? view.side(ln - 1) : null;
    const R = ln < view.lanes ? view.side(ln + 1) : null;

    const settling = ctx.t - mind(veh).since < SETTLE;

    let best = null;
    for (let i = 0; i < ALL.length; i++) {
      /* `avoid` and `exit` are exempt: a wreck does not wait for you
         to have settled in, and a driver crossing three lanes at the
         gore has to do it back to back or not at all. */
      if (settling && ALL[i] !== avoid && ALL[i] !== exit) continue;
      const want = ALL[i](veh, view, L, R);
      if (!want) continue;
      if (!best || want.urgency > best.urgency) best = want;
    }
    if (!best || best.urgency < FLOOR) return null;

    /* Acting on it settles the debt that produced it. Without this a
       driver who has been charged for two minutes in lane 1 changes
       lane, arrives, and is still carrying the whole debt — so it moves
       again, and again, straight across the carriageway. That is not a
       lane change, it is a lane sweep, and it is what the first version
       of this file did. */
    const m = mind(veh);
    m.held = 0; m.idle = 0; m.since = ctx.t;
    return best;
  }

  return {
    decide,
    motives: { blocked, keepRight, yield: yieldTo, avoid, exit, merge, laneDrop },
    free, prospect, plausible, mind,
    FLOOR, BLOCK_TAU, BLOCK_MIN, KR_TAU, KR_MIN, YIELD_DV, YIELD_TTC, YIELD_TAIL,
    AVOID_TTC, REACH, HOLD, SETTLE, BLOCK_MARGIN, KR_GIVE, habit,
    MERGE_NEAR, MERGE_PUSH, MERGE_LEN, home, CROSS,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = Motive;
