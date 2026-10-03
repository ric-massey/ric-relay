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

console.log('\nRULE  "No phase" is the API\'s NA, upper case (live.mjs found it lower)');
{
  ok(T.buildParams({ phase: ['na'] }).get('aggFilters') === 'phase:NA', 'the chip sends NA');
  ok(T.buildParams({ phase: ['0', 'na'] }).get('aggFilters') === 'phase:0 NA', 'and mixes with the others');
}

console.log('\nRULE  brand and street names are searched by their generic name');
{
  const eq = (state, q, n) => { const r = T.effectiveQuery(state); return r.q === q && r.from.length === n; };
  ok(eq({ q: 'Spravato' }, 'esketamine', 1), 'a brand, any case');
  ok(eq({ q: 'adderall vs Ritalin' }, 'amphetamine vs methylphenidate', 2), 'two in one search');
  ok(eq({ q: 'magic mushrooms depression' }, 'psilocybin depression', 1), 'a name of two words');
  ok(eq({ q: 'Suboxone' }, 'buprenorphine naloxone', 1), 'a combination becomes both');
  ok(eq({ q: 'acid' }, 'LSD', 1) && eq({ q: 'folic acid' }, 'folic acid', 0), 'a street word only when it is the whole search');
  ok(eq({ q: 'Molly Smith' }, 'Molly Smith', 0), 'so a person called Molly is a person');
  ok(eq({ q: 'zoloft-like' }, 'zoloft-like', 0), 'a brand inside a hyphenated word is left alone');
  ok(eq({ q: 'prozac', scope: 'cond' }, 'prozac', 0) && eq({ q: 'prozac', scope: 'titles' }, 'prozac', 0), 'condition and title searches mean what was typed');
  ok(eq({ q: 'prozac', scope: 'intr' }, 'fluoxetine', 1), 'a drug search is rewritten');
  ok(eq({ q: 'prozac', exact: true }, 'prozac', 0), '"search exactly" turns it off');
  ok(T.buildParams({ q: 'Ozempic' }).get('query.term') === 'semaglutide', 'and the API is sent the generic');
  ok(Object.entries(T.BRANDS).every(([k, v]) => k === k.toLowerCase() && v && !T.BRANDS[v.toLowerCase()]),
    'every key is lower case and no generic is itself a brand');
}

