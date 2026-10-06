/* ORRIN'S PROGRESS NOTES STILL HAVE THE SHAPE THE PAGE DRAWS
   ────────────────────────────────────────────────────────────────────────────
   orrin-updates.js is written by a script in another repo (orrin_v3's
   scripts/site_update.py) as well as by hand, so nothing on this side would
   notice a malformed entry until the Orrin page showed "Invalid Date" or a
   blank title. Loaded the way the page loads it (a classic script that sets
   window.ORRIN_UPDATES), then checked entry by entry. */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(ROOT, 'orrin-updates.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(src, sandbox, { filename: 'orrin-updates.js' });
const list = sandbox.window.ORRIN_UPDATES;

const KINDS = new Set(['run result', 'build', 'design', 'note']);
const today = new Date().toISOString().slice(0, 10);

assert.ok(Array.isArray(list) && list.length > 0, 'window.ORRIN_UPDATES must be a non-empty array');
let prev = '9999-12-31';
list.forEach((n, i) => {
  const at = `entry ${i} (${n && n.title})`;
  assert.match(n.date, /^\d{4}-\d{2}-\d{2}$/, `${at}: date must be YYYY-MM-DD`);
  assert.ok(!Number.isNaN(Date.parse(n.date)), `${at}: date must be a real day`);
  assert.ok(n.date <= today, `${at}: date is in the future`);
  assert.ok(n.date <= prev, `${at}: entries must be newest first`);
  prev = n.date;
  assert.ok(KINDS.has(n.kind), `${at}: kind must be one of ${[...KINDS].join(', ')}`);
  for (const k of ['title', 'body']) {
    assert.equal(typeof n[k], 'string', `${at}: ${k} must be a string`);
    assert.ok(n[k].trim().length > 0, `${at}: ${k} is empty`);
    assert.ok(!/[<>]/.test(n[k]), `${at}: ${k} carries markup; the page renders text only`);
  }
  if (n.href !== undefined) {
    assert.match(n.href, /^https:\/\/github\.com\/ric-massey\/orrin_v3\//,
      `${at}: href must point into the Orrin repo (AGENTS.md hard rule 2)`);
  }
});
console.log(`ok — ${list.length} progress notes`);
