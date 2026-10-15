/* VISITORS — the site's own page-view counter
   ────────────────────────────────────────────────────────────────────────────
   Every page loads assets/visit.js, which sends one small beacon per page view
   to POST /hit, and a heartbeat once a minute while the tab is open. This file
   turns those into rows in D1, and answers GET /stats — the numbers behind
   ricmassey.com/visitors/ — for Ric only.

   ── what is kept, and what is not ──
   A row is: when, which page, a random visitor id the browser made up, a
   random session id, the referring SITE (hostname only — never the full URL,
   which can carry a search term or someone's email in its query string), the
   country Cloudflare already worked out, and a browser / OS / device class
   parsed from the user agent here and then thrown away.

   NOT kept: the IP address, the raw user agent, the query string of the page,
   screen size, language, or anything else a fingerprint is made of. The
   visitor id is a coin toss stored in that browser's localStorage; clear it and
   the same person is a new visitor, which is the right way round for a page
   that only wants to know roughly how many people came.

   ── why D1, and why it may be absent ──
   The training log lives in a Durable Object because it is one person writing
   a handful of times a day. This is every visitor writing on every page, and
   the questions asked of it are GROUP BYs over months — which is what D1 is.
   The binding is `STATS`. With no binding the Worker still runs: /hit answers
   204 and records nothing, /stats says `configured: false`. So this deploys
   safely before the database exists, the same way /media shipped before R2.

   ── who can read it ──
   Only the owner. The handler is passed `isOwner`, which the outer Worker gets
   by asking the Durable Object's /auth — the throttled one — so this endpoint
   is not a second, unthrottled way to guess the site password. */

const VIEW_WINDOW = 5 * 60 * 1000;          // "online" = seen in the last five minutes
const DAY_MS = 86400000;
const HOUR_MS = 3600000;

/* Where a beacon may come from. Anybody can forge one with curl, and that is
   fine — it is a visitor counter, not a ledger. This only stops a copy of the
   site hosted somewhere else from pouring its traffic into Ric's numbers. */
