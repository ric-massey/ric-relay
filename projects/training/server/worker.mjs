/* TRAINING — the log service on Cloudflare
   ────────────────────────────────────────────────────────────────────────────
   Stores which sessions got done and the notes written against them. Nothing
   else. The plan itself is a static file (assets/training-plan.json) served
   from Pages, so this never holds a schedule, a venue or a rota — only ticks
   and prose, keyed by date.

       cd projects/training/server
       npx wrangler@latest secret put LOG_TOKEN     # once, pick something long
       npx wrangler@latest deploy

   ── why the whole security model is one token ──
   Pages is static and the repo is public, so there is no such thing as a secret
   in the page and no "is this Ric" check written in JavaScript is worth
   anything — anyone can edit their own copy. The gate therefore has to sit
   somewhere the public cannot read, which is here. The page is free to render
   whatever controls it likes; a write without the token gets a 401 and nothing
   happens. That is why the client is allowed to be naive.

   ── why a Durable Object, and why it differs from crossfire-rooms ──
   Same reason as Crossfire — a Worker is many isolates and they share no
   memory, so a tick written in one would not exist for the next reader. The
   difference is that this one actually WRITES to its SQLite storage, because
   unlike a lobby list a training log is worth keeping. The volume is a handful
   of writes a day from one person, which sits far inside the free plan. */

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/* ── what a Strava activity is allowed to become ──
   An activity off the Strava API carries `start_latlng`, `end_latlng` and an
   encoded `map.polyline` — the exact route, door to door. Rule one of this repo
   is that no location data is ever published from it, so the activity is not
   stored and filtered later: it is rebuilt from this list and nothing else
   survives the copy. Same direction as PUBLIC_FIELDS in export.mjs, for the same
   reason — the upstream shape changes without asking, an allowlist does not.

   `name` is in because a run card with no name is a row of numbers, and because
   Strava's own defaults ("Morning Run") say nothing. It is free text Ric types,
   so it is the one field here that could name a place. That is the same bargain
   the plan already makes by publishing venues; the README records it. */
const ACTIVITY_FIELDS = ['id', 'name', 'sport_type', 'type', 'distance',
  'moving_time', 'elapsed_time', 'total_elevation_gain', 'start_date_local',
  /* The numbers a watch actually records. Deliberately absent: elev_high and
     elev_low (an altitude pair narrows a town), gear_id (an id nothing here
     can resolve), and anything named for a segment, because segments are
     places with names — a route is published now, but a list of place names
     next to it is a different thing and nobody asked for it. */
  'average_speed', 'max_speed', 'average_heartrate', 'max_heartrate',
  'has_heartrate', 'average_cadence', 'average_watts', 'max_watts', 'calories',
  'suffer_score', 'workout_type', 'device_name', 'average_temp',
  'kudos_count', 'achievement_count', 'pr_count'];

/* Splits are copied key by key like everything else rather than taken whole.
   A blind copy of a nested object is how a field nobody reviewed ends up
   published — the allowlist above would be decoration if the array under it
   were waved through. */
const SPLIT_FIELDS = ['split', 'distance', 'elapsed_time', 'moving_time',
  'elevation_difference', 'average_speed', 'average_heartrate', 'pace_zone'];
const MAX_SPLITS = 60;                       // a marathon in km, and a stop

/* Anything matching this in the stored output means the allowlist above grew a
   field it should not have. Cheap, and it fails loudly at the moment of the
   mistake rather than on the public page a week later.

   `polyline` came out of this list on 2026-08-17, by Ric's decision, so the run
   detail can draw the route. That is a reversal of what this file was built to
   guarantee and it is worth being plain about: the site now publishes where he
   ran, start point included, to anybody who opens the page. Strava's own
   privacy zones do not help — they trim the map shown to OTHER Strava users,
   and this is fetched with Ric's token, which returns the real thing.

   Everything else stays refused, and the route arrives through one named field
   below rather than by waving the whole `map` object through: a decision to
   publish the line is not a decision to publish city, address or timezone. To
   undo it, put `polyline` back in this regex and drop the `route` block in
   trim() — old runs keep theirs until they are re-ingested. */
const LEAKY = /latlng|"map"|location_|address|timezone/i;

