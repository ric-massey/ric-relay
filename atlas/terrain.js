/* ATLAS — reading the ground.
 *
 * Two things done with the shape of the land, both worked out in the browser
 * from free elevation tiles and nothing else:
 *
 *   1. STEEP GROUND. Every pixel's slope, coloured from "steep" to "nobody is
 *      walking up that". It highlights everything — every cliff band, every
 *      gorge wall, every cut bank — and leaves the reading to you.
 *   2. LIKELY SPOTS. The few places in view most worth a look: the lip of the
 *      biggest drops, and closed hollows that water drains into and does not
 *      drain out of, which is what a sinkhole is. Then the rock under each one,
 *      because a hollow in limestone is a cave entrance waiting to happen and a
 *      hollow in glacial till is a pond.
 *
 * Nothing here is stored. The spots are recomputed every time the map stops
 * moving and forgotten when it moves again: they are a reading of public
 * elevation data, not places, and they never touch the database or the repo.
 *
 * The elevation is AWS's open Terrain Tiles ("terrarium" PNGs: height packed
 * into the red, green and blue of each pixel). In the US the source is USGS
 * 3DEP — the same survey behind the hillshade overlay — at roughly 10 m, which
 * is good enough to find a 15 m wall and not good enough to find a 3 m one.
 * The thresholds below were set against real cliffs and real karst, and the
 * comments say what each one was measured against.
 *
 * Pure functions, no DOM: the worker runs them, and so do the tests.
 */

export const DEM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const DEM_MAXZOOM = 15;
export const EARTH = 40075016.686;

/* Height in metres from one terrarium pixel. */
export const terrarium = (r, g, b) => r * 256 + g + b / 256 - 32768;

/* Decode a tile's RGBA into a Float32Array of heights. */
export function decode(rgba, n = 256) {
  const out = new Float32Array(n * n);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    out[i] = terrarium(rgba[j], rgba[j + 1], rgba[j + 2]);
  }
  return out;
}

/* Ground metres per pixel at the middle of tile row `y` of zoom `z`. */
export function metresPerPixel(z, y, n = 256) {
  const lat = tileLat(z, y + 0.5);
  return EARTH * Math.cos(lat * Math.PI / 180) / (n * 2 ** z);
}

export function tileLat(z, y) {
  const k = Math.PI - 2 * Math.PI * y / 2 ** z;
  return 180 / Math.PI * Math.atan(Math.sinh(k));
}
export const tileLng = (z, x) => x / 2 ** z * 360 - 180;

/* Slope in degrees, Horn's 3x3 — what GDAL and every GIS uses. Edge pixels
 * borrow their neighbour's value, which flattens the outermost ring of a grid
 * by about half. On the overlay that is one pixel along each tile edge, under
 * the 27° floor almost everywhere it matters; the spot finder works on one
 * stitched grid, so it only loses the edge of the screen. */
export function slope(h, w, ht, mpp) {
  const out = new Float32Array(w * ht);
  const at = (x, y) => h[(y < 0 ? 0 : y >= ht ? ht - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];
  const k = 8 * mpp;
  for (let y = 0; y < ht; y++) {
    for (let x = 0; x < w; x++) {
      const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1);
      const d = at(x - 1, y),                       f = at(x + 1, y);
      const g = at(x - 1, y + 1), hh = at(x, y + 1), i = at(x + 1, y + 1);
      const dx = ((c + 2 * f + i) - (a + 2 * d + g)) / k;
      const dy = ((g + 2 * hh + i) - (a + 2 * b + c)) / k;
      out[y * w + x] = Math.atan(Math.hypot(dx, dy)) * 180 / Math.PI;
    }
  }
  return out;
}

/* ── the steep-ground colours ─────────────────────────────────────────────
 * Avalanche-chart bands, because that is the vocabulary people who read slope
 * already have: under 27° nothing is drawn, so the map underneath stays the
 * map. 27–35 is steep walking, 35–45 is scrambling, 45–60 is climbing, and over
 * 60 is a wall. The last two are the ones that matter here and they are the
 * loudest. Alpha rises with the band so gentle ground never hides the imagery.
 */
export const SLOPE_BANDS = [
  { min: 27, rgba: [250, 215, 60, 100],  label: '27°', name: 'steep' },
  { min: 35, rgba: [250, 145, 30, 160],  label: '35°', name: 'scramble' },
  { min: 45, rgba: [235, 60, 40, 190],   label: '45°', name: 'climb' },
  { min: 60, rgba: [150, 20, 120, 215],  label: '60°', name: 'wall' },
];

