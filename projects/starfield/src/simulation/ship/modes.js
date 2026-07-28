/* ══════════════════════════════════════════════════════════════════════
   modes.js — the drive, as five places rather than five speeds.

   Controls §2.4, decided 2026-07-26. The player picks the *situation* they
   are in and the ship supplies the whole envelope that suits it. Ric's
   framing, which is the decision: **"like if it's like selecting where
   you're flying, so you have the ultimate control."**

   So the names here are places. Not "slow / fast / faster", and not gear
   numbers with a speed printed on them — a mode called `System` tells you
   what it is for, and a mode called `Gear 4` makes you remember.

   Three rules govern everything in this file:

     · **A mode is an acceleration, not a speed.** Ric's original rule and
       still the law: selecting a mode must never change your current
       velocity and must never kill you. Dropping to Local while doing a
       thousand km/s is legal — you keep the thousand km/s and get a
       smaller engine to shed it with, which is a problem you can fly out
       of rather than a punishment.
     · **You may never fly faster than you could stop.** That is the whole
       of the proximity governor below, and it is the same √(2·a·d) the
       autopilot flies and the HUD already prints as stopping distance.
       One equation, in three places, agreeing.
     · **Where the fiction starts is written down.** Modes 1–3 are ordinary
       Newtonian flight at an extraordinary thrust. Modes 4 and 5 exceed
       light and are a declared fictional drive (Bible §8.2D, ledger
       SF-L-018); `honest` says which is which, and nothing in this file
       dresses the fiction up as relativity.
   ══════════════════════════════════════════════════════════════════════ */

import { K } from "../core/units.js";
import { SHIP } from "./ship.js";

const C = 299792458;
/** Metres in a light-year. */
const LY = 9.4607e15;

/**
 * How long the drive takes to reach cruise, in the modes that have one.
 *
 * One number for all three, because five modes that each spool differently
 * is exactly the kind of thing that makes a ship feel complicated. A second
 * and a bit: fast enough to read as instant, long enough to be a moment you
 * can see happen rather than a teleport.
 */
export const SPOOL_SECONDS = 1.2;

/**
 * The five modes.
 *
 * `authority` is real acceleration in m/s² and is what the ship *manoeuvres*
 * with — turning, trimming, and above all braking. It is what the governor
 * measures you against, so it is the number that decides how close you may
 * fly to a world at speed. `topSpeed` is the fastest the throttle will ask
 * for.
 *
 * `spoolSeconds` is how long the drive takes to reach whatever speed you
 * asked for, and it is the reason this table works at all.
 *
 * ── Why spool time exists ──────────────────────────────────────────────
 *
 * Ric, 2026-07-28: modes 3, 4 and 5 should be *"almost instant… like going
 * into lightspeed in Star Wars"*, and the ship should be one you *"barely
 * think about"*.
 *
 * Until now, reaching a mode's top speed meant accelerating at `authority`
 * until you got there. Work that through and the table was not merely slow,
 * it was impossible:
 *
 *     mode 3  System         5 minutes to reach 0.01 c
 *     mode 4  Interstellar   87 YEARS
 *     mode 5  Intergalactic  150 MILLION YEARS
 *
 * `authority` and `topSpeed` had been chosen independently — each sensible
 * on its own, never divided into one another — so the top speed was a
 * number the HUD printed and the ship could not get to. "It speeds up
 * slowly" was a generous description of never arriving.
 *
 * The fix is not a bigger acceleration, it is a different *quantity*. A
 * drive that reaches its cruise in a fixed **time** regardless of how fast
 * that cruise is, is exactly the ship in the films: you engage it, the view
 * lurches, and you are travelling. It also makes the ladder legible —
 * every mode feels the same to engage and they differ only in where they
 * take you, which is the whole point of naming them after places.
 *
 * Modes 1 and 2 keep honest physics: they are the modes you do delicate
 * work in, where the acceleration *is* the flying and 10 s and 100 s to
 * their (modest) top speeds are perfectly reasonable numbers.
 *
 * Braking is unchanged and deliberately so. `authority` still governs how
 * fast you may approach a world, so the governor keeps working exactly as
 * it did and the ship still sheds speed on the way in rather than arriving
 * at a wall. Spool is about *gaining* speed in open space. Declared
 * fiction, ledger `SF-L-024`.
 *
 * The anchors are Ric's, given 2026-07-26: **mode 4 crosses Earth–Moon in
 * about two minutes**, and **mode 5 is for the gaps between galaxies and
 * nothing closer.** The rest is filled in between so each mode is one to
 * two orders past the one below — close enough that the next mode always
 * helps, far enough that five of them span fourteen decades of distance.
 */

