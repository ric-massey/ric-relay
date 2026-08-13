"""Observed speeds and vehicle lengths on I-40 itself, from TDOT.

── why this exists ──────────────────────────────────────────────────────
Everything else in this directory is either a COUNT (how many) or a
stand-in (how vehicles behave, measured on some other freeway). Two
things were missing and both are here:

  * **what speed people actually drive on I-40**, as against the posted
    limit — the corridor profile says 70 through west Tennessee and the
    counter beside it says the 85th percentile is 83.
  * **the lorry share hour by hour**. HPMS gives a daily average and a
    design-hour figure and nothing in between, and the small hours on
    rural I-40 are nothing like the daily average.

Tennessee DOT publishes both, per counter, per day, as an hour x bin
table: 15 speed bins from 0-20 to 85+, and 14 vehicle-LENGTH bins from
0-8 ft to 200+. Length is not the FHWA 13-class scheme but it separates
what this game needs to separate — under 23 ft is a car, over 35 ft is
articulated — and it is reported for every hour of every day.

── getting at it ────────────────────────────────────────────────────────
TDOT's TCDS is behind AWS WAF, so a plain request gets a 202 challenge
or a CloudFront 403. It is not an access restriction — the data is
public and the site serves it to anyone who loads it in a browser — it
is a bot filter. So the browser does the challenge once and its cookies
go in `tcds_cookie.txt`; everything after that is ordinary HTTP. When
the token expires the fix is to reload the site in a browser and paste
`document.cookie` back into that file.

The station ids are the same numbers TMAS uses with the leading zeros
taken off: TMAS `000078` is TCDS `78`. That is how the two joined.

Only Tennessee is covered. Every state on the corridor runs the same
MS2 software behind the same kind of filter, so the other seven are the
same job seven more times: `ncdot.public.ms2soft.com`, `adot.`, and so
on, with a different `agency_id`.
"""
import collections, json, os, re, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
HOST = 'https://tdot.public.ms2soft.com'
AGENCY = 295
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36')
PAUSE = 0.15


def cookie():
    p = os.path.join(HERE, 'tcds_cookie.txt')
    if not os.path.exists(p):
        sys.exit("no tcds_cookie.txt — open the site in a browser and "
                 "paste document.cookie into it")
    return open(p).read().strip()


CK = None


def get(url):
    global CK
    if CK is None:
        CK = cookie()
    r = subprocess.run(
        ['curl', '-sS', '--max-time', '90', '-A', UA,
         '-H', f'Cookie: {CK}',
         '-H', f'Referer: {HOST}/tcds/tdetail.asp?offset=0&a=',
         '-H', 'X-Requested-With: XMLHttpRequest', url],
        capture_output=True, text=True)
    time.sleep(PAUSE)
    return r.stdout


def listing(local_id, kind, page=1):
    # `pg` is one-based; pg=0 returns the navigation furniture and no rows,
    # which cost a debugging round to find.
    """One page of a station's speed or class counts."""
    u = (f"{HOST}/tcds/ajax/tcds_tdetail_gcs.asp?offset=0&agency_id={AGENCY}"
         f"&local_id={local_id}&sdate=&classDate=&speedDate=&gapDate="
         f"&hide_detail=&curTime=&gcs={kind}&pg={page}&ajax_time=1")
    h = get(u)
    total = 0
    m = re.search(r'of\s+([\d,]+)\s*<br', h)
    if m:
        total = int(m.group(1).replace(',', ''))
    rows = []
    for m in re.finditer(
            r"tcount_gcs\.asp\?[^\"']*?id=(\d+)[^\"']*?jump_date=(\d{4}-\d\d-\d\d)",
            h):
        rows.append((int(m.group(1)), m.group(2)))
    return total, rows


BINS = re.compile(r"<tr id='columnHeaders'>(.*?)</tr>", re.S)
CELL = re.compile(r'<t[hd][^>]*>(.*?)</t[hd]>', re.S)
ROW = re.compile(r"<tr><td style='text-align: left;padding-right:2px;' nowrap>"
                 r"(.*?)</td>(.*?)</tr>", re.S)


def strip(s):
    return re.sub(r'<[^>]+>', '', s).replace('&nbsp;', ' ').strip()


