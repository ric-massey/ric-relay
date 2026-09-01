/* ATLAS — finding a thing you already know the name of.
 *
 * Two different questions wear one box, and keeping them apart is most of the
 * design:
 *
 *   YOUR PINS are on the phone. Searching them is free, instant and works in a
 *   canyon, so it runs on every keystroke over the copy already in memory.
 *
 *   EVERYTHING ELSE — towns, creeks, peaks, forest roads, wilderness areas —
 *   belongs to somebody else's index and costs a request. So it is debounced,
 *   only asked once there is enough of a word to be worth asking about, and it
 *   is the half that says "needs signal" rather than silently returning nothing.
 *
 * Everything in here is pure: strings in, numbers and objects out. The app does
 * the fetching and the drawing, so the two things that actually go wrong
 * quietly — a ranking that puts the wrong pin first, and a bounding box read in
 * the wrong order, which sends you to the antipodes — are tested without a
 * browser in test/search.test.mjs.
 */

/* ── the query ────────────────────────────────────────────────────────────
 * Punctuation and accents go, because nobody types "Muñoz Cañón" into a search
 * box on a phone at a gate, and "st. mary's" should find "St Marys". What is
 * left is words.
 */
export function normalise(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function terms(q) {
  const n = normalise(q);
  return n ? n.split(' ') : [];
}

/* Four grades of match, not one. Typing "narrows" should find the pin actually
 * called Narrows before the one whose description mentions that the road
 * narrows past the second gate, and a search that cannot tell those apart puts
 * the wrong one first. */
export function hit(text, term) {
  const t = normalise(text);
  if (!t || !term) return 0;
  if (t === term) return 4;                       // it is called exactly that
  if (t.startsWith(term)) return 3;               // it starts with it
  if (new RegExp(`\\b${term}`).test(t)) return 2;  // a word in it starts with it
  if (t.includes(term)) return 1;                 // buried inside a word
  return 0;
}

/* Where a match counts for most. A name is what a place IS; a note is one
 * person's account of one day, and a pin should not outrank a better-named one
 * because somebody mentioned the word in passing two years ago.
 *
 * The numbers are not free-hand. The rule they enforce is that a name match at
 * ANY grade beats a non-name match at every grade — so nothing below has to
 * clear 40 / 4, which is why they stop at 9 rather than at a rounder 10 or 12.
 * test/search.test.mjs holds that, because the obvious tidy-up is to nudge one
 * of them up and nothing on screen would complain. */
export const WEIGHT = { name: 40, description: 9, kind: 8, author: 8, note: 5 };

/* AND, not OR: every word you typed has to land somewhere on the pin. Two words
 * in a search box mean "narrow it down" in every search box anybody has ever
 * used, and an OR search for "cave gate" returns every cave and every gate.
 *
 * Takes a plain object rather than a pin row so the ranking can be tested
 * without a database, a session, or the eight kind labels.
 */
export function scorePin(entry, qterms) {
  if (!qterms.length) return { score: 0, why: null };

  let total = 0;
  let inWords = false;      // did the pin's OWN words match, or only a note's
  let noteHit = null;

  for (const term of qterms) {
    const name = hit(entry.name, term) * WEIGHT.name;
    const desc = hit(entry.description, term) * WEIGHT.description;
    const kind = hit(entry.kind, term) * WEIGHT.kind;
    const who  = hit(entry.author, term) * WEIGHT.author;

    let note = 0;
    for (const body of entry.notes || []) {
      const h = hit(body, term) * WEIGHT.note;
      if (h > note) { note = h; if (!noteHit) noteHit = body; }
    }

    const best = Math.max(name, desc, kind, who, note);
    if (!best) return null;
    if (name || desc) inWords = true;
    total += best;
  }

  // Only worth showing the note when the note is the only reason this pin is
  // here — otherwise it is a second copy of what the row already says.
  return { score: total, why: inWords ? null : noteHit };
}

/* ── a coordinate is not a search ─────────────────────────────────────────
 * Somebody reads you a number over the radio, a forum post gives a trailhead as
 * 39°30'15"N 111°12'30"W, or you copy six decimal places off another map. There
 * is exactly one place that means. Ranking it against towns called something
 * similar is the wrong shape of answer, and asking a geocoder for it is a
 * request over cell data for a fact already in your hand — which is why this
 * runs first, and why a coordinate is found in a canyon with no signal.
 *
 * What it must never do is match something that isn't one. "5 W" is a forest
 * road and "39" is somebody still typing, and a false positive here does not
 * show a bad result — it replaces the whole list with one wrong place.
 */

// Everything a coordinate is allowed to be made of, and nothing else. A letter
// outside NSEW means a name, and a name is not a coordinate.
const COORD_CHARS = /^[-+0-9.,°'" NSEW/]+$/;

function coordTokens(s) {
  const out = [];
  const re = /([NSEW])|([-+]?\d+(?:\.\d+)?)|([,/])/g;
  let m;
  while ((m = re.exec(s))) {
    if (m[1]) out.push({ t: 'letter', v: m[1] });
    else if (m[2]) out.push({ t: 'num', v: Number(m[2]) });
    else out.push({ t: 'sep' });
  }
  return out;
}

/* One half of a reading: one to three numbers with an optional hemisphere
 * letter on either side. A letter closes the half it trails; a letter that
 * leads opens a new one, which is what keeps "N39 W111" from being read as a
 * single half wearing two hemispheres.
 *
 * `dms` decides whether loose numbers stack into degrees-minutes-seconds or
 * stand as halves of their own, and it is the one genuinely ambiguous call in
 * here: "40 30" is either two decimal degrees or one reading of 40°30'. With no
 * °, no ' and no hemisphere letter anywhere, it is read as two degrees, because
 * that is what people type. */
function coordHalves(tokens, dms) {
  const halves = [];
  let cur = null;
  const close = () => { if (cur) { halves.push(cur); cur = null; } };

  for (const tok of tokens) {
    if (tok.t === 'sep') { close(); continue; }
    if (tok.t === 'letter') {
      if (cur && cur.nums.length && !cur.side) { cur.side = tok.v; close(); }
      else { close(); cur = { side: tok.v, nums: [] }; }
      continue;
    }
    if (!cur) cur = { side: null, nums: [] };
    else if (!dms || cur.nums.length >= 3) { close(); cur = { side: null, nums: [] }; }
    cur.nums.push(tok.v);
  }
  close();
  return halves;
}

/* Degrees, minutes and seconds into one number. Sixty is not a minute: a
 * reading with 61 in it is a typo, not somewhere an hour further on. */
function coordValue({ side, nums }) {
  const [deg, min = 0, sec = 0] = nums;
  if (!Number.isFinite(deg) || min < 0 || sec < 0 || min >= 60 || sec >= 60) return null;
  const size = Math.abs(deg) + min / 60 + sec / 3600;
  const negative = side ? (side === 'S' || side === 'W') : deg < 0;
  return {
    v: negative ? -size : size,
    axis: side ? (side === 'N' || side === 'S' ? 'lat' : 'lng') : null,
  };
}

/* Five places is a shade over a metre — finer than a phone knows about itself,
 * and far finer than anything you can stand on. Trailing zeros go, so a number
 * read off a radio comes back looking like the number read off the radio. */
export function formatCoords(lat, lng) {
  const one = (n) => String(Number(n.toFixed(5)));
  return `${one(lat)}, ${one(lng)}`;
}

/* The whole thing: a string in, { lat, lng, label } or null out. Null is by far
 * the commoner answer and has to stay cheap — this runs on every keystroke. */
export function parseCoords(input) {
  const s = String(input ?? '')
    .toUpperCase()
    .replace(/[º˚∘]/g, '°')
    .replace(/[’‘′]/g, "'")
    .replace(/[”“″]/g, '"')
    .trim();
  if (!s || !COORD_CHARS.test(s)) return null;

  const dms = /['"°NSEW]/.test(s);
  const halves = coordHalves(coordTokens(s), dms);
  if (halves.length !== 2) return null;
  if (!halves[0].nums.length || !halves[1].nums.length) return null;

  const a = coordValue(halves[0]);
  const b = coordValue(halves[1]);
  if (!a || !b) return null;

  // Which number is which. Hemisphere letters say so outright, and two of the
  // same axis is a contradiction rather than a reading. With no letters the
  // order is latitude then longitude, as every map on earth writes it — unless
  // the first one is past the poles, in which case it was pasted longitude
  // first and can be put back the right way round.
  let lat;
  let lng;
  if (a.axis && b.axis) {
    if (a.axis === b.axis) return null;
    lat = a.axis === 'lat' ? a.v : b.v;
    lng = a.axis === 'lng' ? a.v : b.v;
  } else if (a.axis || b.axis) {
    const known = a.axis ? a : b;
    const other = a.axis ? b : a;
    lat = known.axis === 'lat' ? known.v : other.v;
    lng = known.axis === 'lng' ? known.v : other.v;
  } else if (Math.abs(a.v) > 90 && Math.abs(b.v) <= 90) {
    lat = b.v;
    lng = a.v;
  } else {
    lat = a.v;
    lng = b.v;
  }

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng, label: formatCoords(lat, lng) };
}

/* ── the rest of the world ────────────────────────────────────────────────
 * Nominatim: free, keyless, nationwide, and the same OpenStreetMap data the
 * street base map and the trail overlay are already drawn from — so a road you
 * find here is a road you can see on the map underneath.
 *
 * Their usage policy is the reason this module exists rather than a fetch()
 * inlined at the call site: no more than one request a second, no bulk use, and
 * an app has to be identifiable. A browser cannot set a User-Agent, so the
 * Referer does that job; the rest is the app's to honour, and it does — the
 * caller debounces, waits for a real word, and aborts a request the moment the
 * query moves on.
 */
export const GEOCODER = 'https://nominatim.openstreetmap.org/search';

const rad = (d) => (d * Math.PI) / 180;

/* Short enough and it matches half the country, which is a request nobody
 * wanted and an answer nobody can read. */
export const MIN_QUERY = 3;

/* Two searches, and which one runs is the difference between this working and
 * not working.
 *
 * Nominatim is a GEOCODER: for a bare word it ranks administrative areas above
 * everything else, worldwide, by importance. So `rei` unbounded comes back as
 * São João del-Rei in Brazil, Molins de Rei in Catalonia and a peak in Japan —
 * every one of them a better "place named Rei" than a shop, and not one of them
 * what anybody meant. Biasing by viewbox does not save it, because no REI is in
 * the results to be promoted.
 *
 * BOUNDED, it does work: fenced to a box around where you are, there are no
 * towns called Rei to beat the shops, so the shops are what comes back. The
 * cost is that a bounded search cannot find anything outside the fence, which
 * is a real thing to want — you plan a trip to Utah from the sofa in Kentucky.
 *
 * So: bounded first, and only if that comes back empty, ask again without the
 * fence. Usually one request. Two when the near answer does not exist, which is
 * exactly when the second one is worth making.
 */
export function placeSearchUrl(query, { viewbox = null, bounded = false, limit = 12 } = {}) {
  const p = new URLSearchParams({
    q: String(query ?? '').trim(),
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(limit),
  });
  if (viewbox) {
    p.set('viewbox', viewbox.join(','));
    p.set('bounded', bounded ? '1' : '0');
  }
  return `${GEOCODER}?${p.toString()}`;
}

/* ── where you are asking about ───────────────────────────────────────────
 * Three scopes, and they are a real control rather than a guess, because the
 * three questions are genuinely different and no heuristic tells them apart:
 *
 *   near      what is around me — the default, and the one that makes a brand
 *             name work at all.
 *   view      what is inside the piece of ground I am looking at. Pan the map
 *             over a canyon, search "spring", get the springs in that canyon.
 *   anywhere  the whole index, for the trip you have not taken yet.
 */
export const SCOPES = ['near', 'view', 'anywhere'];

export function searchUrlForScope(query, scope, { origin = null, view = null } = {}) {
  if (scope === 'view' && view) {
    return placeSearchUrl(query, { viewbox: view, bounded: true });
  }
  if (scope === 'near' && origin) {
    return placeSearchUrl(query, { viewbox: boxAround(origin), bounded: true });
  }
  // Anywhere, and the fallback for the other two when there is nothing to
  // measure from: still biased by the map if we have it, never fenced.
  return placeSearchUrl(query, { viewbox: view, bounded: false });
}

/* How far out the near search reaches. Far enough to cover the drive you would
 * actually make for a shop or a trailhead, short enough that "rei" is not
 * competing with every town in the country. */
export const NEAR_BOX_KM = 160;

/* A box around a point, in the lon,lat,lon,lat order Nominatim wants. The
 * longitude term is divided by the cosine of the latitude, because a degree of
 * longitude is a different distance at every latitude and a square in degrees
 * is not a square on the ground. */
export function boxAround({ lat, lng }, km = NEAR_BOX_KM) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.max(0.2, Math.cos(rad(lat))));
  return [lng - dLng, lat + dLat, lng + dLng, lat - dLat];
}

