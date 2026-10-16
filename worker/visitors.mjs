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
   place Cloudflare already worked out (country, region, city — never finer),
   and a browser / OS / device class parsed from the user agent here and then
   thrown away. Since 2026-10-16 also: the browser's language (two letters), a
   screen-width class (S / M / L / XL), the campaign tag of a shared link
   (`utm_source` / `utm_campaign`, or `?ref=`), how long the page was in front
   and how far down it was scrolled, and the HOSTNAME of any link out that was
   clicked. That is roughly what Plausible keeps, and the line is the same as
   theirs: nothing here can be joined to a person without them telling you.

   NOT kept: the IP address, the raw user agent, the rest of the query string,
   the exact screen size, coordinates, or anything else a fingerprint is made
   of. The visitor id is a coin toss stored in that browser's localStorage;
   clear it and the same person is a new visitor, which is the right way round
   for a page that only wants to know roughly how many people came.

   ── why D1, and why it may be absent ──
   The training log lives in a Durable Object because it is one person writing
   a handful of times a day. This is every visitor writing on every page, and
   the questions asked of it are GROUP BYs over months — which is what D1 is.
   The binding is `STATS`. With no binding the Worker still runs: /hit answers
   204 and records nothing, /stats says `configured: false`. So this deploys
   safely before the database exists, the same way /media shipped before R2.

   ── who can read it ──
   Only the owner. The handler is passed `isOwner`, which the outer Worker gets
   either by asking the Durable Object's /auth — the throttled one — so this
   endpoint is not a second, unthrottled way to guess the site password — or,
   from ricmassey.com/admin, by asking Supabase whether the signed-in account
   is in site_admins (`isSiteAdmin` below). */

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
   deploy, and the first beacon makes the tables. Columns added later are
   added here too, to a table made before them — SQLite has no ADD COLUMN IF
   NOT EXISTS, so it reads what is there and adds what is missing. */
