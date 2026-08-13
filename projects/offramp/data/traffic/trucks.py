"""What share of the traffic is a lorry, hour by hour.

This closes the gap `BEHAVIOUR.md` §5 listed as unclosable from any
national source. HPMS gives one number per section — the daily average
lorry share — and TMAS holds hourly class counts but FHWA publishes
only the volume half of it. What nobody had was the *shape*: how the
mix swings between three in the morning and eight.

TDOT publishes it, per counter, per day, as an hour x vehicle-LENGTH
table. Length is not the FHWA 13-class scheme, but it separates the
three things the game has to draw differently:

    moto         under 8 ft    motorcycles
    car          8 to 23 ft    saloon, pickup, SUV
    rigid        23 to 50 ft   box van, coach, motorhome, car + trailer
    artic        over 50 ft    tractor-trailer; a 5-axle semi is 65-75

and unlike the axle-based schemes it cannot confuse a pickup towing a
boat with a lorry, because it simply measures how long the thing is.

**Motorcycles get their own class** and it is the one thing here with no
second source: HPMS does not count them at all, so unlike the artic
share there is nothing to check this against. What it says is that they
are 0.89% of traffic over a year, and — the reason they were pulled out
of `car` at all — that they are **relatively commoner at night**, 1.17%
of the small hours against 0.78% mid-afternoon. Be careful reading that:
in absolute numbers there are about four times FEWER of them at three in
the morning. The share rises because everything else falls away faster.

The headline, and it is a big one: **rural I-40 at three in the morning
is two thirds artics, against a fifth at eight.** The daily average that
HPMS reports is a number that is true at no hour of the day.

Validated against HPMS the same way the volume join was: this counter's
own year of counting, daily mean, against the combination-lorry share of
the section beside it.
"""
import json, os, statistics, sys

from refline import MI, M_PER_PX, HERE

# TDOT's vehicle-length bins, lower edge in feet, and which class each
# one lands in. The last two published bins are always empty.
EDGES = [0, 8, 18, 23, 25, 30, 35, 40, 45, 50, 65, 70, 75, 200]
CLASS = ['moto', 'car', 'car', 'rigid', 'rigid', 'rigid', 'rigid',
         'rigid', 'rigid', 'artic', 'artic', 'artic', 'artic', 'artic']
KINDS = ['moto', 'car', 'rigid', 'artic']

# A counter whose year of counting puts the artic share this far from the
# HPMS combination share of the section beside it is not measuring length
# properly. Six of the seven land between 0.77 and 1.01; the seventh
# reports 0.1% artics where HPMS says 24%, because its loop spacing sizes
# a 5-axle semi at 45 ft and everything above 50 ft comes back empty.
RATIO = (0.5, 2.0)


def corridor():
    s = open(os.path.join(HERE, '..', 'traffic.js')).read()
    k = 'window.I40_TRAFFIC = '
    return json.loads(s[s.index(k) + len(k):].rstrip().rstrip(';'))


def at(runs, mi):
    px = mi * MI / M_PER_PX
    v = None
    for x, val in runs:
        if x > px:
            break
        v = val
    return v


def split(counts):
    """One hour's bin counts -> {car, rigid, artic} totals."""
    out = dict.fromkeys(KINDS, 0)
    for i, c in enumerate(counts[:len(CLASS)]):
        out[CLASS[i]] += c
    return out


def shares(counts):
    s = split(counts)
    n = sum(s.values())
    return None if n < 100 else {k: s[k] / n for k in KINDS}, n