export function paintSlope(s, out = new Uint8ClampedArray(s.length * 4)) {
  for (let i = 0, j = 0; i < s.length; i++, j += 4) {
    const v = s[i];
    let band = null;
    for (const b of SLOPE_BANDS) if (v >= b.min) band = b;
    if (band) {
      out[j] = band.rgba[0]; out[j + 1] = band.rgba[1];
      out[j + 2] = band.rgba[2]; out[j + 3] = band.rgba[3];
    } else {
      out[j + 3] = 0;
    }
  }
  return out;
}

/* ── finding the drops ───────────────────────────────────────────────────
 * A cliff is a run of very steep pixels with real height between its top and
 * its bottom. Both halves matter: a road cut is 60° and four metres, a big
 * forested hillside is 300 m and 30°. Neither is a cliff.
 *
 * The steep pixels are grouped, each group is cut into cells (a two-mile gorge
 * rim is one group and should be several spots, not one), and each cell is
 * scored by the height it covers. The spot is put at the TOP of the cell — the
 * edge you would walk up to — not the steepest pixel, which is halfway down a
 * face nobody is standing on.
 *
 * At ~10 m data a real vertical face reads 50–65°, because a pixel straddles
 * the lip and the talus below. 45° was too loose (it lit every steep hollow in
 * the Appalachians); 50 with 15 m of relief keeps the sandstone walls and
 * drops the hillsides.
 */
export const CLIFF = {
  minSlope: 50,         // degrees, Horn, at the analysis resolution
  minRelief: 15,        // metres between the top and bottom of a cell
  minPixels: 3,
  cellMetres: 180,      // a long rim is cut into pieces this long
};

export function findCliffs(h, s, w, ht, mpp, opts = {}) {
  const o = { ...CLIFF, ...opts };
  const steep = new Uint8Array(w * ht);
  for (let i = 0; i < s.length; i++) if (s[i] >= o.minSlope) steep[i] = 1;

  const cell = Math.max(4, Math.round(o.cellMetres / mpp));
  const groups = new Map();            // "component:cellx:celly" -> stats
  const seen = new Int32Array(w * ht).fill(-1);
  const stack = [];
  let comp = 0;
  for (let start = 0; start < steep.length; start++) {
    if (!steep[start] || seen[start] >= 0) continue;
    stack.push(start); seen[start] = comp;
    while (stack.length) {
      const i = stack.pop();
      const x = i % w, y = (i - x) / w;
      const key = `${comp}:${(x / cell) | 0}:${(y / cell) | 0}`;
      let g = groups.get(key);
      if (!g) groups.set(key, g = { n: 0, hi: -Infinity, lo: Infinity, top: i, slopeMax: 0 });
      g.n++;
      if (s[i] > g.slopeMax) g.slopeMax = s[i];
      // The cell's top and bottom are read one pixel out from the steep run as
      // well as on it, so the relief counts the ground the face stands on.
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= ht) continue;
        const j = ny * w + nx;
        const v = h[j];
        if (v > g.hi) { g.hi = v; g.top = j; }
        if (v < g.lo) g.lo = v;
        if (steep[j] && seen[j] < 0) { seen[j] = comp; stack.push(j); }
      }
    }
    comp++;
  }

  const out = [];
  for (const g of groups.values()) {
    const relief = g.hi - g.lo;
    if (g.n < o.minPixels || relief < o.minRelief) continue;
    const x = g.top % w, y = (g.top - x) / w;
    out.push({ kind: 'cliff', x, y, relief, slope: g.slopeMax, score: relief * Math.sqrt(g.n) });
  }
  return out;
}

/* ── finding the hollows ─────────────────────────────────────────────────
 * Fill every pit to its spill point (priority flood: start from the edge of
 * the grid and always grow from the lowest cell on the boundary) and the
 * difference between the filled ground and the real ground is every closed
 * depression in view, with its depth.
 *
 * Most of those are not sinkholes. A road embankment over a culvert holds a
 * "depression" upstream of it, because the DEM cannot see the pipe; a river
 * valley behind a dam does the same. Those are long and thin, sinkholes are
 * round, so shape is the first filter. Rock is the second and is applied
 * later, by whoever asks Macrostrat what the ground is.
 *
 * Measured in the Kentucky sinkhole plain: real sinks there are 3–15 m deep at
 * this resolution and 30–400 m across. Under 2 m it is mostly noise in the
 * data; over ~800 m across it is a valley, not a hole.
 */
export const SINK = {
  minDepth: 2,          // metres below the spill point
  minPixels: 4,
  maxAcross: 800,       // metres; bigger is a basin
  maxAspect: 3,         // length / width of its bounding box
  minFill: 0.35,        // share of its bounding box it fills (a ring is not a hole)
};