export const FLIGHT_MODES = [
  {
    id: 1,
    key: "local",
    name: "Local",
    /** What the mode is *for*, in the player's terms. This goes on the glass. */
    forWhat: "station-keeping, close approach, terrain and rings",
    authority: 30,                       // 3 g — the value Slice B was tuned at
    topSpeed: 300,
    honest: true,
    /* The one mode that brakes for real.
​
       Ric, 2026-07-26: "you should be able to stop instantly if you want",
       then immediately "instant stop should only be a thing on 2-6". Local
       is the exception and it is the right exception. This is the mode you
       do delicate work in — closing on a truss at centimetres per second —
       where the braking *is* the flying, and a button that cancels your
       momentum outright would take the skill out of the one place the
       slice has any. It is also the mode where honest braking costs
       nothing: ten seconds from the mode's own top speed. */
    instantStop: false,
  },
  {
    id: 2,
    key: "orbital",
    name: "Orbital",
    forWhat: "orbits, rendezvous, anywhere around one world",
    // Orbital speeds are 7–11 km/s, so the cap has to clear them with room
    // to change orbit rather than merely hold one.
    authority: 300,                      // 30 g
    topSpeed: 30e3,
    honest: true,
    instantStop: true,
  },
  {
    id: 3,
    key: "system",
    name: "System",
    forWhat: "moon to moon, planet to planet",
    authority: 1e4,                      // ~1 000 g, for manoeuvring and braking
    topSpeed: 0.01 * C,
    spoolSeconds: SPOOL_SECONDS,
    /* Still honest, and the flag means what it has always meant here:
       **sublight**. 0.01 c is 0.01 c whether you took five minutes to reach
       it or one, and this mode does not touch the relativistic terms the
       slice declines to model. The spool makes the thrust more
       extraordinary — 250 000 g rather than 1 000 — but the file header
       already describes modes 1–3 as "ordinary Newtonian flight at an
       extraordinary thrust", and the ship itself is a declared fiction
       (SF-L-018). What would make this dishonest is exceeding light or
       pretending the acceleration is survivable, and it does neither. */
    honest: true,
    instantStop: true,
  },
  {
    id: 4,
    key: "interstellar",
    name: "Interstellar",
    forWhat: "star to star",
    /* Ric's anchor, and it is the governor that produces it.
​
       "4 should take earth to moon about 2 minutes **but if you get close
       to it needs to slow you down**" — the two halves are one behaviour.
       This mode's top speed would cross Earth–Moon in a rounding error;
       what takes two minutes is being governed down to what you can stop
       from at both ends. Integrating dx/v(x) with v = ½√(2·a·clearance)
       from a 420 km orbit to a lunar standoff gives 120 s at exactly this
       authority. `tests/modes.test.js` re-integrates it, so the anchor
       cannot drift silently.
​
       Worth seeing clearly: the governor never lets you near this mode's
       top speed anywhere inside the Earth–Moon system. Mid-crossing it
       permits 0.019 c and no more. The interstellar speed is for the part
       of the trip where there is nothing to hit. */
    authority: 3.45e5,                   // ~35 000 g, for manoeuvring and braking
    topSpeed: 0.1 * LY,                  // 0.1 ly/s — Proxima in 42 s
    spoolSeconds: SPOOL_SECONDS,
    spindownSeconds: 65,
    honest: false,
    instantStop: true,
  },
  {
    id: 5,
    key: "intergalactic",
    name: "Intergalactic",
    forWhat: "between galaxies — and nothing closer",
    authority: 1e6,                      // for manoeuvring and braking
    topSpeed: 5e5 * LY,                  // 500 000 ly/s — Andromeda in five seconds
    spoolSeconds: SPOOL_SECONDS,
    spindownSeconds: 65,
    honest: false,
    instantStop: true,
  },
];

