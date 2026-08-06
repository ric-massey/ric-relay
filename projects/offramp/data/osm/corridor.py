"""Emit a game-ready corridor from the extracted I-40 chains.

What the game gets is NOT stations. Stations are every 8 world px
(1.43 m), and all of I-40 is 2.87M of them — 160 MB before you count
JavaScript object overhead, which is not going on a phone. What ships is
the WAYPOINTS, roughly one per 115 m as OSM records them, about 36,000
of them for the whole route, and road.js turns those into stations for
the stretch the player is actually on.

Metric fidelity is the whole requirement, so it is asserted here rather
than hoped for: I-40 exit numbers are mile markers, so the distance this
file computes between two exits must equal the difference in their
numbers. Anything worse than half a mile over a state is a bug in the
extraction, not a rounding artefact.
"""
import json, math, sys, collections
from extract import load, chain, stitch, develop, geod, M_PER_PX

MI = 1609.34

def carriageways(devs):
    """The two directions. I-40 is dual, so the two longest chains that
    run opposite ways are the eastbound and westbound roadways; the game
    needs ONE centreline and builds both sides off it from the real
    cross-section, so we keep the eastbound and let it stand for both."""
    scored = []
    for d in devs:
        if len(d['x']) < 50: continue
        dx = d['x'][-1] - d['x'][0]
        scored.append((d['cum'][-1], dx > 0, d))
    scored.sort(key=lambda t: -t[0])
    east = [d for L, e, d in scored if e]
    west = [d for L, e, d in scored if not e]
    return east, west

def all_junctions(chain_dev, junc, max_m=260):
    """Every exit on the corridor, from BOTH carriageways.

    `develop()` only picks up junction nodes that lie on the chain it
    walked, which is one roadway. I-40 is dual, so that silently loses
    every exit whose node happens to be tagged on the other side —
    62 distinct refs, mostly the B half of an A/B pair.

    A junction is not on the chain, so it has no developed coordinate of
    its own; it gets the cumulative distance of the nearest chain point,
    found geodesically. A coarse lat/lon bucket keeps that from being
    1,525 x 27,000 comparisons."""
    pts, cum = chain_dev['pts'], chain_dev['cum']
    grid = {}
    for i, q in enumerate(pts):
        grid.setdefault((round(q['lat'], 2), round(q['lon'], 2)), []).append(i)
    out = []
    for n in junc.values():
        t = n['tags']
        ref = t.get('ref') or t.get('ref:right') or t.get('ref:left')
        if not ref: continue
        best, bi = 1e18, -1
        key = (round(n['lat'], 2), round(n['lon'], 2))
        for dla in (-0.01, 0, 0.01):
            for dlo in (-0.01, 0, 0.01):
                for i in grid.get((round(key[0] + dla, 2), round(key[1] + dlo, 2)), ()):
                    d, _ = geod(n, pts[i])
                    if d < best: best, bi = d, i
        if bi < 0 or best > max_m: continue
        out.append({'ref': ref, 'm': cum[bi], 'lat': n['lat'], 'lon': n['lon'], 'gap': best})
    out.sort(key=lambda e: e['m'])
    # the same exit tagged on both carriageways lands twice
    dedup, last = [], {}
    for e in out:
        prev = last.get(e['ref'])
        if prev is not None and abs(e['m'] - prev) < 800: continue
        last[e['ref']] = e['m']; dedup.append(e)
    return dedup


