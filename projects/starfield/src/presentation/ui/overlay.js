/* ══════════════════════════════════════════════════════════════════════
   overlay.js — the information layer on the glass.

   HUD and Cockpit §3: **vitals anchor to the frame, labels float on the
   glass.** Vitals never move, because their position is muscle memory.
   Labels are anchored by projecting a world position to screen space and
   drawing ordinary DOM there — the "ring around a star carrying its name
   and distance" that §1 describes.

   §4 governs how much of this appears: the selected target is always
   labelled, a few genuinely notable objects are, and everything else is
   labelled on demand. Real catalogues could put thousands of labels on
   screen and that would destroy the emptiness the project exists to
   convey.

   Every element here is real DOM (§10) so assistive technology can reach
   it, and no state is carried by colour alone (§8).
   ══════════════════════════════════════════════════════════════════════ */

import { buildCanopy, PRESETS, migratePreset } from "./canopy.js";
import { formatDistance, formatSpeed, formatAngle, formatDuration } from "../../simulation/core/units.js";
import { formatElapsed } from "../../simulation/time/time-service.js";
import { SOURCES, sourcesFor } from "../../data/sources.js";
import { LEDGER, ledgerFor } from "../../data/honesty-ledger.js";

/** Scientific Standard §2 classes, in the words a player needs. */
export const PROVENANCE = {
  M: { label: "measured", detail: "Taken from an observation, catalogue or published constant." },
  C: { label: "calculated", detail: "Derived from measured values with a stated model." },
  K: { label: "constrained", detail: "Not directly measured here, but bounded by known science." },
  P: { label: "generated", detail: "Generated where nature is not known. Never presented as observation." },
  F: { label: "fictional", detail: "Invented so the experience is possible. Labelled, never disguised as science." },
  A: { label: "display aid", detail: "Makes real information legible without changing it." },
};

const h = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
};

const chip = (cls) =>
  h("span", {
    class: `sf-chip sf-chip--${cls}`,
    title: `${PROVENANCE[cls].label} — ${PROVENANCE[cls].detail}`,
  }, cls);

export class Overlay {
  /**
   * @param {HTMLElement} root
   * @param {object} handlers
   * @param {(id:string)=>void} handlers.onSelect
   * @param {(open:boolean)=>void} handlers.onModal  fired so the app can pause
   */
  constructor(root, handlers = {}) {
    this.root = root;
    this.handlers = handlers;
    this.preset = "luxury";
    this.labelDensity = "sparse";
    this._labelNodes = new Map();
    this._build();
  }

