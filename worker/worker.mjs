/* TRAINING — the log service on Cloudflare
   ────────────────────────────────────────────────────────────────────────────
   Stores which sessions got done and the notes written against them. Nothing
   else. The plan itself is a static file (assets/training-plan.json) served
   from Pages, so this never holds a schedule, a venue or a rota — only ticks
   and prose, keyed by date.

       cd worker
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

import { handleHit, handleVisitors, isSiteAdmin } from './visitors.mjs';
import '../assets/scrub-media.js';   // sets globalThis.ScrubMedia

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

/* The two boards, and the only values `source` may take on a board tick. */
const BOARDS = new Set(['kilter', 'tension']);

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
  'access-control-allow-headers': 'content-type,authorization,x-admin-session',
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
    /* GitHub, for the doorbell on /movies/_pull. Absent on a deploy that has
       never been given a token, which is fine: the route then says so instead
       of throwing, and the scheduled run picks the film up anyway. The repo is
       a var and not a secret — a public repository's name is not a credential
       — but the token is a secret and must never appear in this file. */
    this.gh = {
      token: env.GH_TOKEN || '',
      repo: env.GH_REPO || 'ric-massey/ric-relay',
      event: 'entertainment'
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
    /* A second count for events about runs already stored, and when each was
       last looked up. Forged events for made-up ids fill `hooks`; they must
       not also stop a delete or an "Only You" on a real run from landing. */
    this.knownHooks = [];
    this.lookedAt = new Map();
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
     the same five minutes for the owner — the right password is refused too,
     because a throttle that waves it through tells the guesser which guess
     was right. See the note above authed() in fetch(). The right trade for a
     page that ticks boxes. */
  throttled() {
    const now = Date.now(), WINDOW = 5 * 60 * 1000, LIMIT = 10;
    this.fails = this.fails.filter(t => now - t < WINDOW);
    return this.fails.length >= LIMIT;
  }
  noteFail() { this.fails.push(Date.now()); }

  /* One more edit the poster job has not seen. Counted rather than flagged so
     that clearing it can never swallow a write that arrived while GitHub was
     being asked about the one before. */
  async bumpMovies() {
    await this.state.storage.put('gh:seq', ((await this.state.storage.get('gh:seq')) || 0) + 1);
  }

  /* ══ THE DOORBELL ════════════════════════════════════════════════════════
     Tell GitHub that the movie list has something new, so the job that fetches
     posters runs now instead of at the top of the next three-hour slot.

     Two things keep this from being noisy. First, it only rings if an item has
     actually changed since the last successful ring — signing in on a quiet
     day rings nothing. Second, GitHub coalesces the rest: the workflow's
     concurrency group holds one run and one waiting run, and a new ring
     replaces the waiting one. So ticking off ten films fires ten of these and
     still produces one pull, which reads every change at once anyway.

     `at` is only written when GitHub accepted the ring. A failed ring must
     stay unrecorded, or one 500 would mean those edits were never asked for
     again — the three-hour clock would still get them, but hours late and for
     no reason. */
  async ringGitHub() {
    if (!this.gh.token) return { ok: true, rang: false, why: 'no GitHub token here' };

    /* `gh:seq` counts writes to the list; `gh:movies` remembers the count we
       last got GitHub to act on. Comparing counts and not timestamps is
       deliberate: two edits can land in the same millisecond, and an ISO string
       cannot tell them apart, so the second one would be read as "already
       asked" and wait three hours for no reason.

       It also makes the obvious race safe. An edit that arrives while the
       fetch below is in flight bumps the counter past the value being stored,
       so the next ring sees a difference and rings. Nothing is lost by
       recording a number we have already read. */
    const seq = (await this.state.storage.get('gh:seq')) || 0;
    const last = (await this.state.storage.get('gh:movies')) || {};
    if (!seq) return { ok: true, rang: false, why: 'nothing here yet' };
    if (last.seq === seq) return { ok: true, rang: false, why: 'already asked' };

    let r;
    try {
      r = await this.fetch_(`https://api.github.com/repos/${this.gh.repo}/dispatches`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer ' + this.gh.token,
          accept: 'application/vnd.github+json',
          'content-type': 'application/json',
          /* GitHub refuses a request with no user-agent. */
          'user-agent': 'ricmassey-training-log'
        },
        body: JSON.stringify({ event_type: this.gh.event })
      });
    } catch (e) {
      return { ok: false, rang: false, why: 'could not reach GitHub' };
    }

    if (!r.ok) {
      /* GitHub's own words are worth passing on — "Resource not accessible by
         personal access token" is the difference between a broken deploy and a
         token missing one checkbox. This route is behind the log token, so the
         only person reading it is Ric. */
      const said = await r.text().catch(() => '');
      let why = `GitHub said ${r.status}`;
      try { const m = JSON.parse(said).message; if (m) why += ': ' + m; } catch (e) {}
      return { ok: false, rang: false, why };
    }

    await this.state.storage.put('gh:movies', { seq, rang: new Date().toISOString() });
    return { ok: true, rang: true, edits: seq - (last.seq || 0) };
  }

  /* ══ STRAVA ══════════════════════════════════════════════════════════════
     A run finishes, the watch syncs, Strava POSTs here, and the session on the
     plan for that date ticks itself off. Nobody opens the site.

     The event Strava sends is only ever {aspect_type, object_id, owner_id} —
     no distance, no date, no sport. So every one of those three facts is read
     from the API afterwards, with Ric's own token, and NOT from the webhook
     body. That is what makes a forged POST at this endpoint harmless: the only
     thing an attacker controls is which activity id gets looked up, and the
     token only ever returns activities belonging to the person who issued it.

     A DELETE event is held to the same rule. It used to be believed on the
     strength of `owner_id`, which is Ric's athlete id and is in his public
     Strava profile URL, while the activity id is in this Worker's own public
     `/strava` feed — so anybody could un-tick a run and wipe it off the log
     with one unauthenticated POST (found 2026-09-24). Now a delete is looked
     up like everything else: the run goes only when the API says the activity
     is gone. A forged delete for a run that still exists changes nothing. */

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
    const { raw } = await this.lookup(id);
    return raw;
  }

  /* The API's answer about one activity, with the status kept, because a
     delete has to tell "gone" (404) apart from "could not ask" (no token,
     rate-limited, Strava down). Only the first of those is grounds to forget
     a run. */
  async lookup(id) {
    const token = await this.accessToken();
    if (!token) return { status: 0, raw: null };
    const r = await this.fetch_('https://www.strava.com/api/v3/activities/' + id, {
      headers: { authorization: 'Bearer ' + token }
    });
    if (!r.ok) return { status: r.status, raw: null };
    return { status: r.status, raw: await r.json() };
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

    /* The guard exists to catch a FIELD that should not be here, so it reads
       everything except the route's own encoded blob. That blob is a thousand
       characters drawn from an alphabet that includes every lowercase letter,
       so sooner or later one will contain "latlng" or "address" by pure chance
       — and the guard's response is to throw the whole activity away. A run
       silently vanishing once a decade for a coincidence in a coordinate
       encoding is a worse bug than the one that would be caught, especially now
       that the route is a thing we mean to publish. */
    const { route, ...rest } = out;
    if (LEAKY.test(JSON.stringify(rest))) {
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
    /* A run whose date was corrected on Strava leaves its old day, or the old
       copy stays public on it through every later "Only You" or delete. */
    const was = await this.state.storage.get('sa:' + a.id);
    let moved = null;
    if (was && was !== date) {
      moved = ((await this.state.storage.get('s:' + was)) || []).find(x => String(x.id) === String(a.id));
      await this.forget(a.id);
    }
    const list = (await this.state.storage.get('s:' + date)) || [];
    const prior = list.find(x => String(x.id) === String(a.id)) || moved;
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

  /* `source` is what placed the tick — 'strava' for a run off a watch, 'kilter'
     or 'tension' for a board session. It is stored as the VALUE in `auto` so
     the page can say which, rather than saying "via Strava" over a night on the
     Kilter. Older entries hold `true`, which reads as Strava, because that is
     the only thing that could have written one before boards existed. */
  async tick(date, sessionId, source = 'strava') {
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
      auto: { ...(prev.auto || {}), [sessionId]: source },
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

  /* Two buckets. Events about a run this log already holds get their own,
     and each such run is looked up at most once a minute — so the ids in the
     public feed can't be replayed into a flood either. Everything else shares
     the old 100 per 15 minutes. */
  hookFlood(known, id) {
    const now = Date.now(), WINDOW = 15 * 60 * 1000;
    if (known) {
      if (now - (this.lookedAt.get(id) || 0) < 60 * 1000) return true;
      this.knownHooks = this.knownHooks.filter(t => now - t < WINDOW);
      if (this.knownHooks.length >= 60) return true;
      this.knownHooks.push(now);
      this.lookedAt.set(id, now);
      if (this.lookedAt.size > 500) this.lookedAt.delete(this.lookedAt.keys().next().value);
      return false;
    }
    this.hooks = this.hooks.filter(t => now - t < WINDOW);
    if (this.hooks.length >= 100) return true;
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
      /* The subscription's own id, when configured (STRAVA_SUBSCRIPTION_ID —
         `node strava-setup.mjs status` prints it). It is in no public page,
         so a forged event without it is dropped before it costs anything. */
      const sub = this.env.STRAVA_SUBSCRIPTION_ID;
      if (sub && String(ev.subscription_id) !== String(sub)) return;

      const known = !!(await this.state.storage.get('sa:' + id));
      /* Nothing stored under this id means nothing to forget, and no reason
         to spend an API call finding out — nor to count it: the flood guard
         counts only events that cost one. */
      if (ev.aspect_type === 'delete' && !known) return;
      if (this.hookFlood(known, id)) { console.error('strava: webhook flood, dropping'); return; }

      if (ev.aspect_type === 'delete') {
        /* Believed only once the API says the activity is gone. "Still there"
           is a forged event; "could not ask" keeps the run, and Strava will
           retry a real delete three times before giving up on it. */
        const { status } = await this.lookup(id);
        if (status === 404) return await this.forget(id);
        return;
      }

      await this.refresh(id, (await this.lookup(id)).raw);
      await this.keepChecking();
    } catch (e) {
      console.error('strava: ingest failed', e && e.message);
    }
  }

  /* One activity, as the API answers it now, stored the way the rules say. */
  async refresh(id, raw) {
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
  }

  /* ── the re-check ──
     A webhook is the only thing that ever re-read a run, and some changes
     send none: Everyone → Followers flips nothing an update event reports,
     and an event whose lookup failed once was gone for good. So every six
     hours the runs of the last three weeks are asked about again — a
     run Ric has since hidden loses its name and route, and one he deleted
     goes. A few dozen API calls a day at most. */
  async keepChecking() {
    const st = this.state.storage;
    if (typeof st.getAlarm !== 'function') return;
    if (!(await st.getAlarm())) await st.setAlarm(Date.now() + RECHECK_MS);
  }

  async alarm() {
    try {
      const ids = [];
      for (let d = 0; d < RECHECK_DAYS && ids.length < RECHECK_MAX; d++) {
        const date = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
        for (const a of (await this.state.storage.get('s:' + date)) || []) {
          if (ids.length < RECHECK_MAX) ids.push(String(a.id));
        }
      }
      for (const id of ids) {
        const { status, raw } = await this.lookup(id);
        if (status === 404) await this.forget(id);
        else if (raw) await this.refresh(id, raw);
        else if (status === 429) break;          // Strava's limit — next time
      }
    } catch (e) {
      console.error('strava: re-check failed', e && e.message);
    }
    await this.state.storage.setAlarm(Date.now() + RECHECK_MS);
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

       WHILE THE LIMIT IS TRIPPED, NO CREDENTIAL IS EXAMINED AT ALL. Not a
       password on /auth, not a bearer on a read, not a bearer on a write. The
       first version of this checked the credential before the throttle so
       that the owner could never be locked out, and that made the throttle
       decorative: after ten misses a wrong guess got 429 and the right guess
       still got 200, so a guesser lost nothing and gained a clean yes-or-no
       on every attempt. A throttle that lets the correct password through is
       an oracle with a delay on it. (Found 2026-09-24; the test below it used
       to assert the bug as the rule.)

       The cost is real and accepted: anybody can keep Ric out of his own
       ticks for five minutes at a time by hammering /auth with rubbish. That
       is a nuisance. The alternative was a password that could be searched at
       full speed by anyone who had noticed the status code. A request that
       carries no credential is not touched by any of this — the public view
       never counted toward the limit and still does not — and a lockout is
       always a 429 that says so, never a 200 with the owner's own notes
       quietly stripped out of it. */
    const authed = () => {
      const given = bearer();
      if (!given) return false;
      if (this.token && sameSecret(given, this.token)) return true;
      this.noteFail();
      return false;
    };
    const lockout = () => json({ error: 'too many attempts — wait five minutes' }, 429, origin,
      { 'retry-after': '300' });
    /* Before any route: a credential presented during a lockout is refused
       unread. This is the whole throttle — everything below it may assume that
       a credential it gets to compare arrived while the door was open. */
    if (bearer() && this.throttled()) return lockout();

    /* ---------- POST /garmin-auth — internal only ----------
       Who is asking for the Garmin export: Ric (LOG_TOKEN, may read and
       write) or the reader token (GARMIN_READ_TOKEN, may only read). The
       outer Worker asks this rather than comparing tokens itself for the same
       reason /media does — a compare out there would be an unthrottled oracle
       for the password /auth rate-limits. PUBLIC_PATHS keeps the internet off
       this path; only the outer Worker can reach it. */
    if (parts[0] === 'garmin-auth') {
      const given = bearer();
      if (given && this.token && sameSecret(given, this.token)) return json({ role: 'owner' }, 200, origin);
      /* A short reader token is treated as unset rather than trusted: this one
         opens health data, and it is typed by hand into two settings pages. */
      const reader = this.env.GARMIN_READ_TOKEN || '';
      if (given && reader.length >= 24 && sameSecret(given, reader)) return json({ role: 'reader' }, 200, origin);
      if (given) this.noteFail();
      return json({ error: 'nope' }, 401, origin);
    }

    /* ---------- POST /auth ----------
       The password IS the token; this endpoint only exists so the page can say
       "wrong password" the moment it is typed rather than silently failing on
       the first tick an hour later. It returns nothing but a yes or a no. */
    if (parts[0] === 'auth') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);
      let body = {};
      try { body = await request.json(); } catch {}
      const given = String(body.password || '');
      /* Throttle first, then correctness. The other order is the oracle
         described above authed(): it only ever slowed down the guesses that
         were wrong. */
      if (this.throttled()) return lockout();
      if (given && this.token && sameSecret(given, this.token)) {
        return json({ ok: true }, 200, origin);
      }
      /* A wrong password is a 401 with no detail — not "too short", not "close",
         nothing that narrows the search. */
      this.noteFail();
      return json({ error: 'nope' }, 401, origin);
    }

    /* ---------- /board ----------
       A board session ticking off the climbing session planned for its date.

       Unlike Strava, nothing pushes: Kilter and Tension have no webhooks, and
       their credentials are an account password, which is not going anywhere
       near Cloudflare. So the Mac polls the boards on a timer and posts the
       DATES it found here — with the log token, because this endpoint can tick
       things and is therefore not for strangers.

       The date is all that arrives. What was climbed is already published in
       board-data.js and the page reads it from there; duplicating it into the
       Worker would be a second copy of the same logbook, free to drift. So this
       route writes nothing but the tick.

       Matching is done here rather than by the caller for the same reason the
       Strava matcher is: the plan lives at a URL the Worker already reads, and
       a client deciding which session it satisfied is a client that can be
       wrong about someone else's plan. */
    if (parts[0] === 'board') {
      if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);
      if (!authed()) return json({ error: 'nope' }, 401, origin);

      const body = await request.json().catch(() => null);
      const days = Array.isArray(body && body.days) ? body.days : null;
      if (!days) return json({ error: 'days must be an array' }, 400, origin);
      const source = BOARDS.has(body.source) ? body.source : null;
      if (!source) return json({ error: 'source must be kilter or tension' }, 400, origin);

      /* Capped so a bad caller cannot walk the whole plan in one request. */
      const ticked = [];
      for (const raw of days.slice(0, 60)) {
        const d = String(raw || '').slice(0, 10);
        if (!DAY.test(d)) continue;
        const day = ((await this.plan()).days || []).find(x => x.date === d);
        const s = day && (day.sessions || []).find(x => x.kind === 'climb');
        if (!s) continue;                     // climbed on a day with nothing planned
        const before = await this.state.storage.get('d:' + d);
        await this.tick(d, s.id, source);
        const after = await this.state.storage.get('d:' + d);
        if (!before || before.updated !== after.updated) ticked.push({ date: d, session: s.id });
      }
      return json({ ok: true, source, ticked }, 200, origin);
    }

    /* ---------- /climb/:date ----------
       Climbing days added from the web, as opposed to the ones built from
       climbs.md. Both end up on the climbing page; these are the ones that can
       be written from a phone at the crag. Public to read, token to write. */
    /* ── /todo ──
       The tick list. It was the last thing on the site still kept by hand: 80
       routes typed into todo.md, which is why the same crag arrives spelled
       PMRP, PMPR and PRMP and why adding a route meant opening an editor.

       Shaped like /climb deliberately — GET for everyone, POST behind the same
       token, `remove: true` to delete — so the client merge is the one
       web-trips.js already does for days, and there is no second idea of how
       writing to this service works.

       The key is a slug of the name rather than a date, because a wish has no
       date. Two routes can share a name at different crags, so the crag is in
       the slug too. */
    if (parts[0] === 'todo') {
      const id = parts[1];

      if (request.method === 'GET') {
        const all = await this.state.storage.list({ prefix: 't:' });
        const out = {};
        for (const [k, v] of all) out[k.slice(2)] = v;
        return json({ items: out }, 200, origin, { 'cache-control': 'public, max-age=30' });
      }

      if (request.method === 'POST') {
        if (!authed()) return json({ error: 'nope' }, 401, origin);

        let body;
        try { body = await request.json(); } catch { return json({ error: 'body must be JSON' }, 400, origin); }

        if (body.remove === true) {
          if (!id) return json({ error: 'POST needs an id to remove' }, 400, origin);
          await this.state.storage.delete('t:' + id);
          return json({ ok: true, removed: id }, 200, origin);
        }

        const name = String(body.name || '').trim().slice(0, 160);
        if (!name) return json({ error: 'a route needs a name' }, 400, origin);

        const crag = String(body.crag || '').trim().slice(0, 120);
        /* Same slug rule on both ends, so saving an edit lands on the row it
           came from instead of quietly creating a second one. */
        const slug = (id || (name + '-' + crag))
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
        if (!slug) return json({ error: 'a route needs a name' }, 400, origin);

        const num = (v, max) => {
          const n = Math.floor(Number(v));
          return Number.isFinite(n) && n > 0 ? Math.min(n, max) : null;
        };
        const existing = await this.state.storage.get('t:' + slug);
        const entry = {
          id: slug,
          name,
          grade: String(body.grade || '').slice(0, 24),
          gradeKind: ['rope', 'boulder', 'other'].includes(body.gradeKind) ? body.gradeKind : null,
          gradeRank: num(body.gradeRank, 999) || 0,
          style: ['Sport', 'Trad', 'Boulder', 'Mixed', 'Aid'].includes(body.style) ? body.style : null,
          crag,
          wall: String(body.wall || '').trim().slice(0, 120),
          pitches: num(body.pitches, 99),
          lengthFt: num(body.lengthFt, 9999),
          note: String(body.note || '').slice(0, 500),
          done: body.done === true,
          /* Set once, when it is first ticked — re-saving a done route must not
             move the date it was done on. */
          tickDate: body.done === true
            ? (String(body.tickDate || '').slice(0, 10) || (existing && existing.tickDate) ||
               new Date().toISOString().slice(0, 10))
            : null,
          result: ['onsight', 'flash', 'redpoint', 'sent'].includes(body.result) ? body.result : null,
          added: (existing && existing.added) || new Date().toISOString(),
          source: 'web',
          updated: new Date().toISOString()
        };
        await this.state.storage.put('t:' + slug, entry);
        return json({ ok: true, item: entry }, 200, origin);
      }

      return json({ error: 'method not allowed' }, 405, origin);
    }

    /* ── /movies ──
       The Entertainment room's list. Same shape as /todo above, for the same
       reason /todo was shaped like /climb: GET for everyone, POST behind the
       token, and the client merge is the one every other page already does.
       A wish has no date here either, so the key is a slug of the title.

       The committed entertainment-data.js is the archive; this holds everything
       added or moved since. A REMOVAL is stored as a tombstone rather than a
       delete, because the committed file underneath would otherwise put the row
       back on the very next load — the one way this differs from /todo, and
       only because it has a file under it that /todo does not. */
    if (parts[0] === 'movies') {
      const id = parts[1];

      /* ── POST /movies/_pull — the doorbell ──
         Adding a film here is instant, but the poster, the year and the
         director are not: those come from a Python script that talks to TMDB
         and commits files into the repo, and neither of those is something a
         web page can do. A scheduled job on GitHub does it every three hours.

         This is how the page skips the wait. It cannot ring GitHub itself —
         that would mean a token with write access to the repo sitting in a
         public web page — but this end can, because a Worker secret is not
         readable by anyone who loads the site.

         `_pull` and not `pull`: a film called Pull would slug to `pull` and
         quietly take this route over. Reserved ids start with an underscore
         and no title can ever slug into one, which is the same rule `_people`
         already relies on. */
      if (id === '_pull') {
        if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);
        if (!authed()) return json({ error: 'nope' }, 401, origin);
        return json(await this.ringGitHub(), 200, origin);
      }

      if (request.method === 'GET') {
        const all = await this.state.storage.list({ prefix: 'm:' });
        const out = {};
        for (const [k, v] of all) out[k.slice(2)] = v;
        return json({ items: out }, 200, origin, { 'cache-control': 'public, max-age=30' });
      }

      if (request.method === 'POST') {
        if (!authed()) return json({ error: 'nope' }, 401, origin);

        let body;
        try { body = await request.json(); } catch { return json({ error: 'body must be JSON' }, 400, origin); }

        /* ── reserved records ──
           `_people` is the room's list of favourite actors. It is not a film
           and has no title, so the film shaping below rejected it outright —
           which meant starring an actor got a 400, fell back to localStorage,
           and never followed Ric to another device. It looked like it worked,
           because the page shows the local layer.

           Two reasons it belongs here rather than in a route of its own: the
           page already has exactly one write path worth having, and the slug
           rule below would turn `_people` into `people` and file a list of
           actors on the list of films as a title called People.

           Stored as given, because the shape is the page's business and this
           end only refuses nonsense: an object, bounded, owner-only. It is
           NOT a film, so it never bumps the poster counter — the pull script
           skips reserved ids, so ringing GitHub about one would spend a run
           finding nothing. */
        if (/^_[a-z0-9-]{1,40}$/.test(String(id || ''))) {
          if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return json({ error: 'a reserved record must be an object' }, 400, origin);
          }
          const clean = {};
          for (const [k, v] of Object.entries(body)) {
            if (k === 'id' || k === 'source' || k === 'updated') continue;
            clean[k] = v;
          }
          if (JSON.stringify(clean).length > 8000) {
            return json({ error: 'that record is too big' }, 413, origin);
          }
          const rec = { id, ...clean, source: 'web', updated: new Date().toISOString() };
          await this.state.storage.put('m:' + id, rec);
          return json({ ok: true, item: rec }, 200, origin);
        }

        /* Same slug rule as the page uses, so saving an edit lands on the row it
           came from instead of quietly creating a second one. */
        const slug = String(id || body.title || '')
          .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120);
        if (!slug) return json({ error: 'a title is needed' }, 400, origin);

        const existing = await this.state.storage.get('m:' + slug);

        if (body.removed === true) {
          /* Tombstone, not a delete. See the note above. */
          await this.state.storage.put('m:' + slug, {
            id: slug, removed: true, updated: new Date().toISOString()
          });
          await this.bumpMovies();
          return json({ ok: true, removed: slug }, 200, origin);
        }

        const title = String(body.title || (existing && existing.title) || '').trim().slice(0, 200);
        if (!title) return json({ error: 'a title is needed' }, 400, origin);

        /* ── a patch, not a replacement ──
           This used to rebuild the whole entry from the body every time, which
           dropped everything it had no field for and re-defaulted everything
           the caller did not resend. Both halves of that were wrong, and the
           second is the dangerous one: this record is merged onto the committed
           row by pull-entertainment.py, so a defaulted `where` is not an empty
           string arriving, it is a real one leaving.

           So: start from what is already stored, apply only the keys the caller
           actually sent, and clamp the ones whose shape is known. Everything
           else rides along untouched — `seen`, `wd`, `tmdb`, `year`, `genres`
           and the rest of FIELDS in the pull script, which is the authority on
           what they mean. This end is not, and should not start guessing.

           Whoever adds a field to the page gets it stored here for free. That
           is deliberate: the alternative is a list to forget to update, and
           forgetting it loses data silently, which is the failure this room has
           already had three times in the data file. */
        const has = k => Object.prototype.hasOwnProperty.call(body, k);
        const entry = { ...(existing || {}) };

        for (const [k, v] of Object.entries(body)) {
          if (k === 'id' || k === 'source' || k === 'updated' || k === 'added') continue;
          entry[k] = v;
        }

        entry.id = slug;
        entry.title = title;
        /* A save that is not a removal brings the film back. The tombstone
           used to survive every later write, so a film removed by mistake
           could never be added again — "Added" on screen, and gone. */
        delete entry.removed;
        /* Only if it was actually sent. A default here is not a tidy fallback,
           it is an answer this end does not have: the film may well be one of
           the 363 in the committed file that this service has never seen, and
           writing `watchlist` onto it would move a film Ric watched years ago
           back onto the queue. Absent means "no opinion", and the merge in
           pull-entertainment.py leaves the committed value alone. */
        if (has('status')) entry.status = body.status === 'watched' ? 'watched' : 'watchlist';
        if (has('where')) entry.where = String(body.where || '').trim().slice(0, 60);
        if (has('note')) entry.note = String(body.note || '').slice(0, 300);
        if (has('pick')) entry.pick = body.pick === true;
        if (has('series')) entry.series = body.series === true;
        if (has('count')) {
          const n = Math.floor(Number(body.count));
          entry.count = Number.isFinite(n) && n > 1 ? Math.min(n, 99) : null;
        }
        entry.added = (existing && existing.added) || new Date().toISOString();
        entry.source = 'web';
        entry.updated = new Date().toISOString();

        /* One film is not a megabyte. A cap here is not about storage, it is
           about this being the one write path a mistake in the page can point
           at the service. */
        if (JSON.stringify(entry).length > 12000) {
          return json({ error: 'that is too much for one title' }, 413, origin);
        }

        await this.state.storage.put('m:' + slug, entry);
        await this.bumpMovies();
        return json({ ok: true, item: entry }, 200, origin);
      }

      return json({ error: 'method not allowed' }, 405, origin);
    }

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

        /* `md` is the record and the routes are its reading.
           add.html composes the same markdown block it would have written into
           climbs.md by hand and parses THAT with climb-parse.js, which is the
           browser port of the parser build-data.py uses. So a day logged from a
           phone is not a lesser shape of a day logged in the file — it is the
           same block of markdown, read by the same rules, and the pages can't
           tell the two apart. Storing the routes as well is a convenience for
           readers that don't want to parse (the training page only counts
           them); storing the markdown is what makes it re-readable when the
           parser learns something new.

           The route fields are clamped, not computed. Working out whether a
           line was a flash is the parser's job, done once, on the client that
           has the vocabulary; this end only refuses nonsense. */
        const num = (v, max) => {
          const n = Math.floor(Number(v));
          return Number.isFinite(n) && n > 0 ? Math.min(n, max) : null;
        };
        const STYLES = ['onsight', 'flash', 'redpoint', 'free solo', 'top rope', 'trad', 'mixed', 'aid'];
        const entry = {
          date,
          area: String(body.area || '').slice(0, 120),
          region: String(body.region || '').slice(0, 120),
          notes: String(body.notes || '').slice(0, 2000),
          people: String(body.people || '').slice(0, 200),
          md: String(body.md || '').slice(0, 8000),
          pitches: num(body.pitches, 99),
          boulders: num(body.boulders, 99),
          routes: Array.isArray(body.routes) ? body.routes.slice(0, 200).map(r => ({
            name: String(r.name || '').slice(0, 160),
            grade: String(r.grade || '').slice(0, 24),
            gradeKind: ['rope', 'boulder', 'other'].includes(r.gradeKind) ? r.gradeKind : null,
            gradeRank: num(r.gradeRank, 999) || 0,
            styles: Array.isArray(r.styles)
              ? r.styles.filter(s => STYLES.includes(s)).slice(0, 4) : [],
            outcome: ['sent', 'attempt'].includes(r.outcome) ? r.outcome : 'sent',
            repeats: num(r.repeats, 99) || 1,
            star: r.star === true,
            note: r.note ? String(r.note).slice(0, 200) : null,
            wall: String(r.wall || '').slice(0, 120)
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

    /* ---------- /medialabel/:date/:id ----------
       Which route a photo is of, set after it went up.

       In here rather than on the R2 object, and that is the whole design. R2
       has no metadata-only write: changing a customMetadata field means putting
       the object again, which for a 74MB send clip means streaming 74MB back
       through the Worker to fix a spelling — and a put that fails halfway is a
       video Ric cannot re-shoot. A label is a few dozen bytes and belongs
       somewhere it can be rewritten for free. The upload still stamps what it
       knew at the time; this wins where both exist, because it is the later
       word and the only one that can be corrected.

       Not in PUBLIC_PATHS, so nothing outside can reach it — the Worker checks
       the owner and then calls in here, the same way /media does for auth. */
    if (parts[0] === 'medialabel') {
      if (request.method === 'GET') {
        const all = await this.state.storage.list({ prefix: 'ml:' });
        const labels = {};
        for (const [k, v] of all) labels[k.slice(3)] = v;
        return json({ labels }, 200, origin);
      }
      if (request.method === 'POST') {
        const id = parts[2];
        if (!date || !id) return json({ error: 'POST needs /medialabel/YYYY-MM-DD/<id>' }, 400, origin);
        let body = {};
        try { body = await request.json(); } catch {}
        const key = 'ml:' + date + '/' + id;
        /* Clearing both fields removes the record rather than storing two empty
           strings, so an unlabelled photo reads the same whether it was never
           labelled or the label was taken off again. */
        const route = String(body.route || '').slice(0, 160).trim();
        const caption = String(body.caption || '').slice(0, 400).trim();
        if (!route && !caption) {
          await this.state.storage.delete(key);
          return json({ ok: true, cleared: true }, 200, origin);
        }
        const label = { route, caption, at: new Date().toISOString() };
        await this.state.storage.put(key, label);
        return json({ ok: true, ...label }, 200, origin);
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
        /* `addNote` adds one, merged by id onto what is stored — the page's
           way now, because a whole list from a page holding a stale or
           public-only copy deleted the notes it did not have. A full `notes`
           array still replaces, for writes queued before the change. */
        notes: Array.isArray(body.notes) ? body.notes.slice(0, 50).map(cleanNote)
          : body.addNote && typeof body.addNote === 'object'
            ? (() => { const n = cleanNote(body.addNote); return [...(prev.notes || []).filter(x => x.id !== n.id), n].slice(-50); })()
            : (prev.notes || []),
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

/* ── /media — photos and video, kept in R2 rather than in git ──
   A clip of a send is 40MB and permanent. The repo is already half a gigabyte
   and Pages caps a site at about one, so video in git is a bill that only ever
   grows and never comes back out. R2 takes the bytes instead: same Cloudflare
   account as this Worker, and — the reason it is R2 and not any other bucket —
   no egress charge, so a video being watched costs nothing.

   ── why the index is the bucket ──
   There is no separate table of what exists. The listing IS an R2 list, and a
   record's fields ride along in the object's own customMetadata. A DO table
   would be the more familiar shape and it would be wrong: two stores means two
   ways to disagree, and both of them show up as a thumbnail that plays nothing
   or a file nobody can find. One store cannot drift from itself.

   customMetadata is carried as HTTP headers, so it is ASCII-only — a caption
   with a curly apostrophe in it (and the board logbook is full of them) would
   be rejected raw. Hence one `meta` field, percent-encoded JSON. */
const MEDIA_PREFIX = 'climb/';
/* The Workers free plan refuses a request body over 100MB, so that is the cap
   for anything sent in one go — every photo, and every clip small enough to go
   in one piece. */
const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
/* A video can be bigger, because it goes up in pieces (R2 multipart,
   mediaInPieces below): each piece is one request well inside the 100MB, and
   R2 joins them. The cap on the whole is about the phone, not Cloudflare — the
   page reads the clip into memory once to scrub where it was shot, and a
   gigabyte is about what a phone's browser tab will hold without being killed. */
const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
const MEDIA_PART_BYTES = 50 * 1024 * 1024;
const MEDIA_MAX_PARTS = Math.ceil(MAX_VIDEO_BYTES / MEDIA_PART_BYTES);
const cleanNote = n => ({
  id: String(n.id || crypto.randomUUID()).slice(0, 64),
  text: String(n.text || '').slice(0, 4000),
  public: n.public !== false,
  at: String(n.at || new Date().toISOString()).slice(0, 32)
});
/* The Strava re-check: how often, how far back, how many lookups at most. */
const RECHECK_MS = 6 * 60 * 60 * 1000;
const RECHECK_DAYS = 21;
const RECHECK_MAX = 30;
/* The Garmin export. Years of days and activities come to a few megabytes; the
   cap is only there so a runaway script cannot fill the bucket. */
const GARMIN_KEY = 'garmin/export.json';
const GARMIN_SESSION_KEY = 'garmin/session.json';
const MAX_GARMIN_BYTES = 50 * 1024 * 1024;
/* An allowlist, and it decides the extension too — the filename is whatever the
   phone called it and is not trusted to name the format. */
const MEDIA_TYPES = {
  'image/jpeg': ['jpg', 'photo'], 'image/png': ['png', 'photo'],
  'image/webp': ['webp', 'photo'], 'image/gif': ['gif', 'photo'],
  'image/heic': ['heic', 'photo'], 'image/heif': ['heif', 'photo'],
  'video/mp4': ['mp4', 'video'], 'video/quicktime': ['mov', 'video'],
  'video/webm': ['webm', 'video'], 'video/x-m4v': ['m4v', 'video']
};

const mediaId = () => [...crypto.getRandomValues(new Uint8Array(8))]
  .map(b => b.toString(16).padStart(2, '0')).join('');

/* One record, rebuilt from the object rather than stored twice. `key` is what
   the delete takes and `path` is what an <img> or <video> points at.

   A path and not a whole URL, deliberately. The page already knows the host it
   is talking to — it is the same constant every other call uses — and building
   the URL here would mean this Worker guessing at its own public name, which it
   gets wrong the moment it is reached through anything but its canonical
   address. Under dev.mjs that address is `https://local`, which no browser can
   fetch: an absolute src would have looked fine in every test and been broken
   in the only place it mattered. */
function mediaRecord(obj) {
  let meta = {};
  try { meta = JSON.parse(decodeURIComponent((obj.customMetadata || {}).meta || '%7B%7D')); } catch {}
  const key = obj.key;
  return {
    id: meta.id || key.split('/').pop().split('.')[0],
    date: key.slice(MEDIA_PREFIX.length).split('/')[0],
    key,
    path: '/media/file/' + key.slice(MEDIA_PREFIX.length),
    kind: meta.kind === 'video' ? 'video' : 'photo',
    name: meta.name || '',
    route: meta.route || '',
    caption: meta.caption || '',
    type: obj.httpMetadata && obj.httpMetadata.contentType || meta.type || '',
    size: obj.size || 0,
    at: meta.at || (obj.uploaded && new Date(obj.uploaded).toISOString()) || null
  };
}

/* ---------- POST /media/<date>?up=start|part|done|abort — a video in pieces ----------
   start  content-type and ?size= say what is coming; answers {key, uploadId, partSize}
   part   ?key&id&n=1… with up to partSize bytes; answers {partNumber, etag}
   done   ?key&id with {parts:[{partNumber, etag}]}; answers the record, as one upload does
   abort  ?key&id; throws the pieces away

   The record's fields are fixed at start, on the multipart upload itself, so
   the finished object carries them exactly as a one-shot upload would and the
   listing cannot tell the two apart. A start that is never finished leaves no
   object at all — R2 lists only completed uploads, and drops abandoned pieces
   by itself after a week. */
async function mediaInPieces(request, env, url, date, origin) {
  const q = url.searchParams;
  const step = q.get('up');

  if (step === 'start') {
    const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const known = MEDIA_TYPES[type];
    if (!known || known[1] !== 'video') {
      return json({ error: 'only a video goes up in pieces', type }, 415, origin);
    }
    const size = Number(q.get('size') || 0);
    if (!(size > 0)) return json({ error: 'say how big it is: ?size=<bytes>' }, 400, origin);
    if (size > MAX_VIDEO_BYTES) {
      return json({ error: `too big — ${Math.round(size / 1048576)}MB, and the limit is ${MAX_VIDEO_BYTES / 1048576}MB` }, 413, origin);
    }
    const [ext, kind] = known;
    const id = mediaId();
    const meta = {
      id, kind, type,
      name: (q.get('name') || '').slice(0, 160),
      route: (q.get('route') || '').slice(0, 160),
      caption: (q.get('caption') || '').slice(0, 400),
      at: new Date().toISOString()
    };
    const key = `${MEDIA_PREFIX}${date}/${id}.${ext}`;
    const mpu = await env.MEDIA.createMultipartUpload(key, {
      httpMetadata: { contentType: type },
      customMetadata: { meta: encodeURIComponent(JSON.stringify(meta)) }
    });
    return json({ key, uploadId: mpu.uploadId, partSize: MEDIA_PART_BYTES }, 200, origin);
  }

  /* Every later step names the object it is adding to, and it has to be one
     start could have made, on this date. The owner's token is the real gate,
     but a key read off the query string is not then free to land anywhere in
     the bucket — the CS replays live in it too. */
  const key = q.get('key') || '';
  const uploadId = q.get('id') || '';
  const shape = new RegExp(`^${MEDIA_PREFIX}${date}/[0-9a-f]{16}\\.(mp4|mov|webm|m4v)$`);
  if (!shape.test(key) || !uploadId) return json({ error: 'which upload? ?key=…&id=…' }, 400, origin);
  const mpu = env.MEDIA.resumeMultipartUpload(key, uploadId);

  if (step === 'part') {
    const n = Number(q.get('n'));
    if (!Number.isInteger(n) || n < 1 || n > MEDIA_MAX_PARTS) {
      return json({ error: `piece number must be 1 to ${MEDIA_MAX_PARTS}` }, 400, origin);
    }
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > MEDIA_PART_BYTES) return json({ error: 'that piece is too big' }, 413, origin);
    if (!request.body) return json({ error: 'no bytes in the body' }, 400, origin);
    try {
      const part = await mpu.uploadPart(n, request.body);
      return json({ partNumber: part.partNumber, etag: part.etag }, 200, origin);
    } catch (e) {
      return json({ error: 'that piece did not go — try it again' }, 502, origin);
    }
  }

  if (step === 'done') {
    let body = {};
    try { body = await request.json(); } catch {}
    const parts = Array.isArray(body.parts)
      ? body.parts.map(p => ({ partNumber: Number(p && p.partNumber), etag: String((p && p.etag) || '') }))
      : [];
    if (!parts.length || parts.length > MEDIA_MAX_PARTS ||
        parts.some(p => !Number.isInteger(p.partNumber) || !p.etag)) {
      return json({ error: 'send {"parts":[{"partNumber":1,"etag":"…"}, …]}' }, 400, origin);
    }
    let obj;
    try { obj = await mpu.complete(parts); }
    catch (e) { return json({ error: 'the pieces did not join — send it again' }, 502, origin); }
    if (obj.size > MAX_VIDEO_BYTES) {
      await env.MEDIA.delete(key);
      return json({ error: 'too big' }, 413, origin);
    }
    /* Field by field: an R2Object's fields are not all its own, and a spread
       would quietly drop the ones that are not. */
    const head = (obj.customMetadata && obj.customMetadata.meta) ? obj : ((await env.MEDIA.head(key)) || obj);
    return json({ ok: true, ...mediaRecord({
      key, size: obj.size, uploaded: obj.uploaded,
      httpMetadata: head.httpMetadata, customMetadata: head.customMetadata
    }) }, 200, origin);
  }

  if (step === 'abort') {
    try { await mpu.abort(); } catch (e) { /* already gone is the same answer */ }
    return json({ ok: true }, 200, origin);
  }

  return json({ error: 'up must be start, part, done or abort' }, 400, origin);
}

/* ── /trials — ClinicalTrials.gov, passed through ──
   The Studies page in the Psyche room searches the ClinicalTrials.gov API v2.
   That API is public and keyless, and the page calls it directly if this route
   is down — so this is a convenience, not a gate. It exists for two reasons:
   the API has been known to refuse requests it decides look automated, and a
   search repeated within a few minutes (the back button, a second phone, the
   front door checking the watchlist) should not go to the NLM twice.

   Only the parameters the page actually sends are passed on, each capped in
   length. Anything else on the query string is dropped rather than forwarded,
   so this is not an open proxy onto the rest of clinicaltrials.gov. */
const CTGOV = 'https://clinicaltrials.gov/api/v2';
const NCT = /^NCT\d{8}$/;
const TRIAL_PARAMS = ['query.term', 'query.cond', 'query.intr', 'query.titles', 'query.spons',
  'query.locn', 'filter.overallStatus', 'filter.ids', 'filter.advanced', 'aggFilters', 'sort',
  'pageSize', 'pageToken', 'countTotal', 'fields'];
const TRIAL_TTL_S = 300;                      // "a few minutes"
const TRIAL_MEMO_MAX = 200;
/* Per-isolate memory in front of the Cache API: free, and the only cache the
   tests and dev.mjs have. caches.default sits behind it in production, which is
   what carries a hit across isolates in the same colo. */
const trialMemo = new Map();

function trialUpstream(parts, params) {
  if (parts[1] === 'study') {
    const id = String(parts[2] || '').toUpperCase();
    if (!NCT.test(id) || parts[3]) return null;
    const out = new URLSearchParams();
    const f = params.get('fields');
    if (f) out.set('fields', f.slice(0, 2000));
    const qs = out.toString();
    return `${CTGOV}/studies/${id}${qs ? '?' + qs : ''}`;
  }
  if (parts[1] === 'search' && !parts[2]) {
    const out = new URLSearchParams();
    for (const k of TRIAL_PARAMS) {
      const v = params.get(k);
      if (v == null || v === '') continue;
      out.set(k, v.slice(0, k === 'filter.ids' ? 2000 : 1000));
    }
    const size = Math.floor(Number(out.get('pageSize')) || 20);
    out.set('pageSize', String(Math.min(Math.max(size, 1), 100)));
    /* Sorted so the same search spelled in a different order is one cache entry. */
    out.sort();
    return `${CTGOV}/studies?${out}`;
  }
  return null;
}

async function trialsProxy(request, env, ctx, parts, url) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, origin);
  const upstream = trialUpstream(parts, url.searchParams);
  if (!upstream) return json({ error: 'not found' }, 404, origin);

  const reply = (body, status, hit) => new Response(body, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? `public, max-age=${TRIAL_TTL_S}` : 'no-store',
      'x-trials-cache': hit,
      ...cors(origin)
    }
  });

  const memo = trialMemo.get(upstream);
  if (memo && memo.until > Date.now()) return reply(memo.body, 200, 'hit');
  if (memo) trialMemo.delete(upstream);

  const edge = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const key = new Request(upstream);
  if (edge) {
    const c = await edge.match(key).catch(() => null);
    if (c) return reply(await c.text(), 200, 'hit');
  }

  const get = env.FETCH || ((...a) => fetch(...a));
  let r;
  try {
    r = await get(upstream, {
      headers: { accept: 'application/json', 'user-agent': 'ricmassey.com studies search (+https://ricmassey.com)' },
      ...(typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(12000) } : {})
    });
  } catch (e) {
    return json({ error: 'could not reach ClinicalTrials.gov' }, 502, origin);
  }
  const body = await r.text();
  if (!r.ok) {
    /* Passed on as it came, so a bad filter reads as the API's own words on
       the page rather than as a generic failure here. Never cached. */
    const status = r.status === 404 ? 404 : r.status >= 500 ? 502 : r.status;
    return reply(body.slice(0, 4000) || JSON.stringify({ error: 'upstream ' + r.status }), status, 'miss');
  }

  if (trialMemo.size >= TRIAL_MEMO_MAX) trialMemo.delete(trialMemo.keys().next().value);
  trialMemo.set(upstream, { body, until: Date.now() + TRIAL_TTL_S * 1000 });
  if (edge) {
    const put = edge.put(key, new Response(body, {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${TRIAL_TTL_S}` }
    })).catch(() => {});
    if (ctx && ctx.waitUntil) ctx.waitUntil(put);
  }
  return reply(body, 200, 'miss');
}

/* ── /wx — the weather room's providers, passed through ──
   weather.html asks Open-Meteo, the National Weather Service and Iowa State's
   radar archive. All three are public and keyless, and the page calls them
   directly if this route is down — so, like /trials, this is a cache and a
   shield rather than a gate. What it buys: one request per place per few
   minutes instead of one per visitor, a User-Agent the NWS asks callers to
   send (a browser cannot set one), and a single place to rate-limit later.

   Only the request shapes the page makes are forwarded (projects/weather/wx.js,
   ROUTES), and test/wx.test.mjs holds the two to each other. Coordinates must
   already be rounded to two decimals — about a kilometre — so a cache key is
   never somebody's doorstep, and nothing here logs or stores one. */
const WX_OM = 'https://api.open-meteo.com/v1/forecast';
const WX_GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const WX_NWS = 'https://api.weather.gov';
const WX_RADAR = 'https://mesonet.agron.iastate.edu/data/gis/images/4326/USCOMP/n0q_0.json';
const WX_DEG = /^-?\d{1,3}(\.\d{1,2})?$/;
const WX_OM_FIELDS = {
  current: 'temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,is_day,precipitation,' +
    'weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
  hourly: 'temperature_2m,apparent_temperature,dew_point_2m,relative_humidity_2m,precipitation_probability,' +
    'precipitation,weather_code,cloud_cover,visibility,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day',
  daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,' +
    'wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset,uv_index_max',
  minutely_15: 'precipitation,snowfall'
};
const WX_NWS_PATHS = [
  /^points\/-?\d{1,2}(\.\d{1,2})?,-?\d{1,3}(\.\d{1,2})?$/,
  /^gridpoints\/[A-Z]{3}\/\d{1,3},\d{1,3}\/(forecast|forecast\/hourly|stations)$/,
  /^stations\/[A-Z0-9]{3,6}\/observations\/latest$/
];
const WX_IEM = 'https://mesonet.agron.iastate.edu';
const WX_SITE_PRODUCTS = ['N0B', 'N0S'];
const WX_SPC = ['day1otlk_cat', 'day1otlk_torn', 'day1otlk_wind', 'day1otlk_hail', 'day2otlk_cat', 'day3otlk_cat'];
/* model name on the page → [Open-Meteo forecast name, Open-Meteo run-time file] */
const WX_MODELS = { hrrr: 'ncep_hrrr_conus', gfs: 'gfs_global', ecmwf: 'ecmwf_ifs025', aifs: 'ecmwf_aifs025_single' };
const WX_META = new Set(['ncep_hrrr_conus', 'ncep_gfs025', 'ecmwf_ifs025', 'ecmwf_aifs025_single']);
const WX_COLUMN = [1000, 975, 950, 925, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100]
  .flatMap(p => ['temperature', 'dew_point', 'relative_humidity', 'wind_speed', 'wind_direction', 'geopotential_height'].map(k => `${k}_${p}hPa`))
  .concat(['surface_pressure', 'temperature_2m', 'dew_point_2m', 'wind_speed_10m', 'wind_direction_10m', 'cape']).join(',');
const WX_MINUTE = /^\d{4}-\d\d-\d\dT\d\d:\d\dZ$/;
/* Seconds each kind of answer may be reused. A point's office never moves;
   an alert can be issued at any minute. */
const WX_TTL = { om: 600, geo: 86400, points: 86400, stations: 86400, forecast: 900, obs: 120, alerts: 60, radar: 60,
  sites: 86400, scans: 60, spc: 300, col: 600, meta: 300, raobsites: 86400, raob: 1800 };
const WX_NATIONAL = 'Tornado Warning,Severe Thunderstorm Warning,Flash Flood Warning,Extreme Wind Warning,Tornado Watch,Severe Thunderstorm Watch';
const WX_MEMO_MAX = 400;
const wxMemo = new Map();

function wxDeg(v, max) {
  if (!WX_DEG.test(v || '')) return null;
  const n = Number(v);
  return Math.abs(n) <= max ? String(n) : null;
}

/* [upstream URL, ttl] for a path the page makes, or null for anything else. */
function wxUpstream(parts, params) {
  const kind = parts[1];
  if (kind === 'om' && !parts[2]) {
    const lat = wxDeg(params.get('lat'), 90), lon = wxDeg(params.get('lon'), 180);
    if (lat === null || lon === null) return null;
    const q = new URLSearchParams({ latitude: lat, longitude: lon, ...WX_OM_FIELDS,
      timezone: 'auto', timeformat: 'unixtime', forecast_days: '10', past_days: '1' });
    return [`${WX_OM}?${q}`, WX_TTL.om];
  }
  if (kind === 'geo' && !parts[2]) {
    const name = String(params.get('name') || '').trim().slice(0, 80);
    if (!name) return null;
    return [`${WX_GEO}?${new URLSearchParams({ name, count: '6', language: 'en', format: 'json' })}`, WX_TTL.geo];
  }
  if (kind === 'radar' && !parts[2]) return [WX_RADAR, WX_TTL.radar];
  if (kind === 'iem' && !parts[3]) {
    const what = parts[2];
    if (what === 'sites') {
      const lat = wxDeg(params.get('lat'), 90), lon = wxDeg(params.get('lon'), 180), start = params.get('start') || '';
      if (lat === null || lon === null || !/^\d{4}-\d\d-\d\dT\d\d:00Z$/.test(start)) return null;
      return [`${WX_IEM}/json/radar.py?operation=available&lat=${lat}&lon=${lon}&start=${start}`, WX_TTL.sites];
    }
    if (what === 'scans') {
      const site = params.get('radar') || '', prod = params.get('product') || '', start = params.get('start') || '', end = params.get('end') || '';
      if (!/^[A-Z]{3}$/.test(site) || !WX_SITE_PRODUCTS.includes(prod) || !WX_MINUTE.test(start) || !WX_MINUTE.test(end)) return null;
      return [`${WX_IEM}/json/radar.py?operation=list&radar=${site}&product=${prod}&start=${start}&end=${end}`, WX_TTL.scans];
    }
    if (what === 'raobsites') return [`${WX_IEM}/geojson/network.py?network=RAOB`, WX_TTL.raobsites];
    if (what === 'hrrrmeta') return [`${WX_IEM}/data/gis/images/4326/hrrr/refd_0000.json`, WX_TTL.meta];
    /* the warnings in force over a replay window — the past does not change */
    if (what === 'sbw') {
      const b = params.get('begints') || '', e = params.get('endts') || '';
      const iso = /^\d{4}-\d\d-\d\dT\d\d:\d\dZ$/;
      if (!iso.test(b) || !iso.test(e) || !(Date.parse(e) > Date.parse(b)) || Date.parse(e) - Date.parse(b) > 12 * 3600e3) return null;
      return [`${WX_IEM}/api/1/vtec/sbw_interval.geojson?begints=${b}&endts=${e}`, Date.parse(e) < Date.now() - 86400e3 ? 86400 * 7 : WX_TTL.alerts];
    }
    /* one forecast office's airport stations, as they read now */
    if (what === 'obs') {
      const wfo = params.get('wfo') || '';
      if (!/^[A-Z]{3}$/.test(wfo)) return null;
      return [`${WX_IEM}/api/1/currents.geojson?networkclass=ASOS&wfo=${wfo}&minutes=90`, WX_TTL.obs];
    }
    if (what === 'raob') {
      const ts = params.get('ts') || '', st = params.get('station') || '';
      if (!/^\d{12}$/.test(ts) || !/^[A-Z0-9]{3,5}$/.test(st)) return null;
      return [`${WX_IEM}/json/raob.py?ts=${ts}&station=${st}`, WX_TTL.raob];
    }
    return null;
  }
  if (kind === 'spc' && WX_SPC.includes(parts[2]) && !parts[3]) {
    return [`https://www.spc.noaa.gov/products/outlook/${parts[2]}.nolyr.geojson`, WX_TTL.spc];
  }
  if (kind === 'col' && !parts[2]) {
    const m = WX_MODELS[params.get('model')];
    const lat = wxDeg(params.get('lat'), 90), lon = wxDeg(params.get('lon'), 180);
    if (!m || lat === null || lon === null) return null;
    const q = new URLSearchParams({ latitude: lat, longitude: lon, hourly: WX_COLUMN, models: m,
      forecast_hours: '48', past_hours: '12', wind_speed_unit: 'ms', timeformat: 'unixtime', timezone: 'auto' });
    return [`${WX_OM}?${q}`, WX_TTL.col];
  }
  if (kind === 'now' && !parts[2]) {
    const la = String(params.get('lat') || '').split(','), lo = String(params.get('lon') || '').split(',');
    if (!la.length || la.length !== lo.length || la.length > 12) return null;
    const lats = la.map(v => wxDeg(v, 90)), lons = lo.map(v => wxDeg(v, 180));
    if (lats.includes(null) || lons.includes(null)) return null;
    const q = new URLSearchParams({ latitude: lats.join(','), longitude: lons.join(','), current: 'temperature_2m,weather_code,is_day',
      daily: 'temperature_2m_max,temperature_2m_min', forecast_days: '1', timezone: 'auto', timeformat: 'unixtime' });
    return [`${WX_OM}?${q}`, WX_TTL.om];
  }
  /* the two big ensembles, every member: GEFS (31) and ECMWF ENS (51) */
  if (kind === 'plume' && !parts[2]) {
    const lat = wxDeg(params.get('lat'), 90), lon = wxDeg(params.get('lon'), 180);
    if (lat === null || lon === null) return null;
    const q = new URLSearchParams({ latitude: lat, longitude: lon, hourly: 'temperature_2m,precipitation',
      models: 'gfs025,ecmwf_ifs025', forecast_days: '7', timezone: 'auto', timeformat: 'unixtime' });
    return [`https://ensemble-api.open-meteo.com/v1/ensemble?${q}`, WX_TTL.om];
  }
  if (kind === 'ens' && !parts[2]) {
    const lat = wxDeg(params.get('lat'), 90), lon = wxDeg(params.get('lon'), 180);
    if (lat === null || lon === null) return null;
    const q = new URLSearchParams({ latitude: lat, longitude: lon, hourly: 'temperature_2m,precipitation,wind_speed_10m',
      models: 'ncep_nbm_conus,ncep_hrrr_conus,gfs_global,ecmwf_ifs025,ecmwf_aifs025_single', forecast_days: '7', timezone: 'auto', timeformat: 'unixtime' });
    return [`${WX_OM}?${q}`, WX_TTL.om];
  }
  if (kind === 'ommeta' && WX_META.has(parts[2]) && !parts[3]) {
    return [`https://api.open-meteo.com/data/${parts[2]}/static/meta.json`, WX_TTL.meta];
  }
  if (kind === 'nws') {
    const path = parts.slice(2).join('/');
    if (path === 'alerts/active') {
      /* Three shapes only: the alerts on a rounded point, a state's, or the
         country's storm warnings (the page with no place in it). */
      if (params.get('event') === WX_NATIONAL) {
        return [`${WX_NWS}/alerts/active?event=${encodeURIComponent(WX_NATIONAL)}`, WX_TTL.alerts];
      }
      const st = params.get('area');
      if (st) return /^[A-Z]{2}$/.test(st) ? [`${WX_NWS}/alerts/active?area=${st}`, WX_TTL.alerts] : null;
      const m = /^(-?[\d.]+),(-?[\d.]+)$/.exec(params.get('point') || '');
      const lat = m && wxDeg(m[1], 90), lon = m && wxDeg(m[2], 180);
      if (lat === null || lon === null || !m) return null;
      return [`${WX_NWS}/alerts/active?point=${lat},${lon}`, WX_TTL.alerts];
    }
    if (!WX_NWS_PATHS.some(re => re.test(path))) return null;
    const ttl = path.startsWith('points/') ? WX_TTL.points
      : path.endsWith('/stations') ? WX_TTL.stations
      : path.startsWith('stations/') ? WX_TTL.obs : WX_TTL.forecast;
    return [`${WX_NWS}/${path}`, ttl];
  }
  return null;
}

async function wxProxy(request, env, ctx, parts, url) {
  const origin = request.headers.get('origin');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, origin);

  /* /wx/near — where Cloudflare already places this visitor from their
     connection (request.cf, city level), so the page can show a forecast
     before anyone shares a location. Rounded to a tenth of a degree (~10 km),
     never cached, never stored, never logged: it is the visitor's own guess
     handed back to them. */
  if (parts[1] === 'near' && !parts[2]) {
    const cf = request.cf || {};
    const lat = Number(cf.latitude), lon = Number(cf.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ error: 'no guess' }, 404, origin, { 'cache-control': 'no-store' });
    return json({
      lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10,
      city: cf.city || null, region: cf.regionCode || cf.region || null, country: cf.country || null
    }, 200, origin, { 'cache-control': 'private, no-store' });
  }

  const up = wxUpstream(parts, url.searchParams);
  if (!up) return json({ error: 'not found' }, 404, origin);
  const [upstream, ttl] = up;

  const reply = (body, status, hit) => new Response(body, {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? `public, max-age=${ttl}` : 'no-store',
      'x-wx-cache': hit,
      ...cors(origin)
    }
  });

  const memo = wxMemo.get(upstream);
  if (memo && memo.until > Date.now()) return reply(memo.body, 200, 'hit');
  if (memo) wxMemo.delete(upstream);

  const edge = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const key = new Request(upstream);
  if (edge) {
    const c = await edge.match(key).catch(() => null);
    if (c) return reply(await c.text(), 200, 'hit');
  }

  const get = env.FETCH || ((...a) => fetch(...a));
  let r;
  try {
    r = await get(upstream, {
      headers: { accept: 'application/geo+json, application/json', 'user-agent': 'ricmassey.com weather room (+https://ricmassey.com)' },
      ...(typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? { signal: AbortSignal.timeout(12000) } : {})
    });
  } catch (e) {
    return json({ error: 'could not reach the weather service' }, 502, origin);
  }
  const body = await r.text();
  if (!r.ok) {
    /* A 404 is an answer (the NWS says it of every point outside the US) and
       is passed on; anything else upstream is a 502. Never cached. */
    return reply(body.slice(0, 4000) || JSON.stringify({ error: 'upstream ' + r.status }), r.status === 404 ? 404 : 502, 'miss');
  }

  if (wxMemo.size >= WX_MEMO_MAX) wxMemo.delete(wxMemo.keys().next().value);
  wxMemo.set(upstream, { body, until: Date.now() + ttl * 1000 });
  if (edge) {
    const put = edge.put(key, new Response(body, {
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${ttl}` }
    })).catch(() => {});
    if (ctx && ctx.waitUntil) ctx.waitUntil(put);
  }
  return reply(body, 200, 'miss');
}

/* Paths the outside world may reach. A whitelist rather than a blacklist,
   because the only thing standing between the internet and /strava-ingest is
   this line — and a blacklist is one forgotten entry away from being wrong. */
const PUBLIC_PATHS = new Set(['log', 'climb', 'auth', 'strava', 'board', 'media', 'todo', 'movies', 'garmin', 'trials', 'wx', 'hit', 'stats', 'cs']);

/* ── /cs/replay/<match id> — the CS room's replays, kept in R2 ──
   One file per match (projects/cs/matches/<id>.js, written by parse-demos.py),
   ~0.5-0.7 MB each. In git they would pass the gigabyte GitHub Pages allows at
   a few hundred games, and every one is permanent. So they live in the same
   bucket as the climbing media, under `cs/replays/`, which no /media path can
   build a key under, and projects/cs/upload-replays.py puts them there.

   GET is public: the page loads the file as a <script>, the same file it used
   to load from the repo, so it is served as JavaScript. The page asks for it
   with ?v=<the file's hash> (cs-data.js carries it), so a re-parse is a new
   URL and a day's cache is safe. PUT needs the site password, like every
   other write here; the throttle is the one in the object's /auth. */
const CS_REPLAY_PREFIX = 'cs/replays/';
const CS_REPLAY_ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_CS_REPLAY_BYTES = 20 * 1024 * 1024;

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

    /* Handled out here, in front of the Durable Object: these reads hold
       nothing of anybody's and need no token. The watchlist that goes with
       them is on the site account in Supabase, not on this Worker. */
    if (parts[0] === 'trials') return trialsProxy(request, env, ctx, parts, url);
    if (parts[0] === 'cs') {
      const origin = request.headers.get('origin');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
      const id = parts[2] ? decodeURIComponent(parts[2]) : '';
      if (parts[1] !== 'replay' || parts[3] || !CS_REPLAY_ID.test(id)) return json({ error: 'not found' }, 404, origin);
      if (!env.MEDIA) return json({ error: 'replay storage is not configured' }, request.method === 'GET' || request.method === 'HEAD' ? 404 : 503, origin);
      const key = CS_REPLAY_PREFIX + id + '.js';
      if (request.method === 'GET' || request.method === 'HEAD') {
        const obj = await env.MEDIA.get(key);
        if (!obj) return json({ error: 'not found' }, 404, origin);
        const headers = new Headers(cors(origin));
        headers.set('content-type', 'text/javascript; charset=utf-8');
        headers.set('etag', obj.httpEtag);
        headers.set('cache-control', 'public, max-age=86400');
        headers.set('x-content-type-options', 'nosniff');
        return new Response(request.method === 'HEAD' ? null : obj.body, { status: 200, headers });
      }
      if (request.method !== 'PUT') return json({ error: 'method not allowed' }, 405, origin);
      const a = request.headers.get('authorization') || '';
      const given = a.startsWith('Bearer ') ? a.slice(7) : '';
      if (!given) return json({ error: 'unauthorized' }, 401, origin);
      const auth = await stub.fetch(new Request('https://internal/auth', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: given })
      }));
      if (auth.status === 429) return json({ error: 'too many tries — wait five minutes' }, 429, origin);
      if (auth.status !== 200) return json({ error: 'unauthorized' }, 401, origin);
      const body = await request.text();
      if (body.length > MAX_CS_REPLAY_BYTES) return json({ error: 'too big' }, 413, origin);
      /* It must be the file parse-demos.py writes and nothing else: one
         assignment of this match's id, so a PUT cannot turn the replay URL
         into a way to run something else on the CS page. */
      const head = `(window.CS_MATCH=window.CS_MATCH||{})[${JSON.stringify(id)}]=`;
      const at = body.indexOf(head);
      const rest = at >= 0 ? body.slice(at + head.length).trim() : '';
      let parsed = null;
      try { parsed = rest.endsWith(';') ? JSON.parse(rest.slice(0, -1)) : null; } catch {}
      const before = at >= 0 ? body.slice(0, at) : 'x';
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.rounds) || !/^(\s*\/\/[^\n]*\n)*\s*$/.test(before)) {
        return json({ error: 'not a replay file for this match' }, 400, origin);
      }
      await env.MEDIA.put(key, body, { httpMetadata: { contentType: 'text/javascript; charset=utf-8' } });
      return json({ ok: true, id, bytes: body.length }, 200, origin);
    }
    if (parts[0] === 'wx') return wxProxy(request, env, ctx, parts, url);

    /* ── /hit and /stats ── the site's own visitor counter (visitors.mjs).
       The beacon is public and goes straight to D1. The numbers are Ric's,
       and whether the caller is Ric is asked of the object's /auth for the
       same reason /media asks it: one throttle for the one password. */
    if (parts[0] === 'hit') return handleHit(request, env, ctx);
    if (parts[0] === 'stats') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request.headers.get('origin')) });
      const isOwner = async () => {
        /* From /admin: a site-account session, checked with Supabase and
           never shown to the password throttle — a JWT is not a guess. */
        const session = request.headers.get('x-admin-session') || '';
        if (session) return isSiteAdmin(session, env);
        const a = request.headers.get('authorization') || '';
        const given = a.startsWith('Bearer ') ? a.slice(7) : '';
        if (!given) return false;
        const r = await stub.fetch(new Request('https://internal/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password: given })
        }));
        return r.status === 200;
      };
      return handleVisitors(request, env, parts, url, isOwner, json);
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

    /* ── /garmin ──
       Ric's Garmin history — sleep, HRV, resting heart rate, Body Battery,
       training readiness and every activity's numbers — pushed as one JSON file
       by projects/training/garmin/pull-garmin.py, run on GitHub Actions when he
       presses the button on the training page. It exists so a Claude session
       can read the lot in one request.

       NOTHING HERE IS PUBLIC, which makes it the one route on this Worker that
       is private in both directions. Sleep times are a nightly record of when
       the house is asleep, and HRV and resting heart rate are health data; Ric
       chose on 2026-09-29 to keep them behind the password rather than in the
       repo. So both reading and writing need a token:

         LOG_TOKEN          Ric — may upload and read, and press the button
         GARMIN_READ_TOKEN  a Claude session — may only read. Its own secret so
                            the thing handed to a cloud environment cannot tick,
                            write notes or replace the export.

       The file lives in the R2 bucket beside the climbing media, under its own
       prefix. The public /media routes only ever build keys under `climb/`, so
       no path through them reaches it. Stored whole and served whole: parsing a
       few megabytes of JSON would blow the free plan's CPU budget, and the
       reader filters it far more cheaply than this could. */
    if (parts[0] === 'garmin') {
      const origin = request.headers.get('origin');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
      const sub = parts[1] || '';
      if (parts[2] || !['', '_pull', 'session'].includes(sub)) return json({ error: 'not found' }, 404, origin);
      if (request.method !== 'GET' && request.method !== 'POST') {
        return json({ error: 'method not allowed' }, 405, origin);
      }

      const auth = request.headers.get('authorization') || '';
      if (!auth.startsWith('Bearer ') || auth.length <= 7) return json({ error: 'nope' }, 401, origin);
      const who = await stub.fetch(new Request('https://internal/garmin-auth', {
        method: 'POST', headers: { authorization: auth }
      }));
      if (who.status === 429) {
        return json({ error: 'too many attempts — wait five minutes' }, 429, origin, { 'retry-after': '300' });
      }
      const role = who.status === 200 ? (await who.json()).role : null;
      if (!role) return json({ error: 'nope' }, 401, origin);

      /* Everything below the bare route is Ric's alone: the reader token reads
         the export and nothing else. */
      if (sub && role !== 'owner') return json({ error: 'this token can read, not write' }, 403, origin);
      const priv = { 'cache-control': 'private, no-store' };

      /* ---------- POST /garmin/_pull — the button ----------
         The pull runs on GitHub Actions (.github/workflows/garmin.yml), so a
         phone can start it: the training page asks this, this asks GitHub,
         for the same reason /movies/_pull does — a token that can start a
         workflow cannot live in a public page and can live here. The
         workflow's concurrency group turns a burst of presses into one run. */
      if (sub === '_pull') {
        if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, origin);
        const gh = env.GH_TOKEN || '';
        if (!gh) return json({ ok: false, why: 'no GitHub token on the Worker — run it from the Actions tab instead' }, 503, origin);
        let r;
        try {
          r = await (env.FETCH || fetch)(`https://api.github.com/repos/${env.GH_REPO || 'ric-massey/ric-relay'}/dispatches`, {
            method: 'POST',
            headers: {
              authorization: 'Bearer ' + gh, accept: 'application/vnd.github+json',
              'content-type': 'application/json', 'user-agent': 'ricmassey-training-log'
            },
            body: JSON.stringify({ event_type: 'garmin' })
          });
        } catch (e) {
          return json({ ok: false, why: 'could not reach GitHub' }, 502, origin);
        }
        if (!r.ok) {
          const said = await r.text().catch(() => '');
          let why = `GitHub said ${r.status}`;
          try { const m = JSON.parse(said).message; if (m) why += ': ' + m; } catch (e) {}
          return json({ ok: false, why }, 502, origin);
        }
        return json({ ok: true, started: new Date().toISOString() }, 200, origin);
      }

      if (!env.MEDIA) return json({ error: 'storage is not configured — the R2 binding is missing' }, 503, origin);

      /* ---------- /garmin/session — Garmin's own login tokens ----------
         The pull runs on a fresh GitHub machine every time, and logging into
         Garmin with a password from a new datacenter address on every press
         is how an account gets challenged or locked. So after each run the
         script parks Garmin's session tokens here and the next run starts from
         them. They are a credential: owner only, never the reader token. */
      if (sub === 'session') {
        if (request.method === 'GET') {
          const obj = await env.MEDIA.get(GARMIN_SESSION_KEY);
          if (!obj) return json({ error: 'no session yet' }, 404, origin, priv);
          return new Response(obj.body, { status: 200, headers: {
            'content-type': 'application/json; charset=utf-8', ...cors(origin), ...priv } });
        }
        const text = await request.text();
        if (text.length > 64 * 1024) return json({ error: 'too big' }, 413, origin);
        try { if (!JSON.parse(text) || typeof JSON.parse(text) !== 'object') throw 0; }
        catch (e) { return json({ error: 'that is not a JSON object' }, 400, origin); }
        await env.MEDIA.put(GARMIN_SESSION_KEY, text, { httpMetadata: { contentType: 'application/json' } });
        return json({ ok: true }, 200, origin);
      }

      if (request.method === 'GET') {
        const obj = await env.MEDIA.get(GARMIN_KEY);
        if (!obj) return json({ error: 'nothing uploaded yet — press the button on the Mac' }, 404, origin, priv);
        const at = (obj.customMetadata && obj.customMetadata.at)
          || (obj.uploaded && new Date(obj.uploaded).toISOString()) || '';
        return new Response(obj.body, { status: 200, headers: {
          'content-type': 'application/json; charset=utf-8', ...cors(origin), ...priv,
          ...(at ? { 'x-uploaded': at } : {})
        } });
      }

      if (role !== 'owner') return json({ error: 'this token can read, not write' }, 403, origin);
      const declared = Number(request.headers.get('content-length') || 0);
      if (declared > MAX_GARMIN_BYTES) return json({ error: 'too big' }, 413, origin);
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.length > MAX_GARMIN_BYTES) return json({ error: 'too big' }, 413, origin);
      /* A shape check, not a parse (see above): a JSON object, first byte to
         last. Enough to stop a wrong file or an empty body replacing a good
         export; the script that writes it is the one that knows its fields. */
      let i = 0, j = bytes.length - 1;
      while (i <= j && bytes[i] <= 32) i++;
      while (j >= i && bytes[j] <= 32) j--;
      if (i > j || bytes[i] !== 0x7b || bytes[j] !== 0x7d) {
        return json({ error: 'that is not a JSON object' }, 400, origin);
      }
      const at = new Date().toISOString();
      await env.MEDIA.put(GARMIN_KEY, bytes, {
        httpMetadata: { contentType: 'application/json' },
        customMetadata: { at }
      });
      return json({ ok: true, bytes: bytes.length, at }, 200, origin);
    }

    /* ── /media ──
       Handled out here rather than in the Durable Object, because a 90MB video
       has no business being streamed through one: a DO is a single-threaded
       instance that every tick and every note in the log also has to get
       through, and the bytes are going to R2 either way.

       The one thing it still asks the object for is whether the caller is Ric.
       That could have been a compare right here — the token is on `env` — but
       then this endpoint would be an unthrottled oracle for guessing the same
       password /auth rate-limits, which would quietly undo that limit. One
       subrequest, only on writes, and the throttle stays honest. */
    if (parts[0] === 'media') {
      const origin = request.headers.get('origin');
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });

      /* Ship-before-the-bucket-exists: reads answer "nothing here" rather than
         failing, so every page renders exactly as it did before R2 was turned
         on. Only a write says the thing out loud. */
      if (!env.MEDIA) {
        if (request.method === 'GET') {
          return json({ days: {}, items: [], configured: false }, 200, origin,
            { 'cache-control': 'public, max-age=30' });
        }
        return json({ error: 'media storage is not configured — create the R2 bucket and redeploy' }, 503, origin);
      }

      const owner = async () => {
        const a = request.headers.get('authorization') || '';
        const given = a.startsWith('Bearer ') ? a.slice(7) : '';
        if (!given) return false;
        const r = await stub.fetch(new Request('https://internal/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ password: given })
        }));
        return r.status === 200;
      };

      /* ---------- GET /media/file/<date>/<file> — the bytes ----------
         Public, and the only path that serves them. Range requests are passed
         through to R2 untouched: without that, a phone will not scrub a video
         and Safari will not play one at all. */
      if (parts[1] === 'file') {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          return json({ error: 'method not allowed' }, 405, origin);
        }
        const key = MEDIA_PREFIX + parts.slice(2).map(decodeURIComponent).join('/');
        const range = request.headers.get('range');
        const obj = await env.MEDIA.get(key, {
          range: range ? request.headers : undefined,
          onlyIf: request.headers
        });
        if (!obj) return json({ error: 'not found' }, 404, origin);

        const headers = new Headers(cors(origin));
        obj.writeHttpMetadata(headers);
        headers.set('etag', obj.httpEtag);
        /* Immutable in the strict sense: a key contains a random id and is never
           written twice, so a year is safe and a re-watch costs nothing. */
        headers.set('cache-control', 'public, max-age=31536000, immutable');
        headers.set('accept-ranges', 'bytes');
        if (!obj.body) return new Response(null, { status: 304, headers });
        if (obj.range && range) {
          const start = obj.range.offset || 0;
          const len = obj.range.length ?? (obj.size - start);
          headers.set('content-range', `bytes ${start}-${start + len - 1}/${obj.size}`);
          return new Response(obj.body, { status: 206, headers });
        }
        return new Response(obj.body, { status: 200, headers });
      }

      const date = parts[1];
      if (date && !DAY.test(date)) return json({ error: 'date must be YYYY-MM-DD' }, 400, origin);

      /* ---------- GET /media, GET /media/<date> — what exists ---------- */
      if (request.method === 'GET') {
        const prefix = MEDIA_PREFIX + (date ? date + '/' : '');
        const days = {};
        let cursor;
        do {
          const page = await env.MEDIA.list({ prefix, cursor, include: ['customMetadata', 'httpMetadata'] });
          for (const obj of page.objects) {
            const rec = mediaRecord(obj);
            (days[rec.date] || (days[rec.date] = [])).push(rec);
          }
          cursor = page.truncated ? page.cursor : null;
        } while (cursor);
        /* The later word about what a photo is of. One subrequest, on a read
           that is already cached for thirty seconds — and it can only ever add
           a route or a caption, so if the object is unreachable the listing is
           still every file that exists. */
        try {
          const r = await stub.fetch(new Request('https://internal/medialabel'));
          if (r.ok) {
            const { labels } = await r.json();
            for (const list of Object.values(days)) {
              for (const rec of list) {
                const label = labels[rec.date + '/' + rec.id];
                if (!label) continue;
                if (label.route) rec.route = label.route;
                if (label.caption) rec.caption = label.caption;
              }
            }
          }
        } catch (e) { /* the files are the point; the labels are a bonus */ }

        /* Oldest first within a day, so the order on the page is the order it
           was shot in rather than whatever the bucket felt like. */
        for (const k of Object.keys(days)) days[k].sort((a, b) => String(a.at).localeCompare(String(b.at)));
        return json({ days, items: date ? (days[date] || []) : [], configured: true }, 200, origin,
          { 'cache-control': 'public, max-age=30' });
      }

      if (request.method === 'POST') {
        if (!date) return json({ error: 'POST needs a date: /media/YYYY-MM-DD' }, 400, origin);
        if (!(await owner())) return json({ error: 'nope' }, 401, origin);

        /* ---------- POST /media/<date>/<id> {remove:true} — take it down ----------
           A POST rather than a DELETE for the same reason /climb deletes that
           way: one verb is one less thing to get wrong on a phone. */
        if (parts[2]) {
          let body = {};
          try { body = await request.json(); } catch {}

          /* ---------- POST /media/<date>/<id> {route, caption} — name it ----------
             Nothing at a crag asks which route a clip is of, so most arrive
             without one; and until this existed the only way to correct that
             was to delete the file and upload it again. Now that the gallery
             shows what is attached to a climb, an unnameable photo is a photo
             that can never join it. */
          if (body.remove !== true) {
            if (!('route' in body) && !('caption' in body)) {
              return json({ error: 'send {"remove":true}, or a route or caption to set' }, 400, origin);
            }
            const r = await stub.fetch(new Request(
              `https://internal/medialabel/${date}/${encodeURIComponent(parts[2])}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ route: body.route, caption: body.caption })
              }));
            return json(await r.json(), r.status, origin);
          }
          const prefix = MEDIA_PREFIX + date + '/' + parts[2];
          /* Keyed by id without the extension, because the page holds the id and
             should not have to know what the phone shot it as. */
          const page = await env.MEDIA.list({ prefix });
          if (!page.objects.length) return json({ error: 'not found' }, 404, origin);
          await env.MEDIA.delete(page.objects.map(o => o.key));
          /* And its label, or a re-upload that happened to draw the same id
             would inherit the name of a photo that no longer exists. */
          await stub.fetch(new Request(
            `https://internal/medialabel/${date}/${encodeURIComponent(parts[2])}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ route: '', caption: '' })
            }));
          return json({ ok: true, removed: page.objects.map(o => o.key) }, 200, origin);
        }

        if (url.searchParams.has('up')) return mediaInPieces(request, env, url, date, origin);

        /* ---------- POST /media/<date> — the upload ----------
           Raw bytes, with the describing fields in the query string. Not
           multipart: parsing a form would mean buffering the whole video in the
           isolate to get at a caption, and the caption fits in a URL. */
        const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        const known = MEDIA_TYPES[type];
        if (!known) {
          return json({ error: 'that file type is not accepted', type, accepted: Object.keys(MEDIA_TYPES) }, 415, origin);
        }
        const declared = Number(request.headers.get('content-length') || 0);
        if (declared > MAX_MEDIA_BYTES) {
          return json({ error: `too big — ${Math.round(declared / 1048576)}MB, and the limit is ${MAX_MEDIA_BYTES / 1048576}MB` }, 413, origin);
        }
        if (!request.body) return json({ error: 'no file in the body' }, 400, origin);

        const q = url.searchParams;
        const [ext, kind] = known;
        const id = mediaId();
        const meta = {
          id, kind, type,
          name: (q.get('name') || '').slice(0, 160),
          route: (q.get('route') || '').slice(0, 160),
          caption: (q.get('caption') || '').slice(0, 400),
          at: new Date().toISOString()
        };
        const key = `${MEDIA_PREFIX}${date}/${id}.${ext}`;
        /* Photos are read whole and scrubbed of their camera notes — GPS lives
           there, and /media/file is public for a year (hard rule 1). The page
           scrubs first; this is the second lock, for anything that did not
           come through it. Videos stay a stream: a 100MB clip does not fit in
           the isolate, so the page's scrub is the one that counts for them. */
        let body = request.body;
        if (kind === 'photo') {
          const clean = globalThis.ScrubMedia.bytes(type, new Uint8Array(await request.arrayBuffer()));
          if (!clean) return json({ error: 'that photo could not be cleaned of its location — send it as a JPEG' }, 415, origin);
          body = clean;
        }
        const put = await env.MEDIA.put(key, body, {
          httpMetadata: { contentType: type },
          customMetadata: { meta: encodeURIComponent(JSON.stringify(meta)) }
        });
        /* R2 refuses a stream longer than the declared length rather than
           truncating it, so a null here is a lie in content-length, not a
           mystery. Nothing was stored. */
        if (!put) return json({ error: 'the upload did not complete — try it again' }, 502, origin);
        if (put.size > MAX_MEDIA_BYTES) {
          await env.MEDIA.delete(key);
          return json({ error: 'too big' }, 413, origin);
        }
        return json({ ok: true, ...mediaRecord({ ...put, key, customMetadata: { meta: encodeURIComponent(JSON.stringify(meta)) } }) }, 200, origin);
      }

      return json({ error: 'method not allowed' }, 405, origin);
    }

    return stub.fetch(request);
  }
};
