/* ══════════════════════════════════════════════════════════════════════
   bindings.js — the action catalogue, and what is bound to what.

   Controls §1.1 is unusually clear about which parts of the prototype to
   keep: input is **action-based** rather than a scatter of key checks,
   bindings are saved and rebindable, and the help text is generated from
   the same mapping so it cannot drift out of date. All three survive here.
   What changes is that nothing below knows about a keyboard — a binding is
   a physical key *code*, and the device adapters are what turn events into
   the actions named here.

   Two things §7 asks for that the prototype only had implicitly:

     · **two binding slots per action**, so a player can keep the default
       and add their own without choosing between them;
     · **versioned storage with migrations.** The audit's note is that the
       old schema was implicit, which means the first time the action list
       changes, every saved binding either breaks or silently rots. The
       version below is checked on load and a mismatch falls back to
       defaults rather than merging two incompatible shapes.

   Codes are physical (`KeyW`, not `"w"`), because a binding that reads
   "W" on a QWERTY keyboard and lands under the player's little finger on
   AZERTY is not a binding, it is a bug report waiting to happen.
   ══════════════════════════════════════════════════════════════════════ */

const STORAGE_KEY = "starfield.bindings";
const SCHEMA_VERSION = 1;

/**
 * Every action the slice actually implements, in the order the help screen
 * shows them.
 *
 * Actions that Controls §3 lists but the build does not yet have — landing
 * mode, photography — are deliberately absent rather than present and
 * inert. The help is generated from this list, so an entry here is a
 * promise that the key does something. Autopilot and the travel modes left
 * that waiting list on 2026-07-26 and are bound because they now fly; the
 * map left it the same day and is bound to Tab, which is the key Controls
 * §5 already assigned it.
 *
 * `kind` tells the adapters how to sample it:
 *   axis    held; contributes continuously while down
 *   hold    held; a modifier that is true while down
 *   press   edge-triggered; fires once per press
 */
export const ACTIONS = [
  // ── flight ──
  { id: "thrustForward", group: "flight", kind: "axis", label: "Thrust forward", keys: ["KeyW"] },
  { id: "thrustBack", group: "flight", kind: "axis", label: "Thrust back", keys: ["KeyS"] },
  { id: "strafeLeft", group: "flight", kind: "axis", label: "Strafe left", keys: ["KeyA"] },
  { id: "strafeRight", group: "flight", kind: "axis", label: "Strafe right", keys: ["KeyD"] },
  { id: "thrustUp", group: "flight", kind: "axis", label: "Thrust up", keys: ["Space"] },
  { id: "thrustDown", group: "flight", kind: "axis", label: "Thrust down", keys: ["ControlLeft", "ControlRight"] },
  { id: "rollLeft", group: "flight", kind: "axis", label: "Roll left", keys: ["KeyQ"] },
  { id: "rollRight", group: "flight", kind: "axis", label: "Roll right", keys: ["KeyE"] },
  { id: "throttleUp", group: "flight", kind: "axis", label: "Throttle up", keys: ["ShiftLeft", "ShiftRight"] },
  { id: "throttleDown", group: "flight", kind: "axis", label: "Throttle down", keys: ["AltLeft", "AltRight"] },
  { id: "precision", group: "flight", kind: "hold", label: "Precision mode", keys: ["KeyZ"] },
  { id: "fullStop", group: "flight", kind: "press", label: "Full stop / hold position", keys: ["KeyX"] },
  { id: "matchVelocity", group: "flight", kind: "press", label: "Match velocity with target", keys: ["KeyB"] },
  { id: "overrideSafety", group: "flight", kind: "press", label: "Override safety assist", keys: ["KeyO"] },

  // ── aim and view ──
  { id: "pitchUp", group: "view", kind: "axis", label: "Pitch up", keys: ["ArrowUp"] },
  { id: "pitchDown", group: "view", kind: "axis", label: "Pitch down", keys: ["ArrowDown"] },
  { id: "yawLeft", group: "view", kind: "axis", label: "Yaw left", keys: ["ArrowLeft"] },
  { id: "yawRight", group: "view", kind: "axis", label: "Yaw right", keys: ["ArrowRight"] },
  /* Zoom moved off F and C.
​
     Controls §3.2 gives F to autopilot and C to the camera, and both had
     been quietly taken by the zoom controls — so the two actions at the
     centre of the navigation workflow had nowhere to live, and the spec
     and the build disagreed about a key without anyone noticing.
​
     R keeps zoom-in because §3.2 names it. The rest go to the −/+/0 idiom
     every map and every image viewer already uses, which leaves G free for
     landing and hover, and Digit1–Digit4 free for the flight modes. */
  { id: "zoomIn", group: "view", kind: "press", label: "Zoom in", keys: ["KeyR", "Equal"] },
  { id: "zoomOut", group: "view", kind: "press", label: "Zoom out", keys: ["Minus"] },
  { id: "zoomReset", group: "view", kind: "press", label: "Reset zoom", keys: ["Digit0"] },
  { id: "mouseLook", group: "view", kind: "press", label: "Mouse look (pointer lock)", keys: ["KeyM"] },

  // ── targeting and information ──
  { id: "autopilot", group: "flight", kind: "press", label: "Autopilot engage / disengage", keys: ["KeyF"] },
  /* Travel modes (Controls §2.4). Named for the place, not the speed —
     the label is what the player reads when they wonder what 3 does. */
  { id: "mode1", group: "flight", kind: "press", label: "Mode 1 — Local", keys: ["Digit1"] },
  { id: "mode2", group: "flight", kind: "press", label: "Mode 2 — Orbital", keys: ["Digit2"] },
  { id: "mode3", group: "flight", kind: "press", label: "Mode 3 — System", keys: ["Digit3"] },
  { id: "mode4", group: "flight", kind: "press", label: "Mode 4 — Interstellar", keys: ["Digit4"] },
  { id: "mode5", group: "flight", kind: "press", label: "Mode 5 — Intergalactic", keys: ["Digit5"] },
  /* The map is one of the game's two primary surfaces (Design Bible §13),
     so it gets the key the controls spec reserved for it rather than
     whatever was left over. */
  { id: "map", group: "info", kind: "press", label: "Star map", keys: ["Tab"] },
  { id: "cycleTarget", group: "info", kind: "press", label: "Cycle nearby targets", keys: ["KeyT"] },
  { id: "cyclePreset", group: "info", kind: "press", label: "Cycle cockpit preset", keys: ["KeyV"] },
  { id: "targetInfo", group: "info", kind: "press", label: "Object information", keys: ["KeyI"] },
  { id: "ledger", group: "info", kind: "press", label: "Where we cheat", keys: ["KeyL"] },
  { id: "help", group: "info", kind: "press", label: "Controls reference", keys: ["KeyH"] },
  { id: "pause", group: "info", kind: "press", label: "Pause", keys: ["KeyP"] },
  { id: "menu", group: "info", kind: "press", label: "Menu / close panel", keys: ["Escape"] },
];