export function fillDepressions(h, w, ht) {
  const filled = new Float32Array(h);
  const done = new Uint8Array(w * ht);
  const heap = new Heap(w * ht);
  for (let x = 0; x < w; x++) {
    for (const y of [0, ht - 1]) { const i = y * w + x; if (!done[i]) { done[i] = 1; heap.push(i, filled[i]); } }
  }
  for (let y = 1; y < ht - 1; y++) {
    for (const x of [0, w - 1]) { const i = y * w + x; if (!done[i]) { done[i] = 1; heap.push(i, filled[i]); } }
  }
  while (heap.size) {
    const i = heap.pop();
    const v = filled[i];
    const x = i % w, y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= w || ny >= ht) continue;
      const j = ny * w + nx;
      if (done[j]) continue;
      done[j] = 1;
      if (filled[j] < v) filled[j] = v;
      heap.push(j, filled[j]);
    }
  }
  return filled;
}

export function findSinks(h, w, ht, mpp, opts = {}) {
  const o = { ...SINK, ...opts };
  const filled = fillDepressions(h, w, ht);
  const seen = new Uint8Array(w * ht);
  const out = [];
  const stack = [];
  for (let start = 0; start < h.length; start++) {
    if (seen[start] || filled[start] - h[start] < 0.25) continue;
    let n = 0, deepest = start, depth = 0;
    let x0 = w, y0 = ht, x1 = 0, y1 = 0;
    stack.push(start); seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      const d = filled[i] - h[i];
      n++;
      if (d > depth) { depth = d; deepest = i; }
      const x = i % w, y = (i - x) / w;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= ht) continue;
        const j = ny * w + nx;
        if (!seen[j] && filled[j] - h[j] >= 0.25) { seen[j] = 1; stack.push(j); }
      }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const across = Math.max(bw, bh) * mpp;
    const aspect = Math.max(bw, bh) / Math.min(bw, bh);
    const fill = n / (bw * bh);
    if (depth < o.minDepth || n < o.minPixels || across > o.maxAcross ||
        aspect > o.maxAspect || fill < o.minFill) continue;
    const x = deepest % w, y = (deepest - x) / w;
    out.push({ kind: 'sink', x, y, depth, across, score: depth * Math.sqrt(n) });
  }
  return out;
}

/* The best few, no two on top of each other. Cliffs and sinks are kept apart
 * so a gorge full of walls cannot crowd the one sinkhole off the map. */
export function pick(spots, mpp, { perKind = 12, apartMetres = 250 } = {}) {
  const out = [];
  for (const kind of ['cliff', 'sink']) {
    const mine = spots.filter((s) => s.kind === kind).sort((a, b) => b.score - a.score);
    const kept = [];
    for (const s of mine) {
      if (kept.length >= perKind) break;
      if (kept.some((k) => Math.hypot(k.x - s.x, k.y - s.y) * mpp < apartMetres)) continue;
      kept.push(s);
    }
    out.push(...kept);
  }
  return out;
}

/* ── what the rock is ────────────────────────────────────────────────────
 * Macrostrat's map unit at a point carries a free-text lithology ("sandstone
 * | conglomerate | minor shale", or "Major:{limestone}, Minor:{shale}"). The
 * first family named wins, because Macrostrat lists the dominant rock first.
 * What each family means for a spot is the whole reason to ask.
 */
export const ROCKS = [
  { key: 'carbonate',  words: ['limestone', 'dolomite', 'dolostone', 'marble', 'chalk', 'carbonate', 'travertine'],
    label: 'limestone country', karst: true },
  { key: 'evaporite',  words: ['gypsum', 'anhydrite', 'halite', 'salt', 'evaporite'],
    label: 'gypsum / salt', karst: true },
  { key: 'volcanic',   words: ['basalt', 'lava', 'andesite', 'rhyolite', 'tuff', 'volcanic', 'obsidian', 'scoria'],
    label: 'volcanic rock', tubes: true },
  { key: 'sandstone',  words: ['sandstone', 'quartzite', 'conglomerate', 'arkose'],
    label: 'sandstone', walls: true },
  { key: 'granite',    words: ['granite', 'granodiorite', 'diorite', 'gabbro', 'monzonite', 'syenite', 'plutonic', 'intrusive'],
    label: 'granite', walls: true },
  { key: 'metamorphic', words: ['gneiss', 'schist', 'slate', 'phyllite', 'metamorphic', 'amphibolite'],
    label: 'metamorphic rock', walls: true },
  { key: 'shale',      words: ['shale', 'siltstone', 'mudstone', 'claystone', 'coal'],
    label: 'shale', crumbly: true },
  { key: 'loose',      words: ['alluvium', 'till', 'glacial', 'gravel', 'sand', 'silt', 'clay', 'loess', 'colluvium', 'unconsolidated', 'surficial', 'dune'],
    label: 'loose ground', loose: true },
];

