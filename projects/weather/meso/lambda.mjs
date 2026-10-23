/* The mesoanalysis builder as an AWS Lambda function — the faster way to run it
   ────────────────────────────────────────────────────────────────────────────
   GitHub Actions (.github/workflows/meso.yml) runs it for free, but a
   scheduled job there can start 5–20 minutes late. Lambda, woken every few
   minutes (or by NOAA's own notice that a new RTMA file is in its bucket),
   builds the hour within a couple of minutes of the inputs landing, next to
   NOAA's data in us-east-1. It is the same code: build.mjs's run(), which
   asks the Worker first and does nothing when the hour is already there.
   Setting it up is in meso/README.md. Ric, 2026-10-22. */
import { run, WORKER } from './build.mjs';

export const handler = async () => {
  const lines = [];
  const res = await run({ put: process.env.MESO_WORKER || WORKER, check: true, log: (m) => { lines.push(m); console.log('[meso] ' + m); } });
  return { ...res, log: lines };
};
