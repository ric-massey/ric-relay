/* ATLAS — who owns the ground you are standing on.
 *
 * The property-lines overlay draws the boundary. This answers the question the
 * boundary raises: whose is it, and do I need to ask anyone.
 *
 * There is no free nationwide source for an owner's NAME — that was checked and
 * it is still true. What there is, free and keyless and everywhere, is enough to
 * answer the question that actually matters out there:
 *
 *   1. Surface management agency (BLM's national SMA layer). BLM, forest, park,
 *      state, tribal, military, private. For most places worth pinning this IS
 *      the answer, and it is the one that decides whether you can walk in.
 *   2. The legal description (BLM's PLSS survey grid) — section, township,
 *      range, and the forty you are standing in. This is the string every rural
 *      assessor's office searches on, so it turns "who owns it" from a dead end
 *      into a lookup you can actually do.
 *   3. County and state (Census TIGERweb) — which office that is.
 *
 * A NAME needs the county assessor, and every county publishes differently.
 * Most of them run ArcGIS, so one generic adapter covers them: a URL and the
 * names of four fields. Those adapters live in the DATABASE, not in this repo —
 * see the parcel_sources migration. Which counties the crew looks things up in
 * is location data, and rule 1 says location data does not go in git.
 *
 * PAD-US was tried for richer unit names and rejected: the public ArcGIS
 * service is on a shared 60-requests-per-minute quota that is already exhausted
 * by other people, so it answers 429 more often than not. A source that fails
 * most of the time is worse than one you never call.
 */

/* ── the vocabulary ──────────────────────────────────────────────────────
 * Every ADMIN_AGENCY_CODE the SMA layer actually contains, checked against a
 * distinct-values query rather than guessed. Anything unlisted falls through as
 * itself, so a new code shows up as a code rather than as nothing.
 */
export const AGENCIES = {
  BLM:    'Bureau of Land Management',
  USFS:   'US Forest Service',
  NPS:    'National Park Service',
  FWS:    'US Fish and Wildlife Service',
  USBR:   'Bureau of Reclamation',
  BIA:    'Bureau of Indian Affairs',
  DOI:    'Department of the Interior',
  USDA:   'Department of Agriculture',
  DOD:    'Department of Defense',
  ARMY:   'US Army',
  NAVY:   'US Navy',
  USAF:   'US Air Force',
  USMC:   'US Marine Corps',
  USACE:  'Army Corps of Engineers',
  USCG:   'US Coast Guard',
  DOE:    'Department of Energy',
  BPA:    'Bonneville Power Administration',
  NOAA:   'NOAA',
  BOP:    'Bureau of Prisons',
  DOT:    'Department of Transportation',
  FAA:    'FAA',
  HHS:    'Health and Human Services',
  FHA:    'Federal Housing Administration',
  GSA:    'General Services Administration',
  USPS:   'US Postal Service',
  VA:     'Veterans Affairs',
  OTHFE:  'another federal agency',
  ST:     'State land',
  LG:     'City, county or other local government',
  NTVALL: 'Native allotment',
  NTVPIC: 'Tribal land',
  PVT:    'Private land',
  UND:    'Private or unrecorded',
};

/* Public federal land you can generally walk onto, versus the kind you cannot.
 * Deliberately conservative: this decides whether ATLAS says "open" out loud,
 * and being wrong in the reassuring direction is the bad way to be wrong. */
const OPEN_ACCESS = new Set(['BLM', 'USFS']);
const ASK_FIRST   = new Set(['PVT', 'UND', 'NTVALL', 'NTVPIC', 'ST', 'LG']);

export function agencyLabel(code, dept) {
  const c = String(code || '').toUpperCase();
  if (AGENCIES[c]) return AGENCIES[c];
  const d = String(dept || '').toUpperCase();
  if (AGENCIES[d]) return AGENCIES[d];
  return c || null;
}

/* One short line of guidance, or nothing. Silence is a valid answer here — the
 * agency name above it already carries the information for anyone who knows,
 * and a confident sentence about access on land we cannot identify is worse
 * than no sentence at all. */
