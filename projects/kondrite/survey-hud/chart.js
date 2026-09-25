"use strict";
/* KONDRITE — SURVEY INTERFACE: THE CHART PAGE
   ─────────────────────────────────────────────────────────────────────────────
   How far the chart pulls back, borders you have mapped, and the chart itself. */

/* ═══ THE CHART PAGE ══════════════════════════════════════════════════════
   Its own screen, with the world not drawn behind it. Space has no edges, so
   the chart has no extent either: it is a window you pan and zoom over an
   infinite lattice, and it opens centred on you. */
/* ── how far the chart can pull back ──────────────────────────────────────
   Five steps, and the widest of them showed 250,000 units across. That was
   fine when every sector's last landmark sat around 108,000 units out; it
   stopped being fine when worlds started rolling their own size, because a
   sprawling one now reaches past 180,000 in every direction — 360,000 across
   — and the map simply could not be pulled back far enough to show you the
   place you were flying around in.

   Nine steps now, from 690,000 units across down to 8,300. The widest fits
   any world this generator can roll with room to spare, and the closest is
   tight enough to pick one wreck out of a field. */
/* The zoom ladder, and it has to reach as far as the sector does. The widest
   step was 0.00145, which shows about 690,000 units across — fine when the
   furthest landmark stood at 112,000 and useless now that the ladder runs to
   three and a half million and worlds are generated past seven. A chart that
   cannot be zoomed out far enough to contain the thing it is charting is not a
   chart of it.

   Six more steps at the wide end, each half the last, so the widest shows about
   forty million units. That is deliberately more than the sector needs: a
   world's distance is stretched by its sector's own `spread`, which runs to
   2.1, so the furthest landmark in the widest seed measured lands past seven
   million and the chart has to hold all of it with room to spare. */
const ZOOMS = [0.000025, 0.00005, 0.0001, 0.0002, 0.0004, 0.0008,
               0.00145, 0.0029, 0.0058, 0.0116, 0.0232,
               0.0464, 0.0696, 0.0928, 0.12];


/* A name long enough to be useful is too long to write across a chart, so it
   is cut to something that still reads as the same place. Word-wise first —
   "THE IRIDIUM FIELD" becomes "THE IRIDIUM…" rather than "THE IRIDIU…" —
   because a cut on a word boundary is a name and a cut mid-word is a typo. */
function shortName(name, max) {
  const n = String(name || "").trim();
  if (n.length <= max) return n;
  const cut = n.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[ ,.:;-]+$/, "") + "…";
}

function drawPins(st, mx, my, big) {
  const { ctx } = api;
  for (const q of (st.pins || [])) {
    const spec = pinSpec(q.kind);
    const colour = q.colour || spec.colour;
    const x = mx(q.x), y = my(q.y);
    const r = big ? 7 : 4;
    ctx.save();
    ctx.strokeStyle = colour;
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = big ? 2 : 1.4;
    // A dropped pin: a ring on a stem, so it reads as sitting on the map
    // rather than being a thing that is in the world.
    ctx.beginPath();
    ctx.arc(x, y - r * 1.6, r, 0, Math.PI * 2);
    ctx.moveTo(x, y - r * 0.6);
    ctx.lineTo(x, y + r * 1.2);
    ctx.stroke();
    ctx.restore();
    /* **Its own name, or nothing.** It used to draw the name of its *kind* —
       and the first kind in the list is called CASH, so every pin anybody ever
       dropped said CASH on the chart, including the ones they had carefully
       typed a name into. A kind is not a label: a pin you did not name is a
       mark, and a mark with a word under it that you did not choose is worse
       than a mark with no word under it. */
    if (big && q.name) {
      label(shortName(q.name, 14), x, y + r * 3.4, SIZE.cap, colour,
            "center", 0.9);
    }
  }
}

/* The key. Drawn from the same table the marks are, so it cannot drift from
   the map — a legend that disagrees with its chart is worse than none. Only
   the kinds you have actually found are listed: a key full of symbols you
   have never seen is a spoiler and a wall of text at the same time. */
function drawChartLegend(view, st) {
  const { ctx } = api;
  const kinds = [];
  for (const q of (st.known || [])) {
    if (CHART_MARKS[q.k] && !kinds.includes(q.k)) kinds.push(q.k);
  }
  if (!kinds.length) return;
  kinds.sort();

  const w = 148, rowH = 19, pad = 10;
  const h = kinds.length * rowH + pad * 2;
  /* Below the readout, which shares this corner and is painted after the
     legend — so the sector coordinate and the range home used to print
     straight across the legend's first two rows. */
  const x = view.x + view.w - w - 12, y = view.y + 62;

  ctx.save();
  ctx.fillStyle = "rgba(5,5,10,0.78)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = VIOLET_LOW;
  ctx.globalAlpha = 0.8;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();

  kinds.forEach((k, i) => {
    const spec = CHART_MARKS[k];
    const cy = y + pad + i * rowH + 7;
    ctx.save();
    ctx.strokeStyle = spec.colour;
    ctx.fillStyle = spec.colour;
    ctx.lineWidth = 1.4;
    markGlyph(ctx, k, x + pad + 7, cy, 5);
    ctx.restore();
    const n = (st.known || []).filter(q => q.k === k).length;
    label(spec.name, x + pad + 22, cy + 5, SIZE.cap, spec.colour, "left", 0.9);
    label(String(n), x + w - pad, cy + 5, SIZE.cap, spec.colour, "right", 0.55);
  });
}

