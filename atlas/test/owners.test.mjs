/* The parts of the ownership lookup that are arithmetic and string-work rather
 * than network. Worth testing for the same reason the tile maths is: the answer
 * is checked in a canyon, where nobody can tell a wrong legal description from
 * a right one, and pasting the wrong forty into an assessor's search returns
 * somebody else's name with no hint that it happened. */

import assert from 'node:assert/strict';
import {
  agencyLabel, accessNote, aliquot, plssLabel, stateFromFips,
  assessorSearchUrl, parcelQueryUrl, readParcel, parcelSiteUrl,
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

console.log(`\n${passed} passed\n`);
