// Site-wide visual modes. Activated from the Terminal home page and persisted between rooms.
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
    climb: ["relay-cat-climb-1.png"],
    climbStepA: [
      "relay-cat-climb-1.png",
      "relay-cat-climb-step-a-lift.png",
      "relay-cat-climb-step-a-reach.png",
      "relay-cat-climb-step-a-set.png",
      "relay-cat-climb-step-a-plant.png",
    ],
    climbStepB: [
      "relay-cat-climb-step-a-plant.png",
      "relay-cat-climb-step-b-lift.png",
      "relay-cat-climb-step-b-reach.png",
      "relay-cat-climb-step-b-set.png",
      "relay-cat-climb-step-b-plant.png",
    ],
    climbTurn: [
      "relay-cat-climb-turn-1.png",
      "relay-cat-climb-turn-quarter.png",
      "relay-cat-climb-turn-2.png",
      "relay-cat-climb-turn-three-quarter.png",
      "relay-cat-climb-turn-3.png",
    ],
    climbJump: [
      "relay-cat-climb-jump-1.png",
      "relay-cat-climb-jump-compress.png",
      "relay-cat-climb-jump-2.png",
      "relay-cat-climb-jump-extend.png",
      "relay-cat-climb-jump-3.png",
      "relay-cat-climb-jump-prepare-catch.png",
      "relay-cat-climb-jump-4.png",
      "relay-cat-climb-jump-mantle.png",
      "relay-cat-climb-3.png",
      "relay-cat-climb-1.png",
    ],
    climbPlay: [
      "relay-cat-climb-3.png",
      "relay-cat-climb-play.png",
      "relay-cat-climb-play.png",
      "relay-cat-climb-3.png",
    ],
    climbFall: [
      "relay-cat-climb-fall-1.png",
      "relay-cat-climb-fall-2.png",
      "relay-cat-climb-fall-3.png",
      "relay-cat-climb-fall-4.png",
    ],
    climbLand: [
      "relay-cat-climb-land.png",
      "relay-cat-climb-land.png",
      "relay-cat-climb-recover.png",
    ],
  }).map(([pose, files]) => [pose, files.map((file) => new URL(`assets/cat/${file}`, document.currentScript?.src || location.href).href)]));
  const CAT_FRAME_Y = {
    "relay-cat-walk-2.png": -.172,
    "relay-cat-walk-3.png": -1.04,
    "relay-cat-sit-2.png": .717,
    "relay-cat-sit-3.png": -1.018,
    "relay-cat-groom-2.png": -.125,
    "relay-cat-groom-3.png": .36,
    "relay-cat-peek-2.png": .675,
    "relay-cat-peek-3.png": 2.14,
    "relay-cat-stretch.png": .864,
    "relay-cat-stretch-2.png": 5.213,
    "relay-cat-stretch-3.png": 2.75,
    "relay-cat-top.png": .42,
    "relay-cat-top-2.png": -1.39,
    "relay-cat-diagonal-near-1.png": .979,
    "relay-cat-diagonal-near-2.png": .313,
    "relay-cat-diagonal-near-3.png": 2.606,
    "relay-cat-diagonal-away-1.png": 1.869,
    "relay-cat-diagonal-away-pass.png": 7.265,
    "relay-cat-diagonal-away-stride.png": 1.615,
    "relay-cat-turn-near-1.png": 1.017,
    "relay-cat-turn-near-2.png": .917,
    "relay-cat-turn-away-1.png": 1.275,
    "relay-cat-turn-away-2.png": 1.842,
    "relay-cat-feather-anticipate-1.png": -.625,
    "relay-cat-feather-anticipate-2.png": -5.2,
    "relay-cat-feather-swat-1.png": -8.54,
    "relay-cat-feather-swat-2.png": -7.5,
    "relay-cat-swat-recover-1.png": -6.875,
    "relay-cat-swat-recover-2.png": 4.79,
    "relay-cat-emerge.png": 2.55,
    "relay-cat-run.png": 3.825,
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
    "relay-cat-climb-1.png": 0,
    "relay-cat-climb-2.png": -2.15,
    "relay-cat-climb-3.png": -.1,
    "relay-cat-climb-4.png": -3.06,
    "relay-cat-climb-5.png": 1.6,
    "relay-cat-climb-6.png": -1.11,
    "relay-cat-climb-play.png": .33,
    "relay-cat-climb-fall-1.png": 0,
    "relay-cat-climb-fall-2.png": 0,
    "relay-cat-climb-fall-3.png": 0,
    "relay-cat-climb-fall-4.png": 0,
    "relay-cat-climb-land.png": 0,
    "relay-cat-climb-recover.png": 0,
    "relay-cat-climb-step-a-reach.png": .39,
    "relay-cat-climb-step-a-plant.png": -.2,
    "relay-cat-climb-step-b-reach.png": -.07,
    "relay-cat-climb-step-b-plant.png": .16,
    "relay-cat-climb-turn-1.png": -2.08,
    "relay-cat-climb-turn-2.png": -1.73,
    "relay-cat-climb-turn-3.png": -2.64,
    "relay-cat-climb-jump-1.png": 0,
    "relay-cat-climb-jump-2.png": 0,
    "relay-cat-climb-jump-3.png": 0,
    "relay-cat-climb-jump-4.png": 0,
    "relay-cat-climb-step-a-lift.png": .2,
    "relay-cat-climb-step-a-set.png": .68,
    "relay-cat-climb-step-b-lift.png": -1.37,
    "relay-cat-climb-step-b-set.png": -.85,
    "relay-cat-climb-turn-quarter.png": -2.31,
    "relay-cat-climb-turn-three-quarter.png": -3.55,
    "relay-cat-climb-jump-compress.png": -4.43,
    "relay-cat-climb-jump-extend.png": 1.33,
    "relay-cat-climb-jump-prepare-catch.png": 6.87,
    "relay-cat-climb-jump-mantle.png": -2.28,
  };
  const CAT_FRAME_X = {
    "relay-cat-walk-2.png": 1.188,
    "relay-cat-walk-3.png": .69,
    "relay-cat-look-3.png": -.69,
    "relay-cat-sit-2.png": .07,
    "relay-cat-sit-3.png": .007,
    "relay-cat-groom-2.png": -.029,
    "relay-cat-groom-3.png": .07,
    "relay-cat-peek-2.png": .008,
    "relay-cat-peek-3.png": -.38,
    "relay-cat-stretch.png": -.479,
    "relay-cat-stretch-2.png": -.604,
    "relay-cat-stretch-3.png": -.583,
    "relay-cat-top-2.png": .21,
    "relay-cat-top-3.png": .625,
    "relay-cat-diagonal-near-1.png": .194,
    "relay-cat-diagonal-near-2.png": .188,
    "relay-cat-diagonal-near-3.png": .188,
    "relay-cat-diagonal-away-1.png": .424,
    "relay-cat-diagonal-away-pass.png": -1.444,
    "relay-cat-diagonal-away-stride.png": -1.453,
    "relay-cat-turn-near-1.png": .178,
    "relay-cat-turn-near-2.png": 2.424,
    "relay-cat-turn-away-1.png": 4.09,
    "relay-cat-turn-away-2.png": -1.981,
    "relay-cat-feather-anticipate-1.png": 2.78,
    "relay-cat-feather-anticipate-2.png": .49,
    "relay-cat-feather-swat-1.png": 5.83,
    "relay-cat-feather-swat-2.png": 1.18,
    "relay-cat-swat-recover-1.png": 2.92,
    "relay-cat-emerge.png": 3.032,
    "relay-cat-run.png": -1.786,
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
    "relay-cat-climb-1.png": 0,
    "relay-cat-climb-2.png": -.1,
    "relay-cat-climb-3.png": .24,
    "relay-cat-climb-4.png": 1.81,
    "relay-cat-climb-5.png": .49,
    "relay-cat-climb-6.png": -.39,
    "relay-cat-climb-play.png": .49,
    "relay-cat-climb-fall-1.png": 0,
    "relay-cat-climb-fall-2.png": 0,
    "relay-cat-climb-fall-3.png": 0,
    "relay-cat-climb-fall-4.png": 0,
    "relay-cat-climb-land.png": 0,
    "relay-cat-climb-recover.png": 0,
    "relay-cat-climb-step-a-reach.png": 1.17,
    "relay-cat-climb-step-a-plant.png": 1.37,
    "relay-cat-climb-step-b-reach.png": 2.49,
    "relay-cat-climb-step-b-plant.png": .49,
    "relay-cat-climb-turn-1.png": 1.42,
    "relay-cat-climb-turn-2.png": -1.37,
    "relay-cat-climb-turn-3.png": 4.98,
    "relay-cat-climb-jump-1.png": 0,
    "relay-cat-climb-jump-2.png": 0,
    "relay-cat-climb-jump-3.png": 0,
    "relay-cat-climb-jump-4.png": 0,
    "relay-cat-climb-step-a-lift.png": 1.22,
    "relay-cat-climb-step-a-set.png": 1.46,
    "relay-cat-climb-step-b-lift.png": 1.71,
    "relay-cat-climb-step-b-set.png": 2.59,
    "relay-cat-climb-turn-quarter.png": 2.29,
    "relay-cat-climb-turn-three-quarter.png": 2,
    "relay-cat-climb-jump-compress.png": .59,
    "relay-cat-climb-jump-extend.png": -3.61,
    "relay-cat-climb-jump-prepare-catch.png": -4.1,
    "relay-cat-climb-jump-mantle.png": .63,
  };
  // The sprites share a canvas, but several generated poses do not share the
  // same *body* scale. These corrections are based on matched fur/head features,
  // not the PNG dimensions, so Mochi does not visibly grow or shrink mid-action.
  const CAT_FRAME_SCALE = {
    "relay-cat-walk-2.png": 1.002,
    "relay-cat-sit-2.png": 1.021,
    "relay-cat-sit-3.png": 1.002,
    "relay-cat-groom-2.png": .99,
    "relay-cat-groom-3.png": 1.024,
    "relay-cat-peek-2.png": 1.002,
    "relay-cat-peek-3.png": 1.01,
    "relay-cat-stretch.png": 1.23,
    "relay-cat-stretch-2.png": 1.3,
    "relay-cat-stretch-3.png": 1.24,
    "relay-cat-diagonal-near-1.png": 1.1,
    "relay-cat-diagonal-near-2.png": 1.1,
    "relay-cat-diagonal-near-3.png": 1.1,
    "relay-cat-diagonal-away-1.png": 1.13,
    "relay-cat-diagonal-away-pass.png": 1.13,
    "relay-cat-diagonal-away-stride.png": 1.13,
    "relay-cat-turn-near-1.png": 1.08,
    "relay-cat-turn-near-2.png": 1.08,
    "relay-cat-turn-away-1.png": 1.09,
    "relay-cat-turn-away-2.png": 1.13,
    "relay-cat-emerge.png": 1.18,
    "relay-cat-run.png": 1.27,
    "relay-cat-climb-1.png": 1,
    "relay-cat-climb-2.png": .964,
    "relay-cat-climb-3.png": .961,
    "relay-cat-climb-4.png": .996,
    "relay-cat-climb-5.png": .99,
    "relay-cat-climb-6.png": 1.009,
    "relay-cat-climb-play.png": 1.009,
    "relay-cat-climb-fall-1.png": 1,
    "relay-cat-climb-fall-2.png": 1,
    "relay-cat-climb-fall-3.png": 1,
    "relay-cat-climb-fall-4.png": 1,
    "relay-cat-climb-land.png": 1,
    "relay-cat-climb-recover.png": 1,
    "relay-cat-climb-step-a-reach.png": .99,
    "relay-cat-climb-step-a-plant.png": .948,
    "relay-cat-climb-step-b-reach.png": 1.015,
    "relay-cat-climb-step-b-plant.png": .952,
    "relay-cat-climb-turn-1.png": .984,
    "relay-cat-climb-turn-2.png": .969,
    "relay-cat-climb-turn-3.png": 1.014,
    "relay-cat-climb-jump-1.png": 1,
    "relay-cat-climb-jump-2.png": 1,
    "relay-cat-climb-jump-3.png": 1,
    "relay-cat-climb-jump-4.png": 1,
    "relay-cat-climb-step-a-lift.png": .987,
    "relay-cat-climb-step-a-set.png": .979,
    "relay-cat-climb-step-b-lift.png": .975,
    "relay-cat-climb-step-b-set.png": .967,
    "relay-cat-climb-turn-quarter.png": .995,
    "relay-cat-climb-turn-three-quarter.png": 1.019,
    "relay-cat-climb-jump-compress.png": 1,
    "relay-cat-climb-jump-extend.png": 1,
    "relay-cat-climb-jump-prepare-catch.png": 1,
    "relay-cat-climb-jump-mantle.png": .945,
  };
  const CAT_MAX_VISUAL_SCALE = Math.max(1, ...Object.values(CAT_FRAME_SCALE));
  const CAT_IDLE_POSES = ["sit", "loaf", "groom", "look", "stretch"];
  const CAT_SPACE_POSES = ["spaceFloat", "spaceDrift", "spaceCurl", "spaceReach"];
  const CAT_FRAME_DELAYS = {
    walk: 300, diagonalNear: 320, diagonalAway: 320, turnNear: 220, turnAway: 220,
    settle: 270, swat: 240, emerge: 230, run: 150,
    sit: 1050, loaf: 1250, groom: 650, look: 950, peek: 560, stretch: 820, top: 360,
    spaceFloat: 760, spaceDrift: 620, spaceCurl: 900, spaceReach: 700,
    climb: 700, climbStepA: 620, climbStepB: 620, climbTurn: 520,
    climbJump: 310, climbPlay: 420, climbFall: 260, climbLand: 420,
  };
  const catWorld = document.documentElement.dataset.mochiWorld || "site";
  function currentRootPage() {
    const path = (location.pathname || "").replace(/\\/g, "/");
    return {
      path,
      page: (path.split("/").pop() || "index.html").replace(/\.html$/, ""),
      isProject: path.includes("/projects/"),
    };
  }
  function currentRoomPage() {
    return currentRootPage().page;
  }
  function isClimbingPage() {
    return currentRoomPage() === "climbing";
  }
  function roomSceneForPage(page) {
    return ({
      index: "terminal",
      orrin: "orrin",
      psyche: "psyche",
      climbing: "climbing",
      training: "training",
      exploration: "exploration",
      gaming: "gaming",
      workbench: "workbench",
      captures: "captures",
      log: "log",
      apex: "apex",
      map: "signal",
      404: "signal",
    })[page] || null;
  }
  function mochiPropsForPage(page) {
    return ({
      training: ["shoes"],
      gaming: ["headset"],
      psyche: ["notebook", "pencil"],
      captures: ["camera"],
      workbench: ["hardhat", "hammer"],
    })[page] || [];
  }
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
  let climbingFallSeen = false;
  let climbingFeatureId = 0;
  const climbingFeatureIds = new WeakMap();
  const catPreloadedFrames = new Set();
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
      z-index: 2147482550; overflow: hidden; pointer-events: none;
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
    .relay-cat-image.sprite-climb { aspect-ratio: 2 / 3; }
    .relay-cat-image.sprite-climb .relay-cat-frame { transform-origin: 50% 50%; }
    .relay-cat-frame {
      position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain;
      opacity: 0; transform-origin: 50% 100%;
      transform: translate(var(--cat-frame-x, 0%), var(--cat-frame-y, 0%)) scale(var(--cat-frame-scale, 1));
      filter: sepia(.85) saturate(1.9) hue-rotate(345deg) brightness(.98) contrast(1.03);
      user-select: none; pointer-events: none;
    }
    .relay-cat-frame.active { opacity: 1; }
    .relay-cat-props {
      position: absolute; inset: 0; z-index: 3; pointer-events: none;
      transform: scaleX(var(--cat-facing, 1));
      transform-origin: 50% 50%;
    }
    .relay-cat-prop {
      position: absolute; display: block;
    }
    .relay-cat-prop::before, .relay-cat-prop::after {
      content: ""; position: absolute; display: block;
    }
    .relay-cat-prop-harness {
      left: 23%; right: 23%; top: 44%; height: 28%;
      border: 2px solid rgba(37, 28, 19, .62);
      border-top: 0;
      border-radius: 0 0 46% 46%;
      background:
        linear-gradient(180deg, rgba(255,255,255,.14), rgba(255,255,255,0) 30%),
        linear-gradient(90deg, transparent 0 34%, rgba(37, 28, 19, .7) 34% 36%, transparent 36% 64%, rgba(37, 28, 19, .7) 64% 66%, transparent 66%);
      box-shadow: inset 0 -2px 0 rgba(255,255,255,.08);
    }
    .relay-cat-prop-harness::before {
      left: 11%; right: 11%; top: -22%; height: 64%;
      border: 2px solid rgba(37, 28, 19, .48);
      border-bottom: 0;
      border-radius: 40% 40% 0 0;
    }
    .relay-cat-prop-shoe {
      bottom: 4%; width: 12%; height: 8%;
      background: linear-gradient(180deg, #f6efe3, #d8cfbf);
      border: 2px solid rgba(37, 28, 19, .58);
      border-radius: 54% 42% 34% 36%;
      box-shadow: inset 0 -2px 0 rgba(255,255,255,.25);
    }
    .relay-cat-prop-shoe::before {
      left: 14%; right: 14%; top: 23%; height: 16%;
      background: rgba(37, 28, 19, .20);
      border-radius: 999px;
    }
    .relay-cat-prop-shoe::after {
      right: -13%; top: 16%; width: 27%; height: 64%;
      border-top: 2px solid rgba(37, 28, 19, .45);
      border-right: 2px solid rgba(37, 28, 19, .45);
      border-radius: 0 72% 72% 0;
      transform: rotate(10deg);
    }
    .relay-cat-prop-shoe.left { left: 23%; transform: rotate(-10deg); }
    .relay-cat-prop-shoe.right { right: 23%; transform: rotate(10deg); }
    .relay-cat-prop-headset {
      left: 18%; right: 18%; top: 4%; height: 29%;
    }
    .relay-cat-prop-headset::before {
      left: 18%; right: 18%; top: 2%; height: 28%;
      border-top: 3px solid rgba(37, 28, 19, .62);
      border-radius: 999px 999px 0 0;
    }
    .relay-cat-prop-headset::after {
      left: 10%; right: 10%; top: 18%; height: 48%;
      border-left: 3px solid rgba(37, 28, 19, .58);
      border-right: 3px solid rgba(37, 28, 19, .58);
      border-radius: 42% 42% 46% 46%;
      box-shadow:
        -18% 12% 0 -13px rgba(37, 28, 19, .58),
        18% 12% 0 -13px rgba(37, 28, 19, .58);
    }
    .relay-cat-prop-notebook {
      left: 16%; top: 30%; width: 23%; height: 34%;
      background:
        repeating-linear-gradient(180deg, transparent 0 10px, rgba(52, 44, 38, .08) 10px 11px),
        linear-gradient(180deg, #fcf9f1, #e7ddcf);
      border: 2px solid rgba(37, 28, 19, .50);
      border-radius: 4px 8px 8px 4px;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,.22);
      transform: rotate(-18deg);
    }
    .relay-cat-prop-notebook::before {
      left: 0; top: 0; bottom: 0; width: 12%;
      background: rgba(37, 28, 19, .22);
      border-radius: 3px 0 0 3px;
    }
    .relay-cat-prop-notebook::after {
      right: -14%; top: 16%; width: 16%; height: 50%;
      background: linear-gradient(180deg, #ffc95c, #c37b19);
      border: 1.5px solid rgba(37, 28, 19, .48);
      clip-path: polygon(0 0, 100% 10%, 48% 100%, 0 100%);
      transform: rotate(14deg);
    }
    .relay-cat-prop-pencil {
      right: 20%; top: 33%; width: 4.5%; height: 34%;
      background: linear-gradient(180deg, #f0c35d, #d18f22);
      border: 1.5px solid rgba(37, 28, 19, .45);
      border-radius: 999px;
      transform: rotate(18deg);
      transform-origin: 50% 100%;
    }
    .relay-cat-prop-pencil::before {
      left: 0; right: 0; bottom: -16%; height: 16%;
      background: #9a6b34;
      clip-path: polygon(50% 100%, 0 0, 100% 0);
    }
    .relay-cat-prop-camera {
      left: 32%; top: 40%; width: 28%; height: 22%;
      background: linear-gradient(180deg, #2f2b28, #171411);
      border: 2px solid rgba(255,255,255,.14);
      border-radius: 11% 11% 13% 13%;
      box-shadow: inset 0 -3px 0 rgba(255,255,255,.06);
      transform: rotate(5deg);
    }
    .relay-cat-prop-camera::before {
      left: 28%; top: 18%; width: 44%; height: 60%;
      border-radius: 50%;
      border: 2px solid rgba(255,255,255,.2);
      background: radial-gradient(circle, rgba(78, 86, 96, .9) 0 28%, rgba(16, 15, 13, .96) 30% 100%);
    }
    .relay-cat-prop-camera::after {
      left: -8%; right: -8%; top: -18%; height: 160%;
      border-top: 2px solid rgba(37, 28, 19, .42);
      border-bottom: 2px solid rgba(37, 28, 19, .42);
      border-radius: 38% / 48%;
      opacity: .8;
    }
    .relay-cat-prop-hardhat {
      left: 29%; right: 29%; top: -1%; height: 21%;
      background: linear-gradient(180deg, #ffe56b, #dcb22f);
      border: 2px solid rgba(37, 28, 19, .50);
      border-radius: 52% 52% 34% 34%;
      box-shadow: inset 0 -2px 0 rgba(255,255,255,.14);
      transform: rotate(-4deg);
    }
    .relay-cat-prop-hardhat::before {
      left: 42%; top: 36%; width: 16%; height: 46%;
      border-left: 2px solid rgba(37, 28, 19, .46);
      border-right: 2px solid rgba(37, 28, 19, .46);
    }
    .relay-cat-prop-hardhat::after {
      left: 17%; right: 17%; top: 58%; height: 12%;
      background: rgba(37, 28, 19, .22);
      border-radius: 999px;
    }
    .relay-cat-prop-hammer {
      right: 6%; top: 31%; width: 26%; height: 38%;
      transform: rotate(24deg);
      transform-origin: 50% 18%;
    }
    .relay-cat-prop-hammer::before {
      left: 43%; top: 0; width: 18%; height: 86%;
      background: linear-gradient(180deg, #9f6832, #5f3818);
      border-radius: 999px;
      box-shadow: 0 0 0 1px rgba(37, 28, 19, .34);
    }
    .relay-cat-prop-hammer::after {
      left: 24%; top: 0; width: 52%; height: 26%;
      background: linear-gradient(180deg, #575049, #2d2721);
      border-radius: 10% 10% 22% 22%;
      box-shadow: inset 0 -1px 0 rgba(255,255,255,.08);
    }
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
    .relay-cat-resident.pose-climb .relay-cat-image { animation: none; }
    .relay-cat-resident.climb-stepping {
      transition-timing-function: cubic-bezier(.32,.02,.28,1);
    }
    .relay-cat-resident.climb-turning .relay-cat-image {
      animation: relay-cat-climb-turn 2.2s ease-in-out both;
    }
    .relay-cat-resident.climb-jumping {
      transition-timing-function: cubic-bezier(.32,.06,.24,1);
    }
    .relay-cat-resident.climb-jumping .relay-cat-image {
      animation: relay-cat-jump-arc 2.8s cubic-bezier(.25,.05,.25,1) both;
    }
    .relay-cat-resident.climb-falling {
      transition-timing-function: cubic-bezier(.28,.08,.82,.72);
    }
    .relay-cat-resident.climb-landing .relay-cat-image {
      animation: relay-cat-land .52s cubic-bezier(.2,.72,.32,1) both;
    }
    .relay-cat-resident.pose-top.from-bottom .relay-cat-image { transform: rotate(180deg); }
    .relay-cat-resident.pose-climb::after {
      left: 28%; right: 28%; bottom: 10%; height: 5%;
      opacity: .38;
    }
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
    .relay-cat-peek.edge-peek {
      --cat-peek-right: -72%; --cat-peek-right-rest: -80%;
      --cat-peek-left: 72%; --cat-peek-left-rest: 80%;
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
    @keyframes relay-cat-climb {
      0%,100%{transform:scaleX(var(--cat-facing)) translate3d(0,0,0) rotate(-.4deg)}
      50%{transform:scaleX(var(--cat-facing)) translate3d(0,-2px,0) rotate(.45deg)}
    }
    @keyframes relay-cat-climb-turn {
      0%,100%{transform:scaleX(var(--cat-facing)) translate3d(0,0,0) rotate(0)}
      50%{transform:scaleX(var(--cat-facing)) translate3d(0,2px,0) rotate(-1deg)}
    }
    @keyframes relay-cat-jump-arc {
      0%{transform:scaleX(var(--cat-facing)) translate3d(0,0,0) rotate(0)}
      44%{transform:scaleX(var(--cat-facing)) translate3d(0,-34px,0) rotate(-2deg)}
      78%{transform:scaleX(var(--cat-facing)) translate3d(0,-12px,0) rotate(1deg)}
      100%{transform:scaleX(var(--cat-facing)) translate3d(0,0,0) rotate(0)}
    }
    @keyframes relay-cat-land {
      0%{transform:scaleX(var(--cat-facing)) translate3d(0,-5px,0) scaleY(1.03)}
      48%{transform:scaleX(var(--cat-facing)) translate3d(0,3px,0) scaleY(.94)}
      100%{transform:scaleX(var(--cat-facing)) translate3d(0,0,0) scaleY(1)}
    }
    @keyframes relay-cat-peek-right {
      0%,100%{opacity:0;transform:translateX(-98%)}
      12%{opacity:.98}
      28%,72%{opacity:.98;transform:translateX(var(--cat-peek-right, -61%))}
      86%{opacity:.98;transform:translateX(var(--cat-peek-right-rest, -72%))}
    }
    @keyframes relay-cat-peek-left {
      0%,100%{opacity:0;transform:translateX(98%)}
      12%{opacity:.98}
      28%,72%{opacity:.98;transform:translateX(var(--cat-peek-left, 61%))}
      86%{opacity:.98;transform:translateX(var(--cat-peek-left-rest, 72%))}
    }
    @keyframes relay-cat-arrive-right {
      0%{opacity:0;transform:translateX(-99%)}
      22%{opacity:.98}
      62%,100%{opacity:.98;transform:translateX(var(--cat-peek-right, -62%))}
    }
    @keyframes relay-cat-arrive-left {
      0%{opacity:0;transform:translateX(99%)}
      22%{opacity:.98}
      62%,100%{opacity:.98;transform:translateX(var(--cat-peek-left, 62%))}
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
      .relay-cat-resident.pose-climb .relay-cat-image { animation: none; }
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
    if (!catLayer?.isConnected) {
      catLayer = document.createElement("div");
      catLayer.className = "relay-cat-layer";
      document.body.appendChild(catLayer);
    }
    // A real clipping boundary keeps off-page entrances from increasing
    // document.scrollWidth while still letting Mochi occupy document positions.
    catLayer.style.height = "0px";
    catLayer.style.height = `${pageHeight()}px`;
    return catLayer;
  }

  function preloadCatPose(pose) {
    (CAT_FRAMES[pose] || []).forEach((src) => {
      if (catPreloadedFrames.has(src)) return;
      catPreloadedFrames.add(src);
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    });
  }

  function loadCatFrame(frame, src) {
    const filename = decodeURIComponent(src.split("/").pop().split("?")[0]);
    frame.style.setProperty("--cat-frame-x", `${CAT_FRAME_X[filename] || 0}%`);
    frame.style.setProperty("--cat-frame-y", `${CAT_FRAME_Y[filename] || 0}%`);
    frame.style.setProperty("--cat-frame-scale", CAT_FRAME_SCALE[filename] || 1);
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
    preloadCatPose(nextPose);
    clearTimeout(image._relayCatFrameTimer);
    const token = (image._relayCatFrameToken || 0) + 1;
    image._relayCatFrameToken = token;
    image.dataset.pose = nextPose;
    image.classList.toggle("sprite-top", nextPose === "top");
    image.classList.toggle("sprite-climb", nextPose.startsWith("climb"));
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
        options.onFrame?.(frameIndex);
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
      if (frames.length === 1) return finish();
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
    const props = mochiPropsForPage(currentRootPage().page);
    if (props.length) {
      const propLayer = document.createElement("div");
      propLayer.className = "relay-cat-props";
      propLayer.setAttribute("aria-hidden", "true");
      for (const prop of props) {
        if (prop === "shoes") {
          const left = document.createElement("span");
          left.className = "relay-cat-prop relay-cat-prop-shoe left";
          left.setAttribute("aria-hidden", "true");
          const right = document.createElement("span");
          right.className = "relay-cat-prop relay-cat-prop-shoe right";
          right.setAttribute("aria-hidden", "true");
          propLayer.append(left, right);
          continue;
        }
        if (prop === "notebook") {
          const notebook = document.createElement("span");
          notebook.className = "relay-cat-prop relay-cat-prop-notebook";
          notebook.setAttribute("aria-hidden", "true");
          propLayer.appendChild(notebook);
          continue;
        }
        if (prop === "pencil") {
          const pencil = document.createElement("span");
          pencil.className = "relay-cat-prop relay-cat-prop-pencil";
          pencil.setAttribute("aria-hidden", "true");
          propLayer.appendChild(pencil);
          continue;
        }
        const propNode = document.createElement("span");
        propNode.className = `relay-cat-prop relay-cat-prop-${prop}`;
        propNode.setAttribute("aria-hidden", "true");
        propLayer.appendChild(propNode);
      }
      image.appendChild(propLayer);
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
    catResident.classList.toggle("pose-climb", pose.startsWith("climb") &&
      pose !== "climbFall" && pose !== "climbLand" && pose !== "climbJump");
  }

  function randomIdlePose() {
    return CAT_IDLE_POSES[Math.floor(Math.random() * CAT_IDLE_POSES.length)];
  }

  function wireResident(resident) {
    resident.setAttribute("role", "button");
    resident.setAttribute("tabindex", "0");
    resident.setAttribute("aria-label", catWorld === "space"
      ? "Mochi, the helmeted Terminal cat. Click to send him tumbling through space."
      : isClimbingPage()
        ? "Mochi, the fluffy climbing cat. Click to make him slip, right himself, and land on his feet."
        : "Mochi, the fluffy Terminal cat. Click to make him run away.");
    resident.addEventListener("click", runAwayCat);
    resident.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      runAwayCat(event);
    });
    resident.addEventListener("pointerenter", () => {
      if (catResident !== resident || !resident.classList.contains("idle")) return;
      if (isClimbingPage()) return;
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
        rect.top < innerHeight - 50 && rect.right > 0 && rect.left < innerWidth;
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
    const height = width * 2 / 3;
    const protectedRects = protectedContentRects();
    const shuffled = [...features].sort(() => Math.random() - .5);
    const edgeReveal = width * .28;
    let placement;

    for (const feature of shuffled) {
      const rect = feature.getBoundingClientRect();
      for (let attempt = 0; attempt < 5 && !placement; attempt += 1) {
        const top = Math.min(innerHeight - height - 12,
          Math.max(12, rect.top + Math.random() * Math.max(1, rect.height - height)));
        const candidates = [];
        if (rect.right < innerWidth - 70) {
          candidates.push({ left: rect.right - 2, top, toRight: true, visibleLeft: rect.right - 2, visibleWidth: width });
        }
        if (rect.left > 70) {
          candidates.push({ left: rect.left - width + 2, top, toRight: false, visibleLeft: rect.left - width + 2, visibleWidth: width });
        }
        candidates.push(
          { left: 0, top, toRight: true, visibleLeft: 0, visibleWidth: edgeReveal, edge: true },
          { left: innerWidth - width, top, toRight: false, visibleLeft: innerWidth - edgeReveal, visibleWidth: edgeReveal, edge: true }
        );
        placement = candidates.sort(() => Math.random() - .5).find((candidate) => {
          const peekRect = {
            left: candidate.visibleLeft,
            right: candidate.visibleLeft + candidate.visibleWidth,
            top: candidate.top,
            bottom: candidate.top + height,
          };
          return !protectedRects.some((content) =>
            peekRect.left < content.right + 8 && peekRect.right > content.left - 8 &&
            peekRect.top < content.bottom + 8 && peekRect.bottom > content.top - 8
          );
        });
      }
      if (placement) break;
    }
    if (!placement) return null;

    const { toRight } = placement;
    const visitor = document.createElement("div");
    const slider = document.createElement("div");
    const stay = 9000 + Math.random() * 5000;
    visitor.className = `relay-cat-visit relay-cat-peek ${toRight ? "to-right" : "to-left"}${placement.edge ? " edge-peek" : ""}`;
    visitor.style.width = `${width}px`;
    visitor.style.height = `${height}px`;
    visitor.style.left = `${(window.scrollX || 0) + placement.left}px`;
    visitor.style.top = `${(window.scrollY || 0) + placement.top}px`;
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

  function climbingCatWidth() {
    if (innerWidth <= 560) return Math.min(118, Math.max(104, innerWidth * .3));
    return Math.min(185, Math.max(145, innerWidth * .18));
  }

  function climbingCatHeight(width) {
    return width * 1.5;
  }

  function climbingFeatureAnchors(width) {
    const height = climbingCatHeight(width);
    const scrollTop = window.scrollY || 0;
    const scrollLeft = window.scrollX || 0;
    const viewportSideInset = Math.ceil(width * .06);
    const viewportTopInset = Math.ceil(34 + height * .05);
    const viewportBottomInset = Math.ceil(height * .075);
    /* .ledger, details.fold and .woodshed were parts of the old climbing room
       page and no longer exist anywhere; .tally, .next and .day replaced them. */
    const selectors = ".hero, .next:not([hidden]), .tally, .day, .routes, .tiles, .grid";
    const features = [...document.querySelectorAll(selectors)].filter((feature) => {
      const rect = feature.getBoundingClientRect();
      return rect.width >= 140 && rect.height >= 42 && rect.bottom > 24 &&
        rect.top < innerHeight - 24;
    });
    const anchors = [];
    const gap = innerWidth <= 560 ? 44 : 58;

    features.forEach((feature, featureIndex) => {
      if (!climbingFeatureIds.has(feature)) climbingFeatureIds.set(feature, ++climbingFeatureId);
      const stableFeatureId = climbingFeatureIds.get(feature);
      const rect = feature.getBoundingClientRect();
      const pageTop = rect.top + scrollTop;
      const pageBottom = rect.bottom + scrollTop;
      const pageLeft = rect.left + scrollLeft;
      const pageRight = rect.right + scrollLeft;
      const start = pageTop + Math.min(34, rect.height * .2);
      const end = pageBottom - Math.min(22, rect.height * .14);
      const levelCount = Math.max(1, Math.min(7, Math.floor((end - start) / gap) + 1));

      for (let level = 0; level < levelCount; level += 1) {
        const contactY = levelCount === 1
          ? (start + end) / 2
          : start + (end - start) * level / (levelCount - 1);
        for (const side of ["left", "right"]) {
          const edgeX = side === "left" ? pageLeft : pageRight;
          const rawLeft = side === "left" ? edgeX - width * .74 : edgeX - width * .26;
          anchors.push({
            key: `${stableFeatureId}:${side}:${level}`,
            feature,
            featureIndex,
            side,
            level,
            contactY,
            left: Math.max(scrollLeft + viewportSideInset,
              Math.min(scrollLeft + innerWidth - width - viewportSideInset, rawLeft)),
            top: Math.max(scrollTop + viewportTopInset,
              Math.min(scrollTop + innerHeight - height - viewportBottomInset,
              contactY - height * .22)),
            facing: side === "left" ? 1 : -1,
            kind: "side",
          });
        }
      }

      const ledgeCount = innerWidth <= 560 ? 2 : 3;
      for (let ledge = 0; ledge < ledgeCount; ledge += 1) {
        const contactX = pageLeft + rect.width * (ledge + 1) / (ledgeCount + 1);
        const rawLeft = contactX - width * .5;
        anchors.push({
          key: `${stableFeatureId}:ledge:${ledge}`,
          feature,
          featureIndex,
          side: `ledge-${ledge}`,
          level: 0,
          contactY: pageTop,
          left: Math.max(scrollLeft + viewportSideInset,
            Math.min(scrollLeft + innerWidth - width - viewportSideInset, rawLeft)),
          // The catch frame's front paws sit about 12% down its canvas.
          top: Math.max(scrollTop + viewportTopInset,
            Math.min(scrollTop + innerHeight - height - viewportBottomInset,
            pageTop - height * .12)),
          facing: contactX < (pageLeft + pageRight) / 2 ? 1 : -1,
          kind: "ledge",
        });
      }
    });

    return anchors;
  }

  function initialClimbingAnchor(width) {
    const scrollTop = window.scrollY || 0;
    const scrollLeft = window.scrollX || 0;
    const anchors = climbingFeatureAnchors(width).filter((anchor) => anchor.kind === "side" &&
      anchor.level > 0 &&
      anchor.top > scrollTop - climbingCatHeight(width) * .4 &&
      anchor.top < scrollTop + innerHeight - climbingCatHeight(width) * .16);
    if (anchors.length) {
      const lowerAnchors = anchors.sort((a, b) => b.contactY - a.contactY)
        .slice(0, Math.min(6, anchors.length));
      return lowerAnchors[Math.floor(Math.random() * lowerAnchors.length)];
    }

    const onLeft = Math.random() < .5;
    const height = climbingCatHeight(width);
    const sideInset = Math.ceil(width * .06);
    const bottomInset = Math.ceil(height * .075);
    return {
      key: "viewport-fallback",
      feature: document.body,
      featureIndex: -1,
      side: onLeft ? "left" : "right",
      level: 0,
      contactY: scrollTop + innerHeight - height * .24,
      left: scrollLeft + (onLeft ? sideInset : Math.max(sideInset,
        innerWidth - width - sideInset)),
      top: scrollTop + innerHeight - height - bottomInset,
      facing: onLeft ? 1 : -1,
      kind: "side",
    };
  }

  function nextClimbingStepAnchor(resident, width) {
    const current = resident._relayClimbAnchor;
    if (!current) return null;
    return climbingFeatureAnchors(width)
      .filter((anchor) => anchor.feature === current.feature && anchor.side === current.side &&
        anchor.contactY < current.contactY - 18 && anchor.contactY > current.contactY - 92)
      .sort((a, b) => b.contactY - a.contactY)[0] || null;
  }

  function nextClimbingTransferAnchor(resident, width) {
    const current = resident._relayClimbAnchor;
    if (!current) return null;
    const maxAcross = Math.min(430, innerWidth * .94);
    const visited = resident._relayClimbVisited || new Set();
    return climbingFeatureAnchors(width)
      .map((anchor) => ({
        anchor,
        dx: anchor.left - current.left,
        dy: anchor.contactY - current.contactY,
      }))
      .filter(({ anchor, dx, dy }) => (anchor.feature !== current.feature || anchor.side !== current.side ||
        anchor.level !== current.level) &&
        !visited.has(anchor.key) &&
        Math.abs(dx) > width * .32 && Math.abs(dx) < maxAcross &&
        dy < 36 && dy > -250)
      .sort((a, b) => {
        const aScore = Math.hypot(a.dx, a.dy) + (a.dy > 0 ? 180 : 0) +
          (a.anchor.feature === current.feature ? 210 : 0);
        const bScore = Math.hypot(b.dx, b.dy) + (b.dy > 0 ? 180 : 0) +
          (b.anchor.feature === current.feature ? 210 : 0);
        return aScore - bScore;
      })[0]?.anchor || null;
  }

  function climbResidentCat() {
    if (!catsEnabled) return;
    clearCatAction();
    catResident?.remove();

    const width = climbingCatWidth();
    const spot = initialClimbingAnchor(width);
    preloadCatPose("climbStepA");
    preloadCatPose("climbStepB");
    preloadCatPose("climbTurn");
    preloadCatPose("climbJump");
    preloadCatPose("climbPlay");
    preloadCatPose("climbFall");
    preloadCatPose("climbLand");
    const resident = document.createElement("div");
    resident.className = "relay-cat-visit relay-cat-resident idle pose-climb";
    resident.style.width = `${width}px`;
    resident.style.left = `${spot.left}px`;
    resident.style.top = `${spot.top}px`;
    resident.style.setProperty("--cat-move", "1180ms");
    resident._relayClimbMoves = 0;
    resident._relayClimbParity = 0;
    resident._relayClimbBusy = false;
    resident._relayClimbAnchor = spot;
    resident._relayClimbVisited = new Set([spot.key]);
    wireResident(resident);
    resident.appendChild(makeCat(width, spot.facing, "climb"));
    ensureCatLayer().appendChild(resident);
    catResident = resident;

    if (reducedMotion) return;
    catActionTimer = setTimeout(() => {
      if (catResident !== resident || !resident.isConnected) return;
      scheduleClimbingCatAction(1200 + Math.random() * 700);
    }, 180);
  }

  function performClimbingStep(resident, target) {
    if (resident._relayClimbBusy) return;
    resident._relayClimbBusy = true;
    const parity = resident._relayClimbParity || 0;
    const pose = parity ? "climbStepB" : "climbStepA";
    const facing = resident._relayClimbAnchor?.facing || target.facing;
    let planted = false;

    resident.classList.remove("idle", "climb-turning", "climb-jumping");
    resident.classList.add("pose-climb", "climb-stepping");
    resident.style.setProperty("--cat-move", "1180ms");
    setResidentPose(pose, facing, {
      once: true,
      force: true,
      onFrame: (frameIndex) => {
        if (frameIndex !== 3 || planted || catResident !== resident) return;
        planted = true;
        // The body advances only after the reaching paw has become the new fixed point.
        resident.style.left = `${target.left}px`;
        resident.style.top = `${target.top}px`;
      },
      onComplete: () => {
        if (catResident !== resident || !resident.isConnected) return;
        resident._relayClimbAnchor = target;
        resident._relayClimbVisited?.add(target.key);
        resident._relayClimbParity = parity ? 0 : 1;
        resident._relayClimbMoves = (resident._relayClimbMoves || 0) + 1;
        resident._relayClimbBusy = false;
        resident.classList.remove("climb-stepping");
        resident.classList.add("idle", "pose-climb");
        scheduleClimbingCatAction(1300 + Math.random() * 900);
      },
    });
  }

  function jumpClimbingCat(resident, target) {
    if (catResident !== resident || !resident.isConnected) return;
    const image = resident.querySelector(".relay-cat-image");
    let launched = false;
    resident.classList.remove("idle", "climb-turning", "climb-stepping", "pose-climb");
    resident.classList.add("climb-jumping");
    resident.style.setProperty("--cat-move", "1800ms");
    setResidentPose("climbJump", target.facing, {
      once: true,
      force: true,
      onFrame: (frameIndex) => {
        if (frameIndex !== 2 || launched || catResident !== resident) return;
        launched = true;
        image?.style.setProperty("--cat-facing", target.facing);
        resident.style.left = `${target.left}px`;
        resident.style.top = `${target.top}px`;
      },
      onComplete: () => {
        if (catResident !== resident || !resident.isConnected) return;
        resident._relayClimbAnchor = target;
        resident._relayClimbVisited?.add(target.key);
        resident._relayClimbMoves = (resident._relayClimbMoves || 0) + 1;
        resident._relayClimbJustJumped = true;
        resident._relayClimbBusy = false;
        resident.classList.remove("climb-jumping");
        resident.classList.add("idle", "pose-climb");
        setResidentPose("climb", target.facing, { force: true });
        scheduleClimbingCatAction(1800 + Math.random() * 900);
      },
    });
  }

  function turnAndJumpClimbingCat(resident, target) {
    if (resident._relayClimbBusy) return;
    resident._relayClimbBusy = true;
    const currentFacing = resident._relayClimbAnchor?.facing || 1;
    const image = resident.querySelector(".relay-cat-image");
    resident.classList.remove("idle", "climb-stepping");
    resident.classList.add("climb-turning", "pose-climb");
    setResidentPose("climbTurn", currentFacing, {
      once: true,
      force: true,
      onFrame: (frameIndex) => {
        // The middle frame is almost front-on, so this is where the mirrored
        // orientation can change without snapping one planted leg across the wall.
        if (frameIndex === 2) image?.style.setProperty("--cat-facing", target.facing);
      },
      onComplete: () => {
        if (catResident === resident && resident.isConnected) jumpClimbingCat(resident, target);
      },
    });
  }

  function playWithClimbingQuickdraw(resident) {
    if (catResident !== resident || !resident.isConnected) return;
    const image = resident.querySelector(".relay-cat-image");
    const facing = Number.parseFloat(image?.style.getPropertyValue("--cat-facing")) || 1;
    resident._relayClimbBusy = true;
    resident.classList.remove("walking");
    resident.classList.add("idle", "pose-climb");
    setResidentPose("climbPlay", facing, {
      once: true,
      force: true,
      onComplete: () => {
        if (catResident !== resident || !resident.isConnected) return;
        resident.classList.remove("idle");
        resident.classList.add("idle", "pose-climb");
        setResidentPose("climb", facing, { force: true });
        resident._relayClimbBusy = false;
        scheduleClimbingCatAction(1000 + Math.random() * 650);
      },
    });
  }

  function fallClimbingCat(resident, force = false) {
    if (catResident !== resident || !resident?.isConnected || catRunningAway) return false;
    if (climbingFallSeen && !force) return false;

    const width = Number.parseFloat(resident.style.width) || climbingCatWidth();
    const height = climbingCatHeight(width);
    const scrollTop = window.scrollY || 0;
    const scrollLeft = window.scrollX || 0;
    const fromLeft = Number.parseFloat(resident.style.left) || scrollLeft;
    const fromTop = Number.parseFloat(resident.style.top) || scrollTop;
    const landingTop = Math.max(fromTop, scrollTop + innerHeight - height - 10);
    const availableDrop = landingTop - fromTop;
    if (!force && availableDrop < height * .42) return false;

    climbingFallSeen = true;
    catRunningAway = true;
    clearCatAction();
    clearTimeout(catScrollTimer);

    const onLeftWall = fromLeft + width / 2 < scrollLeft + innerWidth / 2;
    const drift = Math.min(innerWidth * .24, width * .72);
    const landingLeft = Math.max(scrollLeft + 8, Math.min(scrollLeft + innerWidth - width - 8,
      fromLeft + (onLeftWall ? drift : -drift)));
    const fallDuration = reducedMotion ? 80 : Math.max(1000, Math.min(1600, availableDrop / 300 * 1000));
    const image = resident.querySelector(".relay-cat-image");
    const facing = Number.parseFloat(image?.style.getPropertyValue("--cat-facing")) || 1;

    resident._relayClimbBusy = true;
    resident.classList.remove("idle", "walking", "running", "pose-climb", "climb-landing",
      "climb-stepping", "climb-turning", "climb-jumping");
    resident.classList.add("climb-falling");
    resident.style.setProperty("--cat-move", `${fallDuration}ms`);
    setResidentPose("climbFall", facing, { once: true, force: true });
    resident.style.left = `${landingLeft}px`;
    resident.style.top = `${landingTop}px`;

    catActionTimer = setTimeout(() => {
      if (catResident !== resident || !resident.isConnected) return;
      resident.classList.remove("climb-falling");
      resident.classList.add("climb-landing");
      setResidentPose("climbLand", facing, {
        once: true,
        force: true,
        onComplete: () => {
          if (catResident !== resident || !resident.isConnected) return;
          catActionTimer = setTimeout(() => {
            if (catResident !== resident || !resident.isConnected) return;
            resident.remove();
            if (catResident === resident) catResident = null;
            catRunningAway = false;
            climbResidentCat();
          }, 920);
        },
      });
    }, fallDuration + 20);
    return true;
  }

  function scheduleClimbingCatAction(delay = 900 + Math.random() * 900) {
    clearTimeout(catActionTimer);
    if (!catsEnabled || !catResident?.isConnected) return;
    if (!isClimbingPage()) return scheduleCatAction();
    catActionTimer = setTimeout(() => {
      const resident = catResident;
      if (!resident?.isConnected) return climbResidentCat();
      const width = Number.parseFloat(resident.style.width) || climbingCatWidth();
      if (resident._relayClimbBusy) return scheduleClimbingCatAction(420);
      const moves = resident._relayClimbMoves || 0;
      if (resident._relayClimbJustJumped) {
        resident._relayClimbJustJumped = false;
        playWithClimbingQuickdraw(resident);
        return;
      }
      if (moves >= 4 && !climbingFallSeen && Math.random() < .1 &&
        fallClimbingCat(resident)) return;
      if (moves >= 2 && Math.random() < .13) {
        playWithClimbingQuickdraw(resident);
        return;
      }
      const step = nextClimbingStepAnchor(resident, width);
      if (step) return performClimbingStep(resident, step);
      const transfer = nextClimbingTransferAnchor(resident, width);
      if (transfer) return turnAndJumpClimbingCat(resident, transfer);
      if (!climbingFallSeen && fallClimbingCat(resident)) return;
      playWithClimbingQuickdraw(resident);
    }, delay);
  }

  function protectedContentRects() {
    const controlSelector = "a, button, input, textarea, select, summary, [role='button'], [data-mochi-no-cover]";
    const rects = [...document.querySelectorAll(controlSelector)].flatMap((element) => {
      if (element === catResident || catLayer?.contains(element) || element.closest("[aria-hidden='true']")) return [];
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1 || rect.bottom < 0 || rect.top > innerHeight) return [];
      return [{ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, weight: 12 }];
    });

    // Protect the actual rendered lines, not the full block box around them.
    // Blank space still wins, but text is a soft preference: when a room is
    // packed, Mochi may sit over words rather than leave the page.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim()) continue;
      const parent = node.parentElement;
      if (!parent || catLayer?.contains(parent) ||
        parent.closest(`script, style, [aria-hidden='true'], ${controlSelector}`)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      [...range.getClientRects()].forEach((rect) => {
        if (rect.width >= 1 && rect.height >= 1 && rect.bottom >= 0 && rect.top <= innerHeight) {
          rects.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, weight: 1 });
        }
      });
      range.detach?.();
    }
    return rects;
  }

  function spotCoversContent(left, top, width, height, protectedRects = protectedContentRects()) {
    const candidate = catVisualRect(left, top, width, height);
    return protectedRects.some((rect) => {
      return candidate.left < rect.right + 14 && candidate.right > rect.left - 14 &&
        candidate.top < rect.bottom + 14 && candidate.bottom > rect.top - 14;
    });
  }

  function catVisualRect(left, top, width, height) {
    const viewportLeft = left - (window.scrollX || 0);
    const viewportTop = top - (window.scrollY || 0);
    const visualWidth = width * CAT_MAX_VISUAL_SCALE;
    const visualHeight = height * CAT_MAX_VISUAL_SCALE;
    return {
      left: viewportLeft - (visualWidth - width) / 2,
      right: viewportLeft + width + (visualWidth - width) / 2,
      top: viewportTop - (visualHeight - height),
      bottom: viewportTop + height,
    };
  }

  function spotOverlapScore(left, top, width, height, protectedRects) {
    const candidate = catVisualRect(left, top, width, height);
    return protectedRects.reduce((score, rect) => {
      const overlapWidth = Math.max(0, Math.min(candidate.right, rect.right + 8) - Math.max(candidate.left, rect.left - 8));
      const overlapHeight = Math.max(0, Math.min(candidate.bottom, rect.bottom + 8) - Math.max(candidate.top, rect.top - 8));
      return score + overlapWidth * overlapHeight * (rect.weight || 1);
    }, 0);
  }

  function pagePerches(width, height) {
    const selectors = "main, article, section, header, .frame, .card, .module, .panel, .topbar";
    const scrollTop = window.scrollY || 0;
    const scrollLeft = window.scrollX || 0;
    const perches = [];
    const protectedRects = protectedContentRects();
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
        if (!spotCoversContent(left, top, width, height, protectedRects)) perches.push({ left, top, perched: true });
      });
    });
    return perches;
  }

  function interactionSpot(target, width) {
    const rect = target.getBoundingClientRect();
    const height = width * .72;
    const scrollTop = window.scrollY || 0;
    const scrollLeft = window.scrollX || 0;
    const gap = Math.max(22, width * (CAT_MAX_VISUAL_SCALE - 1) / 2 + 16);
    const top = scrollTop + Math.max(12, Math.min(innerHeight - height - 12,
      rect.top + rect.height * .5 - height * .58));
    const candidates = [
      { left: scrollLeft + rect.right + gap, top, facing: -1 },
      { left: scrollLeft + rect.left - width - gap, top, facing: 1 },
    ].filter((spot) => spot.left >= scrollLeft + 12 && spot.left + width <= scrollLeft + innerWidth - 12);
    const protectedRects = protectedContentRects();
    const clear = candidates.filter((spot) => !spotCoversContent(spot.left, spot.top, width, height, protectedRects));
    return clear.length ? clear[Math.floor(Math.random() * clear.length)] : null;
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
    const protectedRects = protectedContentRects();
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const rawTop = nearViewport
        ? scrollTop + innerHeight * (.5 + Math.random() * .24)
        : (Number.parseFloat(catResident?.style.top) || scrollTop) + (Math.random() - .5) * Math.min(260, innerHeight * .42);
      const spot = {
        left: scrollLeft + 18 + Math.random() * Math.max(1, innerWidth - width - 36),
        top: Math.max(minTop, Math.min(maxTop, rawTop)),
      };
      if (!spotCoversContent(spot.left, spot.top, width, estimatedHeight, protectedRects)) return spot;
    }

    // Random wandering should not decide whether Mochi gets a home. Scan the
    // remaining viewport on a grid so every genuine cat-sized gap is found.
    const openSpots = [];
    let leastBlockedSpot;
    let leastBlockedScore = Infinity;
    const columns = Math.max(2, Math.ceil(Math.max(1, innerWidth - width - 36) / 34));
    const rows = 8;
    for (let row = 0; row <= rows; row += 1) {
      const top = minTop + (maxTop - minTop) * row / rows;
      for (let column = 0; column <= columns; column += 1) {
        const left = scrollLeft + 18 + Math.max(0, innerWidth - width - 36) * column / columns;
        const spot = { left, top };
        const score = spotOverlapScore(left, top, width, estimatedHeight, protectedRects);
        if (score === 0) openSpots.push(spot);
        else if (score < leastBlockedScore) {
          leastBlockedSpot = spot;
          leastBlockedScore = score;
        }
      }
    }
    if (openSpots.length) return openSpots[Math.floor(Math.random() * openSpots.length)];
    return leastBlockedSpot;
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
    resident.classList.remove("pose-climb");
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

  function settledCatNeedsCatchUp() {
    if (!catResident?.isConnected || catResident.classList.contains("walking") ||
      catResident.classList.contains("relay-cat-space")) return false;
    return !catIsInViewport();
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
    if (isClimbingPage()) return scheduleClimbingCatAction();
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
    if (isClimbingPage()) {
      climbResidentCat();
      return;
    }
    clearCatAction();
    catResident?.remove();

    const width = catWidth();
    const spot = catSpot(width);
    if (!spot) {
      catResident = null;
      retryCatEntry();
      return;
    }
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
    if (isClimbingPage()) {
      climbResidentCat();
      return;
    }
    const roll = Math.random();
    if (visibleFeatures().length && roll < .58) emergeFromFeature();
    else if (roll < .9) stretchOntoFeature();
    else summonResidentCat(true);
  }

  function retryCatEntry(delay = 1400 + Math.random() * 1800) {
    clearTimeout(catActionTimer);
    catActionTimer = setTimeout(() => {
      if (catsEnabled && !catResident?.isConnected) enterResidentCat();
    }, delay);
  }

  function emergeFromFeature() {
    if (!catsEnabled) return;
    const features = visibleFeatures();
    if (!features.length) return summonResidentCat(true);
    clearCatAction();
    catResident?.remove();

    const width = catWidth();
    const visit = peekingCat(width, features);
    if (!visit) {
      summonResidentCat(true);
      return;
    }
    visit.visitor.classList.add("arriving");
    visit.visitor.style.setProperty("--cat-stay", "1450ms");
    catPeek = visit.visitor;
    ensureCatLayer().appendChild(catPeek);

    catActionTimer = setTimeout(() => {
      if (!catsEnabled) return;
      const spot = catSpot(width, true);
      if (!spot) {
        if (catPeek) {
          catPeek.classList.remove("arriving");
          catPeek.style.setProperty("--cat-stay", `${visit.stay}ms`);
        }
        catActionTimer = setTimeout(() => {
          catPeek?.remove();
          catPeek = null;
          retryCatEntry(600);
        }, visit.stay);
        return;
      }
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
    if (isClimbingPage()) return scheduleClimbingCatAction(160 + Math.random() * 240);
    if (!catResident?.isConnected) {
      summonResidentCat(true);
      return;
    }
    const width = catWidth();
    const spot = catSpot(width, true);
    if (!spot) {
      catResident.classList.remove("walking", "running");
      catResident.classList.add("idle");
      setResidentPose(randomIdlePose());
      scheduleCatAction();
      return;
    }
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
    if (!visit) return scheduleCatAction();
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
    if (isClimbingPage()) return climbResidentCat();
    clearCatAction();
    catResident?.remove();

    const width = Math.min(210, catWidth());
    const topHeight = width * 1.5;
    const fromBottom = direction < 0;
    const resident = document.createElement("div");
    const left = (window.scrollX || 0) + 18 + Math.random() * Math.max(1, innerWidth - width - 36);
    const startTop = fromBottom
      ? (window.scrollY || 0) + innerHeight + 12
      : (window.scrollY || 0) - topHeight - 12;
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
      const home = catSpot(width, true);
      if (!home) {
        // Dense pages can have no collision-free full-body landing. Keep the
        // overhead pose and visibly retreat instead of popping out of existence.
        const retreatDuration = reducedMotion ? 80 : 900;
        resident.style.setProperty("--cat-move", `${retreatDuration}ms`);
        resident.style.top = `${startTop}px`;
        catActionTimer = setTimeout(() => {
          if (catResident === resident) {
            resident.remove();
            catResident = null;
          }
          retryCatEntry(700);
        }, retreatDuration + 100);
        return;
      }
      resident.classList.remove("walking", "pose-top", "from-bottom");
      resident.classList.add("walking");
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
    if (isClimbingPage()) {
      const resident = catResident;
      fallClimbingCat(resident, true);
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
      if (isClimbingPage()) {
        if (!catIsInViewport()) climbResidentCat();
        return;
      }
      if (settledCatNeedsCatchUp()) catchUpResidentCat(lastScrollDirection);
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
      ensureCatLayer();
      if (settledCatNeedsCatchUp()) catchUpResidentCat(lastScrollDirection);
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

  function installRoomScene() {
    if (document.querySelector(".relay-scene")) return;

    // The motion is only for the root rooms. Project pages have their own
    // art direction and should stay out of this layer entirely.
    const { page, isProject } = currentRootPage();
    if (isProject) return;
    const scene = roomSceneForPage(page);

    if (!scene) return;

    const style = document.createElement("style");
    style.id = "relay-scene-styles";
    style.textContent = `
      body { position: relative; isolation: isolate; }
      .relay-scene {
        position: fixed;
        inset: -14%;
        z-index: -1;
        pointer-events: none;
        overflow: hidden;
        opacity: .72;
        transform: translateZ(0);
      }
      .relay-scene::before,
      .relay-scene::after {
        content: "";
        position: absolute;
        inset: 0;
        will-change: transform, opacity, filter;
      }
      @keyframes relay-scene-drift {
        from { transform: translate3d(-1.5%, -1%, 0) scale(1.05); }
        to { transform: translate3d(1.5%, 1%, 0) scale(1.08); }
      }
      @keyframes relay-scene-roll {
        from { transform: rotate(-4deg) scale(1.03); }
        to { transform: rotate(5deg) scale(1.08); }
      }
      @keyframes relay-scene-sweep {
        from { transform: translate3d(-12%, 0, 0) scale(1.02); }
        to { transform: translate3d(12%, 0, 0) scale(1.02); }
      }
      @keyframes relay-scene-wave {
        0%, 100% { transform: translate3d(0, 0, 0) scale(1.01); }
        50% { transform: translate3d(0, -1.5%, 0) scale(1.04); }
      }
      @keyframes relay-scene-pulse {
        0%, 100% { opacity: .35; }
        50% { opacity: .82; }
      }
      @media (prefers-reduced-motion: reduce) {
        .relay-scene,
        .relay-scene::before,
        .relay-scene::after { animation: none !important; }
      }

      html.relay-scene-terminal .relay-scene {
        opacity: .58;
        background:
          radial-gradient(circle at 50% 16%, rgba(255, 176, 0, 0.08), transparent 24%),
          radial-gradient(circle at 50% 52%, rgba(255, 176, 0, 0.03), transparent 62%),
          linear-gradient(180deg, rgba(255, 176, 0, 0.015), transparent 32%, rgba(255, 176, 0, 0.01));
      }
      html.relay-scene-terminal .relay-scene::before {
        background: repeating-linear-gradient(0deg, rgba(255, 176, 0, 0.04) 0 1px, transparent 1px 6px);
        animation: relay-scene-drift 20s linear infinite alternate;
      }
      html.relay-scene-terminal .relay-scene::after {
        background:
          radial-gradient(circle at 50% 16%, rgba(255, 176, 0, 0.12), transparent 18%),
          radial-gradient(circle at 50% 52%, rgba(255, 176, 0, 0.05), transparent 52%);
        animation: relay-scene-pulse 11s ease-in-out infinite;
      }

      html.relay-scene-orrin .relay-scene {
        opacity: .66;
        background:
          radial-gradient(circle at 18% 18%, rgba(77, 232, 255, 0.10), transparent 26%),
          radial-gradient(circle at 82% 22%, rgba(180, 138, 255, 0.09), transparent 24%),
          radial-gradient(circle at 50% 78%, rgba(255, 77, 216, 0.05), transparent 30%);
      }
      html.relay-scene-orrin .relay-scene::before {
        background:
          repeating-radial-gradient(circle at 50% 50%, rgba(77, 232, 255, 0.10) 0 1px, transparent 2px 42px),
          repeating-linear-gradient(125deg, transparent 0 20px, rgba(180, 138, 255, 0.05) 20px 21px, transparent 21px 64px);
        filter: blur(1px);
        animation: relay-scene-roll 42s linear infinite alternate;
      }
      html.relay-scene-orrin .relay-scene::after {
        background: radial-gradient(circle at 50% 50%, rgba(77, 232, 255, 0.08), transparent 58%);
        animation: relay-scene-pulse 14s ease-in-out infinite;
      }

      html.relay-scene-psyche .relay-scene {
        opacity: .62;
        background:
          radial-gradient(ellipse at 22% 34%, rgba(96, 67, 111, 0.18), transparent 22%),
          radial-gradient(ellipse at 78% 64%, rgba(166, 64, 77, 0.14), transparent 24%),
          radial-gradient(circle at 50% 50%, rgba(255, 253, 247, 0.04), transparent 48%);
      }
      html.relay-scene-psyche .relay-scene::before {
        background:
          radial-gradient(ellipse at 36% 46%, rgba(96, 67, 111, 0.20), transparent 18%),
          radial-gradient(ellipse at 64% 54%, rgba(96, 67, 111, 0.20), transparent 18%),
          radial-gradient(circle at 50% 50%, rgba(96, 67, 111, 0.08), transparent 42%);
        filter: blur(16px);
        animation: relay-scene-wave 18s ease-in-out infinite;
      }
      html.relay-scene-psyche .relay-scene::after {
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 30%, rgba(96, 67, 111, 0.05) 76%);
        animation: relay-scene-drift 28s linear infinite alternate;
      }

      html.relay-scene-climbing .relay-scene {
        opacity: .64;
        background:
          radial-gradient(circle at 14% 22%, rgba(121, 196, 107, 0.12), transparent 22%),
          radial-gradient(circle at 84% 74%, rgba(255, 226, 143, 0.07), transparent 26%),
          linear-gradient(160deg, rgba(121, 196, 107, 0.04), transparent 36%, rgba(255, 226, 143, 0.02));
      }
      html.relay-scene-climbing .relay-scene::before {
        background:
          repeating-linear-gradient(135deg, rgba(121, 196, 107, 0.05) 0 2px, transparent 2px 28px),
          repeating-linear-gradient(45deg, transparent 0 18px, rgba(255, 226, 143, 0.04) 18px 19px, transparent 19px 60px);
        animation: relay-scene-sweep 32s linear infinite;
      }
      html.relay-scene-climbing .relay-scene::after {
        background: radial-gradient(circle at 50% 50%, rgba(121, 196, 107, 0.09), transparent 58%);
        animation: relay-scene-pulse 12s ease-in-out infinite;
      }

      html.relay-scene-training .relay-scene {
        opacity: .62;
        background:
          radial-gradient(circle at 50% 20%, rgba(252, 76, 2, 0.10), transparent 26%),
          radial-gradient(circle at 20% 82%, rgba(252, 76, 2, 0.06), transparent 22%),
          linear-gradient(180deg, rgba(252, 76, 2, 0.02), transparent 30%, rgba(252, 76, 2, 0.01));
      }
      html.relay-scene-training .relay-scene::before {
        background:
          repeating-linear-gradient(90deg, rgba(252, 76, 2, 0.05) 0 3px, transparent 3px 38px),
          repeating-linear-gradient(0deg, rgba(252, 76, 2, 0.04) 0 1px, transparent 1px 26px);
        animation: relay-scene-sweep 18s linear infinite;
      }
      html.relay-scene-training .relay-scene::after {
        background: radial-gradient(circle at 50% 50%, rgba(252, 76, 2, 0.07), transparent 60%);
        animation: relay-scene-wave 14s ease-in-out infinite;
      }

      html.relay-scene-exploration .relay-scene {
        opacity: .56;
        background:
          radial-gradient(circle at 18% 16%, rgba(122, 92, 255, 0.11), transparent 24%),
          radial-gradient(circle at 82% 22%, rgba(77, 201, 255, 0.08), transparent 24%),
          radial-gradient(circle at 48% 78%, rgba(122, 92, 255, 0.06), transparent 28%);
      }
      html.relay-scene-exploration .relay-scene::before {
        background:
          repeating-radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.10) 0 1px, transparent 2px 52px),
          linear-gradient(120deg, transparent 0 42%, rgba(160, 140, 255, 0.07) 50%, transparent 58%);
        animation: relay-scene-roll 60s linear infinite alternate;
      }
      html.relay-scene-exploration .relay-scene::after {
        background: radial-gradient(circle at 50% 50%, rgba(122, 92, 255, 0.08), transparent 60%);
        animation: relay-scene-pulse 12s ease-in-out infinite;
      }

      html.relay-scene-gaming .relay-scene {
        opacity: .62;
        background:
          radial-gradient(circle at 50% 18%, rgba(65, 211, 232, 0.09), transparent 24%),
          radial-gradient(circle at 18% 80%, rgba(255, 106, 85, 0.08), transparent 20%),
          radial-gradient(circle at 82% 78%, rgba(239, 164, 42, 0.06), transparent 22%);
      }
      html.relay-scene-gaming .relay-scene::before {
        background:
          repeating-linear-gradient(90deg, rgba(65, 211, 232, 0.06) 0 1px, transparent 1px 78px),
          repeating-linear-gradient(0deg, rgba(65, 211, 232, 0.04) 0 1px, transparent 1px 78px);
        animation: relay-scene-sweep 40s linear infinite;
      }
      html.relay-scene-gaming .relay-scene::after {
        background:
          radial-gradient(circle at 50% 46%, rgba(255, 106, 85, 0.09), transparent 18%),
          radial-gradient(circle at 20% 30%, rgba(239, 164, 42, 0.07), transparent 24%);
        animation: relay-scene-pulse 10s ease-in-out infinite;
      }

      html.relay-scene-workbench .relay-scene {
        opacity: .64;
        background:
          radial-gradient(circle at 14% 18%, rgba(255, 210, 77, 0.09), transparent 20%),
          radial-gradient(circle at 84% 82%, rgba(143, 165, 207, 0.09), transparent 24%),
          linear-gradient(180deg, rgba(232, 238, 252, 0.015), transparent 28%, rgba(255, 210, 77, 0.01));
      }
      html.relay-scene-workbench .relay-scene::before {
        background:
          repeating-linear-gradient(90deg, rgba(232, 238, 252, 0.08) 0 1px, transparent 1px 24px),
          repeating-linear-gradient(0deg, rgba(232, 238, 252, 0.06) 0 1px, transparent 1px 24px);
        animation: relay-scene-sweep 34s linear infinite;
      }
      html.relay-scene-workbench .relay-scene::after {
        background: linear-gradient(135deg, transparent 0 44%, rgba(255, 210, 77, 0.08) 50%, transparent 56%);
        animation: relay-scene-drift 22s linear infinite alternate;
      }

      html.relay-scene-captures .relay-scene {
        opacity: .60;
        background:
          radial-gradient(circle at 50% 0%, rgba(226, 103, 63, 0.12), transparent 24%),
          radial-gradient(circle at 16% 22%, rgba(226, 103, 63, 0.06), transparent 18%),
          radial-gradient(circle at 84% 78%, rgba(216, 211, 202, 0.05), transparent 20%);
      }
      html.relay-scene-captures .relay-scene::before {
        background:
          repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.02) 0 1px, transparent 1px 4px),
          linear-gradient(180deg, transparent 0 42%, rgba(226, 103, 63, 0.04) 56%, transparent 78%);
        animation: relay-scene-wave 16s ease-in-out infinite;
      }
      html.relay-scene-captures .relay-scene::after {
        background: radial-gradient(circle at 50% 50%, rgba(226, 103, 63, 0.08), transparent 62%);
        animation: relay-scene-pulse 13s ease-in-out infinite;
      }

      html.relay-scene-log .relay-scene {
        opacity: .60;
        background:
          radial-gradient(circle at 82% 10%, rgba(255, 138, 224, 0.08), transparent 18%),
          radial-gradient(circle at 18% 86%, rgba(255, 138, 224, 0.05), transparent 20%),
          linear-gradient(180deg, rgba(255, 138, 224, 0.02), transparent 30%, rgba(255, 138, 224, 0.01));
      }
      html.relay-scene-log .relay-scene::before {
        background:
          repeating-linear-gradient(0deg, rgba(255, 138, 224, 0.04) 0 1px, transparent 1px 7px),
          repeating-linear-gradient(90deg, rgba(255, 138, 224, 0.02) 0 1px, transparent 1px 68px);
        animation: relay-scene-sweep 28s linear infinite;
      }
      html.relay-scene-log .relay-scene::after {
        background: radial-gradient(circle at 50% 50%, rgba(255, 138, 224, 0.07), transparent 60%);
        animation: relay-scene-pulse 10s ease-in-out infinite;
      }

      html.relay-scene-apex .relay-scene {
        opacity: .64;
        background:
          radial-gradient(circle at 50% 22%, rgba(65, 211, 232, 0.08), transparent 26%),
          radial-gradient(circle at 18% 78%, rgba(232, 66, 47, 0.07), transparent 20%),
          radial-gradient(circle at 82% 74%, rgba(255, 194, 40, 0.06), transparent 22%);
      }
      html.relay-scene-apex .relay-scene::before {
        background:
          repeating-linear-gradient(60deg, rgba(65, 211, 232, 0.05) 0 1px, transparent 1px 18px),
          repeating-linear-gradient(120deg, rgba(232, 66, 47, 0.04) 0 1px, transparent 1px 18px);
        animation: relay-scene-roll 48s linear infinite alternate;
      }
      html.relay-scene-apex .relay-scene::after {
        background: radial-gradient(circle at 50% 46%, rgba(232, 66, 47, 0.08), transparent 24%);
        animation: relay-scene-pulse 12s ease-in-out infinite;
      }

      html.relay-scene-signal .relay-scene {
        opacity: .58;
        background:
          radial-gradient(circle at 50% 32%, rgba(255, 59, 48, 0.12), transparent 24%),
          radial-gradient(circle at 50% 62%, rgba(255, 176, 0, 0.06), transparent 28%);
      }
      html.relay-scene-signal .relay-scene::before {
        background: repeating-linear-gradient(135deg, rgba(255, 59, 48, 0.08) 0 12px, rgba(255, 176, 0, 0.05) 12px 24px);
        animation: relay-scene-sweep 18s linear infinite;
      }
      html.relay-scene-signal .relay-scene::after {
        background: radial-gradient(circle at 50% 50%, rgba(255, 59, 48, 0.10), transparent 52%);
        animation: relay-scene-pulse 10s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);

    document.documentElement.classList.add(`relay-scene-${scene}`);
    const layer = document.createElement("div");
    layer.className = "relay-scene";
    layer.setAttribute("aria-hidden", "true");
    document.body.prepend(layer);
  }

  // ─── room menu (mobile) ──────────────────────────────────────────────
  // Every room's nav lists the same rooms, and on a phone that list either
  // wrapped to three rows or scrolled a screen-width off-side with nothing to
  // say more existed. This injects the toggle button — the *behaviour* is
  // shared here so there aren't nine copies of it; the *styling* stays in each
  // room's own <style>, which is the whole point of the site.
  //
  // Each page styles:
  //   .roomnav-toggle              the button (hidden above the room's own breakpoint)
  //   nav[data-roomnav]            the collapsed nav
  //   nav[data-roomnav].roomnav-open   the open nav
  // With JS off nothing is injected and the nav renders exactly as before.
  function installRoomMenu() {
    const nav = document.querySelector('nav[aria-label="Terminal rooms"]');
    if (!nav || nav.dataset.roomnav) return;

    nav.dataset.roomnav = "collapsible";
    if (!nav.id) nav.id = "room-nav";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "roomnav-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", nav.id);
    // the room you're in, so the collapsed header still says where you are
    const here = nav.querySelector(".here")?.textContent.trim();
    toggle.innerHTML = `<span class="roomnav-toggle-bars" aria-hidden="true"></span><span class="roomnav-toggle-label">${here || "rooms"}</span>`;
    nav.parentNode.insertBefore(toggle, nav);

    const setOpen = (open) => {
      nav.classList.toggle("roomnav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };

    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("roomnav-open")));
    nav.addEventListener("click", (event) => { if (event.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !nav.classList.contains("roomnav-open")) return;
      setOpen(false);
      toggle.focus();
    });
    document.addEventListener("click", (event) => {
      if (!nav.classList.contains("roomnav-open")) return;
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      setOpen(false);
    });
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

  /* A game that wants Mochi and nothing else says so with
     <html data-mochi-only>. KONDRITE is the one that does: a trip mode is a
     filter over every element on the page, which over a full-screen canvas is
     a second renderer fighting the first. So none of it starts here — no
     filters, no scene, no menu, no link rewriting — and the saved mode is left
     alone rather than cleared, so it is still on when the player goes back to
     the site. */
  const mochiOnly = document.documentElement.hasAttribute("data-mochi-only");

  function start() {
    if (mochiOnly) {
      if (recallCats()) setCats(true, false);
      return;
    }
    installFilters();
    cleanIndexRoutes();
    installRoomScene();
    installRoomMenu();
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
