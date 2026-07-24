#!/usr/bin/env python3
"""Structural checks for The Shape of Harm. Standard library only."""
from pathlib import Path
import csv, json, re, sys
ROOT=Path(__file__).resolve().parent
html=(ROOT/'index.html').read_text(encoding='utf-8')
research=(ROOT/'research.html').read_text(encoding='utf-8') if (ROOT/'research.html').exists() else ''
errors=[]
def need(condition,message):
    if not condition: errors.append(message)

# Public explorer shell and fail-open behavior.
need('<main id="main-content"' in html,'missing main landmark')
need('class="skip-link"' in html,'missing skip link')
need('app-ready .view{display:none}' in html,'views are not fail-open')
need('function validateRuntime()' in html,'missing runtime self-check')
need('https://shape-of-harm.netlify.app/' in html,'canonical domain missing')
need('https://the-shape-of-harm.netlify.app/' not in html,'obsolete domain remains')
need(len(re.findall(r'class="refitem" id="r\d+"',html))==49,'reference markup count is not 49')
need(len(re.findall(r'<button(?![^>]*\btype=)',html))==0,'button without type found')
need('href="research.html"' in html,'public explorer does not link to research framework')

# IDs and local hash links in the public explorer.
markup=re.sub(r'<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>','',html,flags=re.I|re.S)
ids=re.findall(r'\bid="([^"]+)"',markup)
need(len(ids)==len(set(ids)),'duplicate HTML id found')
frags=re.findall(r'href="#([^"\s]+)"',markup)
view_names={'ranking','safety','harms','dose','who','reliability','weaknesses','sources','about'}
for frag in frags:
    if frag.startswith('w=') or frag in view_names: continue
    need(frag in set(ids),f'broken fragment #{frag}')

# Legacy data and embedded model consistency.
rows=list(csv.DictReader((ROOT/'scores.csv').open(encoding='utf-8',newline='')))
need(len(rows)==65,'scores.csv must contain 65 cells')
need(len({r['drug'] for r in rows})==13,'scores.csv must contain 13 substances')
need({r['criterion_key'] for r in rows}=={'add','wd','org','oth','ac'},'criterion keys differ')
block=re.search(r'const DRUGS\s*=\s*\[(.*?)\];\s*\n\nconst COLS',html,re.S)
need(block is not None,'embedded DRUGS block missing')
embedded={}
if block:
    pat=re.compile(r'\{name:"([^"]+)".*?s:\{\s*add:\s*([^,]+),\s*wd:\s*([^,]+),\s*org:\s*([^,]+),\s*oth:\s*([^,]+),\s*ac:\s*([^}]+)\}',re.S)
    for name,*vals in pat.findall(block.group(1)):
        def number(v):
            v=v.strip()
            return None if v=='null' else float(v)
        embedded[name]=dict(zip(('add','wd','org','oth','ac'),map(number,vals)))
    need(len(embedded)==13,'could not parse all embedded substances')
conf_block=re.search(r'const CONF=\{(.*?)\};',html,re.S)
conf=dict(re.findall(r'"([^"]+)":"([MPJS]{5})"',conf_block.group(1) if conf_block else ''))
need(len(conf)==13,'could not parse embedded evidence map')
for row in rows:
    name,key=row['drug'],row['criterion_key']
    csv_score=None if not row['score'] else float(row['score'])
    need(name in embedded and embedded[name].get(key)==csv_score,f'embedded score differs: {name} / {key}')
    idx=('add','wd','org','oth','ac').index(key)
    need(name in conf and conf[name][idx]==row['evidence_grade'],f'embedded grade differs: {name} / {key}')