console.log('\nRULE  posted results flatten into "what it found"');
{
  const R = {
    participantFlowModule: {
      groups: [{ id: 'FG000', title: 'Drug' }, { id: 'FG001', title: 'Placebo' }],
      periods: [
        { title: 'Treatment', milestones: [
          { type: 'STARTED', achievements: [{ groupId: 'FG000', numSubjects: '40' }, { groupId: 'FG001', numSubjects: '38' }] },
          { type: 'COMPLETED', achievements: [{ groupId: 'FG000', numSubjects: '36' }, { groupId: 'FG001', numSubjects: '37' }] }],
          dropWithdraws: [{ type: 'Lost to Follow-up', reasons: [{ groupId: 'FG000', numSubjects: '3' }, { groupId: 'FG001', numSubjects: '1' }] }] },
        { title: 'Follow-up', milestones: [
          { type: 'STARTED', achievements: [{ groupId: 'FG000', numSubjects: '36' }, { groupId: 'FG001', numSubjects: '37' }] },
          { type: 'COMPLETED', achievements: [{ groupId: 'FG000', numSubjects: '30' }, { groupId: 'FG001', numSubjects: '35' }] }],
          dropWithdraws: [{ type: 'Lost to Follow-up', reasons: [{ groupId: 'FG000', numSubjects: '6' }] }] }
      ]
    },
    outcomeMeasuresModule: { outcomeMeasures: [
      { type: 'PRIMARY', title: 'MADRS change', paramType: 'MEAN', dispersionType: 'Standard Deviation', unitOfMeasure: 'units on a scale',
        groups: [{ id: 'OG000', title: 'Drug' }, { id: 'OG001', title: 'Placebo' }],
        denoms: [{ units: 'Participants', counts: [{ groupId: 'OG000', value: '40' }, { groupId: 'OG001', value: '38' }] }],
        classes: [
          { title: 'Week 3', categories: [{ measurements: [{ groupId: 'OG000', value: '-12', spread: '4.1' }, { groupId: 'OG001', value: '-6.8', spread: '3.9' }] }] },
          { title: 'Week 6', categories: [{ measurements: [{ groupId: 'OG000', value: '-14', spread: '4.0' }, { groupId: 'OG001', value: 'NA', comment: 'not assessed' }] }] }],
        analyses: [{ groupIds: ['OG000', 'OG001'], pValue: '<0.05', statisticalMethod: 'ANCOVA', paramType: 'Mean Difference', paramValue: '-5.2', ciPctValue: '95', ciLowerLimit: '-8.1', ciUpperLimit: '-2.3' }] },
      { type: 'SECONDARY', title: 'Response', paramType: 'MEDIAN', dispersionType: '95% Confidence Interval',
        groups: [{ id: 'OG000', title: 'Drug' }],
        classes: [{ categories: [{ title: 'Responders', measurements: [{ groupId: 'OG000', value: '5', lowerLimit: '3', upperLimit: '7' }] }] }] },
      { type: 'SECONDARY', title: 'Withheld', reportingStatus: 'NOT_POSTED', groups: [] }
    ] },
    adverseEventsModule: {
      frequencyThreshold: '5',
      eventGroups: [
        { id: 'EG000', title: 'Drug', seriousNumAffected: 2, seriousNumAtRisk: 40, otherNumAffected: 30, otherNumAtRisk: 40, deathsNumAffected: 0, deathsNumAtRisk: 40 },
        { id: 'EG001', title: 'Placebo', seriousNumAffected: 0, seriousNumAtRisk: 38, otherNumAffected: 20, otherNumAtRisk: 38, deathsNumAffected: 0, deathsNumAtRisk: 38 }],
      otherEvents: [
        { term: 'Headache', stats: [{ groupId: 'EG000', numAffected: 8, numAtRisk: 40 }, { groupId: 'EG001', numAffected: 9, numAtRisk: 38 }] },
        { term: 'Nausea', stats: [{ groupId: 'EG000', numAffected: 12, numAtRisk: 40 }, { groupId: 'EG001', numAffected: 1, numAtRisk: 38 }] },
        { term: 'Nausea', stats: [{ groupId: 'EG000', numAffected: 1, numAtRisk: 40 }] },
        { term: 'Rash', stats: [{ groupId: 'EG000', numAffected: 0, numAtRisk: 40 }] }],
      seriousEvents: [{ term: 'Suicidal ideation', stats: [{ groupId: 'EG000', numAffected: 1, numAtRisk: 40 }] }]
    },
    moreInfoModule: { limitationsAndCaveats: { description: 'Small sample.' } }
  };
  const r = T.normalize({ ...FIXTURE, resultsSection: R }).results;
  ok(r && T.normalize(FIXTURE).results === null, 'a record with no resultsSection has no summary');
  ok(r.flow.groups[0].started === 40 && r.flow.groups[0].completed === 30, 'started in the first period, finished in the last');
  ok(r.flow.reasons[0].type === 'Lost to Follow-up' && r.flow.reasons[0].n === 10, 'reasons for leaving are summed over periods');
  const [m, resp, held] = r.outcomes;
  ok(m.groups[0].n === 40 && m.spreadLabel === 'SD' && m.paramLabel === 'average', 'group sizes, and what the numbers are');
  ok(m.rows.length === 2 && m.rows[1].label === 'Week 6' && m.rows[1].cells[1].value === null && m.rows[1].cells[1].note === 'not assessed',
    'a time point per row, and NA is no value with its reason');
  ok(m.analyses[0].groups.join(' vs ') === 'Drug vs Placebo' && m.analyses[0].p === '<0.05' && m.analyses[0].estimate.ci.lower === '-8.1',
    'an analysis names its groups, its p and its estimate');
  ok(resp.rows[0].cells[0].lower === '3' && resp.rows[0].cells[0].spread === undefined && resp.spreadLabel === '95% CI', 'a CI is a range, not a spread');
  ok(held.posted === false, 'an outcome not posted says so');
  ok(r.harms.groups[0].serious === 2 && r.harms.groups[1].atRisk === 38, 'harms per group');
  ok(r.harms.common[0].term === 'Nausea' && r.harms.common[0].cells[0].affected === 13, 'commonest first by its worst group, duplicates merged');
  ok(!r.harms.common.some(e => e.term === 'Rash'), 'an event nobody had is dropped');
  ok(r.harms.serious.length === 1 && r.limitations === 'Small sample.', 'serious events and the caveats');
}

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL STUDIES RULES PASS'));
process.exit(failures ? 1 : 0);
