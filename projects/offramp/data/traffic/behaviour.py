"""What the cars actually do, measured off real trajectories.

Everything in here is derived from vehicles that were filmed from above
and tracked frame by frame. Nothing is a modelling assumption and
nothing is a number remembered from a textbook — where a figure could
not be measured from a trajectory it is not in this file, it is in
`BEHAVIOUR.md` with a citation beside it.

Three sources, and they are a ladder rather than alternatives:

    TGSIM I-294 L2   62 mph mean — free-flowing, which is 2,300 of
                     I-40's 2,551 miles
    TGSIM I-294 L1   42 mph mean — busy but moving, the approach to a city
    NGSIM I-80 /
         US-101      10-20 mph — jammed, which is Nashville at five

Units: TGSIM is metres and m/s, NGSIM is feet and ft/s. The conversion
happens once, here, and everything emitted is SI.
"""
import collections, json, math, os, statistics, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TRAJ = os.path.join(HERE, 'traj')
FT = 0.3048
MPH = 0.44704

TGSIM = ['i294_l2', 'i294_l1']
NGSIM = ['ngsim_i80', 'ngsim_us101']


def f(x, d=None):
    try:
        return float(x)
    except (TypeError, ValueError):
        return d


def pct(vals, ps=(5, 15, 50, 85, 95)):
    if not vals:
        return {}
    v = sorted(vals)
    return {f'p{p}': round(v[min(len(v) - 1, int(len(v) * p / 100))], 3)
            for p in ps}


XBIN = 20.0             # m of road each lane-centre sample covers
SMOOTH = 5              # frames either side, to take the tracker's jitter out


