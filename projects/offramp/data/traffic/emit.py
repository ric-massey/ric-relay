"""Emit the corridor's traffic as one file the game can index by px.

── the shape of the answer ──────────────────────────────────────────────
The game asks one question — *what is on this road, here, now* — and it
has three arguments: where you are, what time it is, and what day. So
the file is built as a product of two independent things:

    a PLACE profile   how much traffic this stretch carries in a year,
                      what fraction of it is lorries, how many lanes it
                      has, what the limit is. Run-length encoded along
                      the corridor in world px, exactly like `lanes` and
                      `speed` already are in i40.js.

    a TIME profile    the shape of a week and the shape of a year at the
                      nearest permanent counter. Normalised, so it is a
                      multiplier on the place profile rather than a
                      second opinion about volume.

    flow(px, when) = AADT(px) x week(dow, hour) x month(m) x direction

Everything is measured. Nothing here is a shape somebody drew.

── what is NOT in it ────────────────────────────────────────────────────
California has no permanent counter on I-40 in FHWA's 2025 station file
— the nearest is on I-15 at Calico — so its 155 miles borrow the time
profile of the nearest counter, which is 156 miles east in Arizona and
the same desert. That is stated in the file rather than hidden, and the
`borrowed` flag says so per state.
"""
import bisect, collections, json, math, os, statistics, sys

from refline import load_ref, MI, M_PER_PX, HERE

BIN = 0.1 * MI
STATES = ['CA', 'AZ', 'NM', 'TX', 'OK', 'AR', 'TN', 'NC']

# Maximum posted limits on I-40, from the IIHS state table. HPMS carries
# the posted limit per section and that is what the profile uses; this is
# here for the one thing HPMS does not record, which is that in two of
# the eight states a lorry is not allowed to go as fast as you are.
LIMITS = {
    'CA': {'rural': 70, 'urban': 65, 'truck_rural': 55, 'truck_urban': 55},
    'AZ': {'rural': 75, 'urban': 65},
    'NM': {'rural': 75, 'urban': 75},
    'TX': {'rural': 75, 'urban': 75},
    'OK': {'rural': 75, 'urban': 70},
    'AR': {'rural': 75, 'urban': 65, 'truck_rural': 70, 'truck_urban': 70},
    'TN': {'rural': 70, 'urban': 70},
    'NC': {'rural': 70, 'urban': 70},
}

# A counter whose own year of counting disagrees with the HPMS AADT
# beside it by more than this is measuring a different road. Measured
# over the 64 counters that can be checked, the median ratio is 1.02 and
# the tenth-to-ninetieth range is 0.93 to 1.16, so this is loose enough
# to keep every honest disagreement and still catch the two that are
# standing on I-540 and NC 24.
RATIO = (0.6, 1.6)


def runs(bins, pick, quant=lambda v: v):
    """Run-length encode a per-bin value as [px, value] pairs."""
    out, last = [], object()
    for i, b in enumerate(bins):
        v = [pick(r) for r in b]
        v = [x for x in v if x is not None]
        val = quant(statistics.median(v)) if v else None
        if val != last:
            out.append([round(i * BIN / M_PER_PX, 1), val])
            last = val
    return out


def place(length_m):
    secs = json.load(open(os.path.join(HERE, 'sections.json')))
    n = int(length_m / BIN) + 1
    bins = [[] for _ in range(n)]
    for r in secs:
        for i in range(int(r['m0'] / BIN), min(n - 1, int(r['m1'] / BIN)) + 1):
            bins[i].append(r)

    def trucks(r):
        return (r['aadt_single_unit'] or 0) + (r['aadt_combination'] or 0)

    hundred = lambda v: int(round(v / 100.0) * 100)
    whole = lambda v: int(round(v))
    return {
        # two-way vehicles per day, all vehicles
        'aadt': runs(bins, lambda r: r['aadt'], hundred),
        # of which lorries: single-unit and combination, separately,
        # because they do not behave the same and the game will not draw
        # them the same
        'single': runs(bins, lambda r: r['aadt_single_unit'], hundred),
        'combo': runs(bins, lambda r: r['aadt_combination'], hundred),
        # through lanes across the WHOLE cross-section. Every mainline
        # section on I-40 is coded two-way, and for a two-way section
        # HPMS counts both directions: the value is 4 over 2,159 of the
        # 2,551 miles, which is rural I-40's two lanes each way.
        'lanes': runs(bins, lambda r: r['through_lanes'], whole),
        # posted limit, mph, as the state reported it
        'speed': runs(bins, lambda r: r['speed_limit'], whole),
        # design-hour share of the day, per cent
        'k': runs(bins, lambda r: r['k_factor'], whole),
        # busier direction's share in the design hour, per cent
        'd': runs(bins, lambda r: r['dir_factor'], whole),
        'urban': runs(bins, lambda r: 0 if r['urban_id'] in (99999, 99998)
                      else 1, whole),
        'terrain': runs(bins, lambda r: r['terrain_type'], whole),
    }, bins


