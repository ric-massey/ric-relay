"use strict";

/* KONDRITE — SURVEY — THE WARRENS, AND THE ORDER IT IS DRAWN IN
   ─────────────────────────────────────────────────────────────────────────────
   The Warrens' rock, traced rather than stamped; the Vault; and
   drawSurveyWorld, which draws everything in survey-draw.js and here in the
   order it stacks.

   One chapter of the game. The chapters share the page's global scope and run
   in the order index.html lists them — see README.md, "Where it lives". */

/* ── the rock of the Warrens ───────────────────────────────────────────────
   **Traced, not stamped.** Every earlier version of this drew circles — the
   rock as a union of discs, the passage as a stroked line with round caps —
   and circles are what it looked like, because that is what it was. A union of
   discs has a scalloped boundary and a stroked polyline is a pipe.

   So the wall is found rather than drawn: `caveEdge` is negative inside a
   passage and positive in rock, and this walks a grid over the visible sky
   and follows the line where it crosses zero. That line is a contour of a
   noise-warped field, which means it is irregular everywhere, asymmetric
   across a passage, and has no repeated shape anywhere in it — an alcove on
   one wall with nothing opposite it, which is what the inside of a cave
   actually looks like.

   Marching squares, sixteen cases, of which the four that matter here are the
   corners and the two straights. Interpolated along each edge rather than cut
   at the midpoint, so the contour is smooth rather than stepped at the grid.

   Recomputed per frame over the screen only — about two thousand cells, each a
   field lookup — rather than cached per chunk, because the zoom changes what
   is on screen and a contour cached at one scale is the wrong resolution at
   another. */
const CAVE_GRID = 34;      // how finely the wall is traced, in world units