const ORIGINS = /^(https:\/\/(www\.)?ricmassey\.com|https:\/\/ric-massey\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

const ID = /^[a-z0-9-]{8,40}$/;
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|curl|wget|python|go-http|java\/|monitor|uptime|phantom/i;

/* One promise per isolate. CREATE ... IF NOT EXISTS is cheap, and doing it here
   means there is no migration step to forget: create the database, bind it,
   deploy, and the first beacon makes the tables. */
const ready = new WeakMap();
function ensure(db) {
  if (!ready.has(db)) {
    ready.set(db, db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS views (
        id INTEGER PRIMARY KEY,
        ts INTEGER NOT NULL,
        visitor TEXT NOT NULL,
        session TEXT NOT NULL,
        first INTEGER NOT NULL DEFAULT 0,
        path TEXT NOT NULL,
        ref TEXT NOT NULL DEFAULT '',
        country TEXT NOT NULL DEFAULT '',
        browser TEXT NOT NULL DEFAULT '',
        os TEXT NOT NULL DEFAULT '',
        device TEXT NOT NULL DEFAULT ''
      )`),
      db.prepare('CREATE INDEX IF NOT EXISTS views_ts ON views (ts)'),
      db.prepare('CREATE INDEX IF NOT EXISTS views_visitor ON views (visitor, ts)'),
      /* One row per visitor: where they are now. Overwritten by every view and
         heartbeat, pruned of anyone gone an hour. */
      db.prepare(`CREATE TABLE IF NOT EXISTS live (
        visitor TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        ts INTEGER NOT NULL
      )`),
      /* Devices Ric has told to stop counting — his own phone and laptop. The
         device also stops sending (visit.js checks a local flag), but listing
         the id here takes its PAST visits out of every number too. */
      db.prepare(`CREATE TABLE IF NOT EXISTS ignored (
        visitor TEXT PRIMARY KEY,
        ts INTEGER NOT NULL
      )`)
    ]).catch(e => { ready.delete(db); throw e; }));
  }
  return ready.get(db);
}

/* ── the user agent, reduced to three words and dropped ── */
export function describeAgent(ua) {
  ua = String(ua || '');
  const device = /iPad|Tablet|PlayBook|Silk|Android(?!.*Mobi)/i.test(ua) ? 'tablet'
    : /Mobi|iPhone|iPod|Android/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /Edg(e|A|iOS)?\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox|FxiOS/.test(ua) ? 'Firefox'
    : /CriOS|Chrome|Chromium/.test(ua) ? 'Chrome'
    : /Safari/.test(ua) ? 'Safari' : 'Other';
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /CrOS/.test(ua) ? 'ChromeOS'
    : /Linux/.test(ua) ? 'Linux' : 'Other';
  return { device, browser, os };
}

/* A page is its path and nothing else. `index.html` and a trailing slash are
   the same page as the folder, and the query string is dropped — `?seed=`
   on a game or `?key=` on a sign-in link has no business in a page count. */
export function cleanPath(p) {
  p = String(p || '').split(/[?#]/)[0].slice(0, 200);
  if (!p.startsWith('/')) return null;
  try { p = decodeURI(p); } catch {}
  p = p.replace(/\/index\.html$/, '/').replace(/\/{2,}/g, '/');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

/* Hostname only, lowercased, `www.` off. Anything that does not parse as a
   hostname is dropped rather than stored as free text. */
export function cleanRef(r) {
  r = String(r || '').trim().toLowerCase().slice(0, 120);
  if (!r) return '';
  try { if (r.includes('/')) r = new URL(r).hostname; } catch { return ''; }
  r = r.replace(/^www\./, '');
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(r) || r === 'localhost' ? r : '';
}

const quiet = (origin) => new Response(null, {
  status: 204,
  headers: { 'access-control-allow-origin': origin || '*' }
});

/* ── POST /hit ── public, unauthenticated, and answers 204 whatever happens:
   a page view must never wait on, or be told about, its own counting. */
export async function handleHit(request, env, ctx) {
  const origin = request.headers.get('origin') || '';
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'access-control-allow-origin': origin || '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400'
    } });
  }
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  if (!env.STATS || !ORIGINS.test(origin)) return quiet(origin);

  const ua = request.headers.get('user-agent') || '';
  if (!ua || BOT.test(ua)) return quiet(origin);

  /* sendBeacon posts text/plain so it never needs a preflight, which means the
     body arrives as a string. Small, or it is not ours. */
  let body;
  try {
    const text = await request.text();
    if (text.length > 1024) return quiet(origin);
    body = JSON.parse(text);
  } catch { return quiet(origin); }

  const visitor = String(body.v || ''), session = String(body.s || '');
  const path = cleanPath(body.p);
  const kind = body.k === 'ping' ? 'ping' : 'view';
  if (!ID.test(visitor) || !ID.test(session) || !path) return quiet(origin);

  const ts = Date.now();
  const work = (async () => {
    await ensure(env.STATS);
    const db = env.STATS;
    const steps = [
      db.prepare(`INSERT INTO live (visitor, path, ts) VALUES (?, ?, ?)
                  ON CONFLICT(visitor) DO UPDATE SET path = excluded.path, ts = excluded.ts`)
        .bind(visitor, path, ts)
    ];
    if (kind === 'view') {
      const { device, browser, os } = describeAgent(ua);
      const country = String((request.cf && request.cf.country) || '').slice(0, 2).toUpperCase();
      steps.push(
        db.prepare(`INSERT INTO views (ts, visitor, session, first, path, ref, country, browser, os, device)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(ts, visitor, session, body.f ? 1 : 0, path, cleanRef(body.r),
                /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1' ? country : '',
                browser, os, device),
        db.prepare('DELETE FROM live WHERE ts < ?').bind(ts - HOUR_MS)
      );
    }
    await db.batch(steps);
  })().catch(e => console.error('visitors: hit not recorded —', e && e.message));

  if (ctx && ctx.waitUntil) ctx.waitUntil(work); else await work;
  return quiet(origin);
}

/* Start of the range, in UTC milliseconds, for a viewer `tz` minutes east of
   UTC. "Today" is Ric's today, not Greenwich's — a visit at 9pm Eastern is
   tonight, not tomorrow. */
export function rangeStart(range, now, tz) {
  const off = tz * 60000;
  const midnight = Math.floor((now + off) / DAY_MS) * DAY_MS - off;
  const back = { today: 0, '7d': 6, '30d': 29, '90d': 89 }[range];
  if (back === undefined) return 0;
  return midnight - back * DAY_MS;
}

const RANGES = new Set(['today', '7d', '30d', '90d', 'all']);
const NOT_ME = 'visitor NOT IN (SELECT visitor FROM ignored)';

/* ── /stats ── owner only. The page that reads it is ricmassey.com/visitors/;
   the API is not called that because dev.mjs serves both from one origin. */
