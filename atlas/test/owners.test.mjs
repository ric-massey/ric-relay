/* The parts of the ownership lookup that are arithmetic and string-work rather
 * than network. Worth testing for the same reason the tile maths is: the answer
 * is checked in a canyon, where nobody can tell a wrong legal description from
 * a right one, and pasting the wrong forty into an assessor's search returns
 * somebody else's name with no hint that it happened. */

import assert from 'node:assert/strict';
import {
  agencyLabel, accessNote, aliquot, plssLabel, stateFromFips,
  assessorSearchUrl, parcelQueryUrl, readParcel, parcelSiteUrl,
  serviceSearchUrls, scoreCandidate, rankCandidates, parcelLayers,
  guessFields, coverageScore, discoverParcelSource, stateName,
} from '../owners.js';

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log('  ok  ', name); }
  catch (err) { console.error('  FAIL', name, '\n       ', err.message); process.exitCode = 1; }
};

console.log('\nowners');

/* ── agencies ── */

test('a known agency code becomes a name', () => {
  assert.equal(agencyLabel('BLM'), 'Bureau of Land Management');
  assert.equal(agencyLabel('usfs'), 'US Forest Service');
});

test('an unknown agency falls back to its department, then to itself', () => {
  assert.equal(agencyLabel('XYZ', 'DOI'), 'Department of the Interior');
  assert.equal(agencyLabel('XYZ', 'ZZZ'), 'XYZ');
  assert.equal(agencyLabel(null, null), null);
});

test('private land is never described as open', () => {
  for (const code of ['PVT', 'UND', 'NTVALL', 'NTVPIC', 'ST', 'LG', 'ARMY']) {
    assert.doesNotMatch(accessNote(code) || '', /generally open/, `${code} must not read as open`);
  }
  assert.match(accessNote('BLM'), /generally open/);
});

test('an agency we cannot identify gets no access claim at all', () => {
  assert.equal(accessNote(null), null);
  assert.equal(accessNote(''), null);
});

/* ── the legal description ── */

test('an aliquot becomes the fractions a deed is written in', () => {
  assert.equal(aliquot('NENW'), 'NE¼NW¼');
  assert.equal(aliquot('sw'), 'SW¼');
  assert.equal(aliquot('N2'), 'N½');
  assert.equal(aliquot('N2SE'), 'N½SE¼');
});

test('anything that is not a clean aliquot is handed back untouched', () => {
  assert.equal(aliquot('LOT 3'), 'LOT 3');
  assert.equal(aliquot(''), null);
  assert.equal(aliquot(null), null);
});

test('the real Nevada answer reads the way a survey does', () => {
  // Exactly what the BLM PLSS service returned for -117.0, 39.5.
  assert.equal(plssLabel({
    FRSTDIVNO: '23', TWNSHPNO: '019', TWNSHPDIR: 'N',
    RANGENO: '044', RANGEDIR: 'E', SECDIVNO: 'NENW',
  }), 'NE¼NW¼ Sec. 23 T19N R44E');
});

test('leading zeros are the service\'s, not the surveyor\'s', () => {
  assert.match(plssLabel({ FRSTDIVNO: '06', TWNSHPNO: '007', RANGENO: '003' }), /Sec\. 6 T7 R3/);
});

test('a place with no township and range has no legal description', () => {
  // Texas, Hawai'i and the original colonies were never surveyed into a PLSS
  // grid, so the honest answer is nothing rather than "T R".
  assert.equal(plssLabel({ FRSTDIVNO: '23' }), null);
  assert.equal(plssLabel(null), null);
});

/* ── county and state ── */

test('a FIPS code becomes a state', () => {
  assert.equal(stateFromFips('32'), 'NV');
  assert.equal(stateFromFips(4), 'AZ');       // unpadded, as JSON sometimes gives it
  assert.equal(stateFromFips('99'), null);
});

test('the assessor search names the office, not the coordinates', () => {
  const url = assessorSearchUrl('Lander County', 'NV');
  assert.match(url, /Lander%20County%20NV%20assessor%20parcel%20search/);
  assert.doesNotMatch(url, /\d+\.\d{3}/, 'no coordinates may end up in a search engine URL');
});