/* Nominatim wants the box as lon,lat,lon,lat — the opposite way round from the
 * bounding box it hands back. Written out here so the two conversions sit next
 * to each other and the next person can see they are not the same order. */
export function viewboxFromBounds({ west, north, east, south }) {
  return [west, north, east, south];
}

const COUNTRY = /^(united states|united states of america|usa|us)$/i;
const POSTCODE = /^\d{5}(-\d{4})?$/;

const parts = (displayName) =>
  String(displayName ?? '').split(',').map((s) => s.trim()).filter(Boolean);

export function placeName(displayName) {
  return parts(displayName)[0] || '';
}

/* What is left of the address once the parts nobody needs are gone: the country,
 * because nobody here is searching Peru, and the postcode, which is
 * noise on a forest road. */
export function placeDetail(displayName) {
  return parts(displayName).slice(1)
    .filter((s) => !COUNTRY.test(s) && !POSTCODE.test(s))
    .join(', ');
}

/* "natural=peak" reads as "peak"; "boundary=protected_area" as "protected
 * area". Said in words rather than drawn as an icon on purpose — there is no
 * pictogram for "hamlet" that beats the word, and the app's own rule is words
 * on anything you have to read in a hurry. */
export function placeType(row) {
  const t = row?.type && row.type !== 'yes' ? row.type : row?.category;
  return String(t ?? '').replace(/_/g, ' ');
}

