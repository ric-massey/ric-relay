/* ORRIN — the status service on Cloudflare
   ────────────────────────────────────────────────────────────────────────────
   Holds what Orrin's machine says about itself while he is running: one record
   per run, a rolling window of the things he actually said out loud, and enough
   numbers for the brain room to show a pulse. Nothing here reaches into his
   machine — his machine pushes, this holds, the page reads.

       cd projects/orrin/server
       npx wrangler@latest secret put ORRIN_TOKEN     # once, pick something long
       npx wrangler@latest deploy

   ── why a push and not a tunnel ──
   The obvious shape is to expose his backend and let the page talk to it. That
   backend answers /api/memory, /api/chat, /api/theory_of_mind and /api/source,
   it will hand out a full mind export, and /api/agent/input takes a message
   from anyone who can reach it. Worse, every one of its auth guards short-
   circuits for 127.0.0.1 — and a tunnel connects to it FROM 127.0.0.1, so the
   read token it looks like you configured would not be a gate at all.

   So the same shape as the training log and the apex watcher: his machine
   pushes a snapshot outward on a timer, and nothing on the internet has a route
   in. The failure mode of a bug in here is a wrong number on a page. The
   failure mode of a bug in a tunnel is his memory.

   ── nobody can talk to him ──
   There is deliberately no endpoint that sends anything toward Orrin. Reads are
   public, writes need the token, and a write only ever ADDS to what he has
   already said. A visitor can watch; a visitor cannot participate. That is not
   only a privacy line, it protects the run itself: Run 12 is an acceptance life
   whose verdict has to be able to claim the behaviour was his, and it cannot do
   that if strangers were feeding him prompts.

   ── why a Durable Object ──
   A Worker is many isolates sharing no memory, so a snapshot written in one
   would not exist for the next reader. Storage is genuinely written: a run
   record outlives the run, which is the whole point of the page still having
   something to show when he is off. The volume is one machine pushing once a
   minute, which sits far inside the free plan. */

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/* How long after the last push he is still called "running". His producer
   pushes every 60s; three missed pushes is a machine that went to sleep, lost
   its network, or was stopped — none of which the page should render as alive.
   Deliberately not shorter: a drvfs stall can eat a cycle without ending a run,
   and flickering "asleep" on a healthy run is a worse lie than three minutes of
   lag. */
const STALE_MS = 3 * 60 * 1000;

/* ── what a snapshot is allowed to be ──────────────────────────────────────
   Copied key by key, never taken whole. This is the last place a mistake on his
   machine can be stopped before it becomes a published fact, and it is the only
   thing standing between a producer bug and his interior.

   Deliberately absent, and not by oversight:
     • anything from private_thoughts.txt — his interior is sealed while he is
       alive. His own backend refuses it at /api/death and only opens it once a
       life has actually ended; a status page is not the place that reverses it.
     • anything from chat_log.json or the `user_input` half of a speech entry —
       that is Ric's side of a conversation, and Ric is not the exhibit.
     • theory_of_mind, known_persons, relationships — those describe real people
       who never agreed to be on a website.
     • memory records and goal BODIES. A goal title says what he is working on;
       a goal body quotes whatever he read to get there.
   The rule for anything new: if it would still be true of him with the machine
   switched off, it is probably his interior, not his status. */
const SNAPSHOT_NUMBERS = {
  /* value: [min, max] — a reading outside this is not unusual, it is wrong, and
     a wrong number that renders is harder to notice than a missing one. */
  cycle:        [0, 100000000],
  pulse:        [0, 100000000000],
  /* Wall-clock age of the LIFE, not uptime of the process. A life survives the
     machine being off — the 2026-09-02 one ran, lay dormant twelve days, and
     resumed on the same cycle counter — so calling this uptime would have the
     page reporting six days of running for a few hours of it. */
  lifeAgeS:     [0, 60 * 60 * 24 * 400],   // 400 days; his lifespan band is ~1.3yr
  /* Measured between two pushes, not derived from lifeAgeS, for the same
     reason: dormancy would otherwise average his cycle rate into fiction. */
  secPerCycle:  [0, 3600],
  rssMb:        [0, 262144],
  satisfaction: [0, 1],
  goalsActive:  [0, 10000],
  cyclesTotal:  [0, 100000000],
  /* His affect, as three numbers out of smoothed_state.json. Numbers and not a
     word on purpose: "anxious" is an interpretation and would be this page
     putting a feeling in his mouth, where a valence of -0.4 is a reading. */
  valence:      [-1, 1],
  energy:       [0, 1],
  stability:    [0, 1]
};

