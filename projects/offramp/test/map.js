/* Render a stretch of the corridor top-down, as an SVG strip diagram.

   The project rule this exists to serve: render the map top-down and
   audit every junction numerically; never debug roads through the game
   viewport. The viewport is 256x416 px of a road that is 200 px wide —
   you cannot see a gore and its merge at the same time, and half of
   what is wrong with a junction is the relationship between them.

   ── why it is not drawn in world coordinates ────────────────────────
   Because I-40 is 30,000 px long across one interchange and 200 px
   wide, so a true plan is a hairline. This DEVELOPS the corridor onto a
   straight line — s along, u across, exactly the two coordinates the
   whole game is written in — and exaggerates u. Every offset on the
   picture is then the number the code actually computed, which is the
   only reason to draw it at all.

   Usage:  node test/map.js [corridorPx] [spanPx] [uScale] > out.html */
const { Road: R, World } = require("./harness.js");

const PX = Number(process.argv[2] || 18408779.7);
const SPAN = Number(process.argv[3] || 26000);
const UK = Number(process.argv[4] || 6);          // how much u is stretched

World.setStart(PX);
const road = World.buildWindow(PX);
const centre = PX - road.baseS;
const s0 = Math.max(0, centre - SPAN / 2);
const s1 = Math.min(R.len(road), centre + SPAN / 2);

let maxU = 0;
const X = (s) => (s - s0).toFixed(1);
const Y = (u) => { if (Math.abs(u) > maxU) maxU = Math.abs(u); return (-u * UK).toFixed(1); };
const paths = [];

/* The corridor, as offsets read straight out of road.js. */
function band(uAt, cls, step) {
  let d = [], on = false;
  for (let s = s0; s <= s1; s += (step || 8)) {
    const u = uAt(s);
    if (u == null) { on = false; continue; }
    d.push((on ? "L" : "M") + X(s) + " " + Y(u));
    on = true;
  }
  paths.push(`<path class="${cls}" d="${d.join("")}"/>`);
}
band((s) => R.edges(road, s).uR, "seal");
band((s) => R.edges(road, s).uL, "seal");
band((s) => R.edges(road, s).uR + R.SH_OUT, "sh");
band((s) => R.edges(road, s).uL - R.SH_OUT, "sh");
band((s) => R.insideAt(road, s) + R.innerAt(road, s), "yellow");
band((s) => -(R.insideAt(road, s) + R.innerAtL(road, s)), "yellow");
band((s) => R.medAt(road, s), "med");
band((s) => -R.medAt(road, s), "med");
for (let b = 1; b < 6; b++) {
  band((s) => (R.lanesAt(road, s) > b + 0.06
    ? R.insideAt(road, s) + R.innerAt(road, s) + R.LANE * b : null), "lane");
  band((s) => (R.backLanesAt(road, s) > b + 0.06
    ? -(R.insideAt(road, s) + R.innerAtL(road, s) + R.LANE * b) : null), "lane");
}

/* Everything hanging off it, projected back onto the corridor so it is
   in the same two coordinates. A road that leaves the window simply
   stops being drawn. */
const labels = [];
for (const r of World.roads) {
  if (r === road) continue;
  const cls = r.scenery ? "scenery" : r.leftExit ? "wye" : "ramp";
  let hint = null;
  const mid = [], edgeA = [], edgeB = [], deck = [];
  let onA = false, onB = false, onD = false, seen = false;
  for (let i = 0; i < r.st.length; i++) {
    const d = i * R.STEP;
    const p = r.st[i];
    const pr = R.project(road, p.x, p.y, hint, hint == null ? 0 : 60);
    if (!pr || pr.s < s0 || pr.s > s1) { onA = onB = onD = false; continue; }
    hint = pr.i;
    const e = R.edges(r, d);
    if (!seen) { seen = true; labels.push({ s: pr.s, u: pr.u, t: (r.exitRef || r.stopName || r.crossName || r.kind) + (r.junction ? " " + (r.junction.side > 0 ? "E" : "W") : "") }); }
    mid.push((onA ? "L" : "M") + X(pr.s) + " " + Y(pr.u)); onA = true;
    edgeA.push((onB ? "L" : "M") + X(pr.s) + " " + Y(pr.u + e.uR));
    edgeB.push((onB ? "L" : "M") + X(pr.s) + " " + Y(pr.u + e.uL)); onB = true;
    if (R.deckAt(r, d) > 0.5) { deck.push((onD ? "L" : "M") + X(pr.s) + " " + Y(pr.u)); onD = true; }
    else onD = false;
  }
  if (!mid.length) continue;
  paths.push(`<path class="deck" d="${deck.join("")}"/>`);
  paths.push(`<path class="${cls}" d="${edgeA.join("")}"/>`);
  paths.push(`<path class="${cls}" d="${edgeB.join("")}"/>`);
  paths.push(`<path class="${cls} mid" d="${mid.join("")}"/>`);
}

const W = s1 - s0;
/* Tall enough for the widest thing actually drawn. Guessed from the
   stretch factor, this clipped the sealed edges off the picture and
   left a sliver that looked like a road. */
const H = (maxU + 40) * UK;
const ticks = [];
for (let s = Math.ceil(s0 / 1000) * 1000; s < s1; s += 1000)
  ticks.push(`<line class="tick" x1="${X(s)}" y1="${-H}" x2="${X(s)}" y2="${H}"/>`
    + `<text class="tick" x="${X(s)}" y="${H - 8}">${((road.baseS + s) / (1609.34 / 0.179)).toFixed(2)}mi</text>`);

console.log(`<!doctype html><meta charset="utf-8"><title>corridor ${PX}</title>
<style>body{margin:0;background:#14181c;color:#9aa4b0;font:12px monospace}
 svg{width:100%;height:auto;display:block}
 path{fill:none;vector-effect:non-scaling-stroke}
 .seal{stroke:#cfd3d8;stroke-width:1.3}
 .sh{stroke:#5a6670;stroke-width:0.8}
 .yellow{stroke:#e0b23a;stroke-width:1.2}
 .med{stroke:#46525c;stroke-width:0.7}
 .lane{stroke:#8a949e;stroke-width:0.7;stroke-dasharray:5 9}
 .ramp{stroke:#8fa5c0;stroke-width:1.1}
 .wye{stroke:#e2603a;stroke-width:1.6}
 .mid{stroke-dasharray:3 6;opacity:0.6}
 .deck{stroke:#e2603a;stroke-width:6;opacity:0.22}
 .scenery{stroke:#3f4a3f;stroke-width:0.9}
 line.tick{stroke:#232a30;stroke-width:0.6}
 text{font:10px monospace;fill:#5a6670;text-anchor:middle}
 p{padding:6px 10px;margin:0}
</style>
<p>I-40 developed: s along, u across &times;${UK}. white = sealed edge, yellow = inside edge, dashed grey = lane boundary, orange = exit 368 (thick pale orange = on the deck), blue = other ramps.</p>
<svg viewBox="0 ${-H} ${W} ${2 * H}" >
<g>${ticks.join("")}</g>
${paths.join("\n")}
</svg>`);
