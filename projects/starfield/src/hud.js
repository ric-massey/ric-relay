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
        milestone: el("milestone"),
        milestoneTitle: el("milestone-title"),
        milestoneNote: el("milestone-note"),
        readout: el("readout"),
        sound: el("sound"),
      };
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

    update(state) {
      const e = HUD.els;
      if (!e.shipTime) return;
      e.shipTime.textContent = HUD.formatYears(state.shipYears);
      e.homeTime.textContent = HUD.formatYears(state.homeYears);
      e.gamma.textContent = HUD.formatTimeFactor(state.gamma);
      e.beta.textContent = HUD.formatBeta(state.beta);
      e.distance.textContent = HUD.formatDistance(state.distanceLy);
      e.throttle.textContent = state.bubble
        ? "FTL JUMP"
        : `${state.throttle >= 0 ? "" : "−"}${Math.abs(state.throttle).toFixed(2)} g`;

      const ism = state.ismWattsPerM2;
      e.ism.textContent = ism < 1 ? `${ism.toFixed(2)} W/m²`
        : ism < 1e6 ? `${significant(ism)} W/m²`
        : `${significant(ism)} W/m²`;
      e.ism.dataset.hot = ism > 1e5 ? "true" : "false";

      const hull = Math.max(0, state.hull);
      e.hull.textContent = `${Math.round(hull * 100)}%`;
      e.hullBar.style.width = `${Math.max(0, Math.min(100, hull * 100))}%`;
      e.hullBar.dataset.level = hull > 0.55 ? "ok" : hull > 0.25 ? "warn" : "bad";

      const cmbK = state.cmbForwardK;
      e.cmb.textContent = cmbK < 1000 ? `${cmbK.toFixed(1)} K` : `${significant(cmbK)} K`;
      e.cmb.dataset.hot = cmbK > 1500 ? "true" : "false";
    },

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
        ["Time", `up to 1 second of play = ${F.shipYearsPerSecond} years of ship time`,
          `Parked, the sim runs near real-time so you can watch a planet orbit; it ramps to the full ${F.shipYearsPerSecond} yr/s only once you pass about 0.1c, so interstellar cruising stays quick. A 1 g burn to the edge of the observable universe takes 24.5 years — at full compression, about a minute. Peak compression ≈ ${significant(F.shipYearsPerSecond * K.year)}×.`],
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
        ["Steering", "the ship flies where its nose points",
          `A real ship keeps its old velocity when it turns. This one bleeds velocity toward the nose at a rate of a/(γβ), which is the real transverse-acceleration suppression — so you genuinely cannot turn at high speed — but the two vectors are more tightly coupled than physics requires. The green heading dot shows the difference: the crosshair is where the nose points, the dot is where you are actually going.`],
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
