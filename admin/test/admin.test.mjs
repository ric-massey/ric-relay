// ricmassey.com/admin — every account on the site and in KONDRITE.
//
// Four parts, each tested from its own angle:
//   · the site-admin server function holds the service_role key, so the one
//     property that matters is that it refuses everybody who is not in
//     site_admins, on every action, before touching anything;
//   · KONDRITE's admin.sql reads past row-level security into every player's
//     email, so each function is held to its is_admin() line (read as text,
//     because CI has no Postgres);
//   · view.js draws names and notes strangers typed, so it runs here against
//     hostile input;
//   · kondrite.js shares the game's session and turns refusals into states;
//   · analytics.js draws paths, referrers, campaign tags and city names that
//     came from strangers' browsers, so it runs against hostile input too.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const { createHandler, composeMail } = await import('../../atlas/supabase/functions/site-admin/index.ts');

let failed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

// ═══ the server function ═══════════════════════════════════════════════════

const RIC = { id: 'ric', email: 'ric@x.test' };
const users = () => ([
  { id: 'ric', email: 'ric@x.test', email_confirmed_at: '2026-01-01', created_at: '2026-01-01', user_metadata: {} },
  { id: 'u1', email: 'a@x.test', email_confirmed_at: null, invited_at: '2026-10-01', created_at: '2026-10-01', user_metadata: { display_name: 'Ann' } },
  { id: 'u2', email: 'b@x.test', email_confirmed_at: '2026-10-02', created_at: '2026-10-02', banned_until: '2099-01-01', user_metadata: {} },
]);

// A fake service-role client that records every call it is asked to make.
function fakeAdmin({ admins = ['ric'], tokens = { good: RIC, other: { id: 'u1', email: 'a@x.test' } } } = {}) {
  const calls = [];
  const rec = (name, out) => (...args) => { calls.push([name, ...args]); return Promise.resolve(typeof out === 'function' ? out(...args) : out); };
  const tables = {
    site_admins: admins.map((user_id) => ({ user_id })),
    access_requests: [{ user_id: 'u1', name: 'Ann B', status: 'pending', pages: ['atlas'], note: '' }],
    site_access: [{ user_id: 'u2', page_key: 'atlas' }],
    profiles: [{ id: 'u2', username: 'bee' }],
  };
  const from = (t) => {
    const q = {
      _rows: tables[t] || [], _filter: null,
      select() { return q; },
      eq(col, v) { q._filter = [col, v]; return q; },
      maybeSingle() { const r = q._rows.find((x) => x[q._filter[0]] === q._filter[1]); return Promise.resolve({ data: r || null }); },
      update(row) { calls.push(['update', t, row]); return { eq: (c, v) => { calls.push(['update.eq', t, c, v]); return Promise.resolve({}); } }; },
      then(res) { return Promise.resolve({ data: q._rows }).then(res); },
    };
    return q;
  };
  const all = users();
  return {
    calls,
    client: {
      from,
      auth: {
        getUser: (jwt) => Promise.resolve(tokens[jwt] ? { data: { user: tokens[jwt] } } : { data: null, error: { message: 'bad jwt' } }),
        resetPasswordForEmail: rec('resetPasswordForEmail', { error: null }),
        resend: rec('resend', { error: null }),
        admin: {
          getUserById: (id) => { calls.push(['getUserById', id]); const u = all.find((x) => x.id === id); return Promise.resolve(u ? { data: { user: u } } : { data: null, error: { message: 'nope' } }); },
          listUsers: rec('listUsers', { data: { users: all } }),
          inviteUserByEmail: rec('inviteUserByEmail', (email) => (email === 'b@x.test' ? { error: { message: 'A user with this email address has already been registered' } } : { data: { user: { id: 'new' } } })),
          updateUserById: rec('updateUserById', { error: null }),
          deleteUser: rec('deleteUser', { error: null }),
        },
      },
    },
  };
}

const MUTATING = ['getUserById', 'listUsers', 'inviteUserByEmail', 'updateUserById', 'deleteUser', 'resetPasswordForEmail', 'resend', 'update', 'fetch'];

async function hit({ token = 'good', body = {}, method = 'POST', origin = 'https://ricmassey.com', admin = fakeAdmin(), env = {}, fetchImpl } = {}) {
  const sent = [];
  const fetchFn = fetchImpl || (async (url, opts) => { sent.push({ url, body: JSON.parse(opts.body), headers: opts.headers }); admin.calls.push(['fetch']); return { ok: true, status: 200, json: async () => ({}) }; });
  const handle = createHandler({ admin: admin.client, env, fetch: fetchFn });
  const headers = new Headers({ origin });
  if (token) headers.set('authorization', 'Bearer ' + token);
  const req = new Request('https://fn.test/site-admin', { method, headers, body: method === 'POST' ? JSON.stringify(body) : undefined });
  const res = await handle(req);
  const text = await res.text();
  return { res, json: text ? JSON.parse(text) : null, calls: admin.calls, sent };
}

