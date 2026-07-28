/* ══════════════════════════════════════════════════════════════════════
   map.js — the star map.

   > "The entire game is between your map and the universe." — Ric

   Design Bible §13 makes this one of the game's **two primary surfaces**,
   with engineering effort equal to the cockpit's. It is not an instrument
   panel that happens to show dots; it is half of the loop.

   Laid out from the reference image in docs/UI:cockpit visuals/ — the
   plot, the scale tabs at bottom-left, the nearby-locations rail down the
   right, the two scale insets, and the status strip naming where you are,
   what you have targeted, how far it is and how long it takes.

   ── two rules that shaped the implementation ─────────────────────────

   **The projection is linear, and zooms.** The obvious way to fit Earth,
   the Moon and the Sun on one plot is a logarithmic radial scale, and it
   is a lie of exactly the kind the Scientific Standard exists to prevent:
   it would draw the Moon a third of the way to the Sun. So distances are
   linear at every scale, the scale bar states what a screen distance
   *is*, and anything that does not fit is off the plot until you zoom out.
   The emptiness is the subject; compressing it away would be vandalism.

   **The rail is the accessible surface.** The plot is a canvas, because
   at interstellar scale it draws thousands of stars and DOM cannot. Every
   object on it also appears in the rail as a real focusable button
   carrying its name, its distance and its provenance class — so nothing
   on the map is reachable only by pixel (HUD §10).

   §13 also asks for "a way to return instantly to the cockpit view without
   losing context": the map is a sibling layer over a paused simulation,
   not a scene change, and closing it puts you back exactly where you were.
   ══════════════════════════════════════════════════════════════════════ */

import { formatDistance, K } from "../../simulation/core/units.js";

const LY = 9.4607304725808e15;

/**
 * The three scales, and how wide each one starts.
 *
 * `span` is how much real space the plot covers **across its shorter
 * dimension**, in that scale's own unit — so "local" means you are
 * looking at three kilometres of space.
 *
 * Shorter, not wider, and that is not a detail. Measured across the
 * width, anything at nearly the full span in a mostly-vertical direction
 * falls off the top or bottom of the plot — which at system scale is the
 * Moon, most of the time. A scale whose default view loses the only other
 * world in it is not a default.
 */
export const SCALES = [
  { id: "local", label: "local", unit: "m", span: 3e3, min: 2e2, max: 5e6,
    blurb: "the space you are manoeuvring in" },
  // Wide enough that the Moon lands well inside the plot rather than on
  // its rim, where the status strip would sit on top of it.
  { id: "system", label: "system", unit: "m", span: 1.3e9, min: 1e6, max: 5e11,
    blurb: "Earth, the Moon, and the Sun beyond them" },
  { id: "interstellar", label: "interstellar", unit: "ly", span: 40, min: 3, max: 600,
    blurb: "the solar neighbourhood, in light years" },
];

const SCALE_BY_ID = new Map(SCALES.map((s) => [s.id, s]));

/** Palette per kind, so the plot and the rail cannot disagree about colour. */
const KIND = {
  world:     { colour: "#7fc9e8", rail: "worlds" },
  star:      { colour: "#ffd79a", rail: "stars" },
  structure: { colour: "#9ad8c4", rail: "points of interest" },
  ship:      { colour: "#9ff0ff", rail: null },
};

const RAIL_GROUPS = [
  { id: "world", title: "worlds" },
  { id: "star", title: "stars" },
  { id: "structure", title: "points of interest" },
];

const h = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    node.append(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
};

/** Light years, formatted the way the rail and the plot both want them. */
const formatLy = (ly) => (ly < 10 ? `${ly.toFixed(2)} ly` : `${ly.toFixed(1)} ly`);

