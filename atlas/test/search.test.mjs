/* Run: node test/search.test.mjs
 *
 * Two things in search.js go wrong quietly, and neither of them throws.
 *
 * A ranking that puts the wrong pin first just looks like the search not
 * working, and there is no way to tell by looking whether it is the scorer or
 * the data. And a bounding box read in the wrong order does not fail — it flies
 * the map somewhere confidently wrong. Nominatim hands back
 * [south, north, west, east] and MapLibre wants [[west, south], [east, north]],
 * which is the same four numbers in a different order with the pairs swapped,
 * so it is exactly the kind of thing that survives a glance.
 */
import assert from 'node:assert/strict';
import {
  normalise, terms, hit, scorePin, WEIGHT,
  placeSearchUrl, GEOCODER, viewboxFromBounds,
  placeName, placeDetail, placeType, normalisePlace, normalisePlaces,
  isArea, AREA_DEGREES,
  kmBetween, placeRank, rankPlaces, dedupePlaces, NEAR_BONUS,
  boxAround, NEAR_BOX_KM, searchUrlForScope, SCOPES,
  searchOrigin, homeFromPlace, homeCamera, HOME_ZOOM, HOME_MAX_ZOOM,
} from '../search.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { console.error(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; }
};

console.log('\nthe query');

test('accents and punctuation go, because nobody types them at a gate', () => {
  assert.equal(normalise("Muñoz Cañón"), 'munoz canon');
  assert.equal(normalise("St. Mary's Ridge"), 'st mary s ridge');
  assert.equal(normalise('  THE   Narrows  '), 'the narrows');
});

test('an empty query is no terms rather than one empty term', () => {
  // One empty term matches everything, which would show the whole map as a
  // result the moment somebody selected all and deleted.
  assert.deepEqual(terms(''), []);
  assert.deepEqual(terms('   '), []);
  assert.deepEqual(terms('!!! ???'), []);
});

test('a match is graded by how much of the thing it is', () => {
  assert.equal(hit('Narrows', 'narrows'), 4);           // called exactly that
  assert.equal(hit('Narrows Creek', 'narrows'), 3);     // starts with it
  assert.equal(hit('The Narrows', 'narrows'), 2);       // a word in it
  assert.equal(hit('unnarrows', 'narrows'), 1);         // buried
  assert.equal(hit('gate is locked', 'narrows'), 0);
});

console.log('\nranking pins');

const pin = (over = {}) => ({
  name: '', description: '', kind: 'other', author: 'Ric', notes: [], ...over,
});

test('every word has to land somewhere — two words narrow, they do not widen', () => {
  // An OR search for "cave gate" returns every cave and every gate, which is
  // every reason anybody stopped using it.
  const p = pin({ name: 'Cathedral Sink', description: 'gate on the second road' });
  assert.ok(scorePin(p, terms('cathedral gate')), 'both words land and it should match');
  assert.equal(scorePin(p, terms('cathedral windmill')), null);
});

test('a pin called the thing beats a pin that mentions it', () => {
  const called = scorePin(pin({ name: 'The Narrows' }), terms('narrows'));
  const mentions = scorePin(pin({ name: 'Cave Hollow', description: 'where the road narrows' }), terms('narrows'));
  assert.ok(called.score > mentions.score,
    `named ${called.score} should outrank mentioned ${mentions.score}`);
});

test('the name outranks the description whatever the grade', () => {
  // The weakest possible name match still beats the strongest description one,
  // which is the whole point of weighting them differently.
  assert.ok(WEIGHT.name * 1 > WEIGHT.description * 4);
});

test('a kind and an author are searchable, because that is how people ask', () => {
  assert.ok(scorePin(pin({ name: 'x', kind: 'caves' }), terms('caves')));
  assert.ok(scorePin(pin({ name: 'x', author: 'Silas' }), terms('silas')));
});

test('a note can find a pin, and says so', () => {
  // "gate locked" is in nobody's pin name and is exactly what gets searched for.
  const found = scorePin(
    pin({ name: 'Cave Hollow', notes: ['gate was locked in March', 'creek was dry'] }),
    terms('locked'));
  assert.ok(found, 'a word only in a note should still find the pin');
  assert.equal(found.why, 'gate was locked in March',
    'the note that found it should be quotable back');
});

test('a note is not quoted when the pin already says it', () => {
  // Otherwise the row shows the same words twice and reads like a bug.
  const found = scorePin(
    pin({ name: 'Locked Gate Cave', notes: ['gate was locked in March'] }),
    terms('locked'));
  assert.ok(found);
  assert.equal(found.why, null);
});