refs=json.loads((ROOT/'references.json').read_text(encoding='utf-8'))
need(refs.get('count')==49 and len(refs.get('references',[]))==49,'references.json count differs')
json_ref_ids={int(r['id']) for r in refs.get('references',[])}
html_ref_ids={int(x) for x in re.findall(r'class="refitem" id="r(\d+)"',markup)}
need(json_ref_ids==html_ref_ids==set(range(1,50)),'reference IDs differ between HTML and JSON')
w=json.loads((ROOT/'weighting.json').read_text(encoding='utf-8'))
need(w.get('substance_count')==13 and w.get('cell_count')==65,'weighting.json counts differ')
version=json.loads((ROOT/'version.json').read_text(encoding='utf-8'))
need(version.get('canonical')=='https://shape-of-harm.netlify.app/','version canonical differs')
need(version.get('research_framework')=='v0.8','research framework version missing or stale')
need(version.get('estimand_registry')=='v0.2','estimand registry version missing')

# Audit artifacts.
for extra in ['evidence-audit.csv','instrument-v6.json','INSTRUMENT_AUDIT_2026-07-23.md']:
    need((ROOT/extra).exists(),f'missing audit artifact: {extra}')
need('legacy exploratory model' in html.lower(),'legacy-model status warning missing')
need(html.index('id="wobble"') < html.index('id="chart"'),'uncertainty control is not above chart')
with (ROOT/'evidence-audit.csv').open(newline='',encoding='utf-8') as f:
    audit_rows=list(csv.DictReader(f))
need(len(audit_rows)==65,'evidence-audit.csv does not contain 65 cells')
v6=json.loads((ROOT/'instrument-v6.json').read_text(encoding='utf-8'))
need(v6.get('status')=='specification_not_scored_or_validated','v6 status is not explicit')

# Research-framework artifacts and semantics.
research_files=[
    'research.html','RESEARCH_PROTOCOL_V0.2.md','VALIDATION_PLAN.md',
    'scenario-registry.csv','outcome-dictionary.csv','evidence-extraction-template.csv','instrument-v7.json',
    'estimands.html','PILOT_ESTIMANDS_V0.2.md','estimand-registry.csv','estimands-v0.2.json','estimand-content-validity-form.csv','estimand-feasibility-register.csv','ESTIMAND_IMPLEMENTATION_AUDIT.md'
]
for extra in research_files:
    need((ROOT/extra).exists(),f'missing research artifact: {extra}')
need('methodological hardening v0.8' in research.lower(),'research page status is not explicit')
need('href="estimands.html"' in research,'research page does not link to defined estimands')
need('no v7 scores exist' in research.lower(),'research page does not explicitly state that no v7 scores exist')
need('cronbach' in research.lower(),'research page omits formative/composite validation warning')
need('href="index.html"' in research,'research page has no route back to explorer')
research_markup=re.sub(r'<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>','',research,flags=re.I|re.S)
research_ids=re.findall(r'\bid="([^"]+)"',research_markup)
need(len(research_ids)==len(set(research_ids)),'duplicate research-page HTML id found')
for frag in re.findall(r'href="#([^"\s]+)"',research_markup):
    need(frag in set(research_ids),f'broken research fragment #{frag}')

v7=json.loads((ROOT/'instrument-v7.json').read_text(encoding='utf-8'))
need(v7.get('status')=='external_review_launch_package_prepared_pending_team_registration_and_search','v7 status is not explicit')
need(v7.get('version')=='0.7','v7 framework version differs')
need(len(v7.get('pilot_estimands',[]))==4,'v7 must register four pilot estimands')
need(v7.get('identity',{}).get('primary')=='scenario_based_comparative_risk_model','v7 scientific identity differs')
need(len(v7.get('required_scenario_fields',[]))>=15,'v7 scenario definition is incomplete')

with (ROOT/'scenario-registry.csv').open(newline='',encoding='utf-8') as f:
    scenarios=list(csv.DictReader(f))
