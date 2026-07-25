/* ══════════════════════════════════════════════════════════════════════
   hud.js — two clocks, and the honesty ledger.

   THE TWO CLOCKS ARE THE POINT. Same engine, same equations, side by side:

     SHIP TIME    what you have lived through, τ
     HOME TIME    what has passed back there, t = ∫γ dτ

   The gap widens hyperbolically as you burn, and nothing else in the game
   lands as hard as watching those numbers come apart. Fly to Andromeda and
   it reads fifteen years against two and a half million.

   The panel names things the way a pilot would, not the way a textbook
   does: Speed reads as a percentage of light rather than β, and γ reads as
   "Home clock 87×" rather than a bare Greek letter. The symbols are still
   what the code computes — they are just not what the player is asked to
   read mid-flight. Same for the death notices below.

   THE LEDGER (§14) states exactly where the game cheats, with the
   arithmetic, because the honest version of this game is unlosable:

     σ = πR☉² = 1.7×10⁻¹⁴ ly²      n = 0.004 stars/ly³
     ℓ = 1/(nσ) ≈ 2.4×10¹⁶ ly

   Flying in a straight line through the real galaxy you would cover about
   24 quadrillion light-years before hitting a star — around a million times
   the width of the observable universe. Every inflation that makes a game
   out of that is listed, in one place, generated from SF.FUDGE so the
   ledger cannot drift out of sync with the code it describes.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});
  const K = SF.K;
  const F = SF.FUDGE;

  const el = (id) => document.getElementById(id);

  function significant(value, digits = 3) {
    if (!Number.isFinite(value)) return "—";
    if (value === 0) return "0";
    const abs = Math.abs(value);
    const exp = Math.floor(Math.log10(abs));
    // toPrecision() switches to "7.07e+5" notation as soon as the exponent
    // reaches `digits`, which is well below the 1e6 this used to test for —
    // so γ = 707,106 rendered as raw JS exponential in the middle of an
    // otherwise typeset HUD. Hand every such case to the superscript branch.
    if (exp >= digits || exp < -4) {
      const mantissa = value / Math.pow(10, exp);
      return `${mantissa.toFixed(2)}×10${superscript(exp)}`;
    }
    // Strip trailing zeros only *after* a decimal point. The old pattern was
    // /\.?0+$/, which happily turned "100" into "1".
    return value.toPrecision(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  function superscript(n) {
    const map = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
    return String(n).split("").map((c) => map[c] || c).join("");
  }

  const HUD = SF.hud = {
    els: {},

    init() {
      HUD.els = {
        shipTime: el("ship-time"),
        homeTime: el("home-time"),
        gamma: el("gamma"),
        beta: el("beta"),
        distance: el("distance"),
        throttle: el("throttle"),
        ism: el("ism"),
        hull: el("hull"),
        hullBar: el("hull-bar"),
        cmb: el("cmb"),
        gravity: el("gravity"),
        relLabel: el("rel-label"),
        relSpeed: el("rel-speed"),
        assist: el("assist"),
        milestone: el("milestone"),
        milestoneTitle: el("milestone-title"),
        milestoneNote: el("milestone-note"),
        readout: el("readout"),
        sound: el("sound"),
        notice: el("notice"),
        noticeTitle: el("notice-title"),
        noticeBody: el("notice-body"),
        lamp: el("lamp"),
        lampText: el("lamp-text"),
      };
      el("notice-close")?.addEventListener("click", () => HUD.dismissNotice());
      HUD.buildLedger();
    },

    /**
     * Time, in whatever unit keeps it readable. Ship time starts in days and
     * ends in years; home time ends in millions or billions of them.
     */
    formatYears(years) {
      const abs = Math.abs(years);
      if (abs < 1 / 365.25 / 24) return `${(years * 365.25 * 24 * 60).toFixed(1)} min`;
      if (abs < 1 / 365.25) return `${(years * 365.25 * 24).toFixed(2)} hr`;
      if (abs < 1) return `${(years * 365.25).toFixed(1)} d`;
      if (abs < 1e3) return `${years.toFixed(2)} yr`;
      if (abs < 1e6) return `${(years / 1e3).toFixed(2)} kyr`;
      if (abs < 1e9) return `${(years / 1e6).toFixed(2)} Myr`;
      if (abs < 1e12) return `${(years / 1e9).toFixed(2)} Gyr`;
      return `${significant(years)} yr`;
    },

    /** Distance, from light-seconds all the way out to gigaparsecs of it. */
    formatDistance(ly) {
      const seconds = ly * K.year;
      if (ly < 1 / K.year * 60) return `${seconds.toFixed(1)} light-sec`;
      if (ly < 1 / K.year * 3600) return `${(seconds / 60).toFixed(1)} light-min`;
      if (ly < 1 / 365.25) return `${(seconds / 3600).toFixed(1)} light-hr`;
      if (ly < 1) return `${(ly * 365.25).toFixed(1)} light-days`;
      if (ly < 1e3) return `${ly.toFixed(3)} ly`;
      if (ly < 1e6) return `${(ly / 1e3).toFixed(2)} kly`;
      if (ly < 1e9) return `${(ly / 1e6).toFixed(3)} Mly`;
      return `${(ly / 1e9).toFixed(3)} Gly`;
    },

    formatGamma(gamma) {
      if (gamma < 10) return gamma.toFixed(3);
      if (gamma < 1e5) return Math.round(gamma).toLocaleString();
      return significant(gamma);
    },

    /** γ for the panel: a multiplier, because that is what it does to clocks. */
    formatTimeFactor(gamma) {
      if (!Number.isFinite(gamma)) return "—";
      if (gamma < 10) return `${gamma.toFixed(2)}×`;
      if (gamma < 1e5) return `${Math.round(gamma).toLocaleString()}×`;
      return `${significant(gamma)}×`;
    },

    /**
     * Speed as a plain percentage of light, because "0.9994" means nothing at
     * a glance and "99.94% of light" means everything. Past 99% the trailing
     * nines are the whole story — each one is another factor in γ — so they
     * are kept rather than rounded away.
     */
    formatBeta(beta) {
      const pct = beta * 100;
      if (pct < 0.01) return "0% of light";
      if (pct < 1) return `${pct.toFixed(3)}% of light`;
      if (pct < 99) return `${pct.toFixed(1)}% of light`;

      // Past 99% show one digit more than the gap to c, so each new nine
      // appears as it is earned. Clamped to the same ceiling rapidity uses
      // (β ≤ 0.999999999999) because rounding must never be allowed to print
      // the one speed this game exists to say you cannot reach.
      const gap = Math.max(1 - beta, 1e-12);
      const decimals = Math.min(12, Math.ceil(-Math.log10(gap)) + 1);
      const shown = Math.min(pct, 99.9999999999);
      const digits = shown.toFixed(decimals).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
      return `${digits}% of light`;
    },

    /**
     * A speed in units you can act on: m/s crawling alongside a planet, km/s
     * across a system, then a fraction of light once that stops being useful.
     */
    formatSpeed(betaLike) {
      const ms = Math.abs(betaLike) * K.c;
      if (ms < 1) return `${ms.toFixed(2)} m/s`;
      if (ms < 1000) return `${ms.toFixed(1)} m/s`;
      if (ms < 1e6) return `${(ms / 1000).toFixed(1)} km/s`;
      if (Math.abs(betaLike) < 0.01) return `${(ms / 1000).toFixed(0)} km/s`;
      return `${(Math.abs(betaLike) * 100).toFixed(2)}% of light`;
    },

    update(state) {
      const e = HUD.els;
      if (!e.shipTime) return;
      e.shipTime.textContent = HUD.formatYears(state.shipYears);
      e.homeTime.textContent = HUD.formatYears(state.homeYears);
      e.gamma.textContent = HUD.formatTimeFactor(state.gamma);
      // Speed, in a physical unit first and a fraction of light beside it.
      // Sub-light reads in m/s (rolled up to km/s, then Mm/s); once the drive
      // is faster-than-light, metres per second stop being legible, so it
      // switches to light-years per second with the multiple of c alongside.
      // SPEED, IN THE TWO UNITS THAT MEAN SOMETHING. In the honest gears the
      // ship's velocity is stored as celerity — home light-years per second of
      // the pilot's own life — so the physical speed is βc (never above light,
      // however hard you push) while the distance you actually eat per second
      // is the celerity, and at high γ the second is far larger than the first.
      // Both get shown, because the gap between them IS relativity. In the
      // faster-than-light gears there is no β to quote, so it reads in ly/s.
      {
        const speed = Math.abs(state.warpLySec || 0);   // celerity, ly/ship-s
        const cLySec = F.shipYearsPerSecond;
        let main, side;
        // Once you are covering more than a light-year per year of your own
        // life, "% of light" stops being the informative half of the readout —
        // every gear above this reads 99.99…% — so the distance you actually
        // eat per second leads instead, with β beside it.
        if (speed > cLySec) {
          main = `${significant(speed)} ly/s`;
          side = HUD.formatBeta(state.beta);
        } else {
          const vms = state.beta * K.c;                 // honest speed, m/s
          const pctC = state.beta * 100;
          main = vms < 1 ? `${vms.toFixed(2)} m/s`
            : vms < 1e3 ? `${vms.toFixed(0)} m/s`
            : vms < 1e6 ? `${(vms / 1e3).toFixed(1)} km/s`
            : `${(vms / 1e6).toFixed(1)} Mm/s`;
          side = pctC < 0.001 ? "0% of light"
            : pctC < 1 ? `${pctC.toFixed(3)}% of light`
            : HUD.formatBeta(state.beta);
        }
        e.beta.textContent = `${main}  ·  ${side}`;
      }
      e.distance.textContent = HUD.formatDistance(state.distanceLy);
      // Felt g-force: honest proper acceleration, however large.
      const fg = state.feltG || 0;
      e.throttle.textContent = fg < 0.005 ? "0 g"
        : fg < 10 ? `${fg.toFixed(2)} g`
        : `${significant(fg)} g`;
      e.throttle.dataset.hot = fg > 20 ? "true" : "false";

      const ism = state.ismWattsPerM2;
      e.ism.textContent = ism < 1 ? `${ism.toFixed(2)} W/m²`
        : ism < 1e6 ? `${significant(ism)} W/m²`
        : `${significant(ism)} W/m²`;
      e.ism.dataset.hot = ism > 1e5 ? "true" : "false";

      const hull = Math.max(0, state.hull);
      e.hull.textContent = `${Math.round(hull * 100)}%`;
      e.hullBar.style.width = `${Math.max(0, Math.min(100, hull * 100))}%`;
      e.hullBar.dataset.level = hull > 0.55 ? "ok" : hull > 0.25 ? "warn" : "bad";

      // CLOSING RATE: how fast YOU are travelling toward the nearest world.
      // Your own velocity along the line of sight, so it is exactly zero when
      // you are parked. It used to quote your speed relative to the body with
      // the body's own orbital motion folded in, which meant a ship sitting
      // perfectly still reported 88 km/s because the planet it was watching was
      // going round its star — a number that told you nothing about whether you
      // were about to hit it.
      if (e.relSpeed) {
        if (!state.relName) {
          if (e.relLabel) e.relLabel.textContent = "Closing on";
          e.relSpeed.textContent = "\u2014 nothing near";
        } else {
          if (e.relLabel) e.relLabel.textContent = `Closing on ${state.relName}`;
          const frac = state.relClosingFrac || 0;
          const closing = state.relClosingLySec || 0;
          const still = Math.abs(closing) < 1e-30;
          const text = state.bubble
            ? (still ? "0 ly/s" : `${significant(Math.abs(closing))} ly/s`)
            : HUD.formatSpeed(state.beta * frac);
          // "\u00b7" for matched: below a metre per second nobody cares about the sign.
          const slow = !state.bubble && Math.abs(state.beta * frac) * K.c < 1;
          const arrow = still || slow ? "\u00b7" : closing > 0 ? "\u2193" : "\u2191";
          e.relSpeed.textContent = `${text} ${arrow}`;
          e.relSpeed.dataset.matched = still || slow ? "true" : "false";
        }
      }

      // The gearbox: which gear is engaged, and that gear's top speed. (These
      // two cells were Gravity and Assist; the arcade drive has neither.)
      const gi = Math.max(0, Math.min(F.gears.length - 1, (state.gear | 0) - 1));
      const gear = F.gears[gi];
      if (e.gravity && gear) {
        e.gravity.textContent = `${gi + 1} · ${gear.name}`;
        // Hot once the gear stops obeying physics, not merely once it is fast.
        e.gravity.dataset.hot = gear.honest ? "false" : "true";
      }
      // The gear's ceiling, quoted the way that gear is meant to be read: the
      // honest ones in the speed they actually reach, the cheating ones in the
      // distance they eat. "9.5e-11 ly/s" means nothing; "900 km/s" is a speed.
      if (e.assist && gear) {
        if (gear.honest) {
          const u = gear.topLySec / F.shipYearsPerSecond;    // proper velocity
          const betaTop = u / Math.sqrt(1 + u * u);
          e.assist.textContent = betaTop > 0.01
            ? `${(betaTop * 100).toFixed(betaTop > 0.98 ? 0 : 1)}% of light`
            : `${((betaTop * K.c) / 1000).toFixed(0)} km/s`;
        } else {
          e.assist.textContent = `${significant(gear.topLySec)} ly/s`;
        }
      }

      const cmbK = state.cmbForwardK;
      e.cmb.textContent = cmbK < 1000 ? `${cmbK.toFixed(1)} K` : `${significant(cmbK)} K`;
      e.cmb.dataset.hot = cmbK > 1500 ? "true" : "false";
    },

    /**
     * The left-hand explainer card. Shown ONCE per session, the first time the
     * player does something the sky reacts to in a way that looks like a bug
     * unless somebody tells you it is physics — the stars draining out of the
     * sky, or the clocks coming apart at lightspeed. It says what is happening
     * and why, then gets out of the way.
     */
    notice(id, title, body) {
      const e = HUD.els;
      if (!e.notice || HUD._noticed.has(id)) return false;
      HUD._noticed.add(id);
      e.noticeTitle.textContent = title;
      e.noticeBody.textContent = body;
      e.notice.hidden = false;
      e.notice.classList.add("on");
      clearTimeout(HUD._noticeTimer);
      HUD._noticeTimer = setTimeout(() => HUD.dismissNotice(), 14000);
      return true;
    },

    dismissNotice() {
      const e = HUD.els;
      if (!e.notice) return;
      e.notice.classList.remove("on");
      clearTimeout(HUD._noticeTimer);
      HUD._noticeTimer = setTimeout(() => { e.notice.hidden = true; }, 400);
    },

    _noticed: new Set(),

    /**
     * The warning lamp. `level` is "" (dark), "fast" (relativistic), "light"
     * (at lightspeed) or "ftl" (past it, physics off).
     */
    setLamp(level, label) {
      const e = HUD.els;
      if (!e.lamp) return;
      if (HUD._lampLevel === level) return;
      HUD._lampLevel = level;
      e.lamp.hidden = !level;
      if (!level) return;
      e.lamp.dataset.level = level;
      e.lampText.textContent = label;
    },

    _lampLevel: null,

    announce(milestone) {
      const e = HUD.els;
      if (!e.milestone) return;
      e.milestoneTitle.textContent = milestone.title;
      e.milestoneNote.textContent = milestone.note || "";
      e.milestone.classList.add("on");
      clearTimeout(HUD._milestoneTimer);
      HUD._milestoneTimer = setTimeout(() => e.milestone.classList.remove("on"), 5200);
    },

    setSoundLabel(on) {
      if (HUD.els.sound) HUD.els.sound.textContent = `sound: ${on ? "on" : "off"}`;
    },

    /**
     * A death notice with the real numbers in it. "Collision with a planet"
     * tells you nothing; "impact with a 1.4 R⊕ temperate world at 99.99% of
     * light, 4.2 seconds of ship time, six minutes back home" tells you what
     * happened and what it cost.
     */
    describeDeath(cause, state) {
      const at = `${HUD.formatBeta(state.beta)}, home clocks running ${HUD.formatTimeFactor(state.gamma)}`;
      const clocks = `Ship time ${HUD.formatYears(state.shipYears)} · home time ${HUD.formatYears(state.homeYears)}.`;
      const travelled = `Distance covered ${HUD.formatDistance(state.distanceLy)}.`;

      if (cause.type === "cmb") {
        return {
          code: "Thermal failure",
          title: "BURNED THROUGH",
          detail: `The microwave background reached ${significant(state.cmbForwardK)} K dead ahead — `
            + `hotter than the surface of the Sun — at ${at}. It was 2.72548 K when you left. ${clocks} ${travelled}`,
        };
      }
      if (cause.type === "ism") {
        return {
          code: "Radiation failure",
          title: "HULL GONE",
          detail: `Interstellar hydrogen at ${significant(state.ismDensity)} atoms/cm³, arriving at `
            + `${significant(SF.rel.protonEnergyMeV(state.gamma) / 1000)} GeV per proton — `
            + `${significant(state.ismWattsPerM2)} W/m² of hard radiation. You flew into a particle beam. ${clocks}`,
        };
      }
      if (cause.type === "horizon") {
        return {
          code: "Geometry",
          title: "THE WALL",
          detail: "Past about 16 billion light-years the space between you and everything else grows "
            + "faster than you can cross it. No engine passes this. It is not a limit of the ship. "
            + `${clocks}`,
        };
      }

      const body = cause.body;
      let what = "something";
      if (body) {
        if (body.kind === "star") {
          const cls = SF.stars.classFor(body.teff);
          what = `a ${Math.round(body.teff).toLocaleString()} K ${cls}-class star`;
        } else if (body.kind === "planet") {
          what = `a ${body.radiusEarth.toFixed(1)} R⊕ ${body.label}`;
        } else if (body.kind === "moon") {
          what = "a moon";
        } else if (body.kind === "comet") {
          what = "a comet";
        } else if (body.kind === "blackhole") {
          return {
            code: "Event horizon",
            title: "INSIDE",
            detail: `You crossed the horizon of a ${significant(body.massSolar)} M☉ black hole — `
              + `${SF.blackhole.describeSize(body.massSolar)} of Schwarzschild radius. `
              + `Nothing that happens next leaves. ${clocks}`,
          };
        }
      }
      return {
        code: "Navigation failure",
        title: "SIGNAL LOST",
        detail: `Impact with ${what} at ${at}. ${clocks} ${travelled}`,
      };
    },

    /** Generated from SF.FUDGE, so it cannot drift out of date. */
    buildLedger() {
      const target = el("ledger-body");
      if (!target) return;
      const sigma = Math.PI * K.rSunLy * K.rSunLy;
      const rows = [
        ["Time", "nothing — one second of play is one second of ship time",
          `This used to be the largest lie in the game: a second of play was 0.4 years of the pilot's life, a hidden ${significant(0.4 * K.year)}× speedup on the one clock the whole thing is about. It is gone. Ship time advances at ${F.shipYearsPerSecond} years per second, which is exactly one second per second, and the gap you watch open between the two clocks is therefore real arithmetic on real elapsed time. Planets orbit at their true Kepler rate for the same reason.`],
        ["Star size", `a Sun-sized star is drawn ${significant(F.starRadiusLy / K.rSunLy)}× too big`,
          `Real solar radius: ${significant(K.rSunLy)} ly. Drawn at ${F.starRadiusLy} ly. Radii are also compressed by a power of ${F.starRadiusExp}, so the real 9,000× spread between an M6 dwarf and Betelgeuse renders as about 24×.`],
        ["Planet size", `Earth is drawn ${significant(F.planetRadiusLy / (K.rEarthM / K.lyM))}× too big`, "Otherwise no planet in the game would ever cover a single pixel."],
        ["Black holes", `the Schwarzschild radius is inflated by roughly ${significant(F.blackHoleRadiusLy / (K.rsPerSolarM * 10 / K.lyM))}×`,
          "A ten-solar-mass hole is 30 km across. The lensing equation, the photon ring at 1.5 r_s, the shadow at 2.598 r_s and the D⁴ beaming are all real — only the scale is not."],
        ["Orbits", `compressed by a power of ${F.orbitExp}`,
          "Earth orbits at 215 solar radii; drawn to scale, the whole solar system would be one pixel wider than the Sun. The ratios between systems survive, which is why M-dwarf systems still come out compact."],
        ["Where systems are", `dropped inside a ${F.corridorRadiusLy} ly corridor`,
          `The gap between them is real — Poisson, exponentially distributed, mean ${(1 / (K.nStarsPerLy3 * Math.PI * F.encounterRadiusLy * F.encounterRadiusLy)).toFixed(1)} ly, which matches the true nearest-neighbour spacing of ${K.meanNeighbourLy.toFixed(1)} ly. Where they sit across the flight path is not: real ones would be scattered through a ${F.encounterRadiusLy} ly disk and you would never meet any of them.`],
        ["Mean free path", `we shortened it by about ${significant(F.trueMeanFreePathLy / 40)}×`,
          `σ = πR☉² = ${significant(sigma)} ly², n = ${K.nStarsPerLy3}/ly³, so ℓ = 1/(nσ) ≈ ${significant(F.trueMeanFreePathLy)} ly. Flying in a straight line through the real galaxy you would cover about 24 quadrillion light-years before hitting a star — roughly a million times the width of the observable universe. Space is so empty that the honest version of this game is unlosable.`],
        ["The drive", `gears 3\u2013${F.gears.length} accelerate harder than anything could; NOTHING here is faster than light`,
          `This is the one that changed. There is no faster-than-light bubble any more and no second physics regime: the same equations run from a standstill to the top gear. Velocity is stored as CELERITY \u2014 home light-years per second of your own life \u2014 so \u03b2 = u/\u221a(1+u\u00b2) never reaches 1 however hard you push, while \u03b3 = \u221a(1+u\u00b2) grows without limit. The top gear is \u03b3 \u2248 1.6\u00d710\u00b9\u00b3 at 99.9999999999% of light, not one metre per second past it. Everything you see follows from that and is real: the aberration cone tightening toward a point, the starlight blueshifting clean out of the visible band so the sky goes black, the microwave background burning ahead of you, and a five-second run to Andromeda costing two and a half million years at home. What is fiction is that ANY of it is survivable \u2014 see the next two rows.`],
        ["The hull", `above ${significant(F.gears.filter((g) => g.honest).reduce((m, g) => Math.max(m, g.topLySec), 0))} ly/s the hull simply does not care`,
          `The readouts stay honest: at \u03b3 = 10\u2076 the panel really does report 10\u2077 K ahead and 10\u2079 W/m\u00b2 on the skin, and that would end you instantly. Below about 99% of light those numbers bite and the walls are real. Above it the hull is openly fiction, whichever gear the lever is in \u2014 that last clause matters, because tying it to the gear meant shifting down out of a high gear switched the hull back on at \u03b3 = 10\u2076 and killed you for moving a lever. Changing gear must never kill you, so the protection is a property of your SPEED and it comes back by itself as you brake down through that threshold.`],
        ["Acceleration", `up to ${significant(F.gears[F.gears.length - 1].topLySec / F.gears[F.gears.length - 1].ramp * K.lyM / K.g0)} g`,
          `The other half of the cheat, and the half the panel never hides. A gear is an acceleration \u2014 its ceiling over its ramp time \u2014 and the felt g-force readout shows the proper acceleration an accelerometer bolted to the ship would really register while it is spooling. Nothing biological survives the high gears for a moment. The number is right there while you do it.`],
        ["Steering", "nothing \u2014 the ship has real momentum",
          `Rotating and thrusting are separate, as they are in vacuum. The arrows turn the NOSE; ${SF.controls ? SF.controls.labelFor("thrustFwd") : "W"} pushes your velocity toward wherever the nose points; ${SF.controls ? SF.controls.labelFor("thrustBack") : "S"} pushes it the other way. Let go of both and you coast forever, which is why you can look around at speed and why there is no speed lock. A GEAR IS AN ACCELERATION, NOT A SPEED: shifting never changes how fast you are going, only how hard the engine can push (its ceiling divided by its ramp time) and how fast it may push you to. Drop into a low gear at speed and you keep every bit of that speed \u2014 the engine simply stops being able to add more. ${SF.controls ? SF.controls.labelFor("killVel") : "B"} is the one autopilot, and the only thing that will stop you from a speed the current gear could never have reached.`],
        ["Orbital rates", `scaled by ${F.orbitRate}× and capped at 0.35 rad/frame`,
          `Planets keep their real relative rates (P = √(a³/M), inner worlds fast) and still speed up when you fly fast — time dilation from outside — but the whole thing is slowed by ${F.orbitRate}× so a parked system is watchable, and the cap stops it strobing backwards through the frame rate at extreme γ.`],
        ["Encounter count", `at most ${F.maxSystems} systems at once`,
          "At γ = 1,000 you meet about fifty systems a second. We sample rather than simulate all of them. Aberration hides most of the difference, since by then the entire sky is crushed into a spot ahead of you."],
      ];

      target.innerHTML = "";
      for (const [name, claim, detail] of rows) {
        const row = document.createElement("div");
        row.className = "ledger-row";
        const h = document.createElement("h3");
        h.textContent = name;
        const c = document.createElement("p");
        c.className = "claim";
        c.textContent = claim;
        const d = document.createElement("p");
        d.className = "detail";
        d.textContent = detail;
        row.append(h, c, d);
        target.appendChild(row);
      }
    },
  };
})();
