/* ══════════════════════════════════════════════════════════════════════
   controls-ui.js — the rebinding panel, and the hint line.

   Two surfaces over SF.controls, kept here so controls.js stays a pure
   keymap with no DOM in it:

     the hint line   generated from the live map, so rebinding a key
                     updates the prompt at the bottom of the screen instead
                     of leaving it quietly lying to the player.
     the panel       click a key, press a new one. Rows are built from
                     SF.controls.actions, so an action added to the game
                     cannot forget to appear here.

   Capture is deliberately greedy: while the panel is waiting for a key,
   every keydown belongs to it. Otherwise rebinding "pause" to P would
   pause the game on the way past.
   ══════════════════════════════════════════════════════════════════════ */
(() => {
  "use strict";
  const SF = (window.SF ||= {});
  const CTRL = SF.controls;

  const el = (id) => document.getElementById(id);

  // action id → which slot is currently listening, or null when idle.
  let listening = null;

  const UI = SF.bindings = {
    /** True if the panel swallowed the key. */
    capture(code, event) {
      if (!listening) return false;
      event.preventDefault();
      if (code === "Escape") { listening = null; UI.render(); return true; }
      CTRL.bind(listening.action, listening.slot, code);
      listening = null;
      UI.render();
      UI.renderHint();
      return true;
    },

    open() {
      const panel = el("bindings");
      if (!panel) return;
      listening = null;
      UI.render();
      panel.hidden = false;
      if (SF.state && !SF.state.paused) SF.state.paused = true;
    },

    /** Returns true if it actually closed something, so Escape can chain. */
    close() {
      const panel = el("bindings");
      if (!panel || panel.hidden) return false;
      if (listening) { listening = null; UI.render(); return true; }
      panel.hidden = true;
      if (SF.state) SF.state.paused = false;
      return true;
    },

    isOpen() {
      const panel = el("bindings");
      return !!panel && !panel.hidden;
    },

    render() {
      const body = el("bindings-body");
      if (!body) return;
      body.innerHTML = "";

      let group = null;
      let list = null;
      for (const action of CTRL.actions) {
        if (action.group !== group) {
          group = action.group;
          const heading = document.createElement("h3");
          heading.className = "bind-group";
          heading.textContent = group;
          body.appendChild(heading);
          list = document.createElement("div");
          list.className = "bind-list";
          body.appendChild(list);
        }
        const row = document.createElement("div");
        row.className = "bind-row";

        const label = document.createElement("span");
        label.className = "bind-label";
        label.textContent = action.label;
        row.appendChild(label);

        const keys = document.createElement("span");
        keys.className = "bind-keys";
        // Two slots always shown: an empty one is an invitation to add an
        // alternate rather than a gap the player has to guess is clickable.
        for (let slot = 0; slot < 2; slot += 1) {
          const code = CTRL.keysFor(action.id)[slot];
          const button = document.createElement("button");
          button.type = "button";
          button.className = "bind-key";
          const waiting = listening && listening.action === action.id && listening.slot === slot;
          button.dataset.state = waiting ? "listening" : code ? "set" : "empty";
          button.textContent = waiting ? "press a key…" : code ? CTRL.keyName(code) : "+";
          button.addEventListener("click", () => {
            listening = { action: action.id, slot };
            UI.render();
          });
          keys.appendChild(button);
        }
        row.appendChild(keys);
        list.appendChild(row);
      }
    },

    /**
     * The bottom-of-screen prompt. Only the handful of controls worth
     * naming — the full map lives in the panel.
     */
    renderHint() {
      const hint = el("hint");
      if (!hint) return;
      hint.textContent = "";

      // Built as DOM rather than parsed out of a string: the keys are player
      // data and could be anything after a rebind, so there is no pattern
      // safe to match them by.
      const line = () => {
        const span = document.createElement("span");
        hint.appendChild(span);
        return span;
      };
      const text = (parent, s) => parent.appendChild(document.createTextNode(s));
      const keys = (parent, actionId, max = 2) => {
        const codes = CTRL.keysFor(actionId).slice(0, max);
        if (!codes.length) { text(parent, "—"); return; }
        for (const code of codes) {
          const kbd = document.createElement("kbd");
          kbd.textContent = CTRL.keyName(code);
          parent.appendChild(kbd);
        }
      };

      const rotate = line();
      text(rotate, "rotate: ");
      for (const id of ["yawLeft", "yawRight", "pitchUp", "pitchDown"]) keys(rotate, id, 1);
      text(rotate, " roll ");
      for (const id of ["rollLeft", "rollRight"]) keys(rotate, id, 1);

      // The drive, said the way it behaves: accelerate, brake into reverse, and
      // the fact that letting go of both is how you hold a speed. That last
      // clause is the whole reason the speed lock could be deleted, so it is
      // worth the words on the hint line.
      const drive = line();
      keys(drive, "thrustFwd", 1);
      text(drive, " faster ");
      keys(drive, "thrustBack", 1);
      text(drive, " slower / reverse · release to hold speed");

      const move = line();
      text(move, "thrusters: ");
      for (const id of ["strafeLeft", "strafeRight"]) keys(move, id, 1);
      text(move, " strafe ");
      for (const id of ["thrustUp", "thrustDown"]) keys(move, id, 1);
      text(move, " up/down · ");
      keys(move, "killVel", 1);
      text(move, " full stop · ");
      keys(move, "boost", 1);
      text(move, " boost");

      // One key per gear the engine actually has, straight off the action list.
      const gearIds = CTRL.actions
        .filter((a) => /^gear\d+$/.test(a.id))
        .map((a) => a.id);
      const gears = line();
      text(gears, "gears: ");
      for (const id of gearIds) keys(gears, id, 1);
      text(gears, " · ");
      for (const id of ["gearDown", "gearUp"]) keys(gears, id, 1);
      text(gears, " shift · ");
      keys(gears, "jump", 1);
      text(gears, " punch it");

      const misc = line();
      keys(misc, "chart", 1);
      text(misc, " chart · ");
      keys(misc, "bindings", 1);
      text(misc, " controls · ");
      keys(misc, "pause", 1);
      text(misc, " pause");

      const legend = line();
      legend.className = "legend";
      const pip = (cls, label) => {
        const b = document.createElement("b");
        b.className = cls;
        legend.appendChild(b);
        text(legend, ` ${label}  `);
      };
      pip("dot-heading", "heading");
      pip("dot-target", "destination");
    },

    init() {
      el("bindings-close")?.addEventListener("click", () => UI.close());
      el("bindings-reset")?.addEventListener("click", () => {
        CTRL.reset();
        listening = null;
        UI.render();
        UI.renderHint();
      });
      el("controls-open")?.addEventListener("click", () => UI.open());
      UI.renderHint();
    },
  };
})();