def osm_speed():
    """The posted limit as OSM has it, for the stretches HPMS leaves
    blank. HPMS speed_limit is a reported field and four states report it
    sparsely — California reports 17 miles of its 155. Where both exist
    they are compared rather than assumed to agree."""
    p = os.path.join(HERE, '..', 'osm', 'i40.json')
    c = json.load(open(p))
    out = []
    for px, v in c['speed']:
        n = ''.join(ch for ch in v if ch.isdigit())
        if n:
            out.append([px, int(n)])
    return out


def fill(prof, key, other, name):
    """Where the profile has no value, take one from `other` and say how
    often that happened."""
    xs = [r[0] for r in other]
    filled = 0
    out = []
    for px, v in prof[key]:
        if v is None and other:
            i = max(0, bisect.bisect_right(xs, px) - 1)
            v = other[i][1]
            filled += 1
        out.append([px, v])
    # merge runs that became equal
    merged = []
    for px, v in out:
        if merged and merged[-1][1] == v:
            continue
        merged.append([px, v])
    prof[key] = merged
    print(f"  {name}: {filled} of {len(out)} runs filled from the fallback")
    return filled


# No I-40 mainline is posted outside this range in any of the eight
# states. The floor is 50 rather than 55 because one 1.3-mile stretch in
# eastern Oklahoma really is 50, and HPMS and the OSM survey agree on it.
POSTED = (50, 75)

# How far HPMS and the OSM survey may disagree before the survey wins.
# Under this, HPMS is preferred: it is the state's own return and it has
# 4,197 runs against the survey's 70, so it is where the resolution is.
DISAGREE = 10


def reconcile(prof, other, name, nbin):
    """Where HPMS's posted limit cannot be a posted limit, take the
    corridor's own OSM survey instead.

    `speed_limit` is an optional HPMS field and it is the dirtiest one in
    the return. Not sparse — dirty. Tennessee reports **40 mph for 7.6
    miles** of I-40 through the Pigeon River Gorge and 45 through
    downtown Memphis; New Mexico reports 50 where the survey says 75.
    These are not ramp sections bleeding into a bin, which was the first
    theory and the wrong one: each is a single mainline section with four
    to six through lanes and twenty thousand vehicles a day on it. The
    states simply put a bad number in the field.

    The counters settle it where they overlap. At Newport the profile
    said 55, the survey said 65, and the counter standing on that
    stretch measures a median of 73 and a fifteenth percentile of 65 —
    a distribution that cannot happen under a 55. The survey wins there,
    so the survey wins generally, but only when the two are far enough
    apart that it cannot be a disagreement about where a transition
    falls. Three rules, in order:

      1. more than `DISAGREE` mph apart -> take the survey
      2. outside `POSTED` -> clamp
      3. not a multiple of five -> round to one, because signs are

    Rule 3 catches something different from the other two: 58, 62 and 68
    appear in single 0.1-mile bins where two sections carrying different
    limits overlap and the median lands between them. Those are ours,
    not the states'.

    Done **per bin and not per run**, which cost a round to learn. The
    two sources put their transitions in different places — HPMS changes
    where a section changes, the survey where a sign stands — so a run
    that straddles a transition gets judged against the neighbouring
    survey value and flips wholesale. The first attempt at this turned
    the 7.6 miles of gorge into 70 for exactly that reason, which is a
    worse answer than the 40 it was fixing. Comparing bin by bin also
    means a genuine offset between the two just relocates the transition
    to where the survey puts it, which is the right outcome: the survey
    is signs mapped in place, the return is an inventory.
    """
    xs = [r[0] for r in other]
    px_of = [r[0] for r in prof[name]]
    hit = collections.Counter()
    moved, out, last = [], [], None
    for i in range(nbin):
        px = round(i * BIN / M_PER_PX, 1)
        v = prof[name][max(0, bisect.bisect_right(px_of, px) - 1)][1]
        if v is not None:
            o = (other[max(0, bisect.bisect_right(xs, px) - 1)][1]
                 if other else None)
            was = v
            if o is not None and abs(v - o) >= DISAGREE:
                v, why = o, 'survey'
            elif not POSTED[0] <= v <= POSTED[1]:
                v, why = min(max(v, POSTED[0]), POSTED[1]), 'clamped'
            elif v % 5:
                v, why = int(round(v / 5.0)) * 5, 'rounded'
            else:
                why = None
            if why:
                hit[why] += 1
                moved.append((px, was, v, why))
        if v != last:
            out.append([px, v])
            last = v
    prof[name] = out
    for why in ('survey', 'clamped', 'rounded'):
        if hit[why]:
            print(f"  speed limit: {hit[why]} bins {why} "
                  f"({hit[why] * BIN / MI:.1f} mi)")
    # collapse the per-bin log into stretches, so it reads as roadway
    runs_out, cur = [], None
    for px, was, now, why in moved:
        if cur and cur[3] == (was, now, why) and px - cur[1] <= BIN / M_PER_PX * 1.5:
            cur[1] = px
        else:
            if cur:
                runs_out.append(cur)
            cur = [px, px, why, (was, now, why)]
    if cur:
        runs_out.append(cur)
    return runs_out


