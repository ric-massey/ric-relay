#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
import csv, hashlib, json, sys
ROOT=Path(__file__).resolve().parent
errors=[]

def csv_rows(name):
    with (ROOT/name).open(newline='',encoding='utf-8') as f:
        return list(csv.DictReader(f))

required=[
 'hardening.html','METHODOLOGICAL_RED_TEAM_V0.8.md','PSILOCYBIN_INDEPENDENT_REPLICATION_PROTOCOL_V0.3.md',
 'red-team-findings-v0.8.csv','harms-outcome-taxonomy-v0.8.csv','evidence-strata-v0.8.csv',
 'analysis-decision-rules-v0.8.csv','protocol-amendments-v0.8.csv','independent-data-extraction-form-v0.8.csv',
 'missing-evidence-assessment-v0.8.csv','participant-public-review-form-v0.8.csv',
 'AI_ASSISTANCE_AND_HUMAN_OVERSIGHT_V0.8.md','PATIENT_AND_PUBLIC_INVOLVEMENT_PLAN_V0.8.md',
 'STATISTICAL_ANALYSIS_PLAN_SHELL_V0.8.md','hardening-readiness-v0.8.json'
]
for name in required:
    if not (ROOT/name).exists(): errors.append(f'missing {name}')

if len(csv_rows('red-team-findings-v0.8.csv'))!=20: errors.append('red-team register must contain 20 findings')
if len(csv_rows('harms-outcome-taxonomy-v0.8.csv'))!=12: errors.append('outcome taxonomy must contain 12 outcomes')
if len(csv_rows('evidence-strata-v0.8.csv'))!=5: errors.append('evidence strata must contain 5 rows')
if len(csv_rows('analysis-decision-rules-v0.8.csv'))<18: errors.append('analysis rules incomplete')

v=json.loads((ROOT/'version.json').read_text())
if v.get('research_framework')!='v0.8': errors.append('version research framework is not v0.8')
if v.get('build')!='2026-07-23-hardening-v0.8-1': errors.append('unexpected build marker')
if v.get('evidence_products')!=2: errors.append('version metadata must declare two evidence products')
if v.get('current_horizon_corpus_complete_for_expanded_protocol') is not False: errors.append('expanded corpus completeness must be false')

p=(ROOT/'PSILOCYBIN_INDEPENDENT_REPLICATION_PROTOCOL_V0.3.md').read_text().lower()
checks=['product a','product b','all-cause serious adverse event','blank values never mean zero','decision concealment','broad safety-capture search','ai assistance']
for term in checks:
    if term not in p: errors.append(f'protocol missing required concept: {term}')

# Local link audit on all HTML files.
class Links(HTMLParser):
    def __init__(self): super().__init__(); self.links=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a':
            d=dict(attrs)
            if d.get('href'): self.links.append(d['href'])
for page in ROOT.glob('*.html'):
    parser=Links(); parser.feed(page.read_text(errors='replace'))
    for href in parser.links:
        if href.startswith(('http://','https://','mailto:','tel:','#','javascript:')): continue
        target=href.split('#',1)[0].split('?',1)[0]
        if target and not (ROOT/target).exists(): errors.append(f'{page.name}: missing local link {target}')


# --- v0.9: document status register ------------------------------------
if not (ROOT/'document-status-register.csv').exists():
    errors.append('missing document-status-register.csv')
else:
    locked={e['path'] for e in json.loads((ROOT/'protocol-lock.json').read_text())['files']}
    seen={}
    for row in csv_rows('document-status-register.csv'):
        name,status,succ=row['file'],row['status'],row['superseded_by']
        if not (ROOT/name).exists():
            errors.append(f'status register names missing file {name}'); continue
        seen[name]=status
        if status=='superseded':
            if not succ or not (ROOT/succ).exists():
                errors.append(f'{name}: superseded_by does not resolve')
            if name not in locked:
                head=(ROOT/name).read_text(errors='replace')[:400].upper()
                if 'SUPERSEDED' not in head:
                    errors.append(f'{name}: superseded but carries no deprecation banner')
    # no two live files may claim the same role
    roles={}
    for row in csv_rows('document-status-register.csv'):
        if row['status']=='current':
            r=row['role']
            if r in roles: errors.append(f'two current files claim role "{r}"')
            roles[r]=row['file']

# --- v0.9: hash manifest must still verify -----------------------------
man=ROOT/'hardening-manifest-v0.8.json'
if man.exists():
    for name,meta in json.loads(man.read_text())['files'].items():
        f=ROOT/name
        if not f.exists(): errors.append(f'manifest names missing file {name}'); continue
        h=hashlib.sha256(f.read_bytes()).hexdigest()
        if h!=meta['sha256']: errors.append(f'manifest hash differs: {name}')

# --- v0.9: released estimate must be declared secondary ----------------
if v.get('released_estimate_outcome_role')!='secondary_attribution_based':
    errors.append('version.json must declare the released estimate as a secondary outcome')
if v.get('primary_serious_event_outcome_estimable') is not False:
    errors.append('all-cause SAE must be declared not estimable')
for page in ('evidence.html','certainty.html'):
    if 'secondary' not in (ROOT/page).read_text(errors='replace').lower():
        errors.append(f'{page} does not label the estimate as secondary')


# --- v0.9: public comprehension layer ----------------------------------
if not (ROOT/'start.html').exists():
    errors.append('missing start.html front door')
else:
    s=' '.join((ROOT/'start.html').read_text(errors='replace').split())
    for must in ('Start here','nothing here is called safe','one choice among many',
                 'A blank is never treated as a zero','independently reviewed'):
        if must.lower() not in s.lower():
            errors.append(f'start.html missing required framing: {must!r}')
    if 'withheld' not in s:
        errors.append('start.html must surface withheld scores rather than dropping them')

# every page reaches the front door and the current gate
for page in ROOT.glob('*.html'):
    if page.name in ('start.html','404.html'): continue
    h=page.read_text(errors='replace')
    for target in ('start.html','hardening.html'):
        if target not in h and page.name!=target:
            errors.append(f'{page.name} does not link to {target}')

# a blank score must never be rendered as 0
import csv as _csv
_blank={(r['drug'],r['criterion']) for r in _csv.DictReader((ROOT/'scores.csv').open(encoding='utf-8'))
        if not r['score'].strip()}
if _blank and (ROOT/'start.html').exists():
    s=' '.join((ROOT/'start.html').read_text(errors='replace').split())
    for drug,crit in _blank:
        if f'{crit.lower()}: withheld' not in s.lower():
            errors.append(f'blank score for {drug}/{crit} is not shown as withheld')

if errors:
    print('FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('PASS: v0.8 methodological-hardening checks')
print(' - 20 red-team findings and 12 outcome definitions present')
print(' - comparative and descriptive evidence products separated')
print(' - all local HTML links resolve')
print(' - current horizon corpus is explicitly not complete for expanded scope')
print(' - document status register resolves; no duplicate live roles')
print(' - v0.8 hash manifest verifies')
print(' - released estimate is labelled a secondary attribution-based outcome')
print(' - public front door present; withheld scores surfaced, never zeroed')
print(' - every page reaches the front door and the current gate')