export async function handleVisitors(request, env, parts, url, isOwner, json) {
  const origin = request.headers.get('origin');
  if (!(await isOwner())) return json({ error: 'nope' }, 401, origin);
  if (!env.STATS) return json({ configured: false }, 200, origin, { 'cache-control': 'no-store' });
  await ensure(env.STATS);
  const db = env.STATS;

  /* ---------- POST /stats/exclude — "ignore this device" ---------- */
  if (parts[1] === 'exclude') {
    if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);
    const body = await request.json().catch(() => ({}));
    const visitor = String(body.visitor || '');
    if (!ID.test(visitor)) return json({ error: 'visitor id required' }, 400, origin);
    if (body.on === false) await db.prepare('DELETE FROM ignored WHERE visitor = ?').bind(visitor).run();
    else await db.prepare('INSERT OR IGNORE INTO ignored (visitor, ts) VALUES (?, ?)').bind(visitor, Date.now()).run();
    return json({ ok: true, excluded: body.on !== false }, 200, origin);
  }

  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, origin);

  const q = url.searchParams;
  const range = RANGES.has(q.get('range')) ? q.get('range') : '30d';
  const tz = Math.max(-840, Math.min(840, parseInt(q.get('tz'), 10) || 0));
  const me = ID.test(q.get('me') || '') ? q.get('me') : '';
  const now = Date.now();
  const from = rangeStart(range, now, tz);
  const today = rangeStart('today', now, tz);
  /* Hours for today, days for everything else. The page folds days into weeks
     itself when all-time gets long. */
  const bucket = range === 'today' ? HOUR_MS : DAY_MS;
  const off = tz * 60000;

  const W = `ts >= ? AND ${NOT_ME}`;
  const counts = `COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors, COUNT(DISTINCT session) AS sessions`;
  const top = (col, measure, n = 12) => db.prepare(
    `SELECT ${col} AS k, ${measure} AS n FROM views WHERE ${W} GROUP BY ${col} ORDER BY n DESC LIMIT ${n}`).bind(from);

  const r = await db.batch([
    db.prepare(`SELECT ${counts} FROM views WHERE ${W}`).bind(from),                         // 0
    db.prepare(`SELECT ${counts} FROM views WHERE ${W}`).bind(today),                        // 1
    db.prepare(`SELECT CAST((ts + ?) / ? AS INTEGER) AS b, ${counts}
                FROM views WHERE ${W} GROUP BY b ORDER BY b`).bind(off, bucket, from),        // 2
    db.prepare(`SELECT path AS k, COUNT(*) AS n, COUNT(DISTINCT visitor) AS u
                FROM views WHERE ${W} GROUP BY path ORDER BY n DESC LIMIT 25`).bind(from),    // 3
    db.prepare(`SELECT ref AS k, COUNT(*) AS n FROM views
                WHERE ${W} AND first = 1 GROUP BY ref ORDER BY n DESC LIMIT 20`).bind(from),  // 4
    top('country', 'COUNT(DISTINCT visitor)', 20),                                            // 5
    top('browser', 'COUNT(DISTINCT visitor)'),                                                // 6
    top('device', 'COUNT(DISTINCT visitor)'),                                                 // 7
    top('os', 'COUNT(DISTINCT visitor)'),                                                     // 8
    db.prepare(`SELECT path AS k, COUNT(*) AS n FROM views
                WHERE ${W} AND first = 1 GROUP BY path ORDER BY n DESC LIMIT 10`).bind(from), // 9
    /* New = their first visit ever falls inside the range. */
    db.prepare(`SELECT COUNT(*) AS n FROM (SELECT MIN(ts) AS f FROM views
                WHERE ${NOT_ME} GROUP BY visitor) WHERE f >= ?`).bind(from),                  // 10
    db.prepare(`SELECT path AS k, COUNT(*) AS n FROM live
                WHERE ts >= ? AND ${NOT_ME} GROUP BY path ORDER BY n DESC`).bind(now - VIEW_WINDOW), // 11
    db.prepare(`SELECT ts, path, ref, country, first FROM views
                WHERE ${NOT_ME} ORDER BY ts DESC LIMIT 30`),                                  // 12
    db.prepare('SELECT MIN(ts) AS t FROM views'),                                             // 13
    db.prepare('SELECT COUNT(*) AS n FROM ignored WHERE visitor = ?').bind(me)               // 14
  ]);
  const rows = i => (r[i] && r[i].results) || [];
  const one = i => rows(i)[0] || {};
  const pairs = i => rows(i).map(x => [x.k, x.n]);
  const tot = x => ({ visitors: x.visitors || 0, sessions: x.sessions || 0, views: x.views || 0 });
  const live = pairs(11);

  return json({
    configured: true,
    range, tz, from, now, bucket,
    since: one(13).t || null,
    live: { count: live.reduce((a, [, n]) => a + n, 0), pages: live },
    today: tot(one(1)),
    total: { ...tot(one(0)), newVisitors: one(10).n || 0 },
    series: rows(2).map(x => [x.b, x.visitors, x.sessions, x.views]),
    pages: rows(3).map(x => [x.k, x.n, x.u]),
    entries: pairs(9),
    referrers: pairs(4),
    countries: pairs(5),
    browsers: pairs(6),
    devices: pairs(7),
    os: pairs(8),
    feed: rows(12).map(x => [x.ts, x.path, x.ref, x.country, x.first]),
    meExcluded: !!(one(14).n)
  }, 200, origin, { 'cache-control': 'private, no-store' });
}
