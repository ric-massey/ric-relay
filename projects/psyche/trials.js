/* TRIALS — ClinicalTrials.gov, for the Psyche room's Studies page and the front door
   ────────────────────────────────────────────────────────────────────────────
   One file, two readers:

     projects/psyche/studies.html  the search, the detail sheet, the watchlist
     index.html                    the trial alert under the NOTIFICATION banner,
                                   drawn only when Ric is signed in

   Everything that talks to the API, turns its nested records into something a
   card can draw, or decides that a tracked study has changed lives here, so
   the page and the front door can never disagree about what "changed" means.
   Pure functions are exported for Node too; projects/psyche/test/ runs them.

   ── where requests go ──
   The Worker's /trials route first (worker/worker.mjs — filtered, cached five
   minutes), and straight to clinicaltrials.gov if that fails. Either way the
   page works: the Worker is a cache and a shield, not a dependency. A 400 is
   NOT retried directly — that is the API refusing the search, and asking it
   again from somewhere else gets the same answer. */
(function (root) {
  'use strict';

  const LIVE = 'https://training-log.rmbuster82.workers.dev';
  const DIRECT = 'https://clinicaltrials.gov/api/v2';
  const STUDY_URL = id => 'https://clinicaltrials.gov/study/' + id;

  /* On localhost the Worker is whatever served the page (worker/dev.mjs); a
     plain static server 404s there and the direct fallback takes over. */
  const host = () => {
    try {
      if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return location.origin;
    } catch (e) {}
    return LIVE;
  };

  /* ── the vocabulary ── */
  const STATUS = {
    RECRUITING:               { label: 'Recruiting',              tone: 'go' },
    NOT_YET_RECRUITING:       { label: 'Not yet recruiting',      tone: 'soon' },
    ENROLLING_BY_INVITATION:  { label: 'Enrolling by invitation', tone: 'go' },
    ACTIVE_NOT_RECRUITING:    { label: 'Active, not recruiting',  tone: 'active' },
    COMPLETED:                { label: 'Completed',               tone: 'done' },
    SUSPENDED:                { label: 'Suspended',               tone: 'stop' },
    TERMINATED:               { label: 'Terminated',              tone: 'stop' },
    WITHDRAWN:                { label: 'Withdrawn',               tone: 'stop' },
    UNKNOWN:                  { label: 'Unknown status',          tone: 'muted' },
    AVAILABLE:                { label: 'Expanded access: available', tone: 'go' },
    NO_LONGER_AVAILABLE:      { label: 'No longer available',     tone: 'muted' },
    TEMPORARILY_NOT_AVAILABLE:{ label: 'Temporarily unavailable', tone: 'muted' },
    APPROVED_FOR_MARKETING:   { label: 'Approved for marketing',  tone: 'done' },
    WITHHELD:                 { label: 'Withheld',                tone: 'muted' }
  };
  const statusOf = code => STATUS[code] || { label: code ? code.toLowerCase().replace(/_/g, ' ') : 'Unknown status', tone: 'muted' };

  /* The chips on the page, and the API values each one stands for. A chip is a
     plain-language group, not a mirror of the API enum: nobody searching for a
     trial thinks "enrolling by invitation" is a different thing from "active". */
  const STATUS_CHIPS = [
    { key: 'recruiting', label: 'Recruiting',         values: ['RECRUITING'] },
    { key: 'soon',       label: 'Not yet recruiting', values: ['NOT_YET_RECRUITING'] },
    { key: 'active',     label: 'Active',             values: ['ACTIVE_NOT_RECRUITING', 'ENROLLING_BY_INVITATION'] },
    { key: 'completed',  label: 'Completed',          values: ['COMPLETED'] },
    { key: 'stopped',    label: 'Stopped early',      values: ['TERMINATED', 'SUSPENDED', 'WITHDRAWN'] }
  ];

  /* aggFilters codes — the same ones clinicaltrials.gov puts in its own search
     URLs (…&aggFilters=phase:2 3,results:with). */
  const PHASE_CHIPS = [
    { key: '0',  label: 'Early 1', enum: 'EARLY_PHASE1' },
    { key: '1',  label: 'Phase 1', enum: 'PHASE1' },
    { key: '2',  label: 'Phase 2', enum: 'PHASE2' },
    { key: '3',  label: 'Phase 3', enum: 'PHASE3' },
    { key: '4',  label: 'Phase 4', enum: 'PHASE4' },
    { key: 'na', label: 'No phase', enum: 'NA' }
  ];
  const PHASE_LABEL = Object.fromEntries(PHASE_CHIPS.map(p => [p.enum, p.label]));
  const phaseText = phases => {
    const p = (phases || []).filter(x => x !== 'NA');
    if (!p.length) return (phases || []).includes('NA') ? 'No phase' : '';
    return p.map(x => PHASE_LABEL[x] || x).join(' / ').replace(/ \/ Phase /g, '/');
  };

  const SCOPES = {
    term:   { param: 'query.term',   label: 'Anything' },
    cond:   { param: 'query.cond',   label: 'Condition' },
    intr:   { param: 'query.intr',   label: 'Drug or treatment' },
    titles: { param: 'query.titles', label: 'Title' },
    spons:  { param: 'query.spons',  label: 'Sponsor' }
  };

  const SORTS = {
    relevance: { label: 'Best match',        value: '' },
    updated:   { label: 'Recently updated',  value: 'LastUpdatePostDate:desc' },
    start:     { label: 'Newest start',      value: 'StartDate:desc' },
    enroll:    { label: 'Most participants', value: 'EnrollmentCount:desc' }
  };

  /* What a result card needs, and no more — a full record runs to hundreds of
     kilobytes for a study with results. If the API ever refuses one of these
     names, search() drops `fields` and asks again rather than going dark. */
  const LIST_FIELDS = ['NCTId', 'BriefTitle', 'Acronym', 'OverallStatus', 'Phase', 'StudyType',
    'HasResults', 'StartDate', 'PrimaryCompletionDate', 'CompletionDate', 'LastUpdatePostDate',
    'ResultsFirstPostDate', 'Condition', 'InterventionName', 'InterventionType', 'LeadSponsorName',
    'EnrollmentCount', 'LocationFacility', 'LocationCity', 'LocationState', 'LocationCountry'].join(',');
  const WATCH_FIELDS = ['NCTId', 'BriefTitle', 'OverallStatus', 'HasResults', 'PrimaryCompletionDate',
    'CompletionDate', 'LastUpdatePostDate', 'ResultsFirstPostDate', 'Phase'].join(',');

  const NCT = /^NCT\d{8}$/i;
  const asNct = s => {
    const m = String(s || '').trim().match(/^nct\s*-?\s*(\d{8})$/i);
    return m ? 'NCT' + m[1] : null;
  };

  /* ── the search, as API parameters ──
     `state` is what the page holds and what the address bar carries:
       { q, scope, status: [chip keys], phase: [chip keys], results, country, sort } */
  function buildParams(state, { pageToken, pageSize = 20, fields = true } = {}) {
    const p = new URLSearchParams();
    const q = String(state.q || '').trim();
    if (q) p.set((SCOPES[state.scope] || SCOPES.term).param, q);

    const statuses = STATUS_CHIPS.filter(c => (state.status || []).includes(c.key)).flatMap(c => c.values);
    if (statuses.length) p.set('filter.overallStatus', statuses.join(','));

    const agg = [];
    const phases = PHASE_CHIPS.filter(c => (state.phase || []).includes(c.key)).map(c => c.key);
    if (phases.length) agg.push('phase:' + phases.join(' '));
    if (state.results) agg.push('results:with');
    if (agg.length) p.set('aggFilters', agg.join(','));

    if (state.country) p.set('query.locn', state.country);
    const sort = (SORTS[state.sort] || SORTS.relevance).value;
    if (sort) p.set('sort', sort);

    p.set('pageSize', String(pageSize));
    if (pageToken) p.set('pageToken', pageToken);
    else p.set('countTotal', 'true');
    if (fields) p.set('fields', LIST_FIELDS);
    return p;
  }

  /* ── one record, flattened ── */
  const dateOf = s => (s && s.date) || null;
  function normalize(study) {
    const ps = (study && study.protocolSection) || {};
    const id = ps.identificationModule || {};
    const st = ps.statusModule || {};
    const de = ps.designModule || {};
    const co = ps.conditionsModule || {};
    const ai = ps.armsInterventionsModule || {};
    const sp = ps.sponsorCollaboratorsModule || {};
    const cl = ps.contactsLocationsModule || {};
    const ds = ps.descriptionModule || {};
    const el = ps.eligibilityModule || {};
    const oc = ps.outcomesModule || {};
    return {
      id: id.nctId || '',
      title: id.briefTitle || id.officialTitle || '(untitled study)',
      officialTitle: id.officialTitle || '',
      acronym: id.acronym || '',
      status: st.overallStatus || 'UNKNOWN',
      whyStopped: st.whyStopped || '',
      phases: de.phases || [],
      type: de.studyType || '',
      hasResults: study && study.hasResults === true,
      start: dateOf(st.startDateStruct),
      startType: (st.startDateStruct && st.startDateStruct.type) || '',
      primaryCompletion: dateOf(st.primaryCompletionDateStruct),
      primaryCompletionType: (st.primaryCompletionDateStruct && st.primaryCompletionDateStruct.type) || '',
      completion: dateOf(st.completionDateStruct),
      completionType: (st.completionDateStruct && st.completionDateStruct.type) || '',
      lastUpdate: dateOf(st.lastUpdatePostDateStruct),
      resultsFirst: dateOf(st.resultsFirstPostDateStruct),
      conditions: co.conditions || [],
      keywords: co.keywords || [],
      interventions: (ai.interventions || []).map(i => ({ type: i.type || '', name: i.name || '', description: i.description || '' })),
      arms: (ai.armGroups || []).map(a => ({ label: a.label || '', type: a.type || '', description: a.description || '' })),
      sponsor: (sp.leadSponsor && sp.leadSponsor.name) || '',
      enrollment: (de.enrollmentInfo && de.enrollmentInfo.count) || null,
      enrollmentType: (de.enrollmentInfo && de.enrollmentInfo.type) || '',
      locations: (cl.locations || []).map(l => ({
        facility: l.facility || '', city: l.city || '', state: l.state || '', country: l.country || '', status: l.status || ''
      })),
      summary: ds.briefSummary || '',
      description: ds.detailedDescription || '',
      eligibility: {
        criteria: el.eligibilityCriteria || '',
        sex: el.sex || '',
        minAge: el.minimumAge || '',
        maxAge: el.maximumAge || '',
        healthy: el.healthyVolunteers === true,
        ages: el.stdAges || []
      },
      primaryOutcomes: (oc.primaryOutcomes || []).map(o => ({ measure: o.measure || '', timeFrame: o.timeFrame || '' })),
      url: STUDY_URL(id.nctId || '')
    };
  }

  /* "Boston, United States · +41 more sites in 6 countries" — with the
     searched-for country first, because that is the site the reader wants. */
  function placeSummary(locations, preferCountry) {
    const locs = locations || [];
    if (!locs.length) return '';
    const want = String(preferCountry || '').toLowerCase();
    const first = (want && locs.find(l => l.country.toLowerCase() === want)) || locs[0];
    const here = [first.city, first.country].filter(Boolean).join(', ') || first.facility;
    const countries = new Set(locs.map(l => l.country).filter(Boolean));
    if (locs.length === 1) return here;
    const more = locs.length - 1;
    return `${here} · +${more} more site${more === 1 ? '' : 's'}` +
      (countries.size > 1 ? ` in ${countries.size} countries` : '');
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(d, type) {
    if (!d) return '';
    const m = String(d).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
    if (!m) return String(d);
    const out = m[2] ? (m[3] ? `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}` : `${MONTHS[+m[2] - 1]} ${m[1]}`) : m[1];
    return type === 'ESTIMATED' ? out + ' (est.)' : out;
  }

  /* ── the watchlist ──
     A snapshot is what the study looked like when Ric last said "seen". The
     Worker stores it (and only these fields: cleanSnapshot in worker.mjs). */
  const snapshot = n => ({
    status: n.status || null,
    hasResults: n.hasResults === true,
    resultsFirst: n.resultsFirst || null,
    primaryCompletion: n.primaryCompletion || null,
    lastUpdate: n.lastUpdate || null
  });

  /* What is worth an alert. Deliberately two things: results appearing, and the
     status moving. Estimated completion dates slide every few months on most
     studies, and an alert that fires for that gets ignored for the ones that
     matter. */
  function changes(seen, now) {
    if (!seen || !now) return [];
    const out = [];
    if (now.hasResults && !seen.hasResults) out.push({ kind: 'results', text: 'Results posted' + (now.resultsFirst ? ' ' + fmtDate(now.resultsFirst) : '') });
    if (seen.status && now.status && seen.status !== now.status) {
      out.push({ kind: 'status', text: `${statusOf(seen.status).label} → ${statusOf(now.status).label}` });
    }
    return out;
  }

  /* ── network ── */
  class TrialError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }

  async function readError(r) {
    const text = await r.text().catch(() => '');
    try {
      const j = JSON.parse(text);
      return j.message || j.error || text;
    } catch (e) { return text || ('HTTP ' + r.status); }
  }

  async function getJSON(path, params, signal) {
    const qs = params && String(params) ? '?' + params : '';
    let proxyErr = null;
    try {
      const r = await fetch(host() + '/trials' + path + qs, { signal });
      if (r.ok) return { data: await r.json(), via: 'proxy' };
      if (r.status === 400) throw new TrialError(await readError(r), 400);
      proxyErr = r.status;
    } catch (e) {
      if (e.name === 'AbortError' || e instanceof TrialError) throw e;
    }
    const direct = path.replace(/^\/search$/, '/studies').replace(/^\/study\//, '/studies/');
    let r;
    try { r = await fetch(DIRECT + direct + qs, { signal }); }
    catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new TrialError('Could not reach ClinicalTrials.gov — check the connection and try again.', 0);
    }
    if (r.ok) return { data: await r.json(), via: 'direct' };
    throw new TrialError(await readError(r), r.status || proxyErr || 0);
  }

  /* Remembered for the session: if the API once refused the fields list, stop
     sending it rather than paying for a failed request on every search. */
  let fieldsRefused = false;
  async function search(state, opts = {}) {
    const params = buildParams(state, { ...opts, fields: !fieldsRefused });
    try {
      const { data, via } = await getJSON('/search', params, opts.signal);
      return { studies: (data.studies || []).map(normalize), next: data.nextPageToken || null, total: data.totalCount, via };
    } catch (e) {
      if (e.status === 400 && !fieldsRefused && /field/i.test(e.message)) {
        fieldsRefused = true;
        return search(state, opts);
      }
      throw e;
    }
  }

  const studyMemo = new Map();
  async function study(id, signal) {
    id = String(id).toUpperCase();
    if (studyMemo.has(id)) return studyMemo.get(id);
    const { data } = await getJSON('/study/' + id, null, signal);
    const n = normalize(data);
    studyMemo.set(id, n);
    return n;
  }

  async function byIds(ids, signal) {
    const out = new Map();
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const p = new URLSearchParams({ 'filter.ids': chunk.join(','), pageSize: String(chunk.length) });
      if (!fieldsRefused) p.set('fields', WATCH_FIELDS);
      const { data } = await getJSON('/search', p, signal);
      for (const s of data.studies || []) { const n = normalize(s); out.set(n.id, n); }
    }
    return out;
  }

  /* ── Ric's token ──
     Read the same way assets/owner.js reads it. The studies page loads Owner
     for the sign-in box; the front door does not need all of that to ask one
     question, so this reads localStorage itself when Owner is absent. */
  const token = () => {
    if (root.Owner && root.Owner.token) return root.Owner.token();
    try { return root.localStorage.getItem('ownerToken'); } catch (e) { return null; }
  };
  const signedIn = () => !!token();
  const authHeaders = () => (token() ? { authorization: 'Bearer ' + token() } : {});

  async function watchList() {
    if (!signedIn()) return null;
    const r = await fetch(host() + '/trials/watch', { headers: authHeaders(), cache: 'no-store' });
    if (r.status === 401) throw new TrialError('signed out', 401);
    if (!r.ok) throw new TrialError('the watchlist is unavailable right now', r.status);
    return (await r.json()).items || {};
  }

  async function watchWrite(id, body) {
    if (!signedIn()) return null;
    const r = await fetch(host() + '/trials/watch/' + id, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new TrialError(await readError(r), r.status);
    return r.json();
  }
  const track = n => watchWrite(n.id, { title: n.title, seen: snapshot(n) });
  const acknowledge = n => watchWrite(n.id, { seen: snapshot(n) });
  const untrack = id => watchWrite(id, { remove: true });

  /* The whole check, for the front door and the watch card alike: the list,
     each study as it is now, and which of them moved since last seen. */
  async function checkWatch(signal) {
    const items = await watchList();
    if (!items) return null;
    const ids = Object.keys(items);
    const now = ids.length ? await byIds(ids, signal) : new Map();
    const alerts = [];
    for (const id of ids) {
      const c = changes(items[id].seen, now.get(id));
      if (c.length) alerts.push({ id, title: (now.get(id) || items[id]).title, changes: c });
    }
    return { items, now, alerts };
  }

  const api = {
    STATUS, STATUS_CHIPS, PHASE_CHIPS, SCOPES, SORTS, LIST_FIELDS, WATCH_FIELDS, NCT,
    statusOf, phaseText, asNct, buildParams, normalize, placeSummary, fmtDate, snapshot, changes,
    search, study, byIds, signedIn, watchList, track, acknowledge, untrack, checkWatch, TrialError,
    studyUrl: STUDY_URL, host
  };
  root.Trials = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
