"""Writes expected.json beside the fixtures: what MetPy (NEXRAD Level III),
ecCodes (GRIB2) and h5py (the GLM's HDF5) read from the same files.
Not run in CI — run it by hand after adding a fixture:
    pip install metpy eccodes h5py && python3 make-expected.py
test/decoders.test.mjs holds bzip2.js, nexrad.js, grib2.js and glm.js to it."""
import glob, json, os, warnings
import numpy as np
warnings.filterwarnings('ignore')
here = os.path.dirname(os.path.abspath(__file__))
out = {'l3': {}, 'grib2': {}, 'glm': {}}
rng = np.random.default_rng(7)

from metpy.io import Level3File
for path in sorted(glob.glob(os.path.join(here, 'l3-*'))):
    l = Level3File(path); p = l.sym_block[0][0]
    data = np.array([list(r) for r in p['data']], dtype=int)
    v = l.map_data(data)
    if isinstance(v, tuple): v = v[0]
    v = np.asarray(v, dtype=float)
    picks = [(int(r), int(b)) for r, b in zip(rng.integers(0, v.shape[0], 400), rng.integers(0, v.shape[1], 400))]
    nz = np.argwhere(np.isfinite(v))
    picks += [tuple(int(x) for x in nz[i]) for i in rng.integers(0, len(nz), 200)] if len(nz) else []
    out['l3'][os.path.basename(path)] = {
        'code': l.header.code, 'site': l.siteID, 'lat': l.lat, 'lon': l.lon, 'el': round(float(l.metadata.get('el_angle', 0)), 1),
        'vol': l.metadata['vol_time'].isoformat() + 'Z', 'nRad': int(v.shape[0]), 'nBins': int(v.shape[1]),
        'finite': int(np.isfinite(v).sum()), 'sum': float(np.nansum(v)), 'az0': [round(float(a), 1) for a in p['start_az'][:5]],
        'samples': [[r, b, None if not np.isfinite(v[r, b]) else float(v[r, b])] for r, b in picks]}

import eccodes
for path in sorted(glob.glob(os.path.join(here, '*.grb2'))):
    with open(path, 'rb') as fh:
        h = eccodes.codes_grib_new_from_file(fh)
        v = np.asarray(eccodes.codes_get_values(h), dtype=float); miss = eccodes.codes_get(h, 'missingValue')
        v[v == miss] = np.nan
        lat = eccodes.codes_get_array(h, 'latitudes'); lon = eccodes.codes_get_array(h, 'longitudes')
        nx = eccodes.codes_get(h, 'Nx') if eccodes.codes_is_defined(h, 'Nx') else eccodes.codes_get(h, 'Ni')
        idx = sorted(set(int(i) for i in rng.integers(0, len(v), 400)) | set(int(i) for i in np.flatnonzero(np.isfinite(v) & (v != 0))[:: max(1, int(np.isfinite(v).sum() // 200))][:200]))
        out['grib2'][os.path.basename(path)] = {
            'npts': len(v), 'nx': int(nx), 'finite': int(np.isfinite(v).sum()), 'min': float(np.nanmin(v)), 'max': float(np.nanmax(v)), 'mean': float(np.nanmean(v)),
            'refTime': f"{eccodes.codes_get(h, 'dataDate')}{eccodes.codes_get(h, 'dataTime'):04d}", 'step': int(eccodes.codes_get(h, 'step')),
            'samples': [[i, None if not np.isfinite(v[i]) else float(v[i]), float(lat[i]), float(lon[i])] for i in idx]}
        eccodes.codes_release(h)

import h5py
for path in sorted(glob.glob(os.path.join(here, 'glm-*.nc'))):
    f = h5py.File(path, 'r')
    def scaled(k):
        d = f[k]; a = d.attrs; raw = d[()].astype(np.int64) if d.dtype.kind in 'iu' else d[()].astype(float)
        if a.get('_Unsigned', b'') == b'true': raw = raw % (2 ** (8 * d.dtype.itemsize))
        x = raw.astype(float)
        if '_FillValue' in a:
            fv = int(a['_FillValue'][0])
            if a.get('_Unsigned', b'') == b'true' and fv < 0: fv += 2 ** (8 * d.dtype.itemsize)
            x[raw == fv] = np.nan
        return x * (float(a['scale_factor'][0]) if 'scale_factor' in a else 1) + (float(a['add_offset'][0]) if 'add_offset' in a else 0)
    vs = {k: scaled(k) for k in ['flash_lat', 'flash_lon', 'flash_time_offset_of_first_event', 'flash_energy', 'flash_quality_flag']}
    out['glm'][os.path.basename(path)] = {'count': len(vs['flash_lat']),
        'vars': {k: [None if not np.isfinite(x) else float(x) for x in v] for k, v in vs.items()}}

json.dump(out, open(os.path.join(here, 'expected.json'), 'w'), separators=(',', ':'))
print({k: len(v) for k, v in out.items()})
