/* The trial watchlist's locks — node projects/psyche/test/watch-policy.test.mjs
   The list lives in the site account's Supabase project, and the only thing
   keeping one person's tracked studies from another is row-level security.
   CI has no database, so this reads the migrations the way Postgres would
   apply them (comments stripped — the prose explains every rule, so a grep
   over the raw text would find the sentence about a policy and pass without
   the policy) and fails if a lock goes missing. */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'atlas', 'supabase', 'migrations');
const sql = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  .map(f => readFileSync(join(dir, f), 'utf8')).join('\n').replace(/--[^\n]*/g, '').replace(/\s+/g, ' ');

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + msg); if (!cond) failures++; };

console.log('\nRULE  a watchlist is its owner\'s, and only with Studies switched on');
ok(/insert into public\.site_pages[^;]*'studies'/.test(sql), 'Studies is a page Ric can approve on /account/');
ok(/create table if not exists public\.trial_watch/.test(sql), 'the table exists');
ok(/alter table public\.trial_watch enable row level security/.test(sql), 'with row-level security on');
const own = sql.match(/create policy "[^"]+" on public\.trial_watch for all to authenticated using \(user_id = auth\.uid\(\)\) with check \(user_id = auth\.uid\(\)\)/);
ok(!!own, 'each person reads and writes only their own rows');
const gate = sql.match(/create policy "[^"]+" on public\.trial_watch as restrictive for all to authenticated using \(public\.has_page_access\('studies'\)\) with check \(public\.has_page_access\('studies'\)\)/);
ok(!!gate, 'and only once Ric has approved the account for Studies (restrictive, so it is ANDed)');
ok(!/on public\.trial_watch[^;]*using \(true\)/.test(sql), 'no policy opens it to everybody');
ok(!/on public\.trial_watch[^;]*to anon/.test(sql) && /revoke all on public\.trial_watch from anon/.test(sql), 'a visitor with no account gets nothing');
ok(/create trigger trial_watch_cap before insert on public\.trial_watch/.test(sql), 'and one account is capped');

console.log('\n' + (failures ? `${failures} FAILURE${failures > 1 ? 'S' : ''}` : 'ALL WATCHLIST POLICY RULES PASS'));
process.exit(failures ? 1 : 0);