/* ── the route waits five minutes; nothing else does ──
   Ric does not mind people knowing where he trained, or that he trained at nine
   this morning. What he does not want is his location readable while he is
   still out on it. So the timestamp is published as it always was, and the
   ROUTE is the one thing held — because a map that appears the instant a watch
   syncs says where he is right now, and the webhook is fast enough to mean it.

   Counted from `at`, the moment this Worker took the activity in, NOT from when
   the run started. That is what "five minutes after the post to Strava" means,
   and it is the honest clock: `start_date_local` is a local time wearing a Z,
   so parsing it can be a timezone out in either direction, which at a five
   minute hold would be the whole of it. `at` is a real UTC instant we wrote
   ourselves.

   Five minutes is short. It stops the live broadcast — the case where a run
   lands mid-cooldown and the map is up while he is still at the trailhead —
   and nothing more than that. */
const ROUTE_HOLD_MS = 5 * 60 * 1000;

function forVisitor(a) {
  if (!a.route) return a;
  /* No `at` means a run stored before this rule existed. Those are old by
     definition, so they publish rather than hide forever. */
  const t = Date.parse(a.at);
  if (!Number.isFinite(t) || Date.now() - t >= ROUTE_HOLD_MS) return a;
  const out = { ...a };
  delete out.route;
  return out;
}

/* ── which activities tick something ──
   Deliberately only runs. A Strava "WeightTraining" is not evidence the morning
   practice happened, and board sessions are logged on the climbing page from the
   Kilter and Tension apps — having a watch tick a climbing session too would
   double-count the one thing on this site that already has a real source.
   Everything else is still recorded and still shown; it just ticks nothing. */
const SPORT_KIND = { Run: 'run', TrailRun: 'run', VirtualRun: 'run' };

/* A run has to be a run. Starting a watch by accident in a car park makes a
   40-metre "activity", and without a floor that would tick off the long run. */
const MIN_RUN_M = 500;

/* Where the schedule is read from when a run needs matching to a session. The
   Worker still holds no plan — it reads the published one, the same file every
   visitor gets, and keeps it in memory for a few minutes. Overridable so the
   tests and dev.mjs can point it at a fixture. */
const PLAN_URL = 'https://ricmassey.com/assets/training-plan.json';
const PLAN_TTL = 10 * 60 * 1000;

/* Constant-time compare. A plain === leaks the length of the matching prefix
   through timing, which is a real if slow way to recover a token. */
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* Reads are public by design, so the origin is echoed rather than policed —
   CORS is not what protects the writes, the token is. */
const cors = origin => ({
  'access-control-allow-origin': origin || '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-max-age': '86400'
});

const json = (body, status, origin, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...cors(origin), ...extra }
  });

/* Notes default to public — the deliberate choice for this log — so the filter
   removes only what was explicitly marked private. */
const publicView = entry => ({
  done: entry.done || {},
  ticks: entry.ticks || {},
  /* Which ticks were placed by Strava rather than by a thumb. Public because
     the page says so on the card — a tick that appeared on its own should look
     different from one somebody made, and because it is what lets a deleted
     activity take its own tick back down without touching a manual one. */
  auto: entry.auto || {},
  notes: (entry.notes || []).filter(n => n.public !== false).map(({ id, text, at }) => ({ id, text, at })),
  updated: entry.updated || null
});

