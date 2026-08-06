"""Turn Overpass I-40 slices into a corridor: one centreline, real exits.

── the projection, and why it is not a projection ───────────────────────
I-40 spans 39 degrees of longitude. Any single flat projection distorts
somewhere across that, and the two things this game actually needs are
LOCAL shape (the curves) and ALONG-ROUTE distance (so 30 minutes at 45
mph puts you at the right exit). Neither needs global position.

So the road is *developed* onto the plane: walk it point to point taking
the true geodesic distance and true bearing of each step, and integrate
those in a plane where north is fixed. Arc length comes out exact and
every curve keeps its real shape. What drifts is global orientation —
the route slowly curls, because meridians converge and this plane
pretends they do not. You can never see more than 660 px of it, so the
curl is invisible in play; the overview map should be drawn from lat/lon
instead of from world coordinates.
"""
import json, math, sys, collections

R_EARTH = 6371008.8          # mean radius, metres
M_PER_PX = 0.179             # the game's scale

def geod(a, b):
    """distance (m) and initial bearing (rad from north, clockwise)"""
    p1, p2 = math.radians(a['lat']), math.radians(b['lat'])
    dl = math.radians(b['lon'] - a['lon'])
    dp = p2 - p1
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    d = 2 * R_EARTH * math.asin(min(1, math.sqrt(h)))
    y = math.sin(dl) * math.cos(p2)
    x = math.cos(p1)*math.sin(p2) - math.sin(p1)*math.cos(p2)*math.cos(dl)
    return d, math.atan2(y, x)

def load(paths):
    ways, junc = [], {}
    for p in paths:
        try: d = json.load(open(p))
        except Exception as e:
            print(f"  skip {p}: {e}"); continue
        for e in d['elements']:
            if e['type'] == 'way' and e.get('tags', {}).get('highway') == 'motorway':
                ways.append(e)
            elif e['type'] == 'node' and e.get('tags', {}).get('highway') == 'motorway_junction':
                junc[e['id']] = e
    # de-duplicate ways that appear in two overlapping slices
    seen, out = set(), []
    for w in ways:
        if w['id'] in seen: continue
        seen.add(w['id']); out.append(w)
    return out, junc

def _bearing_at(w, end):
    """heading (rad) entering the end of a way, or leaving its start"""
    g = w['geometry']
    if end == 'out':  a, b = g[-2], g[-1]
    else:             a, b = g[0], g[1]
    return geod(a, b)[1]

def chain(ways):
    """Link oneway fragments into carriageways.

    Picking the FIRST candidate at a node is wrong wherever I-40 forks —
    at the I-75 split in Knoxville, at every place a concurrency ends —
    and it is why this produced nine stubs instead of two carriageways.
    A motorway does not turn 60 degrees at a fork; the ramp does. So
    among the ways continuing from a node, take the one that best keeps
    the heading we arrived on."""
    byfirst = collections.defaultdict(list)
    for w in ways:
        if w['tags'].get('oneway') == 'yes' and len(w.get('geometry', [])) > 1:
            byfirst[w['nodes'][0]].append(w)
    lasts = {w['nodes'][-1] for ws in byfirst.values() for w in ws}
    starts = [w for ws in byfirst.values() for w in ws if w['nodes'][0] not in lasts]
    used, chains = set(), []

    def run(w):
        seq = []
        while w and w['id'] not in used:
            used.add(w['id']); seq.append(w)
            cand = [c for c in byfirst.get(w['nodes'][-1], []) if c['id'] not in used]
            if not cand: break
            if len(cand) == 1:
                w = cand[0]; continue
            h = _bearing_at(w, 'out')
            def turn(c):
                d = _bearing_at(c, 'in') - h
                return abs((d + math.pi) % (2*math.pi) - math.pi)
            w = min(cand, key=turn)
        return seq

    for w in sorted(starts, key=lambda w: w['geometry'][0]['lon']):
        c = run(w)
        if c: chains.append(c)
    for w in ways:
        if w['id'] not in used and w['tags'].get('oneway') == 'yes' \
           and len(w.get('geometry', [])) > 1:
            c = run(w)
            if c: chains.append(c)
    return chains