const LATER = {
  vid: "TEXT NOT NULL DEFAULT ''",        // this page view's own id, so its heartbeats find it
  lang: "TEXT NOT NULL DEFAULT ''",
  screen: "TEXT NOT NULL DEFAULT ''",
  src: "TEXT NOT NULL DEFAULT ''",        // utm_source / ?ref=
  camp: "TEXT NOT NULL DEFAULT ''",       // utm_campaign
  region: "TEXT NOT NULL DEFAULT ''",
  city: "TEXT NOT NULL DEFAULT ''",
  dur: 'INTEGER NOT NULL DEFAULT 0',      // seconds the page was in front
  depth: 'INTEGER NOT NULL DEFAULT 0'     // furthest it was scrolled, percent
};
const ready = new WeakMap();
function ensure(db) {
  if (!ready.has(db)) {
    ready.set(db, (async () => {
      await db.batch([
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
        )`),
        /* Links out of the site that were clicked: which page, which SITE. */
        db.prepare(`CREATE TABLE IF NOT EXISTS outs (
          id INTEGER PRIMARY KEY,
          ts INTEGER NOT NULL,
          visitor TEXT NOT NULL,
          session TEXT NOT NULL,
          path TEXT NOT NULL,
          host TEXT NOT NULL
        )`),
        db.prepare('CREATE INDEX IF NOT EXISTS outs_ts ON outs (ts)')
      ]);
      const have = new Set(((await db.prepare('PRAGMA table_info(views)').all()).results || []).map(c => c.name));
      const add = Object.keys(LATER).filter(c => !have.has(c));
      const steps = add.map(c => db.prepare(`ALTER TABLE views ADD COLUMN ${c} ${LATER[c]}`));
      steps.push(db.prepare('CREATE INDEX IF NOT EXISTS views_vid ON views (vid)'),
                 db.prepare('CREATE INDEX IF NOT EXISTS views_session ON views (session, ts)'));
      await db.batch(steps);
    })().catch(e => { ready.delete(db); throw e; }));
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

/* A campaign tag is a word somebody chose for a link they shared, so it is
   kept only if it looks like one: short, lowercase, letters, digits, . _ -. */
export function cleanTag(t) {
  t = String(t || '').trim().toLowerCase().slice(0, 40);
  return /^[a-z0-9._-]+$/.test(t) ? t : '';
}

/* A place name from Cloudflare — printable, no markup, short. */
const cleanPlace = v => String(v || '').replace(/[\u0000-\u001f<>"]/g, '').trim().slice(0, 60);

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
  const kind = ['ping', 'leave', 'out'].includes(body.k) ? body.k : 'view';
  if (!ID.test(visitor) || !ID.test(session) || !path) return quiet(origin);
  const vid = ID.test(String(body.i || '')) ? String(body.i) : '';
  const num = (x, max) => Math.max(0, Math.min(max, Math.round(Number(x) || 0)));
  const dur = num(body.t, 1800), depth = num(body.d, 100);

  const ts = Date.now();
  const work = (async () => {
    await ensure(env.STATS);
    const db = env.STATS;
    const steps = [];
    /* Leaving is not being here: only a view or a heartbeat moves `live`. */
    if (kind === 'view' || kind === 'ping') steps.push(
      db.prepare(`INSERT INTO live (visitor, path, ts) VALUES (?, ?, ?)
                  ON CONFLICT(visitor) DO UPDATE SET path = excluded.path, ts = excluded.ts`)
        .bind(visitor, path, ts));
    /* Heartbeats and the last word on leaving carry how long the page has
       been in front and how far down it got. Both only ever grow. */
    if ((kind === 'ping' || kind === 'leave') && vid && (dur || depth)) steps.push(
      db.prepare('UPDATE views SET dur = MAX(dur, ?), depth = MAX(depth, ?) WHERE vid = ? AND visitor = ?')
        .bind(dur, depth, vid, visitor));
    if (kind === 'out') {
      const host = cleanRef(body.o);
      if (host) steps.push(db.prepare('INSERT INTO outs (ts, visitor, session, path, host) VALUES (?, ?, ?, ?, ?)')
        .bind(ts, visitor, session, path, host));
    }
    if (kind === 'view') {
      const { device, browser, os } = describeAgent(ua);
      const cf = request.cf || {};
      let country = String(cf.country || '').slice(0, 2).toUpperCase();
      if (!/^[A-Z]{2}$/.test(country) || country === 'XX' || country === 'T1') country = '';
      const lang = /^[a-z]{2,3}$/.test(String(body.l || '')) ? String(body.l) : '';
      const screen = ['S', 'M', 'L', 'XL'].includes(body.w) ? body.w : '';
      steps.push(
        db.prepare(`INSERT INTO views (ts, visitor, session, first, path, ref, country, browser, os, device,
                                       vid, lang, screen, src, camp, region, city, dur, depth)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`)
          .bind(ts, visitor, session, body.f ? 1 : 0, path, cleanRef(body.r), country, browser, os, device,
                vid, lang, screen, cleanTag(body.u), cleanTag(body.c),
                country ? cleanPlace(cf.region) : '', country ? cleanPlace(cf.city) : ''),
        db.prepare('DELETE FROM live WHERE ts < ?').bind(ts - HOUR_MS)
      );
    }
    if (steps.length) await db.batch(steps);
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

/* ── the admin page's door ──
   ricmassey.com/admin signs in with the site account (Supabase), not the site
   password. It sends that session's access token as `x-admin-session`, and
   this asks Supabase the same question the admin page itself asks —
   is_site_admin() — with that token. The token is never stored; the answer is
   remembered for a minute so a page refreshing every sixty seconds is not a
   Supabase call every time. SITE_SUPABASE_URL / SITE_SUPABASE_KEY are public
   values (the same two atlas/config.js publishes) and live in wrangler.jsonc
   "vars"; unset, this door is shut and only the site password opens /stats. */
const adminSeen = new Map();
export async function isSiteAdmin(token, env, fetcher = fetch) {
  const base = String(env.SITE_SUPABASE_URL || '').replace(/\/+$/, '');
  if (!token || token.length > 4096 || !/^https:\/\/[a-z0-9.-]+$/.test(base) || !env.SITE_SUPABASE_KEY) return false;
  const now = Date.now();
  const held = adminSeen.get(token);
  if (held && held.until > now) return held.ok;
  let ok = false;
  try {
    const r = await fetcher(base + '/rest/v1/rpc/is_site_admin', {
      method: 'POST',
      headers: { apikey: env.SITE_SUPABASE_KEY, authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: '{}'
    });
    ok = r.ok && (await r.json().catch(() => false)) === true;
  } catch { return false; }        // could not ask: not remembered, not let in
  if (adminSeen.size > 200) adminSeen.clear();
  adminSeen.set(token, { ok, until: now + 60000 });
  return ok;
}

/* Sessions, newest first, each with the pages it went through in order and
   where it came from. One query serves the admin page's session list (`where`
   is the range) and one visitor's timeline (`where` is their id). */
function sessionsQuery(db, where, args, limit) {
  return db.prepare(`
    WITH s AS (SELECT session, visitor, MIN(ts) AS start, MAX(ts) AS last, COUNT(*) AS n, SUM(dur) AS dur
               FROM views WHERE ${where} GROUP BY session ORDER BY start DESC LIMIT ${limit})
    SELECT s.session, s.visitor, s.start, s.last, s.n, s.dur,
           f.ref, f.src, f.camp, f.country, f.region, f.city, f.device, f.browser, f.os, f.lang, f.screen,
           (SELECT MIN(ts) FROM views x WHERE x.visitor = s.visitor) AS firstEver,
           (SELECT json_group_array(json_array(path, dur, depth, ts)) FROM
              (SELECT path, dur, depth, ts FROM views v WHERE v.session = s.session ORDER BY ts, id LIMIT 80)) AS pages,
           (SELECT json_group_array(host) FROM (SELECT host FROM outs o WHERE o.session = s.session ORDER BY ts LIMIT 20)) AS outs
    FROM s JOIN views f ON f.id = (SELECT id FROM views WHERE session = s.session ORDER BY ts, id LIMIT 1)
    ORDER BY s.start DESC`).bind(...args);
}
const parse = t => { try { return JSON.parse(t || '[]'); } catch { return []; } };
const sessionRow = x => ({
  session: x.session, visitor: x.visitor, start: x.start, last: x.last, views: x.n, dur: x.dur || 0,
  ref: x.ref, src: x.src, camp: x.camp, country: x.country, region: x.region, city: x.city,
  device: x.device, browser: x.browser, os: x.os, lang: x.lang, screen: x.screen,
  returning: x.firstEver < x.start, pages: parse(x.pages), outs: parse(x.outs)
});

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

  /* ---------- GET /stats/visitor?id= — one browser's whole history ---------- */
  if (parts[1] === 'visitor') {
    const id = q.get('id') || '';
    if (!ID.test(id)) return json({ error: 'visitor id required' }, 400, origin);
    const r = await db.batch([
      db.prepare(`SELECT COUNT(*) AS views, COUNT(DISTINCT session) AS sessions, SUM(dur) AS dur,
                         MIN(ts) AS first, MAX(ts) AS last FROM views WHERE visitor = ?`).bind(id),
      sessionsQuery(db, 'visitor = ?', [id], 100),
      db.prepare('SELECT path AS k, COUNT(*) AS n FROM views WHERE visitor = ? GROUP BY path ORDER BY n DESC LIMIT 15').bind(id),
      db.prepare('SELECT COUNT(*) AS n FROM ignored WHERE visitor = ?').bind(id)
    ]);
    const t = (r[0].results || [])[0] || {};
    return json({
      visitor: id, views: t.views || 0, sessions: t.sessions || 0, dur: t.dur || 0, first: t.first || null, last: t.last || null,
      ignored: !!(((r[3].results || [])[0] || {}).n),
      pages: (r[2].results || []).map(x => [x.k, x.n]),
      history: (r[1].results || []).map(sessionRow)
    }, 200, origin, { 'cache-control': 'private, no-store' });
  }

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

  /* ---------- ?full=1 — everything else, for ricmassey.com/admin ----------
     The /visitors/ console refreshes every thirty seconds and does not ask for
     this; the admin page asks once a minute. */
  let more;
  if (q.get('full') === '1') {
    const m = await db.batch([
      db.prepare(`WITH s AS (SELECT COUNT(*) AS n, SUM(dur) AS dur FROM views WHERE ${W} GROUP BY session)
                  SELECT COUNT(*) AS sessions, SUM(n = 1) AS bounces, AVG(n) AS pps, AVG(dur) AS dur FROM s`).bind(from),   // 0
      db.prepare(`SELECT AVG(NULLIF(dur, 0)) AS dur, AVG(NULLIF(depth, 0)) AS depth FROM views WHERE ${W}`).bind(from), // 1
      db.prepare(`WITH v AS (SELECT path, visitor, dur, depth,
                    ROW_NUMBER() OVER (PARTITION BY session ORDER BY ts, id) AS rn,
                    ROW_NUMBER() OVER (PARTITION BY session ORDER BY ts DESC, id DESC) AS rd,
                    COUNT(*) OVER (PARTITION BY session) AS sn
                  FROM views WHERE ${W})
                  SELECT path AS k, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors,
                         ROUND(AVG(NULLIF(dur, 0))) AS dur, ROUND(AVG(NULLIF(depth, 0))) AS depth,
                         SUM(rn = 1) AS entries, SUM(rd = 1) AS exits, SUM(sn = 1) AS bounces
                  FROM v GROUP BY path ORDER BY views DESC LIMIT 80`).bind(from),                       // 2
      db.prepare(`WITH v AS (SELECT path, LEAD(path) OVER (PARTITION BY session ORDER BY ts, id) AS nxt
                  FROM views WHERE ${W})
                  SELECT path AS a, nxt AS b, COUNT(*) AS n FROM v
                  WHERE nxt IS NOT NULL AND nxt != path GROUP BY a, b ORDER BY n DESC LIMIT 30`).bind(from), // 3
      db.prepare(`SELECT CAST(strftime('%w', (ts + ?) / 1000, 'unixepoch') AS INTEGER) AS d,
                         CAST(strftime('%H', (ts + ?) / 1000, 'unixepoch') AS INTEGER) AS h, COUNT(*) AS n
                  FROM views WHERE ${W} GROUP BY d, h`).bind(off, off, from),                            // 4
      db.prepare(`SELECT country, region, city, COUNT(DISTINCT visitor) AS n FROM views
                  WHERE ${W} AND country != '' GROUP BY country, region, city ORDER BY n DESC LIMIT 40`).bind(from), // 5
      top('lang', 'COUNT(DISTINCT visitor)', 20),                                                // 6
      top('screen', 'COUNT(DISTINCT visitor)'),                                                  // 7
      db.prepare(`SELECT src, camp, COUNT(DISTINCT session) AS n FROM views
                  WHERE ${W} AND src != '' GROUP BY src, camp ORDER BY n DESC LIMIT 20`).bind(from),   // 8
      db.prepare(`SELECT host AS k, COUNT(*) AS n, COUNT(DISTINCT visitor) AS u FROM outs
                  WHERE ${W} GROUP BY host ORDER BY n DESC LIMIT 20`).bind(from),                // 9
      db.prepare(`SELECT c AS k, COUNT(*) AS n FROM
                    (SELECT COUNT(DISTINCT session) AS c FROM views WHERE ${W} GROUP BY visitor)
                  GROUP BY c ORDER BY c`).bind(from),                                             // 10
      /* Time on site per session, in six bands: <10s, <30s, <2m, <5m, <15m, more. */
      db.prepare(`SELECT CASE WHEN d < 10 THEN 0 WHEN d < 30 THEN 1 WHEN d < 120 THEN 2
                              WHEN d < 300 THEN 3 WHEN d < 900 THEN 4 ELSE 5 END AS k, COUNT(*) AS n FROM
                    (SELECT SUM(dur) AS d FROM views WHERE ${W} GROUP BY session)
                  GROUP BY k ORDER BY k`).bind(from),                                             // 11
      db.prepare(`SELECT visitor, COUNT(DISTINCT session) AS s, COUNT(*) AS v, SUM(dur) AS dur, MAX(ts) AS last,
                         country, region, city, device, browser, os,
                         (SELECT MIN(ts) FROM views x WHERE x.visitor = views.visitor) AS firstEver
                  FROM views WHERE ${W} GROUP BY visitor ORDER BY s DESC, v DESC LIMIT 30`).bind(from), // 12
      sessionsQuery(db, W, [from], 60),                                                           // 13
      db.prepare(`SELECT browser || ' ' || os AS k, COUNT(DISTINCT visitor) AS n FROM views
                  WHERE ${W} GROUP BY browser, os ORDER BY n DESC LIMIT 12`).bind(from)            // 14
    ]);
    const rs = i => (m[i] && m[i].results) || [];
    const e = rs(0)[0] || {}, g = rs(1)[0] || {};
    more = {
      engagement: {
        sessions: e.sessions || 0, bounces: e.bounces || 0, pagesPerSession: e.pps || 0,
        sessionSeconds: e.dur || 0, pageSeconds: g.dur || 0, scroll: g.depth || 0
      },
      pages: rs(2).map(x => ({ path: x.k, views: x.views, visitors: x.visitors, dur: x.dur || 0, depth: x.depth || 0,
                               entries: x.entries, exits: x.exits, bounces: x.bounces })),
      flows: rs(3).map(x => [x.a, x.b, x.n]),
      heat: rs(4).map(x => [x.d, x.h, x.n]),
      places: rs(5).map(x => [x.country, x.region, x.city, x.n]),
      languages: rs(6).map(x => [x.k, x.n]),
      screens: rs(7).map(x => [x.k, x.n]),
      campaigns: rs(8).map(x => [x.src, x.camp, x.n]),
      outbound: rs(9).map(x => [x.k, x.n, x.u]),
      loyalty: rs(10).map(x => [x.k, x.n]),
      lengths: rs(11).map(x => [x.k, x.n]),
      regulars: rs(12).map(x => ({ visitor: x.visitor, sessions: x.s, views: x.v, dur: x.dur || 0, last: x.last,
                                   first: x.firstEver, country: x.country, region: x.region, city: x.city,
                                   device: x.device, browser: x.browser, os: x.os })),
      sessions: rs(13).map(sessionRow),
      platforms: rs(14).map(x => [x.k, x.n])
    };
  }

  return json({
    configured: true, more,
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