export class TrainingLog {
  /* A Durable Object is handed the environment at construction, which is where
     the token comes from. It is never sent to the client and never logged. */
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.token = env.LOG_TOKEN || '';
    /* The Strava credentials. Absent on a deploy that has never been wired to
       Strava, which is fine — the endpoint then records nothing and says so,
       rather than throwing on every webhook. */
    this.strava = {
      id: env.STRAVA_CLIENT_ID || '',
      secret: env.STRAVA_CLIENT_SECRET || '',
      seed: env.STRAVA_REFRESH_TOKEN || '',
      athlete: env.STRAVA_ATHLETE_ID || ''
    };
    /* A test seam, and the only one. Both of these are the real thing in
       production; the tests swap them for a fake Strava and a fixture plan so
       the matching rules can be asserted without a network or an account. */
    this.fetch_ = env.FETCH || ((...a) => fetch(...a));
    this.planUrl = env.PLAN_URL || PLAN_URL;
    this.plan_ = null; this.planAt = 0;
    this.access = ''; this.accessExp = 0;
    /* Webhook deliveries seen recently. The callback URL is unauthenticated —
       it has to be, Strava does not sign its events — so this caps how much
       work a stranger POSTing rubbish at it can make the Worker do against
       Strava's rate limit. */
    this.hooks = [];
    /* Timestamps of recent failed attempts. In memory rather than storage on
       purpose: there is exactly one instance of this object, so a plain array
       is a global counter, and losing it when the object is evicted is fine —
       an attacker cannot cause an eviction and a restart costs nothing. */
    this.fails = [];
  }

  /* Wrong passwords get slower. Ten failures in five minutes and everything
     stops accepting them for the rest of that window.

     Why this matters: a static site cannot hide the API, so anybody can throw
     guesses at it forever. Without a limit, a short password falls in hours.
     With it, the ceiling is ~2,880 guesses a day against however long the
     password is — which is nothing at 20 random characters and still not much
     at 12. The password should still be long; this stops it being the only
     thing standing there.

     Ten is generous for a human typo and brutal for a script, and a lockout is
     the same five minutes for the owner, which is the right trade for a page
     that ticks boxes. */
  throttled() {
    const now = Date.now(), WINDOW = 5 * 60 * 1000, LIMIT = 10;
    this.fails = this.fails.filter(t => now - t < WINDOW);
    return this.fails.length >= LIMIT;
  }
  noteFail() { this.fails.push(Date.now()); }

  /* ══ STRAVA ══════════════════════════════════════════════════════════════
     A run finishes, the watch syncs, Strava POSTs here, and the session on the
     plan for that date ticks itself off. Nobody opens the site.

     The event Strava sends is only ever {aspect_type, object_id, owner_id} —
     no distance, no date, no sport. So every one of those three facts is read
     from the API afterwards, with Ric's own token, and NOT from the webhook
     body. That is what makes a forged POST at this endpoint harmless: the only
     thing an attacker controls is which activity id gets looked up, and the
     token only ever returns activities belonging to the person who issued it. */

  /* Strava rotates the refresh token — "expect that this value can change any
     time you retrieve a new access token", and the old one dies immediately. So
     the secret in Cloudflare is a SEED, not the credential: the live one lives
     in storage from the first refresh onward. Getting this wrong breaks the
     integration silently, weeks later, on a token that used to work. */
  async accessToken() {
    const now = Math.floor(Date.now() / 1000);
    if (this.access && this.accessExp > now + 120) return this.access;
    if (!this.strava.id || !this.strava.secret) return '';

    const refresh = (await this.state.storage.get('strava:refresh')) || this.strava.seed;
    if (!refresh) return '';

    const r = await this.fetch_('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_id: this.strava.id,
        client_secret: this.strava.secret,
        refresh_token: refresh,
        grant_type: 'refresh_token'
      })
    });
    if (!r.ok) return '';
    const j = await r.json();
    if (j.refresh_token && j.refresh_token !== refresh) {
      await this.state.storage.put('strava:refresh', j.refresh_token);
    }
    this.access = j.access_token || '';
    this.accessExp = j.expires_at || 0;
    return this.access;
  }

  async activity(id) {
    const token = await this.accessToken();
    if (!token) return null;
    const r = await this.fetch_('https://www.strava.com/api/v3/activities/' + id, {
      headers: { authorization: 'Bearer ' + token }
    });
    if (!r.ok) return null;
    return await r.json();
  }

  /* The published plan, as any visitor would read it. Held for a few minutes
     because a Saturday can deliver several activities in a row and refetching
     364 days for each of them is rude to Pages and slow for no reason. */
  async plan() {
    if (this.plan_ && Date.now() - this.planAt < PLAN_TTL) return this.plan_;
    try {
      const r = await this.fetch_(this.planUrl, { cf: { cacheTtl: 300 } });
      if (!r.ok) return this.plan_ || { days: [] };
      this.plan_ = await r.json();
      this.planAt = Date.now();
    } catch { return this.plan_ || { days: [] }; }
    return this.plan_;
  }

  /* Cut an API activity down to what may be published. Returns null if the
     result trips the leak guard, because storing nothing is the right failure
     — a missing run card is a nuisance, a published GPS trace is not.

     `hidden` is a run Ric marked "Only You" or followers-only on Strava. It
     still ticks its session — it happened — but it is not republished here, and
     it does not even keep its name in storage. Marking a run private on Strava
     is a person saying what they want; a site that then prints it on the front
     page has ignored them. What is kept is the little needed to tick, and to
     take the tick back down if the run is later deleted. */
  trim(a, hidden) {
    const out = {};
    for (const f of ACTIVITY_FIELDS) {
      if (hidden && f === 'name') continue;
      if (a[f] !== undefined && a[f] !== null) out[f] = a[f];
    }
    out.id = String(out.id || '');
    /* When this arrived, which is what the route hold counts from. A real UTC
       instant written here, not Strava's local-time-wearing-a-Z. */
    out.at = new Date().toISOString();
    if (hidden) out.hidden = true;
    else out.name = String(out.name || '').slice(0, 160);

    /* The route, on a public run only, as Strava's encoded polyline — the page
       decodes it and draws the shape. `summary_polyline` rather than the full
       one: it is the simplified line, a few hundred points instead of
       thousands, which is all a thumbnail-sized map can show anyway.

       A private run gets none of this, the same as its name and its splits.
       "Not republished" has to mean the route too, or the rule means nothing. */
    if (!hidden) {
      const line = a.map && (a.map.summary_polyline || a.map.polyline);
      if (typeof line === 'string' && line.length > 1 && line.length <= 12000) out.route = line;
    }

    /* Per-kilometre splits, on a public run only. They are the one thing here
       that is a shape rather than a total — where the hills were, where it fell
       apart — and the page draws them as a bar per split. */
    if (!hidden && Array.isArray(a.splits_metric)) {
      const splits = a.splits_metric.slice(0, MAX_SPLITS).map(s => {
        const t = {};
        for (const f of SPLIT_FIELDS) {
          if (s && s[f] !== undefined && s[f] !== null) t[f] = s[f];
        }
        return t;
      }).filter(s => s.distance);
      if (splits.length) out.splits = splits;
    }

    if (LEAKY.test(JSON.stringify(out))) {
      console.error('strava: refusing to store an activity that tripped the leak guard');
      return null;
    }
    return out;
  }

  /* Which session this activity is evidence for, or null. */
  async sessionFor(a) {
    const date = String(a.start_date_local || '').slice(0, 10);
    if (!DAY.test(date)) return null;
    const kind = SPORT_KIND[a.sport_type] || SPORT_KIND[a.type];
    if (!kind) return null;
    if (kind === 'run' && Number(a.distance || 0) < MIN_RUN_M) return null;
    const day = ((await this.plan()).days || []).find(d => d.date === date);
    const s = day && (day.sessions || []).find(x => x.kind === kind);
    return s ? { date, id: s.id } : null;
  }

  /* Runs stack: one date can hold a shakeout and a hard session. Merged by id
     so an `update` event — a rename, a corrected sport — replaces rather than
     duplicates. `sa:<id>` is the reverse pointer, because a delete event says
     only which activity went and never which day it was on. */
  async storeActivity(a) {
    const date = String(a.start_date_local || '').slice(0, 10);
    if (!DAY.test(date)) return null;
    const list = (await this.state.storage.get('s:' + date)) || [];
    const prior = list.find(x => String(x.id) === String(a.id));
    const next = list.filter(x => String(x.id) !== String(a.id));
    /* Keep the first arrival time across re-ingests. Renaming a month-old run
       fires a fresh webhook, and without this its route would go back behind
       the five minute hold as though the run had just happened. */
    if (prior && prior.at) a = { ...a, at: prior.at };
    next.push(a);
    next.sort((x, y) => String(x.start_date_local).localeCompare(String(y.start_date_local)));
    await this.state.storage.put('s:' + date, next);
    await this.state.storage.put('sa:' + a.id, date);
    return date;
  }

  async tick(date, sessionId) {
    const prev = (await this.state.storage.get('d:' + date)) || { done: {}, ticks: {}, notes: [] };
    /* Presence, not truth. Strava re-sends a webhook every time an activity is
       renamed or edited, so this runs again long after the run landed — and a
       session Ric has already unticked by hand reads as `false`, which is
       falsy. Testing the value put his tick back every time he renamed the run
       on his phone. A key is only in `done` because someone decided it, so
       once it is there, the watch has had its say. */
    if (prev.done && sessionId in prev.done) return;
    const entry = {
      ...prev,
      done: { ...(prev.done || {}), [sessionId]: true },
      auto: { ...(prev.auto || {}), [sessionId]: true },
      updated: new Date().toISOString()
    };
    await this.state.storage.put('d:' + date, entry);
  }

  /* Deleting the activity on Strava takes its tick back down — but only if
     Strava is what put it there. A tick Ric made with his thumb is his, and a
     watch has no business undoing it. */
  async forget(id) {
    const date = await this.state.storage.get('sa:' + String(id));
    if (!date) return;
    const list = ((await this.state.storage.get('s:' + date)) || [])
      .filter(x => String(x.id) !== String(id));
    if (list.length) await this.state.storage.put('s:' + date, list);
    else await this.state.storage.delete('s:' + date);
    await this.state.storage.delete('sa:' + String(id));

    const entry = await this.state.storage.get('d:' + date);
    if (!entry || !entry.auto) return;
    /* Only drop a tick that nothing left on the day still supports. */
    const still = new Set();
    for (const a of list) {
      const m = await this.sessionFor(a);
      if (m) still.add(m.id);
    }
    const done = { ...(entry.done || {}) }, auto = { ...entry.auto };
    let changed = false;
    for (const sid of Object.keys(entry.auto)) {
      if (!still.has(sid)) { delete done[sid]; delete auto[sid]; changed = true; }
    }
    if (!changed) return;
    await this.state.storage.put('d:' + date, { ...entry, done, auto, updated: new Date().toISOString() });
  }

  hookFlood() {
    const now = Date.now(), WINDOW = 15 * 60 * 1000, LIMIT = 100;
    this.hooks = this.hooks.filter(t => now - t < WINDOW);
    if (this.hooks.length >= LIMIT) return true;
    this.hooks.push(now);
    return false;
  }

  /* The whole job, run after the 200 has already gone back to Strava. Nothing
     in here is allowed to throw: a webhook that fails is retried three times
     and then dropped forever, so a bad day should lose one run, not the log. */
  async ingest(ev) {
    try {
      if (!ev || ev.object_type !== 'activity') return;
      const id = String(ev.object_id || '');
      if (!/^\d{1,20}$/.test(id)) return;
      /* Ric's own athlete id, when configured — the cheap check, before
         spending a Strava API call on somebody else's event. */
      if (this.strava.athlete && String(ev.owner_id) !== String(this.strava.athlete)) return;
      if (this.hookFlood()) { console.error('strava: webhook flood, dropping'); return; }

      if (ev.aspect_type === 'delete') return await this.forget(id);

      const raw = await this.activity(id);
      if (!raw) return;
      /* The authoritative owner check. The event body is a stranger's claim;
         this is the API's answer, made with Ric's token. */
      if (this.strava.athlete && raw.athlete && String(raw.athlete.id) !== String(this.strava.athlete)) return;

      /* Strava says this two ways depending on the age of the activity, so both
         are read and either one is enough. */
      const hidden = raw.private === true || (raw.visibility && raw.visibility !== 'everyone');
      const a = this.trim(raw, hidden);
      if (!a) return;
      const date = await this.storeActivity(a);
      if (!date) return;
      const match = await this.sessionFor(a);
      if (match) await this.tick(match.date, match.id);
    } catch (e) {
      console.error('strava: ingest failed', e && e.message);
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const parts = url.pathname.split('/').filter(Boolean);   // ['log'] | ['log','2026-08-16']
    const date = parts[1];

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });

    const bearer = () => {
      const a = request.headers.get('authorization') || '';
      return a.startsWith('Bearer ') ? a.slice(7) : '';
    };
    /* Every failed credential check — a bad password on /auth or a bad bearer
       token on any write — counts toward the same limit. Checking them
       separately would leave the write path as an unthrottled oracle.

       A CORRECT credential is never refused, throttle or no throttle. Two
       reasons, and the second is the important one:

       1. On a read, refusing the owner does not deny an attacker anything —
          they were getting the public view regardless — it just silently
          empties Ric's own private notes and returns 200, which reads as data
          loss rather than as a lockout.
       2. If a right password could be locked out, then anybody in the world
          could lock Ric out of his own site indefinitely by hammering /auth
          with rubbish. That is a denial of service handed out for free, in
          exchange for delaying a guesser who is already bounded by the counter.

       The rate limit's job is to cap how fast WRONG guesses can be made. It is
       not to punish the person who knows the password. */
    const authed = () => {
      const given = bearer();
      if (!given) return false;
      if (this.token && sameSecret(given, this.token)) return true;
      this.noteFail();
      return false;
    };

    /* ---------- POST /auth ----------
       The password IS the token; this endpoint only exists so the page can say
       "wrong password" the moment it is typed rather than silently failing on
       the first tick an hour later. It returns nothing but a yes or a no. */
    if (parts[0] === 'auth') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);
      let body = {};
      try { body = await request.json(); } catch {}
      const given = String(body.password || '');
      /* Correctness first, so the right password works even mid-lockout —
         see the note on authed() above for why that matters more than it
         looks. Only wrong guesses meet the throttle. */
      if (given && this.token && sameSecret(given, this.token)) {
        return json({ ok: true }, 200, origin);
      }
      if (this.throttled()) {
        return json({ error: 'too many attempts — wait five minutes' }, 429, origin,
          { 'retry-after': '300' });
      }
      /* A wrong password is a 401 with no detail — not "too short", not "close",
         nothing that narrows the search. */
      this.noteFail();
      return json({ error: 'nope' }, 401, origin);
    }

    /* ---------- /climb/:date ----------
       Climbing days added from the web, as opposed to the ones built from
       climbs.md. Both end up on the climbing page; these are the ones that can
       be written from a phone at the crag. Public to read, token to write. */
    if (parts[0] === 'climb') {
      if (date && !DAY.test(date)) return json({ error: 'date must be YYYY-MM-DD' }, 400, origin);

      if (request.method === 'GET') {
        if (date) {
          const e = await this.state.storage.get('c:' + date);
          return json(e || null, 200, origin, { 'cache-control': 'public, max-age=30' });
        }
        const all = await this.state.storage.list({ prefix: 'c:' });
        const out = {};
        for (const [k, v] of all) out[k.slice(2)] = v;
        return json({ days: out }, 200, origin, { 'cache-control': 'public, max-age=30' });
      }

      if (request.method === 'POST') {
        if (!date) return json({ error: 'POST needs a date: /climb/YYYY-MM-DD' }, 400, origin);
        if (!authed()) return json({ error: 'nope' }, 401, origin);

        let body;
        try { body = await request.json(); } catch { return json({ error: 'body must be JSON' }, 400, origin); }

        /* Deleting a day is a POST with no routes and no area — a phone at a
           crag should not need a second verb to fix a mistake. */
        if (body.remove === true) {
          await this.state.storage.delete('c:' + date);
          return json({ ok: true, removed: date }, 200, origin);
        }

        const entry = {
          date,
          area: String(body.area || '').slice(0, 120),
          notes: String(body.notes || '').slice(0, 2000),
          people: String(body.people || '').slice(0, 200),
          routes: Array.isArray(body.routes) ? body.routes.slice(0, 200).map(r => ({
            name: String(r.name || '').slice(0, 160),
            grade: String(r.grade || '').slice(0, 24),
            outcome: ['sent', 'attempt', 'repeat'].includes(r.outcome) ? r.outcome : 'sent'
          })).filter(r => r.name) : [],
          source: 'web',
          updated: new Date().toISOString()
        };
        if (!entry.area && !entry.routes.length) {
          return json({ error: 'a day needs at least an area or one route' }, 400, origin);
        }
        await this.state.storage.put('c:' + date, entry);
        return json({ ok: true, ...entry }, 200, origin);
      }

      return json({ error: 'method not allowed' }, 405, origin);
    }

    /* ---------- /strava/:date ----------
       Read-only to the world: the runs, trimmed to ACTIVITY_FIELDS. There is no
       public write path here at all — activities only ever arrive through
       /strava-ingest, which the outer Worker calls and nobody else can reach. */
    if (parts[0] === 'strava') {
      if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, origin);
      if (date && !DAY.test(date)) return json({ error: 'date must be YYYY-MM-DD' }, 400, origin);
      /* The second half of the private-run rule. trim() already refused to keep
         a hidden run's name; this drops the record itself, so a run marked
         "Only You" on Strava leaves nothing here but the tick it earned. Two
         layers rather than one, because there is only one chance to get this
         right and the cost of the second layer is a filter.

         Signed in, Ric gets his hidden runs back. "Not republished" was always
         the rule and still is — but the filter was hiding them from their own
         author too, which made his weekly mileage wrong on his own page and
         gave him no way to see why. The name still never comes back: trim()
         refused to keep it, so there is nothing to hand over even here. Same
         shape as the private notes below, including the caching, which MUST be
         private on this path or a shared cache would hand the owner's copy to
         the street. */
      const isOwner = authed();
      const seen = list => (list || []).filter(a => isOwner || !a.hidden)
                                       .map(a => isOwner ? a : forVisitor(a));
      const cache = isOwner ? 'private, no-store' : 'public, max-age=30';
      if (date) {
        return json(seen(await this.state.storage.get('s:' + date)), 200, origin,
          { 'cache-control': cache });
      }
      const all = await this.state.storage.list({ prefix: 's:' });
      const out = {};
      for (const [k, v] of all) {
        const shown = seen(v);
        if (shown.length) out[k.slice(2)] = shown;
      }
      return json({ days: out }, 200, origin, { 'cache-control': cache });
    }

    /* ---------- /strava-ingest ----------
       Internal. The outer Worker builds this request itself after answering
       Strava, and its route table refuses the path from outside, so this is
       never reachable over the internet. It carries no token because there is
       nobody to hold one — Strava does not sign its webhooks. What protects it
       is that it trusts nothing in the body: see ingest(). */
    if (parts[0] === 'strava-ingest') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);
      let ev = {};
      try { ev = await request.json(); } catch {}
      await this.ingest(ev);
      return json({ ok: true }, 200, origin);
    }

    if (parts[0] !== 'log') return json({ error: 'not found' }, 404, origin);
    if (date && !DAY.test(date)) return json({ error: 'date must be YYYY-MM-DD' }, 400, origin);

    /* ---------- read ----------
       Public by default, but the owner reading with a token gets the private
       notes back. Without this the author cannot see his own private notes:
       he writes one, reloads, and it is gone — filtered by the same rule that
       protects it from everyone else. A note you cannot re-read is a note you
       will stop writing. Caching therefore has to be private on this path. */
    if (request.method === 'GET') {
      const isOwner = authed();
      const view = e => isOwner ? { done: e.done || {}, ticks: e.ticks || {}, auto: e.auto || {}, notes: e.notes || [], updated: e.updated || null }
                                : publicView(e);
      const cache = isOwner ? 'private, no-store' : 'public, max-age=30';

      if (date) {
        const entry = await this.state.storage.get('d:' + date);
        return json(entry ? view(entry) : { done: {}, ticks: {}, notes: [], updated: null }, 200, origin,
          { 'cache-control': cache });
      }
      /* The whole log. One person ticking boxes for a year is a small map, and
         the public page wants it in one request so a month view is instant. */
      const all = await this.state.storage.list({ prefix: 'd:' });
      const out = {};
      for (const [k, v] of all) out[k.slice(2)] = view(v);
      return json({ days: out }, 200, origin, { 'cache-control': cache });
    }

    /* ---------- write: token only ---------- */
    if (request.method === 'POST') {
      if (!date) return json({ error: 'POST needs a date: /log/YYYY-MM-DD' }, 400, origin);

      if (!authed()) return json({ error: 'nope' }, 401, origin);

      let body;
      try { body = await request.json(); }
      catch { return json({ error: 'body must be JSON' }, 400, origin); }

      const prev = (await this.state.storage.get('d:' + date)) || { done: {}, ticks: {}, notes: [] };

      /* A session the owner has just spoken about is no longer Strava's to
         claim. `auto` means "the tick standing here was placed by a watch", so
         a thumb touching that session — ticking OR unticking it — clears the
         flag, and a later delete on Strava can no longer take the tick away. */
      const said = body.done && typeof body.done === 'object' ? Object.keys(body.done) : [];
      const auto = { ...(prev.auto || {}) };
      for (const k of said) delete auto[k];

      /* Merge rather than replace: the phone and the laptop both write, and a
         tick made on one should not be erased by a stale view from the other. */
      const entry = {
        auto,
        done:  { ...prev.done,  ...(body.done  && typeof body.done  === 'object' ? body.done  : {}) },
        ticks: { ...prev.ticks, ...(body.ticks && typeof body.ticks === 'object' ? body.ticks : {}) },
        notes: Array.isArray(body.notes) ? body.notes.slice(0, 50).map(n => ({
          id: String(n.id || crypto.randomUUID()).slice(0, 64),
          text: String(n.text || '').slice(0, 4000),
          public: n.public !== false,
          at: String(n.at || new Date().toISOString()).slice(0, 32)
        })) : (prev.notes || []),
        updated: new Date().toISOString()
      };

      await this.state.storage.put('d:' + date, entry);
      /* Echo the OWNER's view — this response only ever reaches a caller who
         already proved the token, and it is what the page re-renders from.
         Returning the filtered view here would make a private note vanish the
         instant it was written. */
      return json({ ok: true, date, done: entry.done, ticks: entry.ticks, auto: entry.auto, notes: entry.notes, updated: entry.updated }, 200, origin);
    }

    return json({ error: 'method not allowed' }, 405, origin);
  }
}

