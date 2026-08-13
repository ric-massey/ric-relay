"""Pull every HPMS section of I-40 out of FHWA's public feature services.

── the source ───────────────────────────────────────────────────────────
The Highway Performance Monitoring System is what every state DOT is
required to report to FHWA each year, and the full-extent release is
hosted as one queryable ArcGIS FeatureServer per state per year:

    https://geo.dot.gov/server/rest/services/Hosted/HPMS_FULL_<ST>_2024

That matters because it means we do not download a national geodatabase
and throw 99.9% of it away — we ask for I-40 and get I-40. 2024 is the
newest year present for all eight states this corridor crosses.

── what a "section" is, and the trap in it ──────────────────────────────
HPMS is linear-referenced events flattened onto the state's own road
inventory, so a section is not a stretch of road anybody would name — it
is a run of milepoints over which EVERY reported attribute is constant.
That makes them short (a tenth of a mile is common) and it makes them
numerous, and it means a section boundary is an attribute change, which
is exactly what we want: the AADT steps where the real AADT steps.

The trap is FACILITY_TYPE, and getting it wrong silently doubles or
halves every number downstream:

    1  one-way          AADT is for THIS carriageway only
    2  two-way          AADT is BOTH directions on one centreline
    4  ramp             not the mainline
    5  non-mainline
    6  non-inventory direction   the other carriageway, usually no AADT

States do not agree on which they use for a divided Interstate. So the
type is carried through to the join and the doubling is decided there,
per section, from the data — never assumed.

Route number alone is also not enough: several of these states have a
state route 40 as well, so the query asks for F_SYSTEM = 1 (Interstate)
too, and the join afterwards throws away anything that is not physically
on the surveyed corridor.
"""
import json, os, ssl, sys, time, urllib.parse, urllib.request

# The python.org framework build ships no trust store of its own, so the
# certificate for geo.dot.gov cannot be verified without pointing at one.
try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = ssl.create_default_context()

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'hpms')
YEAR = 2024
STATES = ['CA', 'AZ', 'NM', 'TX', 'OK', 'AR', 'TN', 'NC']

BASE = ('https://geo.dot.gov/server/rest/services/Hosted/'
        'HPMS_FULL_{st}_{yr}/FeatureServer/0/query')

# Everything that could plausibly drive a car in this game, plus enough
# identity to check the join. Kept explicit rather than "*" so a schema
# change in a future year is a loud failure instead of a silent one.
FIELDS = [
    'objectid', 'route_id', 'begin_point', 'end_point', 'sectionlength',
    'f_system', 'routenumber', 'routename', 'routesigning', 'facility_type',
    'urban_id', 'county_id', 'nhfn', 'access_control',
    'through_lanes', 'peak_lanes', 'counter_peak_lanes', 'dir_through_lanes',
    'lane_width', 'median_type', 'median_width',
    'shoulder_type', 'shoulder_width_r', 'shoulder_width_l',
    'speed_limit',
    'aadt', 'aadt_single_unit', 'aadt_combination',
    'pct_dh_single', 'pct_dh_combination',
    'k_factor', 'dir_factor', 'future_aadt',
    'terrain_type', 'grades_a', 'grades_b', 'grades_c',
    'grades_d', 'grades_e', 'grades_f',
    'curves_a', 'curves_b', 'curves_c', 'curves_d', 'curves_e', 'curves_f',
    'iri', 'psr', 'surface_type', 'signal_type', 'number_signals',
]

WHERE = "routenumber=40 AND f_system=1"
PAGE = 1000


def get(url, params, tries=4):
    body = urllib.parse.urlencode(params).encode()
    for n in range(tries):
        try:
            with urllib.request.urlopen(url, body, timeout=180,
                                        context=CTX) as r:
                d = json.loads(r.read())
            if 'error' in d:
                raise RuntimeError(d['error'])
            return d
        except Exception as e:
            if n == tries - 1:
                raise
            print(f"    retry {n+1}: {e}")
            time.sleep(2 + 3 * n)


def fetch(st):
    url = BASE.format(st=st, yr=YEAR)
    common = {'where': WHERE, 'f': 'json'}
    n = get(url, dict(common, returnCountOnly='true',
                      returnGeometry='false'))['count']
    feats, off = [], 0
    while off < n:
        d = get(url, dict(common,
                          outFields=','.join(FIELDS),
                          returnGeometry='true',
                          outSR='4326',
                          # 0.001 degrees is about 100 m: far finer than
                          # the 2 km tolerance the join uses, and it cuts
                          # the payload by roughly ten.
                          maxAllowableOffset='0.001',
                          orderByFields='route_id,begin_point',
                          resultOffset=str(off),
                          resultRecordCount=str(PAGE)))
        got = d.get('features', [])
        if not got:
            break
        feats.extend(got)
        off += len(got)
        print(f"    {off}/{n}")
    return feats


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    todo = sys.argv[1:] or STATES
    for st in todo:
        p = os.path.join(OUT, f'{st}.json')
        if os.path.exists(p) and '--force' not in sys.argv:
            print(f"{st}: have it")
            continue
        print(f"{st}:")
        feats = fetch(st)
        json.dump({'state': st, 'year': YEAR, 'where': WHERE,
                   'features': feats}, open(p, 'w'), separators=(',', ':'))
        print(f"  wrote {p}  {len(feats)} sections  "
              f"{os.path.getsize(p)/1e6:.2f} MB")
