"""Put the HPMS sections on the corridor, and check that they landed.

── how a section finds its mile ─────────────────────────────────────────
Not by milepoint. HPMS begin/end points are in each state's own linear
referencing system — Tennessee's is segmented by county, California's by
its state highway system — and none of them is the corridor's mileage.
The one thing every section carries that means the same thing everywhere
is its geometry, so the join is geometric: every vertex is put on the
nearest surveyed waypoint, and the section spans the distance between
the first and last of them.

A section is thrown away if its vertices are not on I-40. That is not
paranoia — `routenumber=40 AND f_system=1` also picks up business loops,
the odd frontage road inventoried under the same route id, and in two
states the ramps. TOL is 1.5 km, which is wide enough to keep the far
carriageway (I-40's median runs to 300 m in the Mojave and past 1 km
where the two roadways split around a hill) and narrow enough to drop
anything that is a different road.

── the duplicate carriageway ────────────────────────────────────────────
Measured over the eight states, every mainline section on I-40 is coded
FACILITY_TYPE 2 — two-way — which means its AADT is both directions on
one centreline. But four states inventory the two carriageways as two
separate route ids and code BOTH of them two-way, so those miles are
covered twice by rows carrying the same volume. Summing them would
double the road. So a mile takes the MEDIAN of the sections covering it,
and the emitter reports how far apart the covering sections were, which
is the number that would give the game away if this were wrong.
"""
import collections, json, math, os, statistics, sys

from refline import Ref, load_ref, M_PER_PX, MI, HERE

HPMS = os.path.join(HERE, 'hpms')
STATES = ['CA', 'AZ', 'NM', 'TX', 'OK', 'AR', 'TN', 'NC']
TOL = 1500.0          # metres a section may sit off the surveyed line
MAINLINE = (1, 2)     # FACILITY_TYPE: one-way and two-way carriageway

# What survives into `sections.json`. The raw pull in `hpms/` has fifty
# fields and keeps them; this is the subset the emitter reads, plus
# `nhfn` and `iri` because a freight-network flag and a roughness index
# are both things a driving game might yet want and they are one integer
# each. Everything else stays in the raw files, which fetch again.
KEEP = ['aadt', 'aadt_single_unit', 'aadt_combination', 'k_factor',
        'dir_factor', 'through_lanes', 'speed_limit',
        'terrain_type', 'urban_id', 'nhfn', 'iri']


def place(ref, feat):
    """(m_from, m_to, worst offset) along the corridor, or None."""
    paths = feat.get('geometry', {}).get('paths') or []
    ms, off = [], []
    for path in paths:
        for lon, lat in path:
            m, d = ref.near(lat, lon)
            if m is None or d > TOL:
                continue
            ms.append(m)
            off.append(d)
    if len(ms) < 2:
        return None
    return min(ms), max(ms), max(off)


def sections():
    ref = Ref(load_ref())
    out, drop = [], collections.Counter()
    for st in STATES:
        raw = json.load(open(os.path.join(HPMS, f'{st}.json')))['features']
        kept = 0
        for f in raw:
            a = f['attributes']
            if a.get('facility_type') not in MAINLINE:
                drop[f'{st} not mainline'] += 1
                continue
            if not a.get('aadt'):
                drop[f'{st} no aadt'] += 1
                continue
            p = place(ref, f)
            if p is None:
                drop[f'{st} off corridor'] += 1
                continue
            m0, m1, worst = p
            if m1 - m0 > 5 * MI:
                # a section that appears to span five miles of corridor is
                # one whose geometry wandered onto a distant part of the
                # route, not a five-mile section.
                drop[f'{st} implausible span'] += 1
                continue
            # Metres, to one decimal: the join is good to a few metres at
            # best and full float precision triples the file for nothing.
            rec = {'st': st, 'm0': round(m0, 1), 'm1': round(m1, 1),
                   'off': round(worst)}
            for k in KEEP:
                rec[k] = a.get(k)
            out.append(rec)
            kept += 1
        print(f"  {st}: {kept} of {len(raw)} sections placed")
    for k, v in sorted(drop.items()):
        print(f"    dropped {v:5d}  {k}")
    out.sort(key=lambda r: r['m0'])
    return out


BIN = 0.1 * MI       # metres


def profile(secs, length_m):
    """Fold the sections into fixed bins along the corridor."""
    nbins = int(length_m / BIN) + 1
    bins = [[] for _ in range(nbins)]
    for r in secs:
        i0 = int(r['m0'] / BIN)
        i1 = min(nbins - 1, int(r['m1'] / BIN))
        for i in range(i0, i1 + 1):
            bins[i].append(r)
    return bins


def med(vals):
    vals = [v for v in vals if v is not None]
    return statistics.median(vals) if vals else None


if __name__ == '__main__':
    ref = load_ref()
    length = ref['m'][-1]
    print('placing HPMS sections on the corridor')
    secs = sections()
    print(f"\n{len(secs)} sections placed, "
          f"worst offset {max(r['off'] for r in secs):.0f} m")

    bins = profile(secs, length)
    covered = sum(1 for b in bins if b)
    print(f"coverage: {covered}/{len(bins)} tenth-mile bins "
          f"({covered/len(bins)*100:.1f}%)")

    # How far apart are the sections that cover the same tenth of a mile?
    # If the duplicate-carriageway reasoning is right this is small.
    spreads = []
    for b in bins:
        v = [r['aadt'] for r in b if r['aadt']]
        if len(v) > 1 and statistics.median(v):
            spreads.append((max(v) - min(v)) / statistics.median(v))
    if spreads:
        spreads.sort()
        print(f"duplicate cover: {len(spreads)} bins with >1 section; "
              f"spread median {spreads[len(spreads)//2]*100:.1f}%, "
              f"90th {spreads[int(len(spreads)*0.9)]*100:.1f}%, "
              f"worst {spreads[-1]*100:.0f}%")

    print('\n  AADT by state (two-way, all vehicles)')
    for st in STATES:
        v = [r['aadt'] for r in secs if r['st'] == st]
        t = [(r['aadt_single_unit'] or 0) + (r['aadt_combination'] or 0)
             for r in secs if r['st'] == st]
        a = [r['aadt'] for r in secs if r['st'] == st]
        pct = [100 * x / y for x, y in zip(t, a) if y]
        print(f"    {st}  min {min(v):6d}  median {int(statistics.median(v)):6d} "
              f" max {max(v):6d}   trucks {statistics.median(pct):4.1f}% of AADT")

    json.dump(secs, open(os.path.join(HERE, 'sections.json'), 'w'),
              separators=(',', ':'))
    print(f"\nwrote sections.json  "
          f"{os.path.getsize(os.path.join(HERE,'sections.json'))/1e6:.2f} MB")