need(len(scenarios)>=5,'scenario registry lacks template/candidate records')
need(all(r.get('status') in {'example_not_for_analysis','candidate_not_locked','provisional_frozen_pending_content_review','locked','retired'} for r in scenarios),'scenario status is invalid')
need(sum(r.get('status')=='provisional_frozen_pending_content_review' for r in scenarios)==4,'scenario registry must contain four provisionally frozen pilots')
need(not any(r.get('status')=='locked' for r in scenarios),'draft package must not claim panel-approved lock')

with (ROOT/'outcome-dictionary.csv').open(newline='',encoding='utf-8') as f:
    outcomes=list(csv.DictReader(f))
need(len(outcomes)>=10,'outcome dictionary is too small')
need(len({r['outcome_id'] for r in outcomes})==len(outcomes),'duplicate outcome ID')
need(all(r.get('denominator') and r.get('overlap_guard') for r in outcomes),'outcome missing denominator or overlap guard')

with (ROOT/'evidence-extraction-template.csv').open(newline='',encoding='utf-8') as f:
    extraction_fields=next(csv.reader(f))
for field in ['estimand_id','scenario_id','population_match','exposure_match','comparator_match','outcome_id','time_window_match','intercurrent_event_match','summary_measure_compatibility','effect_measure','effect_value','denominator_source','numerator_denominator_compatible','risk_of_bias_judgment','second_reviewer_status','data_contribution_status']:
    need(field in extraction_fields,f'extraction template missing {field}')


# Pilot estimand registry and readable page.
estimand_page=(ROOT/'estimands.html').read_text(encoding='utf-8')
need('none of these rows may be ranked together' in estimand_page.lower(),'estimand page lacks no-ranking warning')
need('provisional freeze' in estimand_page.lower(),'estimand page status is unclear')
estimand_markup=re.sub(r'<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>','',estimand_page,flags=re.I|re.S)
estimand_ids_html=set(re.findall(r'\bid="(EST-[A-Z-]+\d+)"',estimand_markup))
with (ROOT/'estimand-registry.csv').open(newline='',encoding='utf-8') as f:
    estimands=list(csv.DictReader(f))
need(len(estimands)==4,'estimand registry must contain exactly four pilot estimands')
need(len({r['estimand_id'] for r in estimands})==4,'duplicate estimand ID')
expected_estimands={'EST-AE-ALC-001','EST-RU-TOB-001','EST-AE-OPI-001','EST-AE-PSI-001'}
need({r['estimand_id'] for r in estimands}==expected_estimands,'pilot estimand IDs differ')
need(estimand_ids_html==expected_estimands,'estimand page does not expose all registered estimands')
required_estimand_fields=['estimand_sentence','target_population','exposure_strategy','comparator_strategy','outcome_set','time_horizon','intercurrent_events_strategy','summary_measure','geography','calendar_period','comparability_class','primary_data_need','identification_assumptions','prohibited_interpretation']
for row in estimands:
    need(row.get('status')=='provisional_frozen_pending_content_review',f"estimand status differs: {row.get('estimand_id')}")
    for field in required_estimand_fields:
        need(bool(row.get(field)),f"estimand {row.get('estimand_id')} missing {field}")
need(len({r['scenario_id'] for r in estimands})==4,'estimands must reference four unique scenarios')
registered_scenario_ids={r['scenario_id'] for r in scenarios if r.get('status')=='provisional_frozen_pending_content_review'}
need({r['scenario_id'] for r in estimands}==registered_scenario_ids,'scenario and estimand registries disagree')
ests=json.loads((ROOT/'estimands-v0.2.json').read_text(encoding='utf-8'))
need(ests.get('version')=='0.2' and len(ests.get('estimands',[]))==4,'estimands JSON differs')
need('must not be placed in one cross-substance rank' in ests.get('cross_scenario_rule',''),'machine-readable comparison guard missing')
with (ROOT/'estimand-content-validity-form.csv').open(newline='',encoding='utf-8') as f:
    cv=list(csv.DictReader(f))