const ACTIONS = {
  list: {}, invite: { email: 'n@x.test' }, update: { id: 'u1', name: 'X' }, reset: { id: 'u1' }, resend: { id: 'u1' },
  ban: { id: 'u1', hours: 1 }, delete: { id: 'u1' }, email: { to: ['a@x.test'], subject: 's', text: 't' },
};

test('server: no sign-in is 401, and nothing is touched', async () => {
  for (const [action, args] of Object.entries(ACTIONS)) {
    const { res, calls } = await hit({ token: null, body: { action, ...args } });
    assert.equal(res.status, 401, action);
    assert.ok(!calls.some(([c]) => MUTATING.includes(c)), `${action} did something for a stranger`);
  }
});

test('server: a signed-in non-admin is 403 on every action, and nothing is touched', async () => {
  for (const [action, args] of Object.entries(ACTIONS)) {
    const { res, json, calls } = await hit({ token: 'other', body: { action, ...args }, env: { RESEND_API_KEY: 'k', MAIL_FROM: 'f' } });
    assert.equal(res.status, 403, action);
    assert.equal(json.error, 'Admins only.');
    assert.ok(!calls.some(([c]) => MUTATING.includes(c)), `${action} did something for a non-admin`);
  }
});

test('server: a forged token is 401', async () => {
  const { res } = await hit({ token: 'forged', body: { action: 'list' } });
  assert.equal(res.status, 401);
});

test('server: every action in the file is in the refusal tests above', () => {
  const src = read('atlas/supabase/functions/site-admin/index.ts');
  const block = src.slice(src.indexOf('const actions = {'), src.indexOf('return async function handle'));
  const defined = [...block.matchAll(/^    (?:async )?(\w+)\(/gm)].map((m) => m[1]).sort();
  assert.deepEqual(defined, Object.keys(ACTIONS).sort(), 'a new action needs a line in ACTIONS so the 401/403 tests cover it');
});

test('server: unknown and prototype actions are refused', async () => {
  for (const action of ['nope', '__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    const { res } = await hit({ body: { action } });
    assert.equal(res.status, 400, action);
  }
});

test('server: only POST, and CORS only echoes the site and localhost', async () => {
  assert.equal((await hit({ method: 'GET' })).res.status, 405);
  const pre = await hit({ method: 'OPTIONS' });
  assert.equal(pre.res.status, 204);
  assert.equal(pre.res.headers.get('access-control-allow-origin'), 'https://ricmassey.com');
  assert.equal((await hit({ method: 'OPTIONS', origin: 'http://localhost:8913' })).res.headers.get('access-control-allow-origin'), 'http://localhost:8913');
  assert.equal((await hit({ method: 'OPTIONS', origin: 'https://evil.test' })).res.headers.get('access-control-allow-origin'), 'https://ricmassey.com');
  assert.equal((await hit({ method: 'OPTIONS', origin: 'https://ricmassey.com.evil.test' })).res.headers.get('access-control-allow-origin'), 'https://ricmassey.com');
});

test('server: list merges auth facts with access, and marks admins', async () => {
  const { json } = await hit({ body: { action: 'list' } });
  const by = Object.fromEntries(json.map((p) => [p.id, p]));
  assert.equal(by.ric.status, 'admin');
  assert.equal(by.ric.is_admin, true);
  assert.equal(by.u1.name, 'Ann B');
  assert.equal(by.u1.invited, true);
  assert.equal(by.u1.confirmed, false);
  assert.deepEqual(by.u2.pages, ['atlas']);
  assert.equal(by.u2.username, 'bee');
  assert.equal(by.u2.banned_until, '2099-01-01');
  assert.deepEqual(json.map((p) => p.id), ['u2', 'u1', 'ric'], 'newest first');
});

test('server: Ric cannot ban or delete himself', async () => {
  for (const action of ['ban', 'delete']) {
    const { res, calls } = await hit({ body: { action, id: 'ric', hours: 1 } });
    assert.equal(res.status, 400, action);
    assert.ok(!calls.some(([c]) => c === 'updateUserById' || c === 'deleteUser'));
  }
});

test('server: ban takes whole hours, and zero lifts it', async () => {
  for (const [hours, want] of [[24, '24h'], [0, 'none']]) {
    const { calls } = await hit({ body: { action: 'ban', id: 'u1', hours } });
    assert.deepEqual(calls.find(([c]) => c === 'updateUserById').slice(1), ['u1', { ban_duration: want }]);
  }
  for (const hours of [-1, 1.5, 'x', null]) {
    assert.equal((await hit({ body: { action: 'ban', id: 'u1', hours } })).res.status, 400, String(hours));
  }
});

test('server: invite checks the address and says plainly when it exists', async () => {
  assert.equal((await hit({ body: { action: 'invite', email: 'nope' } })).res.status, 400);
  const dup = await hit({ body: { action: 'invite', email: 'B@x.test' } });
  assert.equal(dup.json.error, 'That email already has an account.');
  const ok = await hit({ body: { action: 'invite', email: ' New@X.test ', name: 'Newt' } });
  assert.equal(ok.json.id, 'new');
  const inv = ok.calls.find(([c]) => c === 'inviteUserByEmail');
  assert.equal(inv[1], 'new@x.test');
  assert.match(inv[2].redirectTo, /\/atlas\/$/);
});

test('server: email is refused until it is set up, and never sends then', async () => {
  const { res, sent } = await hit({ body: { action: 'email', ...ACTIONS.email } });
  assert.equal(res.status, 503);
  assert.equal(sent.length, 0);
});

test('server: email sends one message per person, so nobody sees another address', async () => {
  const env = { RESEND_API_KEY: 'k', MAIL_FROM: 'Ric <ric@ricmassey.com>', MAIL_REPLY_TO: 'me@x.test' };
  const { json, sent } = await hit({ env, body: { action: 'email', to: ['a@x.test', 'B@x.test', 'a@x.test'], subject: 'Hi', text: 'One\n\nTwo <b>' } });
  assert.equal(json.sent, 2);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].url, 'https://api.resend.com/emails/batch');
  assert.equal(sent[0].headers.Authorization, 'Bearer k');
  const batch = sent[0].body;
  assert.deepEqual(batch.map((m) => m.to), [['a@x.test'], ['b@x.test']]);
  for (const m of batch) {
    assert.equal(m.from, env.MAIL_FROM);
    assert.equal(m.reply_to, env.MAIL_REPLY_TO);
    assert.equal(m.text, 'One\n\nTwo <b>', 'plain text goes as typed');
    assert.ok(m.html.includes('Two &lt;b&gt;') && !m.html.includes('<b>'), 'the HTML copy is escaped');
  }
});

