/* Route — node projects/weather/test/route.test.mjs
   route.js: a line resampled evenly, the time each point is reached, the
   wind split along and across the way, and the four kinds of file a visitor
   can open. Made-up places only — no real coordinates in this repo (hard
   rule 1): every point below is a round number in open country or open sea. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const R = require('../route.js');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };

console.log('\nRULE  a route is resampled evenly, with its bearing, and timed at a steady speed');
{
  const line = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 }];
  const total = R.length(line), s = R.resample(line, 21);
  ok(s.length === 21 && s[0].km === 0 && Math.abs(s[20].km - total) < 1e-9, `21 points from the start to the end (${total.toFixed(1)} km)`);
  ok(Math.abs(s[5].bearing - 90) < 0.5 && Math.abs(s[18].bearing - 0) < 0.5, 'the bearing is east along the first leg and north along the second');
  ok(s.every((p, i) => !i || Math.abs((p.km - s[i - 1].km) - total / 20) < 1e-6), 'the points are evenly spaced');
  const t = R.schedule(s, 0, 100);
  ok(Math.abs(t[20].t - total / 100 * 3600e3) < 1, 'at 100 km/h the end is reached after its distance ÷ 100 hours');
  let threw = 0; try { R.resample([{ lat: 0, lon: 0 }]); } catch (e) { threw++; } try { R.schedule(s, 0, 0); } catch (e) { threw++; }
  ok(threw === 2, 'one point, or no speed, is said, not drawn');
}

console.log('\nRULE  the wind is split along and across the way of travel');
{
  /* a west wind (blowing toward the east, u > 0) */
  const east = R.trackWind(10, 0, 90), west = R.trackWind(10, 0, 270), north = R.trackWind(10, 0, 0);
  ok(Math.abs(east.head + 10) < 1e-9 && east.cross < 1e-9, 'going east with a west wind: a 10 m/s tailwind, no crosswind');
  ok(Math.abs(west.head - 10) < 1e-9, 'going west into it: a 10 m/s headwind');
  ok(Math.abs(north.cross - 10) < 1e-9 && north.from === 'left' && Math.abs(north.head) < 1e-9, 'going north: all crosswind, from the left (the west)');
}

console.log('\nRULE  GPX, KML, GeoJSON and placefiles are read into lines, areas and points');
{
  const g = R.readFile('a.gpx', `<gpx><wpt lat="10" lon="20"><name>Camp &amp; water</name></wpt><trk><trkseg><trkpt lat="10" lon="20"/><trkpt lat="10.5" lon="20.5"></trkpt></trkseg></trk></gpx>`);
  ok(g.lines.length === 1 && g.lines[0].length === 2 && g.points[0].name === 'Camp & water', 'GPX: a track and a named waypoint');
  const k = R.readFile('a.kml', `<kml><Placemark><name>Ridge</name><LineString><coordinates>20,10,0 20.5,10.5,0</coordinates></LineString></Placemark><Placemark><name>Lake</name><Point><coordinates>21,11</coordinates></Point></Placemark></kml>`);
  ok(k.lines.length === 1 && k.lines[0][1].lat === 10.5 && k.points[0].name === 'Lake', 'KML: a line (longitude first) and a point');
  const j = R.readFile('a.geojson', JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: 'Field' }, geometry: { type: 'Polygon', coordinates: [[[20, 10], [21, 10], [21, 11], [20, 10]]] } }, { type: 'Feature', geometry: { type: 'MultiLineString', coordinates: [[[0, 0], [1, 1]], [[2, 2], [3, 3]]] } }] }));
  ok(j.polys.length === 1 && j.lines.length === 2, 'GeoJSON: an area and a multi-line');
  const p = R.readFile('a.txt', `Title: test\nLine: 2, 0, "front"\n10, 20\n10.5, 20.5\nEnd:\nPlace: 11, 21, Station A\nText: 12, 22, 1, "Label B"`);
  ok(p.lines.length === 1 && p.points.length === 2 && p.points[0].name === 'Station A' && p.points[1].name === 'Label B', 'a placefile: a line, a place and a text');
  let threw = false; try { R.readFile('x.txt', 'nothing here'); } catch (e) { threw = true; }
  ok(threw, 'a file with nothing to draw is said');
  let dropped = false; try { R.readFile('x.json', JSON.stringify({ type: 'Point', coordinates: [500, 10] })); } catch (e) { dropped = true; }
  ok(dropped, 'an impossible coordinate is dropped, not drawn');
}

console.log(failures ? `\n${failures} ROUTE RULE${failures === 1 ? '' : 'S'} BROKEN` : '\nALL ROUTE RULES PASS');
process.exit(failures ? 1 : 0);
