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
  /create or replace function public\.(\w+)\(([^)]*)\)\s*returns ([\s\S]*?)\bas \$\$([\s\S]*?)\$\$/g)) {
  defined.set(m[1], {
    args: m[2], head: m[3], body: m[4],
    definer: /security definer/.test(m[3]),
    immutable: /\bimmutable\b/.test(m[3]),
  });
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
  //   has_page_access(page) — the argument is a page, not a person; the answer
  //     is still only about the caller.
  //   request_access(...)    — writes the caller's own request row, nobody else's.
  //   admin_set_access(target, ...) — the one that points at somebody else, and
  //     it refuses anybody who is not in site_admins before it reads a thing.
  //   request_connection(handle) — a username, the one thing a stranger may
  //     bring; it writes only a request FROM the caller.
  //   accept_connection(requester) — an id, but the request row addressed to
  //     the caller is the authorization; with no such row it does nothing.
  //   pin_audience_people(p_id) — authorizes first, with the visibility rule
  //     written out (not can_see_pin, which sees everything under DEFINER),
  //     and returns people, never groups.
  assert.deepEqual(argued.map(([n]) => n).sort(),
    ['accept_connection', 'admin_set_access', 'has_page_access', 'lookup_username',
     'pin_audience_people', 'request_access', 'request_connection', 'set_username'],
    'a SECURITY DEFINER function now takes an argument that nobody has argued for — see docs/audiences.md');
});

test('nothing that reads auth.uid() claims to be IMMUTABLE', () => {
  /* IMMUTABLE is a promise that the answer depends on nothing but the
   * arguments — same input, same answer, for everybody, forever. auth.uid()
   * reads the current request's JWT, which is a different answer per person.
   * Postgres does not check; it believes you, and is then free to fold the call
   * at plan time or reuse it from a cached plan on a pooled connection. In a
   * policy that is an authorization decision computed for one account and
   * handed to the next.
   *
   * can_add_to_group() shipped this way for a few hours. It was harmless only
   * because there are three people here who may all add each other. */
  for (const [name, fn] of defined) {
    if (!fn.immutable) continue;
    assert.equal(/auth\.uid\(\)/.test(fn.body), false,
      `public.${name}() is IMMUTABLE and reads auth.uid() — it must be STABLE`);
  }
});

test('everything that reads auth.uid() is at least STABLE', () => {
  // The other half: a function the planner thinks is VOLATILE is merely slow,
  // but one with no marking at all defaults to VOLATILE and gets re-run per
  // row. These are the read-side checks, and they are in hot policies.
  for (const fn of ['can_see_pin', 'can_add_to_group', 'people_i_can_draw']) {
    assert.match(defined.get(fn).head, /\bstable\b/,
      `public.${fn}() is not STABLE — it is called from a policy and will be re-evaluated per row`);
  }
});

/* ── the lock on the room ─────────────────────────────────────────────────────
 * Since sign-up opened (site_accounts.sql), `authenticated` means "has an
 * account", not "is crew". What keeps a stranger with an account out of the
 * pins is one RESTRICTIVE policy per table, ANDed with every permissive rule
 * already there, each asking has_page_access('atlas').
 *
 * On 2026-09-24 somebody deleted the one on public.pins and every test in this
 * directory stayed green — the only suite that runs the policies for real,
 * site-accounts.test.mjs, skips without a local Postgres and CI has none. So
 * the migrations are read the way Postgres would apply them: every CREATE and
 * DROP POLICY in order, last word wins, and at the end each table that holds
 * places must still be wearing its lock. */
const POLICY_RE = /(create|drop)\s+policy\s+(?:if exists\s+)?"([^"]+)"\s+on\s+([\w.]+)([\s\S]*?);/g;
const policies = new Map();                       // "schema.table" -> Map(name -> body)
for (const m of sql.matchAll(POLICY_RE)) {
  const [, verb, name, rawTable, body] = m;
  const table = rawTable.includes('.') ? rawTable : `public.${rawTable}`;
  if (!policies.has(table)) policies.set(table, new Map());
  if (verb === 'drop') policies.get(table).delete(name);
  else policies.get(table).set(name, body);
}