export const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));

/** Defaults as a plain {actionId: [code, code]} map, two slots per action. */
export function defaultBindings() {
  const out = {};
  for (const a of ACTIONS) out[a.id] = [...a.keys].slice(0, 2);
  return out;
}

/**
 * Load saved bindings, or the defaults.
 *
 * A version mismatch throws the saved set away rather than merging it.
 * That is a deliberate choice over a clever migration: a half-migrated
 * binding map is a control scheme that is wrong in one place, and the
 * player will not know which. Losing custom bindings once, visibly, is the
 * kinder failure.
 */
export function loadBindings(storage = globalThis.localStorage) {
  const fallback = defaultBindings();
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw);
    if (saved?.version !== SCHEMA_VERSION) return fallback;
    // Any action added since the save keeps its default.
    return { ...fallback, ...saved.bindings };
  } catch {
    return fallback;
  }
}

export function saveBindings(bindings, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, bindings }));
    return true;
  } catch {
    return false;   // private browsing; the scheme still works, it just does not persist
  }
}

export function resetBindings(storage = globalThis.localStorage) {
  try { storage?.removeItem(STORAGE_KEY); } catch { /* nothing to do */ }
  return defaultBindings();
}

/**
 * Bind `code` to `actionId` in slot 0 or 1, removing it from wherever else
 * it was — one key cannot mean two things, and silently allowing it is how
 * a rebinding screen produces a scheme the player cannot use.
 *
 * @returns {{bindings:object, displaced:Array<{action:string, slot:number}>}}
 */
export function bindKey(bindings, actionId, code, slot = 0) {
  const next = {};
  const displaced = [];
  for (const [id, codes] of Object.entries(bindings)) {
    const copy = [...codes];
    for (let i = 0; i < copy.length; i++) {
      if (copy[i] === code && !(id === actionId && i === slot)) {
        copy[i] = null;
        displaced.push({ action: id, slot: i });
      }
    }
    next[id] = copy;
  }
  const target = [...(next[actionId] || [])];
  target[slot] = code;
  next[actionId] = target;
  return { bindings: next, displaced };
}

/** Reverse index: physical code → the action it triggers. */
export function codeIndex(bindings) {
  const index = new Map();
  for (const [id, codes] of Object.entries(bindings)) {
    for (const code of codes) if (code) index.set(code, id);
  }
  return index;
}

/**
 * The controls reference, generated from the live mapping.
 *
 * Controls §7 requires this rather than a hand-written list, and the
 * reason is not tidiness: a hand-written help screen is wrong the first
 * time anybody rebinds anything, and it is wrong in the one place the
 * player goes when they are already confused.
 */
export function describeBindings(bindings) {
  const groups = { flight: [], view: [], info: [] };
  for (const a of ACTIONS) {
    // De-duplicated: the left and right Ctrl keys are two bindings and one
    // key as far as a player is concerned, and "Ctrl / Ctrl" reads as a bug.
    const codes = [...new Set((bindings[a.id] || []).filter(Boolean).map(prettyCode))];
    groups[a.group].push({ id: a.id, label: a.label, keys: codes, kind: a.kind });
  }
  return groups;
}

/** A physical code as something a player would recognise on their keyboard. */
export function prettyCode(code) {
  if (!code) return "—";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return ({
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
    Space: "Space", Escape: "Esc", Tab: "Tab", Enter: "Enter",
    ShiftLeft: "Shift", ShiftRight: "Shift", ControlLeft: "Ctrl", ControlRight: "Ctrl",
    AltLeft: "Alt", AltRight: "Alt", MetaLeft: "Cmd", MetaRight: "Cmd",
  })[code] || code;
}

export { SCHEMA_VERSION, STORAGE_KEY };
