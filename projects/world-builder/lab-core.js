/* WORLD BUILDER — THE LAB'S CORE
   ────────────────────────────────────────────────────────────────────────
   Ric, 2026-11-14: "a hexagon grid pops up. You place the hexagons, choose the
   rules for the hexagons and the properties of them … then can run it. So you
   can try a bunch of different ones to see if you can make a self replicating
   thing … so then we can test each individual property."

   A sandbox is for playing; this is for finding out. Everything a setup is —
   the kinds as typed, the rules, which hexagon sits on which cell and which
   are bonded and pinned — is one plain object that can be saved, shared, and
   run again exactly. Running an EXPERIMENT runs it against a control, the
   way replication-probe.mjs does and for the same reason (Virgo, Fernando,
   Bigge and Husbands, ECAL 2011): the same hexagons, every one scattered
   loose with no bonds and nothing pinned, for the same time on the same world
   seeds. Whatever the built world ends with more of than the control, beyond
   what it was built with, is the only thing building it can take credit for.
   And it can switch the setup's rules off one at a time and run again, so
   each rule's part shows on its own.

   The same file runs in the page and in node for the tests. It uses
   physics.js and adds no physics of its own. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LabCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* The grid: rows of cells one hexagon wide, every other row shifted half a
     hexagon, so each cell touches six others at 60° apart — the same six
     directions a hexagon's bond slots point when it faces 0. */
  const ROW = Math.sqrt(3) / 2;
  const cellXY = (c, r) => [c + (r & 1) * 0.5 + 0.5, r * ROW + 0.5];
  function cellAt(x, y) {
    const r0 = Math.round((y - 0.5) / ROW);
    let best = null, bd = Infinity;
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      const c0 = Math.round(x - 0.5 - (r & 1) * 0.5);
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        const [cx, cy] = cellXY(c, r), d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < bd) { bd = d; best = [c, r]; }
      }
    }
    return best;
  }
  const gridSize = size => ({ cols: Math.floor(size - 0.5), rows: Math.floor((size - 0.5) / ROW) });
  function adjacent(a, b) {
    const [ax, ay] = cellXY(a[0], a[1]), [bx, by] = cellXY(b[0], b[1]);
    return Math.abs(Math.hypot(ax - bx, ay - by) - 1) < 1e-6;
  }

  /* The kinds a new setup starts with: four, worked out the sandbox's way
     (bonds 1-4, pull rising with the number), every pair bonding at 4. */
  const COLORS = ["#6fb7ff", "#ffd166", "#ef6f6c", "#7bd88f", "#c59bff", "#ff9f5a", "#5ad1c8", "#f4a6d7"];
  function defaultKinds(n) {
    n = n || 4;
    return Array.from({ length: n }, (_, a) => ({
      valence: Math.min(4, a + 1), pull: +((a + 1) / 7).toFixed(2), mass: 1, shape: "any",
      bonds: Array.from({ length: n }, () => 4),
    }));
  }

  /* The rules a new setup starts with. A Lab world is built by hand, so it
     starts calm: no gravity, no breaking apart, hexagons all one size,
     looped edges, bonds that hold an angle (so shape means something) and
     bonds that settle with temperature (so where it ends up can be worked
     out). Every one can be changed. */
  const RULES = {
    size: 24, edge: "wrap", sized: false, gravity: 0, fall: 0, breaking: false, fuse: "never",
    bonding: "any", maxBonds: 6, angles: 0.6, align: 30, settle: true, bondChance: 0.4,
    startTemp: 0.5, startSpeed: 0, shake: 0.4, conduct: 0.4, radiate: 0, heater: "none",
  };
  /* Settings the Lab sets itself, so they are not offered: what the world is
     made of comes from the grid and the kinds, not from these. */
  const FIXED = new Set(["layout", "count", "kinds", "mix", "seed", "bigMass", "spin", "bonding", "maxBonds",
    "bondsPer", "bondStrength", "shift", "look", "shapeBy", "startSpeed"]);

  /* Rules a setup can be run with one of switched off, and what "off" is. */
  const SWITCHABLE = [
    ["settle", false], ["barrier", 0], ["charge", 0], ["ions", false], ["stick", 0], ["fuel", 0],
    ["angles", 0], ["swap", false], ["order", false], ["shake", 0], ["conduct", 0], ["radiate", 0], ["heater", "none"],
  ];
  function switchedOn(rules) {
    return SWITCHABLE.filter(([k, off]) => rules[k] !== undefined && rules[k] !== off).map(([k]) => k);
  }

  function blank() {
    return { v: 1, name: "Untitled", kinds: defaultKinds(4), rules: Object.assign({}, RULES), cells: [], bonds: [] };
  }

  /* Anything loaded — a file, a link, a saved slot — is checked here before
     it is used: kinds clamped by physics.labKinds, cells kept to the grid and
     to kinds that exist, one hexagon a cell, bonds only between neighbours. */
  function clean(Physics, raw) {
    const out = blank();
    if (!raw || typeof raw !== "object") return out;
    if (typeof raw.name === "string") out.name = raw.name.slice(0, 80);
    const kinds = Physics.labKinds(raw.kinds);
    if (kinds) out.kinds = kinds.map(k => ({ valence: k.valence, pull: k.pull, mass: k.mass, shape: k.shape, bonds: k.bonds.slice() }));
    if (raw.rules && typeof raw.rules === "object") {
      const known = new Set(Physics.SCHEMA.flatMap(g => g.items.map(it => it.key)));
      for (const k in raw.rules) if (known.has(k) && !FIXED.has(k)) out.rules[k] = raw.rules[k];
    }
    out.rules = Object.assign(Physics.clean(Object.assign({}, out.rules)), {});
    for (const k of FIXED) delete out.rules[k];
    const { cols, rows } = gridSize(out.rules.size);
    const seen = new Map();
    for (const cell of Array.isArray(raw.cells) ? raw.cells : []) {
      if (!Array.isArray(cell)) continue;
      const [c, r, k, pin] = cell.map(Number);
      if (!(c >= 0 && c < cols && r >= 0 && r < rows && k >= 1 && k <= out.kinds.length)) continue;
      const id = c + "," + r;
      if (seen.has(id)) continue;
      seen.set(id, out.cells.length);
      out.cells.push([Math.round(c), Math.round(r), Math.round(k), pin ? 1 : 0]);
    }
    const pairs = new Set();
    for (const b of Array.isArray(raw.bonds) ? raw.bonds : []) {
      if (!Array.isArray(b)) continue;
      const a = Number(b[0]), z = Number(b[1]);
      if (!(a >= 0 && z >= 0 && a < (raw.cells || []).length && z < (raw.cells || []).length) || a === z) continue;
      /* Bonds name cells by their place in the raw list; follow them to the kept ones. */
      const ca = raw.cells[a], cz = raw.cells[z];
      if (!Array.isArray(ca) || !Array.isArray(cz)) continue;
      const ia = seen.get(Math.round(ca[0]) + "," + Math.round(ca[1])), iz = seen.get(Math.round(cz[0]) + "," + Math.round(cz[1]));
      if (ia == null || iz == null || ia === iz) continue;
      if (!adjacent(out.cells[ia], out.cells[iz])) continue;
      const id = Math.min(ia, iz) + ":" + Math.max(ia, iz);
      if (pairs.has(id)) continue;
      pairs.add(id);
      out.bonds.push([Math.min(ia, iz), Math.max(ia, iz)]);
    }
    return out;
  }

  /* A seeded random number, so a control is the same control every time. */
  function rng(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }

  /* Build a world from a setup. `control` scatters every hexagon to a random
     cell, loose, unpinned and unbonded. `off` switches one rule off. Returns
     the world and how many of the setup's bonds could not be made (a bond
     the kinds' table, room or shape will not allow is skipped and counted). */
  function build(Physics, setup, opts) {
    opts = opts || {};
    const rules = Object.assign({}, setup.rules);
    if (opts.off) { const sw = SWITCHABLE.find(s => s[0] === opts.off); if (sw) rules[opts.off] = sw[1]; }
    const w = Physics.create(Object.assign({}, rules, { layout: "empty", seed: opts.seed || 1, kindsDef: setup.kinds }));
    const ids = [];
    const { cols, rows } = gridSize(setup.rules.size);
    let spots = null;
    if (opts.control) {
      const R = rng(opts.seed || 1);
      spots = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) spots.push([c, r]);
      for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = spots[i]; spots[i] = spots[j]; spots[j] = t; }
    }
    setup.cells.forEach((cell, q) => {
      const [c, r] = spots ? spots[q] : cell;
      const [x, y] = cellXY(c, r);
      const k = cell[2], id = w.place(x, y, k, 0, 0, setup.kinds[k - 1].mass);
      ids.push(id);
      if (id >= 0) w.edit(id, { facing: 0, pinned: !opts.control && !!cell[3] });
    });
    let failed = 0;
    if (!opts.control) for (const [a, b] of setup.bonds) if (!w.bond(ids[a], ids[b])) failed++;
    return { world: w, ids, failed };
  }

  /* What the world holds, by name (a chain "1-2-3", a ring, a lump "1·1·4"):
     the engine's own census. */
  function tally(w) {
    const out = new Map();
    for (const t of w.census().types) out.set(t.sig, t.count);
    return out;
  }
  const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

  /* The experiment, in pieces the page can show running. A JOB is one world
     seed of one variant (the setup as built, or with one rule switched off):
     the built world and its control, built side by side and run for the
     same seconds. `jobs` lists them; `startJob` builds one pair; `endJob`
     reads what each holds at the end; `summarize` turns every finished job
     into the table. The things the built world holds at the start are the
     TARGETS; for each, how many more it ends with ("made"), against how many
     the control ends with having started with none. */
  function jobs(setup, plan) {
    const runs = Math.max(1, Math.min(20, Math.round(Number(plan.runs) || 3)));
    const variants = [null, ...(plan.oneAtATime ? switchedOn(setup.rules) : [])];
    const out = [];
    for (const off of variants) for (let s = 1; s <= runs; s++) out.push({ off, seed: s });
    return out;
  }
  function startJob(Physics, setup, job) {
    const b = build(Physics, setup, { seed: job.seed, off: job.off });
    const c = build(Physics, setup, { seed: job.seed, off: job.off, control: true });
    return { job, built: b.world, control: c.world, failed: b.failed, start: tally(b.world) };
  }
  function endJob(run) {
    return { off: run.job.off, seed: run.job.seed, failed: run.failed, start: run.start, end: tally(run.built), control: tally(run.control) };
  }
  function summarize(done, seconds, runs) {
    const variants = [];
    for (const d of done) if (!variants.includes(d.off)) variants.push(d.off);
    const first = done.find(d => d.off === null) || done[0];
    const targets = first ? [...first.start.keys()] : [];
    const results = variants.map(off => {
      const per = done.filter(d => d.off === off);
      const rows = targets.map(sig => {
        const made = mean(per.map(p => (p.end.get(sig) || 0) - (p.start.get(sig) || 0)));
        const kept = mean(per.map(p => Math.min(p.end.get(sig) || 0, p.start.get(sig) || 0)));
        const control = mean(per.map(p => p.control.get(sig) || 0));
        return { sig, start: mean(per.map(p => p.start.get(sig) || 0)), kept, made, control, gain: made - control };
      });
      /* Anything else the built world made more of than the control did. */
      const sigs = new Set();
      for (const p of per) for (const sig of p.end.keys()) if (!targets.includes(sig)) sigs.add(sig);
      const extra = [...sigs].map(sig => ({ sig, built: mean(per.map(p => p.end.get(sig) || 0)), control: mean(per.map(p => p.control.get(sig) || 0)) }))
        .filter(o => o.built - o.control >= 1).sort((a, b) => (b.built - b.control) - (a.built - a.control)).slice(0, 5);
      return { off, rows, extra, runs: per.length };
    });
    const base = results.find(r => r.off === null) || { rows: [] };
    return { seconds, runs, failed: first ? first.failed : 0, results, verdict: verdict(base, runs) };
  }
  /* All of it at once, for the tests and for running by hand in node. */
  function experiment(Physics, setup, plan, progress) {
    const seconds = Math.max(1, Math.min(3600, Number(plan.seconds) || 120));
    const list = jobs(setup, plan), done = [];
    list.forEach((job, q) => {
      const run = startJob(Physics, setup, job);
      for (let f = 0; f < seconds * 60; f++) { run.built.step(1 / 60); run.control.step(1 / 60); }
      done.push(endJob(run));
      if (progress) progress((q + 1) / list.length);
    });
    return summarize(done, seconds, Math.max(1, Math.min(20, Math.round(Number(plan.runs) || 3))));
  }

  /* Said the way the probe says it: a difference is not a finding. */
  function verdict(base, runs) {
    if (!base.rows.length) return { word: "nothing built", text: "The setup holds no bonded thing, so there is nothing to look for copies of. Build something, bond it, and run again." };
    const best = base.rows.reduce((a, b) => (b.gain > a.gain ? b : a));
    if (best.gain < 0.5) return { word: "no copying", text: "The built world made no more of what it was built with than the control made from the same hexagons loose. Nothing copied anything here, at these rules, this long." };
    return { word: "a difference", text: `The built world made ${best.gain.toFixed(1)} more of ${best.sig} than the control, on average over ${runs} run${runs === 1 ? "" : "s"}. That is a difference, not yet a finding: run it with more runs and longer, and see whether it holds and grows.` };
  }

  return { ROW, cellXY, cellAt, gridSize, adjacent, COLORS, defaultKinds, RULES, FIXED, SWITCHABLE, switchedOn,
           blank, clean, build, tally, jobs, startJob, endJob, summarize, experiment, verdict };
});
