"""Which of FHWA's permanent counters are standing on I-40, and where.

TMAS is the national repository of continuous count data: every state
runs a set of permanent counters — loops, piezos, radar — that record
every hour of every day of the year, and reports them to FHWA. That is
the only public source that answers "how many cars, at 3am, on a
Tuesday, in February, at this specific place", which is exactly the
three axes the game is being fed.

A station is claimed for the corridor the same way an HPMS section is:
by geometry, against the surveyed centreline, within TOL. The route
number a state posts on a station record is *checked* against that but
not used to select, because several I-40 counters are posted under a
concurrent route (I-24 in Nashville, I-85 at Greensboro) and one is
posted under nothing at all.
"""
import collections, json, os, re, sys

from refline import Ref, load_ref, MI, M_PER_PX, HERE

TMAS = os.path.join(HERE, 'tmas')
YEAR = 2025
TOL = 1500.0

# FIPS, which is what TMAS uses in State_Code.
FIPS = {'CA': 6, 'AZ': 4, 'NM': 35, 'TX': 48, 'OK': 40, 'AR': 5,
        'TN': 47, 'NC': 37}
STATES = ['CA', 'AZ', 'NM', 'TX', 'OK', 'AR', 'TN', 'NC']

# TMG direction codes. I-40 is an east-west route, so a counter on it
# should be reporting 3/7; anything else is a station on a crossing road
# that happens to sit near the corridor, and is dropped.
DIR = {1: 'N', 2: 'NE', 3: 'E', 4: 'SE', 5: 'S', 6: 'SW', 7: 'W', 8: 'NW'}
EW = {3: 'E', 7: 'W'}


# A counter described by where it sits RELATIVE to I-40 is on some other
# road. Three of these turn up in North Carolina — I-540, I-440 and
# US-421 — all within a kilometre of the corridor and all carrying
# volumes that are nothing to do with it.
BESIDE = re.compile(r'\b(?:n|s|e|w|north|south|east|west)\w*\s+of\s+i\s*-?\s*40\b',
                    re.I)
FAR = 700.0     # metres, past which a station must name I-40 to be kept


def on_i40(rec):
    """Is this counter on the corridor, or merely near it?

    Route number is weak evidence on its own: Tennessee posts I-40
    counters under SR 204, SR 111 and I-24, New Mexico posts one under
    I-25, and every one of those is genuinely standing on I-40 inside a
    concurrency. So the number is allowed to *rescue* a distant station
    rather than to select one, and distance does the rest.
    """
    text = f"{rec['sign']} {rec['where']}"
    if BESIDE.search(rec['where']):
        return False
    if rec['off'] <= FAR:
        return True
    return bool(re.search(r'\b40\b|I\s*-?\s*40|0040', text))


def read_pipe(path):
    with open(path, errors='replace') as f:
        head = f.readline().rstrip('\n').split('|')
        for line in f:
            v = line.rstrip('\n').split('|')
            if len(v) != len(head):
                continue
            yield dict(zip(head, v))


def num(s, d=None):
    s = (s or '').strip()
    try:
        return float(s)
    except ValueError:
        return d


def stations():
    ref = Ref(load_ref())
    out, seen = {}, collections.Counter()
    for st in STATES:
        p = os.path.join(TMAS, 'Station', f'{st}_{YEAR} (TMAS).STA')
        for r in read_pipe(p):
            la, lo = num(r['Latitude']), num(r['Longitude'])
            if la is None or lo is None:
                continue
            m, d = ref.near(la, lo)
            if m is None or d > TOL:
                continue
            dirn = int(num(r['Travel_Dir'], 0))
            if dirn not in EW:
                seen[f'{st} not east-west'] += 1
                continue
            if (r.get('Year_Discontinued') or '').strip() not in ('', '0', '0000'):
                seen[f'{st} discontinued'] += 1
                continue
            key = (st, r['Station_Id'].strip())
            e = out.setdefault(key, {
                'st': st, 'id': r['Station_Id'].strip(),
                'lat': la, 'lon': lo, 'off': round(d),
                'm': m, 'mi': round(m / MI, 2), 'px': round(m / M_PER_PX, 1),
                'sign': (r.get('Posted_Route_Sign_Number') or '').strip(),
                'signing': int(num(r.get('Posted_Route_Signing'), 0)),
                'fsystem': int(num(r.get('F_System'), 0)),
                'where': (r.get('Station_Location') or '').strip(),
                'dirs': {}, 'lanes': {},
            })
            e['dirs'][dirn] = EW[dirn]
            e['lanes'].setdefault(dirn, set()).add(int(num(r['Travel_Lane'], 0)))
    keep = []
    for e in out.values():
        e['lanes'] = {d: sorted(v) for d, v in e['lanes'].items()}
        e['dirs'] = sorted(e['dirs'].values())
        if on_i40(e):
            keep.append(e)
        else:
            print(f"    beside the road, not on it: {e['st']} {e['id']} "
                  f"{e['off']} m, sign {e['sign']!r}, {e['where'][:40]!r}")
    for k, v in sorted(seen.items()):
        print(f"    skipped {v:3d}  {k}")
    return sorted(keep, key=lambda e: e['m'])


if __name__ == '__main__':
    ss = stations()
    print(f"\n{len(ss)} permanent counters on I-40, {YEAR}\n")
    by = collections.Counter(s['st'] for s in ss)
    for st in STATES:
        print(f"    {st}  {by[st]:3d}")
    print()
    for s in ss:
        lanes = ','.join(f"{d}:{'+'.join(map(str, l))}"
                         for d, l in sorted(s['lanes'].items()))
        print(f"  mi {s['mi']:8.2f}  {s['st']} {s['id']}  {s['off']:5d} m off  "
              f"dirs {'/'.join(s['dirs'])}  lanes {lanes}  "
              f"sign {s['sign'] or '-':>10}  {s['where'][:38]}")
    json.dump(ss, open(os.path.join(HERE, 'stations.json'), 'w'),
              separators=(',', ':'), default=list)
    print(f"\nwrote stations.json")
