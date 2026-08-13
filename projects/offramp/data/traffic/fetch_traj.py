"""Real vehicle trajectories, so the cars can be made to behave.

Volume data says how MANY cars. It says nothing about what any one of
them does — how close it sits to the car in front, how long it takes to
change lanes, how hard it accelerates, whether it uses the left lane at
all. For that you need somebody to have filmed a piece of freeway from
above and tracked every vehicle in it, and USDOT has done that twice and
published both:

  NGSIM (2005)   US-101 and I-80, 10 Hz, peak-hour CONGESTION.
                 Mean speed 10-20 mph. Carries space_headway and
                 time_headway already computed, and preceding/following
                 vehicle ids, so car-following pairs are given.

  TGSIM (2024)   I-294, I-90/94, I-395, 2.5-10 Hz, and I-294 "L2" is the
                 one that matters here: mean 62 mph for cars, 56 for
                 trucks. That is FREE-FLOWING freeway, which is what
                 nearly all of I-40 is, and no public trajectory set
                 before it was.

Between them they bracket the corridor: I-294 L2 for the 2,300 rural
miles, I-294 L1 (42 mph) for the approach to a city, NGSIM for
Nashville and Memphis at five o'clock.

Units differ and it matters. NGSIM is FEET and feet/second. TGSIM is
METRES and metres/second. Nothing here converts them; the derivation
does, once, where it is written down.
"""
import json, os, ssl, sys, time, urllib.parse, urllib.request

try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = ssl.create_default_context()

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'traj')
API = 'https://data.transportation.gov/resource/{id}.json'
PAGE = 50000

SETS = {
    # TGSIM: free-flowing and part-congested freeway, 2024
    'i294_l2': dict(id='tpsq-zrwa', cols=[
        'id', 'time', 'xloc_kf', 'yloc_kf', 'lane_kf', 'speed_kf',
        'acceleration_kf', 'length_smoothed', 'width_smoothed',
        'type_most_common', 'run_index']),
    'i294_l1': dict(id='7zjf-a4zf', cols=[
        'id', 'time', 'xloc_kf', 'yloc_kf', 'lane_kf', 'speed_kf',
        'acceleration_kf', 'length_smoothed', 'width_smoothed',
        'type_most_common', 'run_index']),
    # NGSIM: congested freeway, 2005, with headways already measured
    'ngsim_i80': dict(id='8ect-6jqj', where="location='i-80'", cols=[
        'vehicle_id', 'frame_id', 'global_time', 'local_y', 'v_vel', 'v_acc',
        'lane_id', 'v_class', 'v_length', 'space_headway', 'time_headway',
        'preceding']),
    'ngsim_us101': dict(id='8ect-6jqj', where="location='us-101'", cols=[
        'vehicle_id', 'frame_id', 'global_time', 'local_y', 'v_vel', 'v_acc',
        'lane_id', 'v_class', 'v_length', 'space_headway', 'time_headway',
        'preceding']),
}


def get(url, tries=4):
    for n in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=300, context=CTX) as r:
                return json.loads(r.read())
        except Exception as e:
            if n == tries - 1:
                raise
            print(f"    retry {n+1}: {e}")
            time.sleep(3 + 5 * n)


def fetch(name, spec):
    base = API.format(id=spec['id'])
    order = spec['cols'][0] + ',' + spec['cols'][1]
    rows, off = [], 0
    while True:
        q = {'$select': ','.join(spec['cols']), '$order': order,
             '$limit': PAGE, '$offset': off}
        if spec.get('where'):
            q['$where'] = spec['where']
        got = get(base + '?' + urllib.parse.urlencode(q))
        if not got:
            break
        rows.extend(got)
        off += len(got)
        print(f"    {name}: {off}")
        if len(got) < PAGE:
            break
    return rows


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name in (sys.argv[1:] or SETS):
        p = os.path.join(OUT, f'{name}.json')
        if os.path.exists(p) and '--force' not in sys.argv:
            print(f"{name}: have it")
            continue
        rows = fetch(name, SETS[name])
        json.dump(rows, open(p, 'w'), separators=(',', ':'))
        print(f"  {name}: {len(rows)} rows, "
              f"{os.path.getsize(p)/1e6:.1f} MB")
