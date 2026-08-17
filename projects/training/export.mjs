/* TRAINING — build the public plan file
   ────────────────────────────────────────────────────────────────────────────
   Reads the engine out of the private index.html and writes the publishable
   subset to assets/training-plan.json, which training.html serves to anyone.

       node projects/training/export.mjs

   ── the one rule this file exists to enforce ──
   It is an ALLOWLIST. Every field that reaches the public file is named in
   PUBLIC_FIELDS below and nothing else survives the copy. That direction
   matters: a denylist would mean any new field added to the planning app is
   public until someone remembers to exclude it, and the planning app is edited
   far more often than this exporter is. Here, a new field is private until
   somebody deliberately adds it to the list.

   ── what is deliberately NOT here ──
   The work rota, the free-hours table, the sleep window and the Apex schedule.
   Individually those are dull; together they are a weekly timetable of when
   the house is empty, which is a different thing from a training log. They stay
   in index.html and index.html is gitignored. Do not add them to the list
   without meaning to.

   Venue names ARE included, and sessions publish on their scheduled date rather
   than once completed — both chosen deliberately. The consequence, stated once
   so it is on the record: the published file is a standing calendar of where
   this person will be, in advance. That was the call; this is the note. */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const SRC = join(HERE, 'index.html');
const OUT = join(ROOT, 'assets', 'training-plan.json');

/* ── the allowlist ── */
const PUBLIC_FIELDS = ['slot', 'kind', 'title', 'meta', 'key', 'k'];

/* Protocols are published as a LIBRARY, once, with sessions referencing them by
   key — inlining them per day would repeat the same twenty exercises across 364
   entries for no reason.

   What crosses: the name, the dose table, the exercise list, and the how-to cue
   for each movement. All of it is generic instruction — "Romanian deadlift,
   3 × 8" is not personal information.

   What does NOT cross: the `d` commentary and the `warn` notes. Those are where
   the personal reasoning lives — which wrist is the worse one, whose shoulder
   cannot do dips, which experiment was run on whose knees, what the job is. The
   exercises are what to do; the commentary is about the person doing them, and
   only the private app carries it. */
const PUBLIC_PROTO_FIELDS = ['n', 'spec'];

/* ── what an exercise panel is for ──
   Open a session on the public page and you want one thing: what to actually
   do. Three kinds of content are not that, and all three used to arrive anyway
   because the private app hangs them off the session as protocols —

     the readiness check   a four-question self-score, not a session
     the warm-up           twenty minutes of it, in front of every climb
     the logistics         the drive to the Obed, the leaving time, skin care

   — and all three are IDENTICAL every day, which is what makes them noise. The
   one hard thing the day is built around ended up below a fold of things that
   never change and that he does not need telling. He warms up. He knows the
   drive. None of it stops being true, it just stops being published; the
   private app still carries the lot. */
const DROP_PROTOS = new Set(['readiness', 'warmup', 'obed', 'skin']);

/* The same three arrive a second way: as ROWS inside protocols that are
   otherwise real. Every outdoor session opens with "Full warm-up sequence".
   Anchored at the start of the name on purpose — headgame's "Practice falls,
   progressively longer, on a warm-up route" is an exercise that merely
   mentions one, and a loose match would take it out with the rest. */
const DROP_EX = [/^(full\s+)?warm.?[-\s]?up/i, /^Leave the house/i, /^Eat and drink on the drive/i];

/* Spec rows about getting there rather than about the session. */
const DROP_SPEC = new Set(['Drive', 'Door', 'Leave', 'Admin']);

/* Session titles and meta strings are prose written for one reader, and a few
   carry the planning apparatus rather than the session. These never publish. */
const PRIVATE_SESSION = [
  /^Work —/,          // the shift itself
  /^Setting — 8 h/,   // eight hours of where he works, every Wednesday
];

/* Lift the engine out of the page — same boundary the test harness uses, so
   there is one definition of "the engine" and no build step to keep in sync. */
const src = readFileSync(SRC, 'utf8');
const start = src.indexOf('<script>') + '<script>'.length;
const end = src.indexOf('const $ = s => document.querySelector');
if (end < 0) { console.error('Could not find the render boundary in index.html'); process.exit(2); }
const engine = src.slice(start, end);

const A = new Function(engine + ';return {buildDay,iso,dateOf,phaseOf,MILEAGE,isDeload,CONFIG,PHASES,PROTO};')();

/* HOWTO sits below the render boundary, so it is lifted separately. It is a
   flat map of exercise name -> one-sentence cue, and it is what makes the
   published list usable without a video or a coach. */
const HOWTO = new Function(
  src.slice(src.indexOf('const HOWTO'), src.indexOf('function exBlock')) + ';return HOWTO;'
)();