test('server: email limits — nobody, too many, bad address, empty subject or body', async () => {
  const env = { RESEND_API_KEY: 'k', MAIL_FROM: 'f' };
  const many = Array.from({ length: 101 }, (_, i) => `p${i}@x.test`);
  for (const body of [
    { to: [], subject: 's', text: 't' }, { to: many, subject: 's', text: 't' }, { to: ['nope'], subject: 's', text: 't' },
    { to: ['a@x.test'], subject: ' ', text: 't' }, { to: ['a@x.test'], subject: 's', text: '' },
    { to: ['a@x.test'], subject: 'x'.repeat(151), text: 't' }, { to: 'a@x.test', subject: 's', text: 't' },
  ]) {
    const { res, sent } = await hit({ env, body: { action: 'email', ...body } });
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 60));
    assert.equal(sent.length, 0);
  }
});

test('server: a Resend refusal comes back as its message', async () => {
  const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({ message: 'The ricmassey.com domain is not verified.' }) });
  const { res, json } = await hit({ env: { RESEND_API_KEY: 'k', MAIL_FROM: 'f' }, fetchImpl, body: { action: 'email', ...ACTIONS.email } });
  assert.equal(res.status, 502);
  assert.match(json.error, /not verified/);
});

test('server: an unexpected crash says nothing about why', async () => {
  const admin = fakeAdmin();
  admin.client.auth.admin.listUsers = () => { throw new Error('secret internals'); };
  const { res, json } = await hit({ admin, body: { action: 'list' } });
  assert.equal(res.status, 500);
  assert.equal(json.error, 'Something went wrong.');
});

test('server: resend re-invites the invited and re-confirms the rest', async () => {
  const a = await hit({ body: { action: 'resend', id: 'u1' } });
  assert.ok(a.calls.some(([c]) => c === 'inviteUserByEmail'));
  const b = await hit({ body: { action: 'resend', id: 'u2' } });
  assert.equal(b.res.status, 400, 'already confirmed');
});

test('server: the service key and Resend key come from the environment, never the file', () => {
  const src = read('atlas/supabase/functions/site-admin/index.ts');
  assert.ok(!/eyJ[\w-]{20,}|sb_secret_|re_[A-Za-z0-9]{16,}/.test(src), 'a key is written into the function');
  assert.match(src, /env\.SUPABASE_SERVICE_ROLE_KEY/);
});

test('mail: composeMail leaves out reply_to when there is none', () => {
  assert.ok(!('reply_to' in composeMail({ from: 'f', to: 't', subject: 's', text: 'x' })));
});

// ═══ KONDRITE's admin.sql ══════════════════════════════════════════════════

const SQL = read('projects/kondrite/supabase/admin.sql');
const SCHEMA = read('projects/kondrite/supabase/schema.sql');
const CLOUD = read('projects/kondrite/cloud.js');
const KJS = read('admin/kondrite.js');
const code = SQL.replace(/--[^\n]*/g, '');
const functions = [...code.matchAll(
  /create or replace function public\.(\w+)\(([^)]*)\)([\s\S]*?)\$\$([\s\S]*?)\$\$;/g,
)].map(([, name, params, head, body]) => ({ name, params, head, body }));

test('sql: every function is security definer with a pinned search_path', () => {
  assert.ok(functions.length >= 7);
  for (const f of functions) {
    assert.match(f.head, /security definer/, `${f.name}() is not security definer`);
    assert.match(f.head, /set search_path = public/, `${f.name}() leaves search_path open`);
  }
});

test('sql: every admin_ function asks is_admin() before it does anything', () => {
  for (const f of functions.filter((x) => x.name.startsWith('admin_'))) {
    const first = f.body.slice(f.body.indexOf('begin') + 5).trim();
    assert.match(first, /^if not public\.is_admin\(\) then\s+raise exception 'admins only' using errcode = '42501';/, f.name);
  }
});

