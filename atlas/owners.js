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

/* ── finding the county's records for yourself ───────────────────────────
 * Everything above works anywhere in the country, free, with no key. The one
 * thing it cannot do from a national source is put a NAME on private ground,
 * because names live with county assessors and every county publishes its own
 * way. The answer to that was always "add an adapter for the county" — a layer
 * URL and four field names, typed into a form.
 *
 * Which is a fine answer at a desk and a useless one at a gate. So this goes
 * and looks. Counties overwhelmingly publish through ArcGIS, ArcGIS Online has
 * a public catalogue, and a service either answers a point query with the
 * parcel you are standing in or it does not. That last part is what makes this
 * honest rather than clever: nothing is guessed from a name and hoped for. A
 * candidate is only accepted when it has been asked about THIS point and has
 * come back with a parcel.
 *
 * What comes out the other end is a parcel_sources row, ready to save, so the
 * next person to stand somewhere in that county gets the name immediately and
 * offline afterwards. The search is the one-off; the row is the point.
 */

const AGOL_SEARCH = 'https://www.arcgis.com/sharing/rest/search';

/* Fixed federal table, same as STATE_FIPS above and for the same reason: the
 * catalogue is searched by words, and a statewide parcel service is titled
 * "Montana", never "MT". No places of ours in here. */
export const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', AS: 'American Samoa',
  GU: 'Guam', MP: 'Northern Mariana Islands', PR: 'Puerto Rico',
  VI: 'Virgin Islands',
};

export const stateName = (abbr) => STATE_NAMES[String(abbr || '').toUpperCase()] || null;

/* Two searches, not one. The county's own GIS office is the usual publisher,
 * but a dozen states run a single statewide parcel layer that is better
 * maintained than any of their counties' — and a query naming the county will
 * never find it. Both sets go into the same pile and the probe sorts them out.
 *
 * The catalogue's bbox filter was tried here and does nothing useful: the same
 * Ohio and Florida services come back for a point in Kansas and a point in
 * Colorado. The words are the filter; the point query is the proof. */
export function serviceSearchUrls(county, state, { num = 12 } = {}) {
  const kinds = '(type:"Feature Service" OR type:"Map Service")';
  const terms = [];
  if (county) terms.push(`(parcels OR "land records") AND "${county} County" AND ${kinds}`);
  const sn = stateName(state);
  if (sn) terms.push(`parcels AND "${sn}" AND statewide AND ${kinds}`);

  return terms.map((q) => {
    const params = new URLSearchParams({ q, f: 'json', num: String(num) });
    return `${AGOL_SEARCH}?${params}`;
  });
}

/* Reading a catalogue entry: does this look like a county's own parcel service,
 * or like the fiftieth copy of a national dataset someone republished. Only a
 * shortlist for probing — being wrong here costs one request, and the point
 * query is what actually decides. */
const GOOD_TITLE = /\bparcel|\btax ?lot|cadastr|land ?record|\bownership/i;
const BAD_TITLE  =
  /nationwide|national|\bUSA\b|regrid|permit|zoning|right[- ]of[- ]way|\bROW\b|survey|legend|sample|test|draft|training|extraction|deprecated|archive/i;

/* A different and nastier kind of wrong. These are real parcel layers from the
 * real county, with the right fields and plausible names — they just only
 * contain SOME of the parcels: the ones the county itself owns, the ones behind
 * on their taxes, the ones that are not houses. Asked about a place they do not
 * cover they answer nothing at all, which reads exactly like "no parcel here"
 * and is a lie. Worth pushing down hard; there is nearly always a full layer
 * from the same office sitting next to it. */
const PARTIAL_TITLE =
  /\b(county|city|state|federally|publicly)[- ]owned|surplus|delinquent|tax ?sale|foreclos|abandoned|vacant|landfill|supplemental|not_|_final\b|\b(19|20)\d\d\b/i;

export function scoreCandidate(item, county, state) {
  const title = String(item?.title || '');
  const publisher = `${item?.owner || ''} ${item?.orgId || ''}`;
  if (!GOOD_TITLE.test(title)) return 0;

  let score = 10;
  if (BAD_TITLE.test(title)) score -= 12;
  if (PARTIAL_TITLE.test(title)) score -= 20;

  const c = String(county || '').toLowerCase();
  const sn = String(stateName(state) || '').toLowerCase();
  const squash = (s) => s.toLowerCase().replace(/[^a-z]/g, '');

  if (c && title.toLowerCase().includes(c)) score += 14;
  if (c && squash(publisher).includes(squash(c))) score += 12;
  if (sn && title.toLowerCase().includes(sn)) score += 6;
  if (sn && squash(publisher).includes(squash(sn))) score += 4;
  if (/assessor|appraisal|county|parish|borough/i.test(publisher)) score += 4;
  if (/\bparcel/i.test(title)) score += 3;

  return score;
}

