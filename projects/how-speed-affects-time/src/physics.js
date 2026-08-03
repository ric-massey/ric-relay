/* ══════════════════════════════════════════════════════════════════════
   physics.js — special relativity, written out plainly.

   Every number the exhibit shows comes from this file. There is no fudge
   factor and no tuned constant anywhere in it; if something on screen looks
   strange, it is because the universe is.

   Two things are worth knowing before reading:

   1. The traveler's clock is the visitor's real device clock. Proper time is
      not simulated. Earth's clock is the calculated one.

   2. Earth's elapsed time along the traveler's path is ∫γ dτ, and that
      integral is exact for *any* speed history — including the ramps where
      the ship speeds up and slows down. So the exhibit does not have to
      pretend the acceleration is instantaneous to stay honest. It just adds
      up γ·dτ every frame, and the answer is right.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const C = 299792458;  // m/s, exact by definition of the metre

  const gamma = (beta) => 1 / Math.sqrt(1 - beta * beta);

  /* Doppler factor for light arriving from angle θ′, measured in the
     traveler's frame, 0 = dead ahead. */
  const doppler = (beta, cosThetaPrime) =>
    1 / (gamma(beta) * (1 - beta * cosThetaPrime));

  const dopplerAhead = (beta) => Math.sqrt((1 + beta) / (1 - beta));
  const dopplerBehind = (beta) => Math.sqrt((1 - beta) / (1 + beta));

  /* Relativistic aberration, in the half-angle form.

     The cosine form, cos θ′ = (cos θ + β)/(1 + β cos θ), is algebraically
     identical and numerically useless here: it loses precision near θ = 0,
     which at high γ is where every star in the sky has ended up. The
     half-angle form is stable across the whole range, and it hands back
     tan(θ′/2) — exactly the quantity the tangent-plane projection wants.

     The sign is worth a sentence, because most textbooks print the minus.
     They measure θ along the photon's direction of travel; this exhibit
     measures it toward the source — "light reaching you from angle θ" — and
     the two conventions are supplements of each other. Under the minus form
     θ = 90° at β = 0.7771 comes out at 141°, not 39°, which is the same
     answer pointed the wrong way down the sky. */
  const aberrationK = (beta) => Math.sqrt((1 - beta) / (1 + beta));

  /* Angular radius of the cone the forward hemisphere collapses into.
     Approximately 1/γ radians at high speed; this is the exact figure. */
  function forwardHemisphereRadius(beta) {
    // θ = 90° maps to θ′ where tan(θ′/2) = k · tan(45°) = k
    return 2 * Math.atan(aberrationK(beta));
  }

  /* Fraction of the sphere subtended by a cone of half-angle a. This is how
     big the cone *looks*, which is not the same thing as how much sky is in
     it — see below. */
  const skyFractionInside = (a) => (1 - Math.cos(a)) / 2;

  /* How much of the whole sky has been squeezed inside a *cone* of apparent
     half-angle a′. Aberration is run backwards to find where that light
     started out, and it is the starting solid angle that answers "how much
     of the universe can I see from here."

     At β = 0.7771 and a′ = 39° this returns exactly 0.5. That is a true
     statement about a 78°-wide circle and it is not the statement this
     exhibit needs, because the frame is a rectangle — see below. */
  function skyFractionInFrame(beta, aPrime) {
    const t = Math.tan(aPrime / 2) / aberrationK(beta);
    const theta = 2 * Math.atan(t);
    return (1 - Math.cos(theta)) / 2;
  }

  /* The same question asked about the shape the visitor is actually looking
     through: a rectangle, 49° tall and as wide as the window is.

     This used to be answered with the cone above, at a hardcoded 39°, and it
     was wrong twice over. A 78° × 49° rectangle is a good deal smaller than
     the 78°-wide circle that would contain it, so the figure was too generous
     — 50% where the truth is 40.9%. And because 39° was a constant while the
     prose elsewhere derived its own half-width from the live aspect ratio, the
     two readouts disagreed with each other on the same page: on a phone held
     upright the frame is barely 29° wide and holds 20.7% of the sky, while the
     equation sheet went on insisting it was half.

     There is no closed form for a rectangle, so it is integrated. In the
     tangent plane about the view axis a direction (a, b) has

         cos θ′ = 1 / √(1 + a² + b²),   dΩ′ = da db / (1 + a² + b²)^(3/2)

     and aberration compresses solid angle by exactly D², so the rest-frame
     solid angle behind the frame is ∫∫ D² dΩ′. Quarter-symmetric midpoint
     rule; the integrand is smooth and bounded, and 96 steps per axis is
     converged to well past the two decimals anything prints.

     One consequence worth stating out loud: 0.7771 c stops being a special
     speed. On a 16:9 window half the sky arrives at 0.8428 c instead, and on
     any other window shape at some other speed entirely. The old number was
     only ever the answer to the circle. */
  const RECT_N = 96;

  function skyFractionInRect(beta, halfW, halfV) {
    const g = gamma(beta);
    const A = Math.tan(halfW), B = Math.tan(halfV);
    const da = A / RECT_N, db = B / RECT_N;
    let sum = 0;
    for (let i = 0; i < RECT_N; i++) {
      const a = (i + 0.5) * da;
      const a2 = a * a;
      for (let j = 0; j < RECT_N; j++) {
        const b = (j + 0.5) * db;
        const r2 = 1 + a2 + b * b;
        const invR = 1 / Math.sqrt(r2);
        const D = 1 / (g * (1 - beta * invR));
        sum += D * D * invR / r2;
      }
    }
    // ×4 for the three quadrants the loop skipped, ÷4π to make it a fraction.
    return sum * da * db / Math.PI;
  }

  /* The frame's own half-width, given how wide the window turned out to be.
     The vertical is locked at 49° by the renderer and the horizontal follows
     from it, so this is the one place the window's shape enters the physics. */
  const HALF_V = 49 * Math.PI / 360;
  const frameHalfWidth = (aspect) => Math.atan(aspect * Math.tan(HALF_V));

  /* Kinetic energy of a mass m at β, in joules. Modern formulation —
     no "relativistic mass" anywhere in this exhibit (Okun 2009). */
  const kineticEnergy = (beta, m = 1) => (gamma(beta) - 1) * m * C * C;
  const restEnergy = (m = 1) => m * C * C;
  const momentum = (beta, m = 1) => gamma(beta) * m * beta * C;

  /* ── The speed ladder ────────────────────────────────────────────────
     §5 of the blueprint. Two of these detents are not round numbers and
     are not there for the number:

       0.7771  the speed at which the forward hemisphere collapses into a
               cone 78° across — the width of the frame on a 16:9 window
       0.99998 the speed at which the microwave background reaches ~862 K
               and the sky ahead starts to glow

     Both are computed, not chosen. The label is the point; the number is
     just where the thing happens.

     The first one used to be labelled "half the universe, one frame", and it
     was not. 78° across is the *cone's* width, and a cone of that width holds
     half the sky; the frame is a rectangle only 49° tall, so it catches 40.9%
     of it and not 50%. Half the sky arrives at 0.8428 c on a 16:9 window —
     and at some other speed on any other window, which is exactly why that is
     a live readout in the equation sheet and not a rung here. */
  const LADDER = [
    { beta: 1.4 / C,        label: "walking",   note: "3.1 mph" },
    { beta: 44.7 / C,       label: "highway",   note: "100 mph" },
    { beta: 250 / C,        label: "airliner",  note: "559 mph" },
    { beta: 7660 / C,       label: "ISS",       note: "17,100 mph — this one is measured" },
    { beta: 17000 / C,      label: "Voyager 1", note: "38,000 mph" },
    { beta: 192000 / C,     label: "Parker",    note: "429,500 mph — the fastest object we have built" },
    { beta: 0.1,            label: "0.1 c",     note: "" },
    { beta: 0.5,            label: "0.5 c",     note: "" },
    { beta: 0.7771,         label: "0.7771 c",  note: "everything ahead now spans the width of the view" },
    { beta: 0.9,            label: "0.9 c",     note: "" },
    { beta: 0.99,           label: "0.99 c",    note: "" },
    { beta: 0.999,          label: "0.999 c",   note: "" },
    { beta: 0.9999,         label: "0.9999 c",  note: "" },
    { beta: 0.99998,        label: "0.99998 c", note: "the sky ahead begins to glow" },
    { beta: 0.99999,        label: "0.99999 c", note: "" },
    { beta: 0.999999,       label: "0.999999 c", note: "" },
  ];

  /* ── Slider mapping ──────────────────────────────────────────────────
     No single linear ratio works for a rail that begins below walking pace
     and ends one millionth short of light speed. The old control used only
     log(1 − β); that served the fast end but crushed walking, aircraft and
     every spacecraft into the first pixel.

     This rail has three continuous pieces:

       0 → 30%    logarithmic speed, from 0.03 m/s to 0.1 c
      30 → 46%    the readable middle, 0.1 c to 0.9 c
      46 → 100%   logarithmic distance remaining to c

     It is one curve to the visitor, but each physical scale gets enough
     room to use. s = 0 is exactly rest; s = 1 is β = 0.999999.

     The split used to be 56/74, which gave the whole relativistic end — every
     bit of this exhibit anybody came to see — the last quarter of the rail.
     Five decades of (1 − β) in a couple of hundred pixels meant a millimetre
     of mouse doubled γ, and there was no way to settle on a speed up there;
     the thumb went where it liked.

     The room came from the bottom. Nine decades from walking pace to a tenth
     of light speed used to take more than half the rail, and across all of it
     the sky is *identical* — aberration at Parker Solar Probe speed is a
     ten-thousandth of a degree. That half-rail was buying nothing you could
     see. The labelled rungs down there are still exactly reachable, because
     reaching them was always the chips' job rather than the thumb's. */
  const S_LOW_END = 0.30;
  const S_MID_END = 0.46;
  const BETA_LOG_MIN = 1e-10;
  const BETA_LOW_END = 0.1;
  const BETA_MID_END = 0.9;
  const ONE_MINUS_BETA_MIN = 1e-6;

  function sliderToBeta(s) {
    if (s <= 0) return 0;
    if (s < S_LOW_END) {
      const t = s / S_LOW_END;
      return Math.pow(10,
        Math.log10(BETA_LOG_MIN) +
        (Math.log10(BETA_LOW_END) - Math.log10(BETA_LOG_MIN)) * t);
    }
    if (s < S_MID_END) {
      const t = (s - S_LOW_END) / (S_MID_END - S_LOW_END);
      return BETA_LOW_END + (BETA_MID_END - BETA_LOW_END) * t;
    }
    const t = (s - S_MID_END) / (1 - S_MID_END);
    const oneMinus = Math.pow(10,
      Math.log10(1 - BETA_MID_END) +
      (Math.log10(ONE_MINUS_BETA_MIN) - Math.log10(1 - BETA_MID_END)) * t);
    return 1 - oneMinus;
  }

  function betaToSlider(beta) {
    if (beta <= 0) return 0;
    if (beta < BETA_LOW_END) {
      const t = (Math.log10(Math.max(BETA_LOG_MIN, beta)) - Math.log10(BETA_LOG_MIN)) /
        (Math.log10(BETA_LOW_END) - Math.log10(BETA_LOG_MIN));
      return Math.max(0, Math.min(S_LOW_END, t * S_LOW_END));
    }
    if (beta < BETA_MID_END) {
      const t = (beta - BETA_LOW_END) / (BETA_MID_END - BETA_LOW_END);
      return S_LOW_END + t * (S_MID_END - S_LOW_END);
    }
    const oneMinus = Math.max(ONE_MINUS_BETA_MIN, 1 - beta);
    const t = (Math.log10(oneMinus) - Math.log10(1 - BETA_MID_END)) /
      (Math.log10(ONE_MINUS_BETA_MIN) - Math.log10(1 - BETA_MID_END));
    return Math.max(S_MID_END, Math.min(1, S_MID_END + t * (1 - S_MID_END)));
  }

  /* ── Formatting ──────────────────────────────────────────────────────── */

  function formatBeta(beta) {
    if (beta === 0) return "at rest";
    const v = beta * C;
    if (beta < 1e-3) {
      const mph = v * 2.2369362920544;
      if (mph < 10) return mph.toFixed(1) + " mph";
      return Math.round(mph).toLocaleString() + " mph";
    }
    if (beta >= 0.99) {
      // Show every nine. Rounding 0.999999 to "1.00 c" would be a lie in the
      // one place the exhibit cannot afford one.
      const s = beta.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
      return s + " c";
    }
    return beta.toFixed(4).replace(/0+$/, "").replace(/\.$/, "") + " c";
  }

  function formatGamma(g) {
    if (g === 1) return "1";
    if (g < 1.000001) {
      // At walking pace γ − 1 is around 10⁻¹⁷ and "1.00" says nothing. Show
      // the excess instead, which is the only part that is not 1.
      const excess = g - 1;
      if (excess < 1e-15) return "1 + " + excess.toExponential(1);
      return g.toPrecision(16).replace(/0+$/, "");
    }
    if (g < 10) return g.toFixed(4);
    if (g < 1000) return g.toFixed(2);
    return Math.round(g).toLocaleString();
  }

  /* Human-readable duration. Deliberately not "4.7 years" — the exhibit is
     about a gap you can feel, and 4 years 260 days lands harder. */
  function formatDuration(seconds, opts) {
    const brief = opts && opts.brief;
    if (!isFinite(seconds)) return "—";
    const neg = seconds < 0;
    let s = Math.abs(seconds);
    if (s < 1e-6) return (neg ? "−" : "") + (s * 1e9).toFixed(1) + " ns";
    if (s < 1e-3) return (neg ? "−" : "") + (s * 1e6).toFixed(1) + " µs";
    if (s < 1) return (neg ? "−" : "") + (s * 1e3).toFixed(0) + " ms";

    const YEAR = 365.25 * 86400;
    const parts = [];
    const years = Math.floor(s / YEAR);
    if (years > 0) { parts.push(fmtUnit(years, "year")); s -= years * YEAR; }
    const days = Math.floor(s / 86400);
    if (days > 0 && parts.length < 2) { parts.push(fmtUnit(days, "day")); }
    s -= days * 86400;
    if (parts.length < 2) {
      const h = Math.floor(s / 3600); s -= h * 3600;
      const m = Math.floor(s / 60); s -= m * 60;
      if (h > 0) parts.push(fmtUnit(h, "hour"));
      if (parts.length < 2 && m > 0) parts.push(fmtUnit(m, "min", true));
      if (parts.length < 2 && years === 0 && days === 0) {
        parts.push(s.toFixed(brief ? 0 : 1) + " sec");
      }
    }
    if (!parts.length) parts.push("0 sec");
    return (neg ? "−" : "") + parts.slice(0, 2).join(" ");
  }

  function fmtUnit(n, word, noPlural) {
    const label = n === 1 || noPlural ? word : word + "s";
    return n.toLocaleString() + " " + label;
  }

  /* Distance, carried in light-seconds because that is the unit the trip is
     actually measured in — and because it makes the return leg's arithmetic
     a subtraction rather than a conversion. */
  function formatDistance(lightSeconds) {
    const ls = Math.abs(lightSeconds);
    if (ls < 1) return (ls * 1000).toFixed(0) + " light-ms";
    if (ls < 60) return ls.toFixed(2) + " light-seconds";
    if (ls < 3600) return (ls / 60).toFixed(2) + " light-minutes";
    if (ls < 86400) return (ls / 3600).toFixed(2) + " light-hours";
    if (ls < 365.25 * 86400) return (ls / 86400).toFixed(2) + " light-days";
    return (ls / (365.25 * 86400)).toFixed(3) + " light-years";
  }

  /* The live distance readout stays in familiar Earth-road units. Large
     values are abbreviated so the number remains readable while the ship is
     moving at relativistic speed. */
  function formatMiles(lightSeconds) {
    const miles = Math.abs(lightSeconds) * C / 1609.344;
    if (miles < 10) return miles.toFixed(2) + " miles";
    if (miles < 1000) return miles.toFixed(1) + " miles";
    if (miles < 1e6) return Math.round(miles).toLocaleString() + " miles";
    if (miles < 1e9) return (miles / 1e6).toFixed(2) + " million miles";
    if (miles < 1e12) return (miles / 1e9).toFixed(2) + " billion miles";
    return (miles / 1e12).toFixed(2) + " trillion miles";
  }

  window.HSAT_PHYSICS = {
    C, gamma, doppler, dopplerAhead, dopplerBehind,
    aberrationK, forwardHemisphereRadius, skyFractionInside, skyFractionInFrame,
    skyFractionInRect, frameHalfWidth,
    kineticEnergy, restEnergy, momentum,
    LADDER, sliderToBeta, betaToSlider,
    formatBeta, formatGamma, formatDuration, formatDistance, formatMiles,
  };
})();