def _centrelines(veh):
    """Where each lane actually runs, per drone flight.

    Needed because `yloc_kf` is a coordinate in the flight's own frame
    and I-294 curves through it, so a vehicle holding its lane still has
    a lateral velocity of well over half a metre a second. Two earlier
    attempts at measuring a lane change off raw lateral velocity both
    reported a median around ten seconds for a manoeuvre that takes
    about five, and that drift is why. The fix is to measure progress
    between the two lanes' own centrelines, which cancels it.
    """
    pts = collections.defaultdict(list)
    for (run, vid), v in veh.items():
        for t, x, y, ln, s, a, k, L in v:
            pts[(run, ln, int(x // XBIN))].append(y)
    return {k: statistics.median(v) for k, v in pts.items() if len(v) >= 5}


def _yc(centre, run, ln, x):
    b = int(x // XBIN)
    for db in (0, -1, 1, -2, 2, -3, 3):
        y = centre.get((run, ln, b + db))
        if y is not None:
            return y
    return None


def _manoeuvre(v, i, j, run, old, new, centre):
    """How long the lane change took, as the time to cross between the
    two lanes' centrelines, scaled to the full lane width.

    The crossing is taken on the MONOTONIC stretch containing the
    halfway point, so the minute or so a driver may spend drifting
    around inside a lane before committing is not counted as part of the
    manoeuvre — which is the whole difficulty in measuring this.
    """
    prog = []
    for k in range(max(0, i - 200), min(len(v), j + 200)):
        t, x, y = v[k][0], v[k][1], v[k][2]
        a = _yc(centre, run, old, x)
        b = _yc(centre, run, new, x)
        if a is None or b is None or abs(b - a) < 1.0:
            continue
        prog.append((t, (y - a) / (b - a)))
    if len(prog) < 20:
        return None
    prog = [(prog[k][0],
             sum(q[1] for q in prog[max(0, k - SMOOTH):k + SMOOTH + 1])
             / len(prog[max(0, k - SMOOTH):k + SMOOTH + 1]))
            for k in range(len(prog))]
    c = min(range(len(prog)), key=lambda k: abs(prog[k][1] - 0.5))
    a = c
    while a > 0 and prog[a - 1][1] < prog[a][1] and prog[a][1] > 0.10:
        a -= 1
    b = c
    while b < len(prog) - 1 and prog[b + 1][1] > prog[b][1] and prog[b][1] < 0.90:
        b += 1
    span = prog[b][1] - prog[a][1]
    if span < 0.5:
        return None
    return round((prog[b][0] - prog[a][0]) / span, 2)


# ── TGSIM ────────────────────────────────────────────────────────────────

def tgsim(name):
    rows = json.load(open(os.path.join(TRAJ, f'{name}.json')))
    # (run, vehicle) -> frames, in time order
    veh = collections.defaultdict(list)
    for r in rows:
        t = f(r.get('time'))
        x = f(r.get('xloc_kf'))
        s = f(r.get('speed_kf'))
        ln = f(r.get('lane_kf'))
        # A frame with no lateral position or no lane is a frame the
        # tracker lost; it cannot contribute to anything below.
        y = f(r.get('yloc_kf'))
        if None in (t, x, s, ln, y):
            continue
        veh[(r.get('run_index'), r['id'])].append(
            (t, x, y, int(ln), s, f(r.get('acceleration_kf'), 0.0),
             r.get('type_most_common') or '?', f(r.get('length_smoothed'), 0)))
    for v in veh.values():
        v.sort()

    dt = statistics.median([b[0] - a[0] for v in veh.values()
                            for a, b in zip(v, v[1:])][:20000]) or 0.1

    out = {'source': name, 'dt': round(dt, 3), 'vehicles': len(veh)}

    # speed and acceleration, by vehicle type
    speed = collections.defaultdict(list)
    accel = collections.defaultdict(list)
    lanespeed = collections.defaultdict(list)
    length = collections.defaultdict(list)
    for v in veh.values():
        kind = v[0][6]
        length[kind].append(v[0][7])
        for t, x, y, ln, s, a, k, L in v:
            speed[kind].append(s)
            accel[kind].append(a)
            lanespeed[(kind, abs(ln))].append(s)
    out['speed_ms'] = {k: pct(v) for k, v in speed.items()}
    out['accel_ms2'] = {k: pct(v, (1, 5, 50, 95, 99)) for k, v in accel.items()}
    out['length_m'] = {k: pct(v) for k, v in length.items()}
    out['lane_speed_ms'] = {f'{k}|{l}': pct(v)
                            for (k, l), v in sorted(lanespeed.items())}

    # lane occupancy: share of vehicle-seconds in each lane, per type.
    # Lane sign is direction; |lane| counts inward from the shoulder in
    # this data, and the emitter only ever uses the shape.
    occ = collections.Counter()
    for v in veh.values():
        for t, x, y, ln, s, a, k, L in v:
            occ[(k, abs(ln))] += 1
    tot = collections.Counter()
    for (k, l), n in occ.items():
        tot[k] += n
    out['lane_share'] = {f'{k}|{l}': round(n / tot[k], 4)
                         for (k, l), n in sorted(occ.items())}

    # lane changes: a change is a step in lane_kf that STAYS changed.
    # Tracking noise flips a vehicle across a boundary and back within a
    # few frames; a run of at least 1.5 s in the new lane is the filter.
    hold = max(2, int(round(1.5 / dt)))
    centre = _centrelines(veh)
    changes, dist, secs = collections.Counter(), collections.Counter(), \
        collections.Counter()
    durations = []
    for (run, vid), v in veh.items():
        kind = v[0][6]
        secs[kind] += len(v) * dt
        dist[kind] += sum(abs(b[1] - a[1]) for a, b in zip(v, v[1:]))
        lanes = [p[3] for p in v]
        i = 0
        while i < len(lanes) - 1:
            if lanes[i + 1] != lanes[i]:
                nxt = lanes[i + 1]
                j = i + 1
                while j < len(lanes) and lanes[j] == nxt:
                    j += 1
                if j - (i + 1) >= hold:
                    changes[kind] += 1
                    d = _manoeuvre(v, i, j, run, lanes[i], nxt, centre)
                    if d:
                        durations.append(d)
                    i = j
                    continue
            i += 1
    out['lane_change'] = {
        k: {'per_veh_km': round(changes[k] / (dist[k] / 1000), 3)
            if dist[k] else None,
            'per_veh_hour': round(changes[k] / (secs[k] / 3600), 2)
            if secs[k] else None,
            'n': changes[k]}
        for k in secs}
    out['lane_change_duration_s'] = pct(durations)

    # headway: at each instant, in each lane, the gap to the vehicle
    # ahead. This is the number that decides how a road FEELS, and it is
    # the one thing NGSIM gives directly and TGSIM does not.
    frames = collections.defaultdict(list)
    for (run, vid), v in veh.items():
        for t, x, y, ln, s, a, k, L in v:
            frames[(run, round(t, 2), ln)].append((x, s, k, L))
    gaps, times = [], []
    for key, lst in frames.items():
        lst.sort()
        for (x0, s0, k0, L0), (x1, s1, k1, L1) in zip(lst, lst[1:]):
            gap = x1 - x0 - L0
            if 0 < gap < 300 and s0 > 1:
                gaps.append(gap)
                times.append(gap / s0)
    out['space_headway_m'] = pct(gaps)
    out['time_headway_s'] = pct(times)
    out['headway_n'] = len(gaps)
    return out


# ── NGSIM ────────────────────────────────────────────────────────────────

CLASS = {1: 'motorcycle', 2: 'car', 3: 'truck'}


def ngsim(name):
    rows = json.load(open(os.path.join(TRAJ, f'{name}.json')))
    out = {'source': name, 'rows': len(rows)}
    speed = collections.defaultdict(list)
    accel = collections.defaultdict(list)
    space = collections.defaultdict(list)
    timeh = collections.defaultdict(list)
    occ = collections.Counter()
    veh = collections.defaultdict(list)
    for r in rows:
        c = CLASS.get(int(f(r['v_class'], 0)), '?')
        s = f(r['v_vel'], 0) * FT
        speed[c].append(s)
        accel[c].append(f(r['v_acc'], 0) * FT)
        sh = f(r['space_headway'], 0) * FT
        th = f(r['time_headway'], 0)
        # zero means "no vehicle ahead in this lane"; the dataset uses it
        # as a sentinel, and averaging it in would halve every headway.
        if sh > 0:
            space[c].append(sh)
        if 0 < th < 30:
            timeh[c].append(th)
        occ[(c, int(f(r['lane_id'], 0)))] += 1
        veh[r['vehicle_id']].append((f(r['frame_id'], 0),
                                     int(f(r['lane_id'], 0)),
                                     f(r['local_y'], 0) * FT))
    out['speed_ms'] = {k: pct(v) for k, v in speed.items()}
    out['accel_ms2'] = {k: pct(v, (1, 5, 50, 95, 99)) for k, v in accel.items()}
    out['space_headway_m'] = {k: pct(v) for k, v in space.items()}
    out['time_headway_s'] = {k: pct(v) for k, v in timeh.items()}
    tot = collections.Counter()
    for (k, l), n in occ.items():
        tot[k] += n
    out['lane_share'] = {f'{k}|{l}': round(n / tot[k], 4)
                         for (k, l), n in sorted(occ.items()) if tot[k]}
    ch = 0
    dist = 0.0
    for v in veh.values():
        v.sort()
        dist += abs(v[-1][2] - v[0][2])
        for a, b in zip(v, v[1:]):
            if a[1] != b[1]:
                ch += 1
    out['lane_change'] = {'n': ch,
                          'per_veh_km': round(ch / (dist / 1000), 3)
                          if dist else None}
    return out


if __name__ == '__main__':
    res = {}
    for n in TGSIM:
        p = os.path.join(TRAJ, f'{n}.json')
        if os.path.exists(p):
            print(f"deriving {n}...")
            res[n] = tgsim(n)
    for n in NGSIM:
        p = os.path.join(TRAJ, f'{n}.json')
        if os.path.exists(p):
            print(f"deriving {n}...")
            res[n] = ngsim(n)
    json.dump(res, open(os.path.join(HERE, 'behaviour.json'), 'w'), indent=1)
    print(json.dumps(res, indent=1)[:6000])