def main():
    d = corridor()
    C = json.load(open(os.path.join(HERE, 'tcds_class.json')))

    pool = {'wd': [[0] * len(CLASS) for _ in range(24)],
            'we': [[0] * len(CLASS) for _ in range(24)]}
    stations, dropped = [], []
    for r in C:
        allh = [0] * len(CLASS)
        per = {'wd': None, 'we': None}
        for key, k in (('weekday', 'wd'), ('weekend', 'we')):
            if not r[key]:
                continue
            per[k] = r[key]
            for h in range(24):
                for i in range(len(CLASS)):
                    allh[i] += r[key][h][i]
        sh, n = shares(allh)
        # HPMS's own answer for the same place, for the cross-check
        aadt = at(d['aadt'], r['mi']) or 0
        combo = at(d['combo'], r['mi'])
        hpms = (combo / aadt) if aadt and combo else None
        rec = {
            'id': r['id'], 'mi': round(r['mi'], 2), 'n': n,
            'days': r['days'],
            'share': {k: round(v, 4) for k, v in sh.items()},
            'hpmsCombo': None if hpms is None else round(hpms, 4),
        }
        ratio = (sh['artic'] / hpms) if hpms else None
        rec['ratio'] = None if ratio is None else round(ratio, 3)
        if ratio is not None and not RATIO[0] <= ratio <= RATIO[1]:
            dropped.append(rec)
            continue
        stations.append(rec)
        for k in ('wd', 'we'):
            if per[k]:
                for h in range(24):
                    for i in range(len(CLASS)):
                        pool[k][h][i] += per[k][h][i]

    print(f"{'stn':>6} {'mile':>8} {'vehicles':>11}   " +
          '  '.join(f'{k:>5}' for k in KINDS) + f"   {'HPMS combo':>10}  ratio")
    for s in stations + dropped:
        h = '-' if s['hpmsCombo'] is None else f"{s['hpmsCombo']*100:9.1f}%"
        flag = '  DROPPED' if s in dropped else ''
        print(f"{s['id']:>6} {s['mi']:8.1f} {s['n']:11,}   "
              + '  '.join(f"{s['share'][k]*100:5.1f}" for k in KINDS)
              + f"   {h}  {s['ratio']}{flag}")
    rr = [s['ratio'] for s in stations if s['ratio']]
    if rr:
        print(f"\n  artic share vs HPMS combination share: median ratio "
              f"{statistics.median(rr):.2f} over {len(rr)} counters kept")

    out = {'source': 'TDOT TCDS', 'edges': EDGES, 'kinds': KINDS,
           'stations': stations, 'dropped': dropped, 'hour': {}, 'mult': {}}
    for k in ('wd', 'we'):
        rows = []
        for h in range(24):
            sh, n = shares(pool[k][h])
            rows.append(None if sh is None else
                        {'n': n, **{c: round(sh[c], 4) for c in KINDS}})
        out['hour'][k] = rows

    # The generalisable form, and the reason this file is shaped like the
    # week and month profiles next to it: the hourly ARTIC SHARE as a
    # multiplier on the section's own daily average, so it can be carried
    # to the Mojave, which has a third more lorries and no counter.
    #
    #   articShare(px, when) = combo(px)/aadt(px) x mult(dow >= 5, hour)
    #
    # Weighting the mean by hourly volume, not by hour, so it reproduces
    # the daily average the multiplier divides into.
    tot = sum(r['n'] for k in ('wd', 'we') for r in out['hour'][k] if r)
    base = sum(r['n'] * r['artic'] for k in ('wd', 'we')
               for r in out['hour'][k] if r) / tot
    out['base'] = round(base, 4)
    for k in ('wd', 'we'):
        out['mult'][k] = [None if not r else round(r['artic'] / base, 3)
                          for r in out['hour'][k]]
    print(f"\n  daily-average artic share across the kept counters: "
          f"{base*100:.1f}%  (the multipliers divide into this)")

    # Motorcycles the same way, and the shape is the opposite one: they
    # are relatively COMMONER in the small hours, 1.17% against 0.78%
    # mid-afternoon. Absolutely there are about four times fewer of them
    # then — the share rises because everything else falls away faster —
    # so this multiplier must be applied to a share and never to a count.
    #
    # Unlike `mult` this has no second source. HPMS does not count
    # motorcycles at all, and the per-counter spread is wide: 0.2% at
    # counter 78 against 2.4% at counter 80, which is more variation than
    # a real motorcycle population has and says some of the 0-8 ft bin is
    # the loop rather than the road. The hourly SHAPE is consistent
    # across all six, which is why the shape is what gets emitted and the
    # level comes from the pooled average.
    mbase = sum(r['n'] * r['moto'] for k in ('wd', 'we')
                for r in out['hour'][k] if r) / tot
    out['motoBase'] = round(mbase, 5)
    out['motoMult'] = {}
    for k in ('wd', 'we'):
        out['motoMult'][k] = [None if not r else round(r['moto'] / mbase, 3)
                              for r in out['hour'][k]]
    print(f"  daily-average motorcycle share: {mbase*100:.2f}%  "
          f"(night {out['motoMult']['wd'][3]:.2f}x, "
          f"afternoon {out['motoMult']['wd'][16]:.2f}x)")

    for k, label in (('wd', 'weekday'), ('we', 'weekend')):
        print(f"\n{label}, pooled over {len(stations)} counters")
        print(f"{'hr':>3} {'vehicles':>10}   " +
              '  '.join(f'{k:>5}' for k in KINDS) + f"   {'x avg':>6}")
        for h in range(24):
            r = out['hour'][k][h]
            if not r:
                continue
            print(f"{h:3} {r['n']:10,}   "
                  + '  '.join(f"{r[c]*100:5.1f}" for c in KINDS)
                  + f"   {out['mult'][k][h]:6.2f}")

    p = os.path.join(HERE, 'mix.json')
    json.dump(out, open(p, 'w'), separators=(',', ':'))
    print(f"\nwrote {os.path.basename(p)}")


if __name__ == '__main__':
    main()