function drawCave() {
  if (!surv.cave || !surv.cave.length) return;
  const halfW = (SCREEN_W / 2) / cam.scale + 90;
  const halfH = (SCREEN_H / 2) / cam.scale + 90;
  const x0 = Math.floor((cam.x - halfW) / CAVE_GRID) * CAVE_GRID;
  const y0 = Math.floor((cam.y - halfH) / CAVE_GRID) * CAVE_GRID;
  const cols = Math.ceil((halfW * 2) / CAVE_GRID) + 2;
  const rows = Math.ceil((halfH * 2) / CAVE_GRID) + 2;
  if (cols * rows > 12000) return;                // absurd zoom; skip it

  /* One row of field values at a time, kept with the row above it, so the
     whole grid is never held and every point is evaluated exactly once. */
  const field = new Float32Array((cols + 1) * (rows + 1));
  let anyRock = false, anyAir = false;
  for (let j = 0; j <= rows; j++) {
    const wy = y0 + j * CAVE_GRID;
    for (let i = 0; i <= cols; i++) {
      const wx = x0 + i * CAVE_GRID;
      // Outside the region there is no rock at all, however the passages run.
      const v = caveFillAt(wx, wy) <= 0.35 ? -1e5 : caveEdge(wx, wy);
      field[j * (cols + 1) + i] = v;
      if (v > 0) anyRock = true; else anyAir = true;
    }
  }
  if (!anyRock) return;

  const tint = caveTint(cam.x, cam.y);

  /* The mass. Cell by cell: a cell with all four corners in rock is filled
     whole, and a cell the wall crosses is filled up to the wall. Squares and
     triangles — no arcs anywhere. */
  ctx.save();
  ctx.fillStyle = mixHex("#07090c", tint, 0.17);
  ctx.beginPath();
  const lerp = (ax, ay, av, bx, by, bv) => {
    const t = av / (av - bv);
    return [ax + (bx - ax) * t, ay + (by - ay) * t];
  };
  const walls = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * (cols + 1) + i;
      const a = field[k], b = field[k + 1];
      const c = field[k + cols + 2], d = field[k + cols + 1];
      const ax = x0 + i * CAVE_GRID, ay = y0 + j * CAVE_GRID;
      const bx = ax + CAVE_GRID, by = ay;
      const cx = bx, cy = ay + CAVE_GRID;
      const dx = ax, dy = cy;
      const code = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
      if (code === 0) continue;
      if (code === 15) {
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
        ctx.lineTo(cx, cy); ctx.lineTo(dx, dy);
        ctx.closePath();
        continue;
      }
      // The four edge crossings, where they exist.
      const eAB = (a > 0) !== (b > 0) ? lerp(ax, ay, a, bx, by, b) : null;
      const eBC = (b > 0) !== (c > 0) ? lerp(bx, by, b, cx, cy, c) : null;
      const eCD = (c > 0) !== (d > 0) ? lerp(cx, cy, c, dx, dy, d) : null;
      const eDA = (d > 0) !== (a > 0) ? lerp(dx, dy, d, ax, ay, a) : null;
      // The rock side of the cell, as a polygon walked corner by corner.
      const poly = [];
      const corner = (v, px, py) => { if (v > 0) poly.push([px, py]); };
      corner(a, ax, ay); if (eAB) poly.push(eAB);
      corner(b, bx, by); if (eBC) poly.push(eBC);
      corner(c, cx, cy); if (eCD) poly.push(eCD);
      corner(d, dx, dy); if (eDA) poly.push(eDA);
      if (poly.length > 2) {
        ctx.moveTo(poly[0][0], poly[0][1]);
        for (let q = 1; q < poly.length; q++) ctx.lineTo(poly[q][0], poly[q][1]);
        ctx.closePath();
      }
      // And the wall itself: the segment between the two crossings.
      const cross = [eAB, eBC, eCD, eDA].filter(Boolean);
      if (cross.length === 2) walls.push(cross);
      else if (cross.length === 4) { walls.push([eAB, eBC]); walls.push([eCD, eDA]); }
    }
  }
  ctx.fill();
  ctx.restore();

  // The lit wall. One path of straight segments — there is not an arc in it.
  if (walls.length) {
    ctx.save();
    ctx.strokeStyle = tint;
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 2;
    ctx.lineCap = "butt";
    ctx.beginPath();
    for (const [p, q] of walls) {
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawVault(v) {
  if (!onScreen(v.x, v.y, v.r * 1.6)) return;
  const wx = (u, vv) => v.x + u * v.ca - vv * v.sa;
  const wy = (u, vv) => v.y + u * v.sa + vv * v.ca;

  ctx.save();
  ctx.fillStyle = "#06080e";
  ctx.beginPath();
  const c = [[-v.r, -v.r], [v.r, -v.r], [v.r, v.r], [-v.r, v.r]];
  c.forEach((pt, i) => (i ? ctx.lineTo(wx(pt[0], pt[1]), wy(pt[0], pt[1]))
                          : ctx.moveTo(wx(pt[0], pt[1]), wy(pt[0], pt[1]))));
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Plates, as wide as the discs underneath them — see `strokePlates`.
  strokePlates(v.walls, wx, wy, VAULT_SEG);

  /* A flag on the shell, because somebody built this and the sector should be
     able to say so without a word. It is the only thing out here wearing a
     marking that big. */
  const beat = 0.35 + 0.65 * Math.abs(Math.sin(clock * 0.5 + v.phase));
  glow(NEBULA, 1.8, 0.2 + beat * 0.3, () => {
    ctx.beginPath();
    ctx.arc(v.x, v.y, v.core * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const a2 = (k / 4) * Math.PI * 2 + Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(wx(Math.cos(a2) * v.core * 0.7, Math.sin(a2) * v.core * 0.7),
                 wy(Math.cos(a2) * v.core * 0.7, Math.sin(a2) * v.core * 0.7));
      ctx.lineTo(wx(Math.cos(a2) * v.ring * 0.92, Math.sin(a2) * v.ring * 0.92),
                 wy(Math.cos(a2) * v.ring * 0.92, Math.sin(a2) * v.ring * 0.92));
      ctx.stroke();
    }
  });
}

function drawSurveyWorld() {
  if (!surv) return;
  drawSky();
  for (const n of surv.nebulae) drawNebula(n);
  for (const g of surv.gates) drawGate(g);
  for (const p of surv.planets) drawPlanet(p);
  drawWellNames();
  /* The two built things go down before anything that can be inside them.
     Each fills its footprint dark, and drawn after the traffic that fill
     painted over every ship inside the box — a raider chasing you into the
     Vault vanished at the door and shot at you from under the deck (A3,
     "bots flying behind the walls"). The plates are drawn over a ship that
     overlaps one, which is the right way round: a hull is behind a wall,
     not in front of it. */
  if (surv.leviathan) drawLeviathan(surv.leviathan);
  if (surv.vault) drawVault(surv.vault);
  for (const t of surv.traffic) drawTraffic(t);
  drawCave();
  for (const h of surv.hulks) drawHulk(h);
  for (const b of surv.battles) drawBattle(b);
  for (const w of surv.wrecks) drawWreck(w);
  for (const st of surv.stations) drawStation(st);
  for (const c of surv.caches) drawCache(c);
  for (const d of surv.drones) drawDrone(d);
  for (const m of surv.marks) drawMark(m);
  for (const pt of surv.parts) drawPart(pt);
  for (const p of pickups) if (onScreen(p.x, p.y, 30)) drawPickup(p);
  drawDevices();
  drawCash();
  drawWarning();
  drawEchoes();
  drawSurveyShots();
}
