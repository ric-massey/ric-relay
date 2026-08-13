"""NGSIM's congested freeway, summarised without downloading it.

NGSIM is 11.85 million rows and the two freeway sites are 9.4M of them.
Pulling that through Socrata's offset paging takes an hour and holds
several gigabytes of Python dictionaries to answer questions that are
all of the form "how often does X take value V" — so it is asked as
histograms instead, server side, and comes back in a few seconds.

The columns are already what is wanted: NGSIM measured space_headway
and time_headway per frame and recorded the preceding vehicle, so the
car-following relationship does not have to be reconstructed the way it
does for TGSIM.

Zero in a headway column is the dataset's sentinel for "nothing ahead of
this vehicle in this lane", not a headway of zero, and it is excluded.
Averaging it in would halve every number here.
"""
import json, os, ssl, sys, urllib.parse, urllib.request

try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = ssl.create_default_context()

HERE = os.path.dirname(os.path.abspath(__file__))
API = 'https://data.transportation.gov/resource/8ect-6jqj.json'
FT = 0.3048
SITES = {'ngsim_i80': 'i-80', 'ngsim_us101': 'us-101'}
CLASS = {'1': 'motorcycle', '2': 'car', '3': 'truck'}


def q(params):
    url = API + '?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=300, context=CTX) as r:
        return json.loads(r.read())


def hist(site, col, lo, hi):
    """count of every distinct value of `col`, by vehicle class"""
    out, off = [], 0
    while True:
        got = q({'$select': f'v_class,{col},count(1) as n',
                 '$where': f"location='{site}' AND {col}>{lo} AND {col}<{hi}",
                 '$group': f'v_class,{col}',
                 '$order': f'{col}',
                 '$limit': 50000, '$offset': off})
        out.extend(got)
        if len(got) < 50000:
            return out
        off += len(got)


def pct_from(hist_rows, col, scale=1.0, ps=(5, 15, 50, 85, 95)):
    by = {}
    for r in hist_rows:
        c = CLASS.get(r['v_class'], '?')
        by.setdefault(c, []).append((float(r[col]) * scale, int(r['n'])))
    out = {}
    for c, rows in by.items():
        rows.sort()
        tot = sum(n for _, n in rows)
        want = [(p, tot * p / 100) for p in ps]
        run, res, i = 0, {}, 0
        for v, n in rows:
            run += n
            while i < len(want) and run >= want[i][1]:
                res[f'p{want[i][0]}'] = round(v, 3)
                i += 1
        res['n'] = tot
        out[c] = res
    return out


def lanes(site):
    rows = q({'$select': 'v_class,lane_id,count(1) as n',
              '$where': f"location='{site}'",
              '$group': 'v_class,lane_id', '$limit': 500})
    tot = {}
    for r in rows:
        c = CLASS.get(r['v_class'], '?')
        tot[c] = tot.get(c, 0) + int(r['n'])
    return {f"{CLASS.get(r['v_class'],'?')}|{int(float(r['lane_id']))}":
            round(int(r['n']) / tot[CLASS.get(r['v_class'], '?')], 4)
            for r in sorted(rows, key=lambda x: (x['v_class'], float(x['lane_id'])))}


if __name__ == '__main__':
    p = os.path.join(HERE, 'behaviour.json')
    res = json.load(open(p)) if os.path.exists(p) else {}
    for name, site in SITES.items():
        print(f"{name}: asking for histograms")
        res[name] = {
            'source': f'NGSIM {site}, congested peak, 2005',
            'time_headway_s': pct_from(hist(site, 'time_headway', 0, 30),
                                       'time_headway'),
            'space_headway_m': pct_from(hist(site, 'space_headway', 0, 1000),
                                        'space_headway', FT),
            'speed_ms': pct_from(hist(site, 'v_vel', -1, 200), 'v_vel', FT),
            'accel_ms2': pct_from(hist(site, 'v_acc', -30, 30), 'v_acc', FT,
                                  (1, 5, 50, 95, 99)),
            'lane_share': lanes(site),
        }
        print(f"  {name}: time headway {res[name]['time_headway_s']}")
    json.dump(res, open(p, 'w'), indent=1)
    print(f"\nupdated behaviour.json")