export function accessNote(code) {
  const c = String(code || '').toUpperCase();
  if (OPEN_ACCESS.has(c)) return 'generally open to the public';
  if (c === 'NPS')  return 'park rules apply — check the unit';
  if (c === 'PVT' || c === 'UND') return 'private — you need permission';
  if (c === 'NTVALL' || c === 'NTVPIC') return 'tribal land — permission comes from the nation';
  if (ASK_FIRST.has(c)) return 'ask before you go in';
  if (c) return 'restricted — this is not open ground';
  return null;
}

/* ── the legal description ───────────────────────────────────────────────
 * "NE¼NW¼ Sec. 23, T19N R44E, Mount Diablo Meridian" — the string an assessor's
 * office searches on. Only the PLSS states have one; the original colonies,
 * Texas and Hawai'i were never surveyed this way, so this returns null there
 * rather than inventing something.
 */

const ORDINAL = { N: 'N', S: 'S', E: 'E', W: 'W' };

/* "NENW" → "NE¼NW¼", "N2" → "N½". Anything that isn't a clean aliquot string
 * (government lots, odd surveys) is handed back untouched. */
export function aliquot(code) {
  const s = String(code || '').toUpperCase().trim();
  if (!s) return null;
  if (!/^([NS][EW]|[NSEW]2)+$/.test(s)) return s;
  const parts = s.match(/[NS][EW]|[NSEW]2/g) || [];
  return parts.map((p) => (p[1] === '2' ? `${ORDINAL[p[0]]}½` : `${p}¼`)).join('');
}

const trimZeros = (n) => String(n || '').replace(/^0+(?=\d)/, '');

export function plssLabel(a) {
  if (!a) return null;
  const section  = trimZeros(a.FRSTDIVNO);
  const township = trimZeros(a.TWNSHPNO);
  const range    = trimZeros(a.RANGENO);
  if (!township || !range) return null;

  const grid = `T${township}${a.TWNSHPDIR || ''} R${range}${a.RANGEDIR || ''}`;
  const part = aliquot(a.SECDIVNO || a.QQSEC || a.QSEC);
  const sec  = section ? `Sec. ${section}` : null;

  return [part, sec, grid].filter(Boolean).join(' ');
}

/* ── county and state ────────────────────────────────────────────────────
 * TIGERweb answers with a FIPS code and the county's name. The state has to be
 * turned back into letters here — a fixed federal table, no places in it.
 */
export const STATE_FIPS = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO',
  '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI',
  '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY', '60': 'AS', '66': 'GU', '69': 'MP',
  '72': 'PR', '78': 'VI',
};

export const stateFromFips = (fips) => STATE_FIPS[String(fips || '').padStart(2, '0')] || null;

/* No adapter for this county yet? Then the useful thing is not an error, it is
 * the search that finds the office — every assessor is one query away, and the
 * legal description above is already on screen to paste in. */
export function assessorSearchUrl(county, state) {
  const q = [county, state, 'assessor parcel search'].filter(Boolean).join(' ');
  return `https://duckduckgo.com/?q=${encodeURIComponent(q)}`;
}

/* ── county parcel adapters ──────────────────────────────────────────────
 * A source is: an ArcGIS layer URL that answers point queries, plus the names
 * of the fields that hold the owner, the parcel number, the address and the
 * acreage. That covers most county GIS sites, because most of them are ArcGIS.
 */

export function parcelQueryUrl(source, lat, lng) {
  const base = String(source.url || '').replace(/\/+$/, '');
  // These get fetched by the crew's own browsers from whatever someone typed
  // into the sources form. https only — no plain-text queries about where
  // anyone is standing, and nothing that isn't a web address at all.
  if (!/^https:\/\//i.test(base)) throw new Error('parcel source must be an https URL');
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
    f: 'json',
  });
  return `${base}/query?${params}`;
}

/* Field names on county services are all over the place — OWNER, Owner_Name,
 * own1. Look for exactly what was configured, then for the same thing in any
 * case, so a source configured with the wrong capitalisation still works. */
function pick(attrs, field) {
  if (!field || !attrs) return null;
  if (attrs[field] != null && attrs[field] !== '') return attrs[field];
  const want = String(field).toLowerCase();
  for (const [k, v] of Object.entries(attrs)) {
    if (k.toLowerCase() === want && v != null && v !== '') return v;
  }
  return null;
}

