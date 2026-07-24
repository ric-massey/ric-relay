#!/usr/bin/env python3
"""Build concealed reviewer packets only after launch gates are satisfied."""
from pathlib import Path
import csv, json, sys

ROOT=Path(__file__).resolve().parent
readiness=json.loads((ROOT/'launch-readiness-v0.7.json').read_text())
missing=[]
if not readiness['information_specialist']['press_review_complete']: missing.append('PRESS-style search peer review')
if readiness['protocol']['registration_status']!='submitted_and_timestamped': missing.append('prospective registration')
if readiness['independent_search']['sources_executed'] < readiness['independent_search']['sources_specified']: missing.append('complete independent search exports or adjudicated access limitations')
if not readiness['independent_search']['deduplicated_corpus_available']: missing.append('frozen deduplicated corpus')
for key in ('reviewer_a_assigned','reviewer_b_assigned','adjudicator_assigned'):
    if not readiness['review_team'][key]: missing.append(key.replace('_',' '))
if missing:
    print('BLOCKED: reviewer packets were not generated.')
    for item in missing: print(' -',item)
    print('This guard prevents the author horizon scan from being mistaken for an independent review corpus.')
    sys.exit(2)
print('Launch gates satisfied. Packet generation implementation can proceed from the frozen deduplicated corpus.')
