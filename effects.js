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
  }).map(([pose, files]) => [pose, files.map((file) => new URL(`assets/${file}`, document.currentScript?.src || location.href).href)]));
  const CAT_IDLE_POSES = ["sit", "loaf", "groom", "look", "stretch"];
  const CAT_FRAME_DELAYS = { walk: 290, sit: 900, loaf: 1100, groom: 560, look: 820, peek: 480, stretch: 680, top: 310 };
  const CAT_FRAME_SEQUENCE = [0, 1, 2, 1];
  const MODES = new Set(["lsd", "shrooms"]);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let active = null;
  let layer;
  let filterBank;
  let catsEnabled = false;
  let catLayer;
  let catResident;
  let catPeek;
  let catActionTimer;
  let catScrollTimer;
  let catRunningAway = false;
  let lastScrollY = window.scrollY || 0;
  let lastScrollDirection = 1;

  const style = document.createElement("style");
  style.id = "relay-effect-styles";
  style.textContent = `
    html.relay-effect-lsd, html.relay-effect-shrooms { overflow-x: hidden; }
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
      display: block; width: 100%; height: auto;
      filter: drop-shadow(0 5px 8px rgba(0,0,0,.38));
      transform-origin: 50% 88%; user-select: none;
      animation: relay-cat-gait .72s ease-in-out infinite;
    }
    .relay-cat-resident {
      opacity: .98; pointer-events: auto; cursor: pointer; touch-action: manipulation;
      transition: left var(--cat-move, 5s) ease-in-out,
        top var(--cat-move, 5s) ease-in-out, opacity .25s ease;
    }
    .relay-cat-resident:focus-visible { outline: 2px dashed currentColor; outline-offset: 4px; }
    .relay-cat-resident.entering { animation: relay-cat-enter 4.2s cubic-bezier(.2,.7,.25,1) both; }
    .relay-cat-resident.out { opacity: 0; }
    .relay-cat-resident.running { transition-timing-function: cubic-bezier(.55,.02,.9,.35); }
    .relay-cat-resident.idle .relay-cat-image { animation-name: relay-cat-idle; animation-duration: 2.8s; }
    .relay-cat-resident.walking .relay-cat-image { animation-name: relay-cat-gait; }
    .relay-cat-resident.pose-top .relay-cat-image { animation: none; }
    .relay-cat-resident.pose-top.from-bottom .relay-cat-image { transform: rotate(180deg); }
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
    @keyframes relay-cat-enter { from{opacity:0;transform:translateX(var(--cat-enter-x))} to{opacity:.98;transform:translateX(0)} }
    @keyframes relay-cat-gait {
      0%,100%{transform:scaleX(var(--cat-facing)) translateY(0) rotate(-.7deg)}
      50%{transform:scaleX(var(--cat-facing)) translateY(-5px) rotate(.7deg)}
    }
    @keyframes relay-cat-idle {
      0%,100%{transform:scaleX(var(--cat-facing)) translateY(0) rotate(-.35deg)}
      50%{transform:scaleX(var(--cat-facing)) translateY(-2px) rotate(.35deg)}
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
    @media (prefers-reduced-motion: reduce) {
      html.relay-effect-lsd body > *, html.relay-effect-shrooms body > *,
      .relay-trip-layer, .relay-trip-layer::before, .relay-trip-layer::after { animation: none !important; }
      html.relay-effect-lsd body > :not(script):not(.relay-trip-layer):not(.relay-filter-bank):not(.relay-cat-layer) { filter: url(#relay-lsd-distortion) hue-rotate(20deg) saturate(1.35); }
      html.relay-effect-shrooms body > :not(script):not(.relay-trip-layer):not(.relay-filter-bank):not(.relay-cat-layer) { filter: url(#relay-shroom-distortion) saturate(1.25) sepia(.08); }
      .relay-cat-image { animation: none; }
      .relay-cat-resident { transition: none; }
      .relay-cat-resident.entering { animation: none; }
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
    Object.values(CAT_FRAMES).flat().forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }

  function setCatImagePose(image, pose) {
    const nextPose = CAT_FRAMES[pose] ? pose : "walk";
    const frames = CAT_FRAMES[nextPose];
    clearTimeout(image._relayCatFrameTimer);
    image.dataset.pose = nextPose;
    image.src = frames[0];
    if (reducedMotion) return;

    let cursor = 0;
    const advance = () => {
      if (!image.isConnected || image.dataset.pose !== nextPose) return;
      cursor = (cursor + 1) % CAT_FRAME_SEQUENCE.length;
      image.src = frames[CAT_FRAME_SEQUENCE[cursor]];
      image._relayCatFrameTimer = setTimeout(advance, CAT_FRAME_DELAYS[nextPose]);
    };
    image._relayCatFrameTimer = setTimeout(advance, CAT_FRAME_DELAYS[nextPose]);
  }

  function makeCat(width, facing, pose = "walk") {
    const image = document.createElement("img");
    image.className = "relay-cat-image";
    image.alt = "";
    image.draggable = false;
    image.style.width = `${width}px`;
    image.style.setProperty("--cat-facing", facing);
    setCatImagePose(image, pose);
    return image;
  }

  function setResidentPose(pose, facing) {
    if (!catResident?.isConnected) return;
    const image = catResident.querySelector(".relay-cat-image");
    if (!image) return;
    setCatImagePose(image, pose);
    if (facing) image.style.setProperty("--cat-facing", facing);
    catResident.classList.toggle("pose-top", pose === "top");
  }

  function randomIdlePose() {
    return CAT_IDLE_POSES[Math.floor(Math.random() * CAT_IDLE_POSES.length)];
  }

  function visibleFeatures() {
    const selector = "main, article, section, nav, header, .frame, .card, .module, .topbar";
    return [...document.querySelectorAll(selector)].filter((feature) => {
      const rect = feature.getBoundingClientRect();
      return rect.width > 130 && rect.height > 55 && rect.bottom > 50 &&
        rect.top < innerHeight - 50 && (rect.left > 70 || rect.right < innerWidth - 70);
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
    return { visitor, stay };
  }

  function catWidth() {
    return Math.min(250, Math.max(155, innerWidth * .2));
  }

  function pageHeight() {
    return Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0, innerHeight);
  }

  function catSpot(width, nearViewport = true) {
    const estimatedHeight = width * .72;
    const top = nearViewport
      ? (window.scrollY || 0) + innerHeight * (.56 + Math.random() * .2)
      : (Number.parseFloat(catResident?.style.top) || window.scrollY || 0) + (Math.random() - .5) * Math.min(260, innerHeight * .42);
    return {
      left: 18 + Math.random() * Math.max(1, innerWidth - width - 36),
      top: Math.max(10, Math.min(pageHeight() - estimatedHeight - 10, top)),
    };
  }

  function catIsInViewport() {
    if (!catResident?.isConnected || catResident.classList.contains("out")) return false;
    const rect = catResident.getBoundingClientRect();
    return rect.bottom > 32 && rect.top < innerHeight - 32 && rect.right > 0 && rect.left < innerWidth;
  }

  function clearCatAction() {
    clearTimeout(catActionTimer);
    catPeek?.remove();
    catPeek = null;
  }

  function scheduleCatAction() {
    clearTimeout(catActionTimer);
    if (!catsEnabled || !catResident?.isConnected) return;
    catActionTimer = setTimeout(() => {
      const features = visibleFeatures();
      const choice = Math.random();
      if (features.length && choice < .25) hideResidentCat(features);
      else if (choice < .6) roamResidentCat();
      else {
        setResidentPose(randomIdlePose());
        scheduleCatAction();
      }
    }, 8000 + Math.random() * 10000);
  }

  function summonResidentCat(entering = true) {
    if (!catsEnabled) return;
    clearCatAction();
    catResident?.remove();

    const width = catWidth();
    const spot = catSpot(width);
    const fromRight = Math.random() < .5;
    const resident = document.createElement("div");
    resident.className = `relay-cat-visit relay-cat-resident ${entering ? "entering walking" : "idle"}`;
    resident.style.width = `${width}px`;
    resident.style.left = `${spot.left}px`;
    resident.style.top = `${spot.top}px`;
    resident.style.setProperty("--cat-enter-x", `${fromRight ? innerWidth - spot.left : -(spot.left + width)}px`);
    resident.setAttribute("role", "button");
    resident.setAttribute("tabindex", "0");
    resident.setAttribute("aria-label", "Fluffy Relay cat. Click to make it run away.");
    resident.title = "pspsps — click me";
    resident.appendChild(makeCat(width, fromRight ? -1 : 1, entering ? "walk" : randomIdlePose()));
    resident.addEventListener("click", runAwayCat);
    resident.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      runAwayCat(event);
    });
    ensureCatLayer().appendChild(resident);
    catResident = resident;

    const settle = reducedMotion || !entering ? 80 : 4300;
    catActionTimer = setTimeout(() => {
      if (!catResident?.isConnected) return;
      catResident.classList.remove("entering", "walking");
      catResident.classList.add("idle");
      setResidentPose(randomIdlePose());
      scheduleCatAction();
    }, settle);
  }

  function roamResidentCat() {
    if (!catResident?.isConnected) {
      summonResidentCat(true);
      return;
    }
    const width = catWidth();
    const spot = catSpot(width, false);
    const currentLeft = Number.parseFloat(catResident.style.left) || 0;
    const duration = reducedMotion ? 80 : 3800 + Math.random() * 3200;
    const image = catResident.querySelector(".relay-cat-image");
    image?.style.setProperty("--cat-facing", spot.left >= currentLeft ? 1 : -1);
    catResident.classList.remove("idle");
    catResident.classList.add("walking");
    catResident.style.setProperty("--cat-move", `${duration}ms`);
    catResident.style.width = `${width}px`;
    catResident.style.left = `${spot.left}px`;
    catResident.style.top = `${spot.top}px`;
    setResidentPose("walk", spot.left >= currentLeft ? 1 : -1);

    catActionTimer = setTimeout(() => {
      if (!catResident?.isConnected) return;
      catResident.classList.remove("walking");
      catResident.classList.add("idle");
      setResidentPose(randomIdlePose());
      scheduleCatAction();
    }, duration + 100);
  }

  function hideResidentCat(features) {
    if (!catResident?.isConnected) return;
    const visit = peekingCat(catWidth(), features);
    catResident.classList.add("out");
    catPeek = visit.visitor;
    ensureCatLayer().appendChild(catPeek);
    catActionTimer = setTimeout(() => {
      catPeek?.remove();
      catPeek = null;
      summonResidentCat(true);
    }, visit.stay + 100);
  }

  function catchUpResidentCat(direction = lastScrollDirection) {
    if (!catsEnabled || catRunningAway) return;
    clearCatAction();
    catResident?.remove();

    const width = Math.min(210, catWidth());
    const topHeight = width * 1.5;
    const fromBottom = direction < 0;
    const resident = document.createElement("div");
    const left = 18 + Math.random() * Math.max(1, innerWidth - width - 36);
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
    resident.setAttribute("role", "button");
    resident.setAttribute("tabindex", "0");
    resident.setAttribute("aria-label", "Fluffy Relay cat. Click to make it run away.");
    resident.title = "caught up — click me";
    resident.appendChild(makeCat(width, 1, "top"));
    resident.addEventListener("click", runAwayCat);
    resident.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      runAwayCat(event);
    });
    ensureCatLayer().appendChild(resident);
    catResident = resident;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (catResident === resident) resident.style.top = `${endTop}px`;
    }));
    catActionTimer = setTimeout(() => {
      if (catResident !== resident || !resident.isConnected) return;
      resident.classList.remove("walking", "pose-top", "from-bottom");
      resident.classList.add("idle");
      setResidentPose(randomIdlePose());
      scheduleCatAction();
    }, duration + 120);
  }

  function runAwayCat(event) {
    event?.stopPropagation?.();
    if (!catResident?.isConnected || catRunningAway) return;
    catRunningAway = true;
    clearCatAction();
    clearTimeout(catScrollTimer);

    const width = Number.parseFloat(catResident.style.width) || catWidth();
    const left = Number.parseFloat(catResident.style.left) || 0;
    const runRight = left + width / 2 >= innerWidth / 2;
    const duration = reducedMotion ? 80 : 720;
    catResident.classList.remove("idle", "entering", "pose-top", "from-bottom");
    catResident.classList.add("walking", "running");
    catResident.style.setProperty("--cat-move", `${duration}ms`);
    setResidentPose("walk", runRight ? 1 : -1);
    catResident.style.left = `${runRight ? innerWidth + width * .2 : -width * 1.2}px`;
    catResident.style.top = `${Math.max(8, (Number.parseFloat(catResident.style.top) || window.scrollY || 0) + (Math.random() - .5) * 70)}px`;

    catActionTimer = setTimeout(() => {
      catResident?.remove();
      catResident = null;
      catRunningAway = false;
      catActionTimer = setTimeout(() => catchUpResidentCat(1), 1500 + Math.random() * 1800);
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
    if (persist) rememberCats(next);
    if (!changed) return false;
    clearCatAction();
    clearTimeout(catScrollTimer);
    catRunningAway = false;

    if (next) {
      preloadCatFrames();
      ensureCatLayer();
      summonResidentCat(true);
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

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) apply(MODES.has(event.newValue) ? event.newValue : null, false);
  });
})();