/* Paths the outside world may reach. A whitelist rather than a blacklist,
   because the only thing standing between the internet and /strava-ingest is
   this line — and a blacklist is one forgotten entry away from being wrong. */
const PUBLIC_PATHS = new Set(['log', 'climb', 'auth', 'strava']);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    /* One named instance, one place, one copy of the log — the same reason
       crossfire-rooms names its object. Every device writing ticks is talking
       to the same one. */
    const stub = env.LOG.get(env.LOG.idFromName('training'));

    if (!PUBLIC_PATHS.has(parts[0])) {
      return new Response(JSON.stringify({ error: 'not found' }), {
        status: 404, headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    }

    /* ── the Strava callback ──
       Two different requests arrive on this one URL, and they are told apart by
       hub.mode, which only the handshake carries.

       Both have a two-second budget. The handshake is trivially inside it; the
       event is not, because answering it properly means a token refresh, an API
       call and a plan fetch. So the event is acknowledged FIRST and done after,
       in waitUntil. Miss the window and Strava retries three times and then
       drops the event on the floor — the run is gone, and nothing on the page
       would ever say so. */
    if (parts[0] === 'strava' && !parts[1]) {
      if (request.method === 'GET' && url.searchParams.get('hub.mode')) {
        const given = url.searchParams.get('hub.verify_token') || '';
        /* The verify token is what stops a stranger pointing THEIR Strava
           subscription at this URL. It is not a bearer token — it only ever
           appears in this handshake — but it is still a secret. */
        if (!env.STRAVA_VERIFY_TOKEN || !sameSecret(given, env.STRAVA_VERIFY_TOKEN)) {
          return new Response(JSON.stringify({ error: 'nope' }), {
            status: 403, headers: { 'content-type': 'application/json; charset=utf-8' }
          });
        }
        return new Response(JSON.stringify({ 'hub.challenge': url.searchParams.get('hub.challenge') || '' }), {
          status: 200, headers: { 'content-type': 'application/json; charset=utf-8' }
        });
      }

      if (request.method === 'POST') {
        let ev = null;
        try { ev = await request.json(); } catch {}
        const work = stub.fetch(new Request('https://internal/strava-ingest', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(ev || {})
        }));
        /* ctx is absent under dev.mjs and the tests, where awaiting is both
           possible and what you want — the assertion runs on the next line. */
        if (ctx && ctx.waitUntil) ctx.waitUntil(work); else await work;
        return new Response('ok', { status: 200 });
      }
    }

    return stub.fetch(request);
  }
};
