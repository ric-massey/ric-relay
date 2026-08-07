"""Real ramps: the actual shape of each interchange, from OSM.

A generic loop-back repeated 1,201 times is not what an Interstate looks
like. Exit 386 in Knoxville is not exit 407 in the Smokies. So the ramp
geometry comes off the survey like everything else.

OSM stores a ramp as a chain of `motorway_link` fragments: 801 of them
leave I-40, 813 rejoin it, and 5,307 sit in the middle carrying the ramp
round to whatever it serves. Walking from a leaving link through the
middle to a rejoining link recovers the whole path — the same chaining
the mainline needed, with the same rule at a fork: a ramp does not turn
sharply at a junction, the thing branching off it does.

Where a walk reaches the mainline again, that is a complete loop and the
player can drive it end to end. Where it dead-ends at a cross road, the
nearest rejoining link is taken as the other half and the gap between
them is closed — that is a diamond, and the gap is the cross street.
"""
import json, glob, math, sys, collections
sys.path.insert(0, '.')
from extract import geod

def load_links(paths):
    out = []
    for f in paths:
        for e in json.load(open(f))['elements']:
            if e.get('tags', {}).get('highway') == 'motorway_link': out.append(e)
    return list({e['id']: e for e in out}.values())

def bearing_at(w, end):
    g = w['geometry']
    return geod(g[-2], g[-1])[1] if end == 'out' else geod(g[0], g[1])[1]

def build(links, main_nodes, max_hops=14):
    byfirst = collections.defaultdict(list)
    for w in links:
        if len(w.get('geometry', [])) > 1: byfirst[w['nodes'][0]].append(w)
    joins = {w['nodes'][-1]: w for w in links if w['nodes'][-1] in main_nodes}

    ramps = []
    for lv in links:
        if lv['nodes'][0] not in main_nodes: continue
        if len(lv.get('geometry', [])) < 2: continue
        seq, seen, w = [lv], {lv['id']}, lv
        closed = False
        for _ in range(max_hops):
            if w['nodes'][-1] in main_nodes and len(seq) > 1: closed = True; break
            cand = [c for c in byfirst.get(w['nodes'][-1], []) if c['id'] not in seen]
            if not cand: break
            if len(cand) == 1: nxt = cand[0]
            else:
                h = bearing_at(w, 'out')
                def turn(c):
                    dd = bearing_at(c, 'in') - h
                    return abs((dd + math.pi) % (2*math.pi) - math.pi)
                nxt = min(cand, key=turn)
            seen.add(nxt['id']); seq.append(nxt); w = nxt
        if w['nodes'][-1] in main_nodes and len(seq) > 1: closed = True
        ramps.append({'seq': seq, 'closed': closed,
                      'startNode': lv['nodes'][0], 'endNode': w['nodes'][-1]})
    return ramps

def polyline(seq):
    pts, last = [], None
    for w in seq:
        g = w['geometry']
        pts.extend(g[1:] if last == w['nodes'][0] else g)
        last = w['nodes'][-1]
    return pts

def length_m(pts):
    return sum(geod(pts[i-1], pts[i])[0] for i in range(1, len(pts)))

