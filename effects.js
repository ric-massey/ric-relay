// Site-wide visual modes. Activated from the Relay terminal and persisted between rooms.
(() => {
  if (window.RELAY_EFFECTS) return;

  const STORAGE_KEY = "ric-relay-effect";
  const CAT_STORAGE_KEY = "ric-relay-cats";
  const CAT_FRAMES = Object.fromEntries(Object.entries({
    walk: ["relay-cat.png", "relay-cat-walk-2.png", "relay-cat-walk-3.png"],
    sit: ["relay-cat-sit.png", "relay-cat-sit-2.png", "relay-cat-sit-3.png"],
    loaf: ["relay-cat-loaf.png", "relay-cat-loaf-2.png", "relay-cat-loaf-3.png"],
    groom: ["relay-cat-groom.png", "relay-cat-groom-2.png", "relay-cat-groom-3.png"],
    look: ["relay-cat-look.png", "relay-cat-look-2.png", "relay-cat-look-3.png"],
    peek: ["relay-cat-peek.png", "relay-cat-peek-2.png", "relay-cat-peek-3.png"],
    stretch: ["relay-cat-stretch.png", "relay-cat-stretch-2.png", "relay-cat-stretch-3.png"],
    top: ["relay-cat-top.png", "relay-cat-top-2.png", "relay-cat-top-3.png"],
    diagonalNear: ["relay-cat-diagonal-near-1.png", "relay-cat-diagonal-near-2.png", "relay-cat-diagonal-near-3.png"],
    diagonalAway: ["relay-cat-diagonal-away-1.png", "relay-cat-diagonal-away-pass.png", "relay-cat-diagonal-away-stride.png"],
    turnNear: ["relay-cat.png", "relay-cat-turn-near-1.png", "relay-cat-turn-near-2.png", "relay-cat-diagonal-near-1.png"],
    turnAway: ["relay-cat.png", "relay-cat-turn-away-1.png", "relay-cat-turn-away-2.png", "relay-cat-diagonal-away-1.png"],
    settle: ["relay-cat-settle-start.png", "relay-cat-settle-bridge-1.png", "relay-cat-settle-2.png", "relay-cat-settle-bridge-2.png", "relay-cat-sit.png"],
    swat: ["relay-cat-feather-anticipate-1.png", "relay-cat-feather-anticipate-2.png", "relay-cat-feather-swat-1.png", "relay-cat-feather-swat-2.png", "relay-cat-swat-recover-1.png", "relay-cat-swat-recover-2.png"],
    emerge: ["relay-cat-emerge.png", "relay-cat.png"],
    run: ["relay-cat.png", "relay-cat-emerge.png", "relay-cat-run.png"],
    spaceFloat: ["relay-cat-space-float-1.png", "relay-cat-space-float-2.png", "relay-cat-space-float-3.png"],
    spaceDrift: ["relay-cat-space-drift-1.png", "relay-cat-space-drift-2.png", "relay-cat-space-drift-3.png"],
    spaceCurl: ["relay-cat-space-curl-1.png", "relay-cat-space-curl-2.png", "relay-cat-space-curl-3.png"],
    spaceReach: ["relay-cat-space-reach-1.png", "relay-cat-space-reach-2.png", "relay-cat-space-reach-3.png"],
  }).map(([pose, files]) => [pose, files.map((file) => new URL(`assets/${file}`, document.currentScript?.src || location.href).href)]));
  const CAT_FRAME_Y = {
    "relay-cat-walk-2.png": -.2,
    "relay-cat-walk-3.png": -1.04,
    "relay-cat-sit-2.png": .42,
    "relay-cat-sit-3.png": -1.04,
    "relay-cat-peek-2.png": .625,
    "relay-cat-peek-3.png": 1.875,
    "relay-cat-stretch.png": -1.46,
    "relay-cat-stretch-2.png": .625,
    "relay-cat-top.png": .42,
    "relay-cat-top-2.png": -1.39,
    "relay-cat-diagonal-near-2.png": -.625,
    "relay-cat-diagonal-near-3.png": 1.46,
    "relay-cat-diagonal-away-pass.png": 4.8,
    "relay-cat-diagonal-away-stride.png": -.2,
    "relay-cat-feather-anticipate-1.png": -.625,
    "relay-cat-feather-anticipate-2.png": -5.2,
    "relay-cat-feather-swat-1.png": -8.54,
    "relay-cat-feather-swat-2.png": -7.5,
    "relay-cat-swat-recover-1.png": -6.875,
    "relay-cat-swat-recover-2.png": 4.79,
    "relay-cat-space-float-1.png": .31,
    "relay-cat-space-float-2.png": -.625,
    "relay-cat-space-float-3.png": -.52,
    "relay-cat-space-drift-1.png": -.21,
    "relay-cat-space-drift-2.png": -.21,
    "relay-cat-space-drift-3.png": -.52,
    "relay-cat-space-curl-1.png": 3.85,
    "relay-cat-space-curl-2.png": 3.85,
    "relay-cat-space-curl-3.png": 3.44,
    "relay-cat-space-reach-2.png": -.1,
    "relay-cat-space-reach-3.png": -.1,
  };
  const CAT_FRAME_X = {
    "relay-cat-walk-2.png": 1.18,
    "relay-cat-walk-3.png": .69,
    "relay-cat-look-3.png": -.69,
    "relay-cat-peek-3.png": -.42,
    "relay-cat-top-2.png": .21,
    "relay-cat-top-3.png": .625,
    "relay-cat-turn-near-2.png": 2.08,
    "relay-cat-turn-away-1.png": 3.54,
    "relay-cat-turn-away-2.png": -2.08,
    "relay-cat-diagonal-away-pass.png": -1.67,
    "relay-cat-diagonal-away-stride.png": -1.67,
    "relay-cat-feather-anticipate-1.png": 2.78,
    "relay-cat-feather-anticipate-2.png": .49,
    "relay-cat-feather-swat-1.png": 5.83,
    "relay-cat-feather-swat-2.png": 1.18,
    "relay-cat-swat-recover-1.png": 2.92,
    "relay-cat-emerge.png": 2.22,
    "relay-cat-run.png": -1.88,
    "relay-cat-space-float-1.png": .56,
    "relay-cat-space-float-2.png": .97,
    "relay-cat-space-float-3.png": 1.18,
    "relay-cat-space-drift-1.png": -.35,
    "relay-cat-space-drift-2.png": -1.25,
    "relay-cat-space-drift-3.png": .07,
    "relay-cat-space-curl-1.png": -2.43,
    "relay-cat-space-curl-2.png": -1.6,
    "relay-cat-space-curl-3.png": -.97,
    "relay-cat-space-reach-1.png": .07,
    "relay-cat-space-reach-2.png": -1.11,
    "relay-cat-space-reach-3.png": .28,
  };
  const CAT_IDLE_POSES = ["sit", "loaf", "groom", "look", "stretch"];
  const CAT_SPACE_POSES = ["spaceFloat", "spaceDrift", "spaceCurl", "spaceReach"];
  const CAT_FRAME_DELAYS = {
    walk: 300, diagonalNear: 320, diagonalAway: 320, turnNear: 220, turnAway: 220,
    settle: 270, swat: 240, emerge: 230, run: 150,
    sit: 1050, loaf: 1250, groom: 650, look: 950, peek: 560, stretch: 820, top: 360,
    spaceFloat: 760, spaceDrift: 620, spaceCurl: 900, spaceReach: 700,
  };
  const catWorld = document.documentElement.dataset.mochiWorld || "site";
  const MODES = new Set(["lsd", "shrooms"]);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let active = null;
  let layer;
  let filterBank;
  let catsEnabled = false;
  let catLayer;
  let catResident;
  let catPeek;
  let catFeather;
  let catActionTimer;
  let catScrollTimer;
  let catRunningAway = false;
  let lastScrollY = window.scrollY || 0;
  let lastScrollDirection = 1;

  const style = document.createElement("style");
  style.id = "relay-effect-styles";
  style.textContent = `
    html.relay-effect-lsd, html.relay-effect-shrooms, html.relay-cats-awake { overflow-x: hidden; }
    html.relay-effect-lsd body > :not(script):not(.relay-trip-layer):not(.relay-filter-bank):not(.relay-cat-layer) {
      transform-origin: 50% 18%;
      animation: relay-lsd-wave 4.8s ease-in-out infinite alternate, relay-lsd-color 8s linear infinite;
      will-change: transform, filter;
    }
    html.relay-effect-lsd body > :nth-child(2n):not(script):not(.relay-trip-layer):not(.relay-filter-bank):not(.relay-cat-layer) {
      animation-direction: alternate-reverse, normal;
      animation-duration: 6.2s, 8s;
    }
    html.relay-effect-shrooms body > :not(script):not(.relay-trip-layer):not(.relay-filter-bank):not(.relay-cat-layer) {
      transform-origin: 50% 30%;
      animation: relay-shroom-breathe 14s ease-in-out infinite, relay-shroom-color 19s ease-in-out infinite alternate;
      will-change: transform, filter;
    }
    .relay-filter-bank { position:fixed;width:0;height:0;overflow:hidden;pointer-events:none; }
    .relay-trip-layer {
      position: fixed; inset: -22%; z-index: 2147482500; pointer-events: none;
      opacity: .36; mix-blend-mode: screen; filter: blur(22px) saturate(180%);
    }
    .relay-trip-layer::before, .relay-trip-layer::after {
      content: ""; position: absolute; inset: 0;
    }
    .relay-cat-layer {
      position: absolute; top: 0; left: 0; width: 100%; height: 0;
      z-index: 2147482550; overflow: visible; pointer-events: none;
    }
    .relay-cat-visit {
      position: absolute; display: block; pointer-events: none;
    }
    .relay-cat-image {
      position: relative; display: block; width: 100%; aspect-ratio: 3 / 2;
      filter: drop-shadow(0 5px 8px rgba(0,0,0,.38));
      transform-origin: 50% 88%; user-select: none;
      animation: relay-cat-gait .72s ease-in-out infinite;
    }
    .relay-cat-image.sprite-top { aspect-ratio: 2 / 3; }
    .relay-cat-frame {
      position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain;
      opacity: 0; transform: translate(var(--cat-frame-x, 0%), var(--cat-frame-y, 0%));
      user-select: none; pointer-events: none;
    }
    .relay-cat-frame.active { opacity: 1; }
    .relay-cat-resident {
      opacity: .98; pointer-events: auto; cursor: pointer; touch-action: manipulation;
      transition: left var(--cat-move, 5s) ease-in-out,
        top var(--cat-move, 5s) ease-in-out;
      will-change: left, top; isolation: isolate;
    }
    .relay-cat-resident::after {
      content: ""; position: absolute; z-index: -1; left: 17%; right: 12%; bottom: 5%;
      height: 9%; border-radius: 50%; pointer-events: none;
      background: radial-gradient(ellipse, rgba(0,0,0,.38), rgba(0,0,0,0) 72%);
      filter: blur(3px); opacity: .72;
    }
    .relay-cat-resident.pose-top::after { opacity: 0; }
    .relay-cat-resident:focus-visible { outline: 2px dashed currentColor; outline-offset: 4px; }
    .relay-cat-resident.running { transition-timing-function: cubic-bezier(.55,.02,.9,.35); }
    .relay-cat-resident.idle .relay-cat-image { animation-name: relay-cat-idle; animation-duration: 2.8s; }
    .relay-cat-resident.walking .relay-cat-image { animation-name: relay-cat-gait; }
    .relay-cat-resident.pose-top .relay-cat-image { animation: none; }
    .relay-cat-resident.pose-top.from-bottom .relay-cat-image { transform: rotate(180deg); }
    .relay-cat-resident.relay-cat-space {
      transform: rotate(var(--cat-space-roll, 0deg));
      transition: left var(--cat-move, 8s) linear,
        top var(--cat-move, 8s) cubic-bezier(.37,.02,.63,.98),
        transform var(--cat-move, 8s) ease-in-out;
      will-change: left, top, transform;
    }
    .relay-cat-resident.relay-cat-space::after { display: none; }
    .relay-cat-resident.relay-cat-space .relay-cat-image {
      animation: relay-cat-space-float 4.8s ease-in-out infinite;
      transform-origin: 50% 50%;
    }
    .relay-cat-resident.relay-cat-space.tumbling .relay-cat-image {
      animation: relay-cat-space-tumble 1.8s cubic-bezier(.35,.05,.7,1) both;
    }
    .relay-cat-peek { overflow: hidden; }
    .relay-cat-peek .relay-cat-slider { width: 100%; }
    .relay-cat-peek.to-right .relay-cat-slider {
      animation: relay-cat-peek-right var(--cat-stay) ease-in-out both;
    }
    .relay-cat-peek.to-left .relay-cat-slider {
      animation: relay-cat-peek-left var(--cat-stay) ease-in-out both;
    }
    .relay-cat-peek .relay-cat-image {
      animation: relay-cat-idle 2.8s ease-in-out infinite;
    }
    .relay-cat-peek.arriving.to-right .relay-cat-slider {
      animation: relay-cat-arrive-right 1.45s cubic-bezier(.18,.74,.28,1) both;
    }
    .relay-cat-peek.arriving.to-left .relay-cat-slider {
      animation: relay-cat-arrive-left 1.45s cubic-bezier(.18,.74,.28,1) both;
    }
    .relay-cat-feather {
      position: absolute; width: 14px; height: 34px; pointer-events: none;
      z-index: 2; border-radius: 80% 12% 78% 18%; opacity: 0;
      background: linear-gradient(145deg, #fff 0 26%, #d7c8a4 48%, #8c7658 100%);
      box-shadow: inset -2px -3px 4px rgba(68,44,22,.2), 0 2px 5px rgba(0,0,0,.22);
      transform-origin: 50% 100%;
      animation: relay-feather-fall var(--feather-time, 3800ms) cubic-bezier(.32,.02,.32,1) both;
    }
    .relay-cat-feather::after {
      content: ""; position: absolute; width: 1px; height: 39px; left: 55%; top: -2px;
      background: rgba(92,70,43,.7); transform: rotate(9deg); transform-origin: bottom;
    }
    html.relay-effect-lsd .relay-trip-layer {
      background:
        radial-gradient(ellipse at 18% 28%, rgba(255,0,174,.72), transparent 25%),
        radial-gradient(ellipse at 77% 24%, rgba(0,238,255,.68), transparent 28%),
        radial-gradient(ellipse at 48% 79%, rgba(255,230,0,.55), transparent 31%),
        radial-gradient(ellipse at 86% 76%, rgba(111,0,255,.68), transparent 24%);
      animation: relay-lsd-drift 8s ease-in-out infinite alternate, relay-overlay-hue 13s linear infinite;
    }
    html.relay-effect-lsd .relay-trip-layer::before {
      background:
        repeating-radial-gradient(ellipse at 50% 50%, transparent 0 28px, rgba(255,255,255,.16) 31px, transparent 36px 58px),
        repeating-conic-gradient(from 12deg at 50% 50%, transparent 0 7deg, rgba(255,255,255,.08) 9deg 11deg, transparent 14deg 22deg);
      animation: relay-rings 8s linear infinite, relay-pattern-turn 18s linear infinite reverse;
    }
    html.relay-effect-lsd .relay-trip-layer::after {
      background: linear-gradient(115deg, transparent 20%, rgba(255,255,255,.17) 48%, transparent 72%);
      animation: relay-sweep 5s ease-in-out infinite alternate;
    }
    html.relay-effect-shrooms .relay-trip-layer {
      opacity: .31;
      background:
        radial-gradient(circle at 25% 36%, rgba(119,255,111,.58), transparent 23%),
        radial-gradient(circle at 72% 27%, rgba(196,90,255,.55), transparent 25%),
        radial-gradient(circle at 58% 76%, rgba(255,128,59,.52), transparent 29%),
        radial-gradient(circle at 12% 82%, rgba(0,201,156,.52), transparent 23%);
      animation: relay-shroom-drift 23s ease-in-out infinite alternate, relay-overlay-hue 42s linear infinite;
    }
    html.relay-effect-shrooms .relay-trip-layer::before {
      inset: 7%; opacity: .48;
      background: repeating-radial-gradient(circle at 42% 48%, transparent 0 38px, rgba(232,255,210,.2) 41px, transparent 48px 88px);
      animation: relay-mycelium 25s ease-in-out infinite alternate;
    }
    html.relay-effect-shrooms .relay-trip-layer::after {
      background: radial-gradient(ellipse at center, transparent 25%, rgba(76,18,89,.28) 72%, transparent);
      animation: relay-shroom-breathe 16s ease-in-out infinite;
    }
    @keyframes relay-lsd-color {
      0%{filter:url(#relay-lsd-distortion) hue-rotate(0deg) saturate(1.25) contrast(1.04)}
      30%{filter:url(#relay-lsd-distortion) hue-rotate(18deg) saturate(1.48) contrast(1.08)}
      62%{filter:url(#relay-lsd-distortion) hue-rotate(-14deg) saturate(1.62) contrast(1.06)}
      100%{filter:url(#relay-lsd-distortion) hue-rotate(0deg) saturate(1.25) contrast(1.04)}
    }
    @keyframes relay-shroom-color {
      0%,100%{filter:url(#relay-shroom-distortion) saturate(1.13) sepia(.04)}
      50%{filter:url(#relay-shroom-distortion) saturate(1.48) sepia(.13) hue-rotate(16deg)}
    }
    @keyframes relay-lsd-wave {
      0%{transform:translate3d(-1px,0,0) skewX(-.18deg) scale(1.001)}
      48%{transform:translate3d(1px,-2px,0) skewY(.16deg) scale(1.008)}
      100%{transform:translate3d(0,1px,0) skewX(.2deg) scale(1.003)}
    }
    @keyframes relay-shroom-breathe {
      0%,100%{transform:scale(1) translateY(0)}50%{transform:scale(1.012) translateY(-2px)}
    }
    @keyframes relay-lsd-drift { from{transform:rotate(-5deg) scale(1)}to{transform:rotate(7deg) scale(1.13) translate3d(2%,-2%,0)} }
    @keyframes relay-shroom-drift { from{transform:rotate(0) scale(1)}to{transform:rotate(-4deg) scale(1.1) translate3d(-2%,2%,0)} }
    @keyframes relay-overlay-hue { to{filter:blur(22px) saturate(190%) hue-rotate(360deg)} }
    @keyframes relay-rings { from{transform:scale(.86) rotate(0)}to{transform:scale(1.15) rotate(18deg)} }
    @keyframes relay-pattern-turn { to{transform:rotate(360deg) scale(1.08)} }
    @keyframes relay-sweep { from{transform:translateX(-15%) rotate(-3deg)}to{transform:translateX(15%) rotate(3deg)} }
    @keyframes relay-mycelium { from{transform:scale(.9) rotate(-3deg)}to{transform:scale(1.16) rotate(6deg)} }
    @keyframes relay-cat-gait {
      0%,100%{transform:scaleX(var(--cat-facing)) translateY(0)}
      50%{transform:scaleX(var(--cat-facing)) translateY(-2px)}
    }
    @keyframes relay-cat-idle {
      0%,100%{transform:scaleX(var(--cat-facing)) translateY(0)}
      50%{transform:scaleX(var(--cat-facing)) translateY(-1px)}
    }
    @keyframes relay-cat-space-float {
      0%,100%{transform:scaleX(var(--cat-facing)) translate3d(0,0,0) rotate(-1.4deg)}
      50%{transform:scaleX(var(--cat-facing)) translate3d(0,-7px,0) rotate(1.4deg)}
    }
    @keyframes relay-cat-space-tumble {
      0%{transform:scaleX(var(--cat-facing)) rotate(0deg)}
      100%{transform:scaleX(var(--cat-facing)) rotate(32deg)}
    }
    @keyframes relay-cat-peek-right {
      0%,100%{opacity:0;transform:translateX(-98%)}
      12%{opacity:.98}
      28%,72%{opacity:.98;transform:translateX(-61%)}
      86%{opacity:.98;transform:translateX(-72%)}
    }
    @keyframes relay-cat-peek-left {
      0%,100%{opacity:0;transform:translateX(98%)}
      12%{opacity:.98}
      28%,72%{opacity:.98;transform:translateX(61%)}
      86%{opacity:.98;transform:translateX(72%)}
    }
    @keyframes relay-cat-arrive-right {
      0%{opacity:0;transform:translateX(-99%)}
      22%{opacity:.98}
      62%,100%{opacity:.98;transform:translateX(-62%)}
    }
    @keyframes relay-cat-arrive-left {
      0%{opacity:0;transform:translateX(99%)}
      22%{opacity:.98}
      62%,100%{opacity:.98;transform:translateX(62%)}
    }
    @keyframes relay-feather-fall {
      0%{opacity:0;transform:translate3d(-14px,-10px,0) rotate(-24deg)}
      9%{opacity:1}
      24%{transform:translate3d(12px,var(--feather-drop-one),0) rotate(25deg)}
      47%{transform:translate3d(-15px,var(--feather-drop-two),0) rotate(-17deg)}
      69%{transform:translate3d(10px,var(--feather-drop-three),0) rotate(19deg)}
      87%{opacity:1;transform:translate3d(-5px,var(--feather-drop-four),0) rotate(-8deg)}
      100%{opacity:0;transform:translate3d(2px,var(--feather-drop),0) rotate(11deg)}
    }
    @media (prefers-reduced-motion: reduce) {
      html.relay-effect-lsd body > *, html.relay-effect-shrooms body > *,
      .relay-trip-layer, .relay-trip-layer::before, .relay-trip-layer::after { animation: none !important; }
      html.relay-effect-lsd body > :not(script):not(.relay-trip-layer):not(.relay-filter-bank):not(.relay-cat-layer) { filter: url(#relay-lsd-distortion) hue-rotate(20deg) saturate(1.35); }
      html.relay-effect-shrooms body > :not(script):not(.relay-trip-layer):not(.relay-filter-bank):not(.relay-cat-layer) { filter: url(#relay-shroom-distortion) saturate(1.25) sepia(.08); }
      .relay-cat-image { animation: none; }
      .relay-cat-resident.relay-cat-space .relay-cat-image { animation: none; }
      .relay-cat-resident { transition: none; }
      .relay-cat-feather { animation: none; display: none; }
      .relay-cat-peek .relay-cat-slider { animation: none !important; }
    }
  `;
  document.head.appendChild(style);

  function installFilters() {
    if (filterBank) return;
    filterBank = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    filterBank.classList.add("relay-filter-bank");
    filterBank.setAttribute("aria-hidden", "true");
    filterBank.setAttribute("focusable", "false");
    filterBank.innerHTML = `
      <defs>
        <filter id="relay-lsd-distortion" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency=".006 .014" numOctaves="2" seed="17" result="noise">
            <animate attributeName="baseFrequency" dur="7s" repeatCount="indefinite"
              values=".006 .014;.011 .008;.004 .018;.006 .014" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="12" xChannelSelector="R" yChannelSelector="B">
            <animate attributeName="scale" dur="5.5s" repeatCount="indefinite" values="8;17;11;20;8" />
          </feDisplacementMap>
        </filter>
        <filter id="relay-shroom-distortion" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">
          <feTurbulence type="turbulence" baseFrequency=".004 .009" numOctaves="2" seed="31" result="noise">
            <animate attributeName="baseFrequency" dur="24s" repeatCount="indefinite"
              values=".004 .009;.007 .005;.003 .011;.004 .009" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="G" yChannelSelector="B">
            <animate attributeName="scale" dur="18s" repeatCount="indefinite" values="4;11;7;13;4" />
          </feDisplacementMap>
        </filter>
      </defs>`;
    document.body.appendChild(filterBank);
  }

  function remember(mode) {
    try {
      if (mode) sessionStorage.setItem(STORAGE_KEY, mode);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }

  function recall() {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return MODES.has(saved) ? saved : null;
    } catch (_) {
      return null;
    }
  }

  function rememberCats(enabled) {
    try {
      if (enabled) sessionStorage.setItem(CAT_STORAGE_KEY, "awake");
      else sessionStorage.removeItem(CAT_STORAGE_KEY);
    } catch (_) {}
  }

  function recallCats() {
    try {
      return sessionStorage.getItem(CAT_STORAGE_KEY) === "awake";
    } catch (_) {
      return false;
    }
  }

  function ensureCatLayer() {
    if (catLayer?.isConnected) return catLayer;
    catLayer = document.createElement("div");
    catLayer.className = "relay-cat-layer";
    document.body.appendChild(catLayer);
    return catLayer;
  }

  function preloadCatFrames() {
    Object.entries(CAT_FRAMES)
      .filter(([pose]) => catWorld === "space" ? pose.startsWith("space") : !pose.startsWith("space"))
      .flatMap(([, frames]) => frames)
      .forEach((src) => {
        const image = new Image();
        image.src = src;
      });
  }

  function loadCatFrame(frame, src) {
    const filename = decodeURIComponent(src.split("/").pop().split("?")[0]);
    frame.style.setProperty("--cat-frame-x", `${CAT_FRAME_X[filename] || 0}%`);
    frame.style.setProperty("--cat-frame-y", `${CAT_FRAME_Y[filename] || 0}%`);
    if (frame.dataset.frameSrc === src && frame.complete && frame.naturalWidth) return Promise.resolve();
    frame.dataset.frameSrc = src;
    frame.src = src;
    if (typeof frame.decode === "function") return frame.decode().catch(() => {});
    if (frame.complete) return Promise.resolve();
    return new Promise((resolve) => {
      frame.addEventListener("load", resolve, { once: true });
      frame.addEventListener("error", resolve, { once: true });
    });
  }

  function setCatImagePose(image, pose, options = {}) {
    const nextPose = CAT_FRAMES[pose] ? pose : "walk";
    const frames = CAT_FRAMES[nextPose];
    if (image.dataset.pose === nextPose && !options.force && !options.once) return;
    clearTimeout(image._relayCatFrameTimer);
    const token = (image._relayCatFrameToken || 0) + 1;
    image._relayCatFrameToken = token;
    image.dataset.pose = nextPose;
    image.classList.toggle("sprite-top", nextPose === "top");
    const layers = [...image.querySelectorAll(".relay-cat-frame")];
    let activeLayer = Number.isInteger(image._relayCatActiveLayer)
      ? image._relayCatActiveLayer
      : layers.findIndex((frame) => frame.classList.contains("active"));
    if (!layers[activeLayer]?.classList.contains("active")) {
      activeLayer = layers.findIndex((frame) => frame.classList.contains("active"));
    }
    layers.forEach((frame, index) => {
      if (index !== activeLayer) frame.classList.remove("active");
    });
    const forward = frames.map((_, index) => index);
    const sequence = options.once ? forward : [...forward, ...forward.slice(1, -1).reverse()];
    let cursor = 0;
    const isCurrent = () => image._relayCatFrameToken === token && image.dataset.pose === nextPose;

    const showFrame = async (frameIndex) => {
      const incomingLayer = activeLayer === 0 ? 1 : 0;
      const incoming = layers[incomingLayer];
      const outgoing = activeLayer >= 0 ? layers[activeLayer] : null;
      incoming.classList.remove("active");
      await loadCatFrame(incoming, frames[frameIndex]);
      if (!isCurrent()) return false;
      await new Promise((resolve) => requestAnimationFrame(() => {
        if (!isCurrent()) return resolve();
        // The next frame is fully decoded while hidden. Swap both classes in the
        // same render tick so there is never a blank frame or two visible cats.
        outgoing?.classList.remove("active");
        incoming.classList.add("active");
        activeLayer = incomingLayer;
        image._relayCatActiveLayer = incomingLayer;
        resolve();
      }));
      return isCurrent();
    };

    const finish = () => {
      if (isCurrent() && image.isConnected) options.onComplete?.();
    };
    const advance = async () => {
      if (!isCurrent() || !image.isConnected) return;
      cursor += 1;
      if (options.once && cursor >= sequence.length) return finish();
      if (!options.once) cursor %= sequence.length;
      if (await showFrame(sequence[cursor])) {
        image._relayCatFrameTimer = setTimeout(advance, CAT_FRAME_DELAYS[nextPose]);
      }
    };

    const start = async () => {
      if (reducedMotion && options.once) cursor = sequence.length - 1;
      if (!(await showFrame(sequence[cursor]))) return;
      if (reducedMotion) return finish();
      image._relayCatFrameTimer = setTimeout(advance, CAT_FRAME_DELAYS[nextPose]);
    };
    start();
  }

  function makeCat(width, facing, pose = "walk") {
    const image = document.createElement("div");
    image.className = "relay-cat-image";
    for (let index = 0; index < 2; index += 1) {
      const frame = document.createElement("img");
      frame.className = "relay-cat-frame";
      frame.alt = "";
      frame.draggable = false;
      image.appendChild(frame);
    }
    image.style.width = `${width}px`;
    image.style.setProperty("--cat-facing", facing);
    setCatImagePose(image, pose);
    return image;
  }

  function setResidentPose(pose, facing, options) {
    if (!catResident?.isConnected) return;
    const image = catResident.querySelector(".relay-cat-image");
    if (!image) return;
    setCatImagePose(image, pose, options);
    if (facing) image.style.setProperty("--cat-facing", facing);
    catResident.classList.toggle("pose-top", pose === "top");
  }

  function randomIdlePose() {
    return CAT_IDLE_POSES[Math.floor(Math.random() * CAT_IDLE_POSES.length)];
  }

  function wireResident(resident) {
    resident.setAttribute("role", "button");
    resident.setAttribute("tabindex", "0");
    resident.setAttribute("aria-label", catWorld === "space"
      ? "Mochi, the helmeted Relay cat. Click to send him tumbling through space."
      : "Mochi, the fluffy Relay cat. Click to make him run away.");
    resident.addEventListener("click", runAwayCat);
    resident.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      runAwayCat(event);
    });
    resident.addEventListener("pointerenter", () => {
      if (catResident !== resident || !resident.classList.contains("idle")) return;
      // Don't interrupt a transient one-shot pose (e.g. "settle"): its completion
      // callback is what schedules his next move, so interrupting it strands him.
      const pose = resident.querySelector(".relay-cat-image")?.dataset.pose;
      if (pose === "settle" || pose === "swat" || pose === "stretch") return;
      setResidentPose("look");
    });
  }

  function visibleFeatures() {
    const selector = "main, article, section, nav, header, .frame, .card, .module, .topbar";
    return [...document.querySelectorAll(selector)].filter((feature) => {
      const rect = feature.getBoundingClientRect();
      return rect.width > 130 && rect.height > 55 && rect.bottom > 50 &&
        rect.top < innerHeight - 50 && (rect.left > 70 || rect.right < innerWidth - 70);
    });
  }

  function visibleInteractionTargets() {
    const selector = "a, button, summary, [role='button'], h1, h2, h3, [data-mochi-target]";
    return [...document.querySelectorAll(selector)].filter((target) => {
      if (catLayer?.contains(target) || target.closest("[aria-hidden='true']")) return false;
      const rect = target.getBoundingClientRect();
      return rect.width > 22 && rect.height > 16 && rect.bottom > 32 && rect.top < innerHeight - 32 &&
        rect.right > 20 && rect.left < innerWidth - 20;
    });
  }

  function peekingCat(width, features) {
    const feature = features[Math.floor(Math.random() * features.length)];
    const rect = feature.getBoundingClientRect();
    const roomLeft = rect.left > 70;
    const roomRight = rect.right < innerWidth - 70;
    const toRight = roomRight && (!roomLeft || Math.random() < .5);
    const height = width * 2 / 3;
    const visitor = document.createElement("div");
    const slider = document.createElement("div");
    const stay = 9000 + Math.random() * 5000;
    visitor.className = `relay-cat-visit relay-cat-peek ${toRight ? "to-right" : "to-left"}`;
    visitor.style.width = `${width}px`;
    visitor.style.height = `${height}px`;
    visitor.style.left = `${(window.scrollX || 0) + (toRight ? rect.right - 2 : rect.left - width + 2)}px`;
    visitor.style.top = `${(window.scrollY || 0) + Math.min(innerHeight - height - 12, Math.max(12, rect.top + Math.random() * Math.max(1, rect.height - height)))}px`;
    visitor.style.setProperty("--cat-stay", `${stay}ms`);
    slider.className = "relay-cat-slider";
    slider.appendChild(makeCat(width, toRight ? 1 : -1, "peek"));
    visitor.appendChild(slider);
    return {
      visitor,
      stay,
      left: Number.parseFloat(visitor.style.left),
      top: Number.parseFloat(visitor.style.top),
      facing: toRight ? 1 : -1,
    };
  }

  function catWidth() {
    return Math.min(250, Math.max(155, innerWidth * .2));
  }

  function spaceCatWidth() {
    return Math.min(220, Math.max(135, innerWidth * .18));
  }

  function spaceCatSpot(width) {
    const height = width * 2 / 3;
    const scrollTop = window.scrollY || 0;
    const scrollLeft = window.scrollX || 0;
    const sidePad = 24;
    const topPad = innerWidth <= 560 ? 145 : 58;
    const bottomPad = 70;
    return {
      left: scrollLeft + sidePad + Math.random() * Math.max(1, innerWidth - width - sidePad * 2),
      top: scrollTop + topPad + Math.random() * Math.max(1, innerHeight - height - topPad - bottomPad),
    };
  }

  function spaceTravelDuration(fromLeft, fromTop, toLeft, toTop) {
    if (reducedMotion) return 80;
    const distance = Math.hypot(toLeft - fromLeft, toTop - fromTop);
    return Math.max(4200, Math.min(9000, distance / 38 * 1000));
  }

  function randomSpacePose() {
    return CAT_SPACE_POSES[Math.floor(Math.random() * CAT_SPACE_POSES.length)];
  }

  function nextSpaceRoll(resident, dramatic = false) {
    if (reducedMotion) return "0deg";
    const current = Number.isFinite(resident?._relaySpaceRoll) ? resident._relaySpaceRoll : 0;
    const fullTurn = dramatic || Math.random() < .3;
    const amount = fullTurn
      ? 150 + Math.random() * 230
      : 28 + Math.random() * 92;
    const direction = Math.random() < .5 ? -1 : 1;
    resident._relaySpaceRoll = current + amount * direction;
    return `${resident._relaySpaceRoll}deg`;
  }

  function pageHeight() {
    return Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0, innerHeight);
  }

  function spotCoversControl(left, top, width, height) {
    const viewportLeft = left - (window.scrollX || 0);
    const viewportTop = top - (window.scrollY || 0);
    const candidate = { left: viewportLeft, right: viewportLeft + width, top: viewportTop, bottom: viewportTop + height };
    const controls = document.querySelectorAll("a, button, input, textarea, select, summary, [role='button']");
    return [...controls].some((control) => {
      if (control === catResident || catLayer?.contains(control)) return false;
      const rect = control.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1 || rect.bottom < 0 || rect.top > innerHeight) return false;
      return candidate.left < rect.right + 14 && candidate.right > rect.left - 14 &&
        candidate.top < rect.bottom + 14 && candidate.bottom > rect.top - 14;
    });
  }

  function pagePerches(width, height) {
    const selectors = "main, article, section, header, .frame, .card, .module, .panel, .topbar";
    const scrollTop = window.scrollY || 0;
    const scrollLeft = window.scrollX || 0;
    const perches = [];
    document.querySelectorAll(selectors).forEach((feature) => {
      if (catLayer?.contains(feature)) return;
      const rect = feature.getBoundingClientRect();
      if (rect.width < width * .75 || rect.top < 90 || rect.top > innerHeight - 40) return;
      const top = scrollTop + rect.top - height * .84;
      if (top < scrollTop + 12 || top + height > scrollTop + innerHeight - 8) return;
      const leftEdge = Math.max(scrollLeft + 18, scrollLeft + rect.left + 14);
      const rightEdge = Math.min(scrollLeft + innerWidth - width - 18, scrollLeft + rect.right - width - 14);
      [leftEdge, rightEdge].forEach((left) => {
        if (left < scrollLeft + 18 || left > scrollLeft + innerWidth - width - 18) return;
        if (!spotCoversControl(left, top, width, height)) perches.push({ left, top, perched: true });
      });
    });
    return perches;
  }

  function interactionSpot(target, width) {
    const rect = target.getBoundingClientRect();
    const height = width * .72;
    const scrollTop = window.scrollY || 0;
    const scrollLeft = window.scrollX || 0;
    const top = scrollTop + Math.max(12, Math.min(innerHeight - height - 12,
      rect.top + rect.height * .5 - height * .58));
    const candidates = [
      { left: scrollLeft + rect.right + 12, top, facing: -1 },
      { left: scrollLeft + rect.left - width - 12, top, facing: 1 },
    ].filter((spot) => spot.left >= scrollLeft + 12 && spot.left + width <= scrollLeft + innerWidth - 12);
    const clear = candidates.filter((spot) => !spotCoversControl(spot.left, spot.top, width, height));
    const choices = clear.length ? clear : candidates;
    return choices.length ? choices[Math.floor(Math.random() * choices.length)] : null;
  }

  function catSpot(width, nearViewport = true) {
    const estimatedHeight = width * .72;
    const perches = pagePerches(width, estimatedHeight);
    if (perches.length && Math.random() < .78) {
      return perches[Math.floor(Math.random() * perches.length)];
    }
    const scrollTop = window.scrollY || 0;
    const scrollLeft = window.scrollX || 0;
    const pageMaxTop = Math.max(10, pageHeight() - estimatedHeight - 10);
    const viewportMaxTop = scrollTop + innerHeight - estimatedHeight - 12;
    const maxTop = Math.max(10, Math.min(pageMaxTop, viewportMaxTop));
    const minTop = Math.min(maxTop, Math.max(10, scrollTop + 12));
    let fallback;
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const rawTop = nearViewport
        ? scrollTop + innerHeight * (.5 + Math.random() * .24)
        : (Number.parseFloat(catResident?.style.top) || scrollTop) + (Math.random() - .5) * Math.min(260, innerHeight * .42);
      const spot = {
        left: scrollLeft + 18 + Math.random() * Math.max(1, innerWidth - width - 36),
        top: Math.max(minTop, Math.min(maxTop, rawTop)),
      };
      fallback = spot;
      if (!spotCoversControl(spot.left, spot.top, width, estimatedHeight)) return spot;
    }
    return fallback;
  }

  function catTravelDuration(fromLeft, fromTop, toLeft, toTop, speed = 72) {
    if (reducedMotion) return 80;
    const distance = Math.hypot(toLeft - fromLeft, toTop - fromTop);
    return Math.max(1400, Math.min(5600, distance / speed * 1000));
  }

  function walkingPoseFor(fromLeft, fromTop, toLeft, toTop) {
    const dx = toLeft - fromLeft;
    const dy = toTop - fromTop;
    if (Math.abs(dy) > 48 && Math.abs(dy) > Math.abs(dx) * .28) {
      return dy > 0 ? "diagonalNear" : "diagonalAway";
    }
    return "walk";
  }

  function setWalkingPose(fromLeft, fromTop, toLeft, toTop) {
    const resident = catResident;
    const pose = walkingPoseFor(fromLeft, fromTop, toLeft, toTop);
    const facing = toLeft >= fromLeft ? 1 : -1;
    if (!resident?.isConnected || pose === "walk") return setResidentPose("walk", facing);
    const turn = pose === "diagonalNear" ? "turnNear" : "turnAway";
    setResidentPose(turn, facing, {
      once: true,
      force: true,
      onComplete: () => {
        if (catResident === resident && resident.classList.contains("walking")) {
          setResidentPose(pose, facing);
        }
      },
    });
  }

  function settleResidentCat(after) {
    const resident = catResident;
    if (!resident?.isConnected) return;
    resident.classList.remove("walking", "running", "pose-top", "from-bottom");
    resident.classList.add("idle");
    setResidentPose("settle", null, {
      once: true,
      force: true,
      onComplete: () => {
        if (catResident !== resident || !resident.isConnected) return;
        setResidentPose(randomIdlePose());
        if (after) after();
        else scheduleCatAction();
      },
    });
  }

  function catIsInViewport() {
    if (!catResident?.isConnected) return false;
    const rect = catResident.getBoundingClientRect();
    return rect.bottom > 32 && rect.top < innerHeight - 32 && rect.right > 0 && rect.left < innerWidth;
  }

  function clearCatAction() {
    clearTimeout(catActionTimer);
    catPeek?.remove();
    catPeek = null;
    catFeather?.remove();
    catFeather = null;
  }

  function scheduleCatAction() {
    if (catWorld === "space") return scheduleSpaceCatAction();
    clearTimeout(catActionTimer);
    if (!catsEnabled || !catResident?.isConnected) return;
    catActionTimer = setTimeout(() => {
      if (!catIsInViewport()) return catchUpResidentCat(lastScrollDirection);
      const features = visibleFeatures();
      const targets = visibleInteractionTargets();
      const choice = Math.random();
      if (!reducedMotion && choice < .07) featherResidentCat();
      else if (features.length && choice < .22) hideResidentCat(features);
      else if (targets.length && choice < .38) interactResidentCat(targets);
      else if (!reducedMotion && choice < .45) wanderOffResidentCat();
      else if (choice < .73) roamResidentCat();
      else {
        setResidentPose(randomIdlePose());
        scheduleCatAction();
      }
    }, 8000 + Math.random() * 10000);
  }

  function scheduleSpaceCatAction(delay = 350 + Math.random() * 1300) {
    clearTimeout(catActionTimer);
    if (!catsEnabled) return;
    if (!catResident?.isConnected) return summonSpaceCat();
    catActionTimer = setTimeout(() => {
      if (!catResident?.isConnected) return summonSpaceCat();
      const resident = catResident;
      const fromLeft = Number.parseFloat(resident.style.left) || 0;
      const fromTop = Number.parseFloat(resident.style.top) || 0;
      const spot = spaceCatSpot(spaceCatWidth());
      const duration = spaceTravelDuration(fromLeft, fromTop, spot.left, spot.top);
      const travelFacing = spot.left >= fromLeft ? 1 : -1;
      // Zero gravity does not care where Mochi is looking. Sometimes he drifts
      // backward, which also reuses every pose cleanly in the opposite direction.
      const facing = Math.random() < .38 ? -travelFacing : travelFacing;
      resident.style.setProperty("--cat-move", `${duration}ms`);
      resident.style.setProperty("--cat-space-roll", nextSpaceRoll(resident));
      resident.style.width = `${spaceCatWidth()}px`;
      resident.style.left = `${spot.left}px`;
      resident.style.top = `${spot.top}px`;
      if (Math.random() < .64) setResidentPose(randomSpacePose(), facing, { force: true });
      else resident.querySelector(".relay-cat-image")?.style.setProperty("--cat-facing", facing);
      catActionTimer = setTimeout(() => {
        if (catResident === resident && resident.isConnected) {
          scheduleSpaceCatAction(180 + Math.random() * 850);
        }
      }, duration + 100);
    }, delay);
  }

  function summonSpaceCat() {
    if (!catsEnabled) return;
    clearCatAction();
    catResident?.remove();

    const width = spaceCatWidth();
    const spot = spaceCatSpot(width);
    const scrollLeft = window.scrollX || 0;
    const scrollTop = window.scrollY || 0;
    const fromRight = Math.random() < .5;
    const startLeft = fromRight ? scrollLeft + innerWidth + width * .18 : scrollLeft - width * 1.18;
    const startTop = Math.max(scrollTop + 20, Math.min(scrollTop + innerHeight - width * 2 / 3 - 20,
      spot.top + (Math.random() - .5) * 100));
    const duration = spaceTravelDuration(startLeft, startTop, spot.left, spot.top);
    const resident = document.createElement("div");
    resident.className = "relay-cat-visit relay-cat-resident relay-cat-space";
    resident.style.width = `${width}px`;
    resident.style.left = `${startLeft}px`;
    resident.style.top = `${startTop}px`;
    resident.style.setProperty("--cat-move", `${duration}ms`);
    resident._relaySpaceRoll = -18 + Math.random() * 36;
    resident.style.setProperty("--cat-space-roll", `${resident._relaySpaceRoll}deg`);
    wireResident(resident);
    resident.appendChild(makeCat(width, fromRight ? -1 : 1, "spaceDrift"));
    ensureCatLayer().appendChild(resident);
    catResident = resident;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (catResident !== resident) return;
      resident.style.left = `${spot.left}px`;
      resident.style.top = `${spot.top}px`;
      resident.style.setProperty("--cat-space-roll", nextSpaceRoll(resident));
    }));
    catActionTimer = setTimeout(() => {
      if (catResident !== resident || !resident.isConnected) return;
      setResidentPose("spaceFloat", null, { force: true });
      scheduleSpaceCatAction(220 + Math.random() * 900);
    }, duration + 100);
  }

  function summonResidentCat(walkIn = true) {
    if (!catsEnabled) return;
    clearCatAction();
    catResident?.remove();

    const width = catWidth();
    const spot = catSpot(width);
    const fromRight = Math.random() < .5;
    const scrollLeft = window.scrollX || 0;
    const startLeft = fromRight
      ? scrollLeft + innerWidth + width * .15
      : scrollLeft - width * 1.15;
    const duration = reducedMotion || !walkIn
      ? 80
      : Math.max(1800, Math.min(3400, Math.abs(spot.left - startLeft) / 260 * 1000));
    const resident = document.createElement("div");
    resident.className = `relay-cat-visit relay-cat-resident ${walkIn ? "walking" : "idle"}`;
    resident.style.width = `${width}px`;
    resident.style.left = `${walkIn ? startLeft : spot.left}px`;
    resident.style.top = `${spot.top}px`;
    resident.style.setProperty("--cat-move", `${duration}ms`);
    wireResident(resident);
    resident.appendChild(makeCat(width, fromRight ? -1 : 1, walkIn ? "walk" : randomIdlePose()));
    ensureCatLayer().appendChild(resident);
    catResident = resident;

    if (walkIn) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (catResident === resident) resident.style.left = `${spot.left}px`;
      }));
    }
    catActionTimer = setTimeout(() => {
      if (catResident !== resident || !resident.isConnected) return;
      if (walkIn) settleResidentCat();
      else scheduleCatAction();
    }, duration + 100);
  }

  function stretchOntoFeature() {
    if (!catsEnabled) return;
    clearCatAction();
    catResident?.remove();

    const width = catWidth();
    const height = width * .72;
    const perches = pagePerches(width, height);
    if (!perches.length) {
      if (visibleFeatures().length) emergeFromFeature();
      else summonResidentCat(true);
      return;
    }

    const perch = perches[Math.floor(Math.random() * perches.length)];
    const scrollLeft = window.scrollX || 0;
    const fromRight = perch.left + width / 2 > scrollLeft + innerWidth / 2;
    const startLeft = fromRight ? scrollLeft + innerWidth + width * .15 : scrollLeft - width * 1.15;
    const facing = fromRight ? -1 : 1;
    const duration = catTravelDuration(startLeft, perch.top, perch.left, perch.top, 88);
    const resident = document.createElement("div");
    resident.className = "relay-cat-visit relay-cat-resident walking";
    resident.style.width = `${width}px`;
    resident.style.left = `${startLeft}px`;
    resident.style.top = `${perch.top}px`;
    resident.style.setProperty("--cat-move", `${duration}ms`);
    wireResident(resident);
    resident.appendChild(makeCat(width, facing, "walk"));
    ensureCatLayer().appendChild(resident);
    catResident = resident;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (catResident === resident) resident.style.left = `${perch.left}px`;
    }));
    catActionTimer = setTimeout(() => {
      if (catResident !== resident || !resident.isConnected) return;
      resident.classList.remove("walking");
      resident.classList.add("idle");
      setResidentPose("stretch", facing, {
        once: true,
        force: true,
        onComplete: () => {
          if (catResident === resident && resident.isConnected) settleResidentCat();
        },
      });
    }, duration + 100);
  }

  function enterResidentCat() {
    if (!catsEnabled) return;
    const roll = Math.random();
    if (visibleFeatures().length && roll < .58) emergeFromFeature();
    else if (roll < .9) stretchOntoFeature();
    else summonResidentCat(true);
  }

  function emergeFromFeature() {
    if (!catsEnabled) return;
    const features = visibleFeatures();
    if (!features.length) return summonResidentCat(true);
    clearCatAction();
    catResident?.remove();

    const width = catWidth();
    const visit = peekingCat(width, features);
    visit.visitor.classList.add("arriving");
    visit.visitor.style.setProperty("--cat-stay", "1450ms");
    catPeek = visit.visitor;
    ensureCatLayer().appendChild(catPeek);

    catActionTimer = setTimeout(() => {
      if (!catsEnabled) return;
      catPeek?.remove();
      catPeek = null;
      const resident = document.createElement("div");
      resident.className = "relay-cat-visit relay-cat-resident walking";
      resident.style.width = `${width}px`;
      resident.style.left = `${visit.left}px`;
      resident.style.top = `${visit.top}px`;
      wireResident(resident);
      resident.appendChild(makeCat(width, visit.facing, "emerge"));
      ensureCatLayer().appendChild(resident);
      catResident = resident;

      const spot = catSpot(width, true);
      const duration = catTravelDuration(visit.left, visit.top, spot.left, spot.top, 86);
      resident.style.setProperty("--cat-move", `${duration}ms`);
      setResidentPose("emerge", visit.facing, {
        once: true,
        force: true,
        onComplete: () => {
          if (catResident === resident && resident.classList.contains("walking")) {
            setWalkingPose(visit.left, visit.top, spot.left, spot.top);
          }
        },
      });
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (catResident !== resident) return;
        resident.style.left = `${spot.left}px`;
        resident.style.top = `${spot.top}px`;
      }));
      catActionTimer = setTimeout(() => {
        if (catResident === resident) settleResidentCat();
      }, duration + 100);
    }, 1450);
  }

  function roamResidentCat() {
    if (!catResident?.isConnected) {
      summonResidentCat(true);
      return;
    }
    const width = catWidth();
    const spot = catSpot(width, true);
    const currentLeft = Number.parseFloat(catResident.style.left) || 0;
    const currentTop = Number.parseFloat(catResident.style.top) || 0;
    const duration = catTravelDuration(currentLeft, currentTop, spot.left, spot.top);
    catResident.classList.remove("idle");
    catResident.classList.add("walking");
    catResident.style.setProperty("--cat-move", `${duration}ms`);
    catResident.style.width = `${width}px`;
    catResident.style.left = `${spot.left}px`;
    catResident.style.top = `${spot.top}px`;
    setWalkingPose(currentLeft, currentTop, spot.left, spot.top);

    catActionTimer = setTimeout(() => {
      if (!catResident?.isConnected) return;
      if (!catIsInViewport()) return catchUpResidentCat(lastScrollDirection);
      settleResidentCat();
    }, duration + 100);
  }

  function interactResidentCat(targets) {
    if (!catResident?.isConnected) return summonResidentCat(true);
    const shuffled = [...targets].sort(() => Math.random() - .5);
    const width = catWidth();
    let target;
    let spot;
    for (const candidate of shuffled) {
      const candidateSpot = interactionSpot(candidate, width);
      if (candidateSpot) {
        target = candidate;
        spot = candidateSpot;
        break;
      }
    }
    if (!target || !spot) return roamResidentCat();

    const resident = catResident;
    const fromLeft = Number.parseFloat(resident.style.left) || 0;
    const fromTop = Number.parseFloat(resident.style.top) || 0;
    const duration = catTravelDuration(fromLeft, fromTop, spot.left, spot.top, 78);
    resident.classList.remove("idle");
    resident.classList.add("walking");
    resident.style.setProperty("--cat-move", `${duration}ms`);
    setWalkingPose(fromLeft, fromTop, spot.left, spot.top);
    resident.style.left = `${spot.left}px`;
    resident.style.top = `${spot.top}px`;

    catActionTimer = setTimeout(() => {
      if (catResident !== resident || !resident.isConnected) return;
      resident.classList.remove("walking");
      resident.classList.add("idle");
      setResidentPose("look", spot.facing, { force: true });
      const isControl = target.matches("a, button, summary, [role='button']");
      if (!isControl || reducedMotion) {
        catActionTimer = setTimeout(() => settleResidentCat(), 2600 + Math.random() * 1800);
        return;
      }
      catActionTimer = setTimeout(() => {
        if (catResident !== resident || !resident.isConnected) return;
        resident.classList.remove("idle");
        setResidentPose("swat", spot.facing, {
          once: true,
          force: true,
          onComplete: () => {
            if (catResident === resident && resident.isConnected) settleResidentCat();
          },
        });
      }, 900);
    }, duration + 100);
  }

  function wanderOffResidentCat() {
    if (!catResident?.isConnected || catRunningAway) return scheduleCatAction();
    const resident = catResident;
    const width = Number.parseFloat(resident.style.width) || catWidth();
    const left = Number.parseFloat(resident.style.left) || 0;
    const top = Number.parseFloat(resident.style.top) || (window.scrollY || 0);
    const scrollLeft = window.scrollX || 0;
    const leaveRight = left + width / 2 > scrollLeft + innerWidth / 2;
    const destination = leaveRight ? scrollLeft + innerWidth + width * .18 : scrollLeft - width * 1.18;
    const duration = catTravelDuration(left, top, destination, top, 92);
    catRunningAway = true;
    clearCatAction();
    resident.classList.remove("idle", "running", "pose-top", "from-bottom");
    resident.classList.add("walking");
    resident.style.setProperty("--cat-move", `${duration}ms`);
    setResidentPose("walk", leaveRight ? 1 : -1, { force: true });
    resident.style.left = `${destination}px`;

    catActionTimer = setTimeout(() => {
      if (catResident === resident) {
        resident.remove();
        catResident = null;
      }
      catActionTimer = setTimeout(() => {
        catRunningAway = false;
        if (!catsEnabled) return;
        enterResidentCat();
      }, 4200 + Math.random() * 4600);
    }, duration + 100);
  }

  function featherResidentCat() {
    if (!catResident?.isConnected || reducedMotion) return scheduleCatAction();
    const width = Number.parseFloat(catResident.style.width) || catWidth();
    const height = width * .72;
    const perches = pagePerches(width, height);
    if (!perches.length) return scheduleCatAction();

    const perch = perches[Math.floor(Math.random() * perches.length)];
    const resident = catResident;
    const fromLeft = Number.parseFloat(resident.style.left) || 0;
    const fromTop = Number.parseFloat(resident.style.top) || 0;
    const duration = catTravelDuration(fromLeft, fromTop, perch.left, perch.top, 82);
    resident.classList.remove("idle");
    resident.classList.add("walking");
    resident.style.setProperty("--cat-move", `${duration}ms`);
    setWalkingPose(fromLeft, fromTop, perch.left, perch.top);
    resident.style.left = `${perch.left}px`;
    resident.style.top = `${perch.top}px`;

    catActionTimer = setTimeout(() => {
      if (catResident !== resident || !resident.isConnected) return;
      resident.classList.remove("walking");
      resident.classList.add("idle");
      setResidentPose("look", null, { force: true });

      const feather = document.createElement("div");
      const startTop = (window.scrollY || 0) - 42;
      const targetTop = perch.top + height * .34;
      const facing = Number.parseFloat(resident.querySelector(".relay-cat-image")?.style.getPropertyValue("--cat-facing")) || 1;
      feather.className = "relay-cat-feather";
      feather.setAttribute("aria-hidden", "true");
      feather.style.left = `${perch.left + width * (facing < 0 ? .34 : .64)}px`;
      feather.style.top = `${startTop}px`;
      const drop = Math.max(90, targetTop - startTop);
      const fallDuration = 3400 + Math.random() * 900;
      feather.style.setProperty("--feather-drop", `${drop}px`);
      feather.style.setProperty("--feather-drop-one", `${drop * .22}px`);
      feather.style.setProperty("--feather-drop-two", `${drop * .45}px`);
      feather.style.setProperty("--feather-drop-three", `${drop * .67}px`);
      feather.style.setProperty("--feather-drop-four", `${drop * .84}px`);
      feather.style.setProperty("--feather-time", `${fallDuration}ms`);
      ensureCatLayer().appendChild(feather);
      catFeather = feather;

      catActionTimer = setTimeout(() => {
        if (catResident !== resident || !resident.isConnected) return;
        resident.classList.remove("idle");
        setResidentPose("swat", null, {
          once: true,
          force: true,
          onComplete: () => {
            if (catResident !== resident || !resident.isConnected) return;
            catActionTimer = setTimeout(() => {
              catFeather?.remove();
              catFeather = null;
              settleResidentCat();
            }, 220);
          },
        });
      }, fallDuration * .68);
    }, duration + 100);
  }

  function hideResidentCat(features) {
    if (!catResident?.isConnected) return;
    const visit = peekingCat(catWidth(), features);
    const currentLeft = Number.parseFloat(catResident.style.left) || 0;
    const currentTop = Number.parseFloat(catResident.style.top) || 0;
    const duration = catTravelDuration(currentLeft, currentTop, visit.left, visit.top, 105);
    catResident.classList.remove("idle");
    catResident.classList.add("walking");
    catResident.style.setProperty("--cat-move", `${duration}ms`);
    setWalkingPose(currentLeft, currentTop, visit.left, visit.top);
    catResident.style.left = `${visit.left}px`;
    catResident.style.top = `${visit.top}px`;
    catActionTimer = setTimeout(() => {
      if (!catResident?.isConnected) return;
      catResident.remove();
      catResident = null;
      catPeek = visit.visitor;
      ensureCatLayer().appendChild(catPeek);
      catActionTimer = setTimeout(() => {
        catPeek?.remove();
        catPeek = null;
        summonResidentCat(true);
      }, visit.stay + 100);
    }, duration + 80);
  }

  function catchUpResidentCat(direction = lastScrollDirection) {
    if (!catsEnabled || catRunningAway) return;
    if (catWorld === "space") return summonSpaceCat();
    clearCatAction();
    catResident?.remove();

    const width = Math.min(210, catWidth());
    const topHeight = width * 1.5;
    const fromBottom = direction < 0;
    const resident = document.createElement("div");
    const left = (window.scrollX || 0) + 18 + Math.random() * Math.max(1, innerWidth - width - 36);
    const startTop = fromBottom
      ? (window.scrollY || 0) + innerHeight + 12
      : Math.max(0, (window.scrollY || 0) - topHeight - 12);
    const endTop = fromBottom
      ? Math.max(10, (window.scrollY || 0) + innerHeight - topHeight - 14)
      : (window.scrollY || 0) + 14;
    const duration = reducedMotion ? 0 : 2600;

    resident.className = `relay-cat-visit relay-cat-resident walking pose-top${fromBottom ? " from-bottom" : ""}`;
    resident.style.width = `${width}px`;
    resident.style.left = `${left}px`;
    resident.style.top = `${startTop}px`;
    resident.style.setProperty("--cat-move", `${duration}ms`);
    wireResident(resident);
    resident.appendChild(makeCat(width, 1, "top"));
    ensureCatLayer().appendChild(resident);
    catResident = resident;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (catResident === resident) resident.style.top = `${endTop}px`;
    }));
    catActionTimer = setTimeout(() => {
      if (catResident !== resident || !resident.isConnected) return;
      resident.classList.remove("walking", "pose-top", "from-bottom");
      resident.classList.add("walking");
      const home = catSpot(width, true);
      const currentLeft = Number.parseFloat(resident.style.left) || left;
      const currentTop = Number.parseFloat(resident.style.top) || endTop;
      setWalkingPose(currentLeft, currentTop, home.left, home.top);
      const settleDuration = catTravelDuration(currentLeft, currentTop, home.left, home.top, 88);
      resident.style.setProperty("--cat-move", `${settleDuration}ms`);
      resident.style.left = `${home.left}px`;
      resident.style.top = `${home.top}px`;
      catActionTimer = setTimeout(() => {
        if (catResident !== resident || !resident.isConnected) return;
        settleResidentCat();
      }, settleDuration + 100);
    }, duration + 120);
  }

  function runAwayCat(event) {
    event?.stopPropagation?.();
    if (!catResident?.isConnected || catRunningAway) return;
    if (catWorld === "space") {
      tumbleSpaceCat();
      return;
    }
    catRunningAway = true;
    clearCatAction();
    clearTimeout(catScrollTimer);

    const width = Number.parseFloat(catResident.style.width) || catWidth();
    const left = Number.parseFloat(catResident.style.left) || 0;
    const scrollLeft = window.scrollX || 0;
    const runRight = left - scrollLeft + width / 2 >= innerWidth / 2;
    const duration = reducedMotion ? 80 : 720;
    catResident.classList.remove("idle", "pose-top", "from-bottom");
    catResident.classList.add("walking", "running");
    catResident.style.setProperty("--cat-move", `${duration}ms`);
    setResidentPose("run", runRight ? 1 : -1, { once: true, force: true });
    catResident.style.left = `${runRight ? scrollLeft + innerWidth + width * .2 : scrollLeft - width * 1.2}px`;
    catResident.style.top = `${Math.max(8, (Number.parseFloat(catResident.style.top) || window.scrollY || 0) + (Math.random() - .5) * 70)}px`;

    catActionTimer = setTimeout(() => {
      catResident?.remove();
      catResident = null;
      catRunningAway = false;
      catActionTimer = setTimeout(() => catchUpResidentCat(1), 1500 + Math.random() * 1800);
    }, duration + 80);
  }

  function tumbleSpaceCat() {
    if (!catResident?.isConnected || catRunningAway) return;
    catRunningAway = true;
    clearCatAction();

    const resident = catResident;
    const width = Number.parseFloat(resident.style.width) || spaceCatWidth();
    const left = Number.parseFloat(resident.style.left) || 0;
    const top = Number.parseFloat(resident.style.top) || 0;
    const scrollLeft = window.scrollX || 0;
    const scrollTop = window.scrollY || 0;
    const tumbleRight = left + width / 2 >= scrollLeft + innerWidth / 2;
    const destinationLeft = tumbleRight ? scrollLeft + innerWidth + width * .25 : scrollLeft - width * 1.25;
    const destinationTop = Math.max(scrollTop - width * .3, Math.min(scrollTop + innerHeight - width * .35,
      top + (Math.random() - .5) * 180));
    const duration = reducedMotion ? 80 : 1800;
    resident.classList.add("tumbling");
    resident.style.setProperty("--cat-move", `${duration}ms`);
    resident.style.setProperty("--cat-space-roll", nextSpaceRoll(resident, true));
    setResidentPose("spaceReach", tumbleRight ? 1 : -1, { force: true });
    resident.style.left = `${destinationLeft}px`;
    resident.style.top = `${destinationTop}px`;

    catActionTimer = setTimeout(() => {
      if (catResident === resident) {
        resident.remove();
        catResident = null;
      }
      catActionTimer = setTimeout(() => {
        catRunningAway = false;
        if (catsEnabled) summonSpaceCat();
      }, 1800 + Math.random() * 2200);
    }, duration + 80);
  }

  function handleCatScroll() {
    const y = window.scrollY || 0;
    if (y !== lastScrollY) lastScrollDirection = y > lastScrollY ? 1 : -1;
    lastScrollY = y;
    if (!catsEnabled || catRunningAway) return;
    clearTimeout(catScrollTimer);
    catScrollTimer = setTimeout(() => {
      if (!catIsInViewport()) catchUpResidentCat(lastScrollDirection);
    }, 650);
  }

  function setCats(enabled, persist = true) {
    const next = Boolean(enabled);
    const changed = catsEnabled !== next;
    catsEnabled = next;
    document.documentElement.classList.toggle("relay-cats-awake", next);
    if (persist) rememberCats(next);
    if (!changed) return false;
    clearCatAction();
    clearTimeout(catScrollTimer);
    catRunningAway = false;

    if (next) {
      preloadCatFrames();
      ensureCatLayer();
      if (catWorld === "space") summonSpaceCat();
      else enterResidentCat();
    } else {
      catLayer?.remove();
      catLayer = null;
      catResident = null;
      catPeek = null;
    }
    return changed;
  }

  addEventListener("scroll", handleCatScroll, { passive: true });
  addEventListener("resize", () => {
    if (!catsEnabled) return;
    clearTimeout(catScrollTimer);
    catScrollTimer = setTimeout(() => {
      if (!catIsInViewport()) catchUpResidentCat(lastScrollDirection);
    }, 180);
  });

  function removeArtifacts() {
    layer?.remove();
    layer = null;
  }

  function cleanIndexRoutes() {
    if (!/^https?:$/.test(location.protocol)) return;

    document.querySelectorAll("a[href]").forEach((link) => {
      const target = link.getAttribute("href");
      const indexRoute = target.match(/^((?:\.\.?\/)*)index\.html(#.*)?$/);
      if (!indexRoute) return;
      link.setAttribute("href", `${indexRoute[1] || "./"}${indexRoute[2] || ""}`);
    });

    if (/\/index\.html$/.test(location.pathname)) {
      const cleanPath = location.pathname.replace(/index\.html$/, "");
      history.replaceState(history.state, "", `${cleanPath}${location.search}${location.hash}`);
    }
  }

  function apply(mode, persist = true) {
    const next = MODES.has(mode) ? mode : null;
    active = next;
    document.documentElement.classList.remove("relay-effect-lsd", "relay-effect-shrooms");
    removeArtifacts();
    if (persist) remember(next);

    if (next) {
      document.documentElement.classList.add(`relay-effect-${next}`);
      layer = document.createElement("div");
      layer.className = "relay-trip-layer";
      layer.setAttribute("aria-hidden", "true");

      document.body.appendChild(layer);
    }

    window.dispatchEvent(new CustomEvent("relay-effect-change", { detail: { mode: next } }));
    return next;
  }

  window.RELAY_EFFECTS = {
    set: (mode) => apply(String(mode).toLowerCase()),
    clear: () => apply(null),
    current: () => active,
  };

  window.RELAY_CATS = {
    enable: () => setCats(true),
    clear: () => setCats(false),
    active: () => catsEnabled,
  };

  function start() {
    installFilters();
    cleanIndexRoutes();
    const navigation = performance.getEntriesByType?.("navigation")?.[0];
    const wasReloaded = navigation?.type === "reload" || performance.navigation?.type === 1;
    if (wasReloaded) remember(null);
    apply(wasReloaded ? null : recall(), false);
    if (recallCats()) setCats(true, false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