  _build() {
    this.canopyHost = h("div", { class: "sf-canopy-host" });
    this.canopyHost.append(buildCanopy(this.preset));

    this.labelLayer = h("div", { class: "sf-labels" });

    /* ── anchored vitals: clocks ─────────────────────────────────────── */
    this.clockUtc = h("b", {}, "—");
    this.clockYou = h("b", {}, "0:00:00");
    this.clockHome = h("b", {}, "0:00:00");
    this.clockNote = h("span", { class: "sf-note" }, "clocks agree");

    const clocks = h("div", { class: "sf-vitals sf-vitals--tl", role: "status" },
      h("div", { class: "sf-row" }, h("span", {}, "UTC"), this.clockUtc),
      h("div", { class: "sf-row" }, h("span", {}, "your clock"), this.clockYou),
      h("div", { class: "sf-row" }, h("span", {}, "home clock"), this.clockHome),
      this.clockNote
    );

    /* ── anchored vitals: where and how fast ─────────────────────────── */
    this.frameName = h("b", {}, "—");
    this.speedValue = h("b", {}, "—");
    this.altValue = h("b", {}, "—");

    /* Speed sits top-right with its tape beside it, which is where both
       reference images put it. §3.1 fixes *that* vitals never move, not
       which corner they live in — and the corner the eye goes to first is
       the one the reference has been training players to look at for
       forty years of cockpit art.

       The ground track — "over 5.1°, 4.5°" — was removed on 2026-07-28 at
       Ric's request, and it deserved to go. It is a number nobody flying
       this can act on: it does not tell you where you are in any sense you
       could use, it changes constantly, and it was competing for attention
       with the speed. §3.1's rule is that the always-visible set is the
       *small* set of things that are always important, and a latitude and
       longitude you cannot steer by is not one of them. */
    const flight = h("div", { class: "sf-vitals sf-vitals--tr sf-vitals--speed", role: "status" },
      h("div", { class: "sf-row" }, h("span", {}, "speed"), this.speedValue),
      h("div", { class: "sf-row" }, h("span", {}, "measured from"), this.frameName),
      h("div", { class: "sf-row" }, h("span", {}, "height"), this.altValue)
    );

    /* ── anchored vitals: the eye ────────────────────────────────────── */
    /* The eye's state stays: it is the one readout that explains why the
       view looks the way it does, and without it a dark sky is a bug rather
       than a pupil. The field-of-view number went with the ground track —
       it is a setting, not a vital, and you can see your own zoom. */
    this.eyeState = h("b", {}, "—");
    const eye = h("div", { class: "sf-vitals sf-vitals--bl", role: "status" },
      h("div", { class: "sf-row" }, h("span", {}, "your eyes"), this.eyeState)
    );

    /* ── anchored vitals: the selected target ────────────────────────── */
    this.targetName = h("b", {}, "nothing yet — click something");
    this.targetRange = h("b", {}, "—");
    this.targetClosing = h("b", {}, "—");
    this.targetSize = h("b", {}, "—");
    this.targetPhase = h("b", {}, "—");
    this.targetMore = h("button", {
      class: "sf-link",
      type: "button",
      onclick: () => this.openInfo(),
    }, "what is it?");

    this.targetBlock = h("div", { class: "sf-vitals sf-vitals--br", role: "status" },
      h("div", { class: "sf-row sf-row--head" }, h("span", {}, "looking at"), this.targetName),
      h("div", { class: "sf-row" }, h("span", {}, "distance"), this.targetRange),
      h("div", { class: "sf-row" }, h("span", {}, "speed toward it"), this.targetClosing),
      h("div", { class: "sf-row" }, h("span", {}, "how big it looks"), this.targetSize),
      h("div", { class: "sf-row" }, h("span", {}, "sunlit"), this.targetPhase),
      this.targetMore
    );

    /* ── the crosshair ────────────────────────────────────────────────
       Straight from the reference images: a gapped cross with four ticks,
       and a hole in the middle. The hole is the point — a solid reticle
       covers the one pixel you are aiming at, which on a map of real
       objects is usually the thing you were trying to look at. */
    this.crosshair = h("div", { class: "sf-crosshair", "aria-hidden": "true" },
      h("i", { class: "sf-crosshair-t" }), h("i", { class: "sf-crosshair-b" }),
      h("i", { class: "sf-crosshair-l" }), h("i", { class: "sf-crosshair-r" }));

    /* ── the speed tape ───────────────────────────────────────────────
       The ladder beside the speed readout in both reference images. It is
       a rate-of-change cue, not a second number: the ticks slide, so you
       see acceleration before the digits have finished settling. */
    this.speedTape = h("div", { class: "sf-tape", "aria-hidden": "true" },
      h("span", { class: "sf-tape-ticks" }), h("span", { class: "sf-tape-needle" }));

    /* ── controls ────────────────────────────────────────────────────── */
    this.presetButtons = PRESETS.map((p) =>
      h("button", {
        type: "button",
        class: `sf-tab${p === this.preset ? " is-on" : ""}`,
        onclick: () => this.setPreset(p),
      }, p)
    );

    const controls = h("div", { class: "sf-controls" },
      h("div", { class: "sf-tabs", role: "group", "aria-label": "cockpit preset" }, this.presetButtons),
      h("button", { type: "button", class: "sf-btn", onclick: () => this.openPanel("sources") }, "sources"),
      h("button", { type: "button", class: "sf-btn", onclick: () => this.openPanel("ledger") }, "where we cheat"),
      h("button", { type: "button", class: "sf-btn", onclick: () => this.openPanel("help") }, "controls")
    );

    /* ── the corner cluster ───────────────────────────────────────────
       "MENU ⚙  MAP ⊘" sits in the bottom-right corner of both reference
       images, and it is the right place for it: the map is one of the two
       primary surfaces (Design Bible §13), so it gets a permanent, always
       visible way in rather than living only on a key nobody discovers. */
    this.mapButton = h("button", {
      type: "button", class: "sf-corner-btn",
      onclick: () => this.handlers.onMap?.(),
    }, h("span", {}, "map"), h("i", { class: "sf-corner-glyph sf-corner-glyph--map" }));

    this.cornerCluster = h("div", { class: "sf-corner" },
      h("button", {
        type: "button", class: "sf-corner-btn",
        onclick: () => this.openPanel("help"),
      }, h("span", {}, "menu"), h("i", { class: "sf-corner-glyph sf-corner-glyph--menu" })),
      this.mapButton
    );

    /* ── the sliding panel ───────────────────────────────────────────── */
    this.panelTitle = h("h2", {}, "");
    this.panelBody = h("div", { class: "sf-panel-body" });
    this.panel = h("aside", {
      class: "sf-panel", "aria-hidden": "true", role: "dialog", "aria-label": "information",
    },
      h("div", { class: "sf-panel-head" },
        this.panelTitle,
        h("button", { type: "button", class: "sf-close", "aria-label": "close", onclick: () => this.closePanel() }, "×")
      ),
      this.panelBody
    );

    /* ── velocity markers ─────────────────────────────────────────────
       Slice spec §6.3: "the prograde/retrograde markers and reference
       frame remain visible". These are the two most useful marks in
       spaceflight and the reason the *shapes* are the conventional ones —
       a circle with three ticks for the way you are going, the same
       circle crossed through for the way you came.

       The **words** are no longer the conventional ones. Ric, 2026-07-28:
       *"idk what prograde means. think i want kids to be able to fly this
       around and understand the words."* That is the right instinct and it
       costs nothing here: the marker's job is to say which way you are
       moving, and "prograde" only says that to someone who already knew.
       The shape still teaches the convention to anyone who goes looking,
       and the tooltip still names it, so nothing is dumbed down — the
       jargon is demoted from the label to the footnote. */
    this.prograde = h("div", { class: "sf-vector sf-vector--pro", title: "the way you are moving — pilots call this prograde" },
      h("span", { class: "sf-vector-mark" }),
      h("span", { class: "sf-vector-label" }, "the way you're going"));
    this.retrograde = h("div", { class: "sf-vector sf-vector--retro", title: "the way you came — pilots call this retrograde" },
      h("span", { class: "sf-vector-mark" }));
    this.labelLayer.append(this.prograde, this.retrograde);

    /* ── flight state ─────────────────────────────────────────────────
       Slice §12.1 lists what must be readable at a glance, and the list is
       not arbitrary: every item on it is something that, missed, gets you
       killed or lost. Mode and precision are there because a control that
       behaves differently without saying so is the worst kind of surprise;
       relative speed carries its frame's name because §6.5 is right that a
       speed without one is not information.

       The mode shown is the **travel mode** — Local, Orbital, System,
       Interstellar, Intergalactic. It used to read "assisted"/"direct",
       which named a distinction that no longer exists and never told you
       anything about what the next press of W would do. */
    this.modeValue = h("b", {}, "Local");
    this.relSpeedValue = h("b", {}, "—");
    this.relFrameValue = h("span", { class: "sf-note" }, "—");
    this.throttleValue = h("b", {}, "—");
    this.stopValue = h("b", {}, "—");
    this.assistNote = h("span", { class: "sf-note" }, "");

    this.flightBlock = h("div", { class: "sf-vitals sf-vitals--bc", role: "status" },
      h("div", { class: "sf-row sf-row--head" }, h("span", {}, "engine"), this.modeValue),
      h("div", { class: "sf-row" }, h("span", {}, "your speed"), this.relSpeedValue),
      this.relFrameValue,
      h("div", { class: "sf-row" }, h("span", {}, "trying to reach"), this.throttleValue),
      h("div", { class: "sf-row" }, h("span", {}, "room to stop"), this.stopValue),
      this.assistNote
    );

    /* ── warnings ─────────────────────────────────────────────────────
       One banner, showing the worst thing currently true, with the reason
       in words. HUD spec §8: no state is carried by colour alone, so the
       severity is written as well as coloured. */
    this.warningText = h("span", { class: "sf-warn-text" }, "");
    this.warningRank = h("b", { class: "sf-warn-rank" }, "");
    this.warningBanner = h("div", {
      class: "sf-warning", role: "alert", "aria-live": "assertive", hidden: "hidden",
    }, this.warningRank, this.warningText);

    /* ── touch controls ───────────────────────────────────────────────
       Controls §5 and slice §12.4: full stop is a fixed, always-reachable
       button that never requires moving the steering thumb, and precision
       is a deliberate control rather than a gesture you can trigger by
       accident. They are hidden on pointer devices — a mouse already has
       X and Z — and shown when a touch actually happens. */
    this.touchStop = h("button", {
      type: "button", class: "sf-touch sf-touch--stop", "aria-label": "full stop",
      onpointerdown: () => this.handlers.onTouchAction?.("fullStop"),
    }, "STOP");
    this.touchPrecision = h("button", {
      type: "button", class: "sf-touch sf-touch--precision", "aria-pressed": "false",
      onpointerdown: () => {
        const on = this.touchPrecision.getAttribute("aria-pressed") !== "true";
        this.touchPrecision.setAttribute("aria-pressed", String(on));
        this.touchPrecision.classList.toggle("is-on", on);
        this.handlers.onTouchAction?.("precision", on);
      },
    }, "fine");
    this.touchLayer = h("div", { class: "sf-touch-layer", hidden: "hidden" },
      this.touchStop, this.touchPrecision);

    this.hint = h("p", { class: "sf-hint" },
      "WASD + Space/Ctrl to fly · mouse or arrows to aim · X full stop · " +
      "B match velocity · 1–5 travel mode · Z fine · H controls");

    flight.append(this.speedTape);

    this.root.append(this.labelLayer, this.canopyHost, this.crosshair, clocks, flight, eye,
      this.targetBlock, this.flightBlock, this.warningBanner, this.touchLayer,
      controls, this.cornerCluster, this.panel, this.hint);
  }