def pair_deadends(ramps, links, main_nodes, max_gap=260):
    """Close a diamond by finding the entrance ramp it feeds.

    448 of the walks stop at a cross road, because that is what a diamond
    does: the exit ramp ends at a surface street and a separate entrance
    ramp starts from it a little further along. The two are a single
    structure to a driver — off, across, and back on — so the pair is
    joined and the gap between them left as the bit of cross street you
    drive along.

    Paired on proximity AND on heading, because the entrance ramp on the
    OTHER side of the freeway is often just as close and is somebody
    else's road entirely."""
    entrances = [w for w in links
                 if w['nodes'][-1] in main_nodes and len(w.get('geometry', [])) > 1]
    # walk each entrance BACKWARDS so we have its full path too
    byend = collections.defaultdict(list)
    for w in links:
        if len(w.get('geometry', [])) > 1: byend[w['nodes'][-1]].append(w)

    def back_walk(w, hops=10):
        seq, seen = [w], {w['id']}
        for _ in range(hops):
            if seq[0]['nodes'][0] in main_nodes: break
            cand = [c for c in byend.get(seq[0]['nodes'][0], []) if c['id'] not in seen]
            if not cand: break
            h = bearing_at(seq[0], 'in')
            def turn(c):
                dd = bearing_at(c, 'out') - h
                return abs((dd + math.pi) % (2*math.pi) - math.pi)
            nxt = min(cand, key=turn)
            seen.add(nxt['id']); seq.insert(0, nxt)
        return seq

    paired = 0
    for r in ramps:
        if r['closed']: continue
        tail = polyline(r['seq'])[-1]
        h = bearing_at(r['seq'][-1], 'out')
        best, bd = None, 1e18
        for en in entrances:
            head = en['geometry'][0]
            dd, _ = geod(tail, head)
            if dd > max_gap: continue
            t = abs((bearing_at(en, 'in') - h + math.pi) % (2*math.pi) - math.pi)
            if t > math.radians(120): continue          # doubling back: wrong side
            if dd < bd: bd, best = dd, en
        if best is None: continue
        r['seq'] = r['seq'] + back_walk(best)
        r['closed'] = True
        r['viaCrossRoad'] = round(bd)
        paired += 1
    return paired


def load_cross(paths):
    out = []
    for f in paths:
        for e in json.load(open(f))['elements']:
            if e['type'] == 'way' and len(e.get('geometry', [])) > 1: out.append(e)
    return list({e['id']: e for e in out}.values())


def close_via_cross(ramps, links, main_nodes, cross, max_nodes=90):
    """Close a diamond by driving along the cross street between the two
    ramp terminals.

    This is the structure the whole design is built on — off, across, and
    back on — and it is the one thing the motorway_link data cannot
    express on its own, because the bit in the middle is not a motorway
    link, it is a street. 299 ramps ended at one.

    A ramp end and the entrance it feeds rarely sit on the SAME street
    way: a real terminal is an intersection, so the street is split there
    and the two ends are one or two ways apart. So this is a breadth-first
    walk over the street graph rather than a single lookup, capped at
    ninety nodes of travel — beyond that it is not a cross street, it is
    a detour through a town.
    """
    seg = collections.defaultdict(list)          # node -> [(way, index)]
    for w in cross:
        for i, n in enumerate(w['nodes']): seg[n].append((w, i))

    reached = set()
    for r in ramps:
        for w in r['seq']: reached.add(w['id'])
    entr = {}
    for w in links:
        if w['nodes'][-1] in main_nodes and w['id'] not in reached:
            entr.setdefault(w['nodes'][0], w)

    byend = collections.defaultdict(list)
    for w in links:
        if len(w.get('geometry', [])) > 1: byend[w['nodes'][-1]].append(w)

    def back_walk(w, hops=10):
        sq, seen = [w], {w['id']}
        for _ in range(hops):
            if sq[0]['nodes'][0] in main_nodes: break
            cand = [c for c in byend.get(sq[0]['nodes'][0], []) if c['id'] not in seen]
            if not cand: break
            h = bearing_at(sq[0], 'in')
            nxt = min(cand, key=lambda c: abs(
                (bearing_at(c, 'out') - h + math.pi) % (2*math.pi) - math.pi))
            seen.add(nxt['id']); sq.insert(0, nxt)
        return sq

    closed = 0
    for r in ramps:
        if r['closed']: continue
        start = r['seq'][-1]['nodes'][-1]
        # breadth-first over street nodes, remembering the path
        q = collections.deque([(start, [])])
        seen = {start}
        hit = None
        while q and hit is None:
            node, path = q.popleft()
            if len(path) > max_nodes: continue
            for w, i in seg.get(node, []):
                for step in (1, -1):
                    j = i
                    while True:
                        j += step
                        if j < 0 or j >= len(w['nodes']): break
                        nn = w['nodes'][j]
                        pt = w['geometry'][j]
                        np2 = path + [pt]
                        if nn in entr and nn != start: hit = (np2, entr[nn]); break
                        if nn not in seen:
                            seen.add(nn); q.append((nn, np2))
                    if hit: break
                if hit: break
        if hit is None: continue
        r['cross'] = hit[0]
        r['seq'] = r['seq'] + back_walk(hit[1])
        r['closed'] = True
        r['viaStreet'] = len(hit[0])
        closed += 1
    return closed