export function rockFamily(lith) {
  const text = String(lith || '').toLowerCase();
  let best = null, at = Infinity;
  for (const r of ROCKS) {
    for (const w of r.words) {
      const m = text.match(new RegExp(`\\b${w}`));
      if (m && m.index < at) { at = m.index; best = r; }
    }
  }
  return best;
}

/* Pick the most detailed unit Macrostrat has at the point. */
const SCALE_ORDER = { large: 0, medium: 1, small: 2, tiny: 3 };
const byDetail = (data) => [...(data || [])].sort((a, b) =>
  (SCALE_ORDER[a.scale] ?? 9) - (SCALE_ORDER[b.scale] ?? 9));
export const bestUnit = (data) => byDetail(data)[0] || null;

/* What the ground is at a point, from Macrostrat's answer: the most detailed
 * unit that says, and the family its rock belongs to. The lithology is asked
 * first and the unit's name second, because a state map will happily leave
 * the lithology blank on "El Capitan Granite" and still be right in the name.
 * A coarser map that names the rock beats a detailed one that does not. */
export function rockOf(data) {
  const units = byDetail(data);
  for (const u of units) {
    const family = rockFamily(u.lith) || rockFamily(u.name);
    if (family) return { family, unit: unitFacts(u) };
  }
  return units[0] ? { family: null, unit: unitFacts(units[0]) } : null;
}

const unitFacts = (u) => ({
  name: u.name || u.strat_name || '',
  lith: String(u.lith || '').replace(/Major:|Minor:|Incidental:|[{}]/g, '').replace(/\s*[|,]\s*/g, ', ').replace(/\s+/g, ' ').trim(),
  age: u.b_int_name && u.t_int_name && u.b_int_name !== u.t_int_name
    ? `${u.b_int_name} to ${u.t_int_name}` : (u.b_int_name || u.t_int_name || ''),
});

export const ROCK_URL = (lat, lng) =>
  `https://macrostrat.org/api/v2/geologic_units/map?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`;

/* The one line a spot gets, given what kind it is and what it stands on.
 * Honest about the guess: "likely" only where the rock backs it up. */
export function verdict(spot, rock) {
  if (spot.kind === 'sink') {
    if (rock?.karst) return { title: 'likely sinkhole', why: `a closed hollow in ${rock.label} — karst, where caves are`, strong: true };
    if (rock?.tubes) return { title: 'hollow in lava', why: 'volcanic ground — a collapsed lava tube looks just like this', strong: true };
    if (rock?.loose) return { title: 'closed hollow', why: `${rock.label} — more likely a pond, pit or kettle than a cave`, strong: false };
    if (rock) return { title: 'closed hollow', why: `${rock.label}, not karst — could be a pit, quarry or culvert`, strong: false };
    return { title: 'closed hollow', why: 'no rock map here to say what it is', strong: false };
  }
  if (rock?.loose) return { title: 'steep bank', why: `${rock.label} — a cut bank or bluff, probably not rock`, strong: false };
  if (rock?.crumbly) return { title: 'drop', why: 'shale — steep, but it breaks rather than stands', strong: false };
  if (rock) return { title: 'cliff edge', why: `${rock.label} wall`, strong: true };
  return { title: 'cliff edge', why: 'a big drop — no rock map here', strong: true };
}

/* A binary min-heap over cell indices, keyed by height. Typed arrays because
 * a dozen tiles is a million cells and an array of objects would be most of
 * the cost. */
class Heap {
  constructor(cap) { this.k = new Float32Array(cap); this.v = new Int32Array(cap); this.size = 0; }
  push(v, k) {
    let i = this.size++;
    const K = this.k, V = this.v;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (K[p] <= k) break;
      K[i] = K[p]; V[i] = V[p]; i = p;
    }
    K[i] = k; V[i] = v;
  }
  pop() {
    const K = this.k, V = this.v;
    const top = V[0];
    const n = --this.size;
    const k = K[n], v = V[n];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && K[c + 1] < K[c]) c++;
      if (K[c] >= k) break;
      K[i] = K[c]; V[i] = V[c]; i = c;
    }
    K[i] = k; V[i] = v;
    return top;
  }
}