/* ── county parcel adapters ── */

const SOURCE = {
  label: 'Example County',
  url: 'https://gis.example.gov/arcgis/rest/services/Parcels/MapServer/0/',
  owner_field: 'OWNER_NAME',
  apn_field: 'PARCEL_ID',
  acres_field: 'ACRES',
};

test('a parcel query is built the way ArcGIS wants a point', () => {
  const url = new URL(parcelQueryUrl(SOURCE, 39.5, -117.0));
  assert.equal(url.pathname, '/arcgis/rest/services/Parcels/MapServer/0/query');
  // lng first. Backwards puts the query in the wrong hemisphere and returns
  // nothing, which looks exactly like "no parcel here".
  assert.equal(url.searchParams.get('geometry'), '-117,39.5');
  assert.equal(url.searchParams.get('inSR'), '4326');
});

test('a source that is not https is refused', () => {
  assert.throws(() => parcelQueryUrl({ ...SOURCE, url: 'http://gis.example.gov/x/0' }), /https/);
  assert.throws(() => parcelQueryUrl({ ...SOURCE, url: 'javascript:alert(1)' }), /https/);
});

test('fields are read by name, and by name in any case', () => {
  assert.equal(readParcel(SOURCE, { OWNER_NAME: 'A Person', PARCEL_ID: '001-23' }).owner, 'A Person');
  assert.equal(readParcel(SOURCE, { owner_name: 'A Person' }).owner, 'A Person');
});

test('acreage arrives as a number or not at all', () => {
  assert.equal(readParcel(SOURCE, { OWNER_NAME: 'X', ACRES: '40.5' }).acres, 40.5);
  assert.equal(readParcel(SOURCE, { OWNER_NAME: 'X', ACRES: 'n/a' }).acres, null);
  assert.equal(readParcel(SOURCE, { OWNER_NAME: 'X' }).acres, null);
});

test('a parcel with nothing in any of the fields is not a parcel', () => {
  assert.equal(readParcel(SOURCE, { SOMETHING_ELSE: 7 }), null);
  assert.equal(readParcel(SOURCE, { OWNER_NAME: '' }), null);
  assert.equal(readParcel(SOURCE, null), null);
});

test('the assessor deep link only exists when it can be filled in', () => {
  const s = { ...SOURCE, site_url: 'https://gis.example.gov/parcel?id={apn}' };
  assert.equal(parcelSiteUrl(s, { apn: '001-23 45' }), 'https://gis.example.gov/parcel?id=001-23%2045');
  assert.equal(parcelSiteUrl(s, { apn: null }), null);
  assert.equal(parcelSiteUrl(SOURCE, { apn: '1' }), null);
  assert.equal(parcelSiteUrl({ ...SOURCE, site_url: 'javascript:alert(1)' }, { apn: '1' }), null);
});


/* ── finding a county's own records ──────────────────────────────────────
 * No real county appears in this file. Rule 1 is that location data does not
 * go in the repo, and a fixture is still a list of the places we look.
 */

test('the catalogue is asked twice: the county, and the state', () => {
  // URLSearchParams spells a space '+', which decodeURIComponent leaves alone.
  const readable = (u) => decodeURIComponent(u).replace(/\+/g, ' ');
  const [byCounty, byState] = serviceSearchUrls('Nowhere', 'MT');
  assert.match(readable(byCounty), /"Nowhere County"/);
  assert.match(readable(byState), /"Montana"/);
  assert.equal(serviceSearchUrls('Nowhere', 'ZZ').length, 1);   // no such state
  assert.equal(stateName('mt'), 'Montana');
});

test("a county's own service outranks a republished national one", () => {
  const own  = { title: 'Nowhere County Parcels', owner: 'NowhereCountyGIS', url: 'https://x/0' };
  const natl = { title: 'Nationwide Parcel Boundaries', owner: 'data_vendor', url: 'https://x/1' };
  assert.ok(scoreCandidate(own, 'Nowhere', 'MT') > scoreCandidate(natl, 'Nowhere', 'MT'));
});

