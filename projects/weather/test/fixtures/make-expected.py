"""Writes expected.json beside the fixtures: what MetPy (NEXRAD Level III),
ecCodes (GRIB2), h5py (the GLM's and the ABI's HDF5), MetPy again (NEXRAD Level II)
and pyproj (the ABI's fixed grid)
read from the same files.
Not run in CI — run it by hand after adding a fixture:
    pip install metpy eccodes h5py && python3 make-expected.py
test/decoders.test.mjs holds bzip2.js, nexrad.js, grib2.js and glm.js to it."""
import glob, json, os, warnings
import numpy as np
warnings.filterwarnings('ignore')
here = os.path.dirname(os.path.abspath(__file__))
out = {'l3': {}, 'grib2': {}, 'glm': {}, 'l2': {}, 'mrms': {}, 'abi': {}, 'rap': {}}
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

# Level II: the volume's first chunk and one cut's chunks, joined in order
# into the Archive II file they are pieces of
from metpy.io import Level2File
import tempfile
parts = sorted(glob.glob(os.path.join(here, 'l2-*')))
if parts:
    with tempfile.NamedTemporaryFile(suffix='.ar2', delete=False) as tmp:
        for part in parts: tmp.write(open(part, 'rb').read())
    f = Level2File(tmp.name)
    sweeps = {}
    for sw in f.sweeps:
        if not sw: continue                       # the cuts this fixture leaves out
        el_num = sw[0][0].el_num
        moms = {}
        for mom in [b'REF', b'VEL', b'SW ', b'ZDR', b'RHO', b'PHI']:
            if mom not in sw[0][4]: continue
            rows = sorted(((r[0].az_angle, r[4][mom][1]) for r in sw), key=lambda x: x[0])
            a = np.array([x[1] for x in rows], dtype=float)
            h = sw[0][4][mom][0]
            pick = [(int(i), int(j)) for i, j in zip(rng.integers(0, a.shape[0], 300), rng.integers(0, a.shape[1], 300))]
            moms[mom.decode().strip()] = {'shape': list(a.shape), 'first': float(h.first_gate), 'spacing': float(h.gate_width),
                'finite': int(np.isfinite(a).sum()), 'samples': [[i, j, None if not np.isfinite(a[i, j]) else float(a[i, j])] for i, j in pick]}
        sweeps[str(el_num)] = {'el': float(np.mean([r[0].el_angle for r in sw])), 'nrad': len(sw), 'moments': moms}
    out['l2'] = {'files': [os.path.basename(x) for x in parts], 'site': f.stid.decode(), 'sweeps': sweeps}
    os.unlink(tmp.name)

