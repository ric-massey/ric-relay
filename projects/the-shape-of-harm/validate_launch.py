#!/usr/bin/env python3
from pathlib import Path
import csv, json, re, sys
ROOT=Path(__file__).resolve().parent
errors=[]

def rows(name):
    with (ROOT/name).open(newline='',encoding='utf-8') as f: return list(csv.DictReader(f))
legacy=rows('candidate-study-registry.csv')
corpus=rows('evidence-corpus-v0.7.csv')
families=rows('study-family-registry.csv')
version=json.loads((ROOT/'version.json').read_text())
ris_count=sum(1 for line in (ROOT/'candidate-study-registry.ris').read_text().splitlines() if line.startswith('TY  -'))
for label,count in [('candidate CSV',len(legacy)),('detailed corpus',len(corpus)),('study families',len(families)),('RIS',ris_count),('version metadata',version.get('candidate_seed_records'))]:
    if count!=13: errors.append(f'{label} count is {count}, expected 13')
ids=[r['record_id'] for r in corpus]
if len(ids)!=len(set(ids)): errors.append('duplicate record IDs')
fids=[r['study_family_id'] for r in corpus]
if len(fids)!=len(set(fids)): errors.append('duplicate study family IDs in current seed corpus')
if any(r['independent_screen_status']!='not_started' for r in corpus): errors.append('independent decisions were prepopulated')
if any(not r['source_url'].startswith('https://') for r in corpus): errors.append('non-HTTPS source URL')
required=['launch.html','EXTERNAL_REVIEW_LAUNCH_PLAN_V0.7.md','SEARCH_EXECUTION_SOP_V0.7.md','DEDUPLICATION_AND_STUDY_LINKAGE_SOP_V0.7.md','DATA_MANAGEMENT_AND_BLINDING_SOP_V0.7.md','launch-readiness-v0.7.json']
for name in required:
    if not (ROOT/name).exists(): errors.append(f'missing {name}')
if errors:
    print('FAIL')
    for e in errors: print(' -',e)
    sys.exit(1)
print('PASS: v0.7 launch integrity checks')
print(' - 13 records agree across CSV, RIS, families, and version metadata')
print(' - no independent screening decisions are prepopulated')
print(' - launch gate files are present')
