// Site-wide visual modes. Activated from the Relay terminal and persisted between rooms.
(() => {
  if (window.RELAY_EFFECTS) return;

  const STORAGE_KEY = "ric-relay-effect";
  const CAT_STORAGE_KEY = "ric-relay-cats";
  const CAT_NEXT_KEY = "ric-relay-cat-next";
  const CAT_IMAGE_URL = new URL("assets/relay-cat.png", document.currentScript?.src || location.href).href;
  const MODES = new Set(["lsd", "shrooms"]);
  let active = null;
  let layer;
  let filterBank;
  let catsEnabled = false;
  let catLayer;
  let catTimer;
  let catRemovalTimer;

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
      position: fixed; inset: 0; z-index: 2147482550; overflow: hidden;
      pointer-events: none; contain: strict;
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
    .relay-cat-walk {
      left: 0;
      animation: relay-cat-walk-right var(--cat-stay) linear both;
    }
    .relay-cat-walk.from-right { animation-name: relay-cat-walk-left; }
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
    @keyframes relay-cat-walk-right {
      0%{opacity:0;transform:translateX(-110%)}
      4%,94%{opacity:.98}
      100%{opacity:0;transform:translateX(calc(100vw + 10%))}
    }
    @keyframes relay-cat-walk-left {
      0%{opacity:0;transform:translateX(calc(100vw + 10%))}
      4%,94%{opacity:.98}
      100%{opacity:0;transform:translateX(-110%)}
    }
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
    catLayer.setAttribute("aria-hidden", "true");
    document.body.appendChild(catLayer);
    return catLayer;
  }

  function scheduleCat(firstVisit = false) {
    clearTimeout(catTimer);
    if (!catsEnabled) return;
    let savedNext = 0;
    try { savedNext = Number(sessionStorage.getItem(CAT_NEXT_KEY)) || 0; } catch (_) {}
    const wait = firstVisit
      ? 3500 + Math.random() * 5500
      : savedNext > Date.now()
        ? savedNext - Date.now()
        : 45000 + Math.random() * 65000;
    try { sessionStorage.setItem(CAT_NEXT_KEY, String(Date.now() + wait)); } catch (_) {}
    catTimer = setTimeout(showCat, wait);
  }

  function makeCat(width, facing) {
    const image = document.createElement("img");
    image.className = "relay-cat-image";
    image.src = CAT_IMAGE_URL;
    image.alt = "";
    image.draggable = false;
    image.style.width = `${width}px`;
    image.style.setProperty("--cat-facing", facing);
    return image;
  }

  function visibleFeatures() {
    const selector = "main, article, section, nav, header, .frame, .card, .module, .topbar";
    return [...document.querySelectorAll(selector)].filter((feature) => {
      const rect = feature.getBoundingClientRect();
      return rect.width > 130 && rect.height > 55 && rect.bottom > 50 &&
        rect.top < innerHeight - 50 && (rect.left > 70 || rect.right < innerWidth - 70);
    });
  }

  function walkingCat(width) {
    const fromRight = Math.random() < .5;
    const visitor = document.createElement("div");
    const height = width * 2 / 3;
    visitor.className = `relay-cat-visit relay-cat-walk${fromRight ? " from-right" : ""}`;
    visitor.style.width = `${width}px`;
    visitor.style.top = `${Math.max(45, 55 + Math.random() * Math.max(40, innerHeight - height - 130))}px`;
    const stay = 13000 + Math.random() * 7000;
    visitor.style.setProperty("--cat-stay", `${stay}ms`);
    visitor.appendChild(makeCat(width, fromRight ? -1 : 1));
    return { visitor, stay };
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
    visitor.style.left = `${toRight ? rect.right - 2 : rect.left - width + 2}px`;
    visitor.style.top = `${Math.min(innerHeight - height - 12, Math.max(12, rect.top + Math.random() * Math.max(1, rect.height - height)))}px`;
    visitor.style.setProperty("--cat-stay", `${stay}ms`);
    slider.className = "relay-cat-slider";
    slider.appendChild(makeCat(width, toRight ? 1 : -1));
    visitor.appendChild(slider);
    return { visitor, stay };
  }

  function showCat() {
    if (!catsEnabled) return;
    if (document.hidden) {
      scheduleCat();
      return;
    }

    const width = Math.min(270, Math.max(165, innerWidth * .22));
    const features = visibleFeatures();
    const visit = features.length && Math.random() < .68
      ? peekingCat(width, features)
      : walkingCat(width);
    const { visitor, stay } = visit;
    ensureCatLayer().appendChild(visitor);

    clearTimeout(catRemovalTimer);
    catRemovalTimer = setTimeout(() => {
      visitor.remove();
      scheduleCat();
    }, stay + 100);
  }

  function setCats(enabled, persist = true) {
    const next = Boolean(enabled);
    const changed = catsEnabled !== next;
    catsEnabled = next;
    if (persist) rememberCats(next);
    if (!changed) return false;
    clearTimeout(catTimer);
    clearTimeout(catRemovalTimer);

    if (next) {
      ensureCatLayer();
      scheduleCat(persist);
    } else {
      catLayer?.remove();
      catLayer = null;
      try { sessionStorage.removeItem(CAT_NEXT_KEY); } catch (_) {}
    }
    return changed;
  }

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