  /* ── presets ───────────────────────────────────────────────────────── */

  setPreset(preset) {
    this.preset = migratePreset(preset);
    this.canopyHost.replaceChildren(buildCanopy(this.preset));
    this.presetButtons.forEach((b) => b.classList.toggle("is-on", b.textContent === this.preset));
    this.root.dataset.preset = this.preset;
    this.handlers.onPreset?.(this.preset);
  }

  /* ── per-frame update ──────────────────────────────────────────────── */

  /**
   * @param {object} s
   * @param {import('../../simulation/time/time-service.js').TimeService} s.time
   * @param {Array}  s.observations
   * @param {string} s.targetId
   * @param {object} s.renderer
   * @param {object} s.adaptation
   * @param {object} s.ship  {frameLabel, speed, altitude, ground}
   */
  update(s) {
    const { time, observations, targetId, renderer, adaptation, ship } = s;

    this.clockUtc.textContent = time.utcString();
    this.clockYou.textContent = formatElapsed(time.travelerSeconds);
    this.clockHome.textContent = formatElapsed(time.homeSeconds);
    /* Three states, not two, because there are three real situations and
       the old two-way message told a lie in the third. It said "you are not
       going fast enough to separate them" at *any* speed — including
       several trillion c — because γ was never computed and the clocks
       could not diverge whatever you did.

       Now: below light the clocks separate for real and it says by how
       much; above light the drive is declared fiction that does not dilate
       time, and it says *that* rather than inventing a reason. */
    const drift = time.clockDivergenceSeconds;
    const superluminal = ship.speed >= 299792458;
    this.clockNote.textContent = superluminal
      ? "the faster-than-light drive does not bend time — see “where we cheat”"
      : Math.abs(drift) < 0.5
        ? "your clock and home agree — you would need a good fraction of light speed to separate them"
        : `home has run ${drift.toFixed(1)} s ahead of you`;

    this.speedValue.textContent = formatSpeed(ship.speed);
    /* The tape is a real readout, not decoration: one tick per decade of
       speed, so the ladder's position *is* the order of magnitude and the
       ticks visibly slide while the ship is accelerating. A linear tape
       would be useless across the eleven decades this game spans. */
    const decades = Math.max(-2, Math.min(9, Math.log10(Math.max(ship.speed, 0.01))));
    this.speedTape.style.setProperty("--tape", `${(decades * 26).toFixed(1)}px`);
    this.frameName.textContent = ship.frameLabel;
    this.altValue.textContent = formatDistance(ship.altitude);
    this.eyeState.textContent = adaptation.description;

    const target = observations.find((o) => o.id === targetId);
    // The station is not one of the observed *bodies* — it is a structure,
    // not a sphere with a phase — so when it is the target the numbers come
    // from the flight computer instead. Both paths fill the same block, so
    // "target: nothing selected" can never appear while something is.
    const structural = !target && s.situation && s.situation.target;

    if (structural) {
      const t = s.situation.target;
      this.targetName.textContent = t.label;
      this.targetRange.textContent = formatDistance(Math.max(0, t.surfaceRange));
      this.targetClosing.textContent =
        `${formatSpeed(Math.abs(t.closingRate))} ${t.closingRate >= 0 ? "closer" : "further away"}`;
      this.targetSize.textContent = "—";
      this.targetPhase.textContent = "—";
      this.targetMore.hidden = false;
    } else if (target) {
      this.targetName.textContent = target.record.name;
      this.targetRange.textContent = formatDistance(target.surfaceRange);
      const c = target.closingRate;
      this.targetClosing.textContent =
        `${formatSpeed(Math.abs(c))} ${c >= 0 ? "closer" : "further away"}`;
      this.targetSize.textContent = formatAngle(target.angularDiameter);
      this.targetPhase.textContent = `${(target.phase * 100).toFixed(0)}%`;
      this.targetMore.hidden = false;
    } else {
      this.targetName.textContent = "nothing yet — click something";
      this.targetRange.textContent = this.targetClosing.textContent =
        this.targetSize.textContent = this.targetPhase.textContent = "—";
      this.targetMore.hidden = true;
    }

    this._updateFlight(s);
    this._updateLabels(observations, targetId, renderer);
    this._updateVectors(s.velocityEci, renderer, s.showVectors !== false);
  }