test('sql: anon can run none of them, and authenticated can run each', () => {
  for (const f of functions) {
    const sig = f.params.split(',').map((p) => p.trim().split(/\s+/).slice(1).join(' ')).filter(Boolean).join(', ');
    const call = `public.${f.name}(${sig})`;
    assert.ok(code.includes(`revoke all on function ${call} from public, anon;`), `no revoke for ${call}`);
    assert.ok(code.includes(`grant execute on function ${call} to authenticated;`), `no grant for ${call}`);
    assert.ok(!new RegExp(`grant[^;]*${f.name}[^;]*to[^;]*anon`).test(code), `${f.name}() is granted to anon`);
  }
});

test('sql: nobody makes themself an admin from a browser', () => {
  assert.match(code, /alter table public\.admins enable row level security;/);
  assert.ok(!/create policy[^;]*on public\.admins[^;]*for (insert|update|delete|all)/i.test(code));
  assert.match(code, /revoke insert, update, delete on public\.admins from anon, authenticated;/);
});

test('sql: ban and delete refuse the admin themself; the roster carries no save book', () => {
  for (const name of ['admin_ban_pilot', 'admin_delete_pilot']) {
    assert.match(functions.find((x) => x.name === name).body, /if target = auth\.uid\(\) then\s+raise exception/, name);
  }
  const roster = functions.find((x) => x.name === 'admin_pilots').body.replace(/length\(s\.book\)/g, '');
  assert.ok(!/s\.book/.test(roster));
});

test('sql: a rename meets the same name rule as the game and the table', () => {
  const pilot = CLOUD.match(/ok: n => \/(.+?)\/\.test\(n\)/)[1];
  assert.equal(SCHEMA.match(/check \(name ~ '(.+?)'\)/)[1], pilot);
  assert.equal(functions.find((x) => x.name === 'admin_rename_pilot').body.match(/clean !~ '(.+?)'/)[1], pilot);
});

test('sql: kondrite.js calls only functions admin.sql defines, with its argument names', () => {
  const defined = Object.fromEntries(functions.map((f) => [f.name,
    f.params.split(',').map((p) => p.trim().split(/\s+/)[0]).filter(Boolean).sort().join(',')]));
  const calls = [...KJS.matchAll(/rpc\('(\w+)'(?:, \{ ([^}]*) \})?\)/g)];
  assert.ok(calls.length >= 6);
  for (const [, fn, args = ''] of calls) {
    assert.ok(defined[fn] !== undefined, `kondrite.js calls ${fn}()`);
    const names = args.split(',').map((a) => a.split(':')[0].trim()).filter(Boolean).sort().join(',');
    assert.equal(names, defined[fn], fn);
  }
});

// ═══ view.js ═══════════════════════════════════════════════════════════════

const viewBox = { window: {}, Date };
vm.createContext(viewBox);
vm.runInContext(read('admin/view.js'), viewBox);
const V = viewBox.window.AdminView;
const EVIL = '<img src=x onerror=alert(1)>';
const MARKUP = /<img|<script|<b>|<svg|" onmouseover/;
const sitePerson = (o = {}) => ({ id: 'u1', email: 'a@x.test', name: 'Ann', username: '', note: '', status: 'approved', requested: [], pages: ['atlas'],
  is_admin: false, confirmed: true, invited: false, banned_until: null, created_at: '2026-10-01T00:00:00Z', last_sign_in_at: null, ...o });

test('view: every string a stranger typed is drawn as text', () => {
  const p = sitePerson({ id: `"><script>x</script>`, name: EVIL, email: `" onmouseover="x`, username: '<b>u', note: '<svg onload=1>', requested: ['<b>p'], status: 'pending' });
  const pages = [{ key: 'atlas', label: '<b>ATLAS' }];
  const out = V.row(p, { active: true, side: '<b>side' }) + V.siteDetails(p, pages, { draft: { name: EVIL, email: '<b>' } })
    + V.badgeHtml(p) + V.listHead(1, 0);
  assert.ok(!MARKUP.test(out), out.match(MARKUP) && out.slice(Math.max(0, out.search(MARKUP) - 40), out.search(MARKUP) + 40));
  assert.ok(out.includes('&lt;img src=x onerror=alert(1)&gt;'));
  const pilot = { id: '<b>', email: EVIL, name: EVIL, best: { '<b>g': 1 }, save_seed: '<b>', has_save: true, reports: 1, created_at: null };
  assert.ok(!MARKUP.test(V.row(pilot, { active: true }) + V.pilotDetails(pilot, { draft: { name: EVIL } })));
});

test('view: one badge, the one that matters most', () => {
  assert.equal(V.badge(sitePerson({ is_admin: true, status: 'pending' }))[0], 'Admin');
  assert.equal(V.badge(sitePerson({ banned_until: '2999-01-01', status: 'pending' }))[0], 'Banned');
  assert.equal(V.badge(sitePerson({ status: 'pending', confirmed: false }))[0], 'Waiting');
  assert.equal(V.badge(sitePerson({ invited: true, confirmed: false }))[0], 'Invited');
  assert.equal(V.badge(sitePerson({ confirmed: false }))[0], 'Unconfirmed');
  assert.equal(V.badge(sitePerson({ banned_until: '2000-01-01' })), null, 'an expired ban is not a ban');
  assert.equal(V.badge(sitePerson()), null);
});