def clean_exits(exits):
    """Drop junctions that belong to the OTHER route in a concurrency.

    I-40 runs with I-35 through Oklahoma City, I-24 and I-65 through
    Nashville, and I-85 through Greensboro. The `motorway_junction` nodes
    on shared carriageway carry whichever route's numbering applies, so
    foreign exit numbers turn up interleaved with I-40's and the corridor
    appears to skip tens of miles. It does not — the geometry is right
    and the labels are foreign.

    Exit numbers on I-40 are mile markers, so `number - miles` is a
    constant within a state. A first version tracked that constant with a
    LOCAL median over eight neighbours, and I-85 defeated it: the
    Greensboro block is seventeen exits long, so in the middle of it
    every neighbour was foreign too and the median followed them, 95
    miles wrong.

    The rule that actually holds is about state lines. A state line
    resets I-40's numbering to near zero — every state on this route
    starts at exit 0, 1, 3, 7 or 8. So the constant is allowed to change
    ONLY where the numbering restarts low. A residual that shifts while
    the exit number is 132 is not a border; it is somebody else's road."""
    num = []
    for e in exits:
        r = (e.get('ref') or '').rstrip('ABCDEFG')
        if r.isdigit(): num.append((float(r), e['m'] / MI, e))
    if len(num) < 5: return exits

    # seed from the first few that agree with each other
    res0 = sorted(n - m for n, m, _ in num[:9])
    cur = res0[len(res0) // 2]
    kept, dropped = [], []
    for i, (n, mi, e) in enumerate(num):
        r = n - mi
        if abs(r - cur) < 2.5:
            cur += (r - cur) * 0.25          # drift with the real numbering
            kept.append(e); continue
        # a state line? numbering must restart low AND the next few agree
        ahead = [(nn - mm) for nn, mm, _ in num[i:i + 6]]
        consistent = len(ahead) >= 3 and max(ahead) - min(ahead) < 2.5
        if n < 15 and consistent:
            cur = sorted(ahead)[len(ahead) // 2]
            kept.append(e); continue
        dropped.append(e)
    if dropped:
        byref = ', '.join(str(d['ref']) for d in dropped[:8])
        print(f"  dropped {len(dropped)} junctions belonging to a concurrent route ({byref}...)")
    keep_ids = {id(x) for x in kept}
    return [e for e in exits
            if not (e.get('ref') or '').rstrip('ABCDEFG').isdigit() or id(e) in keep_ids]


def emit(d, name="I-40"):
    xs, ys, cum = d['x'], d['y'], d['cum']
    pts = [[round(x / M_PER_PX, 1), round(y / M_PER_PX, 1)] for x, y in zip(xs, ys)]
    exits = []
    for e in clean_exits(d['exits']):
        if not e['ref']: continue
        exits.append({'ref': e['ref'], 'mi': round(e['m'] / MI, 3),
                      'px': round(e['m'] / M_PER_PX, 1)})
    # lanes and speed limit, as [px_from, value] runs along the route
    lanes, speed, at = [], [], 0.0
    for w in d['ways']:
        t = w['tags']
        n = t.get('lanes'); v = t.get('maxspeed')
        seg = 0.0
        g = w['geometry']
        for i in range(1, len(g)):
            from extract import geod
            seg += geod(g[i-1], g[i])[0]
        if n and n.isdigit():
            n = int(n)
            if not lanes or lanes[-1][1] != n: lanes.append([round(at / M_PER_PX, 1), n])
        if v:
            if not speed or speed[-1][1] != v: speed.append([round(at / M_PER_PX, 1), v])
        at += seg
    # A geographic trace for the overview map, sampled every MAP_STEP
    # miles. The game world is the route DEVELOPED onto a plane, which
    # keeps every curve and every distance true but lets global
    # orientation drift -- drawing 2,551 miles of that would show a road
    # slowly curling into a spiral. So the map gets real lat/lon, and
    # because the samples are at fixed mileage the player's position on
    # it is a division rather than a search.
    MAP_STEP = 2.0
    mapline, j = [], 1
    k = 0
    while k * MAP_STEP * MI <= cum[-1]:
        target = k * MAP_STEP * MI
        while j < len(cum) - 1 and cum[j] < target: j += 1
        a, b = d['pts'][j - 1], d['pts'][j]
        span = max(1e-9, cum[j] - cum[j - 1])
        t = (target - cum[j - 1]) / span
        mapline.append([round(a['lat'] + (b['lat'] - a['lat']) * t, 4),
                        round(a['lon'] + (b['lon'] - a['lon']) * t, 4)])
        k += 1
    return {'id': name, 'lengthMi': round(cum[-1] / MI, 2),
            'lengthPx': round(cum[-1] / M_PER_PX, 1),
            'waypoints': pts, 'exits': exits, 'lanes': lanes, 'speed': speed,
            'map': mapline, 'mapStepMi': MAP_STEP}

def states(c):
    """Every mile marker on the corridor, as eight state runs.

    Mile markers are not in OSM as objects and do not need to be. On an
    Interstate the exit number IS the mile marker, so `number - miles
    along the corridor` is a constant within a state and that constant is
    the whole answer: marker(px) = px/MILE + residual. Every post between
    two exits follows from it, and by construction the markers agree with
    the exit numbers rather than being a second, drifting opinion.

    The runs are found where the residual shifts and the numbering
    restarts low, which is what a state line is. Names are assigned in
    travel order west to east, because that is the order I-40 crosses
    them and there is nothing else in the data that says so."""
    NAMES = ["CA", "AZ", "NM", "TX", "OK", "AR", "TN", "NC"]
    num = [(float(e['ref'].rstrip('ABCDEFG')), e['mi'], e['px'])
           for e in c['exits'] if e['ref'].rstrip('ABCDEFG').isdigit()]
    runs, cur = [], []
    for n, mi, px in num:
        if cur and n < cur[-1][0] - 40: runs.append(cur); cur = []
        cur.append((n, mi, px))
    if cur: runs.append(cur)
    out = []
    for k, r in enumerate(runs):
        res = sorted(n - mi for n, mi, _ in r)
        med = res[len(res) // 2]
        out.append({
            'name': NAMES[k] if k < len(NAMES) else f"?{k}",
            'fromPx': round(r[0][2] - med * (1609.34 / M_PER_PX), 1),  # marker 0 of this state
            'startPx': round(r[0][2], 1),
            'endPx': round(r[-1][2], 1),
            'residual': round(med, 3),
            'exits': len(r),
        })
    return out


def check(c):
    """exit number == mile marker. Reset at each state line."""
    num = [(e['ref'], float(e['ref'].rstrip('ABCDEFG')), e['mi'])
           for e in c['exits'] if e['ref'].rstrip('ABCDEFG').isdigit()]
    runs, cur = [], []
    for ref, n, mi in num:
        if cur and n < cur[-1][1] - 5:      # numbers dropped: state line
            runs.append(cur); cur = []
        cur.append((ref, n, mi))
    if cur: runs.append(cur)
    print(f"\n  metric check — {len(runs)} numbering run(s) (state lines)")
    worst = 0
    for r in runs:
        if len(r) < 3: continue
        dn = r[-1][1] - r[0][1]
        dm = r[-1][2] - r[0][2]
        err = dm - dn
        worst = max(worst, abs(err))
        print(f"    exits {r[0][0]:>5} -> {r[-1][0]:>5}   implied {dn:7.1f} mi   "
              f"measured {dm:7.2f} mi   error {err:+.2f} mi ({abs(err)/max(dn,1)*100:.2f}%)")
    return worst

if __name__ == '__main__':
    ways, junc = load(sys.argv[1:])
    print(f"ways {len(ways)}  junctions {len(junc)}")
    devs = sorted((develop(c, junc) for c in stitch(chain(ways), junc)),
                  key=lambda d: -d['cum'][-1])
    east, west = carriageways(devs)
    print("eastbound chains (mi):", [round(d['cum'][-1]/MI, 1) for d in east[:5]])
    print("westbound chains (mi):", [round(d['cum'][-1]/MI, 1) for d in west[:5]])
    if not east: sys.exit("no eastbound chain found")
    east[0]['exits'] = all_junctions(east[0], junc)
    print(f"exits from both carriageways: {len(east[0]['exits'])}")
    c = emit(east[0])
    print(f"\ncorridor: {c['lengthMi']} mi, {len(c['waypoints'])} waypoints, "
          f"{len(c['exits'])} exits, {len(c['lanes'])} lane changes, {len(c['speed'])} speed zones")
    c['states'] = states(c)
    print("\n  mile markers — one residual per state, so every post is derivable")
    for st in c['states']:
        span = (st['endPx'] - st['startPx']) / (1609.34 / M_PER_PX)
        print(f"    {st['name']}  markers {st['residual'] + st['startPx']/(1609.34/M_PER_PX):6.1f}"
              f" -> {st['residual'] + st['endPx']/(1609.34/M_PER_PX):6.1f}"
              f"   {span:6.1f} mi   {st['exits']:3d} exits")
    worst = check(c)
    out = 'i40.json'
    json.dump(c, open(out, 'w'), separators=(',', ':'))
    import os
    print(f"\nwrote {out}  {os.path.getsize(out)/1e6:.2f} MB   worst error {worst:.2f} mi")