export function rankCandidates(results, county, state, { keep = 8 } = {}) {
  return (results || [])
    .filter((r) => r?.url && /^https:\/\//i.test(r.url))
    .map((r) => ({ title: r.title, url: r.url.replace(/\/+$/, ''), owner: r.owner,
                   score: scoreCandidate(r, county, state) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .filter((r, i, all) => all.findIndex((x) => x.url === r.url) === i)
    .slice(0, keep);
}

/* Which layers inside a service are worth asking. A county service is usually
 * a stack — subdivisions, lots, zoning, parcels — and only some of it answers
 * the question. */
export function parcelLayers(service, { keep = 2 } = {}) {
  return (service?.layers || [])
    .filter((l) => GOOD_TITLE.test(String(l.name || '')))
    .filter((l) => !l.subLayerIds)                 // group layers hold nothing
    .sort((a, b) => Number(/\bparcel/i.test(b.name)) - Number(/\bparcel/i.test(a.name)))
    .slice(0, keep);
}

/* ── which field is the owner ────────────────────────────────────────────
 * Counties name their columns anything: OWNER, own1, DEEDHOLDER, NAME1. What
 * makes this safe rather than a guess is the NEVER list. Matching OWNER_ADDRESS
 * as the owner would print a street as somebody's name and look completely
 * plausible doing it, so a field that fails a never-rule is out, however well
 * it scores otherwise.
 */
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const FIELD_RULES = {
  owner_field: {
    exact: ['OWNER', 'OWNERNAME', 'OWNERNAME1', 'OWNER1', 'OWN1', 'OWNNAME',
            'OWNERNM', 'OWNERS', 'OWNERFULLNAME', 'CURRENTOWNER', 'DEEDHOLDER',
            'TAXPAYER', 'TAXPAYERNAME', 'PROPERTYOWNER', 'NAMEOWNER', 'GRANTEE',
            'OWNERNAMES', 'OWNER_NAME1', 'NAME1', 'OWNERFIRST'],
    like:  [/^OWN/, /OWNER/, /TAXPAYER/, /DEEDHOLDER/],
    never: [/ADDR/, /MAIL/, /CITY/, /STATE/, /ZIP/, /PHONE/, /CODE/, /TYPE/,
            /DATE/, /PERCENT|^PCT/, /OCCUP/, /^OWNERID$/, /COUNT$/],
  },
  apn_field: {
    exact: ['APN', 'PIN', 'PARCELID', 'PARCELNO', 'PARCELNUM', 'PARCELNUMBER',
            'PARCELPIN', 'PARID', 'PARCEL', 'TAXID', 'TAXPIN', 'TAXPARCELID',
            'ACCOUNT', 'ACCOUNTNO', 'PROPID', 'PROPERTYID', 'AIN', 'PIDN',
            'PID', 'STATEPARCELID', 'GEOID', 'PARCELIDNO'],
    like:  [/^APN/, /PARCEL.*(ID|NO|NUM|PIN)/, /^PIN/, /TAX.*(ID|PIN)/],
    never: [/OWNER/, /ADDR/, /OBJECTID/, /SHAPE/, /GLOBALID/],
  },
  address_field: {
    exact: ['SITEADDRESS', 'SITUSADDRESS', 'SITUSADDR', 'SITEADDR',
            'PROPERTYADDRESS', 'PROPADDRESS', 'PROPADDR', 'PHYSICALADDRESS',
            'FULLADDRESS', 'STREETADDRESS', 'ADDRESS', 'ADDR', 'SITUS',
            'SITEADDRESSFULL', 'LOCATION'],
    like:  [/SITUS/, /SITE.*ADDR/, /PROP.*ADDR/, /^ADDR/, /ADDRESS/],
    never: [/MAIL/, /OWNER/, /CITY/, /ZIP/, /STATE/, /^ADDRESSID/],
  },
  acres_field: {
    exact: ['ACRES', 'ACREAGE', 'GISACRES', 'CALCACRES', 'CALCULATEDACRES',
            'DEEDACRES', 'LEGALACRES', 'TOTALACRES', 'ACRESGIS', 'PARCELACRES',
            'SHAPEACRES', 'ACRESCALC'],
    like:  [/ACRE/],
    never: [/BLDG|BUILDING/, /PRICE|VALUE/],
  },
};

/* Names alone, or names weighed against a real record from the layer. The
 * sample matters: half these services carry an OWNER column that every row
 * leaves blank, and a blank column beaming out as the answer is worse than
 * admitting there is no name here. */
export function guessFields(fieldNames, sample = null) {
  const names = Array.isArray(fieldNames) ? fieldNames
    : Object.keys(fieldNames || {});
  const out = {};

  for (const [role, rule] of Object.entries(FIELD_RULES)) {
    let best = null;
    for (const name of names) {
      const key = norm(name);
      if (!key) continue;
      if (rule.never.some((re) => re.test(key))) continue;

      let score = 0;
      const exact = rule.exact.map(norm).indexOf(key);
      if (exact >= 0) score = 100 - exact;
      else {
        const like = rule.like.findIndex((re) => re.test(key));
        if (like >= 0) score = 50 - like;
      }
      if (!score) continue;

      if (sample) {
        const v = sample[name];
        // A column that is empty in the one record we have is not disqualified,
        // only outranked — some parcels genuinely have no address on file.
        score += (v == null || v === '' || v === ' ') ? -20 : 5;
      }
      if (!best || score > best.score) best = { name, score };
    }
    out[role] = best && best.score > 0 ? best.name : null;
  }
  return out;
}

/* ── the search itself ───────────────────────────────────────────────────── */

async function getJson(url, timeout, fetchImpl) {
  const doFetch = fetchImpl || fetch;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await doFetch(url, { signal: ctl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.error ? null : data;          // ArcGIS says no in a 200 body
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* A layer, asked about one point. Optionally with a few metres of slack, which
 * is not sloppiness — it is how you tell "this service does not cover here"
 * apart from "you are standing in the middle of the road", and the road is
 * where people stand when they stop to check. A buffered answer is used to
 * confirm the SERVICE, never to name an owner. */
function layerQueryUrl(layerUrl, lat, lng, metres = 0) {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
    resultRecordCount: '1',
    f: 'json',
  });
  if (metres) {
    params.set('distance', String(metres));
    params.set('units', 'esriSRUnit_Meter');
  }
  return `${layerUrl}/query?${params}`;
}

/* How many parcels the layer holds at all. One cheap request, and the single
 * most useful thing you can know about a candidate: the county's real parcel
 * fabric has tens or hundreds of thousands of rows in it, and the layer of
 * county-owned lots that is named almost identically and carries a beautiful
 * OWNERNAME column has ninety-five. Measured, not guessed — the alternative is
 * saving the ninety-five and having ATLAS answer "no parcel here" for the rest
 * of the county forever, which is indistinguishable from the truth. */
async function layerCount(layerUrl, timeout, fetchImpl) {
  const data = await getJson(
    `${layerUrl}/query?where=1%3D1&returnCountOnly=true&f=json`, timeout, fetchImpl);
  const n = Number(data?.count);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* Rows, on a curve, capped. The gap that matters is between hundreds and tens
 * of thousands; past that, bigger is not better and a county with a million
 * parcels should not outrank one doing its job with eighty thousand. */
export function coverageScore(count) {
  if (!count) return 0;
  return Math.min(16, Math.max(0, (Math.log10(count) - 2) * 6));
}

/* Everything a probe found out about one layer, or null if it is not one.
 * `nearby` means the layer holds parcels around here but not under this exact
 * point — good enough to save the county, not good enough to name anybody. */
async function probeLayer(layerUrl, label, lat, lng, timeout, fetchImpl) {
  const meta = await getJson(`${layerUrl}?f=json`, timeout, fetchImpl);
  if (!meta || meta.type === 'Table' || !/Polygon/i.test(meta.geometryType || '')) return null;

  const names = (meta.fields || []).map((f) => f.name);
  if (!names.length) return null;

  let hit = await getJson(layerQueryUrl(layerUrl, lat, lng), timeout, fetchImpl);
  let attrs = hit?.features?.[0]?.attributes || null;
  let nearby = false;

  if (!attrs) {
    hit = await getJson(layerQueryUrl(layerUrl, lat, lng, 150), timeout, fetchImpl);
    attrs = hit?.features?.[0]?.attributes || null;
    nearby = !!attrs;
  }
  if (!attrs) return null;

  const fields = guessFields(names, attrs);
  if (!fields.owner_field && !fields.apn_field) return null;

  const source = { url: layerUrl, ...fields, site_url: null };
  const parcel = nearby ? null : readParcel({ ...source, label }, attrs);

  // Only now, once the layer has proved it holds parcels around here. A
  // candidate that failed above never costs anybody this request.
  const count = await layerCount(layerUrl, timeout, fetchImpl);

  return {
    layerUrl, label, fields, nearby, attrs, parcel, count,
    // An owner's name on the ground you are standing on is the whole point.
    // Answering about this exact point at all comes next and it is worth more
    // than it looks: the partial layers — county-owned, delinquent, everything
    // that is not a house — are precisely the ones that come back empty here.
    rank: (parcel?.owner ? 40 : 0) + (parcel?.apn ? 15 : 0)
        + (nearby ? 0 : 12) + (fields.owner_field ? 6 : 0)
        + coverageScore(count),
  };
}

/* Half the catalogue points at a service and half points straight at one layer
 * inside it — .../MapServer/3 is a perfectly ordinary item URL. Appending
 * ?f=json to a layer gets you a layer, which has no `layers` array, so treating
 * everything as a service silently skipped the best answers: it was the county
 * assessor's own layer that got dropped, every time, while some republished
 * fragment three places down the list got saved instead. */
const IS_LAYER_URL = /\/\d+$/;

async function probeService(cand, lat, lng, timeout, fetchImpl) {
  if (IS_LAYER_URL.test(cand.url)) {
    const probe = await probeLayer(cand.url, cand.title, lat, lng, timeout, fetchImpl);
    return probe ? [{ ...probe, candidate: cand }] : [];
  }

  const service = await getJson(`${cand.url}?f=json`, timeout, fetchImpl);
  if (!service) return [];

  const layers = parcelLayers(service);
  // A county's own service often names its layers for the office rather than
  // for the data — "CountyOwnerParcel_shp" says parcel, "Assessor_2024" does
  // not. When nothing matches by name, ask the first couple anyway; the point
  // query is cheap and it is the thing that actually decides.
  const list = layers.length ? layers
    : (service.layers || []).slice(0, 2);

  const found = [];
  for (const layer of list) {
    const probe = await probeLayer(`${cand.url}/${layer.id}`, cand.title, lat, lng, timeout, fetchImpl);
    if (probe) found.push({ ...probe, candidate: cand });
    if (probe?.parcel?.owner) break;             // no reason to keep asking
  }
  return found;
}

/* Go and find the county. Returns a parcel_sources row ready to be saved, plus
 * whatever it read at this point so the app can show its working — or null,
 * which is a perfectly ordinary answer and the reason the manual form stays.
 */
export async function discoverParcelSource(county, state, lat, lng, {
  timeout = 12000, fetchImpl = null, maxServices = 5,
} = {}) {
  const searches = await Promise.all(
    serviceSearchUrls(county, state).map((u) => getJson(u, timeout, fetchImpl)));

  const results = searches.flatMap((s) => s?.results || []);
  const candidates = rankCandidates(results, county, state).slice(0, maxServices);
  if (!candidates.length) return null;

  let best = null;
  // Three at a time. All at once is a dozen requests off a phone on one bar for
  // answers that are usually settled by the first three; one at a time is a
  // minute of standing there watching a spinner.
  for (let i = 0; i < candidates.length; i += 3) {
    const batch = await Promise.all(candidates.slice(i, i + 3)
      .map((c) => probeService(c, lat, lng, timeout, fetchImpl)));

    for (const probe of batch.flat()) {
      if (!best || probe.rank > best.rank) best = probe;
    }
    if (best?.parcel?.owner) break;
  }
  if (!best) return null;

  const label = county
    ? `${county} County, ${state || ''}`.replace(/,\s*$/, '')
    : best.label;

  return {
    source: {
      label,
      url: best.layerUrl,
      owner_field:   best.fields.owner_field,
      apn_field:     best.fields.apn_field,
      address_field: best.fields.address_field,
      acres_field:   best.fields.acres_field,
      site_url: null,
    },
    parcel: best.parcel,
    service: best.candidate.title,
    nearby: best.nearby,
    count: best.count,
  };
}