  /** Reveal the touch controls the first time a finger touches the glass. */
  enableTouch() { this.touchLayer.hidden = false; }

  /**
   * Flight state and warnings.
   *
   * @param {object} s
   * @param {object} s.flight     {modeLabel, precision, targetSpeed, assistNote}
   * @param {object} s.situation  from flight-computer.assess()
   */
  _updateFlight({ flight, situation }) {
    if (!flight || !situation) { this.flightBlock.hidden = true; return; }
    this.flightBlock.hidden = false;

    this.modeValue.textContent = flight.precision
      ? `${flight.modeLabel} · fine`
      : flight.modeLabel;

    this.relSpeedValue.textContent = formatSpeed(situation.relativeSpeed);
    // The frame's name is not decoration. "12 cm/s" is meaningless and
    // "12 cm/s relative to the station" is a flight instruction.
    this.relFrameValue.textContent = `relative to ${situation.referenceLabel}`;

    this.throttleValue.textContent = formatSpeed(flight.targetSpeed);
    this.stopValue.textContent = situation.relativeSpeed < 1e-3
      ? "at rest"
      : `${formatDuration(situation.stoppingTime)} · ${formatDistance(situation.stoppingDistance)}`;

    const p = situation.proximity;
    let note = flight.assistNote || "";
    if (!note && p) {
      const zone = p.zone ? p.zone.label : "clear";
      const rate = p.closingRate;
      note = `${formatDistance(Math.max(0, p.surfaceRange))} to structure · ` +
        `${formatSpeed(Math.abs(rate))} ${rate >= 0 ? "closer" : "further away"} · ${zone}`;
    }
    // A flashed message owns the line until it expires — a refusal the
    // player never sees is the same as no refusal at all.
    if (!this._flashHold) this.assistNote.textContent = note;

    /* The banner is for things that need acting on. Advisory zone notes
       are already on the line above, and promoting them to a banner means
       the session opens with a warning on the glass before the player has
       moved — which teaches, in the first two seconds, that warnings here
       are wallpaper. HUD spec §5: severity has to mean something. */
    const worst = situation.warnings.find((w) => w.severity === "warning" || w.severity === "critical");
    if (worst) {
      this.warningBanner.hidden = false;
      this.warningBanner.dataset.severity = worst.severity;
      this.warningRank.textContent = worst.severity;
      this.warningText.textContent = situation.safetyOverridden
        ? `${worst.text} — safety assist off, you asked for this.`
        : worst.text;
    } else {
      this.warningBanner.hidden = true;
    }
  }