/* The one that actually bites. It is from the right county, it is really
 * parcels, and it carries a lovely OWNERNAME column — it just only contains
 * the ninety-five lots the county itself owns, so everywhere else it answers
 * "nothing here", which reads exactly like the truth. */
test('a partial layer is pushed below the full one it is named like', () => {
  const full    = { title: 'Nowhere County Parcels', owner: 'NowhereCountyGIS', url: 'https://x/0' };
  const partial = { title: 'Nowhere County Owned Parcels', owner: 'NowhereCountyGIS', url: 'https://x/1' };
  assert.ok(scoreCandidate(full, 'Nowhere', 'MT') > scoreCandidate(partial, 'Nowhere', 'MT'));
  for (const t of ['Delinquent Tax Parcels', 'Parcels_2019_not_residential_final', 'Surplus Parcels']) {
    assert.ok(scoreCandidate({ title: t, owner: 'NowhereCountyGIS', url: 'https://x/2' }, 'Nowhere', 'MT')
      < scoreCandidate(full, 'Nowhere', 'MT'), t);
  }
});

test('anything that is not about parcels is not a candidate at all', () => {
  assert.equal(scoreCandidate({ title: 'Nowhere County Zoning', url: 'https://x/0' }, 'Nowhere'), 0);
  assert.equal(rankCandidates([
    { title: 'Nowhere County Parcels', url: 'http://insecure/0' },     // not https
    { title: 'Building Permits', url: 'https://x/1' },
  ], 'Nowhere', 'MT').length, 0);
});

test('the same service listed twice is probed once', () => {
  const item = { title: 'Nowhere County Parcels', owner: 'NowhereCountyGIS' };
  const ranked = rankCandidates([
    { ...item, url: 'https://x/rest/services/P/FeatureServer/0' },
    { ...item, url: 'https://x/rest/services/P/FeatureServer/0/' },   // trailing slash
  ], 'Nowhere', 'MT');
  assert.equal(ranked.length, 1);
});

test('inside a service, the parcel layers are the ones asked', () => {
  const layers = parcelLayers({ layers: [
    { id: 0, name: 'Subdivisions' },
    { id: 1, name: 'Everything', subLayerIds: [0, 2] },   // a group holds nothing
    { id: 2, name: 'Tax Parcels' },
    { id: 3, name: 'Taxlots' },
  ] });
  assert.deepEqual(layers.map((l) => l.id), [2, 3]);
});

/* ── which column is the owner ── */

test('the ordinary spellings of an owner column are all found', () => {
  for (const name of ['OWNER', 'Owner_Name', 'own1', 'DEEDHOLDER', 'TaxpayerName',
                      'sde_COUNTY_PACS_TABLE_Owner_Nam']) {
    assert.equal(guessFields([name]).owner_field, name, name);
  }
});

/* The failure this is here to stop prints a street where a person's name goes
 * and looks entirely plausible doing it. */
test('an owner address is never mistaken for an owner', () => {
  const fields = guessFields(['OWNER_ADDRESS', 'OWNER_CITY', 'OWNER_ZIP', 'MAILADDR']);
  assert.equal(fields.owner_field, null);
  assert.equal(guessFields(['OWNER_NAME', 'OWNER_ADDRESS']).owner_field, 'OWNER_NAME');
  assert.equal(guessFields(['MAILING_ADDRESS', 'SITUS_ADDRESS']).address_field, 'SITUS_ADDRESS');
});

test('a column that is empty in the record we have is outranked, not trusted', () => {
  const names = ['OWNER', 'DEEDHOLDER'];
  assert.equal(guessFields(names, { OWNER: '', DEEDHOLDER: 'A PERSON' }).owner_field, 'DEEDHOLDER');
  // ...but an empty column is still better than none, since plenty of parcels
  // genuinely have nothing on file.
  assert.equal(guessFields(names, { OWNER: '', DEEDHOLDER: '' }).owner_field, 'OWNER');
});

