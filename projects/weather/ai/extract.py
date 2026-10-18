#!/usr/bin/env python3
"""EXTRACT — our own AI weather run, read off at every US airport station.

.github/workflows/weather-ai.yml runs Pangu-Weather (Bi et al., Nature 2023;
weights CC BY-NC-SA 4.0, via ECMWF's ai-models) from ECMWF's open 12Z
analysis on GitHub's own machine, every evening. This reads the run's GRIB
output — global, 0.25 degrees, six-hourly — and keeps only what the
scoreboard grades: 2 m temperature and 10 m wind speed at each station of
IEM's AZOS network, bilinearly interpolated from the four grid points around
it.

    python3 extract.py out.grib stations.geojson store/

writes store/<init>.json:
    { "model": "pangu", "init": "2026-10-17T12:00:00Z", "times": [unix…],
      "stations": { "OKC": { "t": [°C…], "w": [km/h…] }, … } }

Hard rule 1: no coordinate is written. Positions come from the station list
fetched at run time and are used only to read the grid; the file names
stations by their public airport identifier, and it lives in the Actions
cache, not the repository. The store keeps the last KEEP runs."""
import json
import math
import os
import re
import sys
from datetime import datetime, timedelta, timezone

import numpy as np

KEEP = 12


def stations(path):
    """the same filter as verify/score.mjs stationsFrom()"""
    geo = json.load(open(path))
    out = []
    for f in geo.get("features", []):
        p = f.get("properties") or {}
        c = (f.get("geometry") or {}).get("coordinates") or []
        sid = str(f.get("id") or p.get("sid") or "")
        if len(c) < 2 or not re.fullmatch(r"[A-Z0-9]{3,4}", sid):
            continue
        if p.get("online") is False or p.get("archive_end") or not str(p.get("network", "")).endswith("_ASOS"):
            continue
        lon, lat = float(c[0]), float(c[1])
        if 17 < lat < 72 and -180 < lon < -60:
            out.append((sid, lat, lon))
    return out


