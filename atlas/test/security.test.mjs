/* Every SECURITY DEFINER function has to be shut to anon, and the reason this
 * is a test is that it has already been got wrong once.
 *
 * A Postgres function is EXECUTE-able by PUBLIC unless somebody says otherwise,
 * and PUBLIC includes `anon` — the role every unauthenticated request arrives
 * as. people_i_can_draw() shipped without its revoke, and because DEFINER reads
 * past every policy, an anonymous request with nothing but the publishable key
 * got back a list of real user ids. The function was right and the policy that
 * used it was right; the hole was in neither.
 *
 * So: the whole migration set is read in order, the last definition of each
 * function wins, and anything marked DEFINER must be revoked somewhere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const migDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const files  = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();

/* Comments stripped first, and that is not tidiness. These migrations explain
 * themselves at length, and every rule below is discussed in prose somewhere
 * near the statement that implements it — so a grep over the raw text finds the
 * sentence ABOUT the revoke and goes green whether or not the revoke is there.
 * Commenting one out was the check that caught this. */
const sql = files
  .map((f) => readFileSync(join(migDir, f), 'utf8'))
  .join('\n')
  .replace(/--[^\n]*/g, '');

/* Last definition of each function wins — can_add_to_group has already been
 * redefined once, and a test reading the first one would go green on a
 * definition nothing uses. */
const defined = new Map();
for (const m of sql.matchAll(
  /create or replace function public\.(\w+)\(([^)]*)\)\s*returns ([\s\S]*?)\bas \$\$/g)) {
  defined.set(m[1], { args: m[2], head: m[3], definer: /security definer/.test(m[3]) });
}

test('the migration set defines the functions this app runs on', () => {
  for (const fn of ['can_see_pin', 'can_add_to_group', 'lookup_username',
                    'set_username', 'people_i_can_draw', 'handle_new_user']) {
    assert.ok(defined.has(fn), `public.${fn}() is not defined anywhere`);
  }
});

test('every SECURITY DEFINER function is revoked from anon', () => {
  for (const [name, fn] of defined) {
    if (!fn.definer) continue;
    // A trigger function cannot be reached over the API at all.
    if (/\btrigger\b/.test(fn.head)) continue;
    const revoked = new RegExp(
      `revoke all on function public\\.${name}\\([^)]*\\) from public, anon;`).test(sql);
    assert.ok(revoked,
      `public.${name}() is SECURITY DEFINER with no revoke — anon can call it, and it reads past every policy`);
  }
});

test('every revoked function is granted back to signed-in people', () => {
  for (const m of sql.matchAll(/revoke all on function public\.(\w+)\(([^)]*)\) from public, anon;/g)) {
    assert.match(sql, new RegExp(`grant execute on function public\\.${m[1]}\\([^)]*\\) to authenticated;`),
      `public.${m[1]}() was revoked and never granted back — the app cannot call it either`);
  }
});

test('the two functions that ARE the check stay SECURITY INVOKER', () => {
  // can_see_pin takes a pin id and performs no check of its own: it IS the
  // check, so DEFINER would hand out exactly what it exists to withhold.
  // can_add_to_group is the same shape for writes.
  for (const fn of ['can_see_pin', 'can_add_to_group']) {
    assert.equal(defined.get(fn).definer, false,
      `public.${fn}() has been made SECURITY DEFINER — it is the gate, so it must not see further than its caller`);
  }
});

test('the DEFINER functions that take an argument justify it', () => {
  // The rule from docs/audiences.md: a DEFINER function may return only facts
  // about the caller, or facts it has itself authorized. Taking no parameters
  // is what makes the first kind provably safe — there is nothing to point it
  // at somebody else. Anything DEFINER that DOES take an argument is on a short
  // list that has been thought about one at a time.
  const argued = [...defined].filter(([, f]) => f.definer && f.args.trim() && !/\btrigger\b/.test(f.head));
  assert.deepEqual(argued.map(([n]) => n).sort(), ['lookup_username', 'set_username'],
    'a SECURITY DEFINER function now takes an argument that nobody has argued for — see docs/audiences.md');
});