HUD.chartOpened = function (st) {
  if (st && st.ship) { chart.x = st.ship.x; chart.y = st.ship.y; }
  chart.follow = true;
};

/* The chart had the same hole: arrows panned it and nothing else did, so on a
   phone the only way across a sector was the arrow keys it does not have. */
HUD.chartDragBy = function (dx, dy) {
  chart.x -= dx / chart.scale;
  chart.y -= dy / chart.scale;
  chart.follow = false;
};
// How many units the chart is showing across, for anything checking that the
// map can contain the sector it is a map of.
/* How wide the *map* is, in units. It used to answer for the whole screen,
   which the map is not: the rail takes a quarter of it. The rail's own
   readout is drawn from this, so it was claiming a third more sky than it
   was showing, and disagreeing with the scale bar underneath it. */
HUD.chartSpan = () => (chart.view ? chart.view.w : api.SCREEN_W) / chart.scale;

HUD.chartZoomBy = function (dir) { zoomChart(dir); };
/* By a factor, about a point on the screen: the wheel and a pinch. The
   buttons and keys step the ladder, which is right for a press; a wheel
   stepping the ladder once per event was not. A trackpad sends dozens of
   events in one flick, so one flick went from the widest view to the
   closest, and a sideways scroll (no vertical movement at all) counted as
   "in". Now it is as far as you turned it, and the point under the pointer
   stays under the pointer, which is what every other map does. */
HUD.chartZoomAt = function (factor, sx, sy) {
  if (!(factor > 0) || factor === 1) return;
  const old = chart.scale;
  const next = Math.max(ZOOMS[0], Math.min(ZOOMS[ZOOMS.length - 1], old * factor));
  if (next === old) return;
  const v = chart.view;
  if (v && sx != null && sy != null) {
    const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
    const wx = chart.x + (sx - cx) / old, wy = chart.y + (sy - cy) / old;
    chart.x = wx - (sx - cx) / next;
    chart.y = wy - (sy - cy) / next;
    if (Math.abs(sx - cx) > 4 || Math.abs(sy - cy) > 4) chart.follow = false;
  }
  chart.scale = next;
};
HUD.chartView = () => ({ x: Math.round(chart.x), y: Math.round(chart.y),
                         scale: chart.scale, follow: chart.follow,
                         steps: ZOOMS.length,
                         // The map's own rectangle, so a harness can ask
                         // where on the screen a piece of sky is drawn.
                         view: chart.view ? { ...chart.view } : null });
// Arming the pin tool, which the rail's button does by hand.
HUD.chartPinArm = on => { chart.pinning = !!on; if (chart.pinning) chart.jump = false; };
HUD.chartPinArmed = () => !!chart.pinning;

HUD.chartKey = function (code, st) {
  const step = 260 / chart.scale;
  if (code === "ArrowLeft")  { chart.x -= step; chart.follow = false; return true; }
  if (code === "ArrowRight") { chart.x += step; chart.follow = false; return true; }
  if (code === "ArrowUp")    { chart.y -= step; chart.follow = false; return true; }
  if (code === "ArrowDown")  { chart.y += step; chart.follow = false; return true; }
  if (code === "Equal" || code === "NumpadAdd")      { zoomChart(1); return true; }
  if (code === "Minus" || code === "NumpadSubtract") { zoomChart(-1); return true; }
  if (code === "KeyC") { HUD.chartOpened(st); return true; }
  if (code === "KeyP") {
    chart.pin = (chart.pin + 1) % PIN_KINDS.length;
    chart.jump = false;
    return true;
  }
  return false;
};

/* Nearest step rather than exact match. The chart's opening scale used to be
   a number that was not in this list at all, so the first press fell through
   to a hard-coded index and jumped somewhere unrelated to where you were. */
function zoomChart(dir) {
  let i = 0, best = Infinity;
  for (let k = 0; k < ZOOMS.length; k++) {
    const d = Math.abs(Math.log(ZOOMS[k] / chart.scale));
    if (d < best) { best = d; i = k; }
  }
  chart.scale = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i + dir))];
}

/* ── borders you have mapped ──────────────────────────────────────────────
   Territory and biomes, drawn only over the region cells in `terrain.mapped`
   — the cells you flew through, and the patches a scan charted. A cell is a
   jittered Voronoi cell on the region lattice, so its outline is worked out
   once by clipping a square against the bisectors of its neighbours, and each
   edge remembers which neighbour made it. That is what lets a border be
   drawn exactly where two *different* recorded cells meet and nowhere else.

   Territory is a faint wash in its holder's colour with a solid line at its
   edge. A biome border is a dashed line, lighter, over the top. Names sit on
   one cell of each patch once the chart is close enough to read them. */
