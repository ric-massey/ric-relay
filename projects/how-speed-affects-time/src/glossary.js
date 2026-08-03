/* ══════════════════════════════════════════════════════════════════════
   glossary.js — every technical word on this page, defined in one place.

   The rule the exhibit is built on: no technical term ever appears without
   being clickable. If a word cannot be defined in two sentences, it does not
   belong on the front page at all.

   The good part is `live`. When a definition has a runtime value, the
   popover shows it *at the visitor's current speed*, and it keeps updating
   if they move the slider while it is open. This is not a reference
   appendix bolted on the side — it reads the simulator.

   Voice: second person, plain language, no term defined using another
   undefined term. No "simply", no "just", no "of course". A hedge inside a
   two-sentence popover reads as evasion, so caveats go elsewhere.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";

  const TERMS = {
    /* ── Speed and time ─────────────────────────────────────────────── */
    "speed-of-light": {
      label: "Speed of light (c)",
      short: "299,792,458 metres per second. Not really a property of light — it is the universe's speed limit, which light happens to travel at.",
    },
    "beta": {
      label: "β (beta)",
      short: "Your speed written as a fraction of light speed. β = 0.9 means you are going 90% of the speed of light.",
      live: "beta",
    },
    "lorentz-factor": {
      label: "Lorentz factor (γ)",
      short: "The number that says how much faster Earth's clock runs than yours. At γ = 7, seven seconds pass at home for every one of yours.",
      formula: "γ = 1 / √(1 − β²)",
      live: "gamma",
    },
    "proper-time": {
      label: "Proper time",
      short: "The time measured by a clock that travels with you. It is what your watch reads, and it never behaves strangely.",
      live: "tau",
    },
    "coordinate-time": {
      label: "Coordinate time",
      short: "The time measured by clocks that stayed behind. It is what Earth reads while you are gone.",
      formula: "t_Earth = ∫ γ dτ",
      live: "t_earth",
    },
    "time-dilation": {
      label: "Time dilation",
      short: "Two clocks moving relative to each other do not agree about how much time has passed. Neither one is broken.",
    },
    "reference-frame": {
      label: "Reference frame",
      short: "A point of view, along with the rulers and clocks that go with it. Yours and Earth's are different, and that is the whole story.",
    },
    "inertial-frame": {
      label: "Inertial frame",
      short: "A point of view that is not accelerating. Coasting counts; turning around does not.",
    },
    "reciprocity": {
      label: "Reciprocity",
      short: "Earth measures your clock as running slow, and you measure Earth's the same way. Both are right, and it stays that way until someone turns around.",
    },
    "twin-paradox": {
      label: "Twin paradox",
      short: "One twin travels and comes back younger than the one who stayed. Not a paradox — only the traveler changed reference frames, and of two paths between the same meetings the unaccelerated one always ages more.",
    },
    "length-contraction": {
      label: "Length contraction",
      short: "From your point of view the journey is genuinely shorter, because space itself is squashed along your direction of travel.",
      live: "L_contract",
    },
    "simultaneity": {
      label: "Relativity of simultaneity",
      short: "Two events that happen at the same moment for one observer happen at different moments for another. There is no universal “now”.",
    },

    /* ── Light and seeing ───────────────────────────────────────────── */
    "doppler-factor": {
      label: "Doppler factor (D)",
      short: "How much the light reaching you is squeezed or stretched by your motion. Ahead it is squeezed and looks bluer; behind it is stretched and looks redder.",
      formula: "D = 1 / [ γ (1 − β cos θ) ]",
      live: "D_ahead",
    },
    "blueshift": {
      label: "Blueshift",
      short: "Light squeezed toward shorter wavelengths. What you see when you run into it.",
    },
    "redshift": {
      label: "Redshift",
      short: "Light stretched toward longer wavelengths. What you see when you run away from it.",
    },
    "aberration": {
      label: "Aberration",
      short: "Your motion changes the direction light appears to arrive from, so the stars crowd together ahead of you. It is the same reason you tilt an umbrella forward when running through vertical rain.",
      formula: "tan(θ′/2) = √((1−β)/(1+β)) · tan(θ/2)",
      live: "cone_angle",
    },
    "beaming": {
      label: "Relativistic beaming",
      short: "The light ahead of you does not only look bluer, it looks brighter — enormously so. At 0.99 c each star ahead is about two hundred times brighter, and the Milky Way's surface about forty thousand times, per patch of sky. The two differ because a star is a point and the band is not: a point has no disc left to shrink.",
      formula: "star ∝ D²   ·   surface ∝ D⁴",
      live: "D4",
    },
    "point-spread-function": {
      label: "Point spread function",
      short: "The small smudge a single point of light makes on your retina. It is why stars look like tiny discs with a faint halo instead of mathematical points.",
    },
    "arcminute": {
      label: "Arcminute",
      short: "An angle too small for degrees — one sixtieth of one. A full Moon is about 30 arcminutes across.",
    },
    "light-second": {
      label: "Light-second",
      short: "How far light travels in one second: about 300,000 km, or most of the way to the Moon. It is a distance, not a time.",
    },

    /* ── Stars and colour ───────────────────────────────────────────── */
    "blackbody": {
      label: "Blackbody",
      short: "Something that glows purely because it is hot, with a colour set only by its temperature. Stars are close enough to this that you can predict their colour from their heat.",
    },
    "effective-temperature": {
      label: "Effective temperature",
      short: "The temperature a plain hot object would need to glow as fiercely as the star does — near enough its surface temperature, and what sets its colour. Cool stars are red and hot ones blue, the opposite of the kitchen-tap convention.",
    },
    "colour-index": {
      label: "Colour index (B−V)",
      short: "A measured number comparing how bright a star looks in blue light against yellow-green light. It is how astronomers get a star's temperature without visiting.",
      formula: "T = 4600 K × [ 1/(0.92(B−V)+1.7) + 1/(0.92(B−V)+0.62) ]",
    },
    "apparent-magnitude": {
      label: "Apparent magnitude",
      short: "How bright a star looks from here. The scale runs backwards: smaller numbers are brighter, and each step of 1 is about 2.5 times.",
    },
    "spectrum": {
      label: "Spectrum",
      short: "The full spread of a star's light across all wavelengths, most of which your eyes cannot see. Your motion slides the visible window across it.",
    },
    "infrared": {
      label: "Infrared",
      short: "Light too long-waved for your eyes. At high speed a star's infrared gets squeezed into the visible band — so what you see ahead is its heat glow.",
    },
    "ultraviolet": {
      label: "Ultraviolet",
      short: "Light too short-waved for your eyes. Looking backward at high speed, a star's ultraviolet gets stretched down into view.",
    },
    "cmb": {
      label: "Cosmic microwave background",
      short: "The leftover glow of the Big Bang, filling all of space at 2.7 degrees above absolute zero. Normally invisible microwaves — until you go fast enough to squeeze it into visible light.",
      live: "T_cmb",
    },

    /* ── Your eyes ──────────────────────────────────────────────────── */
    "dark-adaptation": {
      label: "Dark adaptation",
      short: "The 20 to 30 minutes your eyes take to reach full sensitivity in the dark. It is why the sky keeps getting richer the longer you look.",
    },
    "scotopic": {
      label: "Scotopic vision",
      short: "Night vision, using your rod cells. Sensitive enough to catch single photons, and completely colourblind.",
    },
    "scintillation": {
      label: "Scintillation",
      short: "Twinkling. It is caused entirely by Earth's atmosphere, so in space the stars are perfectly steady.",
    },

    /* ── Energy ─────────────────────────────────────────────────────── */
    "kinetic-energy": {
      label: "Kinetic energy",
      short: "The energy of motion. Near light speed it climbs without limit, which is exactly why you can never arrive at c.",
      formula: "KE = (γ − 1) m c²",
      live: "KE",
    },
    "momentum": {
      label: "Momentum",
      short: "Mass times velocity, adjusted for relativity. Unlike speed it has no ceiling — you can push forever and it keeps growing.",
      formula: "p = γ m v",
      live: "p",
    },
    "rest-energy": {
      label: "Rest energy",
      short: "The energy something has purely for existing, with no motion at all. One kilogram of anything holds about 9 × 10¹⁶ joules.",
      formula: "E₀ = m c²",
    },
  };

  /* ── The popover ─────────────────────────────────────────────────────
     Click or tap, never hover. Hover tooltips fail on every touch device
     and on keyboard navigation, and they are the most common accessibility
     failure in exhibits like this one.

     One at a time. Opening a second closes the first — a stack of popovers
     is a bug wearing a feature's clothes. */

  let node = null, current = null, anchor = null, liveTimer = null;
  let valueSource = () => ({});

  function build() {
    if (node) return node;
    node = document.createElement("div");
    node.className = "term-popover";
    node.setAttribute("role", "dialog");
    node.setAttribute("aria-modal", "false");
    node.hidden = true;
    node.innerHTML =
      '<button class="term-close" aria-label="Close definition">×</button>' +
      '<h3 class="term-label"></h3>' +
      '<p class="term-short"></p>' +
      '<p class="term-live" hidden></p>' +
      '<p class="term-formula" hidden></p>';
    node.querySelector(".term-close").addEventListener("click", close);
    document.body.appendChild(node);
    return node;
  }

  function open(key, el) {
    const entry = TERMS[key];
    if (!entry) return;
    if (current === key) { close(); return; }
    build();
    current = key; anchor = el;

    node.querySelector(".term-label").textContent = entry.label;
    node.querySelector(".term-short").textContent = entry.short;
    const f = node.querySelector(".term-formula");
    f.textContent = entry.formula || "";
    f.hidden = !entry.formula;
    node.hidden = false;
    node.setAttribute("aria-label", entry.label);

    refreshLive();
    position();
    node.querySelector(".term-close").focus();

    document.addEventListener("keydown", onKey, true);
    setTimeout(() => document.addEventListener("pointerdown", onOutside, true), 0);
    if (!liveTimer) liveTimer = setInterval(refreshLive, 200);
  }

  function refreshLive() {
    if (!current || !node || node.hidden) return;
    const entry = TERMS[current];
    const el = node.querySelector(".term-live");
    if (!entry.live) { el.hidden = true; return; }
    const values = valueSource() || {};
    const v = values[entry.live];
    if (v === undefined || v === null) { el.hidden = true; return; }
    el.textContent = "Right now: " + v;
    el.hidden = false;
  }

  function position() {
    if (!anchor || !node) return;
    // On a phone the popover is a bottom sheet, laid out by CSS. Anchoring a
    // panel to a word at 375px wide produces something unusable.
    if (window.matchMedia("(max-width: 720px)").matches) {
      node.style.left = ""; node.style.top = "";
      return;
    }
    const r = anchor.getBoundingClientRect();
    const w = Math.min(340, window.innerWidth - 24);
    node.style.width = w + "px";
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(12, Math.min(window.innerWidth - w - 12, left));
    const h = node.offsetHeight || 160;
    let top = r.bottom + 10;
    if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 10);
    node.style.left = left + "px";
    node.style.top = top + "px";
  }

  function close() {
    if (!node || node.hidden) return;
    node.hidden = true;
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", onOutside, true);
    if (liveTimer) { clearInterval(liveTimer); liveTimer = null; }
    if (anchor && anchor.focus) anchor.focus();
    current = null; anchor = null;
  }

  function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }
  function onOutside(e) {
    if (node.contains(e.target)) return;
    if (anchor && anchor.contains(e.target)) return;
    close();
  }

  /* Turn every <dfn data-term> into a real button, so it lands in the tab
     order and announces itself instead of being a decorated span. */
  function install(root) {
    (root || document).querySelectorAll("dfn[data-term]").forEach((dfn) => {
      if (dfn.dataset.wired) return;
      dfn.dataset.wired = "1";
      const key = dfn.dataset.term;
      const entry = TERMS[key];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "term";
      btn.textContent = dfn.textContent;
      btn.setAttribute("aria-label",
        dfn.textContent + " — what this means" + (entry ? "" : " (undefined term)"));
      btn.addEventListener("click", () => open(key, btn));
      dfn.replaceWith(btn);
      if (!entry && window.console) {
        console.warn("[glossary] no entry for term:", key);
      }
    });
    window.addEventListener("resize", () => { if (current) position(); });
    window.addEventListener("scroll", () => { if (current) position(); }, { passive: true });
  }

  window.HSAT_GLOSSARY = {
    TERMS, install, open, close,
    setValueSource(fn) { valueSource = fn; },
  };
})();
