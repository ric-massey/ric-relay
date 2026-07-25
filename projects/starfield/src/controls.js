/* ══════════════════════════════════════════════════════════════════════
   controls.js — the keymap, and the fact that it belongs to the player.

   The game used to test event.code directly, scattered across game.js:
   `pressed.has("Space")`, `code === "KeyJ"`, an array literal of the four
   arrows. That works exactly once, for one keyboard layout, for one set of
   hands. Every binding now goes through an ACTION here, game.js never sees
   a key code, and the whole map is rebindable and persisted.

   THE SHIP HAS SIX DEGREES OF FREEDOM, so the default map is a flight map
   rather than a pair of throttle keys:

     rotate     ← → ↑ ↓ yaw/pitch          Q E   roll
     drive      W thrust forward  S thrust back  B full stop  Shift boost
     translate  A D strafe                R F   up/down
     gears      1…6 select     [ ] shift        J punch it   Tab chart

   THE SHIP HAS MOMENTUM, so rotating and thrusting are genuinely different
   actions: the arrows turn the NOSE, W pushes your velocity toward wherever
   the nose is pointing, and nothing you do with the arrows changes where you
   are already going. Turn round mid-flight and you are still travelling the
   old way, looking the new way.

   Rotation and translation are deliberately separate. Pointing the nose
   somewhere is not the same as going there — that gap is the whole feel of
   flying in vacuum, and it is why the heading marker exists.

   Two bindings per action, so Space can keep working as "forward" for
   anyone who learned the old controls, and so a rebind never strands you
   with an unreachable action.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});

  const STORAGE_KEY = "starfield.controls.v1";

  // One "select gear N" action per gear the engine actually has, named after
  // it, bound to the matching digit. Generated rather than typed out so adding
  // a gear in constants.js cannot leave this list — or the settings panel, or
  // the hint line, all of which read it — describing the old gearbox.
  const GEAR_ACTIONS = ((SF.FUDGE && SF.FUDGE.gears) || []).map((gear, i) => ({
    id: `gear${i + 1}`,
    label: `Gear ${i + 1} · ${gear.name}`,
    group: "Gears",
    keys: i < 9 ? [`Digit${i + 1}`] : [],
  }));

  // group is only used to lay the settings panel out in readable blocks.
  const ACTIONS = [
    { id: "pitchUp",     label: "Pitch up",        group: "Rotate",    keys: ["ArrowUp"] },
    { id: "pitchDown",   label: "Pitch down",      group: "Rotate",    keys: ["ArrowDown"] },
    { id: "yawLeft",     label: "Yaw left",        group: "Rotate",    keys: ["ArrowLeft"] },
    { id: "yawRight",    label: "Yaw right",       group: "Rotate",    keys: ["ArrowRight"] },
    { id: "rollLeft",    label: "Roll left",       group: "Rotate",    keys: ["KeyQ"] },
    { id: "rollRight",   label: "Roll right",      group: "Rotate",    keys: ["KeyE"] },

    { id: "thrustFwd",   label: "Thrust forward",  group: "Translate", keys: ["KeyW", "Space"] },
    { id: "thrustBack",  label: "Thrust back",     group: "Translate", keys: ["KeyS"] },
    { id: "strafeLeft",  label: "Strafe left",     group: "Translate", keys: ["KeyA"] },
    { id: "strafeRight", label: "Strafe right",    group: "Translate", keys: ["KeyD"] },
    { id: "thrustUp",    label: "Thrust up",       group: "Translate", keys: ["KeyR"] },
    { id: "thrustDown",  label: "Thrust down",     group: "Translate", keys: ["KeyF"] },
    { id: "boost",       label: "Boost",           group: "Translate", keys: ["ShiftLeft", "ShiftRight"] },
    { id: "killVel",     label: "Full stop",       group: "Translate", keys: ["KeyB"] },

    // There is no speed lock any more: the drive holds whatever speed it is at
    // the moment you let go of the pedal, so there is nothing left to lock.
    ...GEAR_ACTIONS,
    { id: "gearDown",    label: "Shift down",          group: "Gears", keys: ["BracketLeft"] },
    { id: "gearUp",      label: "Shift up",            group: "Gears", keys: ["BracketRight"] },
    { id: "jump",        label: "Punch to top gear",   group: "Gears", keys: ["KeyJ"] },

    { id: "chart",       label: "Star chart",      group: "Ship",      keys: ["Tab"] },
    { id: "pause",       label: "Pause",           group: "Ship",      keys: ["KeyP"] },
    { id: "ledger",      label: "Honesty ledger",  group: "Ship",      keys: ["KeyL"] },
    { id: "sound",       label: "Sound on/off",    group: "Ship",      keys: ["KeyM"] },
    { id: "bindings",    label: "Edit controls",   group: "Ship",      keys: ["KeyK"] },
  ];

  // Actions that fire once on press rather than being held. game.js consults
  // this so a rebind cannot accidentally turn the chart into a held control.
  const EDGE = new Set([
    "jump", "chart", "pause", "ledger", "sound", "bindings",
    "gearUp", "gearDown",
    ...GEAR_ACTIONS.map((a) => a.id),
  ]);

  // Keys the page must not hand to the browser while flying.
  const SWALLOW = new Set(["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

  /** event.code → something a human recognises on a settings row. */
  function keyName(code) {
    if (!code) return "—";
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
    const named = {
      ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
      Space: "Space", ShiftLeft: "Shift", ShiftRight: "R-Shift",
      ControlLeft: "Ctrl", ControlRight: "R-Ctrl", AltLeft: "Alt", AltRight: "R-Alt",
      Escape: "Esc", Enter: "Enter", Tab: "Tab", Backquote: "`",
      Minus: "−", Equal: "=", BracketLeft: "[", BracketRight: "]",
      Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\",
    };
    return named[code] || code;
  }

  const Controls = SF.controls = {
    actions: ACTIONS,
    /** actionId → array of event.code. Replaced wholesale by load/reset. */
    map: {},
    pressed: new Set(),
    /** code → [actionId], rebuilt whenever the map changes. */
    _reverse: {},

    init() {
      Controls.load();
    },

    defaults() {
      const out = {};
      for (const a of ACTIONS) out[a.id] = [...a.keys];
      return out;
    },

    load() {
      const map = Controls.defaults();
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          // Only adopt keys for actions that still exist, so an old save
          // cannot resurrect a binding for an action that has been removed.
          for (const a of ACTIONS) {
            if (Array.isArray(saved[a.id])) map[a.id] = saved[a.id].filter((c) => typeof c === "string");
          }
        }
      } catch { /* private mode, corrupt JSON — defaults are fine */ }
      Controls.map = map;
      Controls.reindex();
    },

    save() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Controls.map)); } catch { /* ignore */ }
    },

    reset() {
      Controls.map = Controls.defaults();
      Controls.reindex();
      Controls.save();
    },

    reindex() {
      const rev = {};
      for (const a of ACTIONS) {
        for (const code of Controls.map[a.id] || []) (rev[code] ||= []).push(a.id);
      }
      Controls._reverse = rev;
    },

    /** Bind `code` to `slot` (0 or 1) of an action, stealing it from any other. */
    bind(actionId, slot, code) {
      for (const a of ACTIONS) {
        if (a.id === actionId) continue;
        const keys = Controls.map[a.id];
        const at = keys.indexOf(code);
        if (at !== -1) keys.splice(at, 1);
      }
      const keys = Controls.map[actionId] || (Controls.map[actionId] = []);
      keys[slot] = code;
      Controls.map[actionId] = keys.filter(Boolean);
      Controls.reindex();
      Controls.save();
    },

    clearSlot(actionId, slot) {
      const keys = Controls.map[actionId] || [];
      keys.splice(slot, 1);
      Controls.reindex();
      Controls.save();
    },

    actionsFor(code) { return Controls._reverse[code] || []; },
    isEdge(actionId) { return EDGE.has(actionId); },
    shouldSwallow(code) { return SWALLOW.has(code) && Controls.actionsFor(code).length > 0; },
    keyName,

    keysFor(actionId) { return Controls.map[actionId] || []; },
    /** "W / Space" for a hint line. */
    labelFor(actionId) {
      const keys = Controls.keysFor(actionId);
      return keys.length ? keys.map(keyName).join(" / ") : "—";
    },

    down(actionId) {
      for (const code of Controls.map[actionId] || []) {
        if (Controls.pressed.has(code)) return true;
      }
      return false;
    },

    /** −1 / 0 / +1 from a pair of opposed actions. */
    axis(negId, posId) {
      return (Controls.down(posId) ? 1 : 0) - (Controls.down(negId) ? 1 : 0);
    },

    press(code) { Controls.pressed.add(code); },
    release(code) { Controls.pressed.delete(code); },
    releaseAll() { Controls.pressed.clear(); },
  };
})();