  /** Place the prograde and retrograde marks on the glass. */
  _updateVectors(velocity, renderer, show) {
    const speed = velocity ? Math.hypot(velocity.x, velocity.y, velocity.z) : 0;
    if (!show || speed < 1e-3) {
      this.prograde.hidden = this.retrograde.hidden = true;
      return;
    }
    const place = (node, dir) => {
      const p = renderer.projectDirection(dir);
      // Hide it well outside the frame rather than at the edge, so it
      // does not sit pinned to a corner pretending to be somewhere.
      if (!p || p.x < -60 || p.y < -60 || p.x > renderer.width + 60 || p.y > renderer.height + 60) {
        node.hidden = true;
        return;
      }
      node.hidden = false;
      node.style.transform = `translate(${p.x}px, ${p.y}px)`;
    };
    place(this.prograde, velocity);
    place(this.retrograde, { x: -velocity.x, y: -velocity.y, z: -velocity.z });
  }

  /**
   * Labels are anchored by projection, and are deliberately sparse (§4).
   * A label that would sit on top of another is dropped rather than
   * stacked, because two overlapping labels are worth less than one.
   */
  _updateLabels(observations, targetId, renderer) {
    const placed = [];
    for (const o of observations) {
      let node = this._labelNodes.get(o.id);
      if (!node) {
        node = h("button", {
          type: "button",
          class: "sf-label",
          onclick: () => this.handlers.onSelect?.(o.id),
        },
          h("span", { class: "sf-label-ring" }),
          h("span", { class: "sf-label-text" },
            h("b", {}, o.record.name),
            h("i", {}, ""))
        );
        this._labelNodes.set(o.id, node);
        this.labelLayer.append(node);
      }

      const screen = renderer.project(o.position);
      const notable = o.id === targetId || o.angularDiameter > 0.0005;
      if (!screen || !notable) { node.hidden = true; continue; }

      const collides = placed.some(
        (p) => Math.abs(p.x - screen.x) < 130 && Math.abs(p.y - screen.y) < 34
      );
      if (collides && o.id !== targetId) { node.hidden = true; continue; }

      node.hidden = false;
      node.classList.toggle("is-target", o.id === targetId);
      node.style.transform = `translate(${screen.x}px, ${screen.y}px)`;
      node.querySelector("i").textContent = formatDistance(o.surfaceRange);

      // The ring tracks real angular size, with a floor so a distant body
      // stays clickable. Ledger SF-L-010 — the marker is bigger than the
      // object, the object is never bigger than it is.
      const fovRad = (renderer.camera.fov * Math.PI) / 180;
      const px = (o.angularDiameter / fovRad) * renderer.height;
      // Once a body overflows the view there is nothing left to point at:
      // it *is* the view. Drawing a ring bigger than the screen would only
      // put a circle around the player.
      const overflowing = px > renderer.height * 0.95;
      node.classList.toggle("is-overflowing", overflowing);
      node.style.setProperty("--ring", `${Math.max(18, Math.min(px, 360))}px`);
      placed.push(screen);
    }
  }