const cellShapes = new Map();
let cellShapesSeed = null;
function cellShape(T, cx, cy) {
  const key = cx + "," + cy;
  let shape = cellShapes.get(key);
  if (shape) return shape;
  const s0 = T.site(cx, cy);
  const R = T.cell * 2;
  let pts = [[s0.x - R, s0.y - R], [s0.x + R, s0.y - R],
             [s0.x + R, s0.y + R], [s0.x - R, s0.y + R]];
  let labs = [null, null, null, null];
  for (let j = -2; j <= 2; j++) {
    for (let i = -2; i <= 2; i++) {
      if (!i && !j) continue;
      const n = T.site(cx + i, cy + j);
      const nx = n.x - s0.x, ny = n.y - s0.y;
      const mxw = (n.x + s0.x) / 2, myw = (n.y + s0.y) / 2;
      const inside = p => (p[0] - mxw) * nx + (p[1] - myw) * ny <= 0;
      const nk = (cx + i) + "," + (cy + j);
      const outP = [], outL = [];
      for (let k = 0; k < pts.length; k++) {
        const a = pts[k], b = pts[(k + 1) % pts.length];
        const ia = inside(a), ib = inside(b);
        const cut = () => {
          const da = (a[0] - mxw) * nx + (a[1] - myw) * ny;
          const db = (b[0] - mxw) * nx + (b[1] - myw) * ny;
          const t = da / (da - db);
          return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        };
        if (ia && ib) { outP.push(a); outL.push(labs[k]); }
        else if (ia && !ib) { outP.push(a); outL.push(labs[k]); outP.push(cut()); outL.push(nk); }
        else if (!ia && ib) { outP.push(cut()); outL.push(labs[k]); }
      }
      pts = outP; labs = outL;
    }
  }
  shape = { pts, labs, x: s0.x, y: s0.y };
  if (cellShapes.size > 12000) cellShapes.clear();
  cellShapes.set(key, shape);
  return shape;
}