need(len(cv)==40,'content-validity form should contain 10 domains for each of four estimands')
need({r['estimand_id'] for r in cv}==expected_estimands,'content-validity form estimand IDs differ')
with (ROOT/'estimand-feasibility-register.csv').open(newline='',encoding='utf-8') as f:
    feas=list(csv.DictReader(f))
need(len(feas)==12,'feasibility register should contain three required data elements for each estimand')
need({r['estimand_id'] for r in feas}==expected_estimands,'feasibility register estimand IDs differ')
need(all(r.get('decision') and r.get('decision')!='pending' for r in feas),'feasibility decisions are incomplete')


# v0.3 feasibility, v0.4 evidence pilot, and v0.5 certainty artifacts.
feasibility_page=(ROOT/'feasibility.html').read_text(encoding='utf-8') if (ROOT/'feasibility.html').exists() else ''
for extra in ['feasibility.html','DATA_FEASIBILITY_REVIEW_V0.3.md','data-source-register.csv','candidate-study-registry.csv','PSILOCYBIN_SAFETY_REVIEW_PROTOCOL_V0.1.md','psilocybin-screening-form.csv','risk-of-bias-template.csv','CONTENT_VALIDITY_REVIEWER_GUIDE_V0.1.md','reviewer-conflict-disclosure.csv','CHANGELOG.md']:
    need((ROOT/extra).exists(),f'missing v0.3 artifact: {extra}')
need('author feasibility screen' in feasibility_page.lower(),'feasibility page does not disclose author-screen status')
need('href="feasibility.html"' in research,'research page does not link to feasibility decisions')
need(version.get('first_evidence_review')=='EST-AE-PSI-001','first evidence review not registered')
with (ROOT/'data-source-register.csv').open(newline='',encoding='utf-8') as f:
    ds=list(csv.DictReader(f))
need(len(ds)>=8,'data-source register is too small')
need(all(r.get('critical_limitation') and r.get('alignment') for r in ds),'data-source register missing alignment/limitation')
with (ROOT/'candidate-study-registry.csv').open(newline='',encoding='utf-8') as f:
    candidates=list(csv.DictReader(f))
need(len(candidates)>=3,'candidate-study registry is too small')
need(all(r.get('directness') and r.get('screen_status') for r in candidates),'candidate-study registry fields incomplete')


# v0.4 evidence-pilot artifacts.
evidence_page=(ROOT/'evidence.html').read_text(encoding='utf-8') if (ROOT/'evidence.html').exists() else ''
for extra in ['evidence.html','PSILOCYBIN_EVIDENCE_SYNTHESIS_V0.1.md','PROTOCOL_IMPLEMENTATION_NOTE_V0.1.md','psilocybin-search-log.csv','psilocybin-screening-log.csv','psilocybin-data-extraction.csv','psilocybin-outcome-synthesis.csv','psilocybin-rob2-pilot.csv','analyze_psilocybin.py']:
    need((ROOT/extra).exists(),f'missing v0.4 evidence artifact: {extra}')
need('single-author pilot' in evidence_page.lower(),'evidence page does not disclose single-author status')
need('0 / 67' in evidence_page,'evidence page missing direct SAE count')
need('href="evidence.html"' in research,'research page does not link to evidence pilot')
with (ROOT/'psilocybin-outcome-synthesis.csv').open(newline='',encoding='utf-8') as f:
    outcomes=list(csv.DictReader(f))
need(len(outcomes)==5,'psilocybin synthesis should contain five outcome rows')
need(sum(r['release_status']=='report_with_major_imprecision' for r in outcomes)==1,'exactly one outcome should be releasable')
need(sum(r['release_status']=='not_estimable' for r in outcomes)==3,'three outcomes should remain not estimable')