  /* ── panels ────────────────────────────────────────────────────────── */

  openPanel(kind, payload) {
    const builders = {
      sources: () => this._sourcesPanel(),
      ledger: () => this._ledgerPanel(),
      help: () => this._helpPanel(),
      info: () => this._infoPanel(payload),
    };
    const built = builders[kind]?.();
    if (!built) return;
    this.panelTitle.textContent = built.title;
    this.panelBody.replaceChildren(...built.nodes);
    this.panel.classList.add("is-open");
    this.panel.setAttribute("aria-hidden", "false");
    this.handlers.onModal?.(true);
  }

  closePanel() {
    this.panel.classList.remove("is-open");
    this.panel.setAttribute("aria-hidden", "true");
    this.handlers.onModal?.(false);
  }

  openInfo() { this.handlers.onInfo?.(); }

  /** Progressive information — Design Bible §12.1, layer by layer. */
  _infoPanel(o) {
    if (!o) return null;
    const rec = o.record;
    const i = rec.info;

    const layer = (name, text, cls) =>
      h("details", { class: "sf-layer", open: name === "at a distance" ? "" : null },
        h("summary", {}, name, cls ? chip(cls) : null),
        h("p", {}, text));

    const nodes = [
      h("p", { class: "sf-hook" }, i.hook),
      h("dl", { class: "sf-facts" },
        h("dt", {}, "range"), h("dd", {}, formatDistance(o.surfaceRange), chip("C")),
        h("dt", {}, "apparent size"), h("dd", {}, formatAngle(o.angularDiameter), chip("C")),
        h("dt", {}, "radius"), h("dd", {}, formatDistance(rec.radius.value), chip(rec.radius.cls)),
        h("dt", {}, "lit fraction"), h("dd", {}, `${(o.phase * 100).toFixed(0)}%`, chip("C")),
        h("dt", {}, "relative speed"), h("dd", {}, formatSpeed(o.relativeSpeed), chip("C")),
        rec.gm ? h("dt", {}, "surface gravity") : null,
        rec.gm ? h("dd", {},
          `${(rec.gm.value / (rec.radius.value ** 2)).toFixed(2)} m/s²`, chip("C")) : null
      ),
      layer("at a distance", i.distant),
      layer("targeted", i.targeted),
      layer("on approach", i.approach),
      layer("close up", i.local),
      layer("why it matters", i.context),
    ];

    if (rec.atmosphere) {
      const a = rec.atmosphere;
      nodes.push(h("details", { class: "sf-layer" },
        h("summary", {}, "atmosphere", chip(a.cls)),
        h("p", {}, `Surface pressure ${(a.surfacePressurePa / 1000).toFixed(1)} kPa, ` +
          `density ${a.surfaceDensity} kg/m³, scale height ${(a.scaleHeightM / 1000).toFixed(1)} km. ` +
          `Composition ${a.composition}. This is a model of the real atmosphere, not live weather.`)));
    }

    nodes.push(this._sourceList(rec.sourceIds));
    if (rec.ledgerIds?.length) {
      nodes.push(h("h3", {}, "what we changed"),
        ...ledgerFor(rec.ledgerIds).map((e) => this._ledgerEntry(e, true)));
    }
    return { title: rec.name, nodes };
  }

