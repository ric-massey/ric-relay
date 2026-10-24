"""The old-format HDF5 fixture for test/decoders.test.mjs (2026-10-24).

ERA5's files before about 2023 are HDF5 with a version 0 superblock and
symbol-table groups, which glm.js learned to read for the reanalysis.
This writes a small file the same way (h5py, libver='earliest'): a 4-D
time x level x lat x lon dataset chunked one hour and all levels at a time,
deflated and shuffled as netCDF writes them, and a 3-D one in 27-hour-like
blocks. Every value is a formula of its indices, so the test needs no
expected file:  v = t*1000 + l*100 + y*10 + x  (and t*100 + y*10 + x).

    pip install h5py && python3 make-hdf5-v0.py
"""
import h5py, numpy as np
with h5py.File('hdf5-v0.h5', 'w', libver='earliest') as f:
    t, l, y, x = np.meshgrid(np.arange(3), np.arange(2), np.arange(10), np.arange(12), indexing='ij')
    d = f.create_dataset('Z', data=(t * 1000 + l * 100 + y * 10 + x).astype('f4'), chunks=(1, 2, 10, 12), compression='gzip', shuffle=True)
    d.attrs['units'] = np.bytes_('m**2 s**-2')       # fixed-length, as netCDF writes a text attribute
    t3, y3, x3 = np.meshgrid(np.arange(5), np.arange(8), np.arange(9), indexing='ij')
    f.create_dataset('T', data=(t3 * 100 + y3 * 10 + x3).astype('f4'), chunks=(3, 4, 5), compression='gzip', shuffle=True)
    f.create_dataset('latitude', data=np.linspace(90, 87.75, 10).astype('f8'))
print(open('hdf5-v0.h5', 'rb').read(9)[8], 'superblock version')
