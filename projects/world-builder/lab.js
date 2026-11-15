/* THE LAB — the page. Building a setup on the grid, editing its kinds and
   rules, running it live, running it as an experiment (on the grid, beside its control),
   and keeping it. The physics is physics.js; building a world from a setup
   and judging an experiment is lab-core.js. Nothing here changes either. */
(function () {
  "use strict";
  const P = window.WBPhysics, L = window.LabCore;
  const $ = id => document.getElementById(id);
  const canvas = $("view"), ctx = canvas.getContext("2d");
  const STORE = "wb-lab-saved", CURRENT = "wb-lab-current";
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  };

  let setup = null, tool = "place", brush = 1, picked = null;     // picked: a cell index, for Bond
  let world = null, running = false, built = null, speed = 1;
  /* An experiment running on screen: the job list, the pair running now,
     the finished ones, and the plan. */
  let exp = null;

  /* ── the setup ────────────────────────────────────────────────────────── */
  function example(which) {
    const s = L.blank();
    if (which === "chain") {
      s.name = "A chain in a soup";
      s.kinds = L.defaultKinds(3);
      s.kinds[0].valence = 1; s.kinds[1].valence = 2; s.kinds[2].valence = 1;
      s.cells.push([10, 12, 1, 0], [11, 12, 2, 0], [12, 12, 3, 0]);
      s.bonds.push([0, 1], [1, 2]);
      setup = L.clean(P, s);
      scatter(1, 20); scatter(2, 20); scatter(3, 20);
      return;
    }
    s.name = "Untitled";
    setup = L.clean(P, s);
  }
  const cellIndex = (c, r) => setup.cells.findIndex(x => x[0] === c && x[1] === r);
  function bondIndex(a, b) { return setup.bonds.findIndex(x => (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a)); }
  function bondsOf(a) { return setup.bonds.filter(x => x[0] === a || x[1] === a).length; }
  function removeCell(i) {
    setup.cells.splice(i, 1);
    setup.bonds = setup.bonds.filter(b => b[0] !== i && b[1] !== i).map(b => b.map(v => (v > i ? v - 1 : v)));
    if (picked === i) picked = null; else if (picked > i) picked--;
  }
  function scatter(k, count) {
    const { cols, rows } = L.gridSize(setup.rules.size);
    const free = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (cellIndex(c, r) < 0) free.push([c, r]);
    for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = free[i]; free[i] = free[j]; free[j] = t; }
    const n = Math.min(count, free.length);
    for (let q = 0; q < n; q++) setup.cells.push([free[q][0], free[q][1], k, 0]);
    return n;
  }
  function changed() {
    store.set(CURRENT, setup);
    draw();
    status();
  }

  /* ── drawing ──────────────────────────────────────────────────────────── */
  const HEX = []; for (let k = 0; k < 6; k++) HEX.push([Math.cos(Math.PI / 6 + k * Math.PI / 3), Math.sin(Math.PI / 6 + k * Math.PI / 3)]);
  function hexPath(p, x, y, rad, turn) {
    const c = Math.cos(turn || 0), n = Math.sin(turn || 0);
    for (let k = 0; k < 6; k++) {
      const vx = HEX[k][0] * rad, vy = HEX[k][1] * rad, px = x + vx * c - vy * n, py = y + vx * n + vy * c;
      if (k === 0) p.moveTo(px, py); else p.lineTo(px, py);
    }
    p.closePath();
  }
  let view = { s: 10, ox: 0, oy: 0 };
  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const size = setup.rules.size, wh = size, hh = size;
    const s = Math.min((W - 16) / wh, (H - 16) / hh);
    view = { s, ox: (W - wh * s) / 2, oy: (H - hh * s) / 2, W, H };
  }
  const colorOf = k => L.COLORS[(k - 1) % 8];
  function draw() {
    if (!setup) return;
    fit();
    const { s, ox, oy, W, H } = view;
    ctx.fillStyle = "#070a0b"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#2a383f"; ctx.setLineDash(setup.rules.edge === "wrap" ? [5, 5] : []);
    ctx.strokeRect(ox, oy, setup.rules.size * s, setup.rules.size * s); ctx.setLineDash([]);
    if (exp) return drawExperiment();
    if (world) return drawWorld(world, view);
    /* The empty cells, faintly, when there is room to see them. */
    const { cols, rows } = L.gridSize(setup.rules.size);
    if (s >= 9) {
      const p = new Path2D();
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const [x, y] = L.cellXY(c, r); hexPath(p, ox + x * s, oy + y * s, s * 0.56); }
      ctx.strokeStyle = "rgba(152,168,165,.14)"; ctx.lineWidth = 1; ctx.stroke(p);
    }
    setup.cells.forEach((cell, i) => {
      const [x, y] = L.cellXY(cell[0], cell[1]);
      const p = new Path2D(); hexPath(p, ox + x * s, oy + y * s, s * 0.52);
      ctx.fillStyle = colorOf(cell[2]); ctx.fill(p);
      if (i === picked) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke(p); }
      if (cell[3]) { const pr = Math.max(2, s * 0.17); ctx.fillStyle = "#070a0b"; ctx.fillRect(ox + x * s - pr, oy + y * s - pr, pr * 2, pr * 2); }
      if (s >= 16) { ctx.fillStyle = "#0c1113"; ctx.font = "600 " + Math.round(s * 0.36) + "px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(cell[2]), ox + x * s, oy + y * s + (cell[3] ? s * 0.28 : 0)); }
    });
    /* Bonds on top, as a dark bar with a light core, so they show across
       hexagons of any colour. */
    const segs = setup.bonds.map(([a, b]) => [L.cellXY(setup.cells[a][0], setup.cells[a][1]), L.cellXY(setup.cells[b][0], setup.cells[b][1])]);
    bondLines(segs.map(([[ax, ay], [bx, by]]) => [ox + ax * s, oy + ay * s, ox + bx * s, oy + by * s]), s);
  }
  function bondLines(list, s) {
    for (const [col, wd] of [["#070a0b", Math.max(4, s * 0.22)], ["#ffffff", Math.max(1.5, s * 0.09)]]) {
      ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineCap = "round"; ctx.beginPath();
      for (const [x1, y1, x2, y2] of list) { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
      ctx.stroke();
    }
  }
  /* The built world and its control, side by side (or one above the other
     when the screen is tall), each in its own frame with its name over it. */
  function drawExperiment() {
    const { W, H } = view, size = setup.rules.size, wide = W >= H;
    const rects = wide ? [[0, 0, W / 2, H], [W / 2, 0, W / 2, H]] : [[0, 0, W, H / 2], [0, H / 2, W, H / 2]];
    ctx.fillStyle = "#070a0b"; ctx.fillRect(0, 0, W, H);
    const names = [exp.run.job.off ? "As built, with “" + labelOf(exp.run.job.off) + "” off" : "As built", "Control (loose)"];
    [exp.run.built, exp.run.control].forEach((w, k) => {
      const [x0, y0, rw, rh] = rects[k], s = Math.min((rw - 16) / size, (rh - 34) / size);
      const v = { s, ox: x0 + (rw - size * s) / 2, oy: y0 + 26 + (rh - 26 - size * s) / 2 };
      ctx.strokeStyle = "#2a383f"; ctx.setLineDash(setup.rules.edge === "wrap" ? [5, 5] : []);
      ctx.strokeRect(v.ox, v.oy, size * s, size * s); ctx.setLineDash([]);
      ctx.fillStyle = k ? "#98a8a5" : "#e0a340"; ctx.font = "600 13px system-ui"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(names[k], v.ox, v.oy - 11);
      drawWorld(w, v);
    });
  }
  function drawWorld(w, v) {
    const { s, ox, oy } = v, size = setup.rules.size;
    const turned = w.settings.angles > 0;
    const paths = new Map();
    for (let i = 0; i < w.n; i++) {
      if (!w.alive[i]) continue;
      const col = colorOf(w.kind[i]);
      let p = paths.get(col); if (!p) { p = new Path2D(); paths.set(col, p); }
      hexPath(p, ox + w.x[i] * s, oy + w.y[i] * s, w.r[i] * s * 1.12, turned ? w.face[i] : 0);
    }
    for (const [col, p] of paths) { ctx.fillStyle = col; ctx.fill(p); }
    ctx.fillStyle = "#070a0b";
    for (let i = 0; i < w.n; i++) if (w.alive[i] && w.pinned[i]) { const pr = Math.max(2, s * 0.17); ctx.fillRect(ox + w.x[i] * s - pr, oy + w.y[i] * s - pr, pr * 2, pr * 2); }
    const segs = [];
    for (const b of w.bonds.values()) {
      const dx = w.x[b.b] - w.x[b.a], dy = w.y[b.b] - w.y[b.a];
      if (Math.abs(dx) > size / 2 || Math.abs(dy) > size / 2) continue;      // across the wrapped edge
      segs.push([ox + w.x[b.a] * s, oy + w.y[b.a] * s, ox + w.x[b.b] * s, oy + w.y[b.b] * s]);
    }
    bondLines(segs, s);
  }

  /* ── the tools ────────────────────────────────────────────────────────── */
  function at(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = (ev.clientX - rect.left - view.ox) / view.s, y = (ev.clientY - rect.top - view.oy) / view.s;
    const cell = L.cellAt(x, y), { cols, rows } = L.gridSize(setup.rules.size);
    return cell[0] >= 0 && cell[0] < cols && cell[1] >= 0 && cell[1] < rows ? cell : null;
  }
  let down = false, lastCell = "";
  function say(text, cls) { const m = $("status"); m.textContent = text; m.className = "status " + (cls || ""); }
  function act(cell, first) {
    if (!cell || world) return;
    const id = cell.join(","), i = cellIndex(cell[0], cell[1]);
    if (!first && id === lastCell) return;
    lastCell = id;
    if (tool === "place") {
      if (i < 0) setup.cells.push([cell[0], cell[1], brush, 0]);
      else if (first && setup.cells[i][2] !== brush) {
        if (bondsOf(i) > setup.kinds[brush - 1].valence) return say("That hexagon holds more bonds than a kind " + brush + " can.", "warn");
        setup.cells[i][2] = brush;
      }
    } else if (tool === "erase") {
      if (i >= 0) removeCell(i);
    } else if (tool === "pin" && first) {
      if (i >= 0) setup.cells[i][3] = setup.cells[i][3] ? 0 : 1;
    } else if (tool === "bond" && first) {
      if (i < 0) { picked = null; draw(); return; }
      if (picked === null || picked === i) { picked = picked === i ? null : i; draw(); return status(); }
      const a = picked, b = i;
      if (!L.adjacent(setup.cells[a], setup.cells[b])) { picked = i; draw(); return say("Those two are not touching. Tap one, then one right next to it."); }
      const have = bondIndex(a, b);
      if (have >= 0) { setup.bonds.splice(have, 1); picked = null; changed(); return say("Unbonded."); }
      const ka = setup.cells[a][2], kb = setup.cells[b][2];
      if (!(setup.kinds[ka - 1].bonds[kb - 1] > 0)) { picked = null; draw(); return say("Kinds " + ka + " and " + kb + " never bond — their strength in Kinds is 0.", "warn"); }
      for (const [x, k] of [[a, ka], [b, kb]]) if (bondsOf(x) >= setup.kinds[k - 1].valence) { picked = null; draw(); return say("A kind " + k + " holds " + setup.kinds[k - 1].valence + " bond" + (setup.kinds[k - 1].valence === 1 ? "" : "s") + ", and that one is full.", "warn"); }
      setup.bonds.push([Math.min(a, b), Math.max(a, b)]);
      picked = null;
    }
    changed();
  }
  canvas.addEventListener("pointerdown", ev => { if (world) return; down = true; lastCell = ""; canvas.setPointerCapture(ev.pointerId); act(at(ev), true); });
  canvas.addEventListener("pointermove", ev => { if (down && (tool === "place" || tool === "erase")) act(at(ev), false); });
  canvas.addEventListener("pointerup", () => { down = false; });
  canvas.addEventListener("pointercancel", () => { down = false; });
  for (const b of document.querySelectorAll("[data-tool]")) b.addEventListener("click", () => {
    tool = b.dataset.tool; picked = null;
    for (const o of document.querySelectorAll("[data-tool]")) o.setAttribute("aria-pressed", String(o === b));
    draw();
  });
  function palette() {
    const box = $("palette"); box.textContent = "";
    if (brush > setup.kinds.length) brush = 1;
    setup.kinds.forEach((k, a) => {
      const b = document.createElement("button");
      b.className = "sw"; b.style.background = colorOf(a + 1); b.textContent = String(a + 1);
      b.setAttribute("aria-label", "Kind " + (a + 1)); b.setAttribute("aria-pressed", String(brush === a + 1));
      b.addEventListener("click", () => { brush = a + 1; palette(); });
      box.appendChild(b);
    });
    const sel = $("looseKind"); sel.textContent = "";
    setup.kinds.forEach((k, a) => { const o = document.createElement("option"); o.value = String(a + 1); o.textContent = "Kind " + (a + 1); sel.appendChild(o); });
  }

  /* ── status ───────────────────────────────────────────────────────────── */
  function status() {
    if (exp) {
      const st = exp.run.built.stats(), a = L.tally(exp.run.built), c = L.tally(exp.run.control);
      const things = [...exp.run.start.keys()].slice(0, 3).map(sig => sig + ": " + (a.get(sig) || 0) + " built, " + (c.get(sig) || 0) + " control").join(" · ");
      const b = document.createElement("b");
      b.textContent = "Run " + (exp.q + 1) + " of " + exp.list.length;
      $("status").className = "status"; $("status").textContent = "";
      $("status").append(b, " · " + st.time.toFixed(0) + " of " + exp.seconds + " s" + (things ? " · " + things : ""));
      return;
    }
    if (world) {
      const st = world.stats(), c = world.census();
      const top = c.types.slice(0, 5).map(t => t.count + "× " + t.sig).join(", ");
      $("status").className = "status";
      $("status").innerHTML = "";
      const b = document.createElement("b"); b.textContent = st.time.toFixed(0) + " s";
      $("status").append(b, " · " + st.bonds + " bonds · " + c.free + " loose · temperature " + st.temperature.toFixed(2) + (top ? " · " + top : ""));
      return;
    }
    const pins = setup.cells.filter(c => c[3]).length;
    say(setup.cells.length + " hexagons, " + setup.bonds.length + " bonds" + (pins ? ", " + pins + " pinned" : "") + (picked !== null ? " · now tap a touching hexagon to bond it" : ""));
  }

  /* ── running it live ──────────────────────────────────────────────────── */
  function startRun() {
    if (!world) {
      built = L.build(P, setup, { seed: 1 });
      world = built.world;
      if (built.failed) say(built.failed + " of the bonds you drew could not be made — the kinds' table, their room or their shape would not allow it.", "warn");
    }
    running = !running;
    $("run").textContent = running ? "Pause" : "Run";
    $("reset").hidden = false;
    for (const b of document.querySelectorAll("[data-tool]")) b.disabled = true;
    if (running) requestAnimationFrame(loop);
  }
  function stopRun() {
    running = false; world = null; built = null;
    $("run").textContent = "Run"; $("reset").hidden = true;
    for (const b of document.querySelectorAll("[data-tool]")) b.disabled = false;
    draw(); status();
  }
  let lastStatus = 0;
  function loop(t) {
    if (!running || !world) return;
    advance(t, () => world.step(1 / 60));
    draw();
    if (t - lastStatus > 400) { lastStatus = t; status(); }
    requestAnimationFrame(loop);
  }
  $("run").addEventListener("click", startRun);
  $("reset").addEventListener("click", stopRun);
  $("speed").addEventListener("change", e => { speed = e.target.value === "max" ? "max" : Number(e.target.value) || 1; });
  /* One frame's worth of steps: the speed, or with Max, as many as fit in
     about a frame's time. */
  function advance(t, stepOnce) {
    if (speed !== "max") { for (let k = 0; k < speed; k++) stepOnce(); return; }
    const until = performance.now() + 12;
    do stepOnce(); while (performance.now() < until);
  }

  /* ── tabs ─────────────────────────────────────────────────────────────── */
  for (const t of document.querySelectorAll("[data-tab]")) t.addEventListener("click", () => {
    for (const o of document.querySelectorAll("[data-tab]")) o.setAttribute("aria-selected", String(o === t));
    for (const p of document.querySelectorAll("[data-pane]")) p.hidden = p.dataset.pane !== t.dataset.tab;
    if (t.dataset.tab === "saved") savedList();
  });

  /* ── Build pane ───────────────────────────────────────────────────────── */
  function buildPane() {
    $("name").value = setup.name;
    $("size").value = setup.rules.size;
  }
  $("name").addEventListener("input", e => { setup.name = e.target.value.slice(0, 80); store.set(CURRENT, setup); });
  $("size").addEventListener("change", e => {
    if (world) stopRun();
    const v = Math.max(8, Math.min(60, Math.round(Number(e.target.value) || 24)));
    setup.rules.size = v;
    setup = L.clean(P, setup);           // drops what no longer fits
    e.target.value = v; changed();
  });
  $("addLoose").addEventListener("click", () => {
    if (world) stopRun();
    const n = scatter(Number($("looseKind").value) || 1, Math.max(1, Math.min(2000, Number($("looseCount").value) || 0)));
    $("buildMsg").textContent = n ? "Scattered " + n + "." : "No empty cells left.";
    changed();
  });
  $("clear").addEventListener("click", () => { if (world) stopRun(); setup.cells = []; setup.bonds = []; picked = null; changed(); });
  $("loadExample").addEventListener("click", () => { if (world) stopRun(); example($("example").value); refresh(); });

  /* ── Kinds pane ───────────────────────────────────────────────────────── */
  function kindsPane() {
    const box = $("kinds"); box.textContent = "";
    setup.kinds.forEach((k, a) => {
      const div = document.createElement("div"); div.className = "kind";
      const head = document.createElement("div"); head.className = "head";
      const sw = document.createElement("span"); sw.className = "sw"; sw.style.background = colorOf(a + 1); sw.textContent = String(a + 1);
      const h = document.createElement("h3"); h.textContent = "Kind " + (a + 1);
      head.append(sw, h); div.appendChild(head);
      const field = (label, el) => { const f = document.createElement("div"); f.className = "field"; const l = document.createElement("label"); l.textContent = label; const id = "k" + a + label.replace(/\W/g, ""); l.htmlFor = id; el.id = id; f.append(l, el); div.appendChild(f); };
      const num = (key, min, max, step) => {
        const i = document.createElement("input"); i.type = "number"; i.min = min; i.max = max; i.step = step; i.value = k[key];
        i.addEventListener("change", () => { let v = Number(i.value); if (!isFinite(v)) v = k[key]; v = Math.min(max, Math.max(min, v)); if (key === "valence") v = Math.round(v); k[key] = v; i.value = v; trimBonds(); changed(); });
        return i;
      };
      field("Bonds it holds", num("valence", 0, 6, 1));
      field("Pull", num("pull", 0, 1, 0.05));
      field("Mass", num("mass", 0.1, 100, 0.1));
      const shape = document.createElement("select");
      for (const [v, t] of [["any", "Anywhere"], ["straight", "Straight"], ["bent", "Bent (120°)"], ["y", "A Y"], ["cross", "A cross"]]) { const o = document.createElement("option"); o.value = v; o.textContent = t; shape.appendChild(o); }
      shape.value = k.shape; shape.addEventListener("change", () => { k.shape = shape.value; changed(); });
      field("Shape", shape);
      box.appendChild(div);
    });
    const t = document.createElement("table"); t.className = "grid";
    const hr = document.createElement("tr"); hr.appendChild(document.createElement("th"));
    setup.kinds.forEach((_, a) => { const th = document.createElement("th"); th.textContent = String(a + 1); th.style.color = colorOf(a + 1); hr.appendChild(th); });
    t.appendChild(hr);
    setup.kinds.forEach((k, a) => {
      const tr = document.createElement("tr"); const th = document.createElement("th"); th.textContent = String(a + 1); th.style.color = colorOf(a + 1); tr.appendChild(th);
      setup.kinds.forEach((_, b) => {
        const td = document.createElement("td"); const i = document.createElement("input");
        i.type = "number"; i.min = 0; i.max = 1000; i.step = 0.5; i.value = k.bonds[b];
        i.setAttribute("aria-label", "Bond strength between kind " + (a + 1) + " and kind " + (b + 1));
        i.addEventListener("change", () => {
          let v = Math.min(1000, Math.max(0, Number(i.value) || 0));
          setup.kinds[a].bonds[b] = v; setup.kinds[b].bonds[a] = v;
          setup.bonds = setup.bonds.filter(([x, y]) => setup.kinds[setup.cells[x][2] - 1].bonds[setup.cells[y][2] - 1] > 0);
          kindsPane(); changed();
        });
        td.appendChild(i); tr.appendChild(td);
      });
      t.appendChild(tr);
    });
    $("matrix").textContent = ""; $("matrix").appendChild(t);
  }
  /* A kind that now holds fewer bonds than it is drawn with loses the extra. */
  function trimBonds() {
    setup.cells.forEach((cell, i) => {
      let over = bondsOf(i) - setup.kinds[cell[2] - 1].valence;
      while (over-- > 0) setup.bonds.splice(setup.bonds.findIndex(b => b[0] === i || b[1] === i), 1);
    });
  }
  $("addKind").addEventListener("click", () => {
    if (setup.kinds.length >= 8) return;
    const n = setup.kinds.length;
    for (const k of setup.kinds) k.bonds.push(4);
    setup.kinds.push({ valence: 2, pull: 0.5, mass: 1, shape: "any", bonds: Array.from({ length: n + 1 }, () => 4) });
    if (world) stopRun(); refresh();
  });
  $("dropKind").addEventListener("click", () => {
    if (setup.kinds.length <= 1) return;
    const k = setup.kinds.length;
    for (let i = setup.cells.length - 1; i >= 0; i--) if (setup.cells[i][2] === k) removeCell(i);
    setup.kinds.pop(); for (const x of setup.kinds) x.bonds.pop();
    if (world) stopRun(); refresh();
  });

  /* ── Rules pane: built from the engine's own list ─────────────────────── */
  function rulesPane() {
    const box = $("rules"); box.textContent = "";
    const ctxRules = Object.assign({}, P.clean(setup.rules), { bonding: "any" });
    for (const g of P.SCHEMA) {
      const items = g.items.filter(it => !L.FIXED.has(it.key) && it.key !== "size" && (!it.when || it.when(ctxRules)));
      if (!items.length) continue;
      const grp = document.createElement("div"); grp.className = "group";
      const h = document.createElement("h3"); h.textContent = g.title; grp.appendChild(h);
      for (const it of items) {
        const f = document.createElement("div"); f.className = "field";
        const l = document.createElement("label"); l.textContent = it.label; l.htmlFor = "r-" + it.key; f.appendChild(l);
        const v = setup.rules[it.key] !== undefined ? setup.rules[it.key] : it.def;
        let el;
        if (it.type === "toggle") { el = document.createElement("input"); el.type = "checkbox"; el.checked = !!v; }
        else if (it.type === "select") { el = document.createElement("select"); for (const [ov, ot] of it.options) { const o = document.createElement("option"); o.value = ov; o.textContent = ot; el.appendChild(o); } el.value = v; }
        else { el = document.createElement("input"); el.type = "number"; el.min = it.min; el.max = it.max; el.step = it.step; el.value = v; }
        el.id = "r-" + it.key;
        el.addEventListener("change", () => {
          const val = it.type === "toggle" ? el.checked : it.type === "select" ? el.value : Number(el.value);
          setup.rules[it.key] = val;
          setup.rules = Object.assign(setup.rules, pick(P.clean(setup.rules), it.key));
          if (world) stopRun();
          rulesPane(); changed();
        });
        f.appendChild(el); grp.appendChild(f);
        if (it.help) { const p = document.createElement("p"); p.className = "help"; p.textContent = it.help; grp.appendChild(p); }
      }
      box.appendChild(grp);
    }
  }
  const pick = (o, k) => ({ [k]: o[k] });

  /* ── Experiment pane ──────────────────────────────────────────────────── */
  /* The experiment runs right on the grid: the built world and its control
     side by side, at the toolbar's speed, one run after another, and the
     table fills in as each run ends. */
  $("start").addEventListener("click", () => {
    if (exp) return;
    if (world) stopRun();
    const plan = { seconds: Math.max(1, Math.min(3600, Number($("secs").value) || 120)), runs: Math.max(1, Math.min(20, Math.round(Number($("runs").value) || 3))), oneAtATime: $("oneOff").checked };
    exp = { list: L.jobs(setup, plan), q: 0, done: [], seconds: plan.seconds, runs: plan.runs, run: null };
    exp.run = L.startJob(P, setup, exp.list[0]);
    if (speed === 1) { speed = 8; $("speed").value = "8"; }
    $("start").hidden = true; $("cancel").hidden = false; $("results").textContent = "";
    $("expMsg").textContent = exp.list.length + " run" + (exp.list.length === 1 ? "" : "s") + " of " + plan.seconds + " s each, shown on the grid. Speed it up with the speed menu.";
    for (const b of document.querySelectorAll("[data-tool]")) b.disabled = true;
    $("run").disabled = true;
    if (canvas.getBoundingClientRect().top < 0 || canvas.getBoundingClientRect().bottom > innerHeight) canvas.scrollIntoView({ behavior: "smooth", block: "center" });
    requestAnimationFrame(expLoop);
  });
  function expLoop(t) {
    if (!exp) return;
    advance(t, () => {
      if (exp.run.built.stats().time >= exp.seconds - 1e-9) return;
      exp.run.built.step(1 / 60); exp.run.control.step(1 / 60);
    });
    if (exp.run.built.stats().time >= exp.seconds - 1e-9) {
      exp.done.push(L.endJob(exp.run));
      showResults(L.summarize(exp.done, exp.seconds, exp.runs), exp.q + 1 < exp.list.length);
      exp.q++;
      if (exp.q >= exp.list.length) return endExperiment("Done.");
      exp.run = L.startJob(P, setup, exp.list[exp.q]);
    }
    draw();
    if (t - lastStatus > 300) { lastStatus = t; status(); }
    requestAnimationFrame(expLoop);
  }
  function endExperiment(word) {
    exp = null;
    $("start").hidden = false; $("cancel").hidden = true; $("run").disabled = false;
    for (const b of document.querySelectorAll("[data-tool]")) b.disabled = false;
    $("expMsg").textContent = word;
    draw(); status();
  }
  $("cancel").addEventListener("click", () => endExperiment("Stopped. What finished is in the table."));
  const fmt = v => (Math.abs(v) < 0.05 ? "0" : v.toFixed(1));
  function showResults(res, partial) {
    const box = $("results"); box.textContent = "";
    if (partial) { const p = document.createElement("p"); p.className = "small"; p.textContent = "So far — still running."; box.appendChild(p); }
    const v = document.createElement("div"); v.className = "verdict";
    const b = document.createElement("b"); b.textContent = res.verdict.word.charAt(0).toUpperCase() + res.verdict.word.slice(1) + ". ";
    v.append(b, res.verdict.text); box.appendChild(v);
    if (res.failed) { const p = document.createElement("p"); p.className = "small warn"; p.textContent = res.failed + " of the drawn bonds could not be made, so the built world started without them."; box.appendChild(p); }
    const note = document.createElement("p"); note.className = "small";
    note.textContent = res.runs + " run" + (res.runs === 1 ? "" : "s") + " of " + res.seconds + " s each. Built: what the setup started with. Made: how many more it ended with (negative: lost). Control: how many the loose control ended with. Gain = made − control.";
    box.appendChild(note);
    for (const r of res.results) {
      const h = document.createElement("h3"); h.textContent = r.off ? "With “" + labelOf(r.off) + "” off" : "As built";
      h.style.margin = ".8rem 0 .2rem"; h.style.fontSize = ".95rem"; box.appendChild(h);
      const t = document.createElement("table"); t.className = "res";
      t.innerHTML = "<tr><th>Thing</th><th>Built</th><th>Made</th><th>Control</th><th>Gain</th></tr>";
      for (const row of r.rows) {
        const tr = document.createElement("tr");
        for (const val of [row.sig, fmt(row.start), fmt(row.made), fmt(row.control), fmt(row.gain)]) { const td = document.createElement("td"); td.textContent = val; tr.appendChild(td); }
        if (row.gain >= 0.5) tr.className = "good";
        t.appendChild(tr);
      }
      box.appendChild(t);
      if (r.extra.length) {
        const p = document.createElement("p"); p.className = "small";
        p.textContent = "Also more common than in the control: " + r.extra.map(o => o.sig + " (" + o.built.toFixed(1) + " against " + o.control.toFixed(1) + ")").join(", ") + ". Often pieces of what was built, coming apart.";
        box.appendChild(p);
      }
    }
  }
  function labelOf(key) { for (const g of P.SCHEMA) for (const it of g.items) if (it.key === key) return it.label; return key; }

  /* ── Saved pane ───────────────────────────────────────────────────────── */
  function savedList() {
    const list = store.get(STORE) || [], ul = $("savedList"); ul.textContent = "";
    if (!list.length) { const li = document.createElement("li"); li.className = "small"; li.textContent = "Nothing saved here yet."; ul.appendChild(li); }
    list.forEach((item, i) => {
      const li = document.createElement("li"); const span = document.createElement("span");
      span.textContent = item.name + " — " + item.cells.length + " hexagons";
      const open = document.createElement("button"); open.className = "btn"; open.textContent = "Open";
      open.addEventListener("click", () => { if (world) stopRun(); setup = L.clean(P, item); refresh(); $("savedMsg").textContent = "Opened “" + setup.name + "”."; });
      const del = document.createElement("button"); del.className = "btn"; del.textContent = "Delete";
      del.addEventListener("click", () => { const l = store.get(STORE) || []; l.splice(i, 1); store.set(STORE, l); savedList(); });
      li.append(span, open, del); ul.appendChild(li);
    });
  }
  $("save").addEventListener("click", () => {
    const list = store.get(STORE) || [];
    const at = list.findIndex(x => x.name === setup.name);
    const copy = JSON.parse(JSON.stringify(setup));
    if (at >= 0) list[at] = copy; else list.unshift(copy);
    $("savedMsg").textContent = store.set(STORE, list.slice(0, 50)) ? "Saved as “" + setup.name + "”." : "This browser would not save it (storage is off or full).";
    savedList();
  });
  const toB64 = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const fromB64 = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));
  $("link").addEventListener("click", async () => {
    const url = location.href.split("#")[0] + "#s=" + toB64(JSON.stringify(setup));
    if (url.length > 60000) { $("savedMsg").textContent = "Too big for a link — download it instead."; return; }
    try { await navigator.clipboard.writeText(url); $("savedMsg").textContent = "Link copied."; }
    catch (e) { history.replaceState(null, "", url); $("savedMsg").textContent = "Could not copy — the link is now in the address bar."; }
  });
  $("download").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(setup, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = (setup.name || "setup").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") + ".json";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("upload").addEventListener("change", async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try { if (world) stopRun(); setup = L.clean(P, JSON.parse(await f.text())); refresh(); $("savedMsg").textContent = "Opened “" + setup.name + "”."; }
    catch (err) { $("savedMsg").textContent = "That file is not a Lab setup."; }
    e.target.value = "";
  });

  /* ── start ────────────────────────────────────────────────────────────── */
  function refresh() { palette(); buildPane(); kindsPane(); rulesPane(); changed(); }
  (function boot() {
    const m = /#s=([\w-]+)/.exec(location.hash);
    let from = null;
    if (m) { try { from = JSON.parse(fromB64(m[1])); } catch (e) { from = null; } }
    if (!from) from = store.get(CURRENT);
    if (from) setup = L.clean(P, from); else example("chain");
    refresh();
    window.addEventListener("resize", draw);
  })();
})();