test('view: search covers name, username and email; filters sort people', () => {
  const p = sitePerson({ username: 'annie' });
  for (const q of ['ann', 'ANNIE', 'x.test', '']) assert.ok(V.matches(p, q), q);
  assert.ok(!V.matches(p, 'bob'));
  const waiting = sitePerson({ status: 'pending' });
  const banned = sitePerson({ banned_until: '2999-01-01' });
  assert.ok(V.inFilter(waiting, 'waiting') && !V.inFilter(p, 'waiting'));
  assert.ok(V.inFilter(banned, 'banned') && !V.inFilter(banned, 'active'));
  assert.ok(V.inFilter(p, 'active') && V.inFilter({ best: {} }, 'active'), 'a pilot with no status is active');
});

test('view: a row never holds a form or a button that acts — those live in the drawer', () => {
  const p = sitePerson();
  for (const active of [false, true]) {
    const r = V.row(p, { active });
    assert.ok(!/data-act=|<input type="(text|email)"|data-page=/.test(r));
  }
  assert.match(V.row(p, { active: true }), /class="row active"/);
  assert.match(V.siteDetails(p, []), /data-act="reset"/);
});

test('view: what Ric typed and has not saved wins over the stored value, and says so', () => {
  const pages = [{ key: 'atlas', label: 'ATLAS' }, { key: 'h', label: 'H' }];
  const shownDirty = (html) => (html.match(/class="dirty" data-dirty="\w+">/g) || []).length;
  assert.equal(shownDirty(V.siteDetails(sitePerson(), pages)), 0);
  const d = V.siteDetails(sitePerson(), pages, { draft: { name: 'Annie <b>', pages: ['h'] } });
  assert.match(d, /value="Annie &lt;b&gt;"/);
  assert.match(d, /data-page="h" data-for="u1" checked/);
  assert.ok(!/data-page="atlas" data-for="u1" checked/.test(d), 'the draft un-ticked ATLAS');
  assert.equal(shownDirty(d), 2, 'profile and access both flagged');
  const pilot = { id: 'k1', name: 'Nova', email: 'n@x', best: {} };
  const typed = V.pilotDetails(pilot, { draft: { name: 'Nov' } });
  assert.match(typed, /value="Nov"/);
  assert.equal(shownDirty(typed), 1);
  assert.equal(shownDirty(V.pilotDetails(pilot, { draft: { name: 'Nova' } })), 0, 'typing it back is not a change');
  // Ticking and unticking back to where it started is not a change either.
  assert.deepEqual({ ...V.dirtyOf(sitePerson(), { pages: ['atlas'] }) }, { profile: false, access: false });
  assert.deepEqual({ ...V.dirtyOf(sitePerson({ status: 'pending', pages: [], requested: ['h'] }), { pages: ['h'] }) }, { profile: false, access: false });
  assert.deepEqual({ ...V.dirtyOf(sitePerson(), { email: 'new@x.test' }) }, { profile: true, access: false });
});

test('view: stat cards count and filter, select-all says what is picked', () => {
  const people = [sitePerson(), sitePerson({ id: 'b', status: 'pending' }), sitePerson({ id: 'c', banned_until: '2999-01-01' })];
  assert.deepEqual({ ...V.count(people) }, { all: 3, waiting: 1, active: 1, banned: 1 });
  const s = V.stats(V.count(people), 'waiting');
  assert.match(s, /data-filter="waiting" aria-pressed="true"/);
  assert.match(s, /data-filter="all" aria-pressed="false"/);
  assert.match(V.listHead(3, 0), /3 people/);
  assert.match(V.listHead(3, 3), /id="pick-all"[^>]*checked/);
  assert.match(V.listHead(3, 1), /1 selected/);
  assert.ok(!/checked/.test(V.listHead(0, 0)), 'nothing shown is not "all picked"');
});

test('view: admins have no ban, delete or access boxes; pending gets approve and deny', () => {
  const admin = V.siteDetails(sitePerson({ is_admin: true }), [{ key: 'atlas', label: 'ATLAS' }]);
  assert.ok(!/data-act="(ban|delete|deny|approve)"/.test(admin));
  assert.ok(!/data-page=/.test(admin));
  const pending = V.siteDetails(sitePerson({ status: 'pending', pages: [], requested: ['atlas'] }), [{ key: 'atlas', label: 'ATLAS' }, { key: 'h', label: 'H' }]);
  assert.match(pending, /data-act="approve"/);
  assert.match(pending, /data-page="atlas" data-for="u1" checked/, 'what they asked for starts ticked');
  assert.ok(!/data-page="h" data-for="u1" checked/.test(pending));
});

