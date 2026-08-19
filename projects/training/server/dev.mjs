/* TRAINING — local stand-in for the log service
   ────────────────────────────────────────────────────────────────────────────
   Serves the site AND the log API from one origin, so training.html can be
   exercised end to end without deploying anything or holding a real token.

       node projects/training/server/dev.mjs
       open http://localhost:8799/training.html?key=local-dev-token

   The token below is a fixture, not a secret — it only ever unlocks this
   in-memory server, which forgets everything when you stop it. The real one
   lives in Cloudflare and is never in this repo.

   The Durable Object class is imported from worker.mjs rather than reimplemented,
   so what you exercise here is the same code that gets deployed. Only the
   storage is swapped, for a Map. */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import worker, { TrainingLog } from './worker.mjs';
import { memoryBucket } from './r2-memory.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PORT = 8799;
const TOKEN = 'local-dev-token';

const mem = new Map();
const log = new TrainingLog({
  storage: {
    get: async k => mem.get(k),
    put: async (k, v) => { mem.set(k, v); },
    delete: async k => { mem.delete(k); },
    list: async ({ prefix }) => new Map([...mem].filter(([k]) => k.startsWith(prefix)))
  }
}, {
  LOG_TOKEN: TOKEN,
  /* Point the matcher at the plan on disk, so a fake webhook here ticks against
     the same file the page is rendering rather than the deployed one. */
  PLAN_URL: 'http://localhost:' + PORT + '/assets/training-plan.json',

  /* ── a Strava that is not Strava ──
     Real credentials would mean a real athlete and a real run, which is no way
     to rehearse a run card. So the API is faked here and ONLY here: post a
     webhook at the dev server and it behaves exactly as the deployed Worker
     does, against an invented activity.

         curl -s -X POST localhost:8799/strava -H 'content-type: application/json' \
           -d '{"aspect_type":"create","object_type":"activity","object_id":1,"owner_id":7}'

     ?date=YYYY-MM-DD on that URL puts the run on a chosen day, which is how you
     see it land on a day the plan has a run scheduled. */
  STRAVA_CLIENT_ID: 'dev', STRAVA_CLIENT_SECRET: 'dev', STRAVA_REFRESH_TOKEN: 'dev',
  STRAVA_ATHLETE_ID: '7',
  FETCH: async (u, init) => {
    const url = String(u);
    if (url.includes('/oauth/token')) {
      return Response.json({ access_token: 'dev', refresh_token: 'dev', expires_at: 1e12 });
    }
    if (url.includes('/api/v3/activities/')) {
      return Response.json({
        id: Number(url.split('/').pop()) || 1,
        name: FAKE_SPORT === 'Ride' ? 'Evening Spin' : 'Morning Run',
        sport_type: FAKE_SPORT, type: FAKE_SPORT,
        /* 6.01 mi against a 7 mi plan — the mismatch is the point: the row's
           title has to follow the run, not the schedule. */
        distance: 9673.1, moving_time: 3120, elapsed_time: 3200, total_elevation_gain: 88,
        start_date_local: (FAKE_RUN_DATE || new Date().toISOString().slice(0, 10)) + 'T06:12:00Z',
        athlete: { id: 7 },
        ...(FAKE_RUN_PRIVATE ? { visibility: 'only_me' } : {}),
        average_speed: 3.61, max_speed: 4.9,
        average_heartrate: 152.4, max_heartrate: 176, has_heartrate: true,
        average_cadence: 84.2, calories: 812, suffer_score: 121, average_temp: 21,
        device_name: 'Garmin Forerunner 265', kudos_count: 4, pr_count: 1,
        /* Eleven kilometres of them, with a slow first and a fast last, so the
           split bars on the page have a shape to draw rather than a flat wall. */
        splits_metric: Array.from({ length: 11 }, (_, i) => ({
          split: i + 1, distance: 1000,
          moving_time: 300 - i * 3, elapsed_time: 302 - i * 3,
          elevation_difference: [4, 6, -2, 1, -5, 3, 8, -6, 0, -3, -2][i],
          average_speed: 1000 / (300 - i * 3),
          average_heartrate: 138 + i * 3,
          pace_zone: 2,
          location_city: 'Knoxville'      // present so the local page proves it never arrives
        })),
        /* Present precisely so the local page proves they never arrive. */
        start_latlng: [35.9606, -83.9207], location_city: 'Knoxville',
        /* A real encoded polyline — a loop around Knoxville — so the page has
           a route to draw. The city and the raw coordinates beside it are still
           here precisely so the local page proves they never arrive. */
        map: { summary_polyline: 'ojqzErfhcNaBqAeAsAg@_BQqBFuBl@sB|@iBpAuAjBcA`CU~BJnB^|AlAvAvArAnAbBt@nB^~BB~BW~Bo@rBeAdB{AzAgBjAmBv@_C^kCJ' }
      });
    }
    return fetch(u, init);
  }
});

