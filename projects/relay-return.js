(() => {
  const loader = document.currentScript;
  const home = loader?.dataset.home || "../index.html";
  const egg = loader?.dataset.egg || "";

  if (loader && !window.RELAY_EFFECTS && !document.querySelector("script[data-relay-effects]")) {
    const effects = document.createElement("script");
    effects.src = new URL("../effects.js", loader.src).href;
    effects.dataset.relayEffects = "";
    document.head.appendChild(effects);
  }

  const eggs = {
    shape: ["harm", "UNCERTAINTY DETECTED // MODEL BEHAVING NORMALLY"],
    spacetime: ["now", "NOW LOST // TRY ANOTHER REFERENCE FRAME"],
    siege: ["66", "COMMAND REJECTED // NICE TRY, PALPATINE"],
    mind: ["mood", "SIGNAL RECEIVED // WEATHER IS NOT CLIMATE"],
    reflection: ["spectrum", "HUMANS: STILL MORE COMPLICATED THAN CHECKBOXES"],
    starfield: ["warp", "NAV COMPUTER: THE SCENIC ROUTE IS FASTER"],
  };

  function install() {
    const style = document.createElement("style");
    style.textContent = `
      .relay-return {
        position: fixed; left: max(12px, env(safe-area-inset-left));
        bottom: max(12px, env(safe-area-inset-bottom)); z-index: 2147483000;
        display: inline-flex; align-items: center; gap: .45rem;
        padding: .62rem .82rem; border: 1px solid rgba(255,255,255,.28);
        border-radius: 999px; background: rgba(10,13,18,.84); color: #fff;
        box-shadow: 0 10px 30px rgba(0,0,0,.28); backdrop-filter: blur(10px);
        font: 700 11px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .08em; text-transform: uppercase; text-decoration: none;
        transition: transform .18s ease, background .18s ease, box-shadow .18s ease;
      }
      .relay-return:hover, .relay-return:focus-visible {
        transform: translateY(-2px); background: rgba(24,31,42,.96);
        box-shadow: 0 14px 36px rgba(0,0,0,.34); color: #fff;
      }
      .relay-return:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
      .relay-egg {
        position: fixed; left: 50%; bottom: max(72px, calc(env(safe-area-inset-bottom) + 72px));
        z-index: 2147483001; max-width: min(88vw, 34rem); transform: translate(-50%, 12px);
        padding: .8rem 1rem; border: 1px solid rgba(255,255,255,.24); border-radius: 8px;
        background: rgba(10,13,18,.94); color: #d7f9df; opacity: 0;
        box-shadow: 0 14px 42px rgba(0,0,0,.38); pointer-events: none;
        font: 700 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        letter-spacing: .06em; text-align: center; transition: opacity .2s, transform .2s;
      }
      .relay-egg.on { opacity: 1; transform: translate(-50%, 0); }
      @media (prefers-reduced-motion: reduce) {
        .relay-return, .relay-egg { transition: none; }
      }
    `;
    document.head.appendChild(style);

    const link = document.createElement("a");
    link.className = "relay-return";
    link.href = home;
    link.setAttribute("aria-label", "Back to Ric's Relay");
    link.innerHTML = "<span aria-hidden=\"true\">←</span> Ric's Relay";
    document.body.appendChild(link);

    const config = eggs[egg];
    if (!config) return;

    const toast = document.createElement("div");
    toast.className = "relay-egg";
    toast.setAttribute("role", "status");
    toast.textContent = config[1];
    document.body.appendChild(toast);

    let buffer = "";
    let timer;
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.key.length !== 1) return;
      buffer = (buffer + event.key.toLowerCase()).slice(-24);
      if (!buffer.endsWith(config[0])) return;
      toast.classList.add("on");
      clearTimeout(timer);
      timer = setTimeout(() => toast.classList.remove("on"), 3200);
      buffer = "";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