test('nothing matches nothing', () => {
  assert.equal(scorePin(pin({ name: 'Cathedral Sink' }), terms('quarry')), null);
});

console.log('\nasking the world');

test('the query goes to Nominatim in the format the app can read', () => {
  const url = new URL(placeSearchUrl('hart county'));
  assert.equal(`${url.origin}${url.pathname}`, GEOCODER);
  assert.equal(url.searchParams.get('q'), 'hart county');
  assert.equal(url.searchParams.get('format'), 'jsonv2');
  assert.equal(url.searchParams.get('limit'), '12');
});

test('the map you are looking at biases the answer without fencing it in', () => {
  // bounded=0 is the difference between "this creek first" and "no results,
  // because you happened to be zoomed into the wrong valley".
  const box = viewboxFromBounds({ west: -86, north: 38, east: -85, south: 37 });
  assert.deepEqual(box, [-86, 38, -85, 37], 'Nominatim wants lon,lat,lon,lat');
  const url = new URL(placeSearchUrl('creek', { viewbox: box }));
  assert.equal(url.searchParams.get('viewbox'), '-86,38,-85,37');
  assert.equal(url.searchParams.get('bounded'), '0');
});

test('the near search is fenced in, and that is what makes a brand findable', () => {
  // Unbounded, "rei" comes back as a town in Brazil, one in Catalonia and a
  // peak in Japan — every one a better "place named Rei" than a shop, and not
  // one of them what anybody meant. Fenced to a box there are no such towns to
  // beat the shops, so the shops are the answer.
  const near = new URL(placeSearchUrl('rei', { viewbox: boxAround({ lat: 37, lng: -86 }), bounded: true }));
  assert.equal(near.searchParams.get('bounded'), '1');
  const wide = new URL(placeSearchUrl('rei', { viewbox: [-1, 1, 1, -1] }));
  assert.equal(wide.searchParams.get('bounded'), '0');
});

test('the box is square on the ground, not square in degrees', () => {
  // A degree of longitude is a different distance at every latitude. Treating
  // the two as the same makes the box a third too narrow in Alaska.
  const [w, nth, e, sth] = boxAround({ lat: 60, lng: 0 }, NEAR_BOX_KM);
  const tall = kmBetween({ lat: sth, lng: 0 }, { lat: nth, lng: 0 });
  const wide = kmBetween({ lat: 60, lng: w }, { lat: 60, lng: e });
  assert.ok(Math.abs(tall - wide) / tall < 0.05,
    `box is ${tall.toFixed(0)} km tall and ${wide.toFixed(0)} km wide`);
  assert.ok(w < e && sth < nth, 'the corners come out west,north,east,south');
});

test('each scope asks a different question, and says so in the URL', () => {
  const origin = { lat: 37, lng: -86 };
  const view = [-86.5, 37.5, -85.5, 36.5];

  const near = new URL(searchUrlForScope('spring', 'near', { origin, view }));
  assert.equal(near.searchParams.get('bounded'), '1');
  // Near is a box around YOU, not around what happens to be on screen — you can
  // be looking at Utah while standing in Kentucky.
  assert.notEqual(near.searchParams.get('viewbox'), view.join(','));

  const inView = new URL(searchUrlForScope('spring', 'view', { origin, view }));
  assert.equal(inView.searchParams.get('bounded'), '1');
  assert.equal(inView.searchParams.get('viewbox'), view.join(','));

  const anywhere = new URL(searchUrlForScope('spring', 'anywhere', { origin, view }));
  assert.equal(anywhere.searchParams.get('bounded'), '0');
});

test('a scope with nothing to measure from falls back rather than fencing off nothing', () => {
  // bounded=1 with no box is a search that can never return anything.
  const near = new URL(searchUrlForScope('spring', 'near', { origin: null, view: null }));
  assert.equal(near.searchParams.get('bounded'), null);
  const inView = new URL(searchUrlForScope('spring', 'view', { origin: null, view: null }));
  assert.equal(inView.searchParams.get('bounded'), null);
  assert.equal(SCOPES.length, 3);
});

test('a query with no viewbox does not send an empty one', () => {
  const url = new URL(placeSearchUrl('mammoth cave'));
  assert.equal(url.searchParams.get('viewbox'), null);
  assert.equal(url.searchParams.get('bounded'), null);
});

console.log('\nreading the answer');