export const DEFAULT_MODE = 1;

/**
 * May this mode cancel the ship's velocity outright?
 *
 * Declared fiction, ledger SF-L-019. Above Local the honest stopping
 * distances are hundreds of kilometres and the physical brake stops being
 * an escape hatch and starts being a countdown you watch — so the escape
 * hatch is made real instead of nominal. It is never automatic: it happens
 * because the player pressed the key.
 */
export const canStopInstantly = (mode) => mode.instantStop === true;

/**
 * How hard this mode can actually shed speed, m/s².
 *
 * The single source of truth for braking, and it exists because there were
 * two answers and both were wrong somewhere. The flight model clamps its
 * velocity loop at `max(authority, topSpeed/spool)` — the spool works in
 * both directions, so a drive that reaches 0.1 ly/s in 1.2 s also stops
 * from it in 1.2 s. The HUD's stopping readout, meanwhile, was computing
 * from `SHIP.maxAcceleration`: 30 m/s², the docking thruster, in every mode.
 *
 * At Intergalactic speeds that readout said **1.6×10²⁰ seconds**. The true
 * answer is a second and a bit. Ric flew it and reported the UI broken,
 * and this was most of why.
 *
 * @param {object} mode from FLIGHT_MODES
 * @param {boolean} [precision] precision mode scales the whole ship down
 */
export function brakingAuthority(mode, precision = false) {
  const factor = precision ? SHIP.precisionFactor : 1;
  const bySpool = mode.spoolSeconds > 0 ? mode.topSpeed / mode.spoolSeconds : 0;
  return Math.max(mode.authority, bySpool) * factor;
}

/** Look a mode up by its number. Falls back to Local rather than throwing. */
export function modeById(id) {
  return FLIGHT_MODES.find((m) => m.id === id) ?? FLIGHT_MODES[0];
}

/**
 * How much of the ship's top speed is honest physics.
 *
 * Modes 4 and 5 exceed light and the Bible forbids describing that as
 * ordinary relativity, so the HUD needs to be able to say plainly which
 * side of the line the current mode sits on.
 */
export const isFiction = (mode) => !mode.honest;

/**
 * The speed the ship is allowed to fly, given what is near it.
 *
 * **"If you get close to it it needs to slow you down intentionally."**
 * — Ric, 2026-07-26. This is that, expressed as physics rather than as a
 * rule: you may fly as fast as you could still stop from, and no faster.
 *
 * That one expression does every job at once. Far from anything, the
 * governed speed exceeds the mode's own cap and the mode wins — deep space
 * is unrestricted. Approaching a world it falls smoothly, so the ship
 * sheds speed on the way in rather than arriving at a wall. And because it
 * is the same arithmetic the autopilot flies and the HUD prints, a player
 * watching the stopping-distance readout can see exactly *why* they are
 * being slowed, which is the difference between a safety system and an
 * invisible hand taking the controls.
 *
 * The half is the honest margin: the ship holds half the speed it could
 * theoretically stop from, leaving authority spare for the turn, for
 * gravity, and for the fact that the thing ahead is moving too.
 *
 * @param {object} mode       from FLIGHT_MODES
 * @param {number} clearance  metres, surface to surface, to the nearest body
 * @returns {number} m/s
 */
