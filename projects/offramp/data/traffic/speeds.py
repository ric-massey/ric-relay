"""What people actually drive on I-40, as against what the sign says.

`tcds.py` pulls the raw hour x speed-bin tables off TDOT's counters.
This turns them into the one thing the game can use everywhere on the
corridor: **an offset from the posted limit**.

That indirection is the whole point. Every counter with speed data on
I-40 is in Tennessee, where the limit is 70, so a table of absolute
speeds would only ever be right for those 260 miles. What generalises
is the *relationship* — the median driver runs so many mph over the
sign, the 85th percentile so many more — and there is good reason to
expect that to travel: speed choice tracks the design of the road and
the limit is set from the same design. It is an assumption, and it is
the only one in this file; it is written down here so it can be argued
with rather than discovered later.

Percentiles come out of binned counts by interpolating within the bin,
which is what TDOT does itself when it publishes an 85th. The top bin
is open (`85+`) and is treated as 85-95 — that only bites above the
95th percentile, and nothing in the game reads up there.
"""
import json, os, statistics, sys

from refline import MI, M_PER_PX, HERE

# Bin edges for TDOT's 15 speed bins, mph. The last is open-ended and
# closed off at 95 so a percentile inside it can be interpolated.
EDGES = [0, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 95]

PCT = [15, 50, 85, 95]


def profile():
    """The posted limit as a function of corridor px, from traffic.js."""
    s = open(os.path.join(HERE, '..', 'traffic.js')).read()
    k = 'window.I40_TRAFFIC = '
    d = json.loads(s[s.index(k) + len(k):].rstrip().rstrip(';'))
    return d['speed']


def limit_at(runs, mi):
    px = mi * MI / M_PER_PX
    v = None
    for x, val in runs:
        if x > px:
            break
        v = val
    return v


def pct(counts, p):
    """The p-th percentile of a binned distribution, mph."""
    n = sum(counts)
    if n < 200:            # too few to say anything
        return None
    want, seen = n * p / 100.0, 0
    for i, c in enumerate(counts):
        if seen + c >= want and c:
            lo, hi = EDGES[i], EDGES[i + 1]
            return lo + (hi - lo) * (want - seen) / c
        seen += c
    return EDGES[-1]


def share_over(counts, limit):
    """Fraction of vehicles above the posted limit, by bin edge."""
    n = sum(counts)
    if not n:
        return None
    over = sum(c for i, c in enumerate(counts) if EDGES[i] >= limit)
    return over / n


def main():
    runs = profile()
    S = json.load(open(os.path.join(HERE, 'tcds_speed.json')))

    # Pooled over the corridor, per hour, weekday and weekend separately
    # — but only over the counters sharing the commonest posted limit.
    # The whole point of the pooled table is the OFFSET from the sign,
    # and averaging a 65 stretch together with a 70 one destroys exactly
    # that. Two of the five sit at 65.
    lims = [limit_at(runs, r['mi']) for r in S]
    modal = statistics.mode(lims)
    pool = {'wd': [[0] * 15 for _ in range(24)],
            'we': [[0] * 15 for _ in range(24)]}
    stations = []
    for r in S:
        lim = limit_at(runs, r['mi'])
        allh = [0] * 15
        for key in ('weekday', 'weekend'):
            if not r[key]:
                continue
            k = 'wd' if key == 'weekday' else 'we'
            for h in range(24):
                for i in range(15):
                    if lim == modal:
                        pool[k][h][i] += r[key][h][i]
                    allh[i] += r[key][h][i]
        stations.append({
            'id': r['id'], 'mi': round(r['mi'], 2), 'limit': lim,
            'days': r['days'], 'n': sum(allh),
            'p': {p: round(pct(allh, p), 1) for p in PCT},
            'over': round(share_over(allh, lim), 3),
        })

    print(f"{'stn':>6} {'mile':>8} {'lim':>4} {'vehicles':>10}   "
          + '  '.join(f'p{p}' for p in PCT) + '   over')
    for s in stations:
        print(f"{s['id']:>6} {s['mi']:8.1f} {s['limit']:4} {s['n']:10,}   "
              + '  '.join(f"{s['p'][p]:4.1f}" for p in PCT)
              + f"   {s['over']*100:4.1f}%")

    # The generalisable answer: offset from the posted limit, by hour.
    # The pooled counters all sit at the same limit, so the offset and
    # the absolute are one table shifted; keeping both makes the
    # assumption visible in the emitted file.
    lim = modal
    npool = sum(s['n'] for s in stations if s['limit'] == modal)
    out = {'source': 'TDOT TCDS', 'stations': stations,
           'edges': EDGES, 'limit': lim, 'pooled': npool,
           'pooledFrom': [s['id'] for s in stations if s['limit'] == modal],
           'hour': {}}
    for k in ('wd', 'we'):
        rows = []
        for h in range(24):
            c = pool[k][h]
            row = {'n': sum(c),
                   'p': {p: pct(c, p) for p in PCT},
                   'over': share_over(c, lim)}
            row['p'] = {p: (None if v is None else round(v, 1))
                        for p, v in row['p'].items()}
            row['off'] = {p: (None if row['p'][p] is None
                              else round(row['p'][p] - lim, 1)) for p in PCT}
            row['over'] = None if row['over'] is None else round(row['over'], 3)
            rows.append(row)
        out['hour'][k] = rows

    print(f"\nweekday, pooled over the {len(out['pooledFrom'])} counters "
          f"posted {lim} ({sum(r['n'] for r in out['hour']['wd']):,} vehicles)")
    print(f"{'hr':>3} {'veh/h':>8}   " + '  '.join(f'p{p}' for p in PCT)
          + '     over')
    for h in range(24):
        r = out['hour']['wd'][h]
        if not r['p'][50]:
            continue
        print(f"{h:3} {r['n']:8,}   "
              + '  '.join(f"{r['p'][p]:4.1f}" for p in PCT)
              + f"   {r['over']*100:5.1f}%")

    p = os.path.join(HERE, 'observed.json')
    json.dump(out, open(p, 'w'), separators=(',', ':'))
    print(f"\nwrote {os.path.basename(p)}")


if __name__ == '__main__':
    main()
