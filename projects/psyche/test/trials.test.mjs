/* The Studies page's client rules — node projects/psyche/test/trials.test.mjs
   No network: the API is a fixture. What is asserted is what the page and the
   front door both depend on — the search turning into the right parameters,
   a record flattening the same way every time, and what counts as a change. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = require('../trials.js');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };

console.log('\nRULE  a search becomes the parameters the v2 API expects');
{
  const p = T.buildParams({ q: ' psilocybin ', status: ['recruiting', 'stopped'], phase: ['2', '3'], results: true, country: 'Canada', sort: 'updated' });
  ok(p.get('query.term') === 'psilocybin', 'the box is query.term, trimmed');
  ok(p.get('filter.overallStatus') === 'RECRUITING,TERMINATED,SUSPENDED,WITHDRAWN', 'status chips expand to API statuses');
  ok(p.get('aggFilters') === 'phase:2 3,results:with', 'phase and results go in aggFilters');
  ok(p.get('query.locn') === 'Canada', 'a country is a location query');
  ok(p.get('sort') === 'LastUpdatePostDate:desc', 'a sort is passed by field');
  ok(p.get('countTotal') === 'true' && !p.get('pageToken'), 'the first page asks for a total');
  ok(p.get('fields') === T.LIST_FIELDS, 'and only the fields a card needs');

  const next = T.buildParams({ q: 'x', scope: 'intr' }, { pageToken: 'abc', fields: false });
  ok(next.get('query.intr') === 'x' && !next.get('query.term'), 'a scope moves the box to its own parameter');
  ok(next.get('pageToken') === 'abc' && !next.get('countTotal'), 'later pages carry the token and skip the count');
  ok(!next.get('fields'), 'fields can be left off');
  ok(!T.buildParams({}).get('sort'), 'best match sends no sort');
}

console.log('\nRULE  NCT numbers are recognised however they are typed');
ok(T.asNct('nct01234567') === 'NCT01234567', 'lower case');
ok(T.asNct(' NCT 01234567 ') === 'NCT01234567', 'with a space');
ok(T.asNct('NCT0123456') === null && T.asNct('ketamine') === null, 'and not anything else');

const FIXTURE = {
  hasResults: true,
  protocolSection: {
    identificationModule: { nctId: 'NCT01234567', briefTitle: 'Psilocybin for Treatment-Resistant Depression', acronym: 'PSI-D' },
    statusModule: {
      overallStatus: 'COMPLETED',
      startDateStruct: { date: '2021-03', type: 'ACTUAL' },
      primaryCompletionDateStruct: { date: '2023-11-30', type: 'ACTUAL' },
      completionDateStruct: { date: '2024-02', type: 'ESTIMATED' },
      resultsFirstPostDateStruct: { date: '2024-06-12' },
      lastUpdatePostDateStruct: { date: '2024-07-01' }
    },
    designModule: { studyType: 'INTERVENTIONAL', phases: ['PHASE2', 'PHASE3'], enrollmentInfo: { count: 233, type: 'ACTUAL' } },
    conditionsModule: { conditions: ['Depression'] },
    armsInterventionsModule: { interventions: [{ type: 'DRUG', name: 'Psilocybin' }] },
    sponsorCollaboratorsModule: { leadSponsor: { name: 'Example University' } },
    contactsLocationsModule: { locations: [
      { facility: 'A', city: 'Boston', country: 'United States', geoPoint: { lat: 1, lon: 2 } },
      { facility: 'B', city: 'Toronto', country: 'Canada' },
      { facility: 'C', city: 'Chicago', country: 'United States' }
    ] },
    eligibilityModule: { eligibilityCriteria: 'Inclusion Criteria:\n\n* Adults', sex: 'ALL', minimumAge: '18 Years', healthyVolunteers: false }
  }
};

console.log('\nRULE  a record flattens into what a card draws');
{
  const n = T.normalize(FIXTURE);
  ok(n.id === 'NCT01234567' && n.title.startsWith('Psilocybin'), 'id and title');
  ok(n.status === 'COMPLETED' && n.hasResults === true, 'status and results');
  ok(T.phaseText(n.phases) === 'Phase 2/3', 'a combined phase reads as one');
  ok(n.enrollment === 233 && n.sponsor === 'Example University', 'enrollment and sponsor');
  ok(n.locations.length === 3 && !('geoPoint' in n.locations[0]), 'sites are kept without their coordinates');
  ok(T.placeSummary(n.locations) === 'Boston, United States · +2 more sites in 2 countries', 'places summarise');
  ok(T.placeSummary(n.locations, 'canada').startsWith('Toronto, Canada'), 'the searched-for country leads');
  ok(n.url === 'https://clinicaltrials.gov/study/NCT01234567', 'the official page is linked');
  ok(T.fmtDate('2023-11-30') === 'Nov 30, 2023' && T.fmtDate('2024-02', 'ESTIMATED') === 'Feb 2024 (est.)', 'dates read like dates');
  const empty = T.normalize({});
  ok(empty.status === 'UNKNOWN' && empty.locations.length === 0, 'an empty record does not throw');
}

console.log('\nRULE  only results and a status move count as a change');
{
  const before = { status: 'ACTIVE_NOT_RECRUITING', hasResults: false, primaryCompletion: '2023-01' };
  const now = T.normalize(FIXTURE);
  const c = T.changes(before, now);
  ok(c.length === 2 && c[0].kind === 'results', 'results first, then the status');
  ok(c[1].text === 'Active, not recruiting → Completed', 'a status move says from and to');
  ok(T.changes(T.snapshot(now), now).length === 0, 'a study matching its snapshot has no change');
  const slid = { ...T.snapshot(now), primaryCompletion: '2022-01' };
  ok(T.changes(slid, now).length === 0, 'a sliding completion date is not an alert');
  ok(T.changes(null, now).length === 0 && T.changes(before, undefined).length === 0, 'nothing to compare is no change');
}

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL STUDIES RULES PASS'));
process.exit(failures ? 1 : 0);