export function governedSpeed(mode, clearance) {
  if (!(clearance > 0)) return 0;

  /* There are two ways to shed speed and the ship may use either, so the
     governor permits whichever allows more.

     **Thrust.** v²/2a, halved for margin. Newtonian, honest, and the one
     that binds close in — it is what actually stops you beside a moon.

     **Spinning the drive down.** Modes 4 and 5 exceed light, and no amount
     of thrust stops something doing 0.1 ly/s: a Newtonian governor would
     cap the interstellar drive at 135 c a light-year from anything, which
     makes its stated top speed unreachable anywhere in the galaxy — a
     number on a dial that is a lie. The declared fiction (Bible §8.2D)
     is that the drive lets go over `spindownSeconds`, covering about
     v·t/2 while it does. That is linear in clearance rather than square
     root, so it dominates far out and vanishes close in, which is exactly
     the right shape: you manoeuvre on thrust near a world and the drive
     carries you between them.

     The spindown time is not a free parameter. At 65 s the Earth–Moon
     crossing comes out at Ric's two minutes and Proxima at 42 seconds —
     which is, to the second, what the prototype's own Interstellar gear
     promised. `tests/modes.test.js` re-integrates both. */
  const byThrust = 0.5 * Math.sqrt(2 * mode.authority * clearance);
  const byDrive = mode.spindownSeconds ? (2 * clearance) / mode.spindownSeconds : 0;

  /* ── and a third limit: what the *loop* can shed ──────────────────────
​
     √(2·a·d) is the speed you could stop from if you braked at `a` from the
     first instant. The assisted controller does not: it is proportional, so
     it brakes at gain × error and the error shrinks as it works. Its lag is
     1/gain seconds — an eighth — regardless of how much thrust the mode has,
     and an eighth of a second at 71 km/s is nine kilometres.
​
     That gap is not theoretical. Pointing mode 5 straight down from a 420 km
     orbit at full throttle, the governor dutifully reported "held to 20.5
     km/s" the whole way and the ship hit the ground at 71 km/s: the
     commanded speed was legal at every instant and the ship was never able
     to *be* it. A governor whose arithmetic assumes a braking law the ship
     does not fly is not a safety system, it is a caption.
​
     So: you may also fly no faster than the loop can bleed off in a quarter
     of the room available. Linear in clearance, so it binds only close in —
     below about A/8, which is the last 43 km in mode 4 and the last kilometre
     and a quarter in mode 3. Every distance in the anchors is far outside
     that, so the Earth–Moon crossing and the run to Proxima are untouched;
     what changes is the last few seconds of an approach, which is exactly
     where the old rule was writing cheques the controller could not cash.
     Ledger `SF-L-026`. */
  const byLoop = (SHIP.velocityGain * clearance) / 4;

  return Math.min(mode.topSpeed, Math.max(byThrust, byDrive), byLoop);
}

const BODY_RADII = {
  earth: K.EARTH_RADIUS_EQ.value,
  moon: K.MOON_RADIUS.value,
  sun: K.SUN_RADIUS.value,
};

/**
 * How wide the corridor is that a body governs, in its own radii.
 *
 * You must be able to stop for anything you would pass within ten radii
 * of. Ten because it wants to be generous rather than exact — the player
 * is aiming by eye and a corridor that hugs the limb would punish a
 * degree of sloppiness with a collision. In radii rather than metres
 * because it then means the same thing at the Moon and at the Sun.
 */
const CORRIDOR_RADII = 10;

/**
 * Clearance to the nearest body, surface to surface.
 *
 * Surface to surface and not centre to centre, for the same reason every
 * other range in this project is: a governor measuring to Earth's core
 * would start braking 6 378 km early and make low orbit unflyable, and one
 * measuring to the centre of the Sun would be 700 000 km worse.
 *
 * @param {{x,y,z}} position
 * @param {object} state   WorldService.state
 * @returns {{clearance:number, id:string|null}}
 */
export function nearestClearance(position, state) {
  let clearance = Infinity;
  let id = null;
  for (const body of Object.values(state.bodies)) {
    const radius = BODY_RADII[body.id];
    if (radius === undefined) continue;
    const gap = Math.hypot(
      body.position.x - position.x,
      body.position.y - position.y,
      body.position.z - position.z
    ) - radius;
    if (gap < clearance) { clearance = gap; id = body.id; }
  }
  return { clearance, id };
}

