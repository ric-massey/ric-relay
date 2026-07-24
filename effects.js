// Site-wide visual modes. Activated from the Relay terminal and persisted between rooms.
(() => {
  if (window.RELAY_EFFECTS) return;

  const STORAGE_KEY = "ric-relay-effect";
  const MODES = new Set(["lsd", "shrooms"]);
  let active = null;
  let layer;
  let filterBank;

  const style = document.createElement("style");
  style.id = "relay-effect-styles";
  style.textContent = `
    html.relay-effect-lsd, html.relay-effect-shrooms { overflow-x: hidden; }
    html.relay-effect-lsd body > :not(script):not(.relay-trip-layer):not(.relay-filter-bank) {
      transform-origin: 50% 18%;
      animation: relay-lsd-wave 4.8s ease-in-out infinite alternate, relay-lsd-color 8s linear infinite;
      will-change: transform, filter;
    }
    html.relay-effect-lsd body > :nth-child(2n):not(script):not(.relay-trip-layer):not(.relay-filter-bank) {
      animation-direction: alternate-reverse, normal;
      animation-duration: 6.2s, 8s;
    }
    html.relay-effect-shrooms body > :not(script):not(.relay-trip-layer):not(.relay-filter-bank) {
      transform-origin: 50% 30%;
      animation: relay-shroom-breathe 7.5s ease-in-out infinite, relay-shroom-color 10s ease-in-out infinite alternate;
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
      animation: relay-shroom-drift 12s ease-in-out infinite alternate, relay-overlay-hue 24s linear infinite;
    }
    html.relay-effect-shrooms .relay-trip-layer::before {
      inset: 7%; opacity: .48;
      background: repeating-radial-gradient(circle at 42% 48%, transparent 0 38px, rgba(232,255,210,.2) 41px, transparent 48px 88px);
      animation: relay-mycelium 13s ease-in-out infinite alternate;
    }
    html.relay-effect-shrooms .relay-trip-layer::after {
      background: radial-gradient(ellipse at center, transparent 25%, rgba(76,18,89,.28) 72%, transparent);
      animation: relay-shroom-breathe 8s ease-in-out infinite;
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
    @media (prefers-reduced-motion: reduce) {
      html.relay-effect-lsd body > *, html.relay-effect-shrooms body > *,
      .relay-trip-layer, .relay-trip-layer::before, .relay-trip-layer::after { animation: none !important; }
      html.relay-effect-lsd body > :not(script):not(.relay-trip-layer):not(.relay-filter-bank) { filter: url(#relay-lsd-distortion) hue-rotate(20deg) saturate(1.35); }
      html.relay-effect-shrooms body > :not(script):not(.relay-trip-layer):not(.relay-filter-bank) { filter: url(#relay-shroom-distortion) saturate(1.25) sepia(.08); }
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
            <animate attributeName="baseFrequency" dur="13s" repeatCount="indefinite"
              values=".004 .009;.007 .005;.003 .011;.004 .009" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="G" yChannelSelector="B">
            <animate attributeName="scale" dur="9s" repeatCount="indefinite" values="4;11;7;13;4" />
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

  function removeArtifacts() {
    layer?.remove();
    layer = null;
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

  function start() {
    installFilters();
    const navigation = performance.getEntriesByType?.("navigation")?.[0];
    const wasReloaded = navigation?.type === "reload" || performance.navigation?.type === 1;
    if (wasReloaded) remember(null);
    apply(wasReloaded ? null : recall(), false);
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