function drawTerrain(st, view, mx, my) {
  const T = st.terrain;
  if (!T || !T.mapped || !T.mapped.size) return;
  const { ctx } = api;
  if (cellShapesSeed !== st.seed) { cellShapes.clear(); cellShapesSeed = st.seed; }
  const reach = T.cell * 1.5;
  const vis = (x, y) => mx(x + reach) >= view.x && mx(x - reach) <= view.x + view.w &&
                        my(y + reach) >= view.y && my(y - reach) <= view.y + view.h;
  const cellPx = T.cell * chart.scale;
  /* Biomes change from one cell to the next far more often than owners do,
     so their dashed edges only come in once a cell is big enough on screen
     to be a place rather than a speck — zoomed out, the map is territory. */
  const biomeAlpha = Math.max(0, Math.min(0.6, (cellPx - 28) / 60));
  const todo = [];
  for (const [key, rec] of T.mapped) {
    const comma = key.indexOf(",");
    const cx = +key.slice(0, comma), cy = +key.slice(comma + 1);
    const s0 = T.site(cx, cy);
    if (!vis(s0.x, s0.y)) continue;
    todo.push({ key, rec, cx, cy, shape: cellShape(T, cx, cy) });
  }
  const path = sh => {
    ctx.beginPath();
    sh.pts.forEach((p, i) => (i ? ctx.lineTo(mx(p[0]), my(p[1]))
                                : ctx.moveTo(mx(p[0]), my(p[1]))));
    ctx.closePath();
  };

  ctx.save();
  /* The wash, one fill per flag rather than one per cell. Filled cell by
     cell, every shared edge was painted twice and the seam between two cells
     of the *same* space showed as a line: a power's territory read as a
     honeycomb of little countries. Ric: two of the same touching "shouldnt
     have borders with each other". One path, one fill, no seams.

     The Void is a darkening rather than a colour: it is an absence. */
  const byFlag = new Map();
  for (const c of todo) {
    if (!T.holder(c.rec.o)) continue;
    const list = byFlag.get(c.rec.o) || [];
    list.push(c);
    byFlag.set(c.rec.o, list);
  }
  for (const [flag, cells] of byFlag) {
    const h = T.holder(flag);
    ctx.beginPath();
    for (const c of cells) {
      c.shape.pts.forEach((p, i) => (i ? ctx.lineTo(mx(p[0]), my(p[1]))
                                       : ctx.moveTo(mx(p[0]), my(p[1]))));
      ctx.closePath();
    }
    ctx.globalAlpha = flag === "void" ? 0.45 : h.power ? 0.13 : 0.08;
    ctx.fillStyle = flag === "void" ? "#000000" : h.colour;
    ctx.fill();
  }
  // Edges. Each shared edge is drawn once, from the lower key.
  for (const c of todo) {
    const h = T.holder(c.rec.o);
    const b = T.biome(c.rec.r);
    const pts = c.shape.pts;
    for (let k = 0; k < pts.length; k++) {
      const nk = c.shape.labs[k];
      if (!nk) continue;
      const other = T.mapped.get(nk);
      if (!other || nk < c.key) continue;
      const a = pts[k], e = pts[(k + 1) % pts.length];
      if (other.o !== c.rec.o && h) {
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 2;
        ctx.strokeStyle = h.power ? h.colour : (T.holder(other.o) || h).colour;
        ctx.beginPath(); ctx.moveTo(mx(a[0]), my(a[1])); ctx.lineTo(mx(e[0]), my(e[1]));
        ctx.stroke();
      }
      /* A cell charted only for its flag has no biome to draw an edge of.

         And the edge is a line rather than a dash. Ric: "the dotted lines
         are weird" — a dashed hairline in a biome's own dim colour, drawn
         along a lattice of jittered cells, read as scratches on the glass
         rather than as the edge of anywhere. Thin, solid and a little
         brighter is a border; the flag's line is twice the weight, so which
         is which is still obvious. */
      if (other.r && c.rec.r && other.r !== c.rec.r && b && biomeAlpha > 0) {
        ctx.setLineDash([]);
        ctx.globalAlpha = Math.min(0.75, biomeAlpha + 0.15);
        ctx.lineWidth = 1;
        ctx.strokeStyle = b.colour;
        ctx.beginPath(); ctx.moveTo(mx(a[0]), my(a[1])); ctx.lineTo(mx(e[0]), my(e[1]));
        ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]);
  ctx.restore();

  /* Names, once per patch, on the cell nearest the patch's middle. Patches
     are the mapped cells joined to a neighbour with the same answer, worked
     out again only when the record changes. Territory is named as soon as a
     patch is a few cells big on screen; a biome only once you are close. */
  /* And a name only where there is room for it. Nothing checked, so zoomed
     out the names of every small patch landed on top of each other: at one
     step a single frame wrote THE MURK four times and three other names three
     times each, most of them over something else. Biggest patch first, and
     a name that would touch one already written is left off until you zoom
     in far enough to separate them. */
  const groups = patchesOf(T, st.seed);
  const taken = [];
  const fits = (text, x, y) => {
    const w = String(text).length * SIZE.cap * 0.72 + 10, h = SIZE.cap + 6;
    const box = { x0: x - w / 2, x1: x + w / 2, y0: y - h, y1: y + 4 };
    for (const b of taken) {
      if (box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0) return false;
    }
    taken.push(box);
    return true;
  };
  /* Where to write a patch's name. Its middle, if that is on the screen —
     and if it is not, the nearest of its cells that is, because the whole
     point of the name is to say what you are looking at. Zoomed in, every
     patch's middle is off the screen, so the map showed lines with nothing
     to say which side of them was what. */
  /* Where a patch's name goes: on one of *its own* cells, the one sitting
     furthest inside the frame. Nothing is nudged to fit.

     The first version of this clamped the name into the frame when its cell
     sat near the edge, which moved it off its own ground: Ric saw a faction
     named over sky that was not theirs. A name on a map is a claim about
     the place under it, so it is only ever written where the place is. */
  const room = (sx, sy) => Math.min(sx - view.x, view.x + view.w - sx,
                                    sy - view.y, view.y + view.h - sy);
  /* Only over ground you have been through. Ric: "they shoouldnt show a
     faction name in extra biomes" — flying charts the flags of the cells
     beside the lane, and those are somewhere you know the colours of, not
     somewhere you have been. A patch made only of those is drawn, because
     its border is the thing worth knowing, and it is not named. */
  const spot = g => {
    let best = null, bs = 40;             // a name needs this much air
    for (const p of (g.solid || [])) {
      const sx = mx(p.x), sy = my(p.y);
      const r = room(sx, sy);
      if (r > bs) { bs = r; best = { x: sx, y: sy }; }
    }
    return best;
  };
  ctx.save();
  for (const g of groups.o.slice().sort((a, b) => b.n - a.n)) {
    if (cellPx * Math.sqrt(g.n) < 90) continue;
    const h = T.holder(g.v);
    if (!h) continue;
    const at = spot(g);
    if (!at || !fits(h.name, at.x, at.y)) continue;
    label(h.name, at.x, at.y, SIZE.cap, h.colour, "center",
          g.v === "void" ? 0.55 : 0.85, "0.14em");
  }
  if (cellPx >= 60) {
    for (const g of groups.r.slice().sort((a, b) => b.n - a.n)) {
      if (!g.v) continue;                 // flag-only cells name no biome
      const b = T.biome(g.v);
      if (!b) continue;
      const at = spot(g);
      if (!at || !fits(b.name, at.x, at.y + 18)) continue;
      label(b.name, at.x, at.y + 18, SIZE.cap, b.colour, "center", 0.6,
            "0.08em");
    }
  }
  ctx.restore();
}

let patchCache = null;
function patchesOf(T, seed) {
  const stamp = seed + ":" + T.mapped.size + ":" + T.mappedStamp;
  if (patchCache && patchCache.stamp === stamp) return patchCache;
  const cells = [];
  for (const [key, rec] of T.mapped) {
    const comma = key.indexOf(",");
    cells.push({ key, rec, cx: +key.slice(0, comma), cy: +key.slice(comma + 1) });
  }
  const group = field => {
    const done = new Set(), out = [];
    for (const c of cells) {
      if (done.has(c.key)) continue;
      const v = c.rec[field], members = [];
      const queue = [c];
      done.add(c.key);
      while (queue.length) {
        const q = queue.pop();
        members.push(q);
        for (let j = -1; j <= 1; j++) {
          for (let i = -1; i <= 1; i++) {
            const k = (q.cx + i) + "," + (q.cy + j);
            if (done.has(k)) continue;
            const r = T.mapped.get(k);
            if (!r || r[field] !== v) continue;
            done.add(k);
            queue.push({ key: k, rec: r, cx: q.cx + i, cy: q.cy + j });
          }
        }
      }
      // The member whose site is closest to the patch's own middle.
      let sx = 0, sy = 0;
      const sites = members.map(m => T.site(m.cx, m.cy));
      for (const p of sites) { sx += p.x; sy += p.y; }
      sx /= sites.length; sy /= sites.length;
      let best = sites[0], bd = Infinity;
      for (const p of sites) {
        const d = (p.x - sx) ** 2 + (p.y - sy) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      /* And which of them you have actually been through. A cell charted
         only for its flag, from the lane beside it, is somewhere you have
         seen the colours of and nothing else — see `markFlag`. */
      const solid = members.filter(m => m.rec.r).map(m => T.site(m.cx, m.cy));
      out.push({ v, n: members.length, x: best.x, y: best.y, sites, solid });
    }
    return out;
  };
  patchCache = { stamp, o: group("o"), r: group("r") };
  return patchCache;
}

HUD.drawChart = function (st, dt) {
  const { ctx, SCREEN_W, SCREEN_H } = api;
  st = st || {};
  if (chart.follow && st.ship) { chart.x = st.ship.x; chart.y = st.ship.y; }

  const span = SCREEN_W / chart.scale;
  pageFrame("SECTOR MAP",
            "SEED " + (st.seed || 0) +
            (st.world ? "  ·  " + st.world.name : "") +
            "  ·  " + fmtCells(HUD.charted()) + " CELLS CHARTED",
            undefined, SHIP_TONE,
            /* No footer any more: that line belongs to the navigation strip
               now, the same as on every other page. The keys it used to name
               are on the title line instead, where nothing else is. */
            "");


  /* The band under the map used to be 56px holding five things — a hint, a
     zoom readout, six palette buttons, the footer and CLOSE — all inside
     each other. The map gives up a row so each of them gets its own.

     It gives up a second one now, because the chart was the only page in the
     mode without the navigation strip: opening the map and wanting your
     storage meant closing the map, flying, and pressing another key. Its own
     three buttons moved up a row and the strip took the bottom, so the map is
     a page you can leave the way you leave every other one. */
  /* The map gives up a column on the right rather than a band at the bottom.
     Everything that decides *what the map does* lives in it — the filters, the
     two things you can place, the zoom — which is the difference between a map
     with controls and a map with a control panel underneath it that you have to
     look away from the map to read.

     It also means the map is as tall as the page, which on a phone held
     sideways is the whole of the screen. */
  const railW = Math.min(230, Math.max(170, SCREEN_W * 0.17));
  const view = { x: PAGE.EDGE, y: PAGE.TOP,
                 w: SCREEN_W - PAGE.EDGE * 2 - railW - PAGE.GUTTER,
                 h: SCREEN_H - PAGE.TOP - 26 };
  const rail = { x: view.x + view.w + PAGE.GUTTER, w: railW };
  // Kept, so a wheel or a pinch can zoom about the point under it.
  chart.view = view;
  const mx = wx => view.x + view.w / 2 + (wx - chart.x) * chart.scale;
  const my = wy => view.y + view.h / 2 + (wy - chart.y) * chart.scale;

  ctx.save();
  ctx.beginPath();
  ctx.rect(view.x, view.y, view.w, view.h);
  ctx.clip();

  ctx.fillStyle = "#07070e";
  /* Not quite opaque, so the sector shows through the map the way it shows
     through every other page. A chart you cannot see past is still a screen you
     can drift into a star behind. */
  ctx.globalAlpha = HUD.pageGhost ? 0.86 : 1;
  ctx.fillRect(view.x, view.y, view.w, view.h);
  ctx.globalAlpha = 1;

  /* The chart used to draw no regions at all — BIOMES.md kept biomes off it.
     Ric reversed that: it draws the territory and biome borders you have
     mapped, and only those. See `drawTerrain`. Pins are still how you name a
     place yourself. */
  drawChartGrid(view, mx, my);
  paintFog(mx, my, chart.x, chart.y, span, chart.scale, chart.scale, 0.26);
  drawTerrain(st, view, mx, my);
  paintMarks(st, mx, my, true, chart.scale);
  paintEchoes(st, mx, my, true);
  drawPins(st, mx, my, true);
  /* What you are watching, and a flash when you pick it. A tap that changes
     something off in the corner of a map is a tap you are not sure landed; a
     ring that blooms where your finger went is the map saying yes. */
  if (st.selected) {
    const sx2 = mx(st.selected.x), sy2 = my(st.selected.y);
    const f = st.selectFlash || 0;
    ctx.save();
    ctx.strokeStyle = OBJECTIVE;
    ctx.globalAlpha = 0.55 + 0.35 * Math.abs(Math.sin(clockish() * 3));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx2, sy2, 13, 0, Math.PI * 2);
    ctx.stroke();
    if (f > 0) {
      ctx.globalAlpha = f * 0.8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx2, sy2, 13 + (1 - f) * 46, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    label(shortName(st.selected.name || "", 16), sx2, sy2 - 22, SIZE.cap,
          OBJECTIVE, "center", 0.9);
  }

  ctx.restore();

  ctx.save();
  ctx.strokeStyle = VIOLET_LOW;
  ctx.lineWidth = 1;
  ctx.strokeRect(view.x, view.y, view.w, view.h);
  ctx.restore();

  drawScaleBar(view);
  drawChartLegend(view, st);
  drawChartReadout(view, st);

  // Off-view: where you are, if you have panned away from yourself.
  if (st.ship) {
    const px = mx(st.ship.x), py = my(st.ship.y);
    if (px < view.x || px > view.x + view.w || py < view.y || py > view.y + view.h) {
      const ang = Math.atan2(st.ship.y - chart.y, st.ship.x - chart.x);
      const ex = view.x + view.w / 2 + Math.cos(ang) * (view.w / 2 - 26);
      const ey = view.y + view.h / 2 + Math.sin(ang) * (view.h / 2 - 26);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      api.glow(AMBER, 2, 0.9, () => {
        ctx.beginPath();
        ctx.moveTo(-8, -9); ctx.lineTo(8, 0); ctx.lineTo(-8, 9);
        ctx.stroke();
      });
      ctx.restore();
      label("YOU", ex, ey + 26, SIZE.cap, AMBER, "center", 0.8);
    }
  }

  /* Dropping a pin. The whole map is one tap target, registered *before* the
     palette and the buttons so anything drawn after it wins — the tap list is
     last-drawn-first-served, and a palette button sitting inside the map area
     would otherwise be unreachable.

     A tap here is a tap and not a drag: the page holds a press until release
     and only calls this if the pointer barely moved, so panning the chart
     never leaves a trail of pins behind it. */
  const canJump = !!st.wormhole && typeof st.onJump === "function";
  if (!canJump) chart.jump = false;

  tap({
    x: view.x, y: view.y, w: view.w, h: view.h,
    act: (sx, sy) => {
      if (sx == null) return;
      const wx = chart.x + (sx - (view.x + view.w / 2)) / chart.scale;
      const wy = chart.y + (sy - (view.y + view.h / 2)) / chart.scale;
      // Fourteen screen pixels' worth of world, so lifting a pin is as easy
      // zoomed out as zoomed in.
      HUD.chartTapAt(st, wx, wy, 14 / chart.scale);
    }
  });

  /* ── the rail ──────────────────────────────────────────────────────────
     What the map does, beside the map. */
  let ry = view.y;

  // What the next tap will leave, said once and in the colour of the thing.
  const verb = api.touchOnly ? "TAP" : "CLICK";
  const armed = chart.jump ? "jump" : chart.pinning ? "pin" : "";
  /* Wrapped to the rail rather than written across the map. These lines got
     longer when the pin gained a second meaning, and a `label` does not know
     how wide its column is — on a phone they ran clean off the right-hand edge
     of the screen. */
  const says = armed === "jump" ? verb + " A STATION"
             : armed === "pin"  ? verb + " ANYWHERE, OR A PIN TO REMOVE IT"
             : verb + " SOMETHING TO WATCH";
  const saysCol = armed === "jump" ? HUD_CASH
                : armed === "pin" ? VIOLET : VIOLET_LOW;
  const saysLines = wrapLines(says, SIZE.cap, rail.w, "0.06em");
  saysLines.slice(0, 2).forEach((line, i) => {
    label(line, rail.x, ry + 6 + i * 18, SIZE.cap, saysCol, "left", 0.85,
          "0.06em");
  });
  ry += 20 + (saysLines.length > 1 ? 18 : 0);

  /* ── the one thing you place ─────────────────────────────────────────────
     There were two. The waypoint is gone, and it went because the thing that
     replaced it is strictly better at the same job: **tap anything on the chart
     and the ship points at it.** A waypoint was a coordinate you had to place
     by hand at a spot you were trying to hit by eye — you could not put one
     *on* a station, or a well, or a memorial, because the gesture had no idea
     what was under your finger. Selecting does, so the arrow on the flight
     screen is aimed at the thing rather than at somewhere near it, and it can
     carry the thing's name.

     A pin is the other half and does the other job: the waypoint could not be
     named, kept, coloured, or have a second one. */
  button(chart.pinning ? "CANCEL" : "PIN  ▸",
         rail.x + rail.w / 2, ry + 19, rail.w, 38,
         chart.pinning ? WARN : VIOLET,
         () => { chart.pinning = !chart.pinning; chart.jump = false; },
         chart.pinning);
  ry += 46;

  /* The colour used to be six swatches here, chosen *before* you placed
     anything — which is deciding what a mark will mean before you have seen
     where it is going, and on a phone it mostly meant every pin came out the
     first colour in the list. The prompt that opens when you place one asks
     for the colour and the name together, at the moment you know both. */
  if (canJump) {
    button(chart.jump ? "CANCEL" : "WORMHOLE  \u25b8",
           rail.x + rail.w / 2, ry + 19, rail.w, 38,
           chart.jump ? WARN : HUD_CASH,
           () => { chart.jump = !chart.jump; chart.pinning = false; },
           chart.jump);
    ry += 46;
  }

  /* ── the filters ───────────────────────────────────────────────────────
     An hour into a sector the chart has several hundred things on it and most
     of them are not what you are looking for. Turning a kind off is the
     difference between a map and a record of everything that has ever happened.

     One row per kind, in the kind's own colour and with its own glyph, so the
     list and the map say the same thing. */
  ry += 6;
  const kinds = Object.keys(CHART_MARKS);
  const filtH = PAGE.HEAD + kinds.length * 22 + 14;
  panel(rail.x, ry, rail.w, filtH, VIOLET, "SHOW", "");
  kinds.forEach((k, i) => {
    const spec = CHART_MARKS[k];
    const on = !chart.hide[k];
    const fy = ry + PAGE.HEAD + 6 + i * 22;
    ctx.save();
    ctx.globalAlpha = on ? 1 : 0.3;
    ctx.strokeStyle = spec.colour;
    ctx.fillStyle = spec.colour;
    ctx.lineWidth = 1.2;
    markGlyph(ctx, k, rail.x + PAGE.PAD + 5, fy - 4, 5);
    ctx.restore();
    fitText(spec.name, rail.x + PAGE.PAD + 20, fy, SIZE.cap, spec.colour,
            "left", on ? 0.95 : 0.35, rail.w - 80, "0.04em");
    label(on ? "ON" : "OFF", rail.x + rail.w - PAGE.PAD, fy, SIZE.cap,
          on ? CASH_DIM : VIOLET_LOW, "right", on ? 0.85 : 0.5);
    tap({ x: rail.x, y: fy - 16, w: rail.w, h: 22,
          act: () => { chart.hide[k] = !chart.hide[k]; } });
  });
  ry += filtH + 8;

  /* Zoom, and how wide the view is, under the filters.

     The three of them used to be laid out against fixed offsets — the two
     zooms from the left, RECENTRE from the right — on the assumption that the
     rail was always wide enough to keep them apart. On a thousand-wide screen,
     which is most of them, the rail is 170 and it is not: RECENTRE's 112
     started at 848 and the `+` sat at 850, wholly underneath it. Tap targets
     are checked back to front, so the later rectangle won every press — you
     could not zoom the chart in at all, and nothing about the picture looked
     wrong, because both buttons drew perfectly.

     So it is measured. Three across while three fit, and RECENTRE drops to its
     own row when they do not. */
  const zoomW = 44, zoomGap = 6, recW = 112;
  const oneRow = rail.w >= 26 - zoomW / 2 + zoomW * 2 + zoomGap + recW + 12;
  button("\u2212", rail.x + 26, ry + 17, zoomW, 34, VIOLET, () => zoomChart(-1));
  button("+", rail.x + 26 + zoomW + zoomGap, ry + 17, zoomW, 34, VIOLET,
         () => zoomChart(1));
  if (oneRow) {
    button("RECENTRE", rail.x + rail.w - 62, ry + 17, recW, 34, VIOLET,
           () => HUD.chartOpened(st));
    ry += 42;
  } else {
    button("RECENTRE", rail.x + rail.w / 2, ry + 17 + 40, rail.w - 12, 34,
           VIOLET, () => HUD.chartOpened(st));
    ry += 82;
  }
  const step = ZOOMS.reduce((a, z, k) =>
    Math.abs(Math.log(z / chart.scale)) < Math.abs(Math.log(ZOOMS[a] / chart.scale))
      ? k : a, 0);
  /* Two facts, so two labels — one from each end of the rail. As one string
     fitted to 170 pixels it came out as "21.6K ACROSS · …", which drops the
     half a reader actually wants: which of the five steps they are on. */
  fitText(fmtCells(Math.round(view.w / chart.scale)) + " ACROSS",
          rail.x, ry + 20, SIZE.cap, VIOLET_DIM, "left", 0.7, rail.w - 46);
  label((step + 1) + "/" + ZOOMS.length, rail.x + rail.w - PAGE.PAD, ry + 20,
        SIZE.cap, VIOLET_DIM, "right", 0.7);
  ry += 30;

  /* What the two kinds of line on the map are. Without this the map draws
     borders in two weights and two colours and never says which is which:
     one is who holds the sky and the other is what the sky is made of. */
  {
    // In the colours of the sky you are actually in, so the key is an
    // example rather than a diagram.
    const flagCol = (st.place && st.place.space && st.place.space.colour) || VIOLET;
    const bioCol = (st.place && st.place.biome && st.place.biome.colour) || VIOLET_DIM;
    const key = (y, colour, wide, name) => {
      ctx.save();
      ctx.strokeStyle = colour;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = wide ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(rail.x, y); ctx.lineTo(rail.x + 26, y);
      ctx.stroke();
      ctx.restore();
      label(name, rail.x + 34, y + 4, SIZE.cap, VIOLET_DIM, "left", 0.7);
    };
    key(ry + 8, flagCol, true, "WHO HOLDS IT");
    key(ry + 26, bioCol, false, "WHAT IT IS");
    ry += 40;
  }

  pageNav(st, "chart", SHIP_TABS, SHIP_TONE);
  closeButton(st.onClose || (() => {}));
};

/* What a press on the map means, in world coordinates. A function rather
   than a closure inside the tap so the harness can drive the same body the
   pointer does — the jump was unreachable for a release precisely because
   nothing but a pointer could ever have reached it. */
HUD.chartTapAt = function (st, wx, wy, snap) {
  if (chart.jump) { jumpNear(st, wx, wy, snap); return; }

  /* ── the whole of pinning, in one order ──────────────────────────────────
     Arm with PIN. The next tap on the map either lands on a pin you already
     have — in which case it asks whether to remove it, and takes a check mark
     for an answer — or it is somewhere new, and the prompt that opens asks for
     a name and a colour before anything is placed.

     Removal used to happen on *any* tap that landed near a pin, armed or not,
     which is an eraser you cannot switch off: panning a crowded map with a
     finger deleted your own marks, silently, with nothing to undo it. Now it
     takes arming the tool and then confirming, which is two deliberate acts for
     the one operation in the mode that destroys something you made. */
  if (chart.pinning) {
    chart.pinning = false;
    if (st && st.onPinNear && st.onPinNear(wx, wy, snap)) return;
    if (st && st.onPin) st.onPin(wx, wy, PIN_KINDS[chart.pin].key, snap);
    return;
  }
  if (!chart.pinning) {
    /* Nothing armed and no pin under the finger: you are pointing at something
       charted. Keeping an eye on it is the other thing that earns a permanent
       arrow, and it is the natural meaning of tapping a mark on a map. */
    if (st && st.onSelect) st.onSelect(wx, wy, snap);
    return;
  }
};
// The palette, so the engine can stamp a pin with its colour when it is made.
HUD.pinKinds = () => PIN_KINDS.map(k => ({ ...k }));
HUD.chartPinKind = i => { if (i >= 0 && i < PIN_KINDS.length) chart.pin = i; };
HUD.chartJumpArm = function (on) { chart.jump = !!on; };
HUD.chartJumpArmed = () => !!chart.jump;

/* Jumping to a place already written down. Stations only — this is fast
   travel across ground you have covered, never a way to skip covering it —
   and the nearest one inside the same finger-width the pins use, so the
   gesture is the one the page has already taught. */
function jumpNear(st, wx, wy, snap) {
  let best = null, bestD = snap * snap;
  for (const q of (st.known || [])) {
    if (q.k !== "station") continue;
    const d = (q.x - wx) * (q.x - wx) + (q.y - wy) * (q.y - wy);
    if (d > bestD) continue;
    bestD = d; best = q;
  }
  // A miss leaves the arm on. Cancelling because a finger landed two pixels
  // wide of a station would be the page punishing you for its own tolerance.
  if (!best) return;
  chart.jump = false;
  if (st.onJump(best.x, best.y) !== false) {
    chart.x = best.x; chart.y = best.y; chart.follow = true;
    if (st.onClose) st.onClose();
  }
}

/* A grid you can navigate by. Lines every chunk, and the coordinate is the
   chunk index rather than raw units — a number small enough to say out loud
   is a number you can use to tell somebody where you found something. */
function drawChartGrid(view, mx, my) {
  const { ctx } = api;
  const CHUNK = 2600;
  const step = chart.scale < 0.01 ? CHUNK * 4 : CHUNK;
  const x0 = Math.floor((chart.x - view.w / 2 / chart.scale) / step) * step;
  const x1 = chart.x + view.w / 2 / chart.scale;
  const y0 = Math.floor((chart.y - view.h / 2 / chart.scale) / step) * step;
  const y1 = chart.y + view.h / 2 / chart.scale;

  ctx.save();
  ctx.strokeStyle = VIOLET_LOW;
  ctx.globalAlpha = 0.34;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x0; x <= x1; x += step) {
    ctx.moveTo(mx(x), view.y); ctx.lineTo(mx(x), view.y + view.h);
  }
  for (let y = y0; y <= y1; y += step) {
    ctx.moveTo(view.x, my(y)); ctx.lineTo(view.x + view.w, my(y));
  }
  ctx.stroke();

  // The origin is the one fixed point in an infinite plane; say so.
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = VIOLET_DIM;
  ctx.beginPath();
  ctx.moveTo(mx(0), view.y); ctx.lineTo(mx(0), view.y + view.h);
  ctx.moveTo(view.x, my(0)); ctx.lineTo(view.x + view.w, my(0));
  ctx.stroke();
  ctx.restore();

  if (chart.scale >= 0.008) {
    for (let x = x0; x <= x1; x += step) {
      label(String(Math.round(x / CHUNK)), mx(x) + 4, view.y + 16,
            SIZE.cap, VIOLET_DIM, "left", 0.5);
    }
    for (let y = y0; y <= y1; y += step) {
      label(String(Math.round(y / CHUNK)), view.x + 5, my(y) - 5,
            SIZE.cap, VIOLET_DIM, "left", 0.5);
    }
  }
}

function drawScaleBar(view) {
  const { ctx } = api;
  // A round number of units that lands near 120px at the current zoom.
  const want = 120 / chart.scale;
  const pow = Math.pow(10, Math.floor(Math.log10(want)));
  const units = [1, 2, 5, 10].map(m => m * pow).find(v => v >= want * 0.6) || pow;
  const px = units * chart.scale;
  const x = view.x + 16, y = view.y + view.h - 22;
  ctx.save();
  ctx.strokeStyle = VIOLET_DIM;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 5); ctx.lineTo(x, y); ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 5);
  ctx.stroke();
  ctx.restore();
  label(units >= 1000 ? (units / 1000) + "K UNITS" : units + " UNITS",
        x + px + 10, y, SIZE.cap, VIOLET_DIM, "left", 0.7);
}

function drawChartReadout(view, st) {
  if (!st.ship) return;
  const CHUNK = 2600;
  const cx = Math.round(st.ship.x / CHUNK), cy = Math.round(st.ship.y / CHUNK);
  const home = Math.round(Math.hypot(st.ship.x, st.ship.y));
  label("SECTOR " + cx + ", " + cy, view.x + view.w - 16, view.y + 24,
        SIZE.cap, AMBER, "right", 0.9);
  label(fmtCells(home) + " UNITS FROM ORIGIN", view.x + view.w - 16, view.y + 46,
        SIZE.cap, AMBER_DIM, "right", 0.6);
}
