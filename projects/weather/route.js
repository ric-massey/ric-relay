/* ROUTE — the weather along a way, at the time you are there
   ────────────────────────────────────────────────────────────────────────────
   Built 2026-10-24 (an outside review of Pro, which Ric passed on with "Work
   on these": "Draw or import a route, set departure time and expected pace
   or speed, then examine forecast conditions at each point when the person
   is expected to arrive"). This file is the arithmetic and the file reading;
   app.js asks the models and draws.

   resample(pts, n)          a drawn or imported line → n points evenly along it,
                             each with its distance from the start and the
                             bearing of travel there
   schedule(samples, ms, kmh) the time each point is reached at a steady speed
   trackWind(u, v, bearing)  the wind split along and across the way: tailwind
                             positive, headwind negative; crosswind from the
                             left or the right
   readFile(name, text)      GPX, KML, GeoJSON or a GRLevelX placefile →
                             { lines, polys, points } in lat/lon

   Pure, no DOM and no network: a file is read where it was opened and goes
   nowhere (hard rule 1 — a visitor's track is theirs, and never committed,
   sent or logged). Nothing here says go or no-go (the room's rule). */
(function (root) {
  'use strict';
  const R_EARTH = 6371.0088, RAD = Math.PI / 180;
  function distKm(a, b) {
    const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function bearing(a, b) {
    const y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD);
    const x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
    return (Math.atan2(y, x) / RAD + 360) % 360;
  }
  function length(pts) { let km = 0; for (let i = 1; i < pts.length; i++) km += distKm(pts[i - 1], pts[i]); return km; }

  /* n points evenly spaced along the line (a straight-line blend within each
     leg — fine for legs of a few hundred km, which a drawn route has) */
  function resample(pts, n = 40) {
    const P = pts.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    if (P.length < 2) throw new Error('route: a route needs two points or more');
    const cum = [0];
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + distKm(P[i - 1], P[i]));
    const total = cum[cum.length - 1];
    if (!(total > 0)) throw new Error('route: the points are all in one place');
    n = Math.max(2, Math.min(200, Math.round(n)));
    const out = [];
    let leg = 1;
    for (let k = 0; k < n; k++) {
      const d = total * k / (n - 1);
      while (leg < P.length - 1 && cum[leg] < d) leg++;
      const a = P[leg - 1], b = P[leg], span = cum[leg] - cum[leg - 1], f = span > 0 ? (d - cum[leg - 1]) / span : 0;
      out.push({ lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f, km: d, bearing: bearing(a, b) });
    }
    return out;
  }
  function schedule(samples, departMs, kmh) {
    if (!(kmh > 0)) throw new Error('route: a speed above zero is needed');
    return samples.map((s) => ({ ...s, t: departMs + s.km / kmh * 3600e3 }));
  }
  /* u, v the wind's east and north parts (where the air is going); bearing the way of travel */
  function trackWind(u, v, brg) {
    const b = brg * RAD, along = u * Math.sin(b) + v * Math.cos(b), across = u * Math.cos(b) - v * Math.sin(b);
    /* across > 0: the air moves to the traveller's right, so it comes from the left */
    return { along, head: -along, cross: Math.abs(across), from: across > 0 ? 'left' : across < 0 ? 'right' : '' };
  }

  /* ── files: kept small, read with patterns rather than a DOM so the tests can run them ── */
  const num = (x) => { const v = parseFloat(x); return Number.isFinite(v) ? v : NaN; };
  const ok = (p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
  const unxml = (s) => String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim();
  function gpx(text) {
    const out = { lines: [], polys: [], points: [] }, attr = (tag, k) => { const m = new RegExp(`\\b${k}\\s*=\\s*["']([^"']+)`).exec(tag); return m ? num(m[1]) : NaN; };
    for (const [re, pt] of [[/<trkseg\b[\s\S]*?<\/trkseg>/g, /<trkpt\b[^>]*>/g], [/<rte\b[\s\S]*?<\/rte>/g, /<rtept\b[^>]*>/g]]) {
      for (const seg of text.match(re) || []) {
        const line = (seg.match(pt) || []).map((t) => ({ lat: attr(t, 'lat'), lon: attr(t, 'lon') })).filter(ok);
        if (line.length > 1) out.lines.push(line);
      }
    }
    for (const w of text.match(/<wpt\b[\s\S]*?(<\/wpt>|\/>)/g) || []) {
      const p = { lat: attr(w, 'lat'), lon: attr(w, 'lon') }, nm = /<name>([\s\S]*?)<\/name>/.exec(w);
      if (ok(p)) out.points.push({ ...p, name: nm ? unxml(nm[1]) : '' });
    }
    return out;
  }
  function kml(text) {
    const out = { lines: [], polys: [], points: [] };
    const coords = (s) => s.trim().split(/\s+/).map((c) => { const [lon, lat] = c.split(',').map(num); return { lat, lon }; }).filter(ok);
    for (const pm of text.match(/<Placemark\b[\s\S]*?<\/Placemark>/g) || [text]) {
      const nm = /<name>([\s\S]*?)<\/name>/.exec(pm), name = nm ? unxml(nm[1]) : '';
      for (const m of pm.match(/<LineString\b[\s\S]*?<\/LineString>/g) || []) { const c = /<coordinates>([\s\S]*?)<\/coordinates>/.exec(m); if (c) { const l = coords(c[1]); if (l.length > 1) out.lines.push(l); } }
      for (const m of pm.match(/<Polygon\b[\s\S]*?<\/Polygon>/g) || []) { const c = /<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/.exec(m); if (c) { const r = coords(c[1]); if (r.length > 2) out.polys.push(r); } }
      for (const m of pm.match(/<Point\b[\s\S]*?<\/Point>/g) || []) { const c = /<coordinates>([\s\S]*?)<\/coordinates>/.exec(m); if (c) { const p = coords(c[1])[0]; if (p) out.points.push({ ...p, name }); } }
    }
    return out;
  }
  function geojson(obj) {
    const out = { lines: [], polys: [], points: [] }, ll = (c) => ({ lat: num(c[1]), lon: num(c[0]) });
    const geom = (g, name) => {
      if (!g || typeof g !== 'object') return;
      const c = g.coordinates;
      if (g.type === 'Point') { const p = ll(c); if (ok(p)) out.points.push({ ...p, name }); }
      else if (g.type === 'MultiPoint') for (const x of c) { const p = ll(x); if (ok(p)) out.points.push({ ...p, name }); }
      else if (g.type === 'LineString') { const l = c.map(ll).filter(ok); if (l.length > 1) out.lines.push(l); }
      else if (g.type === 'MultiLineString') for (const x of c) { const l = x.map(ll).filter(ok); if (l.length > 1) out.lines.push(l); }
      else if (g.type === 'Polygon') { const r = (c[0] || []).map(ll).filter(ok); if (r.length > 2) out.polys.push(r); }
      else if (g.type === 'MultiPolygon') for (const x of c) { const r = (x[0] || []).map(ll).filter(ok); if (r.length > 2) out.polys.push(r); }
      else if (g.type === 'GeometryCollection') for (const x of g.geometries || []) geom(x, name);
    };
    const feat = (f) => geom(f.geometry, f.properties && (f.properties.name || f.properties.title || f.properties.NAME) ? String(f.properties.name || f.properties.title || f.properties.NAME) : '');
    if (obj.type === 'FeatureCollection') (obj.features || []).forEach(feat);
    else if (obj.type === 'Feature') feat(obj);
    else geom(obj, '');
    return out;
  }
  /* GRLevelX placefiles: "Line:" / "Polygon:" blocks of "lat, lon" ending at
     "End:", "Place:" and "Text:" points; icons are read as their points.
     Thresholds, colours and refresh are not used — a file is drawn as lines
     and names, in the page's own style. */
  function placefile(text) {
    const out = { lines: [], polys: [], points: [] };
    let cur = null, kind = null;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/;.*$/, '').trim();
      if (!line) continue;
      const m = /^(\w+)\s*:\s*(.*)$/.exec(line);
      if (m) {
        const k = m[1].toLowerCase(), rest = m[2];
        if (k === 'end') { if (cur && cur.length > (kind === 'poly' ? 2 : 1)) (kind === 'poly' ? out.polys : out.lines).push(cur); cur = null; kind = null; continue; }
        if (k === 'line') { cur = []; kind = 'line'; continue; }
        if (k === 'polygon') { cur = []; kind = 'poly'; continue; }
        if (k === 'place' || k === 'text' || k === 'icon') {
          const parts = rest.split(','), p = { lat: num(parts[0]), lon: num(parts[1]) };
          const label = k === 'place' ? parts.slice(2).join(',') : k === 'text' ? (/"([^"]*)"/.exec(rest) || [, parts.slice(3).join(',')])[1] : '';
          if (ok(p)) out.points.push({ ...p, name: String(label || '').trim().replace(/^"|"$/g, '') });
          continue;
        }
        continue;
      }
      if (cur) { const [a, b] = line.split(','); const p = { lat: num(a), lon: num(b) }; if (ok(p)) cur.push(p); }
    }
    return out;
  }
  function readFile(name, text) {
    const n = String(name || '').toLowerCase(), t = String(text || '');
    let out;
    if (/\.gpx$/.test(n) || /<gpx\b/.test(t)) out = gpx(t);
    else if (/\.kml$/.test(n) || /<kml\b/.test(t)) out = kml(t);
    else if (/\.(geo)?json$/.test(n) || /^\s*[{[]/.test(t)) out = geojson(JSON.parse(t));
    else out = placefile(t);
    if (!out.lines.length && !out.polys.length && !out.points.length) throw new Error('route: nothing in that file could be drawn — GPX, KML, GeoJSON and GRLevelX placefiles are read');
    return out;
  }

  const api = { distKm, bearing, length, resample, schedule, trackWind, readFile, gpx, kml, geojson, placefile };
  root.Route = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
