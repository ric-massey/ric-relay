/* Weather Pro's map lines: state, county, coast and border lines and the
   names of towns, drawn over the data (2026-10-23, Ric: "do it" — satellite,
   MRMS and the model fields cover the basemap, and with it every clue to where
   you are).

   Nothing here holds a place. Every line and every town comes from Natural
   Earth (public domain, naturalearthdata.com) when the page runs, straight
   from its tagged release on GitHub (CORS-open), and is cut down in the
   browser by `slim()` (Wx.mapLayer asks). The weather room keeps real
   coordinates out of this repo even for public airports — its tests use
   made-up ones — and these are read at run time for the same reason. Not
   through the Worker: it is on the free plan, and parsing the 8 MB county
   file is far past the CPU a request gets there. */
(function (root) {
  'use strict';
  const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/';
  /* `from` is the zoom a layer starts at: county lines at the national view
     would be a grey carpet, and that file is the heaviest */
  const LAYERS = {
    coast: { file: 'ne_50m_coastline', kind: 'lines', from: 3 },
    nations: { file: 'ne_50m_admin_0_boundary_lines_land', kind: 'lines', from: 3 },
    states: { file: 'ne_50m_admin_1_states_provinces_lines', kind: 'lines', from: 3 },
    counties: { file: 'ne_10m_admin_2_counties', kind: 'rings', from: 7 },
    places: { file: 'ne_10m_populated_places_simple', kind: 'places', from: 3 }
  };
  const url = (name) => LAYERS[name] ? NE + LAYERS[name].file + '.geojson' : null;
  /* North America and its waters: the radar, MRMS and the HRRR stop well inside it */
  const BOX = [-172, 13, -50, 72];
  const r3 = (v) => Math.round(v * 1000) / 1000;

  /* a line as a flat [lon, lat, lon, lat, …], rounded to ~100 m, with points
     closer than ~200 m to the last one kept dropped (the ends always stay) */
  function flat(coords) {
    const out = [];
    let px = null, py = null;
    for (let i = 0; i < coords.length; i++) {
      const x = r3(coords[i][0]), y = r3(coords[i][1]);
      if (i && i < coords.length - 1 && Math.abs(x - px) < 0.002 && Math.abs(y - py) < 0.002) continue;
      out.push(x, y); px = x; py = y;
    }
    return out;
  }
  const inBox = (xs) => {
    for (let i = 0; i < xs.length; i += 2) if (xs[i] >= BOX[0] && xs[i] <= BOX[2] && xs[i + 1] >= BOX[1] && xs[i + 1] <= BOX[3]) return true;
    return false;
  };
  /* A Natural Earth GeoJSON file → the shape the page draws:
       { v: 1, name, lines: [[lon, lat, …], …] }                  lines and rings
       { v: 1, name, places: [[name, lon, lat, minZoom, pop], …] } towns
     inside BOX only, with nothing else of the file kept. */
  function slim(name, gj) {
    const L = LAYERS[name];
    if (!L) throw new Error('mapgeo: no layer ' + name);
    const feats = (gj && Array.isArray(gj.features)) ? gj.features : [];
    if (L.kind === 'places') {
      const places = [];
      for (const f of feats) {
        const p = f.properties || {}, c = f.geometry && f.geometry.coordinates;
        if (!c || !p.name || !(c[0] >= BOX[0] && c[0] <= BOX[2] && c[1] >= BOX[1] && c[1] <= BOX[3])) continue;
        places.push([String(p.name), r3(c[0]), r3(c[1]), Number(p.min_zoom) || 10, Number(p.pop_max) || 0]);
      }
      places.sort((a, b) => b[4] - a[4]);
      return { v: 1, name, places };
    }
    const lines = [];
    const add = (cs) => { const xs = flat(cs); if (xs.length >= 4 && inBox(xs)) lines.push(xs); };
    for (const f of feats) {
      const g = f.geometry || {};
      if (g.type === 'LineString') add(g.coordinates);
      else if (g.type === 'MultiLineString' || g.type === 'Polygon') g.coordinates.forEach(add);
      else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly) => poly.forEach(add));
    }
    return { v: 1, name, lines };
  }
  /* the page's own form: each line with its bounding box, for culling */
  function prepare(s) {
    if (!s || s.v !== 1) return null;
    if (s.places) return { name: s.name, places: s.places };
    return {
      name: s.name, lines: s.lines.map((xs) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (let i = 0; i < xs.length; i += 2) { if (xs[i] < x0) x0 = xs[i]; if (xs[i] > x1) x1 = xs[i]; if (xs[i + 1] < y0) y0 = xs[i + 1]; if (xs[i + 1] > y1) y1 = xs[i + 1]; }
        return { xs, box: [x0, y0, x1, y1] };
      })
    };
  }
  /* Which towns to name at this zoom: biggest first, each only where its
     label does not touch one already placed. `at(lon, lat)` gives the pixel,
     `width(name)` the label's width; returns [{ name, x, y }]. Natural Earth's
     min_zoom says when a town is worth a name — one step early here, because
     a radar view is about towns more than countries. */
  function labels(places, z, w, h, at, width, { max = 140 } = {}) {
    const out = [], boxes = [];
    for (const p of places) {
      if (p[3] > z + 1) continue;
      const [x, y] = at(p[1], p[2]);
      if (x < -40 || y < -10 || x > w + 40 || y > h + 10) continue;
      const tw = width(p[0]), b = [x + 5, y - 8, x + 9 + tw, y + 6];
      if (boxes.some((q) => b[0] < q[2] + 6 && b[2] + 6 > q[0] && b[1] < q[3] + 3 && b[3] + 3 > q[1])) continue;
      boxes.push(b); out.push({ name: p[0], x, y });
      if (out.length >= max) break;
    }
    return out;
  }
  const api = { NE, LAYERS, BOX, url, slim, prepare, labels };
  root.MapGeo = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