/* Number(null) is 0 and Number('') is 0, and 0,0 is a real place in the Gulf of
 * Guinea. Anything absent has to come back NaN so it is dropped, rather than
 * quietly becoming a result a thousand miles off the coast of Africa. */
const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));

export function normalisePlace(row) {
  const bb = row?.boundingbox;
  const lat = num(row?.lat);
  const lng = num(row?.lon);
  return {
    id: `${row?.osm_type ?? '?'}/${row?.osm_id ?? ''}`,
    /* How big a deal the thing is, 0..1, as the index scores it. A national
     * park is ~0.6 and a shop is ~0.15, which is most of why a search for a
     * brand needs the proximity ranking below and a search for a landmark does
     * not. */
    importance: Number(row?.importance) || 0,
    name: placeName(row?.display_name) || String(row?.name ?? '').trim() || 'unnamed',
    detail: placeDetail(row?.display_name),
    type: placeType(row),
    lat,
    lng,
    /* Nominatim returns [south, north, west, east], as strings. MapLibre wants
     * [[west, south], [east, north]]. Getting this wrong does not throw — it
     * flies the map somewhere confidently wrong, which is worse. */
    bounds: Array.isArray(bb) && bb.length === 4 && bb.every((v) => Number.isFinite(num(v)))
      ? [[num(bb[2]), num(bb[0])], [num(bb[3]), num(bb[1])]]
      : null,
  };
}