def constant(prof, key, value):
    out, filled = [], 0
    for px, v in prof[key]:
        if v is None:
            v = value
            filled += 1
        out.append([px, v])
    merged = []
    for px, v in out:
        if merged and merged[-1][1] == v:
            continue
        merged.append([px, v])
    prof[key] = merged
    return filled


def hpms_at(bins, m):
    i = min(len(bins) - 1, int(m / BIN))
    v = [r['aadt'] for r in bins[i] if r['aadt']]
    return statistics.median(v) if v else None


def counters(bins):
    """The permanent counters, reconciled against HPMS and normalised."""
    raw = json.load(open(os.path.join(HERE, 'hourly.json')))
    out, dropped = [], []
    for r in raw:
        m = r['mi'] * MI
        a = hpms_at(bins, m)
        both = sum(d['aadt'] for d in r['dirs'].values())
        if a and len(r['dirs']) == 2:
            ratio = both / a
            if not RATIO[0] <= ratio <= RATIO[1]:
                dropped.append((r['st'], r['id'], round(ratio, 2), r['where']))
                continue
        else:
            ratio = None
        rec = {'st': r['st'], 'id': r['id'], 'px': r['px'], 'mi': r['mi'],
               'off': r['off'], 'ratio': round(ratio, 3) if ratio else None,
               'aadt': round(both), 'dirs': {}}
        for d, v in r['dirs'].items():
            week = v['dow']
            tot = sum(x for row in week for x in row if x is not None)
            if not tot:
                continue
            # A week as fractions of itself: 168 numbers summing to 1.
            # The place profile carries the magnitude; this carries only
            # the shape, so the two can never disagree about how much
            # traffic there is.
            rec['dirs'][d] = {
                'days': v['days'],
                'aadt': round(v['aadt']),
                'week': [[round(x / tot * 168, 4) if x is not None else None
                          for x in row] for row in week],
                'month': _norm(v['month']),
                'lane': v['lane'],
            }
        if rec['dirs']:
            out.append(rec)
    return out, dropped


def _norm(vals):
    ok = [v for v in vals if v]
    if not ok:
        return None
    mean = sum(ok) / len(ok)
    return [round(v / mean, 4) if v else None for v in vals]