  _sourceList(ids) {
    const list = sourcesFor(ids);
    if (!list.length) return h("p", { class: "sf-note" }, "No external source — this is computed.");
    return h("section", { class: "sf-sources" },
      h("h3", {}, "where this came from"),
      ...list.map((s) => h("div", { class: "sf-source" },
        h("h4", {}, s.gave),
        h("p", {}, s.story),
        h("p", { class: "sf-cite" }, `${s.name} · ${s.owner} · ${s.licence}`)))
    );
  }

  /** §18.1: credits are content, written for a curious person, not a lawyer. */
  _sourcesPanel() {
    return {
      title: "Where all of this came from",
      nodes: [
        h("p", { class: "sf-hook" },
          "Everything you can see out of the canopy was measured by somebody, with real " +
          "instruments. Here is who, and how."),
        ...Object.values(SOURCES).map((s) => h("div", { class: "sf-source" },
          h("h4", {}, s.gave),
          h("p", {}, s.story),
          h("p", { class: "sf-cite" },
            s.url
              ? h("a", { href: s.url, target: "_blank", rel: "noreferrer noopener" }, s.name)
              : s.name,
            ` · ${s.owner} · ${s.licence}`))),
      ],
    };
  }

  _ledgerEntry(e, compact = false) {
    return h("details", { class: "sf-layer" },
      h("summary", {}, e.title, h("span", { class: "sf-tag" }, e.classification)),
      h("p", {}, h("b", {}, "What reality does: "), e.reality),
      h("p", {}, h("b", {}, "What we did: "), e.implemented),
      h("p", {}, h("b", {}, "Why: "), e.reason),
      h("p", {}, h("b", {}, "How far off: "), e.magnitude),
      compact ? null : h("p", {}, h("b", {}, "What you would notice: "), e.consequence),
      h("p", { class: "sf-cite" }, `${e.id} · introduced ${e.introduced} · ${e.status}`));
  }