/**
 * Clearance to the nearest thing **in front of you**.
 *
 * ── Why the governor had to learn about direction ──────────────────────
 *
 * Ric, 2026-07-28: modes 3–5 should engage *"like going into lightspeed in
 * Star Wars"*, and the ship should be one you *"barely think about"*.
 *
 * Fixing the drive's spool time made mode 3 reach cruise in 1.35 s and did
 * almost nothing for 4 and 5, because the drive was never what held them
 * back — this was. `governedSpeed`'s spindown term is linear in clearance,
 * so with clearance measured as a *sphere around the ship* the permitted
 * speed grew only as fast as the ship was permitted to fly:
 *
 *     dx/dt = 2x / 65   →   x = x₀·e^(t/32.5)
 *
 * An exponential with a thirty-two second time constant. Measured in the
 * probe, from low orbit, mode 4 took **187 seconds** to reach its top speed
 * and mode 5 never reached its at all. Not because anything was unsafe —
 * because Earth was *behind* the ship and still slowing it down.
 *
 * That is the actual bug, and it is a geometry bug rather than a tuning
 * one. A straight line that misses a planet misses it no matter how fast
 * you fly it. The governor was answering "how close is the nearest world?"
 * when the only question that keeps you alive is **"what am I about to
 * arrive at?"**
 *
 * So a body governs you only if it is ahead of you and inside the corridor
 * you are flying down; the distance that counts is the distance *along the
 * path* to its near face, not the range to it. Everything the old rule did
 * well, it still does — dive at Earth and it holds you to what you can stop
 * from, close on the Moon and it sheds your speed the whole way in. What it
 * no longer does is charge you for leaving.
 *
 * The result reads as the mass-shadow rule the films actually use, which is
 * a fair sign it is the right shape: you cannot jump beside a world, you can
 * jump the moment you are pointed at open space, and the way to go fast is
 * to aim at nothing. Nothing about it is a special case for FTL. Ledger
 * `SF-L-025`, which also records the one thing this cost: Ric's Earth–Moon
 * anchor falls from 120 s to 79 s, because the departure half of that
 * crossing is the very thing being deleted.
 *
 * Turning back toward what you just left is safe for a reason worth stating,
 * since it is the obvious objection: the spool ceiling in `flight-model.js`
 * clamps the velocity *error*, so it sheds speed exactly as fast as it gains
 * it. A ship that reaches 0.1 ly/s in 1.2 s stops from 0.1 ly/s in 1.2 s.
 *
 * @param {{x,y,z}} position
 * @param {{x,y,z}} heading   unit vector the ship is being commanded along
 * @param {object}  state     WorldService.state
 * @returns {{clearance:number, id:string|null}}  clearance is Infinity when
 *   the way ahead is clear, which is a thing the HUD is allowed to say.
 */
export function clearanceAhead(position, heading, state) {
  let clearance = Infinity;
  let id = null;

  for (const body of Object.values(state.bodies)) {
    const radius = BODY_RADII[body.id];
    if (radius === undefined) continue;

    const rx = body.position.x - position.x;
    const ry = body.position.y - position.y;
    const rz = body.position.z - position.z;
    const range = Math.hypot(rx, ry, rz);

    /* Already touching it. No direction saves you from that, and reporting
       it as "behind, therefore clear" would be the one failure this whole
       function exists to avoid. */
    if (range - radius <= 0) return { clearance: range - radius, id: body.id };

    const along = rx * heading.x + ry * heading.y + rz * heading.z;
    if (along <= 0) continue;                    // behind you: not an obstacle

    /* How close this path passes it. Pythagoras on the range and the
       along-track component — the perpendicular miss distance of a straight
       line, which is what the ship flies while the player holds a heading. */
    const miss = Math.sqrt(Math.max(0, range * range - along * along));
    if (miss > radius * CORRIDOR_RADII) continue;   // you go by, not into

    const gap = along - radius;
    if (gap < clearance) { clearance = gap; id = body.id; }
  }

  return { clearance, id };
}
