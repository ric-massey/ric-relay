/* A username must never be made out of an email address.
 *
 * It used to be, everywhere: the signup trigger took the local part, the
 * display name was that title-cased, and the app made the same string for
 * itself when it could not reach the profile. Between them they put half of
 * everybody's sign-in address on every byline in the app, and made guessing a
 * username the same job as guessing an email — which is exactly what finding
 * people by username instead of by address is supposed to prevent.
 *
 * These are grep tests on purpose. The rules live in Postgres and there is no
 * database here, but "nothing splits an email to make a name any more" is a
 * fact about the text of the files, and it is the fact that has to keep being
 * true. See docs/audiences.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here  = dirname(fileURLToPath(import.meta.url));
const root  = join(here, '..');

/* Comments stripped from both. Every rule in this codebase is explained in
 * prose right next to the statement that implements it, so a grep over the raw
 * text finds the sentence ABOUT the rule and goes green whether or not the rule
 * is still there. See the note in security.test.mjs — that is how it was found. */
const noJsComments  = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const noSqlComments = (t) => t.replace(/--[^\n]*/g, '');

const app = noJsComments(readFileSync(join(root, 'app.js'), 'utf8'));
const migDir = join(root, 'supabase', 'migrations');
const latest = noSqlComments(readFileSync(
  join(migDir, readdirSync(migDir).filter((f) => f.includes('usernames_are_chosen'))[0]), 'utf8'));

test('the app never builds a name out of the sign-in address', () => {
  assert.equal(/email[^\n]*\.split\('@'\)/.test(app), false,
    'app.js is splitting an email again — that string ends up on a byline');
});

test('the stand-in name the app invents matches the one the trigger mints', () => {
  const inApp = app.match(/`user-\$\{session\.user\.id\.replace\(\/-\/g, ''\)\.slice\(0, (\d+)\)\}`/);
  const inSql = latest.match(/'user-' \|\| substr\(replace\(new\.id::text, '-', ''\), 1, (\d+)\)/);
  assert.ok(inApp, 'app.js no longer mints the offline stand-in username');
  assert.ok(inSql, 'the signup trigger no longer mints a placeholder username');
  assert.equal(inApp[1], inSql[1],
    'the app and the trigger would show the same person two different placeholders');
});

test('the username column cannot be written from the client', () => {
  assert.match(latest, /revoke update on public\.profiles from anon, authenticated;/,
    'without this, anyone can PATCH their own username straight past set_username()');
  const grant = latest.match(/grant update \(([^)]*)\)\s*\n?\s*on public\.profiles to authenticated;/);
  assert.ok(grant, 'the migration no longer grants the columns the app does write');
  const cols = grant[1].split(',').map((c) => c.trim()).sort();
  assert.deepEqual(cols, ['avatar_path', 'display_name', 'prefs', 'setup_done'],
    'the writable column list has drifted from what the app actually updates');
  for (const col of cols) {
    assert.ok(app.includes(`${col}:`) || app.includes(`{ ${col} }`),
      `${col} is granted to the client but the app never writes it`);
  }
});

test('a name that has been let go is never handed to anybody else', () => {
  assert.match(latest, /if exists \(select 1 from public\.usernames u where u\.username = norm\)/,
    'set_username() checks something other than every name ever worn');
  assert.match(latest, /update public\.usernames set retired_at = now\(\)/,
    'set_username() no longer retires the old name, so it stays claimable');
  assert.equal(/delete from public\.usernames/.test(latest), false,
    'a retired username row must survive — deleting it puts the name back on the market');
});

test('the reserved words are held by nobody and can never be claimed', () => {
  const m = latest.match(/insert into public\.usernames \(username, user_id, retired_at\)\s*\nselect w, null, now\(\)/);
  assert.ok(m, 'reserved names are no longer inserted as retired rows owned by no one');
  for (const word of ['admin', 'atlas', 'support', 'security']) {
    assert.ok(latest.includes(`'${word}'`), `${word} is no longer reserved`);
  }
});

test('usernames are lowercase only, so two people cannot share a word', () => {
  assert.match(latest, /norm\s+text := lower\(btrim/,
    'set_username() no longer lowercases, so Silas and silas become two people');
  assert.match(latest, /\^\[a-z\]\[a-z0-9_\]\{2,19\}\$/,
    'the shape check has changed — it must stay lowercase-only');
});

test('nobody may read the table of every name ever worn', () => {
  assert.match(latest, /alter table public\.usernames enable row level security;/,
    'public.usernames has row-level security off — every retired name is readable');
  assert.equal(/create policy[^\n]*on public\.usernames/.test(latest), false,
    'a SELECT policy on public.usernames hands out the list this table exists to keep');
});