  /** The other honesty surface: what here is not real, and why. */
  _ledgerPanel() {
    return {
      title: "Where we cheat",
      nodes: [
        h("p", { class: "sf-hook" },
          "The sources list says what is real and who measured it. This says the opposite: " +
          "every place the simulation departs from reality, how far, and why. Neither list " +
          "is much use without the other."),
        ...LEDGER.map((e) => this._ledgerEntry(e)),
      ],
    };
  }

  /**
   * The controls reference.
   *
   * Every key shown here is read from the live binding map (Controls §7),
   * not typed out below. A hand-written help screen is wrong the moment
   * anybody rebinds anything, and it is wrong in the one place a confused
   * player goes looking — so this list cannot be written by hand, only
   * generated.
   */
  _helpPanel() {
    const settings = this.handlers.getSettings?.() || {};
    const groups = this.handlers.getBindings?.() || { flight: [], view: [], info: [] };

    const rows = (list) => h("div", { class: "sf-keys" },
      list.map((a) => h("div", { class: "sf-row" },
        h("span", {}, a.keys.length ? a.keys.join(" / ") : "unbound"),
        h("b", {}, a.label)))
    );

    const toggle = (key, label) => {
      const btn = h("button", {
        type: "button",
        class: `sf-tab${settings[key] ? " is-on" : ""}`,
        onclick: () => {
          const now = this.handlers.toggleSetting?.(key);
          btn.classList.toggle("is-on", !!now);
        },
      }, label);
      return btn;
    };

    return {
      title: "Controls",
      nodes: [
        h("p", { class: "sf-hook" },
          "The mouse aims and the keyboard moves. Everything below is read from the live " +
          "key mapping, so it cannot drift out of date — rebind something and this list " +
          "changes with it."),

        h("h3", {}, "flying"),
        rows(groups.flight),
        h("p", {},
          "Assisted flight closes a loop on velocity: the stick asks for a speed relative " +
          "to whatever frame you are in, and the ship supplies whatever thrust that takes " +
          "— including the thrust it takes to hold still next to something that is " +
          "orbiting. Direct flight closes no loop at all. Release the controls and you " +
          "coast, because that is what happens."),
        h("p", {},
          "Full stop needs to know what to stop relative to, so it says. Next to the " +
          "station it means the station; further out it means Earth's centre, and you " +
          "will still be doing 7.66 km/s when it finishes. Both are true at once and the " +
          "readout names which one it is talking about."),

        h("h3", {}, "aiming and looking"),
        rows(groups.view),

        h("h3", {}, "targets and information"),
        rows(groups.info),

        h("h3", {}, "preferences"),
        h("div", { class: "sf-tabs" },
          toggle("invertY", "invert vertical"),
          toggle("showVectors", "velocity markers")),
        h("p", {},
          "The circle with two ticks is prograde — the direction you are actually moving. " +
          "The crossed circle opposite it is retrograde. In orbit those are rarely where " +
          "you are pointing, which is the whole lesson of the station scenario: thrust " +
          "toward the station and you will not arrive at it."),
      ],
    };
  }

  /** A transient line on the glass — a refusal, or a command confirming. */
  flash(text, seconds = 4) {
    this.assistNote.textContent = text;
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => { this._flashHold = false; }, seconds * 1000);
    this._flashHold = true;
  }
}