let FAKE_RUN_DATE = '';
let FAKE_RUN_PRIVATE = false;
let FAKE_SPORT = 'Run';

/* Requests go through the real outer Worker, not straight to the object, so the
   route whitelist and the Strava handshake are exercised here too. The binding
   is the only fake: one object, always the same one. */
const ENV = {
  LOG: { idFromName: () => 'training', get: () => log },
  STRAVA_VERIFY_TOKEN: 'local-verify-token',
  /* A bucket that is a Map. Upload a real clip at
     http://localhost:8799/projects/climbing/index.html?key=local-dev-token and
     it plays, from memory, and is gone when you stop the server — which is the
     right amount of permanence for a rehearsal. Drop this line to rehearse the
     other case: a deploy with no bucket, where /media answers "nothing here"
     and every page has to render anyway. */
  MEDIA: memoryBucket()
};

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg'
};

createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);

  /* DEV_OFFLINE=1 serves the site but kills the API, which is the only way to
     rehearse the case that actually matters on a phone: the page loads fine and
     the log is unreachable. A total blackout is untestable through a browser —
     the HTML would not arrive either — so this is the realistic half. */
  if (process.env.DEV_OFFLINE && /^\/(log|climb|auth|strava|board|media)(?=$|[/?])/.test(u.pathname)) {
    res.socket.destroy();               // hang up, exactly like no signal
    return;
  }

  /* Every route the Worker owns. Keep this in step with worker.mjs — a path
     missing here falls through to the static handler and 404s, which looks
     exactly like a Worker bug and is not one.

     `(?=$|[/?])` and not `\b`: a word boundary also matches at the DOT in
     `/log.html`, so the log room got routed into the Worker and answered
     `{"error":"not found"}` — the one room on the site you could not open on
     the dev server. `/climbing.html` escaped only by luck, because `climb` is
     followed by a letter there. The lookahead ends the match at a real path
     separator instead. */
  if (/^\/(log|climb|auth|strava|board|media)(?=$|[/?])/.test(u.pathname)) {
    /* Which day the invented run lands on. Dev scaffolding for the fake Strava
       above; the deployed Worker has no such thing — a real run brings its own
       date and there is nothing to choose. */
    if (u.searchParams.has('date')) FAKE_RUN_DATE = u.searchParams.get('date');
    /* ?private=1 marks the invented run "Only You", which is the only way to
       rehearse the half of the page that only its owner ever sees. */
    if (u.searchParams.has('private')) FAKE_RUN_PRIVATE = u.searchParams.get('private') !== '0';
    /* ?sport=Ride invents something that is not a run, which is the only way to
       rehearse an activity the plan has no session for. */
    if (u.searchParams.has('sport')) FAKE_SPORT = u.searchParams.get('sport') || 'Run';
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const r = await worker.fetch(new Request('https://local' + u.pathname + u.search, {
      method: req.method,
      headers: req.headers,
      ...(chunks.length ? { body: Buffer.concat(chunks) } : {})
    }), ENV, null);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }

  const p = u.pathname === '/' ? '/index.html' : u.pathname;
  try {
    const buf = await readFile(join(ROOT, p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
}).listen(PORT, () => {
  console.log(`site + log api  →  http://localhost:${PORT}/training.html`);
  console.log(`owner mode      →  http://localhost:${PORT}/training.html?key=${TOKEN}`);
});
