/* The Studies page against the REAL ClinicalTrials.gov — node projects/psyche/test/live.mjs
   ────────────────────────────────────────────────────────────────────────────
   trials.test.mjs checks the client against fixtures, which proves the code
   does what it was written to do. This checks that what it was written to do
   is what the API actually accepts. They are different questions: the page
   shipped with every test green and the "No phase" chip sending `phase:na`,
   which the API matches case-sensitively — so that chip found nothing, and
   ticked alongside any other phase it took the whole search to zero.

   A 200 is not a pass. The API ignores some values it does not understand
   and answers 200 with everything, or with nothing, so every filter here is
   checked by reading the studies it returned: a status chip returns only its
   statuses, "Has results" returns only studies with results, a sort is in
   order, and so on.

   It needs the network, so it is NOT in .github/checks.mjs (which must run
   anywhere in a second). .github/workflows/studies-live.yml runs it when the
   Studies code changes and once a day, because the API can change under a
   page that has not. About forty requests, one at a time. */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = require('../trials.js');

const API = 'https://clinicaltrials.gov/api/v2';
const UA = { 'user-agent': 'ricmassey.com studies live check (+https://ricmassey.com)', accept: 'application/json' };
const TERM = 'ketamine';                    // big enough that every filter has something to find

let failures = 0, passes = 0;
const ok = (cond, msg, detail) => {
  if (cond) { passes++; console.log('  PASS  ' + msg); }
  else { failures++; console.log('  FAIL  ' + msg + (detail ? '\n        ' + detail : '')); }
};

async function get(path, params) {
  const url = API + path + (params ? '?' + params : '');
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, { headers: UA });
    const text = await r.text();
    if ((r.status === 429 || r.status >= 500) && attempt < 3) { await new Promise(res => setTimeout(res, 2000 * attempt)); continue; }
    let body = null; try { body = JSON.parse(text); } catch (e) {}
    return { status: r.status, body, text };
  }
}
const search = async (state, opts = {}) => {
  const r = await get('/studies', T.buildParams(state, { pageSize: 50, ...opts }));
  return { ...r, studies: ((r.body && r.body.studies) || []).map(T.normalize), total: r.body && r.body.totalCount };
};
const accepted = (r, what) => ok(r.status === 200, `${what}: the API accepts it`, r.status + ' ' + r.text.slice(0, 200));

console.log('\nLIVE  every search scope is a parameter the API takes');
for (const scope of Object.keys(T.SCOPES)) {
  const r = await search({ q: scope === 'spons' ? 'Janssen' : TERM, scope });
  accepted(r, `scope ${scope} (${T.SCOPES[scope].param})`);
  ok(r.total > 0, `scope ${scope} finds something`, 'total ' + r.total);
}

console.log('\nLIVE  the card fields are all names the API knows');
{
  const r = await search({ q: TERM });
  accepted(r, 'LIST_FIELDS');
  const s = r.studies[0] || {};
  ok(s.id && s.title && s.status, 'a card gets an id, a title and a status', JSON.stringify(s).slice(0, 200));
  ok(r.studies.some(x => x.locations.length), 'and locations');
  ok(r.studies.some(x => x.interventions.length && x.conditions.length), 'and conditions and treatments');
}

console.log('\nLIVE  each status chip returns only its own statuses');
for (const c of T.STATUS_CHIPS) {
  const r = await search({ q: TERM, status: [c.key] });
  accepted(r, `status ${c.key}`);
  const bad = r.studies.filter(s => !c.values.includes(s.status));
  ok(r.studies.length > 0 && !bad.length, `status ${c.key}: ${r.studies.length} back, all ${c.values.join('/')}`,
    bad.slice(0, 3).map(s => s.id + ' ' + s.status).join(', '));
}

console.log('\nLIVE  each phase chip returns only its own phase');
const phaseTotals = {};
for (const c of T.PHASE_CHIPS) {
  const r = await search({ q: TERM, phase: [c.key] });
  accepted(r, `phase ${c.key}`);
  phaseTotals[c.key] = r.total;
  const bad = r.studies.filter(s => c.enum === 'NA' ? s.phases.some(p => p !== 'NA') : !s.phases.includes(c.enum));
  ok(r.studies.length > 0 && !bad.length, `phase ${c.key}: ${r.total} found, all ${c.enum}`,
    r.studies.length ? bad.slice(0, 3).map(s => s.id + ' ' + s.phases).join(', ') : 'nothing came back — is the aggFilters code right?');
}
{
  const all = await search({ q: TERM, phase: T.PHASE_CHIPS.map(c => c.key) });
  const biggest = Math.max(...Object.values(phaseTotals));
  ok(all.total >= biggest, `every phase at once is at least the biggest one alone (${all.total} ≥ ${biggest})`);
}

console.log('\nLIVE  the other filters filter');
{
  const r = await search({ q: TERM, results: true });
  accepted(r, 'results:with');
  ok(r.studies.length > 0 && r.studies.every(s => s.hasResults), `"Has results" returns only studies with results (${r.total})`);

  const both = await search({ q: TERM, results: true, phase: ['2', '3'] });
  ok(both.studies.length > 0 && both.studies.every(s => s.hasResults && (s.phases.includes('PHASE2') || s.phases.includes('PHASE3'))),
    `phase and results together (${both.total})`);

  const country = 'Canada';
  const c = await search({ q: TERM, country });
  accepted(c, 'query.locn');
  const plain = await search({ q: TERM });
  ok(c.total > 0 && c.total < plain.total, `a country narrows the search (${c.total} of ${plain.total})`);
  ok(c.studies.every(s => s.locations.some(l => l.country === country)), 'and every study has a site there');
}

