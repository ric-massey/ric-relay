# The traffic data, and how to rebuild it

Everything under here answers one question for the game: **what is on
this road, at this place, at this time, on this day** — and then a
second one: **what does each of those vehicles do**.

The first question is answered entirely from I-40 itself. The second
cannot be, because nobody has filmed I-40 from a drone; see
[BEHAVIOUR.md](BEHAVIOUR.md) for what stands in for it and how far that
can be trusted.

## The pipeline

Run in this order. Every step is idempotent and skips work it has
already done, so re-running the lot is cheap.

```bash
python3 fetch_hpms.py       # 8 states of HPMS 2024 from geo.dot.gov   ~40 MB
python3 refline.py          # the corridor as lat/lon, from the OSM slices
python3 join_hpms.py        # put the sections on the corridor -> sections.json
# TMAS is twelve plain zips; see .gitignore for the curl loop     ~1.2 GB
python3 tmas_stations.py    # which counters stand on I-40 -> stations.json
python3 tmas_volume.py      # a year of hours at each -> hourly.json
python3 emit.py             # -> ../traffic.js, which is what the game loads

python3 fetch_traj.py i294_l2 i294_l1   # TGSIM trajectories        ~270 MB
python3 behaviour.py                    # -> behaviour.json
python3 ngsim.py                        # NGSIM histograms, appended to it

python3 tcds.py survey      # which TDOT counters hold speed / class data
python3 tcds.py speed       # hour x speed-bin tables    -> tcds_speed.json
python3 tcds.py class       # hour x length-bin tables   -> tcds_class.json
python3 speeds.py           # observed speeds on I-40    -> observed.json
python3 trucks.py           # lorry share by hour        -> mix.json
```

The three `tcds.py` steps need a cookie. TDOT's TCDS sits behind AWS
WAF, so a bare request gets a 202 challenge — it is a bot filter, not an
access restriction; the data is public and the site hands it to anyone
who loads it in a browser. Open `tdot.public.ms2soft.com` in one, paste
`document.cookie` into `tcds_cookie.txt`, and every request after that
is ordinary HTTP. The token expires in hours; when the pull starts
returning nothing, that is what happened, and the fix is to paste a
fresh one.

Raw downloads are gitignored, and so is `sections.json` — they are all
public federal files, and `join_hpms.py` rebuilds the 8 MB of sections
in two seconds once `hpms/` is back. What is committed is what is either
small or expensive to get again: `refline.json`, `stations.json`,
`hourly.json` (a year of TMAS, which cost a 1.2 GB download),
`behaviour.json`, and `../traffic.js` itself.

## What each file is

| File | What |
|---|---|
| `fetch_hpms.py` | queries FHWA's per-state HPMS feature services for I-40 |
| `refline.py` | rebuilds the surveyed centreline as lat/lon + distance, so real-world coordinates can be put on it. Cached in `refline.json`. |
| `join_hpms.py` | places 34,824 HPMS sections on the corridor by geometry |
| `tmas_stations.py` | finds the 130 permanent counters standing on I-40 |
| `tmas_volume.py` | folds a year of hourly counts into week / year / lane shapes |
| `emit.py` | writes `../traffic.js` |
| `fetch_traj.py`, `behaviour.py`, `ngsim.py` | the trajectory work |
| `tcds.py` | scrapes TDOT's counters for observed speed and vehicle length, hour by hour |
| `speeds.py` | what people drive against what the sign says → `observed.json` |
| `trucks.py` | lorry share by hour, as a multiplier on the daily average → `mix.json` |

## The two things that would have gone wrong silently

Recorded because both were caught by measurement rather than by
reasoning, and either would have produced a game that felt wrong for no
visible reason.

**The duplicate carriageway.** Every mainline section on I-40 is coded
`FACILITY_TYPE = 2`, two-way, meaning its AADT is both directions on one
centreline — but four states inventory the two carriageways separately
and code *both* of them two-way. Adding those up doubles the road.
A mile therefore takes the **median** of the sections covering it, and
`join_hpms.py` reports how far apart those sections were: median 0.0%,
90th percentile 0.0%. They carry the same number, which is what the
median-not-sum reasoning predicted.

**Counters that are not on the road.** Five of the 135 candidates were
standing beside I-40 rather than on it — I-540, I-440 and US-421 in
North Carolina, Business Loop 40 in Flagstaff — and two more survived
the geometry filter and were caught only by comparing their own year of
counting against the HPMS AADT beside them. `emit.py` drops anything
outside 0.6–1.6x. Over the 64 counters that can be checked the median
ratio is **1.02**, which is the strongest single piece of evidence that
the whole join is right: two federal datasets, collected by different
means, agreeing about I-40 to within 2%.

## What is in `../traffic.js`

Run-length encoded along the corridor in world px, exactly like `lanes`
and `speed` in `i40.js`, plus the counters and their normalised shapes.
The whole thing is 0.28 MB. The header comment in the file itself is the
reference; the short version is

```js
flow(px, when) = aadt(px) / 2 * week(dayOfWeek, hour) * month(month)
```

with `week` averaging 1.0 over its 168 cells and `month` over its 12, so
the magnitude lives in one place and the shape in another and they
cannot drift apart.