export function normalisePlaces(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(normalisePlace)
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

/* ── which answer you actually meant ─────────────────────────────────────
 * Nominatim ranks by importance, which is the right answer for "mammoth cave"
 * and the wrong one for "rei": every shop in the country scores about the same,
 * so what comes back first is whichever one the index happens to like, three
 * states away. What you meant is the one near you.
 *
 * So proximity is added to importance rather than replacing it. The bonus is
 * capped low enough that a national park still outranks a hardware store in the
 * next town, and high enough to decide between things of similar standing —
 * which is exactly the case where distance is the whole question.
 */
export const NEAR_BONUS = 0.35;   // the most being right here can be worth
export const NEAR_HALF  = 40;     // km at which it is worth half of that

const R_EARTH_KM = 6371;

export function kmBetween(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function placeRank(place, from) {
  const importance = Number(place?.importance) || 0;
  if (!from) return importance;
  return importance + NEAR_BONUS / (1 + kmBetween(from, place) / NEAR_HALF);
}

export function rankPlaces(list, from) {
  return [...(list || [])].sort((a, b) => placeRank(b, from) - placeRank(a, from));
}

/* The same shop, the same trailhead, the same creek, three times. Nominatim
 * returns a row per matching OSM object, and a building, its entrance and its
 * address point are three objects with one name in one spot. */
export function dedupePlaces(list) {
  const seen = new Set();
  return (list || []).filter((p) => {
    // Three decimals is about 100 m — close enough to be the same thing, far
    // enough apart to keep two different gates on one road.
    const key = `${normalise(p.name)}|${p.type}|${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* A wilderness area is not a point, and framing it as one drops you in the
 * middle of it at street zoom with no idea how big it is. Anything wider than
 * about a quarter of a mile gets flown to as a box instead. */
export const AREA_DEGREES = 0.004;

export function isArea(place) {
  if (!place?.bounds) return false;
  const [[w, s], [e, n]] = place.bounds;
  return (e - w) > AREA_DEGREES || (n - s) > AREA_DEGREES;
}

/* ── home, and where "near" is measured from ──────────────────────────────
 * A map that opens on the middle of the country is a map you fly out of every
 * time. The phone knows where you are and that always wins — but it is off on
 * the sofa, off indoors, off when the fix has not come in yet, and off for
 * anybody who would rather not be asked. So there is a town you can name, and
 * it does two jobs at once: it is where the map opens, and it is what "near me"
 * means when nothing else can say.
 *
 * The order is not a preference, it is a confidence ranking. Being told where
 * you are beats a town you typed in once; a town you typed in once beats
 * wherever the map happens to be pointing, which might be somewhere you were
 * only looking at.
 */
export function searchOrigin({ here = null, home = null, centre = null } = {}) {
  const at = (p, from) =>
    (p && Number.isFinite(p.lat) && Number.isFinite(p.lng))
      ? { lat: p.lat, lng: p.lng, from }
      : null;
  return at(here, 'you') || at(home, 'home') || at(centre, 'map') || null;
}

/* What gets kept when you pick a town out of the results. Not the whole
 * geocoder row — that is a page of fields nobody will ever read again, and it
 * has to survive in local storage across every future version of this app. */
export function homeFromPlace(pl) {
  if (!pl || !Number.isFinite(pl.lat) || !Number.isFinite(pl.lng)) return null;
  return {
    name: pl.name,
    detail: pl.detail || '',
    lat: pl.lat,
    lng: pl.lng,
    bounds: pl.bounds || null,
  };
}

/* A town is not a point. Framing one as a point at street zoom shows you four
 * blocks and no way to know which four; framing it as its own bounding box
 * shows you the town. The cap is there because some "cities" in the index are
 * a county-sized boundary, and some are a single node with no box at all. */
export const HOME_ZOOM = 11;      // a town, edge to edge, on a phone
export const HOME_MAX_ZOOM = 13;  // as close as a box is allowed to pull you

export function homeCamera(home) {
  if (!home || !Number.isFinite(home.lat) || !Number.isFinite(home.lng)) return null;
  if (isArea(home)) return { bounds: home.bounds, maxZoom: HOME_MAX_ZOOM };
  return { center: [home.lng, home.lat], zoom: HOME_ZOOM };
}