def fallback(cs):
    """One week and one year for the whole corridor, for the stretches
    with no counter on them — California's 155 miles, and the gaps."""
    wk = [[0.0] * 24 for _ in range(7)]
    mo = [0.0] * 12
    nw = [[0] * 24 for _ in range(7)]
    nm = [0] * 12
    for c in cs:
        for d in c['dirs'].values():
            for k in range(7):
                for h in range(24):
                    x = d['week'][k][h]
                    if x is not None:
                        wk[k][h] += x
                        nw[k][h] += 1
            if d['month']:
                for k in range(12):
                    if d['month'][k] is not None:
                        mo[k] += d['month'][k]
                        nm[k] += 1
    week = [[round(wk[k][h] / nw[k][h], 4) if nw[k][h] else None
             for h in range(24)] for k in range(7)]
    month = [round(mo[k] / nm[k], 4) if nm[k] else None for k in range(12)]
    return week, month


HEADER = """\
/* Interstate 40, as counted.

   Generated by data/traffic/emit.py. Do not hand-edit -- rerun it.

   Two independent federal sources, joined to the corridor by geometry:

     HPMS 2024   every state's own annual report to FHWA, pulled per
                 state from geo.dot.gov as one section per run of road
                 over which the reported attributes do not change.
                 {nsec} sections placed, covering {cov}% of the route.
     TMAS 2025   a full year of hourly counts from FHWA's permanent
                 counters. {ncnt} of them stand on I-40. {nrec} station-
                 days, every one of them 24 hourly numbers.

   They agree: summing a counter's two directions and comparing it with
   the HPMS AADT beside it gives a median ratio of {ratio}.

     aadt      [px, vehicles/day] runs, BOTH directions
     single    [px, vehicles/day] of it that are single-unit lorries
     combo     [px, vehicles/day] of it that are tractor-trailers
     lanes     [px, through lanes] BOTH directions -- these sections are
               all coded two-way, so this is the whole cross-section and
               half of it is what you drive on. 2,159 of the 2,551 miles
               read 4, which is rural I-40's two lanes each way.
     speed     [px, mph] posted -- the state's own return, reconciled
               against the corridor's OSM survey where the return
               reported something no sign says. 66 miles moved.
     k         [px, per cent] of the day's traffic in the design hour
     d         [px, per cent] of the design hour in the busier direction
     urban     [px, 0|1]      inside an urbanised area
     terrain   [px, 1|2|3]    level, rolling, mountainous
     counters  the permanent counters: `week` is 168 numbers averaging
               1.0 over a week, `month` is 12 averaging 1.0 over a year,
               `lane` is the share of the direction's traffic in each
               lane. Multiply, do not add -- these carry shape only, and
               `aadt` carries the magnitude.
     week      the corridor's average week, for the stretches with no
     month     counter on them, which is all of California.
     states    posted maxima, and the two states where a lorry's is lower

   flow(px, when, dir) = aadt(px) x dirShare x week(dow, hour)/24
                                            x month(month)

   **The /24 matters.** `week` averages exactly 1.0 over its 168 cells
   and `month` over its 12, so the three multiplied together are a DAY
   of traffic and not an hour of it. This line said `aadt/2 x week x
   month` until 2026-08-09 and was twenty-four times out; src/traffic.js
   is the reference implementation and test/traffic.test.js asserts the
   round trip. `dirShare` is the counter's own measured split, which is
   near enough a half everywhere -- the counters' annual split runs
   0.484 to 0.529 -- but the HOUR is not symmetric and should not be.

   And two blocks measured on I-40 itself, from TDOT's counters -- see
   BEHAVIOUR.md 2b and 2c. Both are OFFSETS or MULTIPLIERS rather than
   absolutes, for the same reason `week` is: they were measured over 260
   miles of Tennessee and they have to carry 2,551.

     observed  what people drive against what the sign says. `off` is
               mph over the posted limit at the 15th, 50th, 85th and
               95th percentile, per hour, weekday and weekend apart.
               The median driver is +3 and the 85th is +12, and the
               road is SLOWER at night, not faster.
     mix       `mult` scales a section's own daily lorry share by hour.
               Rural I-40 at 02:00 is 2.5x its daily average, which is
               more than half articulated lorries; a Saturday afternoon
               is 0.55x. `motoMult` is the same for motorcycles and runs
               the other way -- 1.3x in the small hours against 0.88x
               mid-afternoon -- on `motoBase`, 0.89% of all traffic.
               Both are SHARES. Motorcycles are absolutely rarer at
               night; they are a bigger fraction of a much emptier road.

   articShare(px, when) = combo(px)/aadt(px) x mix.mult(weekend, hour)

   {miles} miles - {nrun} profile runs - {ncnt} counters. */
"""