/* Short strings, each with a ceiling. The ceilings are not stylistic — an
   unbounded string from a machine that is allowed to write here is how a status
   endpoint quietly becomes a paste bin. */
const SNAPSHOT_TEXT = {
  runId:    64,
  buildSha: 24,
  goal:     140,
  mode:     32,
  mood:     32
};

/* A line he said. `text` is the reply he composed and nothing else — the
   speech log on his machine keeps `user_input` on the same record, and that
   field is not read here, is not in this table, and must never be added to it:
   the whole promise of this page is that you can see what HE said. */
const SPEECH_TEXT_MAX = 600;
const SPEECH_KIND_MAX = 40;
const SPEECH_PER_PUSH = 50;      // a push carrying more than this is a bug
const SPEECH_KEEP = 200;         // rolling window held per run

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

const json = (body, status, origin) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...cors(origin) }
});

/* Trim, drop control characters, cap. Control characters matter because the
   page renders this as text: a stray \r or a zero-width run can make two
   different things look identical in a list of what he said. */
function text(v, max) {
  if (typeof v !== 'string') return '';
  return v
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function num(v, [lo, hi]) {
  const n = typeof v === 'number' ? v : Number(v);
  if (!isFinite(n) || n < lo || n > hi) return null;
  return n;
}

function when(v) {
  return typeof v === 'string' && ISO.test(v) ? v : null;
}

/* One snapshot, rebuilt field by field from whatever arrived. Returns null when
   the push carries no run identity, because a status without a run is a number
   with nothing to attach it to. */
function cleanSnapshot(body) {
  const out = {};
  for (const [k, max] of Object.entries(SNAPSHOT_TEXT)) {
    const v = text(body?.[k], max);
    if (v) out[k] = v;
  }
  if (!out.runId) return null;

  for (const [k, range] of Object.entries(SNAPSHOT_NUMBERS)) {
    const v = num(body?.[k], range);
    if (v !== null) out[k] = v;
  }

  const started = when(body?.startedAt);
  if (started) out.startedAt = started;

  /* `alive` is the producer's own claim about the cognitive loop, which is not
     the same question as "did a push arrive recently". A run can be stopped
     cleanly (alive:false on the final push) or vanish (no push at all), and the
     page says different things about those two. */
  out.alive = body?.alive === true;
  return out;
}

/* His speech, one line at a time. Anything without text or a timestamp is
   dropped rather than defaulted: a line stamped "now" because its own timestamp
   was malformed puts words in his mouth at the wrong moment. */
function cleanSpeech(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list.slice(0, SPEECH_PER_PUSH)) {
    const at = when(raw?.at);
    const body = text(raw?.text, SPEECH_TEXT_MAX);
    if (!at || !body) continue;
    const line = { at, text: body };
    const kind = text(raw?.kind, SPEECH_KIND_MAX);
    const tone = text(raw?.tone, SPEECH_KIND_MAX);
    if (kind) line.kind = kind;
    if (tone) line.tone = tone;
    out.push(line);
  }
  return out;
}

export class OrrinStatus {
  constructor(state, env) {
    this.state = state;
    /* The token is read from the environment at construction and never leaves
       this object — it is not returned by any endpoint and never logged. */
    this.token = env.ORRIN_TOKEN || '';
  }

  /* Speech keys sort lexically in insertion order, which is what makes the
     rolling window a `list({ reverse: true })` instead of a sort. The sequence
     is padded because 'sp:r:10' sorts before 'sp:r:9' otherwise, and a window
     that silently reorders his sentences is worse than no window. */
  speechKey(runId, seq) {
    return `sp:${runId}:${String(seq).padStart(12, '0')}`;
  }