# MRMS: gzipped GRIB2 with PNG packing, read whole by ecCodes, then
# max-pooled the way grib2.js's parseAsync pools it
import gzip
for path in sorted(glob.glob(os.path.join(here, 'mrms-*.grib2.gz'))):
    raw = gzip.decompress(open(path, 'rb').read())
    h = eccodes.codes_new_from_message(raw)
    nx, ny = eccodes.codes_get(h, 'Ni'), eccodes.codes_get(h, 'Nj')
    pool = 4 if nx >= 14000 else 2
    v = np.asarray(eccodes.codes_get_values(h), dtype=float).reshape(ny, nx)
    eccodes.codes_release(h)
    pv = v.reshape(ny // pool, pool, nx // pool, pool).max(axis=(1, 3))
    pv[pv <= -99] = np.nan
    picks = [(int(i), int(j)) for i, j in zip(rng.integers(0, ny // pool, 300), rng.integers(0, nx // pool, 300))]
    hot = np.argwhere(np.nan_to_num(pv, nan=-1) > 0)
    picks += [tuple(int(x) for x in hot[i]) for i in rng.integers(0, len(hot), 200)] if len(hot) else []
    out['mrms'][os.path.basename(path)] = {'pool': pool, 'nx': nx // pool, 'ny': ny // pool, 'finite': int(np.isfinite(pv).sum()), 'max': float(np.nanmax(pv)),
        'samples': [[i, j, None if not np.isfinite(pv[i, j]) else float(pv[i, j])] for i, j in picks]}

# GOES ABI: one band of a mesoscale sector (2-D, chunked in row bands) as
# h5py reads it, and where its pixels are by pyproj's geostationary projection
out['abi'] = {}
import pyproj
for path in sorted(glob.glob(os.path.join(here, 'abi-*.nc'))):
    f = h5py.File(path, 'r')
    d = f['CMI']; a = d.attrs
    raw = d[()].astype(np.int64)
    if a.get('_Unsigned', b'') == b'true': raw = raw % 65536
    fv = int(a['_FillValue'][0]); fv = fv + 65536 if a.get('_Unsigned', b'') == b'true' and fv < 0 else fv
    v = raw.astype(float) * float(a['scale_factor'][0]) + float(a['add_offset'][0]); v[raw == fv] = np.nan
    ax = lambda k: f[k][()].astype(float) * float(f[k].attrs['scale_factor'][0]) + float(f[k].attrs['add_offset'][0])
    xs, ys = ax('x'), ax('y')
    P = {k: (float(x[0]) if hasattr(x, '__len__') and not isinstance(x, bytes) else x) for k, x in f['goes_imager_projection'].attrs.items() if k in ('perspective_point_height', 'semi_major_axis', 'semi_minor_axis', 'longitude_of_projection_origin')}
    H = P['perspective_point_height']
    proj = pyproj.Proj(proj='geos', h=H, lon_0=P['longitude_of_projection_origin'], sweep='x', a=P['semi_major_axis'], b=P['semi_minor_axis'])
    picks = [(int(i), int(j)) for i, j in zip(rng.integers(0, v.shape[0], 400), rng.integers(0, v.shape[1], 400))]
    nav = [(int(j), int(i)) for j, i in zip(rng.integers(0, v.shape[0], 60), rng.integers(0, v.shape[1], 60))]
    out['abi'][os.path.basename(path)] = {'shape': list(v.shape), 'finite': int(np.isfinite(v).sum()), 'min': float(np.nanmin(v)), 'max': float(np.nanmax(v)),
        'x': [float(xs[0]), float(xs[-1])], 'y': [float(ys[0]), float(ys[-1])], 'proj': P,
        'samples': [[i, j, None if not np.isfinite(v[i, j]) else float(v[i, j])] for i, j in picks],
        'nav': [[j, i] + [float(z) for z in proj(xs[i] * H, ys[j] * H, inverse=True)[::-1]] for j, i in nav]}

# The RAP's native rotated grid (template 3.32769): its values as ecCodes
# reads them, and — since ecCodes cannot place that grid — the same field
# from the same run on the RAP's own Lambert grid (awp130, JPEG 2000, which
# ecCodes places), at points across it, for grib2.js's projector to be
# checked against by interpolation.
out['rap'] = {}
for path in sorted(glob.glob(os.path.join(here, 'rap-*.rap'))):
    h = eccodes.codes_new_from_message(open(path, 'rb').read())
    v = np.asarray(eccodes.codes_get_values(h), dtype=float)
    idx = sorted(set(int(i) for i in rng.integers(0, len(v), 400)))
    lam = eccodes.codes_new_from_message(open(path.replace('rap-wrfprs', 'rap-awp130').replace('.rap', '.jp2grb'), 'rb').read())
    lv = np.asarray(eccodes.codes_get_values(lam), dtype=float)
    la = eccodes.codes_get_array(lam, 'latitudes'); lo = eccodes.codes_get_array(lam, 'longitudes')
    pts = [int(i) for i in rng.integers(0, len(lv), 300)]
    out['rap'][os.path.basename(path)] = {'npts': len(v), 'min': float(v.min()), 'max': float(v.max()),
        'samples': [[i, float(v[i])] for i in idx],
        'lambert': [[float(la[i]), float(lo[i]) if lo[i] <= 180 else float(lo[i]) - 360, float(lv[i])] for i in pts]}

json.dump(out, open(os.path.join(here, 'expected.json'), 'w'), separators=(',', ':'))
print({k: len(v) for k, v in out.items()})