const protocols = {};
for (const [key, p] of Object.entries(A.PROTO)) {
  if (!p || !p.n) continue;
  if (DROP_PROTOS.has(key)) continue;
  const out = {};
  for (const f of PUBLIC_PROTO_FIELDS) if (p[f] !== undefined) out[f] = p[f];
  if (out.spec) out.spec = Object.fromEntries(Object.entries(out.spec).filter(([k]) => !DROP_SPEC.has(k)));
  /* [name, dose, cue] — the cue is looked up here rather than shipped as a
     second map, so the page has nothing to join at runtime. */
  if (p.ex && p.ex.length) {
    const ex = p.ex.filter(([name]) => !DROP_EX.some(re => re.test(name)));
    if (ex.length) out.ex = ex.map(([name, dose]) => [name, dose, HOWTO[name] || null]);
  }
  protocols[key] = out;
}

const days = [];
for (let w = 1; w <= 52; w++) {
  for (let d = 0; d < 7; d++) {
    const day = A.buildDay(w, d);
    const sessions = day.sessions
      .filter(s => !PRIVATE_SESSION.some(re => re.test(s.t)))
      /* A card with no real content is scaffolding, not a session. */
      .filter(s => s.kind !== 'rest' || /rest|easy day|recovery/i.test(s.t))
      .map(s => {
        const out = {};
        for (const f of PUBLIC_FIELDS) {
          const v = f === 'title' ? s.t : f === 'meta' ? s.m : s[f];
          if (v !== undefined && v !== null) out[f] = v;
        }
        /* Point only at protocols that still exist, or the page would carry
           364 days of keys resolving to nothing. */
        if (out.k) out.k = out.k.filter(k => protocols[k]);
        /* ── the tick key ──
           A tick is stored against this id, so it has to mean the same session
           tomorrow as it did today. It used to be the session's INDEX, which
           is stable only until the plan changes: the Sunday/Monday swap moved
           the sessions on 94 days, and any tick on one of those would have
           silently become a tick on whatever landed in that slot instead —
           "climbed" quietly turning into "ran". Nothing would look broken,
           which is the worst kind of wrong.

           Slot plus kind is the identity that survives: it is what the session
           IS — the morning body session, the day's climb, the evening run —
           rather than where it sits or what it is called. Titles carry
           mileage and mileage changes; positions move whenever the week is
           reshaped. Neither of those touches this. */
        out.id = `${out.slot || ''}-${out.kind || ''}`
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return out;
      });
    days.push({
      date: A.iso(A.dateOf(w, d)),
      week: w,
      phase: A.phaseOf(w).name,
      deload: A.isDeload(w),
      miles: undefined,
      sessions
    });
  }
}

/* Weekly mileage is a training number and publishes; it is attached per week
   rather than per day so the public page can show a total without implying a
   route or a time of day. */
const weeks = {};
for (let w = 1; w <= 52; w++) weeks[w] = { miles: A.MILEAGE[w], phase: A.phaseOf(w).name, deload: A.isDeload(w) };

const out = {
  generated: new Date().toISOString().slice(0, 10),
  start: A.CONFIG.startDate,
  phases: A.PHASES.map(p => ({ name: p.name, sub: p.sub, w0: p.w0, w1: p.w1, key: p.key, goal: p.goal })),
  protocols,
  weeks,
  days: days.map(({ miles, ...rest }) => rest)
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out));

/* ── the guard ──
   Fail loudly rather than publish a leak. If any of these strings reach the
   output, something private has been added to the allowlist by accident. */
const text = JSON.stringify(out);
const LEAKS = [
  ['work rota', /2:30 to 7:45|Gym desk/i],
  ['free hours', /\d+h\d\d free|free time/i],
  ['sleep window', /wake 7|bed 23|lights out/i],
  ['gaming schedule', /apex/i],
  ['home-relative drive times', /30 min each way to REI/i],
];
const hits = LEAKS.filter(([, re]) => re.test(text));
if (hits.length) {
  console.error('REFUSING TO PUBLISH — private content reached the output:');
  hits.forEach(([name]) => console.error('  · ' + name));
  process.exit(1);
}

/* ── the tick-key guard ──
   Two sessions on one day sharing an id would share a tick: ticking one would
   tick the other, and there is no way to tell from the page that it happened.
   Slot+kind is unique across all 364 days today, and this exists so that stays
   true — if a phase ever authors two runs in one slot, this stops the build
   rather than letting the ambiguity reach the log. */
const clashes = [];
for (const d of out.days) {
  const seen = new Map();
  for (const s of d.sessions) {
    if (seen.has(s.id)) clashes.push(`${d.date}: "${seen.get(s.id)}" and "${s.title}" both id "${s.id}"`);
    seen.set(s.id, s.title);
  }
}
if (clashes.length) {
  console.error('REFUSING TO PUBLISH — two sessions in a day share a tick key:');
  clashes.slice(0, 10).forEach(c => console.error('  · ' + c));
  console.error(`  (${clashes.length} total). Give one of them a distinct slot or kind.`);
  process.exit(1);
}

const bytes = Buffer.byteLength(text);
console.log(`wrote ${OUT.replace(ROOT + '/', '')} — ${days.length} days, ${(bytes / 1024).toFixed(0)} kB`);
console.log(`fields published: ${PUBLIC_FIELDS.join(', ')}`);
console.log('leak guard: clean');
