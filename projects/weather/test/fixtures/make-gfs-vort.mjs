/* The vorticity fixture for test/decoders.test.mjs (2026-10-24): GFS's own
   500 mb wind (UGRD, VGRD) and absolute vorticity (ABSV) from one 1° file,
   cut from NOAA's bucket by the .idx byte ranges, so absVorticity in
   modelmaps.js can be held to the vorticity the GFS itself publishes.
       NODE_USE_ENV_PROXY=1 node make-gfs-vort.mjs */
import { writeFileSync } from 'node:fs';
const url = 'https://noaa-gfs-bdp-pds.s3.amazonaws.com/gfs.20261024/00/atmos/gfs.t00z.pgrb2.1p00.f024';
const idx = (await (await fetch(url + '.idx')).text()).trim().split('\n').map((l) => l.split(':'));
const parts = [];
for (const name of ['UGRD', 'VGRD', 'ABSV']) {
  const k = idx.findIndex((x) => x[3] === name && x[4] === '500 mb');
  const start = +idx[k][1], end = +idx[k + 1][1] - 1;
  parts.push(new Uint8Array(await (await fetch(url, { headers: { Range: `bytes=${start}-${end}` } })).arrayBuffer()));
}
const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
writeFileSync(new URL('./gfs1-500-uv-absv.grb2', import.meta.url), out);
console.log(out.length, 'bytes');