test('parcel numbers, addresses and acreage are picked out too', () => {
  const f = guessFields(['APN', 'SITUS_ADDRESS', 'GIS_ACRES', 'OBJECTID', 'Shape__Area']);
  assert.equal(f.apn_field, 'APN');
  assert.equal(f.address_field, 'SITUS_ADDRESS');
  assert.equal(f.acres_field, 'GIS_ACRES');
  assert.equal(guessFields(['OBJECTID', 'Shape__Area']).apn_field, null);
});

test('coverage is a curve with a ceiling, and nothing at all when unknown', () => {
  assert.equal(coverageScore(null), 0);
  assert.equal(coverageScore(95), 0);                       // the county-owned trap
  assert.ok(coverageScore(80000) > coverageScore(3000));
  assert.equal(coverageScore(5000000), 16);
});

/* ── the whole search, against a stubbed catalogue ── */

const LAYER_FIELDS = [{ name: 'OWNER_NAME' }, { name: 'APN' }, { name: 'ACRES' }];

/* Two counties' worth of fixture: one service whose parcels sit under the pin,
 * and a partial one that only answers about ground 150 m away. */
function stubFetch(log = []) {
  const json = (body) => ({ ok: true, json: async () => body });
  return async (url) => {
    log.push(url);
    if (url.includes('/sharing/rest/search')) {
      return json({ results: [
        { title: 'Nowhere County Owned Parcels', owner: 'NowhereGIS',
          url: 'https://gis.example.gov/rest/services/Owned/FeatureServer/0' },
        { title: 'Nowhere County Parcels', owner: 'NowhereGIS',
          url: 'https://gis.example.gov/rest/services/All/FeatureServer' },
      ] });
    }
    if (url.includes('returnCountOnly')) {
      return json({ count: url.includes('/Owned/') ? 95 : 60000 });
    }
    if (url.includes('/query?')) {
      // The partial layer has nothing under the pin and something near it; the
      // full one answers about the pin itself.
      const near = url.includes('distance=');
      const hit = url.includes('/Owned/') ? near : !near;
      return json({ features: hit
        ? [{ attributes: { OWNER_NAME: 'A PERSON', APN: '001-23', ACRES: 40 } }] : [] });
    }
    if (url.includes('/FeatureServer/0?')) {
      return json({ geometryType: 'esriGeometryPolygon', fields: LAYER_FIELDS });
    }
    return json({ layers: [{ id: 0, name: 'Parcels' }] });
  };
}

const found = await discoverParcelSource('Nowhere', 'MT', 45, -110, { fetchImpl: stubFetch() });

test('the search comes back with a row ready to save', () => {
  assert.equal(found.source.label, 'Nowhere County, MT');
  assert.equal(found.source.owner_field, 'OWNER_NAME');
  assert.equal(found.source.apn_field, 'APN');
  assert.equal(found.source.acres_field, 'ACRES');
  assert.equal(found.source.site_url, null);
});

test('the layer that answers about the pin itself is the one chosen', () => {
  assert.match(found.source.url, /\/All\/FeatureServer\/0$/);
  assert.equal(found.nearby, false);
  assert.equal(found.parcel.owner, 'A PERSON');
  assert.equal(found.count, 60000);
});

test('a catalogue with nothing in it is an ordinary answer, not a crash', async () => {
  const empty = async () => ({ ok: true, json: async () => ({ results: [] }) });
  assert.equal(await discoverParcelSource('Nowhere', 'MT', 45, -110, { fetchImpl: empty }), null);
  const dead = async () => { throw new Error('no signal'); };
  assert.equal(await discoverParcelSource('Nowhere', 'MT', 45, -110, { fetchImpl: dead }), null);
});

test('a service that says no in a 200 body is treated as a no', async () => {
  const tokenWall = async (url) => ({ ok: true, json: async () =>
    url.includes('/sharing/rest/search')
      ? { results: [{ title: 'Nowhere County Parcels', owner: 'NowhereGIS',
                      url: 'https://gis.example.gov/rest/services/All/FeatureServer/0' }] }
      : { error: { code: 499, message: 'Token Required' } } });
  assert.equal(await discoverParcelSource('Nowhere', 'MT', 45, -110, { fetchImpl: tokenWall }), null);
});

console.log(`\n${passed} passed\n`);