# v0.5 certainty and information artifacts.
certainty_page=(ROOT/'certainty.html').read_text(encoding='utf-8') if (ROOT/'certainty.html').exists() else ''
for extra in ['certainty.html','CERTAINTY_AND_INFORMATION_ANALYSIS_V0.1.md','grade-evidence-profile.csv','rare-event-sensitivity.csv','information-size-targets.csv','review-readiness-checklist.csv','psilocybin-certainty.json','analyze_certainty.py']:
    need((ROOT/extra).exists(),f'missing v0.5 certainty artifact: {extra}')
need('provisional author judgment' in certainty_page.lower(),'certainty page does not disclose provisional author status')
need('very low' in certainty_page.lower(),'certainty page omits certainty rating')
need('href="certainty.html"' in research,'research page does not link to certainty gate')
need('href="certainty.html"' in evidence_page,'evidence page does not link to certainty gate')
with (ROOT/'grade-evidence-profile.csv').open(newline='',encoding='utf-8') as f:
    grade_rows=list(csv.DictReader(f))
need(len(grade_rows)==1,'certainty profile should contain one currently estimable critical outcome')
need(grade_rows[0].get('certainty')=='very_low_provisional','certainty profile rating differs')
with (ROOT/'rare-event-sensitivity.csv').open(newline='',encoding='utf-8') as f:
    sens_rows=list(csv.DictReader(f))
need(len(sens_rows)==5,'rare-event sensitivity table should contain five analyses')
need(any(r.get('events')=='1' and r.get('n')=='67' for r in sens_rows),'one-event fragility analysis missing')
with (ROOT/'information-size-targets.csv').open(newline='',encoding='utf-8') as f:
    target_rows=list(csv.DictReader(f))
need(len(target_rows)==5,'information-size target table should contain five thresholds')
need(any(r.get('upper_bound_target_per_1000')=='10' and r.get('zero_event_total_n_required')=='368' for r in target_rows),'10 per 1000 information target differs')
certainty_json=json.loads((ROOT/'psilocybin-certainty.json').read_text(encoding='utf-8'))
need(certainty_json.get('certainty',{}).get('grade')=='very_low_provisional','machine-readable certainty differs')

# v0.6 independent-replication artifacts.
replication_page=(ROOT/'replication.html').read_text(encoding='utf-8') if (ROOT/'replication.html').exists() else ''
for extra in ['replication.html','PSILOCYBIN_INDEPENDENT_REPLICATION_PROTOCOL_V0.2.md','REGISTRATION_SUBMISSION_DRAFT_V0.6.md','search-strategies-v0.6.csv','review-team-roles.csv','screening-assignments.csv','dual-screening-form.csv','full-text-exclusion-codes.csv','independent-data-extraction-form.csv','adjudication-log.csv','rob2-result-level-form.csv','grade-independent-adjudication-form.csv','press-search-peer-review-form.csv','author-contact-log.csv','prisma-flow-live.csv','protocol-deviations.csv','protocol-lock.json','INDEPENDENT_REVIEWER_GUIDE_V0.6.md']:
    need((ROOT/extra).exists(),f'missing v0.6 replication artifact: {extra}')
need('does not claim that independence has already happened' in replication_page.lower(),'replication page lacks independence disclaimer')
need('href="replication.html"' in research,'research page does not link to replication package')
need('href="replication.html"' in evidence_page,'evidence page does not link to replication package')
need('href="replication.html"' in certainty_page,'certainty page does not link to replication package')
with (ROOT/'search-strategies-v0.6.csv').open(newline='',encoding='utf-8') as f:
    search_rows=list(csv.DictReader(f))
need(len(search_rows)==10,'v0.6 should specify ten search sources')
need(all(r.get('execution_status') and r.get('peer_review_status') for r in search_rows),'search strategy status fields incomplete')
with (ROOT/'candidate-study-registry.csv').open(newline='',encoding='utf-8') as f:
    candidate_v06=list(csv.DictReader(f))