if __name__ == '__main__':
    from extract import load, chain, stitch, develop
    ways, junc = load([f'v2/{n}.json' for n in
        ['CA_AZ','AZ_NM','NM','TX_OK','OK_AR','AR_TN','TN_E','NC']])
    d = sorted((develop(x, junc) for x in stitch(chain(ways), junc)),
               key=lambda z: -z['cum'][-1])[0]
    main_nodes = set(d['nodeids'])
    links = load_links(sorted(glob.glob('ramps/*.json')))
    ramps = build(links, main_nodes)
    direct = sum(1 for r in ramps if r['closed'])
    paired = pair_deadends(ramps, links, main_nodes)
    cross = load_cross(sorted(glob.glob('cross/*.json')))
    viacross = close_via_cross(ramps, links, main_nodes, cross)
    print(f"  closed along a cross street {viacross} (from {len(cross)} street ways)")
    closed = [r for r in ramps if r['closed']]
    print(f"  closed directly {direct}, closed by pairing across a cross road {paired}")
    print(f"ramps walked from the mainline: {len(ramps)}")
    print(f"  complete loops (leave and rejoin I-40): {len(closed)}")
    print(f"  dead-ending at a cross road           : {len(ramps)-len(closed)}")
    Ls = sorted(length_m(polyline(r['seq'])) for r in closed)
    if Ls:
        print(f"\nloop length (m): median {Ls[len(Ls)//2]:.0f}"
              f"  10% {Ls[len(Ls)//10]:.0f}  90% {Ls[int(len(Ls)*0.9)]:.0f}  max {Ls[-1]:.0f}")
    hops = collections.Counter(len(r['seq']) for r in closed)
    print("fragments per loop:", dict(sorted(hops.items())[:8]))


def develop_ramp(pts, anchor_xy, m_per_px=0.179):
    """Ramp geometry in the corridor's developed plane.

    The corridor is developed by integrating true bearings and distances
    from its start, so a ramp cannot be developed independently — it
    would land somewhere else entirely. Instead it is anchored at the
    corridor node it leaves from, whose developed position is known, and
    integrated from there using its own bearings. Local shape is exact
    and the join at the mainline is exact, which are the two things that
    matter; whatever drift accumulates over 900 m of ramp is closed at
    the far end below.
    """
    x, y = anchor_xy
    out = [(x, y)]
    for i in range(1, len(pts)):
        d, br = geod(pts[i-1], pts[i])
        x += math.sin(br) * d
        y += math.cos(br) * d
        out.append((x, y))
    return [[round(px / m_per_px, 1), round(py / m_per_px, 1)] for px, py in out]


def close_loop(dev, target):
    """Pull the far end onto the corridor, spreading the correction.

    Both the corridor and the ramp are developed by integrating bearings,
    so over a kilometre of ramp their planes disagree by a little. Left
    alone the ramp would rejoin the road a few pixels off it, which is a
    visible kink at the merge and a hole in the surface. The error is
    distributed along the ramp weighted by distance travelled, so the
    start stays nailed and the shape is barely touched.
    """
    if len(dev) < 2: return dev
    ex = target[0] - dev[-1][0]
    ey = target[1] - dev[-1][1]
    n = len(dev) - 1
    for i in range(1, len(dev)):
        t = i / n
        dev[i][0] = round(dev[i][0] + ex * t, 1)
        dev[i][1] = round(dev[i][1] + ey * t, 1)
    return dev
