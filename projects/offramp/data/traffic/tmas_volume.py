"""A year of every hour, at every permanent counter on I-40.

The three axes the game says it will be fed — time of day, day of week,
where you are — are exactly the three axes of this file. TMAS gives one
record per station, per direction, per lane, per day, carrying all 24
hourly counts, so a full year at 130 counters is about eleven million
hourly observations and it reduces to something small:

    hour x day-of-week      the shape of a week, per station
    month                   the shape of a year, per station
    lane                    how the traffic distributes across lanes

Kept as COUNTS, not factors, because the counts are what let the emitter
check itself: a station's mean day summed over 24 hours must come back to
the AADT that HPMS reports a few hundred metres away, and it does.

── the double-counting trap ─────────────────────────────────────────────
Travel_Lane 0 means "all lanes of this direction, combined". Some states
report lane 0, some report lanes 1..n, and a few report both for the same
station-day. Adding those together doubles the road. So each station-day
is resolved once: if any per-lane record exists for that direction and
day, the lane-0 record for it is ignored.
"""
import collections, json, os, sys

from refline import MI, HERE

TMAS = os.path.join(HERE, 'tmas')
YEAR = 2025
MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
          'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
STATES = ['CA', 'AZ', 'NM', 'TX', 'OK', 'AR', 'TN', 'NC']
HOURS = [f'Hour_{h:02d}' for h in range(24)]
EW = {3: 'E', 7: 'W'}


def load_stations():
    ss = json.load(open(os.path.join(HERE, 'stations.json')))
    return {(s['st'], s['id']): s for s in ss}


def blank(dirs):
    return {d: {'dow': [[0.0] * 24 for _ in range(7)],
                'dowdays': [0] * 7,
                'month': [0.0] * 12,
                'monthdays': [0] * 12,
                'lane': collections.Counter(),
                'lanehour': collections.defaultdict(lambda: [0.0] * 24),
                'days': 0}
            for d in dirs}


def run():
    want = load_stations()
    acc = {k: blank((3, 7)) for k in want}
    # (station, dir, month, day) -> True once a per-lane record is seen,
    # so the combined record for the same day can be ignored.
    perlane = collections.defaultdict(bool)
    rows = bad = 0

    # Two passes over the year: the first only notes which station-days
    # are reported per lane, because a file may list the combined record
    # before the lane ones.
    for pas in (1, 2):
        for mi, mon in enumerate(MONTHS):
            for st in STATES:
                p = os.path.join(TMAS, mon, f'{st}_{mon.capitalize()}_{YEAR} (TMAS).VOL')
                if not os.path.exists(p):
                    continue
                with open(p, errors='replace') as f:
                    head = f.readline().rstrip('\n').split('|')
                    ix = {n: i for i, n in enumerate(head)}
                    for line in f:
                        v = line.rstrip('\n').split('|')
                        if len(v) != len(head):
                            continue
                        key = (st, v[ix['Station_Id']].strip())
                        if key not in want:
                            continue
                        d = int(v[ix['Travel_Dir']] or 0)
                        if d not in EW:
                            continue
                        lane = int(v[ix['Travel_Lane']] or 0)
                        day = int(v[ix['Day_Record']] or 0)
                        dk = (key, d, mi, day)
                        if pas == 1:
                            if lane > 0:
                                perlane[dk] = True
                            continue
                        if lane == 0 and perlane[dk]:
                            continue
                        try:
                            hv = [float(v[ix[h]] or 0) for h in HOURS]
                        except ValueError:
                            bad += 1
                            continue
                        dow = int(v[ix['Day_of_Week']] or 0)
                        if not 1 <= dow <= 7:
                            bad += 1
                            continue
                        a = acc[key][d]
                        tot = sum(hv)
                        for h in range(24):
                            a['dow'][dow - 1][h] += hv[h]
                            a['lanehour'][lane][h] += hv[h]
                        a['month'][mi] += tot
                        a['lane'][lane] += tot
                        rows += 1
                        # A day is counted once per direction however many
                        # lanes reported it.
                        if lane <= 1:
                            a['dowdays'][dow - 1] += 1
                            a['monthdays'][mi] += 1
                            a['days'] += 1
            if pas == 2:
                print(f"    {mon} done, {rows} rows")
    print(f"  {rows} hourly-day records, {bad} unreadable")
    return want, acc


def summarise(want, acc):
    out = []
    for key, dirs in acc.items():
        s = want[key]
        rec = {k: s[k] for k in ('st', 'id', 'mi', 'px', 'lat', 'lon',
                                 'off', 'where')}
        rec['dirs'] = {}
        for d, a in dirs.items():
            if a['days'] == 0:
                continue
            # mean vehicles in each hour of each day of the week
            dow = [[round(a['dow'][k][h] / a['dowdays'][k], 1)
                    if a['dowdays'][k] else None for h in range(24)]
                   for k in range(7)]
            # mean vehicles per day in each month
            month = [round(a['month'][k] / a['monthdays'][k], 1)
                     if a['monthdays'][k] else None for k in range(12)]
            lanes = dict(a['lane'])
            tot = sum(lanes.values()) or 1
            rec['dirs'][EW[d]] = {
                'days': a['days'],
                'aadt': round(sum(a['month']) / max(1, sum(a['monthdays'])), 1),
                'dow': dow,
                'month': month,
                'lane': {str(k): round(v / tot, 4) for k, v in sorted(lanes.items())},
                'lanehour': {str(k): [round(x) for x in v]
                             for k, v in sorted(a['lanehour'].items())},
            }
        if rec['dirs']:
            out.append(rec)
    out.sort(key=lambda r: r['mi'])
    return out


if __name__ == '__main__':
    print(f"reading {YEAR} TMAS volume for the I-40 counters")
    want, acc = run()
    out = summarise(want, acc)
    p = os.path.join(HERE, 'hourly.json')
    json.dump(out, open(p, 'w'), separators=(',', ':'))
    print(f"\n{len(out)} counters with data, wrote hourly.json "
          f"{os.path.getsize(p)/1e6:.2f} MB")

    # What a week looks like, corridor-wide, as a sanity read.
    tot = [[0.0] * 24 for _ in range(7)]
    for r in out:
        for d in r['dirs'].values():
            for k in range(7):
                for h in range(24):
                    if d['dow'][k][h] is not None:
                        tot[k][h] += d['dow'][k][h]
    grand = sum(sum(r) for r in tot) or 1
    names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    print("\n  share of a week's traffic, by day and hour (per mille)")
    print("      " + ' '.join(f"{h:3d}" for h in range(24)))
    for k in range(7):
        print(f"  {names[k]} " + ' '.join(f"{tot[k][h]/grand*1000:3.0f}"
                                          for h in range(24)))