def stitch(chains, junc=None, gap_m=8000):
    """Join chains end-to-start, using the exit numbers as the referee.

    Proximity alone is not enough and gets this badly wrong. I-40 passes
    within a mile of itself in several places, and a plain "are these two
    ends close" test happily welded two points that were 1 km apart in
    space and 25 MILES apart along the road, silently deleting the
    stretch between them. The error only showed up because exit numbers
    on this route are mile markers, so the join could be checked against
    something real.

    So a join is allowed when the ends are close, the headings agree, AND
    the exit numbers either advance by about the distance travelled or
    drop hard (which is a state line resetting the numbering, not a
    mistake)."""
    def numeric(e):
        r = (e.get('ref') or '').rstrip('ABCDEFG')
        return float(r) if r.isdigit() else None

    def ok(a, b, gap):
        if junc is None: return True
        da, db = develop(a, junc), develop(b, junc)
        ea = [(numeric(e), e['m']) for e in da['exits'] if numeric(e) is not None]
        eb = [(numeric(e), e['m']) for e in db['exits'] if numeric(e) is not None]
        if not ea or not eb: return True
        nA, mA = ea[-1]
        nB, mB = eb[0]
        if nB < nA - 40: return True                    # state line: numbers reset
        span = (da['cum'][-1] - mA + gap + mB) / 1609.34
        return abs((nB - nA) - span) < 3.0

    def _agrees(a, b, gap):
        """Distance evidence, which beats the heading heuristic.

        The heading rule assumes a motorway does not turn sharply, and
        through downtown Nashville I-40 does exactly that — the two
        halves of the corridor meet at 61 degrees and a plain heading
        test threw the join away, leaving the route in two pieces. When
        the exit numbers either side agree with the distance across the
        gap to within a mile, that is far better evidence than the angle
        and it is allowed to overrule it."""
        if junc is None: return False
        da, db = develop(a, junc), develop(b, junc)
        ea = [(numeric(e), e['m']) for e in da['exits'] if numeric(e) is not None]
        eb = [(numeric(e), e['m']) for e in db['exits'] if numeric(e) is not None]
        if not ea or not eb: return False
        nA, mA = ea[-1]; nB, mB = eb[0]
        if nB < nA - 40: return True
        span = (da['cum'][-1] - mA + gap + mB) / 1609.34
        return abs((nB - nA) - span) < 1.0

    out = [list(c) for c in chains]
    merged = True
    while merged:
        merged = False
        for i in range(len(out)):
            if not out[i]: continue
            best = None
            for j in range(len(out)):
                if i == j or not out[j]: continue
                d, _ = geod(out[i][-1]['geometry'][-1], out[j][0]['geometry'][0])
                if d >= gap_m: continue
                ha = _bearing_at(out[i][-1], 'out')
                hb = _bearing_at(out[j][0], 'in')
                t = abs((hb - ha + math.pi) % (2*math.pi) - math.pi)
                if t > math.radians(100): continue
                if best is None or d < best[0]: best = (d, j, t)
            if best and ok(out[i], out[best[1]], best[0]) \
               and (best[2] < math.radians(50) or _agrees(out[i], out[best[1]], best[0])):
                j = best[1]
                out[i] = out[i] + out[j]; out[j] = []
                merged = True; break
    return [c for c in out if c]


def develop(chain_ways, junc):
    """One chain -> points in world px, cumulative metres, and exits on it."""
    pts, nodeids = [], []
    for w in chain_ways:
        g, n = w['geometry'], w['nodes']
        s = 1 if pts and n[0] == nodeids[-1] else 0
        pts.extend(g[s:]); nodeids.extend(n[s:])
    x = y = 0.0; cum = 0.0
    xs, ys, cums = [0.0], [0.0], [0.0]
    for i in range(1, len(pts)):
        d, br = geod(pts[i-1], pts[i])
        if d <= 0:
            xs.append(x); ys.append(y); cums.append(cum); continue
        x += math.sin(br) * d; y += math.cos(br) * d; cum += d
        xs.append(x); ys.append(y); cums.append(cum)
    exits = []
    for i, nid in enumerate(nodeids):
        if nid in junc:
            t = junc[nid]['tags']
            ref = t.get('ref') or t.get('ref:right') or t.get('ref:left')
            exits.append({'ref': ref, 'm': cums[i], 'lat': pts[i]['lat'], 'lon': pts[i]['lon']})
    return {'x': xs, 'y': ys, 'cum': cums, 'pts': pts, 'exits': exits,
            'ways': chain_ways, 'nodeids': nodeids}

if __name__ == '__main__':
    ways, junc = load(sys.argv[1:])
    print(f"ways {len(ways)}  junction nodes {len(junc)}")
    chains = stitch(chain(ways))
    chains = [c for c in chains if len(c) > 1]
    devs = sorted((develop(c, junc) for c in chains), key=lambda d: -d['cum'][-1])
    print(f"chains {len(devs)}; longest few (miles):",
          [round(d['cum'][-1]/1609.34, 1) for d in devs[:6]])
    d = devs[0]
    mi = d['cum'][-1]/1609.34
    print(f"\nlongest carriageway: {mi:.1f} mi, {len(d['x'])} points, "
          f"{len(d['exits'])} exits, {d['cum'][-1]/M_PER_PX/1e6:.2f}M world px")
    ex = [e for e in d['exits'] if e['ref'] and e['ref'].rstrip('ABC').isdigit()]
    print(f"exits with a numeric ref: {len(ex)}")
    for e in ex[:5] + ex[-3:]:
        print(f"   exit {e['ref']:>5}  at mile {e['m']/1609.34:8.2f} along this chain")