/* Every table with row-level security on, minus the gate's own tables: the
 * request queue and the approvals are what a waiting account HAS to be able
 * to reach, and site_pages is the sign-up form's menu. */
const GATE_TABLES = new Set(['public.access_requests', 'public.site_access',
                             'public.site_admins', 'public.site_pages']);
const rlsTables = [...new Set([...sql.matchAll(/alter table (public\.\w+)\s+enable row level security/g)]
  .map((m) => m[1]))].filter((t) => !GATE_TABLES.has(t));

/* The tables in this project that belong to another page on the site account,
 * not to ATLAS. Each is still held to the same rule — a restrictive lock on
 * every row — only asking for its own page. Anything not named here is ATLAS's
 * and must ask for 'atlas', so a new table can never slip through unlocked by
 * being left off a list. */
const OTHER_PAGE = new Map([
  ['public.trial_watch', 'studies'],      // Psyche → Studies, the trial watchlist
]);

const locked = (body, page) => /\bas restrictive\b/.test(body)
  && /\bfor all\b/.test(body)
  && /\bto authenticated\b/.test(body)
  /* Each clause on its own: the USING match may not run on into WITH CHECK,
   * or a policy whose using asks the wrong page passes on the strength of a
   * right with check. */
  && new RegExp(`using \\((?:(?!with check)[\\s\\S])*has_page_access\\('${page}'\\)`).test(body)
  && new RegExp(`with check \\([\\s\\S]*has_page_access\\('${page}'\\)`).test(body);

test('every table that holds places is behind a restrictive has_page_access policy', () => {
  assert.ok(rlsTables.includes('public.pins'), 'the pins table is not RLS-enabled — or the test cannot see it');
  for (const table of rlsTables) {
    const mine = policies.get(table) || new Map();
    const page = OTHER_PAGE.get(table) || 'atlas';
    const lock = [...mine.values()].find((body) => locked(body, page));
    assert.ok(lock,
      `${table} has no surviving restrictive policy asking has_page_access('${page}') — ` +
      `an account that was merely created, never approved, can read it`);
  }
});

test('the photo buckets are behind the same lock', () => {
  const mine = policies.get('storage.objects') || new Map();
  const lock = [...mine.values()].find((b) => /\bas restrictive\b/.test(b) && /has_page_access\('atlas'\)/.test(b));
  assert.ok(lock, 'storage.objects has no restrictive policy — pin photos and avatars are open to any account');
  for (const bucket of ['pin-photos', 'avatars']) {
    assert.match(lock, new RegExp(`'${bucket}'`), `the storage lock does not name the ${bucket} bucket`);
  }
});

test('a restrictive policy is restrictive on every table it is on', () => {
  // A copy-paste that drops `as restrictive` turns the lock into one more
  // permissive rule — ORed in, so it opens a door instead of closing one.
  for (const [table, mine] of policies) {
    for (const [name, body] of mine) {
      if (!/approved people/.test(name)) continue;
      assert.match(body, /\bas restrictive\b/, `"${name}" on ${table} is not restrictive — it is ORed in, not ANDed`);
    }
  }
});

/* ── 2026-10-17 bug sweep: things only the files can hold ── */
const here = dirname(fileURLToPath(import.meta.url));
const atlasFile = (f) => readFileSync(join(here, '..', f), 'utf8');

test('seed.sql grants nothing — the migrations do (A3a-6)', () => {
  const seed = atlasFile('supabase/seed.sql').replace(/--.*$/gm, '');
  assert.doesNotMatch(seed, /\bgrant\b/i,
    'a blanket grant in the seed undoes the profiles column lock locally');
});