const ROW = {
  osm_type: 'way', osm_id: 12345,
  display_name: 'Cave Hollow Road, Hart County, Kentucky, 42749, United States',
  lat: '37.2000000', lon: '-85.9000000',
  boundingbox: ['37.1900000', '37.2100000', '-85.9200000', '-85.8800000'],
  category: 'highway', type: 'unclassified',
};

test('the name is the first part and the rest is where it is', () => {
  assert.equal(placeName(ROW.display_name), 'Cave Hollow Road');
  // The country and the postcode are the two parts nobody in a crew of three
  // is helped by reading.
  assert.equal(placeDetail(ROW.display_name), 'Hart County, Kentucky');
});

test('the type is said in words', () => {
  assert.equal(placeType({ category: 'boundary', type: 'protected_area' }), 'protected area');
  assert.equal(placeType({ category: 'natural', type: 'peak' }), 'peak');
  // "yes" is what OSM says when the tag has no interesting value; fall back to
  // the category rather than telling somebody the place is a "yes".
  assert.equal(placeType({ category: 'building', type: 'yes' }), 'building');
});

test('the bounding box is turned round, both the order and the pairing', () => {
  // Nominatim: [south, north, west, east].  MapLibre: [[west, south], [east, north]].
  const p = normalisePlace(ROW);
  assert.deepEqual(p.bounds, [[-85.92, 37.19], [-85.88, 37.21]]);
  // And the corners are the right way round, which is the failure that flies
  // the map to the middle of the ocean rather than throwing.
  const [[w, s], [e, n]] = p.bounds;
  assert.ok(w < e && s < n, 'south-west corner must come first');
  assert.ok(p.lng > w && p.lng < e && p.lat > s && p.lat < n,
    'the point should be inside its own box');
});

test('a result with no usable position is dropped rather than drawn', () => {
  const rows = [ROW, { ...ROW, lat: null, lon: null }, { ...ROW, lat: 'nowhere' }];
  assert.equal(normalisePlaces(rows).length, 1);
  assert.equal(normalisePlaces(null).length, 0);
});

test('a missing bounding box is null, not a broken one', () => {
  assert.equal(normalisePlace({ ...ROW, boundingbox: undefined }).bounds, null);
  assert.equal(normalisePlace({ ...ROW, boundingbox: ['a', 'b', 'c', 'd'] }).bounds, null);
});

test('an area is flown to as a box and a point is flown to as a point', () => {
  // A wilderness area framed as a point drops you in the middle of it at street
  // zoom with no idea how big it is.
  const forest = normalisePlace({ ...ROW, boundingbox: ['37.0', '37.6', '-86.4', '-85.7'] });
  const gate   = normalisePlace({ ...ROW, boundingbox: ['37.2000', '37.2001', '-85.9001', '-85.9000'] });
  assert.equal(isArea(forest), true);
  assert.equal(isArea(gate), false);
  assert.equal(isArea({ bounds: null }), false);
  assert.ok(AREA_DEGREES > 0);
});

console.log('\nwhich answer you meant');

const at = (lat, lng, over = {}) => ({ lat, lng, name: 'REI', type: 'shop', ...over });
const HERE = { lat: 37.19, lng: -85.90 };

test('distance is real kilometres, not degrees', () => {
  // A degree of longitude at this latitude is nothing like a degree of
  // latitude, which is exactly what a naive dx/dy comparison gets wrong.
  assert.ok(Math.abs(kmBetween(HERE, { lat: 38.09, lng: -85.90 }) - 100) < 2);
  assert.equal(Math.round(kmBetween(HERE, HERE)), 0);
});

test('between two shops, the near one wins — which is what "rei" means', () => {
  // Every shop in the country scores about the same importance, so without
  // proximity the first result is whichever one the index happens to like.
  const near = at(37.20, -85.91, { importance: 0.15 });
  const far  = at(47.60, -122.33, { importance: 0.17 });
  assert.ok(placeRank(near, HERE) > placeRank(far, HERE));
  assert.deepEqual(rankPlaces([far, near], HERE).map((p) => p.lat), [37.20, 47.60]);
});

test('a landmark still beats a shop next door', () => {
  // The cap is what stops "mammoth cave" returning the Mammoth Cave Laundromat
  // because it happens to be four miles closer.
  const park = at(37.19, -86.10, { name: 'Mammoth Cave', type: 'nature reserve', importance: 0.62 });
  const shop = at(37.19, -85.90, { importance: 0.15 });
  assert.ok(placeRank(park, HERE) > placeRank(shop, HERE));
  assert.ok(NEAR_BONUS < 0.5, 'proximity must not be able to outweigh importance outright');
});