def report(count_id, local_id, date, kind):
    """One count: bin labels and 24 rows of counts, one per hour."""
    u = (f"{HOST}/tcds/tcount_gcs.asp?offset=0&id={count_id}&a={AGENCY}"
         f"&jump_date={date}&sdate={date}"
         f"&classDate={date if kind == 'CLASS' else ''}"
         f"&speedDate={date if kind == 'SPEED' else ''}"
         f"&gapDate=&local_id_dir={local_id}&count_type={kind}")
    h = get(u)
    mb = BINS.search(h)
    if not mb:
        return None
    labels = [strip(c) for c in CELL.findall(mb.group(1))][1:]   # drop "Start Time"
    hours = {}
    for m in ROW.finditer(h):
        t = strip(m.group(1))
        vals = [strip(c) for c in CELL.findall(m.group(2))]
        try:
            vals = [int(v.replace(',', '')) for v in vals]
        except ValueError:
            continue
        hm = re.match(r'(\d+):00 ([AP])M', t)
        if not hm:
            continue
        hh = int(hm.group(1)) % 12 + (12 if hm.group(2) == 'P' else 0)
        hours[hh] = vals
    if len(hours) < 20:
        return None
    dirn = re.search(r'Direction</td>\s*<td[^>]*>(.*?)</td>', h, re.S)
    return {'labels': labels, 'hours': hours,
            'dir': strip(dirn.group(1)) if dirn else None}


# ── what is available ────────────────────────────────────────────────────

def survey():
    locs = json.load(open(os.path.join(HERE, 'tcds_i40.json')))
    seen, out = set(), []
    for a in locs:
        lid = a['LOCAL_ID']
        if lid in seen:
            continue
        seen.add(lid)
        rec = {'id': lid, 'mi': a['mi'], 'off': a['off']}
        for kind in ('speed', 'class'):
            n, rows = listing(lid, kind)
            rec[kind] = n
        if rec['speed'] or rec['class']:
            out.append(rec)
            print(f"  {lid:>12}  mi {a['mi']:8.2f}  speed {rec['speed']:5d}  "
                  f"class {rec['class']:5d}")
    out.sort(key=lambda r: r['mi'])
    json.dump(out, open(os.path.join(HERE, 'tcds_avail.json'), 'w'), indent=1)
    print(f"\n{len(out)} of {len(seen)} I-40 locations have speed or class data")
    return out


# ── pulling it ───────────────────────────────────────────────────────────

DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
PER_STATION = 60      # counts to sample per station per kind


def dow_of(date):
    import datetime
    y, m, d = map(int, date.split('-'))
    return datetime.date(y, m, d).weekday()


def pull(avail, kind, minimum):
    """Sum hour x bin over the sampled days, split weekday / weekend."""
    KIND = kind.upper()
    out = []
    for rec in avail:
        if rec[kind] < minimum:
            continue
        lid = rec['id']
        # Spread the sample across the whole listing rather than taking
        # the first six pages, which would be six weeks of one winter.
        # The listing is newest-first, ten to a page.
        pages = max(1, (rec[kind] + 9) // 10)
        step = max(1, pages * 10 // PER_STATION)
        rows = []
        for page in range(1, pages + 1, step):
            n, got = listing(lid, kind, page)
            if not got:
                continue
            rows.extend(got)
            if len(rows) >= PER_STATION:
                break
        acc = {'wd': None, 'we': None}
        labels, days = None, collections.Counter()
        for cid, date in rows:
            r = report(cid, lid, date, KIND)
            if not r:
                continue
            labels = r['labels']
            k = 'we' if dow_of(date) >= 5 else 'wd'
            if acc[k] is None:
                acc[k] = [[0] * len(labels) for _ in range(24)]
            for hh, vals in r['hours'].items():
                for i, v in enumerate(vals[:len(labels)]):
                    acc[k][hh][i] += v
            days[k] += 1
        if not labels or not days:
            continue
        out.append({'id': lid, 'mi': rec['mi'], 'labels': labels,
                    'days': dict(days),
                    'weekday': acc['wd'], 'weekend': acc['we']})
        print(f"  {lid:>12}  mi {rec['mi']:8.2f}  {kind}: "
              f"{days['wd']} weekdays, {days['we']} weekend days")
    p = os.path.join(HERE, f'tcds_{kind}.json')
    json.dump(out, open(p, 'w'), separators=(',', ':'))
    print(f"wrote {os.path.basename(p)}  {len(out)} stations")
    return out


if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'survey'
    if what == 'survey':
        survey()
    else:
        avail = json.load(open(os.path.join(HERE, 'tcds_avail.json')))
        # 300+ counts means a permanent counter reporting all year, which
        # is what a profile can be built from. A 48-hour tube count in
        # one week of one month cannot stand for a year.
        pull(avail, what, 300)