test('view: with no server function, server-only buttons are disabled and access still works', () => {
  const d = V.siteDetails(sitePerson(), [{ key: 'atlas', label: 'ATLAS' }], { server: false });
  for (const act of ['profile', 'email', 'reset', 'ban', 'delete']) assert.match(d, new RegExp(`data-act="${act}"[^>]*disabled`), act);
  assert.ok(!/data-act="access"[^>]*disabled/.test(d));
});

// ═══ kondrite.js ═══════════════════════════════════════════════════════════

const NOW = 1_700_000_000_000;
const LIVE = { access: 'a1', refresh: 'r1', userId: 'ric', email: 'r@x', name: 'ric', expires: NOW + 60_000 };

function kHarness({ session = null, routes = {}, offline = false } = {}) {
  const store = new Map(session ? [['kondrite.account.v1', JSON.stringify(session)]] : []);
  const calls = [];
  const box = {
    window: { KONDRITE_CLOUD: { url: 'https://k.supabase.co', anonKey: 'pk' } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } },
    encodeURIComponent,
    async fetch(url, opts) {
      if (offline) throw new TypeError('Failed to fetch');
      const p = url.replace('https://k.supabase.co', '');
      calls.push({ path: p, body: opts.body ? JSON.parse(opts.body) : undefined, auth: opts.headers.Authorization });
      const hitR = Object.entries(routes).find(([k]) => p.startsWith(k));
      const [status, json] = hitR ? hitR[1] : [404, { code: 'PGRST202' }];
      return { ok: status < 300, status, text: async () => (json === undefined ? '' : JSON.stringify(json)) };
    },
  };
  vm.createContext(box);
  vm.runInContext(KJS, box);
  const K = box.window.KondriteAdmin;
  K.restore();
  return { K, calls, store };
}
const rejects = async (p) => { try { await p; } catch (e) { return e; } throw new Error('did not reject'); };

test('kondrite: the session key is the one the game writes', () => {
  assert.equal(KJS.match(/const SESSION_KEY = '([^']+)'/)[1], CLOUD.match(/const SESSION_KEY = "([^"]+)"/)[1]);
});

test('kondrite: signed out asks for nothing and says so', async () => {
  const { K, calls } = kHarness();
  assert.equal((await rejects(K.pilots())).kind, 'signed-out');
  assert.equal(calls.length, 0);
});

test('kondrite: an expired token is refreshed first, and saved in the game\'s own shape', async () => {
  const { K, calls, store } = kHarness({ session: { ...LIVE, expires: 1 }, routes: {
    '/auth/v1/token?grant_type=refresh_token': [200, { access_token: 'a2', refresh_token: 'r2', expires_in: 3600, user: { id: 'ric', email: 'r@x', user_metadata: { name: 'ric' } } }],
    '/rest/v1/rpc/admin_pilots': [200, [{ user_id: 'u1', email: 'p@x', name: 'P' }]],
  } });
  const list = await K.pilots();
  assert.equal(calls[1].auth, 'Bearer a2');
  assert.equal(list[0].id, 'u1', 'user_id becomes id, like the site list');
  assert.deepEqual(Object.keys(JSON.parse(store.get('kondrite.account.v1'))).sort(), ['access', 'email', 'expires', 'name', 'refresh', 'userId']);
});

test('kondrite: a refused refresh signs out; a dead network keeps the session', async () => {
  const refused = kHarness({ session: { ...LIVE, expires: 1 }, routes: { '/auth/v1/token': [400, { error: 'invalid_grant' }] } });
  assert.equal((await rejects(refused.K.pilots())).kind, 'signed-out');
  assert.equal(refused.store.has('kondrite.account.v1'), false);
  const off = kHarness({ session: { ...LIVE, expires: 1 }, offline: true });
  assert.equal((await rejects(off.K.pilots())).offline, true);
  assert.equal(JSON.parse(off.store.get('kondrite.account.v1')).refresh, 'r1');
});

test('kondrite: not an admin, and not set up, are told apart', async () => {
  const a = kHarness({ session: LIVE, routes: { '/rest/v1/rpc/admin_pilots': [403, { code: '42501', message: 'admins only' }] } });
  assert.equal((await rejects(a.K.pilots())).kind, 'not-admin');
  const b = kHarness({ session: LIVE });
  assert.equal((await rejects(b.K.pilots())).kind, 'not-set-up');
});

test('kondrite: a password reset goes to KONDRITE\'s own recover endpoint, back to the game', async () => {
  const { K, calls } = kHarness({ session: LIVE, routes: { '/auth/v1/recover': [200, {}] } });
  await K.reset('p@x', 'https://ricmassey.com/');
  assert.equal(calls[0].path, '/auth/v1/recover?redirect_to=' + encodeURIComponent('https://ricmassey.com/projects/kondrite/'));
  assert.deepEqual(calls[0].body, { email: 'p@x' });
  assert.equal(calls[0].auth, undefined, 'a reset is not sent as Ric');
});

// ═══ the wiring ════════════════════════════════════════════════════════════

