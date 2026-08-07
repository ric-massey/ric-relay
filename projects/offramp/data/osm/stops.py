"""Rest areas and truck stops, placed on the corridor.

These are the simplest thing on an Interstate that you can drive into and
out of without ever turning: leave right, run parallel past the parking,
rejoin. Two hundred and fifty of them on I-40, and they come out of OSM
with their real names on.

What is taken from the survey is WHERE and WHICH SIDE and WHAT IT IS
CALLED. The shape is not: OSM maps a rest area as a parking-lot outline
and its internal service roads, which is not a drivable centreline and
would need a second extraction to become one. The loop itself is built by
the game from the same ramp machinery as everything else.
"""
import json, math, glob, sys
sys.path.insert(0, '.')
from extract import geod

MI = 1609.34

def centroid(e):
    if e['type'] == 'node': return {'lat': e['lat'], 'lon': e['lon']}
    g = e.get('geometry') or []
    if not g: return None
    return {'lat': sum(p['lat'] for p in g) / len(g),
            'lon': sum(p['lon'] for p in g) / len(g)}

def load_stops(paths):
    out, seen = [], set()
    for f in paths:
        try: d = json.load(open(f))
        except Exception: continue
        for e in d['elements']:
            h = e.get('tags', {}).get('highway')
            if h not in ('rest_area', 'services'): continue
            key = (e['type'], e['id'])
            if key in seen: continue
            seen.add(key)
            c = centroid(e)
            if c: out.append({'c': c, 'kind': h, 'name': e['tags'].get('name'),
                              'tags': e['tags']})
    return out

def place(stops, chain_pts, cum, max_m=900):
    """Nearest point on the corridor, and which side of it."""
    grid = {}
    for i, q in enumerate(chain_pts):
        grid.setdefault((round(q['lat'], 2), round(q['lon'], 2)), []).append(i)
    placed = []
    for s in stops:
        c = s['c']
        best, bi = 1e18, -1
        for dla in (-0.02, -0.01, 0, 0.01, 0.02):
            for dlo in (-0.02, -0.01, 0, 0.01, 0.02):
                for i in grid.get((round(c['lat'] + dla, 2), round(c['lon'] + dlo, 2)), ()):
                    d, _ = geod(c, chain_pts[i])
                    if d < best: best, bi = d, i
        if bi < 0 or best > max_m: continue
        # side: bearing of the road here vs bearing to the stop
        j = min(bi + 1, len(chain_pts) - 1)
        if j == bi: continue
        _, road_b = geod(chain_pts[bi], chain_pts[j])
        _, to_b = geod(chain_pts[bi], c)
        rel = (to_b - road_b + math.pi * 3) % (math.pi * 2) - math.pi
        placed.append({
            'name': s['name'], 'kind': s['kind'],
            'px': cum[bi] / 0.179, 'mi': cum[bi] / MI,
            'side': 1 if rel > 0 else -1,     # +1 = right of eastbound travel
            'off_m': round(best),
        })
    placed.sort(key=lambda p: p['px'])
    return placed

if __name__ == '__main__':
    from extract import load, chain, stitch, develop
    ways, junc = load([f'v2/{n}.json' for n in
        ['CA_AZ','AZ_NM','NM','TX_OK','OK_AR','AR_TN','TN_E','NC']])
    devs = sorted((develop(c, junc) for c in stitch(chain(ways), junc)),
                  key=lambda d: -d['cum'][-1])
    d = devs[0]
    stops = load_stops(sorted(glob.glob('ramps/*.json')))
    print(f"rest areas / services in the raw data: {len(stops)}")
    placed = place(stops, d['pts'], d['cum'])
    print(f"placed on the corridor: {len(placed)}")
    right = sum(1 for p in placed if p['side'] > 0)
    print(f"  right of eastbound travel: {right}   left: {len(placed)-right}")
    named = [p for p in placed if p['name']]
    print(f"  named: {len(named)}")
    print(f"\nfirst few, in order along the road:")
    for p in placed[:10]:
        print(f"   mi {p['mi']:7.1f}  {'R' if p['side']>0 else 'L'}  "
              f"{p['off_m']:4d} m off  {p['kind']:9s}  {p['name'] or '(unnamed)'}")
    json.dump(placed, open('stops.json','w'), separators=(',',':'))