/** A duration as something a person would say out loud. */
export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 90) return `${seconds.toFixed(0)} s`;
  if (seconds < 5400) return `${(seconds / 60).toFixed(0)} min`;
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1)} h`;
  if (seconds < 3.15e7) return `${(seconds / 86400).toFixed(1)} days`;
  return `${(seconds / 3.15576e7).toFixed(1)} years`;
}

/**
 * A round number near `target`, in 1/2/5 steps — for range rings and the
 * scale bar, which are worthless if they read "137 km".
 */
export function niceNumber(target) {
  const exp = Math.floor(Math.log10(target));
  const base = 10 ** exp;
  const f = target / base;
  return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * base;
}

export class StarMap {
  /**
   * @param {HTMLElement} root
   * @param {object} handlers
   * @param {(id:string)=>void}   handlers.onSelect   a real destination
   * @param {(star:object)=>void} handlers.onInspect  a catalogued star
   * @param {(open:boolean)=>void} handlers.onOpen
   */
  constructor(root, handlers = {}) {
    this.root = root;
    this.handlers = handlers;
    this.isOpen = false;
    this.scaleId = "system";
    /** Per-scale zoom span, so switching scales does not lose your zoom. */
    this.span = Object.fromEntries(SCALES.map((s) => [s.id, s.span]));
    /** Pan offset from the ship, in the current scale's unit. */
    this.pan = { x: 0, y: 0 };
    /** Which kinds are drawn. Design Bible §13: filters by object type. */
    this.filters = { world: true, star: true, structure: true };
    this._objects = [];
    this._rows = new Map();
    this._build();
  }

  /* ── construction ──────────────────────────────────────────────────── */

  _build() {
    this.plot = h("canvas", { class: "sf-map-plot" });
    this.plotCtx = this.plot.getContext("2d");

    this.insetA = h("canvas", { class: "sf-map-inset-plot" });
    this.insetB = h("canvas", { class: "sf-map-inset-plot" });
    this.insetALabel = h("span", { class: "sf-map-inset-label" }, "");
    this.insetBLabel = h("span", { class: "sf-map-inset-label" }, "");

    const insetA = h("div", { class: "sf-map-inset sf-map-inset--tl" }, this.insetA, this.insetALabel);
    const insetB = h("div", { class: "sf-map-inset sf-map-inset--br" }, this.insetB, this.insetBLabel);

    this.title = h("div", { class: "sf-map-title" },
      h("span", { class: "sf-map-title-dot" }),
      "star map · navigation");

    /* ── scale tabs ─────────────────────────────────────────────────── */
    this.scaleTabs = SCALES.map((s) =>
      h("button", {
        type: "button",
        class: `sf-map-scale${s.id === this.scaleId ? " is-on" : ""}`,
        title: s.blurb,
        onclick: () => this.setScale(s.id),
      },
        h("span", { class: "sf-map-scale-mark" }),
        h("span", { class: "sf-map-scale-name" }, s.label))
    );
    const scaleStrip = h("div", { class: "sf-map-scales", role: "group", "aria-label": "map scale" },
      h("div", { class: "sf-map-scale-rail" }), ...this.scaleTabs);

    /* ── status strip ───────────────────────────────────────────────── */
    const cell = (label) => {
      const value = h("b", {}, "—");
      return { node: h("div", { class: "sf-map-stat" }, h("span", {}, label), value), value };
    };
    this.statLocation = cell("location");
    this.statTarget = cell("target");
    this.statDistance = cell("distance");
    this.statEta = cell("eta");
    this.statNote = h("p", { class: "sf-map-status-note" }, "");

    const status = h("div", { class: "sf-map-status", role: "status" },
      h("div", { class: "sf-map-status-grid" },
        this.statLocation.node, this.statTarget.node,
        this.statDistance.node, this.statEta.node),
      this.statNote);

    this.scaleBar = h("div", { class: "sf-map-scalebar" },
      h("span", { class: "sf-map-scalebar-line" }), h("b", {}, "—"));

    this.hint = h("p", { class: "sf-map-hint" },
      "drag to pan · scroll to zoom · click a marker to target it · tab returns to the canopy");

    /* ── the rail ───────────────────────────────────────────────────── */
    this.railBody = h("div", { class: "sf-map-rail-body" });
    const rail = h("aside", { class: "sf-map-rail", "aria-label": "nearby locations" },
      h("h2", {}, "nearby locations"),
      this.railBody);

    /* ── assembly ───────────────────────────────────────────────────── */
    this.stage = h("div", { class: "sf-map-stage" },
      this.plot, insetA, insetB, this.title, scaleStrip, status, this.scaleBar, this.hint);

    this.panel = h("section", {
      class: "sf-map",
      role: "dialog",
      "aria-label": "star map",
      "aria-hidden": "true",
      hidden: "hidden",
    },
      this.stage,
      rail,
      h("button", {
        type: "button", class: "sf-map-close", "aria-label": "close the map",
        onclick: () => this.close(),
      }, "×")
    );

    this._bindPointer();
    this.root.append(this.panel);
  }

  /**
   * Pan, zoom and pick.
   *
   * The wheel handler is non-passive on purpose: a map that scrolls the
   * page behind it while you try to zoom is not a map.
   */
  _bindPointer() {
    let dragging = false, moved = 0, last = null;

    this.plot.addEventListener("pointerdown", (e) => {
      dragging = true; moved = 0; last = { x: e.clientX, y: e.clientY };
      this.plot.setPointerCapture(e.pointerId);
    });
    this.plot.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - last.x, dy = e.clientY - last.y;
      moved += Math.abs(dx) + Math.abs(dy);
      last = { x: e.clientX, y: e.clientY };
      const perPx = this._unitsPerPixel();
      this.pan.x -= dx * perPx;
      this.pan.y += dy * perPx;
      this.draw();
    });
    this.plot.addEventListener("pointerup", (e) => {
      dragging = false;
      this.plot.releasePointerCapture(e.pointerId);
      // A drag is not a click. Four pixels of slop, because a trackpad
      // never produces a perfectly still press.
      if (moved < 4) this._pick(e);
    });

    this.plot.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.zoom(Math.exp(e.deltaY * 0.0014));
    }, { passive: false });
  }

  /* ── state ─────────────────────────────────────────────────────────── */

  get scale() { return SCALE_BY_ID.get(this.scaleId); }

  setScale(id) {
    if (!SCALE_BY_ID.has(id)) return;
    this.scaleId = id;
    this.pan = { x: 0, y: 0 };
    for (const [i, s] of SCALES.entries()) this.scaleTabs[i].classList.toggle("is-on", s.id === id);
    this.draw();
  }

  zoom(factor) {
    const s = this.scale;
    this.span[s.id] = Math.max(s.min, Math.min(s.max, this.span[s.id] * factor));
    this.draw();
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.panel.hidden = false;
    this.panel.setAttribute("aria-hidden", "false");
    this.panel.classList.add("is-open");
    this._resize();
    this.handlers.onOpen?.(true);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.panel.classList.remove("is-open");
    this.panel.setAttribute("aria-hidden", "true");
    this.panel.hidden = true;
    this.handlers.onOpen?.(false);
  }

  toggle() { this.isOpen ? this.close() : this.open(); }

  /* ── the frame's data ──────────────────────────────────────────────── */

  /**
   * @param {object} s
   * @param {object} s.ship        {position, velocity}
   * @param {object} s.world       WorldService.state
   * @param {Array}  s.stars       the merged catalogue
   * @param {string} s.targetId
   * @param {object} s.route       planRoute() output, or null
   * @param {string} s.frameLabel
   */
  update(s) {
    if (!this.isOpen) return;
    this.state = s;
    this._objects = this._collect(s);
    this._resize();
    this._updateRail();
    this._updateStatus(s);
    this.draw();
  }

  /**
   * Everything the current scale can show, in one list — the same list the
   * plot draws and the rail lists, so they cannot offer different objects
   * (navigation.js makes the same point about targets).
   *
   * Positions are in the scale's own unit, relative to the ship: metres in
   * the ECI plane for local and system, light years for interstellar.
   */
  _collect({ ship, world, stars }) {
    const out = [];

    if (this.scaleId === "interstellar") {
      /* The ship is in Earth orbit, which is 0.0000158 ly from the Sun. At
         a scale where the nearest star is four light years away the ship
         and the Sun are the same point, and pretending otherwise would be
         false precision — so the Sun is the origin and says so. */
      for (const star of stars || []) {
        if (!star.distanceLy) continue;    // no measured distance, no place on a map
        const ra = (star.ra * Math.PI) / 180, dec = (star.dec * Math.PI) / 180;
        const d = star.distanceLy;
        out.push({
          // Matches the id navigation.starDestination() builds, so picking
          // a star here and asking the route planner about it are the same
          // question. They were two different id schemes, which is how a
          // star could be selected and then not found.
          id: `star:${star.hr ?? star.name}`,
          label: star.name,
          kind: "star",
          x: d * Math.cos(dec) * Math.cos(ra),
          y: d * Math.cos(dec) * Math.sin(ra),
          z: d * Math.sin(dec),
          range: d,
          rangeText: formatLy(d),
          provenance: "M",
          detail: star.spectralType || (star.properName ? "" : "catalogue star"),
          star,
          /* Reachable, now that it has a real position and a route planner
             that will tell you the truth about the trip. What made a star
             unreachable was never the distance — it was that the sky was a
             shell with no distances on it. A measured parallax is what
             turns a direction into a place. */
          reachable: true,
        });
      }
      out.sort((a, b) => a.range - b.range);
      return out.slice(0, 240);
    }

    const rel = (p) => ({ x: p.x - ship.position.x, y: p.y - ship.position.y, z: p.z - ship.position.z });
    const push = (id, label, kind, position, radius, provenance, detail) => {
      const r = rel(position);
      const range = Math.hypot(r.x, r.y, r.z);
      out.push({
        id, label, kind, x: r.x, y: r.y, z: r.z, radius,
        range, rangeText: formatDistance(range),
        provenance, detail, reachable: true,
      });
    };

    if (world.station) {
      push("station", "the station", "structure", world.station.position, 55, "M",
        "low Earth orbit · 100 m of truss");
    }
    for (const [id, body] of Object.entries(world.bodies || {})) {
      const kind = id === "sun" ? "star" : "world";
      const label = id === "sun" ? "the Sun" : id[0].toUpperCase() + id.slice(1);
      const radius = id === "earth" ? K.EARTH_RADIUS_MEAN.value
        : id === "moon" ? K.MOON_RADIUS.value : K.SUN_RADIUS.value;
      push(id, label, kind, body.position, radius, "M",
        id === "sun" ? "one astronomical unit out" : "");
    }

    out.sort((a, b) => a.range - b.range);
    return out;
  }

  /* ── the rail ──────────────────────────────────────────────────────── */

  _updateRail() {
    const groups = [];
    for (const g of RAIL_GROUPS) {
      const items = this._objects.filter((o) => o.kind === g.id);
      if (!items.length) continue;

      const on = this.filters[g.id];
      const header = h("button", {
        type: "button",
        class: `sf-map-group${on ? " is-on" : ""}`,
        "aria-pressed": String(on),
        title: `show or hide ${g.title} on the plot`,
        onclick: () => { this.filters[g.id] = !this.filters[g.id]; this._updateRail(); this.draw(); },
      }, h("span", {}, g.title), h("i", {}, String(items.length)));

      const rows = items.slice(0, 40).map((o) => h("button", {
        type: "button",
        class: `sf-map-row${o.id === this.state?.targetId ? " is-target" : ""}` +
               `${o.reachable ? "" : " is-unreachable"}`,
        onclick: () => this._choose(o),
      },
        h("span", { class: `sf-map-dot sf-map-dot--${o.kind}` }),
        h("span", { class: "sf-map-row-name" }, o.label),
        h("span", { class: "sf-map-row-range" }, o.rangeText),
        h("span", { class: `sf-chip sf-chip--${o.provenance}`, title: "measured" }, o.provenance)
      ));

      // A truncated list that does not say it is truncated is a list that
      // lies about how much is out there — which in this project is the
      // one thing a readout is never allowed to do.
      const hidden = items.length - rows.length;
      if (hidden > 0) {
        rows.push(h("p", { class: "sf-map-more" },
          `${hidden} more, further out — zoom the plot or search to reach them`));
      }

      groups.push(h("section", { class: "sf-map-group-block" }, header, ...rows));
    }

    if (!groups.length) {
      groups.push(h("p", { class: "sf-map-empty" },
        "Nothing catalogued at this scale. That is the honest answer, not a loading state."));
    }
    this.railBody.replaceChildren(...groups);
  }

  _choose(o) {
    if (o.reachable) { this.handlers.onSelect?.(o.id); return; }
    // A star you cannot fly to yet. Say so rather than accepting a target
    // that will never be reached — ledger SF-L-007.
    this.handlers.onInspect?.(o.star);
  }

  _updateStatus({ frameLabel, route, targetId, time }) {
    this.statLocation.value.textContent = frameLabel || "—";

    const target = this._objects.find((o) => o.id === targetId);
    this.statTarget.value.textContent = target ? target.label
      : (route ? route.destinationLabel : "nothing selected");
    this.statDistance.value.textContent = target ? target.rangeText
      : (route ? formatDistance(route.range) : "—");
    this.statEta.value.textContent = route ? formatDuration(route.duration) : "—";

    /* The ETA is a flip-and-burn figure and it is honest about being one:
       hours to the Moon, not a loading bar. §7.2 wants the plan visible
       before it is committed to, including when the plan is "no". */
    /* The interstellar caveat outranks the route note, and has to: at that
       scale the plot is nothing but stars, and a line reading "flip and
       burn, arriving at rest" underneath them describes a trip to the
       station three hundred metres away. The reachable-looking thing on
       screen is the thing the player must not be misled about. */
    if (this.scaleId === "interstellar" && !route) {
      this.statNote.textContent =
        "Stars are plotted at their catalogued distances, and the ones with a measured " +
        "parallax can be selected and flown to. Those without one have a direction and " +
        "no distance, and are not on this plot at all.";
      this.statNote.dataset.severity = "none";
    } else if (route?.blocked) {
      this.statNote.textContent = `route refused — ${route.blocked}`;
      this.statNote.dataset.severity = "warning";
    } else if (route) {
      const peak = route.peakSpeed / 1000;
      this.statNote.textContent =
        `flip and burn at ${(route.maxAcceleration / 9.80665).toFixed(1)} g, ` +
        `peaking at ${peak.toFixed(peak < 10 ? 2 : 0)} km/s, arriving at rest.`;
      this.statNote.dataset.severity = "none";
    } else {
      this.statNote.textContent = "";
      this.statNote.dataset.severity = "none";
    }
  }

  /* ── drawing ───────────────────────────────────────────────────────── */

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const [canvas, box] of [[this.plot, this.plot], [this.insetA, this.insetA], [this.insetB, this.insetB]]) {
      const w = Math.max(1, Math.round(box.clientWidth * dpr));
      const hgt = Math.max(1, Math.round(box.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== hgt) { canvas.width = w; canvas.height = hgt; }
    }
    this._dpr = dpr;
  }

  /** The plot's shorter dimension, which is what `span` is measured across. */
  _basisPx(el = this.plot) { return Math.max(1, Math.min(el.clientWidth, el.clientHeight)); }

  _unitsPerPixel() { return this.span[this.scaleId] / this._basisPx(); }

  draw() {
    if (!this.isOpen || !this.state) return;
    this._drawPlot(this.plotCtx, this.plot, this.scaleId, this.span[this.scaleId], this.pan, false);

    /* The insets show the two scales you are *not* on, which is the only
       arrangement in which they are ever worth the space they cost. */
    const others = SCALES.filter((s) => s.id !== this.scaleId);
    this.insetALabel.textContent = `${others[0].label} view`;
    this.insetBLabel.textContent = `${others[1].label} view`;
    for (const [canvas, s] of [[this.insetA, others[0]], [this.insetB, others[1]]]) {
      this._drawPlot(canvas.getContext("2d"), canvas, s.id, s.span, { x: 0, y: 0 }, true);
    }
  }

  /**
   * One plot. The same routine draws the main view and both insets, which
   * is why the insets cannot drift out of agreement with it.
   */
  _drawPlot(ctx, canvas, scaleId, span, pan, compact) {
    const dpr = this._dpr || 1;
    const w = canvas.width, hgt = canvas.height;
    if (!w || !hgt) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    ctx.save();
    ctx.scale(dpr, dpr);
    const cw = w / dpr, ch = hgt / dpr;

    ctx.fillStyle = "#04070b";
    ctx.fillRect(0, 0, cw, ch);

    const perUnit = Math.min(cw, ch) / span;
    const cx = cw / 2, cy = ch / 2;
    const toScreen = (o) => ({
      x: cx + (o.x - pan.x) * perUnit,
      y: cy - (o.y - pan.y) * perUnit,
    });

    /* ── range rings ───────────────────────────────────────────────────
       Concentric circles at round distances from the ship, each labelled.
       This is what makes the plot a map rather than a picture: without
       them there is no way to read a distance off it. */
    const ringStep = niceNumber(span / 4.2);
    ctx.lineWidth = 1;
    ctx.font = `${compact ? 8 : 10}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    for (let r = ringStep; r <= span * 0.75; r += ringStep) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(120,190,220,0.13)";
      ctx.arc(cx - pan.x * perUnit, cy + pan.y * perUnit, r * perUnit, 0, Math.PI * 2);
      ctx.stroke();
      // Label the ring where it crosses the up-right diagonal, and only
      // when that point is actually on the plot — a ring label pinned to
      // an edge claims a distance that is not there.
      const lx = cx - pan.x * perUnit + r * perUnit * 0.7071 + 4;
      const ly = cy + pan.y * perUnit - r * perUnit * 0.7071 - 4;
      const underTitle = lx > cw - 250 && ly < 46;
      if (!compact && !underTitle && lx > 4 && ly > 20 && lx < cw - 80 && ly < ch - 4) {
        ctx.fillStyle = "rgba(150,200,220,0.4)";
        ctx.fillText(scaleId === "interstellar" ? formatLy(r) : formatDistance(r), lx, ly);
      }
    }

    const objects = scaleId === this.scaleId
      ? this._objects
      : this._collectFor(scaleId);

    /* ── the route ─────────────────────────────────────────────────────
       Dashed, with the distance written on it and an arrowhead at the
       destination — the reference image's language exactly. */
    const route = this.state.route;
    const dest = route && objects.find((o) => o.id === route.destinationId);
    if (dest && this.filters[dest.kind]) {
      const p = toScreen(dest);
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = route.blocked ? "rgba(255,120,100,0.75)" : "rgba(130,225,255,0.7)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx - pan.x * perUnit, cy + pan.y * perUnit);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();

      /* The route's length is written on the line — but only when the line
         is long enough to be worth reading. Metres from the station the
         route is a stub under the target reticle, and its label lands on
         top of the range the target marker is already showing. */
      const runPx = Math.hypot(p.x - (cx - pan.x * perUnit), p.y - (cy + pan.y * perUnit));
      if (!compact && runPx > 70) {
        const mid = { x: (cx - pan.x * perUnit + p.x) / 2, y: (cy + pan.y * perUnit + p.y) / 2 };
        const text = scaleId === "interstellar" ? formatLy(dest.range) : formatDistance(dest.range);
        ctx.fillStyle = "#04070b";
        const tw = ctx.measureText(text).width;
        ctx.fillRect(mid.x - tw / 2 - 4, mid.y - 7, tw + 8, 13);
        ctx.fillStyle = route.blocked ? "#ff8f7a" : "#8ce5ff";
        ctx.textAlign = "center";
        ctx.fillText(text, mid.x, mid.y + 3);
        ctx.textAlign = "left";
      }
    }

    /* ── objects ───────────────────────────────────────────────────── */
    const placed = [];
    for (const o of objects) {
      if (!this.filters[o.kind]) continue;
      const p = toScreen(o);
      if (p.x < -40 || p.y < -40 || p.x > cw + 40 || p.y > ch + 40) continue;

      const isTarget = o.id === this.state.targetId;
      const colour = KIND[o.kind].colour;

      /* Bodies are drawn at their true angular extent when that is more
         than a couple of pixels, and as a marker when it is not. A marker
         is bigger than the object; the object is never bigger than it is
         (ledger SF-L-010). */
      const trueRadiusPx = o.radius ? o.radius * perUnit : 0;
      if (trueRadiusPx > 2.5) {
        ctx.beginPath();
        ctx.fillStyle = colour;
        ctx.globalAlpha = 0.5;
        ctx.arc(p.x, p.y, trueRadiusPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        const size = compact ? 1.6 : (o.kind === "star" ? 2.2 : 3);
        ctx.beginPath();
        ctx.fillStyle = colour;
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (isTarget) {
        // The reticle from the reference image: four corner brackets.
        ctx.strokeStyle = "#8ce5ff";
        ctx.lineWidth = 1.2;
        const r = Math.max(9, trueRadiusPx + 7), a = r * 0.45;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          ctx.beginPath();
          ctx.moveTo(p.x + sx * r, p.y + sy * r - sy * a);
          ctx.lineTo(p.x + sx * r, p.y + sy * r);
          ctx.lineTo(p.x + sx * r - sx * a, p.y + sy * r);
          ctx.stroke();
        }
      }

      /* Labels are dropped rather than stacked when they would collide —
         the same rule the canopy's floating labels follow, for the same
         reason: two overlapping labels are worth less than one. */
      if (compact) continue;
      // The box is the size of a two-line label, not of a dot. At
      // interstellar scale the neighbourhood is dense enough that a box
      // sized to the marker lets a dozen names pile into one smear.
      const near = placed.some((q) => Math.abs(q.x - p.x) < 112 && Math.abs(q.y - p.y) < 21);
      if (near && !isTarget) continue;
      placed.push(p);

      ctx.fillStyle = isTarget ? "#bff3ff" : "rgba(214,236,246,0.86)";
      ctx.font = `${isTarget ? 600 : 400} 11px ui-monospace, SFMono-Regular, Menlo, monospace`;
      // Far enough out to clear the ship's own marker, which anything the
      // ship is station-keeping with sits directly underneath.
      const dx = Math.max(16, trueRadiusPx + 6);
      ctx.fillText(o.label, p.x + dx, p.y + 3);
      ctx.fillStyle = "rgba(160,200,218,0.6)";
      ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(o.rangeText, p.x + dx, p.y + 14);
    }

    /* ── the ship ──────────────────────────────────────────────────── */
    const sx = cx - pan.x * perUnit, sy = cy + pan.y * perUnit;
    ctx.strokeStyle = KIND.ship.colour;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(sx, sy, compact ? 5 : 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = KIND.ship.colour;
    const t = compact ? 3 : 6;
    ctx.moveTo(sx, sy - t);
    ctx.lineTo(sx + t * 0.75, sy + t * 0.7);
    ctx.lineTo(sx, sy + t * 0.3);
    ctx.lineTo(sx - t * 0.75, sy + t * 0.7);
    ctx.closePath();
    ctx.fill();

    /* "You are here" is dropped whenever something else is labelled on the
       same spot, and something usually is: the ship is station-keeping
       beside the station, or sitting at the Sun on the interstellar plot.
       Of the two labels it is the one worth less — the reticle already
       says where the ship is, and no other mark on the plot says which
       object that is. Same rule as everywhere else: one label beats two
       on top of each other. */
    const crowded = placed.some((q) => Math.hypot(q.x - sx, q.y - sy) < 34);
    if (!compact && !crowded) {
      ctx.fillStyle = "rgba(159,240,255,0.72)";
      ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText("you are here", sx + 16, sy + 3);
    }

    ctx.restore();

    if (!compact) this._updateScaleBar(span, this._basisPx());
  }

  /** Objects for a scale that is not the current one — for the insets. */
  _collectFor(scaleId) {
    const was = this.scaleId;
    this.scaleId = scaleId;
    const out = this._collect(this.state);
    this.scaleId = was;
    return out;
  }

  /**
   * The scale bar. A round distance, and how wide it is on screen — the
   * one element that turns the plot from a diagram into a measurement.
   */
  _updateScaleBar(span, basisPx) {
    const target = span / 5;
    const nice = niceNumber(target);
    const px = (nice / span) * basisPx;
    this.scaleBar.querySelector(".sf-map-scalebar-line").style.width = `${px.toFixed(1)}px`;
    this.scaleBar.querySelector("b").textContent =
      this.scaleId === "interstellar" ? formatLy(nice) : formatDistance(nice);
  }

  /** Nearest object to a click, within a forgiving radius. */
  _pick(e) {
    const rect = this.plot.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    // The same basis the plot was drawn with, or clicks land on nothing.
    const perUnit = Math.min(rect.width, rect.height) / this.span[this.scaleId];
    const cx = rect.width / 2 - this.pan.x * perUnit;
    const cy = rect.height / 2 + this.pan.y * perUnit;

    let best = null, bestD = 26;
    for (const o of this._objects) {
      if (!this.filters[o.kind]) continue;
      const d = Math.hypot(cx + o.x * perUnit - mx, cy - o.y * perUnit - my);
      const reach = Math.max(9, (o.radius || 0) * perUnit);
      if (d - reach < bestD) { bestD = d - reach; best = o; }
    }
    if (best) this._choose(best);
  }
}

export { LY };
