/* BOARD → TRAINING LOG — tick the climbing session a board night answered
   ────────────────────────────────────────────────────────────────────────────
   Kilter and Tension have no webhooks. Strava pushes; the boards have to be
   asked. So the Mac asks them on a timer (pull-boards.py), and this reads what
   came back and tells the training log which days had a session on the wall.

       node projects/climbing/board-tick.mjs            # tell the Worker
       node projects/climbing/board-tick.mjs --dry-run  # say what it would tell it

   It sends DATES and nothing else. What was climbed is already published in
   board-data.js and the training page reads it from there — a second copy in
   the Worker would be the same logbook twice, free to drift apart.

   The token is the training log's own LOG_TOKEN, which lives in the Keychain
   and never in this repo:

       security add-generic-password -s training-log -a rmbuster82 -w

   Safe to run as often as you like. The Worker refuses to tick a session that
   has already been decided either way, so this cannot undo a box Ric unticked
   on purpose, and re-running changes nothing. */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
/* Overridable so the whole path — parse, post, tick — can be rehearsed against
   the dev server with an invented logbook, without touching the real one. */
const DATA = process.env.BOARD_DATA_FILE || join(HERE, 'board-data.js');
const HOST = process.env.TRAINING_HOST || 'https://training-log.rmbuster82.workers.dev';
const KEYCHAIN = { service: 'training-log', account: 'rmbuster82' };

/* Only the recent past. The logbook goes back years and the plan does not, so
   posting all of it would be a long request that could only ever tick the same
   handful of days. A fortnight covers a sync that has not run in a while. */
const WINDOW_DAYS = 14;

const dry = process.argv.includes('--dry-run');
const die = m => { console.error('\n' + m + '\n'); process.exit(1); };

function token() {
  if (process.env.LOG_TOKEN) return process.env.LOG_TOKEN.trim();
  try {
    return execFileSync('security',
      ['find-generic-password', '-s', KEYCHAIN.service, '-a', KEYCHAIN.account, '-w'],
      { encoding: 'utf8' }).trim();
  } catch {
    die(`No log token in the Keychain. Store it once — this prompts without\n` +
        `echoing, and keeps it out of your shell history:\n\n` +
        `    security add-generic-password -s ${KEYCHAIN.service} -a ${KEYCHAIN.account} -w\n\n` +
        `It is the same LOG_TOKEN the Worker holds. Or pass LOG_TOKEN= in the\n` +
        `environment for a one-off.`);
  }
}

/* board-data.js is a script that assigns a global, not JSON. Slicing at the
   first brace is enough and avoids pulling in a parser to read our own file. */
function boardData() {
  let text;
  try { text = readFileSync(DATA, 'utf8'); }
  catch { die(`No ${DATA}. Run pull-boards.py first — this reads what that writes.`); }
  try {
    return JSON.parse(text.slice(text.indexOf('{')).trim().replace(/;\s*$/, ''));
  } catch (e) {
    die(`Could not read ${DATA}: ${e.message}`);
  }
}

const iso = d => d.toISOString().slice(0, 10);

async function main() {
  const data = boardData();
  const cutoff = iso(new Date(Date.now() - WINDOW_DAYS * 864e5));
  const today = iso(new Date());

  const byBoard = {};
  for (const [key, b] of Object.entries(data.boards || {})) {
    const days = new Set();
    for (const e of (b.entries || [])) {
      const d = String(e.date || '').slice(0, 10);
      /* A logbook can hold a date in the future if a clock was wrong; the plan
         cannot be answered by a session that has not happened. */
      if (d >= cutoff && d <= today) days.add(d);
    }
    if (days.size) byBoard[key] = [...days].sort();
  }

  if (!Object.keys(byBoard).length) {
    console.log(`no board sessions in the last ${WINDOW_DAYS} days — nothing to tick`);
    return;
  }

  const auth = dry ? null : token();
  for (const [source, days] of Object.entries(byBoard)) {
    if (dry) { console.log(`${source}: would send ${days.length} day(s) — ${days.join(', ')}`); continue; }
    const r = await fetch(HOST + '/board', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + auth },
      body: JSON.stringify({ source, days })
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error(`${source}: refused (${r.status}) ${JSON.stringify(out)}`);
      process.exitCode = 1;
      continue;
    }
    /* Only newly-ticked days come back, so a quiet run means everything was
       already settled — which is the normal case on all but one run a week. */
    const t = out.ticked || [];
    console.log(t.length
      ? `${source}: ticked ${t.map(x => `${x.date} (${x.session})`).join(', ')}`
      : `${source}: ${days.length} day(s) sent, nothing new to tick`);
  }
}

main().catch(e => die(e.message));