def run_start(data_date, data_time):
    """GRIB dataDate (20261017) and dataTime (1200, or 12 meaning 12:00) → aware UTC"""
    d = str(int(data_date))
    t = int(data_time)
    hh, mm = (t // 100, t % 100) if t >= 100 else (t, 0)
    return datetime(int(d[:4]), int(d[4:6]), int(d[6:8]), hh, mm, tzinfo=timezone.utc)


def bilinear(grid, lats, lons, lat, lon):
    """grid[lat_i, lon_j] on regular ascending-or-descending latitudes and 0..360 longitudes"""
    lon = lon % 360
    dlat = lats[1] - lats[0]
    dlon = lons[1] - lons[0]
    fi = (lat - lats[0]) / dlat
    fj = (lon - lons[0]) / dlon
    i0 = int(math.floor(fi))
    j0 = int(math.floor(fj))
    di, dj = fi - i0, fj - j0
    n = len(lons)
    i1 = min(i0 + 1, len(lats) - 1)
    j1 = (j0 + 1) % n
    j0 %= n
    return ((1 - di) * (1 - dj) * grid[i0, j0] + (1 - di) * dj * grid[i0, j1]
            + di * (1 - dj) * grid[i1, j0] + di * dj * grid[i1, j1])


def main(grib, geo, store):
    import earthkit.data as ekd  # only on the runner, beside ai-models
    sts = stations(geo)
    fields = ekd.from_source("file", grib)
    by = {}
    init = None
    lats = lons = None
    for f in fields:
        name = f.metadata("shortName")
        if name not in ("2t", "10u", "10v"):
            continue
        # plain GRIB keys, which every eccodes knows (base_datetime is not one)
        start = run_start(f.metadata("dataDate"), f.metadata("dataTime"))
        valid = start + timedelta(hours=int(f.metadata("endStep")))
        if init is None:
            init = start
        if lats is None:
            ll = f.to_latlon(flatten=False)
            lats = ll["lat"][:, 0]
            lons = ll["lon"][0, :]
        by.setdefault(int(valid.timestamp()), {})[name] = f.to_numpy(flatten=False)
    times = sorted(t for t, v in by.items() if {"2t", "10u", "10v"} <= set(v) and t > init.timestamp())
    if not times:
        sys.exit("no forecast steps with 2t, 10u and 10v in " + grib)
    out = {}
    for sid, lat, lon in sts:
        t, w = [], []
        for tm in times:
            v = by[tm]
            t.append(round(float(bilinear(v["2t"], lats, lons, lat, lon)) - 273.15, 1))
            u = float(bilinear(v["10u"], lats, lons, lat, lon))
            vv = float(bilinear(v["10v"], lats, lons, lat, lon))
            w.append(round(math.hypot(u, vv) * 3.6, 1))
        out[sid] = {"t": t, "w": w}
    os.makedirs(store, exist_ok=True)
    stamp = init.strftime("%Y-%m-%dT%H:%M:%SZ")
    doc = {"model": "pangu", "init": stamp, "times": times, "stations": out}
    path = os.path.join(store, init.strftime("%Y%m%d%H") + ".json")
    with open(path, "w") as fh:
        json.dump(doc, fh, separators=(",", ":"))
    runs = sorted(x for x in os.listdir(store) if x.endswith(".json"))
    for old in runs[:-KEEP]:
        os.remove(os.path.join(store, old))
    print(f"pangu {stamp}: {len(out)} stations, {len(times)} steps to "
          f"{datetime.fromtimestamp(times[-1], timezone.utc):%Y-%m-%d %HZ} -> {path}")
    sample = np.array([out[s]["t"][0] for s in list(out)[:500]])
    print(f"first step, 500 stations: temperature {sample.min():.1f} .. {sample.max():.1f} C, median {np.median(sample):.1f}")


def selftest():
    """the arithmetic, without a model run: python3 extract.py --selftest"""
    lats = np.arange(90, -90.25, -0.25)
    lons = np.arange(0, 360, 0.25)
    LON, LAT = np.meshgrid(lons, lats)
    grid = 2 * LAT + 0.5 * LON                  # a plane: bilinear must be exact
    for lat, lon in [(35.31, -97.51), (61.17, -150.0), (0.1, 359.9 - 360)]:
        want = 2 * lat + 0.5 * (lon % 360)
        got = bilinear(grid, lats, lons, lat, lon)
        if lon % 360 > 359.75:                  # across the date line the plane wraps; skip exactness there
            continue
        assert abs(got - want) < 1e-9, (lat, lon, got, want)
    geo = {"features": [
        {"id": "OKC", "properties": {"network": "OK_ASOS", "online": True}, "geometry": {"coordinates": [-97.6, 35.39]}},
        {"id": "OLD", "properties": {"network": "OK_ASOS", "online": False}, "geometry": {"coordinates": [-97, 35]}},
        {"id": "bad!", "properties": {"network": "OK_ASOS"}, "geometry": {"coordinates": [-97, 35]}},
        {"id": "EGLL", "properties": {"network": "GB__ASOS"}, "geometry": {"coordinates": [-0.4, 51.5]}}]}
    import tempfile
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
        json.dump(geo, fh)
    got = [s[0] for s in stations(fh.name)]
    os.remove(fh.name)
    assert got == ["OKC"], got
    assert run_start(20261017, 1200) == datetime(2026, 10, 17, 12, tzinfo=timezone.utc)
    assert run_start("20261017", 0) == datetime(2026, 10, 17, 0, tzinfo=timezone.utc)
    print("extract.py: bilinear exact on a plane; station filter matches score.mjs; run times read")


if __name__ == "__main__":
    if sys.argv[1:] == ["--selftest"]:
        selftest()
    else:
        main(*sys.argv[1:4])