console.log('\nLIVE  every sort is in order');
for (const [key, read, cmp] of [
  ['updated', s => s.lastUpdate, (a, b) => a >= b],
  ['start', s => s.start, (a, b) => a >= b],
  ['enroll', s => s.enrollment, (a, b) => a >= b]
]) {
  const r = await search({ q: TERM, sort: key });
  accepted(r, `sort ${key}`);
  const v = r.studies.map(read).filter(x => x != null && x !== '');
  /* Dates come as YYYY, YYYY-MM or YYYY-MM-DD; compare at month precision so
     "2026-10" and "2026-10-02" are not called out of order. */
  const norm = x => typeof x === 'string' ? x.slice(0, 7) : x;
  const out = v.findIndex((x, i) => i && !cmp(norm(v[i - 1]), norm(x)));
  ok(v.length > 5 && out < 0, `sort ${key}: ${v.length} in order`, out >= 0 ? `${v[out - 1]} then ${v[out]}` : '');
}

console.log('\nLIVE  paging, a study, a missing study, and the watchlist fetch');
let withResults = null;
{
  const p1 = await search({ q: TERM }, { pageSize: 20 });
  ok(!!p1.body.nextPageToken, 'the first page hands back a token');
  const p2 = await search({ q: TERM }, { pageSize: 20, pageToken: p1.body.nextPageToken });
  accepted(p2, 'pageToken');
  const seen = new Set(p1.studies.map(s => s.id));
  ok(p2.studies.length && p2.studies.every(s => !seen.has(s.id)), 'and the second page is new studies');

  const id = p1.studies[0].id;
  const d = await get('/studies/' + id);
  ok(d.status === 200 && T.normalize(d.body).id === id, `a study by number (${id})`);

  const missing = await get('/studies/NCT99999998');
  ok(missing.status === 404, 'a well-formed number with no study is a 404', missing.status + ' ' + missing.text.slice(0, 120));

  const ids = p1.studies.slice(0, 8).map(s => s.id);
  const w = await get('/studies', new URLSearchParams({ 'filter.ids': ids.join(','), pageSize: String(ids.length), fields: T.WATCH_FIELDS }));
  accepted(w, 'filter.ids with WATCH_FIELDS');
  const back = new Set(((w.body && w.body.studies) || []).map(s => T.normalize(s).id));
  ok(ids.every(i => back.has(i)), `the watchlist fetch returns every study asked for (${back.size}/${ids.length})`);
  const snap = T.snapshot(T.normalize(w.body.studies[0]));
  ok(snap.status && snap.lastUpdate, 'and enough of each to take a snapshot');

  const wr = await search({ q: 'psilocybin', results: true, phase: ['2'] }, { pageSize: 5 });
  withResults = wr.studies[0] && wr.studies[0].id;
}

console.log('\nLIVE  a study with results flattens into "what it found"');
{
  const d = await get('/studies/' + withResults);
  const n = T.normalize(d.body);
  const r = n.results;
  ok(!!r, `${withResults} has a results summary`);
  if (r) {
    ok(r.flow && r.flow.groups.length && r.flow.groups.every(g => g.started > 0), 'who started, per group', JSON.stringify(r.flow).slice(0, 200));
    const prim = r.outcomes.filter(o => o.type === 'PRIMARY');
    ok(prim.length > 0, 'at least one primary outcome');
    ok(prim.every(o => !o.posted || (o.rows.length && o.rows.every(row => row.cells.length === o.groups.length))),
      'every row has one cell per group');
    ok(prim.some(o => o.rows.some(row => row.cells.some(c => c.value != null && !isNaN(parseFloat(c.value))))), 'with numbers in them');
    ok(r.harms && r.harms.groups.length && r.harms.groups.every(g => g.atRisk != null), 'and side effects with a group size');
  }
}

console.log('\nLIVE  brand names find more than the brand alone');
for (const brand of ['Adderall', 'Prozac', 'Ozempic']) {
  const exact = await search({ q: brand, exact: true }, { pageSize: 1 });
  const named = await search({ q: brand }, { pageSize: 1 });
  ok(named.total > exact.total, `${brand} → ${T.effectiveQuery({ q: brand }).q}: ${named.total} against ${exact.total} as typed`);
}
{
  const typed = await search({ q: 'folic acid' }, { pageSize: 1 });
  const raw = await get('/studies', new URLSearchParams({ 'query.term': 'folic acid', countTotal: 'true', pageSize: '1' }));
  ok(typed.total === raw.body.totalCount, '"folic acid" is searched exactly as typed');
}

console.log('\nLIVE  the client end to end, as the page calls it');
{
  /* The Worker first, then the API directly — whichever answers, the page
     gets the same shape. */
  const page = await T.search({ q: 'esketamine', status: ['recruiting'] }, { pageSize: 10 });
  ok(page.studies.length > 0 && page.studies.every(s => s.status === 'RECRUITING'), `Trials.search works (via ${page.via})`);
  const s = await T.study(withResults);
  ok(s.id === withResults && s.results, `Trials.study works, results included`);
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