need(len(candidate_v06)==13,'candidate seed registry should contain thirteen records')
need(all(r.get('independent_review_status') for r in candidate_v06),'candidate records lack independent-review status')
with (ROOT/'review-team-roles.csv').open(newline='',encoding='utf-8') as f:
    roles=list(csv.DictReader(f))
need(len(roles)>=6,'review team role registry too small')
need(all(not r.get('assigned_person') for r in roles),'v0.6 must not invent reviewer assignments')
lock=json.loads((ROOT/'protocol-lock.json').read_text(encoding='utf-8'))
need(lock.get('pilot_already_existed') is True,'protocol lock must disclose prior pilot')
need(len(lock.get('files',[]))>=15,'protocol lock file list too small')
for row in lock.get('files',[]):
    path=ROOT/row['path']; need(path.exists(),f"locked file missing: {row['path']}")
    if path.exists():
        import hashlib
        need(hashlib.sha256(path.read_bytes()).hexdigest()==row['sha256'],f"locked file hash differs: {row['path']}")

# v0.7 external-review launch artifacts.
launch_page=(ROOT/'launch.html').read_text(encoding='utf-8') if (ROOT/'launch.html').exists() else ''
for extra in ['launch.html','EXTERNAL_REVIEW_LAUNCH_PLAN_V0.7.md','SEARCH_EXECUTION_SOP_V0.7.md','DEDUPLICATION_AND_STUDY_LINKAGE_SOP_V0.7.md','DATA_MANAGEMENT_AND_BLINDING_SOP_V0.7.md','PRESS_REVIEW_REQUEST_V0.7.md','REVIEWER_RECRUITMENT_BRIEF_V0.7.md','evidence-corpus-v0.7.csv','study-family-registry.csv','source-verification-log-v0.7.csv','search-execution-status-v0.7.csv','launch-readiness-v0.7.json','launch-manifest-v0.7.json','build_reviewer_packets.py','validate_launch.py']:
    need((ROOT/extra).exists(),f'missing v0.7 launch artifact: {extra}')
need('no new safety result' in launch_page.lower(),'launch page does not separate infrastructure from scientific result')
need('href="launch.html"' in replication_page,'replication page does not link to launch gate')
need('href="launch.html"' in research,'research page does not link to launch gate')
need('href="hardening.html"' in research,'research page does not link to v0.8 hardening gate')
with (ROOT/'evidence-corpus-v0.7.csv').open(newline='',encoding='utf-8') as f:
    corpus_v07=list(csv.DictReader(f))
need(len(corpus_v07)==13,'v0.7 evidence corpus should contain thirteen seed records')
need(all(r.get('independent_screen_status')=='not_started' for r in corpus_v07),'v0.7 corpus prepopulates independent decisions')
readiness=json.loads((ROOT/'launch-readiness-v0.7.json').read_text(encoding='utf-8'))
need(readiness.get('independent_search',{}).get('sources_executed')==0,'v0.7 must not claim independent searches were executed')
need(readiness.get('packet_generation',{}).get('status')=='blocked','reviewer packet guard should be blocked before launch gates')

# Local file links on research, estimand, feasibility, evidence, and certainty pages should resolve.
for page_name,page_text in [('research.html',research),('estimands.html',estimand_page),('feasibility.html',feasibility_page),('evidence.html',evidence_page),('certainty.html',certainty_page),('replication.html',replication_page)]:
    for href in re.findall(r'href="([^"#]+)"',page_text):
        if '://' in href or href.startswith('mailto:'): continue
        target=href.split('?',1)[0]
        need((ROOT/target).exists(),f'broken local link in {page_name}: {href}')

if errors:
    print('STRUCTURAL CHECK FAILED')
    for e in errors: print(' -',e)
    sys.exit(1)
print('STRUCTURAL CHECK PASSED: legacy explorer consistent; research framework v0.8, estimands, feasibility, evidence pilot, provisional certainty, replication package, launch gate, and methodological hardening agree.')