test('outside scripts are pinned with an integrity hash (A3b-6)', () => {
  const html = atlasFile('index.html');
  const outside = [...html.matchAll(/<(script|link)\b[^>]*(?:src|href)="https:\/\/[^"]+"[^>]*>/g)].map((m) => m[0]);
  assert.ok(outside.length >= 3);
  for (const tag of outside) {
    assert.match(tag, /integrity="sha384-[A-Za-z0-9+/=]+"/, tag);
    assert.match(tag, /crossorigin="anonymous"/, tag);
    assert.doesNotMatch(tag, /@\d+\/|@latest/, `not an exact version: ${tag}`);
  }
});

test('the service worker deletes only its own old caches (C4-1)', () => {
  const sw = atlasFile('sw.js');
  assert.match(sw, /k\.startsWith\('atlas-shell-'\)/);
});

/* ── audiences (20261022120000_connections_and_audiences.sql) ──────────────
 * can_see_pin() is now "the pins policy returns this row". That is only true
 * when it runs as the caller: inside a SECURITY DEFINER function RLS is off,
 * and it would say yes to every pin in the database. The first draft of
 * docs/audiences.md gated pin_audience_people() on it exactly that way. */
test('no SECURITY DEFINER function gates on can_see_pin()', () => {
  for (const [name, fn] of defined) {
    if (!fn.definer) continue;
    assert.equal(/can_see_pin\s*\(/.test(fn.body), false,
      `public.${name}() is SECURITY DEFINER and asks can_see_pin() — in there RLS is off, so it is true for every pin`);
  }
});

test('who sees a pin is decided by grants, and is_private is gone', () => {
  const pinPolicies = policies.get('public.pins');
  for (const [name, body] of pinPolicies) {
    assert.equal(/is_private/.test(body), false, `pins policy "${name}" still reads is_private`);
  }
  const read = pinPolicies.get('who can see a pin');
  assert.ok(read, 'the pins SELECT policy is missing');
  assert.match(read, /for select/);
  assert.match(read, /created_by = auth\.uid\(\)/, 'the finder no longer sees their own pin');
  assert.match(read, /coalesce\(parent_id, id\)/, 'a parking spot no longer follows its pin');
  assert.match(read, /\(select public\.pins_shared_with_me\(\)\)/,
    'the grant check is not an InitPlan any more — it will run once per pin');
  assert.match(sql, /alter table public\.pins drop column is_private;/,
    'is_private is still a column — an old app writing it would succeed silently');
  assert.equal(/\bis_private\b/.test(defined.get('people_i_can_draw').body), false);
});

test('nobody writes a connection or a request by hand', () => {
  // A request goes in by username through request_connection(), never by an
  // id somebody saw on a pin; a connection only through accept_connection().
  for (const t of ['connections', 'connection_requests']) {
    for (const [name, body] of policies.get(`public.${t}`) || []) {
      assert.equal(/for (insert|update|all)\b/.test(body) && !/\bas restrictive\b/.test(body), false,
        `"${name}" lets the client write public.${t} directly`);
    }
    assert.equal(new RegExp(`grant[^;]*\\b(insert|update)\\b[^;]*on[^;]*public\\.${t}\\b[^;]*to authenticated`).test(sql), false,
      `authenticated was granted a write on public.${t}`);
  }
});

test('a grant needs your own pin and a connection or a group of yours', () => {
  const ins = policies.get('public.pin_audience').get('you share your own pins');
  assert.ok(ins, 'the pin_audience insert policy is missing');
  assert.match(ins, /p\.created_by = auth\.uid\(\)/, 'anybody who can see a pin could widen it');
  assert.match(ins, /p\.parent_id is null/, 'a parking spot could carry grants of its own');
  assert.match(ins, /g\.owner = auth\.uid\(\)/, 'somebody else\'s group could be granted');
  assert.match(ins, /public\.can_add_to_group\(user_id\)/, 'a stranger could be granted a pin');
  assert.match(defined.get('can_add_to_group').body, /public\.connections/,
    'group membership is no longer gated on a connection');
});
