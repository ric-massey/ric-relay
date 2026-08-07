"""Destination text for each exit, from the ramp links that leave it.

A guide sign says three things: the exit number, the route you are
joining, and the place it goes. OSM puts the first on the
`motorway_junction` node and the other two on the `motorway_link` ways
that start there, as `destination:ref` and `destination`. Joining them by
shared node id is exact — no distance guessing.
"""
import json, glob, collections, sys
sys.path.insert(0, '.')
from extract import load

def clean(s, limit=2):
    """OSM separates alternatives with ';'. A sign has room for two."""
    if not s: return None
    parts = [p.strip() for p in s.split(';') if p.strip()]
    seen, out = set(), []
    for p in parts:
        k = p.upper()
        if k in seen: continue
        seen.add(k); out.append(p)
    return out[:limit] or None

def destinations(junc, link_files):
    links = []
    for f in link_files:
        for e in json.load(open(f))['elements']:
            if e.get('tags', {}).get('highway') == 'motorway_link': links.append(e)
    links = list({e['id']: e for e in links}.values())
    by = collections.defaultdict(lambda: {'to': [], 'via': []})
    for w in links:
        t = w['tags']
        d, r = t.get('destination'), t.get('destination:ref')
        if not (d or r): continue
        for nid in (w['nodes'][0], w['nodes'][-1]):
            if nid in junc:
                if d: by[nid]['to'] += clean(d, 4) or []
                if r: by[nid]['via'] += clean(r, 4) or []
                break
    out = {}
    for nid, v in by.items():
        def dedup(xs):
            seen, o = set(), []
            for x in xs:
                k = x.upper()
                if k in seen: continue
                seen.add(k); o.append(x)
            return o
        out[nid] = {'to': dedup(v['to'])[:2], 'via': dedup(v['via'])[:2]}
    return out