test('wiring: `admin` and `accounts` open /admin/', () => {
  const index = read('index.html');
  assert.match(index, /admin: \(\) => \{\s+setTimeout\(\(\) => \(location\.href = "admin\/"\)/);
  assert.match(index, /accounts: \(\) => COMMANDS\.admin\(\),/);
  assert.ok(read('EASTER_EGGS.md').includes('| `admin` / `accounts` |'));
});

test('wiring: the admin page loads its scripts in order and is kept out of search', () => {
  const page = read('admin/index.html');
  const order = ['../atlas/config.js', '../assets/site-gate.js', '../projects/kondrite/config.js', 'view.js', 'kondrite.js', 'analytics.js', 'admin.js']
    .map((s) => page.indexOf(`src="${s}"`));
  assert.ok(order.every((i) => i > 0) && order.every((v, i) => i === 0 || v > order[i - 1]), String(order));
  assert.match(page, /<meta name="robots" content="noindex,nofollow,noarchive">/);
});

test('wiring: nothing is fetched or drawn until the database says admin', () => {
  const src = read('admin/admin.js');
  const boot = src.slice(src.indexOf('async function boot()'), src.indexOf('// ── the site'));
  const check = boot.indexOf("rpc('is_site_admin')");
  assert.ok(check > 0);
  assert.ok(boot.indexOf("showGate('denied'") > check);
  for (const later of ['loadSite()', 'loadPilots()', "$('app').hidden = false"]) {
    assert.ok(boot.indexOf(later) > boot.indexOf("if (!isAdmin) return showGate('denied'"), `${later} runs before the admin check`);
  }
});

test('wiring: no browser confirm(), prompt() or alert() — every question is a styled dialog', () => {
  const src = read('admin/admin.js').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  assert.ok(!/(^|[^.\w])(confirm|prompt|alert)\(/m.test(src));
  assert.match(read('admin/index.html'), /<dialog id="confirm-dlg">/);
});

test('wiring: redrawing the list never touches the drawer, so typing is never lost', () => {
  const src = read('admin/admin.js');
  const draw = src.slice(src.indexOf('  function draw() {'), src.indexOf('  function drawBulk() {'));
  assert.ok(draw.length > 100);
  assert.ok(!/drawer/i.test(draw), 'draw() reaches into the drawer');
  assert.match(src, /\$\('find'\)\.addEventListener\('input', draw\);/);
  assert.match(src, /\$\('drawer-body'\)\.addEventListener\('input', noteDraft\);/);
});

test('wiring: bulk ban and delete skip admins before anything is sent', () => {
  const src = read('admin/admin.js');
  const bulk = src.slice(src.indexOf('const BULK = {'), src.indexOf('function report('));
  for (const act of ['ban', 'delete']) {
    const body = bulk.slice(bulk.indexOf(`async ${act}(`));
    assert.match(body, /^async \w+\(picked, b\) \{\s+const targets = picked\.filter\(\(p\) => !p\.is_admin\);/, act);
  }
});

test('wiring: account/ no longer carries the admin panels, and links admins to /admin/', () => {
  const page = read('account/index.html');
  const js = read('account/account.js');
  assert.ok(!/kondrite|admin-panel|admin_people|admin_set_access/.test(page + js));
  assert.match(js, /new URL\('admin\/', siteRoot\)/);
  assert.ok(!fs.existsSync(path.join(ROOT, 'account/kondrite.js')));
});

test('wiring: no email address is written into the admin files', () => {
  for (const f of ['admin/admin.js', 'admin/view.js', 'admin/kondrite.js', 'admin/analytics.js', 'admin/index.html', 'projects/kondrite/supabase/admin.sql']) {
    assert.ok(!/[\w.+-]+@[\w-]+\.(com|net|org|io|me)\b/.test(read(f)), f);
  }
});

// ═══ analytics.js ══════════════════════════════════════════════════════════

const anBox = { window: {}, location: { hostname: 'ricmassey.com', origin: 'https://ricmassey.com' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  Intl, Date, Math, JSON, Number, String, Object, Array, Map, Set, RegExp, document: {}, crypto: {} };
vm.createContext(anBox);
vm.runInContext(read('admin/analytics.js'), anBox);
const AN = anBox.window.AdminAnalytics;
// The dashboard uses <b> itself, so this looks only for what EVIL would inject.
const INJECTED = /<img|<script|<svg|"><img/;

test('analytics: every string a visitor could send is escaped', () => {
  const bad = { country: 'US', region: EVIL, city: EVIL, device: EVIL, browser: 'Safari', os: 'iOS' };
  const sess = { session: 's', visitor: 'aaaaaaaa"><img', start: 1, last: 2, views: 1, dur: 5, ref: EVIL, src: EVIL, camp: EVIL,
    ...bad, lang: EVIL, screen: EVIL, returning: false, pages: [[EVIL, 3, 50, 1]], outs: [EVIL] };
  const now = Date.now();
  const d = {
    configured: true, range: '30d', tz: 0, from: now - 86400000 * 29, now, bucket: 86400000, since: now,
    live: { count: 1, pages: [[EVIL, 1]] }, today: { visitors: 1, sessions: 1, views: 1 },
    total: { visitors: 1, sessions: 1, views: 1, newVisitors: 1 }, series: [[Math.floor(now / 86400000), 1, 1, 1]],
    pages: [[EVIL, 1, 1], ['/404/' + EVIL, 1, 1]], entries: [[EVIL, 1]], referrers: [[EVIL, 1]], countries: [['US', 1]],
    browsers: [[EVIL, 1]], devices: [[EVIL, 1]], os: [[EVIL, 1]], feed: [],
    more: {
      engagement: { sessions: 1, bounces: 1, pagesPerSession: 1, sessionSeconds: 5, pageSeconds: 5, scroll: 50 },
      pages: [{ path: EVIL, views: 1, visitors: 1, dur: 5, depth: 50, entries: 1, exits: 1, bounces: 1 }],
      flows: [[EVIL, EVIL, 1]], heat: [[1, 9, 3]], places: [['US', EVIL, EVIL, 1]], languages: [[EVIL, 1]], screens: [[EVIL, 1]],
      campaigns: [[EVIL, EVIL, 1]], outbound: [[EVIL, 1, 1]], loyalty: [[1, 1]], lengths: [[0, 1]],
      regulars: [{ visitor: 'aaaaaaaa"><img', sessions: 1, views: 1, dur: 5, last: 1, first: 1, ...bad }], sessions: [sess],
    },
  };
  const html = AN.drawAll(d);
  assert.ok(!INJECTED.test(html), 'markup leaked from the dashboard');
  assert.ok(html.includes('&lt;img'));
  const v = AN.drawVisitor({ visitor: 'v', views: 1, sessions: 1, dur: 5, first: 1, last: 2, pages: [[EVIL, 1]], history: [sess] });
  assert.ok(!INJECTED.test(v), 'markup leaked from the visitor view');
});

test('analytics: times, referrers and places read like a person wrote them', () => {
  assert.equal(AN.dur(42), '42s');
  assert.equal(AN.dur(192), '3m 12s');
  assert.equal(AN.dur(3900), '1h 05m');
  assert.equal(AN.refName('l.facebook.com'), 'Facebook');
  assert.equal(AN.refName(''), 'Direct');
  assert.equal(AN.refName('somebodys-blog.net'), 'somebodys-blog.net');
  assert.match(AN.place({ country: 'US', region: 'Kentucky', city: 'Lexington' }), /Lexington, Kentucky, United States/);
  assert.equal(AN.place({}), 'Unknown place');
});

test('analytics: filters from the address, CSV and the comparison words are safe and plain', () => {
  const d = { configured: true, range: '7d', tz: 0, from: 0, now: 86400000 * 7, bucket: 86400000, since: 0,
    live: { count: 0, pages: [] }, today: { visitors: 0, sessions: 0, views: 0 }, total: { visitors: 2, sessions: 3, views: 4, newVisitors: 1 },
    series: [], pages: [], entries: [], referrers: [['google.com', 2], ['google.ca', 1], ['', 1]], countries: [], browsers: [], devices: [], os: [], feed: [],
    more: { filters: { path: EVIL, ref: 'google.com' }, prev: { visitors: 1, sessions: 3, views: 8, pages: [] }, since: { at: 1, views: 2, sessions: 1, visitors: 1, newVisitors: 1, pages: [[EVIL, 2]] },
      engagement: {}, pages: [], sessions: [], regulars: [] } };
  // A label read from the address bar is somebody else's link, so it is escaped too.
  const html = AN.drawAll(d, { range: '7d', labels: { path: EVIL } });
  assert.ok(!INJECTED.test(html));
  assert.match(html, /data-unfilter="path"/);
  // "Google" is one row and filters to both of its hosts.
  assert.match(html, /data-fv="google\.com,google\.ca"/);
  assert.match(html, /▲ 100% vs the 7 days before/);
  assert.match(html, /▼ 50% vs the 7 days before/);
  assert.equal(AN.delta(5, 5, 'all'), '');
  assert.match(AN.delta(0.5, 0.25, '7d', { worse: true, ratio: true }), /class="an-delta down">▲ 25 pts/);
  assert.equal(AN.filterWords('ref', 'google.com,google.ca'), 'came from Google');
  const csv = AN.toCsv('sessions', { more: { sessions: [{ start: 0, visitor: 'v', pages: [['/a, "b"', 1], ['=cmd|x', 1]], city: '=HYPERLINK("x")' }] } });
  assert.match(csv, /"\/a, ""b"" > =cmd\|x"/);
  assert.match(csv, /"'=HYPERLINK\(""x""\)"/);
  assert.equal(AN.toCsv('nope', {}), '');
});

test('wiring: the analytics tab reaches only the visitor Worker, with the admin session', () => {
  const page = read('admin/index.html');
  assert.match(page, /connect-src 'self' https:\/\/\*\.supabase\.co http:\/\/127\.0\.0\.1:54321 https:\/\/training-log\.rmbuster82\.workers\.dev;/);
  const src = read('admin/analytics.js');
  assert.ok(src.includes("headers['x-admin-session'] = session"));
  // The session token goes to the Worker and nowhere else: one fetch helper.
  assert.equal((src.match(/fetch\(/g) || []).length, 3);   // call() twice (session, then password) + the password check
});

for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}
if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log(`\n${tests.length} passed`);
