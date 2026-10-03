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
     URLs (…&aggFilters=phase:2 3,results:with).
     `key` is what the address bar carries; `agg` is what the API takes. They
     differ once: "no phase" is `NA`, and the API matches it case-sensitively —
     `phase:na` matches nothing, and because the chips are ORed together, it
     used to take every other phase down to zero with it. Found against the
     live API on 2026-10-03 (test/live.mjs). */
  const PHASE_CHIPS = [
    { key: '0',  agg: '0',  label: 'Early 1', enum: 'EARLY_PHASE1' },
    { key: '1',  agg: '1',  label: 'Phase 1', enum: 'PHASE1' },
    { key: '2',  agg: '2',  label: 'Phase 2', enum: 'PHASE2' },
    { key: '3',  agg: '3',  label: 'Phase 3', enum: 'PHASE3' },
    { key: '4',  agg: '4',  label: 'Phase 4', enum: 'PHASE4' },
    { key: 'na', agg: 'NA', label: 'No phase', enum: 'NA' }
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

  /* ── names people actually use ──
     The registry is written in generic names. Its search expands some brands
     on its own and misses others badly — measured 2026-10-03, query.term:

        Spravato 368 · esketamine 368      (expanded: harmless to rewrite)
        Adderall  59 · amphetamine 735
        Prozac   188 · fluoxetine  445
        Ozempic  116 · semaglutide 797
        shrooms    1 · psilocybin  324
        acid  83,710 · LSD         159     (every "folic acid" trial)

     So a known brand or street name is swapped for its generic before the
     search goes out, and the page says so ("showing results for…") with a way
     to search the word exactly. Rewriting the ones the registry already
     expands changes no count and teaches the generic name.

     `whole` entries are ordinary words as well as street names: they are
     rewritten only when they are the entire search, so "acid" is LSD but
     "folic acid" is folic acid, and "Molly" in "Molly Smith" is a person.
     Lower-case keys; a key may be several words. Only the Anything and Drug
     scopes are rewritten — Condition, Title and Sponsor mean what was typed. */
  const BRANDS = {
    // ketamine and the psychedelics
    spravato: 'esketamine', ketalar: 'ketamine',
    shrooms: 'psilocybin', 'magic mushrooms': 'psilocybin', 'magic mushroom': 'psilocybin',
    ecstasy: 'MDMA', 'special k': 'ketamine',
    // ADHD and wakefulness
    adderall: 'amphetamine', mydayis: 'amphetamine', vyvanse: 'lisdexamfetamine', dexedrine: 'dextroamphetamine',
    ritalin: 'methylphenidate', concerta: 'methylphenidate', focalin: 'dexmethylphenidate',
    strattera: 'atomoxetine', intuniv: 'guanfacine', qelbree: 'viloxazine',
    provigil: 'modafinil', nuvigil: 'armodafinil',
    // antidepressants
    prozac: 'fluoxetine', zoloft: 'sertraline', lexapro: 'escitalopram', celexa: 'citalopram',
    paxil: 'paroxetine', luvox: 'fluvoxamine', effexor: 'venlafaxine', pristiq: 'desvenlafaxine',
    cymbalta: 'duloxetine', wellbutrin: 'bupropion', zyban: 'bupropion', remeron: 'mirtazapine',
    trintellix: 'vortioxetine', viibryd: 'vilazodone', desyrel: 'trazodone',
    auvelity: 'dextromethorphan bupropion', zurzuvae: 'zuranolone', zulresso: 'brexanolone',
    // anxiety and sleep
    xanax: 'alprazolam', valium: 'diazepam', ativan: 'lorazepam', klonopin: 'clonazepam',
    buspar: 'buspirone', ambien: 'zolpidem', lunesta: 'eszopiclone', belsomra: 'suvorexant',
    // mood stabilisers and anticonvulsants
    lithobid: 'lithium', lamictal: 'lamotrigine', depakote: 'valproate', tegretol: 'carbamazepine',
    trileptal: 'oxcarbazepine', topamax: 'topiramate', neurontin: 'gabapentin', lyrica: 'pregabalin',
    keppra: 'levetiracetam', epidiolex: 'cannabidiol',
    // antipsychotics
    seroquel: 'quetiapine', abilify: 'aripiprazole', risperdal: 'risperidone', zyprexa: 'olanzapine',
    clozaril: 'clozapine', latuda: 'lurasidone', vraylar: 'cariprazine', rexulti: 'brexpiprazole',
    caplyta: 'lumateperone', cobenfy: 'xanomeline trospium', haldol: 'haloperidol', invega: 'paliperidone',
    geodon: 'ziprasidone', ingrezza: 'valbenazine', austedo: 'deutetrabenazine',
    // addiction
    suboxone: 'buprenorphine naloxone', subutex: 'buprenorphine', sublocade: 'buprenorphine',
    vivitrol: 'naltrexone', narcan: 'naloxone', chantix: 'varenicline', antabuse: 'disulfiram',
    // dementia, and the drugs half the country is asking about
    aricept: 'donepezil', namenda: 'memantine', leqembi: 'lecanemab', kisunla: 'donanemab',
    ozempic: 'semaglutide', wegovy: 'semaglutide', rybelsus: 'semaglutide',
    mounjaro: 'tirzepatide', zepbound: 'tirzepatide'
  };
  const WHOLE = {
    acid: 'LSD', molly: 'MDMA', weed: 'cannabis', pot: 'cannabis', marijuana: 'cannabis',
    mushrooms: 'psilocybin', speed: 'amphetamine', ice: 'methamphetamine',
    meth: 'methamphetamine', coke: 'cocaine', dope: 'heroin', benzos: 'benzodiazepines'
  };
  const BRAND_KEYS = Object.keys(BRANDS).sort((a, b) => b.length - a.length);
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const BRAND_RE = new RegExp('(^|[^\\w-])(' + BRAND_KEYS.map(escRe).join('|') + ')(?![\\w-])', 'gi');
  const REWRITES = new Set(['term', 'intr']);

  /* { q: what is sent, from: [[as typed, sent instead], …] } — `from` empty
     when nothing was changed. `state.exact` turns it off. */
  function effectiveQuery(state) {
    const typed = String(state.q || '').trim();
    if (!typed || state.exact || !REWRITES.has(state.scope || 'term') || asNct(typed)) return { q: typed, from: [] };
    const whole = WHOLE[typed.toLowerCase()];
    if (whole) return { q: whole, from: [[typed, whole]] };
    const from = [];
    const q = typed.replace(BRAND_RE, (m, lead, word) => {
      const generic = BRANDS[word.toLowerCase()];
      from.push([word, generic]);
      return lead + generic;
    });
    return { q, from };
  }

  /* ── the search, as API parameters ──
     `state` is what the page holds and what the address bar carries:
       { q, scope, exact, status: [chip keys], phase: [chip keys], results, country, sort } */
  function buildParams(state, { pageToken, pageSize = 20, fields = true } = {}) {
    const p = new URLSearchParams();
    const q = effectiveQuery(state).q;
    if (q) p.set((SCOPES[state.scope] || SCOPES.term).param, q);

    const statuses = STATUS_CHIPS.filter(c => (state.status || []).includes(c.key)).flatMap(c => c.values);
    if (statuses.length) p.set('filter.overallStatus', statuses.join(','));

    const agg = [];
    const phases = PHASE_CHIPS.filter(c => (state.phase || []).includes(c.key)).map(c => c.agg);
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
      results: resultsOf(study && study.resultsSection),
      url: STUDY_URL(id.nctId || '')
    };
  }

  /* ── what a finished study found ──
     The resultsSection of a full record, flattened into the three things the
     detail sheet answers: who finished, what was measured and how each group
     did, and what went wrong for people. Search cards never ask for it (it is
     not in LIST_FIELDS); only study() fetches the whole record.

     Shapes surveyed over 300 psychiatry trials with results on 2026-10-03, so
     this is built for their spread rather than one example: up to 16 groups,
     records up to 850 KB, a measurement as `value` with a `spread` or a
     `lowerLimit`/`upperLimit`, the string "NA" where a group was not measured
     (with a `comment` saying why), and a row label that can come from a class
     (a time point), a category (an answer), or both.

     Each module names its groups with its own ids (FG…, OG…, EG…), so groups
     are carried by title within a section and never matched across sections. */
  const PARAM = {
    MEAN: 'average', MEDIAN: 'median', LEAST_SQUARES_MEAN: 'adjusted average',
    GEOMETRIC_MEAN: 'geometric average', GEOMETRIC_LEAST_SQUARES_MEAN: 'adjusted geometric average',
    COUNT_OF_PARTICIPANTS: 'number of people', COUNT_OF_UNITS: 'count', NUMBER: ''
  };
  const DISPERSION = {
    'Standard Deviation': 'SD', 'Standard Error': 'SE', 'Inter-Quartile Range': 'IQR', 'Full Range': 'range',
    'Geometric Coefficient of Variation': 'CV%'
  };
  const OUTCOME_ROWS = 40;          // a 12-time-point outcome is fine; a 300-row one is not a summary
  const OUTCOMES = 30;
  const intOf = v => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };
  const absent = v => v == null || v === '' || /^NA$/i.test(String(v));

  function resultsOf(rs) {
    if (!rs || typeof rs !== 'object') return null;
    const flow = flowOf(rs.participantFlowModule);
    const outcomes = ((rs.outcomeMeasuresModule && rs.outcomeMeasuresModule.outcomeMeasures) || [])
      .slice(0, OUTCOMES).map(outcomeOf);
    const harms = harmsOf(rs.adverseEventsModule);
    const lim = rs.moreInfoModule && rs.moreInfoModule.limitationsAndCaveats;
    if (!flow && !outcomes.length && !harms) return null;
    const total = ((rs.outcomeMeasuresModule && rs.outcomeMeasuresModule.outcomeMeasures) || []).length;
    return { flow, outcomes, moreOutcomes: Math.max(0, total - outcomes.length), harms, limitations: (lim && lim.description) || '' };
  }

  /* STARTED in the first period, COMPLETED in the last — a study with a
     follow-up period completes people at its end, not after randomisation.
     Reasons for leaving are summed over every period. */
  function flowOf(pf) {
    if (!pf || !(pf.groups || []).length || !(pf.periods || []).length) return null;
    const milestone = (period, type) => {
      const m = (period.milestones || []).find(x => String(x.type).toUpperCase() === type);
      return m ? Object.fromEntries((m.achievements || []).map(a => [a.groupId, intOf(a.numSubjects)])) : {};
    };
    const started = milestone(pf.periods[0], 'STARTED');
    const completed = milestone(pf.periods[pf.periods.length - 1], 'COMPLETED');
    const reasons = new Map();
    for (const p of pf.periods) for (const w of p.dropWithdraws || []) {
      const n = (w.reasons || []).reduce((t, r) => t + (intOf(r.numSubjects) || 0), 0);
      if (n) reasons.set(w.type, (reasons.get(w.type) || 0) + n);
    }
    const groups = pf.groups.map(g => ({
      title: g.title || '', started: started[g.id] != null ? started[g.id] : null,
      completed: completed[g.id] != null ? completed[g.id] : null
    }));
    if (!groups.some(g => g.started != null)) return null;
    return {
      groups,
      reasons: [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([type, n]) => ({ type, n }))
    };
  }

  function cellOf(m, dispersion) {
    if (!m || absent(m.value)) return { value: null, note: (m && m.comment) || '' };
    const c = { value: String(m.value) };
    if (!absent(m.lowerLimit) || !absent(m.upperLimit)) {
      c.lower = absent(m.lowerLimit) ? null : String(m.lowerLimit);
      c.upper = absent(m.upperLimit) ? null : String(m.upperLimit);
    } else if (!absent(m.spread)) c.spread = String(m.spread);
    if (m.comment) c.note = m.comment;
    return c;
  }

  function outcomeOf(o) {
    const groups = (o.groups || []).map(g => g.id);
    const n = {};
    for (const d of (o.denoms || []).slice(0, 1)) for (const c of d.counts || []) n[c.groupId] = intOf(c.value);
    const rows = [];
    let truncated = 0;
    for (const cls of o.classes || []) {
      for (const cat of cls.categories || []) {
        if (rows.length >= OUTCOME_ROWS) { truncated++; continue; }
        const by = Object.fromEntries((cat.measurements || []).map(m => [m.groupId, m]));
        rows.push({
          label: [cls.title, cat.title].filter(Boolean).join(' · '),
          cells: groups.map(id => cellOf(by[id]))
        });
      }
    }
    const title = id => ((o.groups || []).find(g => g.id === id) || {}).title || id;
    const disp = o.dispersionType || '';
    return {
      type: o.type || '',
      title: o.title || '',
      description: o.description || '',
      timeFrame: o.timeFrame || '',
      unit: o.unitOfMeasure || '',
      param: o.paramType || '',
      paramLabel: PARAM[o.paramType] != null ? PARAM[o.paramType] : String(o.paramType || '').toLowerCase().replace(/_/g, ' '),
      dispersion: disp,
      spreadLabel: DISPERSION[disp] || (/confidence/i.test(disp) ? disp.replace(/ Confidence Interval/i, ' CI') : disp),
      posted: o.reportingStatus !== 'NOT_POSTED',
      groups: (o.groups || []).map(g => ({ title: g.title || '', n: n[g.id] != null ? n[g.id] : null })),
      rows, truncated,
      analyses: (o.analyses || []).slice(0, 6).map(a => ({
        groups: (a.groupIds || []).map(title),
        p: a.pValue || '',
        method: a.statisticalMethod || '',
        estimate: a.paramType ? {
          kind: a.paramType, value: a.paramValue || '',
          ci: a.ciLowerLimit || a.ciUpperLimit ? { pct: a.ciPctValue || '', lower: a.ciLowerLimit || '', upper: a.ciUpperLimit || '' } : null
        } : null
      }))
    };
  }

  /* Harms: per group, how many were at risk and how many had a serious event,
     any other event, or died; then the commonest events by the highest rate
     in any group, so a side effect that only the drug arm had comes first. */
  function harmsOf(ae) {
    if (!ae || !(ae.eventGroups || []).length) return null;
    const ids = ae.eventGroups.map(g => g.id);
    const groups = ae.eventGroups.map(g => ({
      title: g.title || '',
      atRisk: intOf(g.seriousNumAtRisk != null ? g.seriousNumAtRisk : g.otherNumAtRisk),
      serious: intOf(g.seriousNumAffected), other: intOf(g.otherNumAffected),
      deaths: intOf(g.deathsNumAffected), deathsAtRisk: intOf(g.deathsNumAtRisk)
    }));
    const events = (list, keep) => {
      const merged = new Map();
      for (const e of list || []) {
        const term = e.term || '';
        const by = merged.get(term) || {};
        for (const st of e.stats || []) {
          const prev = by[st.groupId] || { affected: 0, atRisk: intOf(st.numAtRisk) };
          prev.affected += intOf(st.numAffected) || 0;
          by[st.groupId] = prev;
        }
        merged.set(term, by);
      }
      return [...merged].map(([term, by]) => {
        const cells = ids.map(id => by[id] || { affected: 0, atRisk: null });
        const top = Math.max(0, ...cells.map(c => (c.atRisk ? c.affected / c.atRisk : 0)));
        return { term, cells, top };
      }).filter(e => e.top > 0).sort((a, b) => b.top - a.top).slice(0, keep);
    };
    return {
      groups,
      threshold: ae.frequencyThreshold || '',
      timeFrame: ae.timeFrame || '',
      common: events(ae.otherEvents, 8),
      serious: events(ae.seriousEvents, 5),
      seriousTotal: new Set((ae.seriousEvents || []).map(e => e.term)).size
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
      return { studies: (data.studies || []).map(normalize), next: data.nextPageToken || null, total: data.totalCount, via, rewrite: effectiveQuery(state) };
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

  /* ── the site account ──
     Tracking belongs to the site account — the same one as ATLAS and
     HERMISCUS (assets/site-gate.js), approved by Ric for the `studies` page.
     The list lives in Supabase (atlas/supabase/migrations/…_studies_watchlist.sql),
     one row per study per person, readable only by its owner.

     supabase-js comes from unpkg, so it is loaded only when it is needed: when
     this browser already holds an account session, or when somebody reaches
     for the sign-in. A visitor without an account loads none of it. */
  const SITE_ROOT = (() => {
    try { return new URL('../../', document.currentScript.src).href; } catch (e) { return ''; }
  })();
  const PAGE = 'studies';

  /* supabase-js keeps its session in localStorage as sb-<project>-auth-token.
     Looked for by shape rather than by name, so the local stack's key counts. */
  function hasSession() {
    try {
      for (let i = 0; i < root.localStorage.length; i++) {
        if (/^sb-.+-auth-token$/.test(root.localStorage.key(i))) return true;
      }
    } catch (e) {}
    return false;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new TrialError('could not load ' + src, 0));
      document.head.appendChild(el);
    });
  }
  let gatePromise = null;
  function gate() {
    if (root.SiteGate) return Promise.resolve(root.SiteGate);
    if (!gatePromise) {
      gatePromise = (async () => {
        if (!root.supabase) await loadScript('https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js');
        if (!root.CONFIG) await loadScript(SITE_ROOT + 'atlas/config.js');
        await loadScript(SITE_ROOT + 'assets/site-gate.js');
        return root.SiteGate;
      })();
      gatePromise.catch(() => { gatePromise = null; });
    }
    return gatePromise;
  }

  /* 'signed-out' | 'waiting' | 'denied' | 'error' | 'ok', plus the email. */
  async function access() {
    if (!hasSession() && !root.SiteGate) return { state: 'signed-out' };
    return (await gate()).check(PAGE);
  }

  const fail = e => { throw new TrialError((e && e.message) || 'the watchlist is unavailable right now', (e && e.code) || 0); };
  async function table() { return (await gate()).db().from('trial_watch'); }

  async function watchList() {
    const { data, error } = await (await table()).select('nct_id,title,seen,seen_at,added_at');
    if (error) fail(error);
    const items = {};
    for (const r of data || []) items[r.nct_id] = { id: r.nct_id, title: r.title, seen: r.seen, seenAt: r.seen_at, added: r.added_at };
    return items;
  }
  const row = r => ({ id: r.nct_id, title: r.title, seen: r.seen, seenAt: r.seen_at, added: r.added_at });

  async function track(n) {
    const { data, error } = await (await table())
      .upsert({ nct_id: n.id, title: String(n.title || '').slice(0, 300), seen: snapshot(n), seen_at: new Date().toISOString() },
              { onConflict: 'user_id,nct_id' })
      .select().single();
    if (error) fail(error);
    return { item: row(data) };
  }
  async function acknowledge(n) {
    const { data, error } = await (await table())
      .update({ seen: snapshot(n), seen_at: new Date().toISOString() })
      .eq('nct_id', n.id).select().single();
    if (error) fail(error);
    return { item: row(data) };
  }
  async function untrack(id) {
    const { error } = await (await table()).delete().eq('nct_id', id);
    if (error) fail(error);
    return { removed: id };
  }

  async function signIn(email, password) { await (await gate()).signIn(email, password); return access(); }
  async function signOut() { if (root.SiteGate || hasSession()) await (await gate()).signOut(); }
  async function requestAccess() { await (await gate()).requestAccess(PAGE); return access(); }
  const accountUrl = () => SITE_ROOT + 'account/?for=' + PAGE;

  /* The whole check, for the front door and the watch card alike: the list,
     each study as it is now, and which of them moved since last seen. */
  async function checkWatch(signal) {
    if ((await access()).state !== 'ok') return null;
    const items = await watchList();
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
    statusOf, phaseText, asNct, effectiveQuery, BRANDS, WHOLE, buildParams, normalize, resultsOf, placeSummary, fmtDate, snapshot, changes,
    search, study, byIds, hasSession, access, signIn, signOut, requestAccess, accountUrl,
    watchList, track, acknowledge, untrack, checkWatch, TrialError,
    studyUrl: STUDY_URL, host
  };
  root.Trials = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