def measured(name, keep):
    """Fold one of the TDOT-derived files into the emitted object, if it
    has been built. Both are optional: the pipeline runs without them and
    the corridor data does not depend on them."""
    p = os.path.join(HERE, name)
    if not os.path.exists(p):
        print(f"  {name} not built - skipping (see README)")
        return None
    d = json.load(open(p))
    return {k: d[k] for k in keep if k in d}


if __name__ == '__main__':
    ref = load_ref()
    length = ref['m'][-1]
    prof, bins = place(length)

    # Where HPMS reported nothing. Speed comes from the corridor's own
    # OSM survey, which is complete; K and D from the corridor median,
    # because they are shape parameters that barely move — measured, the
    # inter-quartile range of K on I-40 is one percentage point.
    secs0 = json.load(open(os.path.join(HERE, 'sections.json')))
    osm = osm_speed()
    fill(prof, 'speed', osm, 'speed limit')
    # ...and then where HPMS reported something that is not a limit.
    moved = reconcile(prof, osm, 'speed', int(length / BIN) + 1)
    for a, b, why, (was, now, _) in moved:
        mi0, mi1 = a * M_PER_PX / MI, b * M_PER_PX / MI
        if abs(was - now) >= DISAGREE and mi1 - mi0 >= 0.5:
            print(f"    mi {mi0:7.1f} - {mi1:7.1f} ({mi1 - mi0:5.1f} mi)  "
                  f"{was} -> {now}  ({why})")
    for key, label in (('k', 'K factor'), ('d', 'D factor')):
        vals = [r['k_factor' if key == 'k' else 'dir_factor'] for r in secs0]
        vals = [v for v in vals if v]
        med = int(round(statistics.median(vals)))
        n = constant(prof, key, med)
        print(f"  {label}: {n} runs filled with the corridor median {med}")

    cs, dropped = counters(bins)
    for st, i, r, w in dropped:
        print(f"  dropped counter {st} {i}: {r}x the HPMS AADT beside it "
              f"({w[:40]})")
    week, month = fallback(cs)

    # which states have a counter of their own
    have = {c['st'] for c in cs}
    states = []
    for st in STATES:
        e = dict(LIMITS[st])
        e['name'] = st
        e['counters'] = sum(1 for c in cs if c['st'] == st)
        e['borrowed'] = e['counters'] == 0
        states.append(e)

    secs = json.load(open(os.path.join(HERE, 'sections.json')))
    covered = sum(1 for b in bins if b)
    ratios = [c['ratio'] for c in cs if c['ratio']]
    out = {
        'id': 'I-40',
        'binMi': 0.1,
        'hpmsYear': 2024, 'tmasYear': 2025,
        **prof,
        'counters': cs,
        'week': week, 'month': month,
        'states': states,
        'observed': measured('observed.json',
                             ('source', 'limit', 'pooled', 'pooledFrom',
                              'hour')),
        'mix': measured('mix.json', ('source', 'kinds', 'base', 'mult',
                                     'motoBase', 'motoMult')),
    }
    body = json.dumps(out, separators=(',', ':'))
    nrun = sum(len(v) for k, v in prof.items())
    head = HEADER.format(
        nsec=len(secs), cov=round(covered / len(bins) * 100, 1),
        ncnt=len(cs),
        nrec=sum(d['days'] for c in cs for d in c['dirs'].values()),
        ratio=round(statistics.median(ratios), 2) if ratios else '-',
        miles=round(length / MI, 2), nrun=nrun)
    p = os.path.join(HERE, '..', 'traffic.js')
    with open(p, 'w') as f:
        f.write(head)
        f.write('window.I40_TRAFFIC = ')
        f.write(body)
        f.write(';\n')
    print(f"\nwrote {os.path.relpath(p)}  {os.path.getsize(p)/1e6:.2f} MB")
    print(f"  {nrun} profile runs, {len(cs)} counters, "
          f"{covered/len(bins)*100:.1f}% of the corridor covered")