  async ingest(body) {
    const snap = cleanSnapshot(body);
    if (!snap) return { ok: false, error: 'no runId' };

    const now = new Date().toISOString();
    const runKey = `run:${snap.runId}`;
    const prior = (await this.state.storage.get(runKey)) || {
      runId: snap.runId,
      firstSeen: now,
      speechSeq: 0
    };

    /* The run record is the snapshot plus the boundaries only the accumulated
       history knows. `cyclesTotal` is deliberately max() and not last-wins: a
       relaunch mid-run resets nothing on his side, but a malformed push
       reporting cycle 0 must not erase a run's headline number. */
    const run = {
      ...prior,
      ...snap,
      lastSeen: now,
      cyclesTotal: Math.max(prior.cyclesTotal || 0, snap.cycle || 0)
    };

    const lines = cleanSpeech(body?.speech);
    if (lines.length) {
      let seq = run.speechSeq || 0;
      const writes = {};
      for (const line of lines) writes[this.speechKey(run.runId, ++seq)] = line;
      run.speechSeq = seq;
      run.saidCount = (run.saidCount || 0) + lines.length;
      await this.state.storage.put(writes);
      await this.trimSpeech(run.runId);
    }

    await this.state.storage.put(runKey, run);
    await this.state.storage.put('cur', { runId: run.runId, lastSeen: now });
    return { ok: true, runId: run.runId, said: run.saidCount || 0 };
  }

  /* Keep the newest SPEECH_KEEP lines of a run. The page shows a window, the
     run record keeps the count, and his machine keeps the whole log — this is a
     display buffer, not an archive, and pretending otherwise would make the
     Worker the system of record for something it only ever saw a copy of. */
  async trimSpeech(runId) {
    const keys = [...(await this.state.storage.list({
      prefix: `sp:${runId}:`, limit: 1000
    })).keys()];
    if (keys.length <= SPEECH_KEEP) return;
    await this.state.storage.delete(keys.slice(0, keys.length - SPEECH_KEEP));
  }

  async read() {
    const cur = await this.state.storage.get('cur');
    if (!cur) return { live: false, run: null, speech: [] };

    const run = await this.state.storage.get(`run:${cur.runId}`);
    if (!run) return { live: false, run: null, speech: [] };

    const age = Date.now() - Date.parse(run.lastSeen);
    /* Both halves have to hold: he says the loop is running AND a push arrived
       recently enough to believe him. A machine that was unplugged mid-run left
       `alive: true` behind on its last push and would otherwise read as alive
       forever. */
    const live = run.alive === true && age < STALE_MS;

    const speech = [...(await this.state.storage.list({
      prefix: `sp:${run.runId}:`, limit: SPEECH_KEEP, reverse: true
    })).values()];

    const { speechSeq, ...publicRun } = run;   // an internal counter, not news
    return {
      live,
      staleFor: live ? 0 : Math.max(0, age),
      run: publicRun,
      speech: speech.reverse()
    };
  }

  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') || '';
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (path === '/status' || path === '/') {
      if (request.method === 'GET') {
        return json(await this.read(), 200, origin);
      }
      if (request.method === 'POST') {
        const auth = request.headers.get('authorization') || '';
        const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : '';
        if (!this.token || !sameSecret(supplied, this.token)) {
          return json({ ok: false, error: 'unauthorized' }, 401, origin);
        }
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ ok: false, error: 'bad json' }, 400, origin);
        }
        const result = await this.ingest(body);
        return json(result, result.ok ? 200 : 400, origin);
      }
      return json({ ok: false, error: 'method' }, 405, origin);
    }

    return json({ ok: false, error: 'not found' }, 404, origin);
  }
}

export default {
  async fetch(request, env) {
    /* One object, one name: there is one Orrin and one run at a time, so every
       request lands in the same isolate and there is nothing to shard. */
    const id = env.ORRIN.idFromName('orrin');
    return env.ORRIN.get(id).fetch(request);
  }
};