test('with nowhere to measure from, the index order stands', () => {
  const a = at(1, 1, { importance: 0.4 });
  const b = at(2, 2, { importance: 0.1 });
  assert.deepEqual(rankPlaces([b, a], null).map((p) => p.importance), [0.4, 0.1]);
});

test('one thing listed three times is listed once', () => {
  // A building, its entrance and its address point are three OSM objects with
  // one name in one spot.
  const rows = [
    at(37.1900, -85.9000), at(37.19001, -85.90001), at(37.1901, -85.9000),
    at(37.5000, -85.9000),                       // a different REI, kept
    at(37.1900, -85.9000, { type: 'car park' }), // a different thing, kept
  ];
  assert.equal(dedupePlaces(rows).length, 3);
  assert.equal(dedupePlaces([]).length, 0);
});

test('importance survives being read off the row', () => {
  assert.equal(normalisePlace({ ...ROW, importance: 0.42 }).importance, 0.42);
  assert.equal(normalisePlace({ ...ROW, importance: undefined }).importance, 0);
});

console.log('\nhome');

const HOME = { name: 'Cave City', detail: 'Barren County, Kentucky', lat: 37.13, lng: -85.95, bounds: null };

test('the phone wins, then the town you named, then the map', () => {
  // Not a preference — a confidence ranking. Being told where you are beats a
  // town you typed in once, which beats wherever the map happens to point.
  const here = { lat: 37.19, lng: -85.90 };
  const centre = { lat: 40, lng: -100 };
  assert.equal(searchOrigin({ here, home: HOME, centre }).from, 'you');
  assert.equal(searchOrigin({ home: HOME, centre }).from, 'home');
  assert.equal(searchOrigin({ centre }).from, 'map');
  assert.equal(searchOrigin({}), null);
  assert.equal(searchOrigin(), null);
});

test('an origin carries the position, not just the label', () => {
  const o = searchOrigin({ home: HOME });
  assert.equal(o.lat, 37.13);
  assert.equal(o.lng, -85.95);
  // And it is usable as the thing it exists for: fencing the near search.
  const url = new URL(searchUrlForScope('rei', 'near', { origin: o }));
  assert.equal(url.searchParams.get('bounded'), '1');
});

test('a half-written position is no position, not a position at zero', () => {
  // 0,0 is a real place in the Gulf of Guinea, and a home saved from a row with
  // a missing lat would quietly measure every distance from there.
  assert.equal(searchOrigin({ home: { lat: 37.1 } }), null);
  assert.equal(searchOrigin({ home: { lat: NaN, lng: -85.9 } }), null);
  assert.equal(homeFromPlace({ name: 'x', lat: 37.1 }), null);
  assert.equal(homeFromPlace(null), null);
});

test('what is kept of a town is what will still be readable in a year', () => {
  const pl = normalisePlace({ ...ROW, display_name: 'Cave City, Barren County, Kentucky, 42127, United States' });
  const home = homeFromPlace(pl);
  assert.equal(home.name, 'Cave City');
  assert.equal(home.detail, 'Barren County, Kentucky');
  assert.deepEqual(Object.keys(home).sort(), ['bounds', 'detail', 'lat', 'lng', 'name']);
});

test('a town is opened as a town, not as four blocks of it', () => {
  // A point at street zoom shows you four blocks and no way to know which four.
  const point = homeCamera(HOME);
  assert.deepEqual(point.center, [-85.95, 37.13]);
  assert.equal(point.zoom, HOME_ZOOM);
  assert.ok(HOME_ZOOM < 14, 'the whole town should be on screen');

  const boxed = homeCamera({ ...HOME, bounds: [[-86.0, 37.0], [-85.8, 37.2]] });
  assert.deepEqual(boxed.bounds, [[-86.0, 37.0], [-85.8, 37.2]]);
  assert.equal(boxed.maxZoom, HOME_MAX_ZOOM);

  // A box the size of a gate is not a town — fly to the point instead of
  // zooming to the maximum on a ten-metre square.
  const tiny = homeCamera({ ...HOME, bounds: [[-85.9501, 37.1299], [-85.9500, 37.1300]] });
  assert.equal(tiny.zoom, HOME_ZOOM);
  assert.equal(homeCamera(null), null);
});

console.log(`\n${passed} passed\n`);