export function readParcel(source, attrs) {
  if (!attrs) return null;
  const acres = pick(attrs, source.acres_field);
  const out = {
    label:   source.label || null,
    owner:   pick(attrs, source.owner_field),
    apn:     pick(attrs, source.apn_field),
    address: pick(attrs, source.address_field),
    acres:   acres == null ? null : Number(acres),
  };
  if (out.acres != null && !Number.isFinite(out.acres)) out.acres = null;
  return (out.owner || out.apn || out.address) ? out : null;
}

/* The county's own page for this parcel, when the source knows the shape of it.
 * {apn} is substituted; anything else is left alone. */
export function parcelSiteUrl(source, parcel) {
  const tmpl = source?.site_url;
  if (!tmpl || !/^https:\/\//i.test(tmpl)) return null;
  if (!tmpl.includes('{apn}')) return tmpl;
  if (!parcel?.apn) return null;
  return tmpl.replace('{apn}', encodeURIComponent(String(parcel.apn)));
}

/* ── asking ──────────────────────────────────────────────────────────────── */

const SMA_URL =
  'https://gis.blm.gov/arcgis/rest/services/lands/BLM_Natl_SMA_Cached_with_PriUnk/MapServer/1/query';
const PLSS_URL =
  'https://gis.blm.gov/arcgis/rest/services/Cadastral/BLM_Natl_PLSS_CadNSDI/MapServer/3/query';
const COUNTY_URL =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query';

function esriPointQuery(base, lat, lng, outFields) {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields,
    returnGeometry: 'false',
    f: 'json',
  });
  return `${base}?${params}`;
}

/* One request, with a deadline. Out here a request that never finishes is the
 * same as one that failed, except it also holds the spinner forever. */
async function askEsri(url, timeout) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    // ArcGIS answers errors with HTTP 200 and an error object in the body.
    if (data.error) return null;
    return data.features?.[0]?.attributes || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* Everything at once. Each source can fail on its own without taking the others
 * down — a county with no PLSS survey still gets an agency and a county name. */
export async function lookup(lat, lng, { sources = [], timeout = 12000 } = {}) {
  const [sma, plss, county] = await Promise.all([
    askEsri(esriPointQuery(SMA_URL, lat, lng,
      'ADMIN_UNIT_NAME,ADMIN_UNIT_TYPE,ADMIN_AGENCY_CODE,ADMIN_DEPT_CODE,ADMIN_ST'), timeout),
    askEsri(esriPointQuery(PLSS_URL, lat, lng,
      'FRSTDIVNO,TWNSHPNO,TWNSHPDIR,RANGENO,RANGEDIR,PRINMER,SECDIVNO,QSEC,QQSEC,RECRDAREATX'), timeout),
    askEsri(esriPointQuery(COUNTY_URL, lat, lng, 'BASENAME,NAME,STATE,GEOID'), timeout),
  ]);

  const usable = sources.filter((s) => s.enabled !== false && /^https:\/\//i.test(s.url || ''));
  const tried = await Promise.all(usable.map(async (s) => {
    try {
      const attrs = await askEsri(parcelQueryUrl(s, lat, lng), timeout);
      const parcel = readParcel(s, attrs);
      return parcel ? { ...parcel, source: s } : null;
    } catch {
      return null;
    }
  }));

  const agency = sma?.ADMIN_AGENCY_CODE || null;

  return {
    at: Date.now(),
    agency,
    agencyName: agencyLabel(agency, sma?.ADMIN_DEPT_CODE),
    unit: sma?.ADMIN_UNIT_NAME && sma.ADMIN_UNIT_NAME !== 'Undetermined'
      ? sma.ADMIN_UNIT_NAME : null,
    unitType: sma?.ADMIN_UNIT_TYPE && sma.ADMIN_UNIT_TYPE !== 'None'
      ? sma.ADMIN_UNIT_TYPE : null,
    access: accessNote(agency),
    legal: plssLabel(plss),
    meridian: plss?.PRINMER || null,
    aliquotArea: plss?.RECRDAREATX || null,
    county: county?.NAME || null,
    state: stateFromFips(county?.STATE),
    parcel: tried.find(Boolean) || null,
  };
}
