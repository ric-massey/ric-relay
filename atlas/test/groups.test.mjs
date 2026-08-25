/* A group is private, and there is exactly one seam where that could stop being
 * true. These check the shape of the migration and of the screen that drives it.
 *
 * Grep tests, like usernames.test.mjs: the rules live in Postgres and there is
 * no database here, but "no policy lets a member read the group they are in" is
 * a fact about the text of the migration, and it is the fact that has to keep
 * being true. See docs/audiences.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app  = readFileSync(join(root, 'app.js'), 'utf8');
const migDir = join(root, 'supabase', 'migrations');
const sql = readFileSync(
  join(migDir, readdirSync(migDir).filter((f) => f.endsWith('_groups.sql'))[0]), 'utf8');

test('both tables have row-level security on', () => {
  for (const t of ['groups', 'group_members']) {
    assert.match(sql, new RegExp(`alter table public\\.${t}\\s+enable row level security;`),
      `public.${t} would be readable by anybody signed in`);
  }
});

test('every policy is scoped to the owner of the group', () => {
  const policies = [...sql.matchAll(/create policy "([^"]+)" on public\.(group_members|groups)([\s\S]*?);\n/g)];
  assert.ok(policies.length >= 4, 'the policy set has shrunk — check what is no longer guarded');
  for (const [body, name, table] of policies) {
    assert.ok(/owner = auth\.uid\(\)/.test(body),
      `policy "${name}" on ${table} does not check the owner, so somebody else's group is in reach`);
  }
});

test('nothing lets a member read the group they are in', () => {
  // The leak this would be: a member reads the row, and gets its name and the
  // rest of the membership — every person you have grouped, handed to every
  // person you have grouped.
  assert.equal(/using \([^)]*user_id = auth\.uid\(\)/.test(sql), false,
    'a policy matches on the MEMBER rather than the owner — being in a group is not a thing you are told');
});

test('membership goes through one gate, and it is a function', () => {
  assert.match(sql, /create or replace function public\.can_add_to_group\(who uuid\)/,
    'the seam where the mutual-connection check has to land is gone');
  assert.match(sql, /and public\.can_add_to_group\(user_id\)/,
    'the insert policy no longer gates on can_add_to_group');
  assert.equal(/security definer/.test(sql.slice(sql.indexOf('can_add_to_group'), sql.indexOf('lookup_username'))), false,
    'can_add_to_group must stay SECURITY INVOKER — it is the check, so it must not see further than its caller');
  assert.match(sql, /who <> auth\.uid\(\)/,
    'you can put yourself in your own group, which means a headcount lies about who it reaches');
});

test('a membership is granted or gone, never edited', () => {
  assert.equal(/for update to authenticated[\s\S]{0,120}group_members/.test(sql), false,
    'group_members has an update policy — a membership that can be edited can be moved to somebody else');
});

/* The body of lookup_username(), and only that: the comments around it discuss
 * email and fuzzy matching at length, and a grep over the whole file would be
 * testing the prose rather than the query. */
const lookupBody = (() => {
  const from = sql.indexOf('create or replace function public.lookup_username');
  assert.notEqual(from, -1, 'lookup_username is gone — there is no way to find a person');
  const open = sql.indexOf('as $$', from);
  return sql.slice(open, sql.indexOf('$$;', open));
})();

test('finding people is exact username only, and never by email', () => {
  assert.match(lookupBody, /where u\.username = lower\(btrim\(coalesce\(handle, ''\)\)\)/,
    'lookup_username no longer matches an exact lowercased username');
  assert.match(lookupBody, /and u\.retired_at is null/,
    'the lookup finds retired names, so a name somebody let go still leads to them');
  assert.match(lookupBody, /limit 1/,
    'the lookup can return more than one row — that is a list, and lists are browsable');
  for (const loose of [/\bi?like\b/, /\bsimilar to\b/, /~/, /%/]) {
    assert.equal(loose.test(lookupBody), false,
      `${loose} is in the lookup — a fuzzy or prefix match makes people browsable`);
  }
  assert.equal(/auth\.users|email/.test(lookupBody), false,
    'the lookup touches email — an address is guessable, so answering one is an oracle for who is here');
});

test('the app never writes group rows without signal', () => {
  const block = app.slice(app.indexOf('let groups = ['), app.indexOf('function whoamiChip'));
  for (const fn of ['newGroup', 'renameGroup', 'deleteGroup', 'addToGroup', 'removeFromGroup']) {
    const body = block.slice(block.indexOf(`function ${fn}(`));
    assert.ok(/if \(!online\(\)\)/.test(body.slice(0, 700)),
      `${fn}() does not check for signal — a group decides who sees your places and must not be half-applied`);
  }
});

test('the app asks for a person by username, never by id', () => {
  const block = app.slice(app.indexOf('async function addToGroup'), app.indexOf('async function removeFromGroup'));
  assert.match(block, /db\.rpc\('lookup_username', \{ handle: want \}\)/,
    'adding somebody no longer goes through the username lookup');
  assert.equal(/insert\(\{ group_id: id, user_id: [^w]/.test(block), false,
    'a user id is going into group_members from somewhere other than the lookup');
});
